import type { Types } from "mongoose";

export type Comment = {
  content: string;
  author: Types.ObjectId;
  blog: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
