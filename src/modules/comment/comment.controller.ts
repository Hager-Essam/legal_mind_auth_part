import { Request, Response, NextFunction } from 'express';
import commentService from './comment.service';
import ResponseHelper from '../../shared/helpers/response.helper';

class CommentController {
  async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content } = req.body;
      const comment = await commentService.createComment(
        req.params.blogId as string,
        content,
        (req as any).user.id
      );

      ResponseHelper.created(res, 'Comment created successfully', { comment });
    } catch (error) {
      next(error);
    }
  }

  async getCommentsByBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await commentService.getCommentsByBlog(
        req.params.blogId as string,
        parseInt(page as string),
        parseInt(limit as string)
      );

      ResponseHelper.ok(res, 'Comments retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updateComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content } = req.body;
      const comment = await commentService.updateComment(
        req.params.id as string,
        content,
        (req as any).user.id
      );

      ResponseHelper.ok(res, 'Comment updated successfully', { comment });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await commentService.deleteComment(req.params.id as string, (req as any).user.id, (req as any).user.role);

      ResponseHelper.ok(res, 'Comment deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new CommentController();
