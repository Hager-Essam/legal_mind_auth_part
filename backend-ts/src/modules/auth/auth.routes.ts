import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AppServices } from "../../services/service-container";
import { validateBody } from "../../middlewares/validation.middleware";
import { lawyerIdUpload } from "../../middlewares/upload.middleware";
import { authenticate } from "./auth.middleware";
import { createAuthController } from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schemas";

const limiter = (windowMs: number, max: number) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts. Please try again later.",
    },
  });

const registrationLimiter = limiter(60 * 60 * 1000, 5);
const loginLimiter = limiter(15 * 60 * 1000, 10);
const refreshLimiter = limiter(60 * 1000, 30);
const forgotPasswordLimiter = limiter(60 * 60 * 1000, 5);
const resendVerificationLimiter = limiter(60 * 60 * 1000, 5);

export const createAuthRouter = (services: AppServices) => {
  const router = Router();
  const controller = createAuthController(
    services.authService,
    services.userRepository,
  );
  const requireAuth = authenticate(services.authService, services.userRepository);

  router.post(
    "/register",
    registrationLimiter,
    lawyerIdUpload.single("lawyerIdDocument"),
    validateBody(registerSchema),
    controller.register,
  );
  router.post(
    "/verify-email",
    validateBody(verifyEmailSchema),
    controller.verifyEmail,
  );
  router.post(
    "/resend-verification",
    resendVerificationLimiter,
    validateBody(resendVerificationSchema),
    controller.resendVerification,
  );
  router.post(
    "/login",
    loginLimiter,
    validateBody(loginSchema),
    controller.login,
  );
  router.post(
    "/refresh-token",
    refreshLimiter,
    validateBody(refreshSchema),
    controller.refreshToken,
  );
  router.post(
    "/logout",
    validateBody(refreshSchema),
    controller.logout,
  );
  router.post("/logout-all", requireAuth, controller.logoutAll);
  router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    validateBody(forgotPasswordSchema),
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    validateBody(resetPasswordSchema),
    controller.resetPassword,
  );
  router.get("/me", requireAuth, controller.me);
  return router;
};
