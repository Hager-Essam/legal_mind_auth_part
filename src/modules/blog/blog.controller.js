const blogService = require('./blog.service');
const ResponseHelper = require('../../shared/helpers/response.helper');

class BlogController {
  async createBlog(req, res, next) {
    try {
      const blog = await blogService.createBlog(req.body, req.user.id);

      return ResponseHelper.created(res, 'Blog created successfully', {
        blog,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllBlogs(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = '-createdAt',
        search,
        category,
        tags,
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        search,
        category,
        tags: tags ? tags.split(',') : undefined,
        status: 'published',
      };

      const result = await blogService.getAllBlogs(options);

      return ResponseHelper.ok(res, 'Blogs retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getBlogById(req, res, next) {
    try {
      const userId = req.user?.id || null;
      const blog = await blogService.getBlogById(req.params.id, userId);

      return ResponseHelper.ok(res, 'Blog retrieved successfully', { blog });
    } catch (error) {
      next(error);
    }
  }

  async updateBlog(req, res, next) {
    try {
      const blog = await blogService.updateBlog(
        req.params.id,
        req.body,
        req.user.id,
        req.user.role
      );

      return ResponseHelper.ok(res, 'Blog updated successfully', { blog });
    } catch (error) {
      next(error);
    }
  }

  async deleteBlog(req, res, next) {
    try {
      await blogService.deleteBlog(req.params.id, req.user.id, req.user.role);

      return ResponseHelper.ok(res, 'Blog deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyBlogs(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await blogService.getMyBlogs(
        req.user.id,
        parseInt(page),
        parseInt(limit)
      );

      return ResponseHelper.ok(res, 'Your blogs retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updateBlogStatus(req, res, next) {
    try {
      const { status, rejectionReason } = req.body;

      const blog = await blogService.updateBlogStatus(
        req.params.id,
        status,
        rejectionReason
      );

      return ResponseHelper.ok(res, 'Blog status updated successfully', { blog });
    } catch (error) {
      next(error);
    }
  }

  async getPopularBlogs(req, res, next) {
    try {
      const { limit = 5 } = req.query;
      const blogs = await blogService.getPopularBlogs(parseInt(limit));

      return ResponseHelper.ok(res, 'Popular blogs retrieved successfully', {
        blogs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrendingBlogs(req, res, next) {
    try {
      const { limit = 5 } = req.query;
      const blogs = await blogService.getTrendingBlogs(parseInt(limit));

      return ResponseHelper.ok(res, 'Trending blogs retrieved successfully', {
        blogs,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BlogController();
