import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../shared/http/http-error";
import type { BlogService } from "./blog.service";
import {
  createBlogSchema,
  limitedListSchema,
  listBlogsSchema,
  listMyBlogsSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
} from "./blog.schemas";

const authenticated = (request: Request) => {
  if (!request.user)
    throw new HttpError(401, "يجب عليك تسجيل الدخول لتسجيل الدخول.", undefined, "AUTH_REQUIRED");

  return request.user;
};

export const createBlogController = (blogs: BlogService) => ({
  list: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = listBlogsSchema.parse(request.query);
      const tags = input.tags
        ?.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      response.json(await blogs.list({ ...input, tags }));
    } catch (error) {
      next(error);
    }
  },

  categories: (_request: Request, response: Response) => {
    response.json({
      categories: [
        { value: "Criminal Law", label: "القانون الجنائي" },
        { value: "Civil Law", label: "القانون المدني" },
        { value: "Corporate Law", label: "القانون التجاري" },
        { value: "Family Law", label: "قانون الأسرة" },
        { value: "Labor Law", label: "قانون العمل" },
        { value: "Tax Law", label: "القانون الضريبي" },
        { value: "Other", label: "أخرى" },
      ],
    });
  },

  popular: async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(await blogs.popular(limitedListSchema.parse(request.query).limit));
    } catch (error) {
      next(error);
    }
  },

  trending: async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(await blogs.trending(limitedListSchema.parse(request.query).limit));
    } catch (error) {
      next(error);
    }
  },

  detail: async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({
        blog: await blogs.detail(String(request.params.blogId), request.user?.id),
      });
    } catch (error) {
      next(error);
    }
  },

  create: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const blog = await blogs.create(authenticated(request).id, createBlogSchema.parse(request.body));
      response.status(201).json({ message: "تم إنشاء المقال بنجاح.", blog });
    } catch (error) {
      next(error);
    }
  },

  mine: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = listMyBlogsSchema.parse(request.query);
      response.json(await blogs.listMine(authenticated(request).id, input.page, input.limit));
    } catch (error) {
      next(error);
    }
  },

  update: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const blog = await blogs.update(
        String(request.params.blogId),
        authenticated(request).id,
        updateBlogSchema.parse(request.body)
      );
      response.json({ message: "تم تحديث المقال بنجاح.", blog });
    } catch (error) {
      next(error);
    }
  },

  remove: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = authenticated(request);
      await blogs.remove(String(request.params.blogId), user.id, user.role);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  status: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = updateBlogStatusSchema.parse(request.body);
      const blog = await blogs.updateStatus(
        String(request.params.blogId),
        input.status,
        input.rejectionReason
      );
      response.json({ message: "تم تحديث حالة المقال بنجاح.", blog });
    } catch (error) {
      next(error);
    }
  },
});
