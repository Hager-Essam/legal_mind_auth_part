import { isValidObjectId, Types } from "mongoose";
import { HttpError } from "../../shared/http/http-error";
import type { UserRole } from "../auth/users/user.types";
import type { BlogRepository } from "../blogs/blog.repository";
import type { CommentRepository } from "./comment.repository";
import { toCommentResponse } from "./comment.mapper";

export class CommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly blogs: BlogRepository
  ) {}

  private objectId(value: string, label: string): Types.ObjectId {
    if (!isValidObjectId(value)) {
      throw new HttpError(400, `${label} ID غير صالح.`, undefined, "INVALID_IDENTIFIER");
    }

    return new Types.ObjectId(value);
  }

  async create(blogId: string, userId: string, content: string) {
    const blog = await this.blogs.findById(this.objectId(blogId, "blog"));

    if (!blog) throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");

    if (blog.status !== "published") {
      throw new HttpError(400, "يسمح للتعليقات فقط على المقالات المنشورة.", undefined, "BLOG_NOT_PUBLISHED");
    }

    return toCommentResponse(await this.comments.create(blog._id, this.objectId(userId, "user"), content));
  }

  async list(blogId: string, page: number, limit: number) {
    const blog = await this.blogs.findById(this.objectId(blogId, "blog"));

    if (!blog || blog.status !== "published") {
      throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");
    }
    const result = await this.comments.listByBlog(blog._id, page, limit);

    return {
      comments: result.comments.map((comment) => toCommentResponse(comment)),
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit),
      },
    };
  }

  async update(commentId: string, userId: string, content: string) {
    const id = this.objectId(commentId, "comment");
    const updated = await this.comments.updateOwned(id, this.objectId(userId, "user"), content);

    if (updated) return toCommentResponse(updated);

    if (!(await this.comments.findById(id))) {
      throw new HttpError(404, "التعليق غير موجود.", undefined, "COMMENT_NOT_FOUND");
    }

    throw new HttpError(403, "يمكنك تحديث فقط التعليقات الخاصة بك.", undefined, "COMMENT_FORBIDDEN");
  }

  async remove(commentId: string, userId: string, role: UserRole): Promise<void> {
    const id = this.objectId(commentId, "comment");
    const comment = await this.comments.findById(id);

    if (!comment) throw new HttpError(404, "التعليق غير موجود.", undefined, "COMMENT_NOT_FOUND");

    if (comment.author.toString() !== userId && role !== "admin") {
      throw new HttpError(403, "يمكنك حذف فقط التعليقات الخاصة بك.", undefined, "COMMENT_FORBIDDEN");
    }
    await this.comments.deleteById(id);
  }
}
