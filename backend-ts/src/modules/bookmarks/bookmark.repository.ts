import crypto from "node:crypto";
import { Types } from "mongoose";
import { BlogReferenceModel, BookmarkModel } from "./bookmark.model";

type BookmarkListRow = {
  bookmarkId: string;
  blogId: Types.ObjectId;
  createdAt: Date;
  blog: Record<string, unknown>;
};

const updateBookmarkCount = async (blogId: Types.ObjectId, delta: 1 | -1) => {
  await BlogReferenceModel.updateOne(
    { _id: blogId },
    [
      {
        $set: {
          bookmarksCount: {
            $max: [0, { $add: [{ $ifNull: ["$bookmarksCount", 0] }, delta] }],
          },
        },
      },
    ],
    { updatePipeline: true }
  );
};

export class BookmarkRepository {
  async isBookmarked(ownerUserId: string, blogId: Types.ObjectId): Promise<boolean> {
    return (await BookmarkModel.exists({ ownerUserId, blogId })) !== null;
  }

  async publishedBlogExists(blogId: Types.ObjectId): Promise<boolean> {
    return (
      (await BlogReferenceModel.exists({
        _id: blogId,
        status: "published",
      })) !== null
    );
  }

  async toggle(ownerUserId: string, blogId: Types.ObjectId) {
    const removed = await BookmarkModel.findOneAndDelete({
      ownerUserId,
      blogId,
    });

    if (removed) {
      await updateBookmarkCount(blogId, -1);

      return { bookmarked: false as const, action: "removed" as const };
    }

    try {
      await BookmarkModel.create({
        bookmarkId: crypto.randomUUID(),
        ownerUserId,
        blogId,
      });
      await updateBookmarkCount(blogId, 1);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return { bookmarked: true as const, action: "added" as const };
      }

      throw error;
    }

    return { bookmarked: true as const, action: "added" as const };
  }

  async removeOwned(ownerUserId: string, bookmarkId: string): Promise<boolean> {
    const removed = await BookmarkModel.findOneAndDelete({
      ownerUserId,
      bookmarkId,
    });

    if (!removed) return false;
    await updateBookmarkCount(removed.blogId, -1);

    return true;
  }

  async removeByBlog(blogId: Types.ObjectId): Promise<void> {
    await BookmarkModel.deleteMany({ blogId });
  }

  async list(ownerUserId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [result] = await BookmarkModel.aggregate<{
      items: BookmarkListRow[];
      totals: Array<{ value: number }>;
    }>([
      { $match: { ownerUserId } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "blogs",
          localField: "blogId",
          foreignField: "_id",
          as: "blog",
        },
      },
      { $unwind: "$blog" },
      { $match: { "blog.status": "published" } },
      {
        $project: {
          _id: 0,
          bookmarkId: 1,
          blogId: 1,
          createdAt: 1,
          blog: {
            _id: "$blog._id",
            title: "$blog.title",
            excerpt: "$blog.excerpt",
            coverImage: "$blog.coverImage",
            category: "$blog.category",
            tags: "$blog.tags",
            author: "$blog.author",
            views: "$blog.views",
            bookmarksCount: "$blog.bookmarksCount",
            likesCount: "$blog.likesCount",
            readingTime: "$blog.readingTime",
            publishedAt: "$blog.publishedAt",
            createdAt: "$blog.createdAt",
            updatedAt: "$blog.updatedAt",
          },
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          totals: [{ $count: "value" }],
        },
      },
    ]);

    return {
      items: result?.items ?? [],
      total: result?.totals[0]?.value ?? 0,
    };
  }
}
