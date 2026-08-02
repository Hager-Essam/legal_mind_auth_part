import { Schema, type Types } from "mongoose";

export type Bookmark = {
  bookmarkId: string;
  ownerUserId: string;
  blogId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const bookmarkSchema = new Schema<Bookmark>(
  {
    bookmarkId: { type: String, required: true, immutable: true },
    ownerUserId: { type: String, required: true, immutable: true },
    blogId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  },
  {
    collection: "bookmarks",
    timestamps: true,
    versionKey: false,
  }
);

bookmarkSchema.index({ bookmarkId: 1 }, { unique: true, name: "bookmarks_id_unique" });
bookmarkSchema.index({ ownerUserId: 1, blogId: 1 }, { unique: true, name: "bookmarks_owner_blog_unique" });
bookmarkSchema.index({ ownerUserId: 1, createdAt: -1 }, { name: "bookmarks_owner_recent" });
