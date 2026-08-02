import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../shared/http/http-error";
import type { BookmarkService } from "./bookmark.service";
import { listBookmarksSchema } from "./bookmark.schemas";

const userId = (request: Request): string => {
  if (!request.user) {
    throw new HttpError(401, "Authentication is required.", undefined, "AUTH_REQUIRED");
  }

  return request.user.id;
};

export const createBookmarkController = (bookmarks: BookmarkService) => ({
  toggle: async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(await bookmarks.toggle(userId(request), String(request.params.blogId)));
    } catch (error) {
      next(error);
    }
  },
  list: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = listBookmarksSchema.parse(request.query);
      response.json(await bookmarks.list(userId(request), input.page, input.limit));
    } catch (error) {
      next(error);
    }
  },
  remove: async (request: Request, response: Response, next: NextFunction) => {
    try {
      await bookmarks.remove(userId(request), String(request.params.bookmarkId));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },
});
