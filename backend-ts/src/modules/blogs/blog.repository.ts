import type { Types } from "mongoose";
import { BlogModel } from "./blog.model";
import type { Blog, BlogStatus, BlogWriteInput } from "./blog.types";

const authorProjection = "fullName email avatarUrl officeName teamSize";

export type BlogListOptions = {
  page: number;
  limit: number;
  sort: "newest" | "popular";
  search?: string;
  category?: Blog["category"];
  tags?: string[];
};

export class BlogRepository {
  async create(input: BlogWriteInput & { author: Types.ObjectId }) {
    const blog = await BlogModel.create({
      ...input,
      tags: input.tags ?? [],
      status: input.status ?? "published",
    });

    return blog.populate("author", authorProjection);
  }

  async listPublished(options: BlogListOptions) {
    const query: Record<string, unknown> = { status: "published" };

    if (options.search) query.$text = { $search: options.search };

    if (options.category) query.category = options.category;

    if (options.tags?.length) query.tags = { $in: options.tags };
    const sort: Array<[string, 1 | -1]> =
      options.sort === "popular"
        ? [
            ["views", -1],
            ["createdAt", -1],
          ]
        : [["createdAt", -1]];
    const skip = (options.page - 1) * options.limit;
    const [blogs, total] = await Promise.all([
      BlogModel.find(query)
        .populate("author", authorProjection)
        .sort(sort)
        .skip(skip)
        .limit(options.limit)
        .lean(),
      BlogModel.countDocuments(query),
    ]);

    return { blogs, total };
  }

  async listByAuthor(author: Types.ObjectId, page: number, limit: number) {
    const query = { author };
    const [blogs, total] = await Promise.all([
      BlogModel.find(query)
        .populate("author", authorProjection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlogModel.countDocuments(query),
    ]);

    return { blogs, total };
  }

  async findVisibleById(id: Types.ObjectId, viewerId?: Types.ObjectId) {
    const visibility: Record<string, unknown> = viewerId
      ? { _id: id, $or: [{ status: "published" }, { author: viewerId }] }
      : { _id: id, status: "published" };

    return BlogModel.findOne(visibility).populate("author", authorProjection);
  }

  async findById(id: Types.ObjectId) {
    return BlogModel.findById(id);
  }

  async updateOwned(id: Types.ObjectId, author: Types.ObjectId, input: Partial<BlogWriteInput>) {
    const update: Record<string, unknown> = { ...input };

    if (input.status === "published") update.publishedAt = new Date();

    if (input.status && input.status !== "rejected") update.rejectionReason = null;

    return BlogModel.findOneAndUpdate(
      { _id: id, author },
      { $set: update },
      { returnDocument: "after", runValidators: true }
    ).populate("author", authorProjection);
  }

  async updateStatus(id: Types.ObjectId, status: BlogStatus, rejectionReason?: string) {
    const update: Record<string, unknown> = {
      status,
      rejectionReason: status === "rejected" ? rejectionReason : null,
    };

    if (status === "published") update.publishedAt = new Date();

    return BlogModel.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: "after", runValidators: true }
    ).populate("author", authorProjection);
  }

  async deleteById(id: Types.ObjectId): Promise<boolean> {
    return (await BlogModel.deleteOne({ _id: id })).deletedCount === 1;
  }

  async incrementViews(id: Types.ObjectId): Promise<void> {
    await BlogModel.updateOne({ _id: id, status: "published" }, { $inc: { views: 1 } });
  }

  async popular(limit: number) {
    return BlogModel.find({ status: "published" })
      .populate("author", authorProjection)
      .sort({ views: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async trending(limit: number) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return BlogModel.find({ status: "published", publishedAt: { $gte: since } })
      .populate("author", authorProjection)
      .sort({ views: -1, publishedAt: -1 })
      .limit(limit)
      .lean();
  }
}
