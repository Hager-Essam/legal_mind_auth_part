import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../shared/http/http-error";
import type { CommentService } from "./comment.service";
import { commentBodySchema, listCommentsSchema } from "./comment.schemas";

const authenticated = (request: Request) => {
  if (!request.user)
    throw new HttpError(401, "يجب عليك تسجيل الدخول لتسجيل الدخول.", undefined, "AUTH_REQUIRED");

  return request.user;
};

export const createCommentController = (comments: CommentService) => ({
  list: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = listCommentsSchema.parse(request.query);
      response.json(await comments.list(String(request.params.blogId), input.page, input.limit));
    } catch (error) {
      next(error);
    }
  },

  create: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = commentBodySchema.parse(request.body);
      const comment = await comments.create(
        String(request.params.blogId),
        authenticated(request).id,
        input.content
      );
      response.status(201).json({ message: "تم إنشاء التعليق بنجاح.", comment });
    } catch (error) {
      next(error);
    }
  },

  update: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = commentBodySchema.parse(request.body);
      const comment = await comments.update(
        String(request.params.commentId),
        authenticated(request).id,
        input.content
      );
      response.json({ message: "تم تحديث التعليق بنجاح.", comment });
    } catch (error) {
      next(error);
    }
  },

  remove: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = authenticated(request);
      await comments.remove(String(request.params.commentId), user.id, user.role);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },
});
