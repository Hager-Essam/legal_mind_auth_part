import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthService } from "../auth/auth.service";
import { authenticate } from "../auth/auth.middleware";
import type { UserRepository } from "../auth/users/user.repository";
import type { CommentService } from "./comment.service";
import { createCommentController } from "./comment.controller";

export type CommentRouteDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  commentService: CommentService;
};

export const createCommentRouter = (services: CommentRouteDependencies) => {
  const router = Router();
  const controller = createCommentController(services.commentService);
  router.use(authenticate(services.authService, services.userRepository));
  const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.put("/:commentId", writeLimiter, controller.update);
  router.delete("/:commentId", controller.remove);

  return router;
};
