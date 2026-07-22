const bookmarkService = require('./bookmark.service');
const ResponseHelper = require('../../shared/helpers/response.helper');

class BookmarkController {
  async toggleBookmark(req, res, next) {
    try {
      const result = await bookmarkService.toggleBookmark(
        req.user.id,
        req.params.id
      );

      const message = result.bookmarked
        ? 'Blog bookmarked successfully'
        : 'Bookmark removed successfully';

      return ResponseHelper.ok(res, message, result);
    } catch (error) {
      next(error);
    }
  }

  async getUserBookmarks(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const result = await bookmarkService.getUserBookmarks(
        req.user.id,
        parseInt(page),
        parseInt(limit)
      );

      return ResponseHelper.ok(res, 'Bookmarks retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async removeBookmark(req, res, next) {
    try {
      await bookmarkService.removeBookmark(req.user.id, req.params.id);

      return ResponseHelper.ok(res, 'Bookmark removed successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookmarkController();
