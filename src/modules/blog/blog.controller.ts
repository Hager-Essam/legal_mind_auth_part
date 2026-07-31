import { Request, Response, NextFunction } from 'express';
import blogService from './blog.service';
import ResponseHelper from '../../shared/helpers/response.helper';

const BLOG_CATEGORIES = [
  { value: 'Criminal Law', label: 'القانون الجنائي' },
  { value: 'Civil Law', label: 'القانون المدني' },
  { value: 'Corporate Law', label: 'القانون التجاري' },
  { value: 'Family Law', label: 'قانون الأسرة' },
  { value: 'Labor Law', label: 'قانون العمل' },
  { value: 'Tax Law', label: 'القانون الضريبي' },
  { value: 'Other', label: 'أخرى' },
];

class BlogController {
  async createBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await blogService.createBlog(req.body, (req as any).user.id);

      ResponseHelper.created(res, 'تم إنشاء المقال بنجاح', {
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

      ResponseHelper.ok(res, 'تم جلب المقالات بنجاح', result);
    } catch (error) {
      next(error);
    }
  }

  async getBlogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id || null;
      const blog = await blogService.getBlogById(req.params.id as string, userId);

      ResponseHelper.ok(res, 'تم جلب المقال بنجاح', { blog });
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

      ResponseHelper.ok(res, 'تم تحديث المقال بنجاح', { blog });
    } catch (error) {
      next(error);
    }
  }

  async deleteBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await blogService.deleteBlog(req.params.id as string, (req as any).user.id, (req as any).user.role);

      ResponseHelper.ok(res, 'تم حذف المقال بنجاح');
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

      ResponseHelper.ok(res, 'تم جلب مقالاتك بنجاح', result);
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

      ResponseHelper.ok(res, 'تم تحديث حالة المقال بنجاح', { blog });
    } catch (error) {
      next(error);
    }
  }

  async getPopularBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 5 } = req.query;
      const blogs = await blogService.getPopularBlogs(parseInt(limit as string));

      ResponseHelper.ok(res, 'تم جلب المقالات الأكثر شهرة بنجاح', {
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

      ResponseHelper.ok(res, 'تم جلب المقالات الرائجة بنجاح', {
        blogs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.ok(res, 'تم جلب التصنيفات بنجاح', { categories: BLOG_CATEGORIES });
    } catch (error) {
      next(error);
    }
  }
}

export default new BlogController();
