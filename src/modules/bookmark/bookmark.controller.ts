import { Request, Response, NextFunction } from 'express';
import bookmarkService from './bookmark.service';
import ResponseHelper from '../../shared/helpers/response.helper';

class BookmarkController {
  async toggleBookmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await bookmarkService.toggleBookmark(
        (req as any).user.id,
        req.params.id as string
      );

      const message = result.bookmarked
        ? 'Blog bookmarked successfully'
        : 'Bookmark removed successfully';

      ResponseHelper.ok(res, message, result);
    } catch (error) {
      next(error);
    }
  }

  async getUserBookmarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await bookmarkService.getUserBookmarks(
        (req as any).user.id,
        parseInt(page as string),
        parseInt(limit as string)
      );

      ResponseHelper.ok(res, 'Bookmarks retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async removeBookmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await bookmarkService.removeBookmark((req as any).user.id, req.params.id as string);

      ResponseHelper.ok(res, 'Bookmark removed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new BookmarkController();
