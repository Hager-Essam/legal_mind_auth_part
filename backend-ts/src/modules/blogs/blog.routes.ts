import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthService } from "../auth/auth.service";
import { authenticate, authorize, optionalAuth } from "../auth/auth.middleware";
import type { UserRepository } from "../auth/users/user.repository";
import type { CommentService } from "../comments/comment.service";
import { createCommentController } from "../comments/comment.controller";
import type { BlogService } from "./blog.service";
import { createBlogController } from "./blog.controller";

export type BlogRouteDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  blogService: BlogService;
  commentService: CommentService;
};

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export const createBlogRouter = (services: BlogRouteDependencies) => {
  const router = Router();
  const blogs = createBlogController(services.blogService);
  const comments = createCommentController(services.commentService);
  const required = authenticate(services.authService, services.userRepository);

  router.get("/", blogs.list);
  router.get("/categories", blogs.categories);
  router.get("/popular", blogs.popular);
  router.get("/trending", blogs.trending);
  router.get("/me/my-blogs", required, blogs.mine);
  router.post("/", required, writeLimiter, blogs.create);
  router.get("/:blogId/comments", comments.list);
  router.post("/:blogId/comments", required, writeLimiter, comments.create);
  router.get("/:blogId", optionalAuth(services.authService, services.userRepository), blogs.detail);
  router.put("/:blogId", required, writeLimiter, blogs.update);
  router.delete("/:blogId", required, blogs.remove);
  router.patch("/:blogId/status", required, authorize("admin"), blogs.status);

  return router;
};
