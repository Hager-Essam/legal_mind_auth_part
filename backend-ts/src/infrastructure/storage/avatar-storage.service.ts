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
    this.client ??= new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    return this.client;
  }

  async upload(userId: string, content: Buffer, contentType: AvatarContentType): Promise<StoredAvatar> {
    const config = this.configuration();
    const key = `avatars/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
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

    return { key, url: `${config.publicUrl}/${encodedKey(key)}` };
  }

  async delete(key: string): Promise<void> {
    const config = this.configuration();
    await this.configuredClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  }
}
