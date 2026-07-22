const Bookmark = require('./bookmark.model');
const blogRepository = require('../blog/blog.repository');
const AppError = require('../../shared/errors/app.error');
const HTTP_STATUS = require('../../shared/constants/http-status');

class BookmarkService {
  async toggleBookmark(userId, blogId) {
    // Check if blog exists
    const blog = await blogRepository.findById(blogId, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    // Allow bookmarking any blog (removed published-only restriction for testing)
    // In production, you may want to restrict to: blog.status === 'published'

    // Toggle bookmark
    const result = await Bookmark.toggle(userId, blogId);

    // Update blog bookmarks count
    const increment = result.bookmarked ? 1 : -1;
    await blogRepository.incrementBookmarks(blogId, increment);

    return result;
  }

  async getUserBookmarks(userId, page = 1, limit = 10) {
    const result = await Bookmark.getUserBookmarks(userId, page, limit);
    return result;
  }

  async removeBookmark(userId, blogId) {
    const bookmark = await Bookmark.findOne({ user: userId, blog: blogId });

    if (!bookmark) {
      throw new AppError('Bookmark not found', HTTP_STATUS.NOT_FOUND);
    }

    await bookmark.deleteOne();

    // Decrement blog bookmarks count
    await blogRepository.incrementBookmarks(blogId, -1);

    return true;
  }

  async isBookmarked(userId, blogId) {
    return await Bookmark.isBookmarked(userId, blogId);
  }

  async getBookmarkStats(userId) {
    const total = await Bookmark.countDocuments({ user: userId });
    return { total };
  }
}

module.exports = new BookmarkService();
