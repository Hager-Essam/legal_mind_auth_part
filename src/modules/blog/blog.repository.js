const Blog = require('./blog.model');

class BlogRepository {
  async create(blogData) {
    const blog = new Blog(blogData);
    return await blog.save();
  }

  async findById(id, populateAuthor = true) {
    let query = Blog.findById(id);
    
    if (populateAuthor) {
      query = query.populate('author', 'fullName email avatar officeName teamSize');
    }
    
    return await query;
  }

  async findAll(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      search,
      category,
      tags,
      status = 'published',
    } = options;

    const skip = (page - 1) * limit;

    // Build query
    const query = { ...filters };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Search by title or content
    if (search) {
      query.$text = { $search: search };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Tags filter
    if (tags) {
      query.tags = Array.isArray(tags) ? { $in: tags } : tags;
    }

    // Execute query
    const blogs = await Blog.find(query)
      .populate('author', 'fullName email avatar officeName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Blog.countDocuments(query);

    return {
      blogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findByAuthor(authorId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const blogs = await Blog.find({ author: authorId })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Blog.countDocuments({ author: authorId });

    return {
      blogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async update(id, updateData) {
    return await Blog.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('author', 'fullName email avatar');
  }

  async delete(id) {
    return await Blog.findByIdAndDelete(id);
  }

  async incrementViews(id) {
    return await Blog.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    );
  }

  async incrementBookmarks(id, increment = 1) {
    return await Blog.findByIdAndUpdate(
      id,
      { $inc: { bookmarksCount: increment } },
      { new: true }
    );
  }

  async incrementLikes(id, increment = 1) {
    return await Blog.findByIdAndUpdate(
      id,
      { $inc: { likesCount: increment } },
      { new: true }
    );
  }

  async getPopular(limit = 5) {
    return await Blog.getPopular(limit);
  }

  async getTrending(limit = 5) {
    return await Blog.getTrending(limit);
  }

  async countByStatus(status) {
    return await Blog.countDocuments({ status });
  }

  async countByAuthor(authorId) {
    return await Blog.countDocuments({ author: authorId });
  }
}

module.exports = new BlogRepository();
