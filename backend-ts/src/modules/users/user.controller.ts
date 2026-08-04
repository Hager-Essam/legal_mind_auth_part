import type { NextFunction, Request, Response } from "express";
import { toPublicUser } from "../auth/auth.mapper";
import { HttpError } from "../../shared/http/http-error";
import type { UserProfileService } from "./user-profile.service";
import { updateProfileSchema } from "./user-profile.schemas";

const authenticatedUserId = (request: Request): string => {
  if (!request.user) {
    throw new HttpError(401, "Authentication is required.", undefined, "AUTH_REQUIRED");
  }

  return request.user.id;
};

export const createUserController = (profiles: UserProfileService) => ({
  updateProfile: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = updateProfileSchema.parse(request.body);
      const user = await profiles.update(authenticatedUserId(request), input);
      response.json({
        message: "Profile updated successfully.",
        user: toPublicUser(user),
      });
    } catch (error) {
      next(error);
    }
  },

  uploadAvatar: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = await profiles.uploadAvatar(authenticatedUserId(request), request.file);
      response.json({
        message: "Avatar uploaded successfully.",
        user: toPublicUser(user),
      });
    } catch (error) {
      next(error);
    }
  },
});
