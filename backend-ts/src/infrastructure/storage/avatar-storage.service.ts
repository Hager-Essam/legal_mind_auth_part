import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http/http-error";

export const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

export type StoredAvatar = {
  key: string;
  url: string;
};

export interface AvatarStorage {
  upload(userId: string, content: Buffer, contentType: AvatarContentType): Promise<StoredAvatar>;
  delete(key: string): Promise<void>;
}

const extensionFor = (contentType: AvatarContentType): string => {
  if (contentType === "image/jpeg") return "jpg";

  if (contentType === "image/png") return "png";

  return "webp";
};

const encodedKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

export class R2AvatarStorage implements AvatarStorage {
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
        "Avatar storage is not configured.",
        { missing },
        "AVATAR_STORAGE_NOT_CONFIGURED"
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

  private configuredClient(config: ReturnType<R2AvatarStorage["configuration"]>) {
    // AWS SDK >= 3.729 defaults to flexible checksums that R2 rejects (AccessDenied).
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

  async upload(userId: string, content: Buffer, contentType: AvatarContentType): Promise<StoredAvatar> {
    const config = this.configuration();
    const key = `avatars/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;

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
      await this.configuredClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
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
        "Avatar storage rejected the request. Check LEGALMIND_R2_* credentials and that the R2 API token has Object Read & Write on the configured bucket.",
        {
          operation,
          bucket: env.r2Bucket,
          storageCode: code || name || "AccessDenied",
        },
        "AVATAR_STORAGE_ACCESS_DENIED"
      );
    }

    throw new HttpError(
      502,
      `Avatar storage ${operation} failed.`,
      { operation, storageCode: code || name || "UnknownError", message },
      "AVATAR_STORAGE_ERROR"
    );
  }
}
