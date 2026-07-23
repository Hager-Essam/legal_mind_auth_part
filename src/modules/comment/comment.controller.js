const commentService = require('./comment.service');
const ResponseHelper = require('../../shared/helpers/response.helper');

class CommentController {
  async createComment(req, res, next) {
    try {
      const { content } = req.body;
      const comment = await commentService.createComment(
        req.params.blogId,
        content,
        req.user.id
      );

      return ResponseHelper.created(res, 'Comment created successfully', { comment });
    } catch (error) {
      next(error);
    }
  }

  async getCommentsByBlog(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await commentService.getCommentsByBlog(
        req.params.blogId,
        parseInt(page),
        parseInt(limit)
      );

      return ResponseHelper.ok(res, 'Comments retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updateComment(req, res, next) {
    try {
      const { content } = req.body;
      const comment = await commentService.updateComment(
        req.params.id,
        content,
        req.user.id
      );

      return ResponseHelper.ok(res, 'Comment updated successfully', { comment });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req, res, next) {
    try {
      await commentService.deleteComment(req.params.id, req.user.id, req.user.role);

      return ResponseHelper.ok(res, 'Comment deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommentController();
