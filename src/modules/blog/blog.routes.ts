import express from 'express';
import blogController from './blog.controller';
import bookmarkController from '../bookmark/bookmark.controller';
import validate from '../../middlewares/validation.middleware';
import { authenticate, optionalAuth } from '../auth/auth.middleware';
import { isAdmin } from '../../middlewares/authorization.middleware';
import {
  createBlogSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
} from './blog.validator';

const router = express.Router();

/**
 * @swagger
 * /api/blogs:
 *   get:
 *     summary: Get all published blogs
 *     tags: [Blogs]
 *     responses:
 *       200:
 *         description: List of blogs
 */
router.get('/', blogController.getAllBlogs);
router.get('/popular', blogController.getPopularBlogs);
router.get('/trending', blogController.getTrendingBlogs);
router.get('/:id', optionalAuth, blogController.getBlogById);
router.post('/', authenticate, validate(createBlogSchema), blogController.createBlog);
router.get('/me/my-blogs', authenticate, blogController.getMyBlogs);
router.put('/:id', authenticate, validate(updateBlogSchema), blogController.updateBlog);
router.delete('/:id', authenticate, blogController.deleteBlog);
router.post('/:id/bookmark', authenticate, bookmarkController.toggleBookmark);
router.patch('/:id/status', authenticate, isAdmin, validate(updateBlogStatusSchema), blogController.updateBlogStatus);

export default router;
