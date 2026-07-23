import mongoose from 'mongoose';
import commentRepository from './comment.repository';
import blogRepository from '../blog/blog.repository';
import AppError from '../../shared/errors/app.error';
import HTTP_STATUS from '../../shared/constants/http-status';

class CommentService {
  async createComment(blogId: string, content: string, authorId: string) {
    const blog = await blogRepository.findById(blogId, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    if (blog.status !== 'published') {
      throw new AppError('Cannot comment on unpublished blog', HTTP_STATUS.BAD_REQUEST);
    }

    const comment = await commentRepository.create({
      content,
      author: new mongoose.Types.ObjectId(authorId),
      blog: new mongoose.Types.ObjectId(blogId),
    });

    return comment;
  }

  async getCommentsByBlog(blogId: string, page: number = 1, limit: number = 20) {
    const blog = await blogRepository.findById(blogId, false);

    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    }

    const result = await commentRepository.findByBlog(blogId, page, limit);
    return result;
  }

  async updateComment(commentId: string, content: string, userId: string) {
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

  async deleteComment(commentId: string, userId: string, userRole: string) {
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

export default new CommentService();
