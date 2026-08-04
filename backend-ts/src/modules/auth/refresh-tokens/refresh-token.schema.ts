import { Schema, type Types } from "mongoose";

export type RefreshToken = {
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByTokenHash?: string | null;
  createdByIp?: string;
  revokedByIp?: string;
  createdAt: Date;
  updatedAt: Date;
};

export const refreshTokenSchema = new Schema<RefreshToken>(
  {
    tokenHash: { type: String, required: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    createdByIp: { type: String },
    revokedByIp: { type: String },
  },
  {
    collection: "refresh_tokens",
    timestamps: true,
    versionKey: false,
  }
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true, name: "refresh_tokens_hash_unique" });
refreshTokenSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "refresh_tokens_expiry_ttl",
  }
);
refreshTokenSchema.index({ userId: 1, revokedAt: 1 }, { name: "refresh_tokens_user_revoked" });
