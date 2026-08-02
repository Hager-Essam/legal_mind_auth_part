import { Schema } from "mongoose";
import { BLOG_CATEGORIES, BLOG_STATUSES, type Blog } from "./blog.types";

export const blogSchema = new Schema<Blog>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 200,
    },
    content: { type: String, required: true, minlength: 20 },
    excerpt: { type: String, trim: true, maxlength: 500 },
    coverImage: { type: String, trim: true },
    category: { type: String, enum: BLOG_CATEGORIES, required: true },
    tags: {
      type: [String],
      default: [],
      validate: (tags: string[]) => tags.length <= 10,
    },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: BLOG_STATUSES, default: "published" },
    views: { type: Number, default: 0, min: 0 },
    bookmarksCount: { type: Number, default: 0, min: 0 },
    likesCount: { type: Number, default: 0, min: 0 },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    publishedAt: Date,
  },
  { collection: "blogs", timestamps: true, versionKey: false }
);

blogSchema.index({ title: "text", content: "text" }, { name: "blogs_text" });
blogSchema.index({ status: 1, createdAt: -1 }, { name: "blogs_status_recent" });
blogSchema.index({ status: 1, views: -1 }, { name: "blogs_status_popular" });
blogSchema.index({ author: 1, createdAt: -1 }, { name: "blogs_author_recent" });
blogSchema.index({ category: 1, status: 1 }, { name: "blogs_category_status" });
blogSchema.index({ tags: 1, status: 1 }, { name: "blogs_tags_status" });

blogSchema.pre("validate", function () {
  if (!this.excerpt && this.content) {
    this.excerpt = `${this.content.slice(0, 200).trim()}${this.content.length > 200 ? "..." : ""}`;
  }

  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();

  if (this.status !== "rejected") this.rejectionReason = undefined;
});
