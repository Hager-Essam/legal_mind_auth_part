import blogRepository from './blog.repository';
import AppError from '../../shared/errors/app.error';
import HTTP_STATUS from '../../shared/constants/http-status';
import Bookmark from '../bookmark/bookmark.model';
import commentRepository from '../comment/comment.repository';

class BlogService {
  async createBlog(blogData: any, authorId: any) {
    const blog = await blogRepository.create({
      ...blogData,
      author: authorId,
      status: 'published',
    });

    return blog;
  }

  async getAllBlogs(options: any) {
    const result = await blogRepository.findAll({}, options);
    return result;
  }

  async getBlogById(id: string, userId: any = null) {
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
      (blog as any).isBookmarked = await Bookmark.isBookmarked(userId, id);
    }

    return blog;
  }

  async updateBlog(id: string, updateData: any, userId: any, userRole: string) {
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

  async deleteBlog(id: string, userId: any, userRole: string) {
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

    await Bookmark.deleteMany({ blog: id });
    await commentRepository.deleteByBlog(id);

    await blogRepository.delete(id);
    return true;
  }

  async getMyBlogs(userId: any, page = 1, limit = 10) {
    const result = await blogRepository.findByAuthor(userId, page, limit);
    return result;
  }

  async updateBlogStatus(id: string, status: string, rejectionReason: string | null = null) {
    const blog = await blogRepository.findById(id, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    const updateData: any = { status };
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

  async getBlogStats(userId: any = null) {
    const stats: any = {
      total: await blogRepository.countByStatus('published'),
      draft: userId ? await blogRepository.findByAuthor(userId).then(r => r.blogs.filter((b: any) => b.status === 'draft').length) : 0,
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

export default new BlogService();
