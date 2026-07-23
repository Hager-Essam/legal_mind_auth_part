import express from 'express';
import commentController from './comment.controller';
import commentValidators from './comment.validator';
import { authenticate } from '../auth/auth.middleware';
import validate from '../../middlewares/validation.middleware';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Blog comments management
 */

/**
 * @swagger
 * /api/blogs/{blogId}/comments:
 *   post:
 *     summary: Create a comment on a blog
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment created successfully
 */
router.post(
  '/blogs/:blogId/comments',
  authenticate,
  validate(commentValidators.createComment),
  commentController.createComment
);

/**
 * @swagger
 * /api/blogs/{blogId}/comments:
 *   get:
 *     summary: Get all comments for a blog
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 */
router.get('/blogs/:blogId/comments', commentController.getCommentsByBlog);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update your own comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated successfully
 */
router.put(
  '/comments/:id',
  authenticate,
  validate(commentValidators.updateComment),
  commentController.updateComment
);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete your own comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 */
router.delete('/comments/:id', authenticate, commentController.deleteComment);

export default router;
