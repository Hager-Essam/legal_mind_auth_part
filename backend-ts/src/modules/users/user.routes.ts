import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthService } from "../auth/auth.service";
import { authenticate } from "../auth/auth.middleware";
import type { UserRepository } from "../auth/users/user.repository";
import type { UserProfileService } from "./user-profile.service";
import { avatarUploadMiddleware } from "./avatar-upload.middleware";
import { createUserController } from "./user.controller";

export type UserRouteDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  userProfileService: UserProfileService;
};

const avatarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AVATAR_RATE_LIMITED",
    message: "تم تحميل الكثير من الصور الشخصية. يرجى المحاولة مرة أخرى لاحقًا.",
  },
});

export const createUserRouter = (services: UserRouteDependencies) => {
  const router = Router();
  const requireAuth = authenticate(services.authService, services.userRepository);
  const controller = createUserController(services.userProfileService);
  router.use(requireAuth);
  router.patch("/profile", controller.updateProfile);
  router.post("/profile/avatar", avatarLimiter, avatarUploadMiddleware, controller.uploadAvatar);

  return router;
};
