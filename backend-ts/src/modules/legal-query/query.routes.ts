import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createQueryController } from "./query.controller";
import type { AuthService } from "../auth/auth.service";
import type { UserRepository } from "../auth/users/user.repository";
import type { QueryService } from "./query.service";
import { authenticate } from "../auth/auth.middleware";

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "يرجى الانتظار قبل إرسال المزيد من الاستعلامات. الحد المسموح به: 20 استعلام في الدقيقة.",
  },
});

export type QueryDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  queryService: QueryService;
};

export const createQueryRouter = (services: QueryDependencies) => {
  const router = Router();
  router.post(
    "/query",
    authenticate(services.authService, services.userRepository),
    queryLimiter,
    createQueryController(services.queryService)
  );

  return router;
};
