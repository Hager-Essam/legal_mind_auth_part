import type { Types } from "mongoose";

export const BLOG_CATEGORIES = [
  "Criminal Law",
  "Civil Law",
  "Corporate Law",
  "Family Law",
  "Labor Law",
  "Tax Law",
  "Other",
] as const;

export const BLOG_STATUSES = ["draft", "pending", "published", "rejected"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export type Blog = {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  category: BlogCategory;
  tags: string[];
  author: Types.ObjectId;
  status: BlogStatus;
  views: number;
  bookmarksCount: number;
  likesCount: number;
  rejectionReason?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type BlogWriteInput = Pick<Blog, "title" | "content" | "category"> &
  Partial<Pick<Blog, "excerpt" | "coverImage" | "tags" | "status">>;
