import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBookmark extends Document {
  user: mongoose.Types.ObjectId;
  blog: mongoose.Types.ObjectId;
}

export interface IBookmarkModel extends Model<IBookmark> {
  toggle(userId: any, blogId: any): Promise<{ bookmarked: boolean; action: 'removed' | 'added' }>;
  isBookmarked(userId: any, blogId: any): Promise<boolean>;
  getUserBookmarks(userId: any, page?: number, limit?: number): Promise<any>;
}

const bookmarkSchema = new Schema<IBookmark, IBookmarkModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blog: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure user can only bookmark a blog once
bookmarkSchema.index({ user: 1, blog: 1 }, { unique: true });

// Index for querying user's bookmarks
bookmarkSchema.index({ user: 1, createdAt: -1 });

// Static method to toggle bookmark
bookmarkSchema.statics.toggle = async function (this: IBookmarkModel, userId: any, blogId: any) {
  const existing = await this.findOne({ user: userId, blog: blogId });
  
  if (existing) {
    await existing.deleteOne();
    return { bookmarked: false, action: 'removed' };
  } else {
    await this.create({ user: userId, blog: blogId });
    return { bookmarked: true, action: 'added' };
  }
};

// Static method to check if user bookmarked a blog
bookmarkSchema.statics.isBookmarked = async function (this: IBookmarkModel, userId: any, blogId: any) {
  const bookmark = await this.findOne({ user: userId, blog: blogId });
  return !!bookmark;
};

// Static method to get user's bookmarks with pagination
bookmarkSchema.statics.getUserBookmarks = async function (this: IBookmarkModel, userId: any, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const bookmarks = await this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'blog',
      select: 'title excerpt coverImage category createdAt views author',
      populate: {
        path: 'author',
        select: 'fullName avatar',
      },
    });
  
  const total = await this.countDocuments({ user: userId });
  
  return {
    bookmarks: bookmarks.filter(b => b.blog), // Filter out deleted blogs
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const Bookmark = mongoose.model<IBookmark, IBookmarkModel>('Bookmark', bookmarkSchema);

export default Bookmark;
