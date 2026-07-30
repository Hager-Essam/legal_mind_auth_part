import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createQueryController } from "../../controllers/query.controller";
import type { AppServices } from "../../services/service-container";
import { authenticate } from "../../modules/auth/auth.middleware";

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Please wait before sending more queries. Rate limit: 20 requests per minute." },
});

export const createQueryRouter = (services: AppServices) => {
  const router = Router();
  router.post(
    "/query",
    authenticate(services.authService, services.userRepository),
    queryLimiter,
    createQueryController(services),
  );
  return router;
};
