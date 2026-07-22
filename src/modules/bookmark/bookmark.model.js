const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blog: {
      type: mongoose.Schema.Types.ObjectId,
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
bookmarkSchema.statics.toggle = async function (userId, blogId) {
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
bookmarkSchema.statics.isBookmarked = async function (userId, blogId) {
  const bookmark = await this.findOne({ user: userId, blog: blogId });
  return !!bookmark;
};

// Static method to get user's bookmarks with pagination
bookmarkSchema.statics.getUserBookmarks = async function (userId, page = 1, limit = 10) {
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

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

module.exports = Bookmark;
