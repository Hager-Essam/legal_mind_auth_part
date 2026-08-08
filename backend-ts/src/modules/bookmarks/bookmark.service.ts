import { isValidObjectId, Types } from "mongoose";
import { HttpError } from "../../shared/http/http-error";
import type { BookmarkRepository } from "./bookmark.repository";

export class BookmarkService {
  constructor(private readonly bookmarks: BookmarkRepository) {}

  private blogObjectId(blogId: string): Types.ObjectId {
    if (!isValidObjectId(blogId)) {
      throw new HttpError(400, "المقال ID غير صالح.", undefined, "INVALID_BLOG_ID");
    }

    return new Types.ObjectId(blogId);
  }

  async toggle(ownerUserId: string, blogId: string) {
    const objectId = this.blogObjectId(blogId);

    if (!(await this.bookmarks.publishedBlogExists(objectId))) {
      throw new HttpError(404, "المقال غير موجود.", undefined, "BLOG_NOT_FOUND");
    }

    return this.bookmarks.toggle(ownerUserId, objectId);
  }

  async remove(ownerUserId: string, bookmarkId: string): Promise<void> {
    if (!(await this.bookmarks.removeOwned(ownerUserId, bookmarkId))) {
      throw new HttpError(404, "المفضلة غير موجودة.", undefined, "BOOKMARK_NOT_FOUND");
    }
  }

  async list(ownerUserId: string, page: number, limit: number) {
    const result = await this.bookmarks.list(ownerUserId, page, limit);

    return {
      bookmarks: result.items.map((item) => ({
        bookmark_id: item.bookmarkId,
        blog_id: item.blogId.toString(),
        blog: {
          ...item.blog,
          id: String(item.blog._id),
          _id: undefined,
        },
        created_at: item.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit),
      },
    };
  }
}
