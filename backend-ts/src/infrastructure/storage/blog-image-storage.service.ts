import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http/http-error";

export const BLOG_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type BlogImageContentType = (typeof BLOG_IMAGE_CONTENT_TYPES)[number];

export type StoredBlogImage = {
  key: string;
  url: string;
};

export interface BlogImageStorage {
  upload(userId: string, content: Buffer, contentType: BlogImageContentType): Promise<StoredBlogImage>;
  delete(key: string): Promise<void>;
}

const extensionFor = (contentType: BlogImageContentType): string => {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/gif") return "gif";
  return "webp";
};

const encodedKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

export class R2BlogImageStorage implements BlogImageStorage {
  private client: S3Client | null = null;

  private configuration() {
    const missing = [
      ["LEGALMIND_R2_ACCOUNT_ID", env.r2AccountId],
      ["LEGALMIND_R2_ACCESS_KEY_ID", env.r2AccessKeyId],
      ["LEGALMIND_R2_SECRET_ACCESS_KEY", env.r2SecretAccessKey],
      ["LEGALMIND_R2_BUCKET", env.r2Bucket],
      ["LEGALMIND_R2_PUBLIC_URL", env.r2PublicUrl],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new HttpError(
        503,
        "Blog image storage is not configured.",
        { missing },
        "BLOG_IMAGE_STORAGE_NOT_CONFIGURED"
      );
    }

    return {
      accountId: env.r2AccountId as string,
      accessKeyId: env.r2AccessKeyId as string,
      secretAccessKey: env.r2SecretAccessKey as string,
      bucket: env.r2Bucket as string,
      publicUrl: (env.r2PublicUrl as string).replace(/\/$/, ""),
    };
  }

  private configuredClient(config: ReturnType<R2BlogImageStorage["configuration"]>) {
    this.client ??= new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    return this.client;
  }

  async upload(
    userId: string,
    content: Buffer,
    contentType: BlogImageContentType
  ): Promise<StoredBlogImage> {
    const config = this.configuration();
    const key = `blog-images/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;

    try {
      await this.configuredClient(config).send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: content,
          ContentType: contentType,
          ContentDisposition: "inline",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    } catch (error) {
      throw this.mapStorageError(error, "upload");
    }

    return { key, url: `${config.publicUrl}/${encodedKey(key)}` };
  }

  async delete(key: string): Promise<void> {
    const config = this.configuration();

    try {
      await this.configuredClient(config).send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
      );
    } catch (error) {
      throw this.mapStorageError(error, "delete");
    }
  }

  private mapStorageError(error: unknown, operation: "upload" | "delete"): never {
    if (error instanceof HttpError) {
      throw error;
    }

    const code =
      typeof error === "object" && error !== null && "Code" in error
        ? String((error as { Code?: unknown }).Code ?? "")
        : "";
    const name =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error);

    const denied =
      code === "AccessDenied" ||
      name === "AccessDenied" ||
      /access denied/i.test(message) ||
      code === "InvalidAccessKeyId" ||
      code === "SignatureDoesNotMatch";

    if (denied) {
      throw new HttpError(
        503,
        "Blog image storage rejected the request. Check LEGALMIND_R2_* credentials.",
        {
          operation,
          bucket: env.r2Bucket,
          storageCode: code || name || "AccessDenied",
        },
        "BLOG_IMAGE_STORAGE_ACCESS_DENIED"
      );
    }

    throw new HttpError(
      502,
      `Blog image storage ${operation} failed.`,
      { operation, storageCode: code || name || "UnknownError", message },
      "BLOG_IMAGE_STORAGE_ERROR"
    );
  }
}
