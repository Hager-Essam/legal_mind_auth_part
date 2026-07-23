import { Request, Response, NextFunction } from 'express';
import blogService from './blog.service';
import ResponseHelper from '../../shared/helpers/response.helper';

class BlogController {
  async createBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await blogService.createBlog(req.body, (req as any).user.id);

      ResponseHelper.created(res, 'Blog created successfully', {
        blog,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
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
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sort: sort as string,
        search: search as string,
        category: category as string,
        tags: tags ? (tags as string).split(',') : undefined,
        status: 'published',
      };

      const result = await blogService.getAllBlogs(options);

      ResponseHelper.ok(res, 'Blogs retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getBlogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || null;
      const blog = await blogService.getBlogById(req.params.id as string, userId);

      ResponseHelper.ok(res, 'Blog retrieved successfully', { blog });
    } catch (error) {
      next(error);
    }
  }

  async updateBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await blogService.updateBlog(
        req.params.id as string,
        req.body,
        (req as any).user.id,
        (req as any).user.role
      );

      ResponseHelper.ok(res, 'Blog updated successfully', { blog });
    } catch (error) {
      next(error);
    }
  }

  async deleteBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await blogService.deleteBlog(req.params.id as string, (req as any).user.id, (req as any).user.role);

      ResponseHelper.ok(res, 'Blog deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await blogService.getMyBlogs(
        (req as any).user.id,
        parseInt(page as string),
        parseInt(limit as string)
      );

      ResponseHelper.ok(res, 'Your blogs retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updateBlogStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, rejectionReason } = req.body;

      const blog = await blogService.updateBlogStatus(
        req.params.id as string,
        status,
        rejectionReason
      );

      ResponseHelper.ok(res, 'Blog status updated successfully', { blog });
    } catch (error) {
      next(error);
    }
  }

  async getPopularBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 5 } = req.query;
      const blogs = await blogService.getPopularBlogs(parseInt(limit as string));

      ResponseHelper.ok(res, 'Popular blogs retrieved successfully', {
        blogs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrendingBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 5 } = req.query;
      const blogs = await blogService.getTrendingBlogs(parseInt(limit as string));

      ResponseHelper.ok(res, 'Trending blogs retrieved successfully', {
        blogs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new BlogController();
