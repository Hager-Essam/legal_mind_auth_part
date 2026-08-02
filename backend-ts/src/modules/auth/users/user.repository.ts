import type { Types } from "mongoose";
import { UserModel } from "./user.model";
import { normalizeEmail } from "./user.schema";
import type { CreateUserInput, User, UserDocument } from "../users/user.types";

const sensitiveTokenSelection =
  "+emailVerificationTokenHash +emailVerificationExpires " + "+passwordResetTokenHash +passwordResetExpires";

export class UserRepository {
  async create(input: CreateUserInput): Promise<UserDocument> {
    return UserModel.create({ ...input, email: normalizeEmail(input.email) });
  }

  async findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return UserModel.findById(id);
  }

  async findByIdWithAvatarStorage(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return UserModel.findById(id).select("+avatarObjectKey");
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findByEmailWithoutPassword(email);
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: normalizeEmail(email) }).select("+password");
  }

  async findByEmailWithoutPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: normalizeEmail(email) });
  }

  async findByResetTokenHash(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select(sensitiveTokenSelection);
  }

  async findByVerificationTokenHash(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select(sensitiveTokenSelection);
  }

  async updateLastLogin(userId: string | Types.ObjectId): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(
      userId,
      { $set: { lastLoginAt: new Date() } },
      { returnDocument: "after" }
    );
  }

  async updatePassword(userId: string | Types.ObjectId, password: string): Promise<UserDocument | null> {
    const user = await UserModel.findById(userId).select(sensitiveTokenSelection);

    if (!user) return null;
    user.password = password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;

    return user.save();
  }

  async updateById(userId: string | Types.ObjectId, update: Partial<User>): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(userId, update, {
      returnDocument: "after",
      runValidators: true,
    });
  }

  async deleteById(userId: string | Types.ObjectId): Promise<void> {
    await UserModel.deleteOne({ _id: userId });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await UserModel.exists({ email: normalizeEmail(email) })) !== null;
  }
}
