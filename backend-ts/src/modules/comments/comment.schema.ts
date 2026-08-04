import { Schema } from "mongoose";
import type { Comment } from "./comment.types";

export const commentSchema = new Schema<Comment>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blog: { type: Schema.Types.ObjectId, ref: "Blog", required: true },
  },
  { collection: "comments", timestamps: true, versionKey: false }
);

commentSchema.index({ blog: 1, createdAt: -1 }, { name: "comments_blog_recent" });
commentSchema.index({ author: 1, createdAt: -1 }, { name: "comments_author_recent" });
