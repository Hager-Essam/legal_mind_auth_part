import type { Types } from "mongoose";
import { CommentModel } from "./comment.model";

const authorProjection = "fullName avatarUrl";

export class CommentRepository {
  async create(blog: Types.ObjectId, author: Types.ObjectId, content: string) {
    const comment = await CommentModel.create({ blog, author, content });

    return comment.populate("author", authorProjection);
  }

  async listByBlog(blog: Types.ObjectId, page: number, limit: number) {
    const query = { blog };
    const [comments, total] = await Promise.all([
      CommentModel.find(query)
        .populate("author", authorProjection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommentModel.countDocuments(query),
    ]);

    return { comments, total };
  }

  async findById(id: Types.ObjectId) {
    return CommentModel.findById(id);
  }

  async updateOwned(id: Types.ObjectId, author: Types.ObjectId, content: string) {
    return CommentModel.findOneAndUpdate(
      { _id: id, author },
      { $set: { content } },
      { returnDocument: "after", runValidators: true }
    ).populate("author", authorProjection);
  }

  async deleteById(id: Types.ObjectId): Promise<boolean> {
    return (await CommentModel.deleteOne({ _id: id })).deletedCount === 1;
  }

  async deleteByBlog(blog: Types.ObjectId): Promise<void> {
    await CommentModel.deleteMany({ blog });
  }
}
