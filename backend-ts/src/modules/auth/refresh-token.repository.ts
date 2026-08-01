import type { HydratedDocument, Types } from "mongoose";
import { RefreshTokenModel } from "./refresh-token.model";
import type { RefreshToken } from "./refresh-token.schema";

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export type CreateRefreshTokenInput = {
  tokenHash: string;
  userId: Types.ObjectId | string;
  expiresAt: Date;
  createdByIp?: string;
};

export class RefreshTokenRepository {
  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create(input);
  }

  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({
      tokenHash,
      revokedAt: null,
      replacedByTokenHash: null,
      expiresAt: { $gt: new Date() },
    });
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash });
  }

  async rotateToken(
    currentTokenHash: string,
    replacement: CreateRefreshTokenInput,
    revokedByIp?: string,
  ): Promise<RefreshTokenDocument | null> {
    const revoked = await RefreshTokenModel.findOneAndUpdate(
      {
        tokenHash: currentTokenHash,
        revokedAt: null,
        replacedByTokenHash: null,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedByIp,
          replacedByTokenHash: replacement.tokenHash,
        },
      },
      { returnDocument: "after" },
    );
    if (!revoked) return null;
    return this.create(replacement);
  }

  async revokeToken(
    tokenHash: string,
    revokedByIp?: string,
  ): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedByIp } },
      { returnDocument: "after" },
    );
  }

  async revokeAllUserTokens(
    userId: Types.ObjectId | string,
    revokedByIp?: string,
  ) {
    return RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedByIp } },
    );
  }
}
