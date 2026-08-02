import { Router } from "express";
import type { AuthService } from "../auth/auth.service";
import { authenticate } from "../auth/auth.middleware";
import type { UserRepository } from "../auth/users/user.repository";
import type { BookmarkService } from "./bookmark.service";
import { createBookmarkController } from "./bookmark.controller";

export type BookmarkRouteDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  bookmarkService: BookmarkService;
};

export const createUserBookmarkRouter = (services: BookmarkRouteDependencies) => {
  const router = Router();
  const controller = createBookmarkController(services.bookmarkService);
  router.use(authenticate(services.authService, services.userRepository));
  router.get("/me/bookmarks", controller.list);
  router.delete("/me/bookmarks/:bookmarkId", controller.remove);

  return router;
};

export const createBlogBookmarkRouter = (services: BookmarkRouteDependencies) => {
  const router = Router();
  const controller = createBookmarkController(services.bookmarkService);
  router.use(authenticate(services.authService, services.userRepository));
  router.post("/:blogId/bookmark", controller.toggle);

  return router;
};
