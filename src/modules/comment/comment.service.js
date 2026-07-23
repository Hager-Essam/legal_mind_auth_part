const commentRepository = require('./comment.repository');
const blogRepository = require('../blog/blog.repository');
const AppError = require('../../shared/errors/app.error');
const HTTP_STATUS = require('../../shared/constants/http-status');

class CommentService {
  async createComment(blogId, content, authorId) {
    const blog = await blogRepository.findById(blogId, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    if (blog.status !== 'published') {
      throw new AppError('Cannot comment on unpublished blog', HTTP_STATUS.BAD_REQUEST);
    }

    const comment = await commentRepository.create({
      content,
      author: authorId,
      blog: blogId,
    });

    return comment;
  }

  async getCommentsByBlog(blogId, page = 1, limit = 20) {
    const blog = await blogRepository.findById(blogId, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    const result = await commentRepository.findByBlog(blogId, page, limit);
    return result;
  }

  async updateComment(commentId, content, userId) {
    const comment = await commentRepository.findById(commentId);

    if (!comment) {
      throw new AppError('Comment not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!comment.isAuthor(userId)) {
      throw new AppError('You are not authorized to update this comment', HTTP_STATUS.FORBIDDEN);
    }

    const updatedComment = await commentRepository.update(commentId, { content });
    return updatedComment;
  }

  async deleteComment(commentId, userId, userRole) {
    const comment = await commentRepository.findById(commentId);

    if (!comment) {
      throw new AppError('Comment not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!comment.isAuthor(userId) && userRole !== 'admin') {
      throw new AppError('You are not authorized to delete this comment', HTTP_STATUS.FORBIDDEN);
    }

    await commentRepository.delete(commentId);
    return true;
  }
}

module.exports = new CommentService();
