import Blog, { IBlog } from './blog.model';

class BlogRepository {
  async create(blogData: Partial<IBlog>): Promise<IBlog> {
    const blog = new Blog(blogData);
    return await blog.save();
  }

  async findById(id: string, populateAuthor = true): Promise<IBlog | null> {
    let query = Blog.findById(id);
    
    if (populateAuthor) {
      query = query.populate('author', 'fullName email avatar officeName teamSize');
    }
    
    return await query;
  }

  async findAll(filters: any = {}, options: any = {}) {
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
    const query: any = { ...filters };

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

  async findByAuthor(authorId: any, page = 1, limit = 10) {
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

  async update(id: string, updateData: Partial<IBlog>): Promise<IBlog | null> {
    return await Blog.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('author', 'fullName email avatar');
  }

  async delete(id: string): Promise<IBlog | null> {
    return await Blog.findByIdAndDelete(id);
  }

  async incrementViews(id: string): Promise<IBlog | null> {
    return await Blog.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    );
  }

  async incrementBookmarks(id: string, increment = 1): Promise<IBlog | null> {
    return await Blog.findByIdAndUpdate(
      id,
      { $inc: { bookmarksCount: increment } },
      { new: true }
    );
  }

  async incrementLikes(id: string, increment = 1): Promise<IBlog | null> {
    return await Blog.findByIdAndUpdate(
      id,
      { $inc: { likesCount: increment } },
      { new: true }
    );
  }

  async getPopular(limit = 5): Promise<IBlog[]> {
    return await Blog.getPopular(limit);
  }

  async getTrending(limit = 5): Promise<IBlog[]> {
    return await Blog.getTrending(limit);
  }

  async countByStatus(status: string): Promise<number> {
    return await Blog.countDocuments({ status });
  }

  async countByAuthor(authorId: any): Promise<number> {
    return await Blog.countDocuments({ author: authorId });
  }
}

export default new BlogRepository();
