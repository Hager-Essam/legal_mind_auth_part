const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: 'text', // For text search
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      minlength: [20, 'Content must be at least 20 characters'],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    coverImage: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'Criminal Law',
          'Civil Law',
          'Corporate Law',
          'Family Law',
          'Labor Law',
          'Tax Law',
          'Other',
        ],
        message: '{VALUE} is not a valid category',
      },
      index: true,
    },
    tags: {
      type: [String],
      validate: {
        validator: function (tags) {
          return tags.length <= 10;
        },
        message: 'A blog cannot have more than 10 tags',
      },
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'published', 'rejected'],
      default: 'draft',
      index: true,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookmarksCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
blogSchema.index({ title: 'text', content: 'text' }); // Text search
blogSchema.index({ status: 1, createdAt: -1 }); // Filter by status and sort
blogSchema.index({ status: 1, views: -1 }); // Sort by views
blogSchema.index({ author: 1, status: 1 }); // Author's blogs
blogSchema.index({ category: 1, status: 1 }); // Category filter
blogSchema.index({ tags: 1, status: 1 }); // Tags filter

// Virtual for reading time (average reading speed: 200 words/minute)
blogSchema.virtual('readingTime').get(function () {
  if (!this.content) return 0;
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return minutes;
});

// Auto-generate excerpt if not provided
blogSchema.pre('save', function (next) {
  if (!this.excerpt && this.content) {
    // Take first 200 characters of content
    this.excerpt = this.content.substring(0, 200).trim() + '...';
  }
  
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Method to increment views
blogSchema.methods.incrementViews = async function () {
  this.views += 1;
  return await this.save();
};

// Method to check if user is author
blogSchema.methods.isAuthor = function (userId) {
  return this.author.toString() === userId.toString();
};

// Static method to get popular blogs
blogSchema.statics.getPopular = function (limit = 5) {
  return this.find({ status: 'published' })
    .sort({ views: -1 })
    .limit(limit)
    .populate('author', 'fullName email avatar');
};

// Static method to get trending blogs (most views in last 7 days)
blogSchema.statics.getTrending = function (limit = 5) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return this.find({
    status: 'published',
    publishedAt: { $gte: sevenDaysAgo },
  })
    .sort({ views: -1 })
    .limit(limit)
    .populate('author', 'fullName email avatar');
};

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
