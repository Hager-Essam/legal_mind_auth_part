const blogRepository = require('./blog.repository');
const AppError = require('../../shared/errors/app.error');
const HTTP_STATUS = require('../../shared/constants/http-status');

class BlogService {
  async createBlog(blogData, authorId) {
    const blog = await blogRepository.create({
      ...blogData,
      author: authorId,
      status: 'published',
    });

    return blog;
  }

  async getAllBlogs(options) {
    const result = await blogRepository.findAll({}, options);
    return result;
  }

  async getBlogById(id, userId = null) {
    const blog = await blogRepository.findById(id);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    // Only increment views for published blogs
    if (blog.status === 'published') {
      await blogRepository.incrementViews(id);
      blog.views += 1;
    }

    // Check if user has bookmarked this blog
    if (userId) {
      const Bookmark = require('../bookmark/bookmark.model');
      blog.isBookmarked = await Bookmark.isBookmarked(userId, id);
    }

    return blog;
  }

  async updateBlog(id, updateData, userId, userRole) {
    const blog = await blogRepository.findById(id, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    // Check authorization
    if (!blog.isAuthor(userId) && userRole !== 'admin') {
      throw new AppError(
        'You are not authorized to update this blog',
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Regular users cannot change status to published (only admin can)
    if (updateData.status === 'published' && userRole !== 'admin') {
      delete updateData.status;
    }

    const updatedBlog = await blogRepository.update(id, updateData);
    return updatedBlog;
  }

  async deleteBlog(id, userId, userRole) {
    const blog = await blogRepository.findById(id, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!blog.isAuthor(userId) && userRole !== 'admin') {
      throw new AppError(
        'You are not authorized to delete this blog',
        HTTP_STATUS.FORBIDDEN
      );
    }

    const Bookmark = require('../bookmark/bookmark.model');
    await Bookmark.deleteMany({ blog: id });

    const commentRepository = require('../comment/comment.repository');
    await commentRepository.deleteByBlog(id);

    await blogRepository.delete(id);
    return true;
  }

  async getMyBlogs(userId, page = 1, limit = 10) {
    const result = await blogRepository.findByAuthor(userId, page, limit);
    return result;
  }

  async updateBlogStatus(id, status, rejectionReason = null) {
    const blog = await blogRepository.findById(id, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    const updateData = { status };
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const updatedBlog = await blogRepository.update(id, updateData);
    return updatedBlog;
  }

  async getPopularBlogs(limit = 5) {
    const blogs = await blogRepository.getPopular(limit);
    return blogs;
  }

  async getTrendingBlogs(limit = 5) {
    const blogs = await blogRepository.getTrending(limit);
    return blogs;
  }

  async getBlogStats(userId = null) {
    const stats = {
      total: await blogRepository.countByStatus('published'),
      draft: userId ? await blogRepository.findByAuthor(userId).then(r => r.blogs.filter(b => b.status === 'draft').length) : 0,
      pending: await blogRepository.countByStatus('pending'),
      published: await blogRepository.countByStatus('published'),
      rejected: await blogRepository.countByStatus('rejected'),
    };

    if (userId) {
      stats.myBlogs = await blogRepository.countByAuthor(userId);
    }

    return stats;
  }
}

module.exports = new BlogService();
