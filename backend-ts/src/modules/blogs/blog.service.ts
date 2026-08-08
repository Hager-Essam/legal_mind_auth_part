import { isValidObjectId, Types } from "mongoose";
import { HttpError } from "../../shared/http/http-error";
import type { UserRole } from "../auth/users/user.types";
import type { BookmarkRepository } from "../bookmarks/bookmark.repository";
import type { CommentRepository } from "../comments/comment.repository";
import { toBlogResponse } from "./blog.mapper";
import type { BlogRepository, BlogListOptions } from "./blog.repository";
import type { BlogStatus, BlogWriteInput } from "./blog.types";

export class BlogService {
  constructor(
    private readonly blogs: BlogRepository,
    private readonly bookmarks: BookmarkRepository,
    private readonly comments: CommentRepository
  ) {}

  objectId(value: string, label = "blog"): Types.ObjectId {
    if (!isValidObjectId(value)) {
      throw new HttpError(400, `The ${label} ID is invalid.`, undefined, "INVALID_IDENTIFIER");
    }

    return new Types.ObjectId(value);
  }

  async create(userId: string, input: BlogWriteInput) {
    return toBlogResponse(
      await this.blogs.create({
        ...input,
        author: this.objectId(userId, "user"),
      })
    );
  }

  async list(options: BlogListOptions) {
    const result = await this.blogs.listPublished(options);

    return {
      blogs: result.blogs.map((blog) => toBlogResponse(blog)),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: result.total,
        pages: Math.ceil(result.total / options.limit),
      },
    };
  }

  async listMine(userId: string, page: number, limit: number) {
    const result = await this.blogs.listByAuthor(this.objectId(userId, "user"), page, limit);

    return {
      blogs: result.blogs.map((blog) => toBlogResponse(blog)),
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit),
      },
    };
  }

  async detail(blogId: string, viewerId?: string) {
    const id = this.objectId(blogId);
    const viewer = viewerId ? this.objectId(viewerId, "user") : undefined;
    const blog = await this.blogs.findVisibleById(id, viewer);

    if (!blog) throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");
    const isPublished = blog.status === "published";
    const bookmarked = viewerId && isPublished ? await this.bookmarks.isBookmarked(viewerId, id) : false;

    if (isPublished) {
      await this.blogs.incrementViews(id);
      blog.views += 1;
    }

    return toBlogResponse(blog, bookmarked);
  }

  async update(blogId: string, userId: string, input: Partial<BlogWriteInput>) {
    const updated = await this.blogs.updateOwned(this.objectId(blogId), this.objectId(userId, "user"), input);

    if (updated) return toBlogResponse(updated);

    if (!(await this.blogs.findById(this.objectId(blogId)))) {
      throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");
    }

    throw new HttpError(403, "يمكنك تحديث فقط المقالات الخاصة بك.", undefined, "BLOG_FORBIDDEN");
  }

  async remove(blogId: string, userId: string, role: UserRole): Promise<void> {
    const id = this.objectId(blogId);
    const blog = await this.blogs.findById(id);

    if (!blog) throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");

    if (blog.author.toString() !== userId && role !== "admin") {
      throw new HttpError(403, "يمكنك حذف فقط المقالات الخاصة بك.", undefined, "BLOG_FORBIDDEN");
    }
    await Promise.all([this.bookmarks.removeByBlog(id), this.comments.deleteByBlog(id)]);
    await this.blogs.deleteById(id);
  }

  async updateStatus(blogId: string, status: BlogStatus, rejectionReason?: string) {
    const updated = await this.blogs.updateStatus(this.objectId(blogId), status, rejectionReason);

    if (!updated) throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");

    return toBlogResponse(updated);
  }

  async popular(limit: number) {
    return {
      blogs: (await this.blogs.popular(limit)).map((blog) => toBlogResponse(blog)),
    };
  }

  async trending(limit: number) {
    return {
      blogs: (await this.blogs.trending(limit)).map((blog) => toBlogResponse(blog)),
    };
  }
}
