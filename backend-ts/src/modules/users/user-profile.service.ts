import type { AvatarContentType, AvatarStorage } from "../../infrastructure/storage/avatar-storage.service";
import { HttpError } from "../../shared/http/http-error";
import type { UserRepository } from "../auth/users/user.repository";
import type { UserDocument } from "../auth/users/user.types";
import type { UpdateProfileInput } from "./user-profile.schemas";

const hasPrefix = (buffer: Buffer, prefix: readonly number[]): boolean =>
  prefix.every((value, index) => buffer[index] === value);

export const detectAvatarContentType = (buffer: Buffer): AvatarContentType | null => {
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";

  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

export class UserProfileService {
  constructor(
    private readonly users: UserRepository,
    private readonly avatars: AvatarStorage
  ) {}

  async update(userId: string, input: UpdateProfileInput): Promise<UserDocument> {
    const user = await this.users.updateById(userId, input);

    if (!user) {
      throw new HttpError(404, "User not found.", undefined, "USER_NOT_FOUND");
    }

    return user;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined): Promise<UserDocument> {
    if (!file) {
      throw new HttpError(400, "An avatar file is required.", undefined, "AVATAR_REQUIRED");
    }
    const detectedType = detectAvatarContentType(file.buffer);

    if (!detectedType || detectedType !== file.mimetype) {
      throw new HttpError(
        400,
        "The avatar content does not match a supported image type.",
        undefined,
        "AVATAR_CONTENT_INVALID"
      );
    }

    const current = await this.users.findByIdWithAvatarStorage(userId);

    if (!current) {
      throw new HttpError(404, "User not found.", undefined, "USER_NOT_FOUND");
    }

    const stored = await this.avatars.upload(userId, file.buffer, detectedType);
    let updated: UserDocument | null = null;

    try {
      updated = await this.users.updateById(userId, {
        avatarUrl: stored.url,
        avatarObjectKey: stored.key,
      });

      if (!updated) {
        throw new HttpError(404, "User not found.", undefined, "USER_NOT_FOUND");
      }
    } catch (error) {
      await this.avatars.delete(stored.key).catch(() => undefined);

      throw error;
    }

    if (current.avatarObjectKey && current.avatarObjectKey !== stored.key) {
      await this.avatars.delete(current.avatarObjectKey).catch((error) => {
        console.error("Failed to delete replaced R2 avatar", error);
      });
    }

    return updated;
  }
}
