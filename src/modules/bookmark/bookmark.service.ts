import Bookmark from './bookmark.model';
import blogRepository from '../blog/blog.repository';
import AppError from '../../shared/errors/app.error';
import HTTP_STATUS from '../../shared/constants/http-status';

class BookmarkService {
  async toggleBookmark(userId: any, blogId: string) {
    // Check if blog exists
    const blog = await blogRepository.findById(blogId, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    // Toggle bookmark
    const result = await Bookmark.toggle(userId, blogId);

    // Update blog bookmarks count
    const increment = result.bookmarked ? 1 : -1;
    await blogRepository.incrementBookmarks(blogId, increment);

    return result;
  }

  async getUserBookmarks(userId: any, page = 1, limit = 10) {
    const result = await Bookmark.getUserBookmarks(userId, page, limit);
    return result;
  }

  async removeBookmark(userId: any, blogId: string) {
    const bookmark = await Bookmark.findOne({ user: userId, blog: blogId });

    if (!bookmark) {
      throw new AppError('Bookmark not found', HTTP_STATUS.NOT_FOUND);
    }

    await bookmark.deleteOne();

    // Decrement blog bookmarks count
    await blogRepository.incrementBookmarks(blogId, -1);

    return true;
  }

  async isBookmarked(userId: any, blogId: string) {
    return await Bookmark.isBookmarked(userId, blogId);
  }

  async getBookmarkStats(userId: any) {
    const total = await Bookmark.countDocuments({ user: userId });
    return { total };
  }
}

export default new BookmarkService();
