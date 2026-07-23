const express = require('express');
const commentController = require('./comment.controller');
const commentValidators = require('./comment.validator');
const { authenticate } = require('../auth/auth.middleware');
const validate = require('../../middlewares/validation.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Blog comments management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Comment ID
 *         content:
 *           type: string
 *           description: Comment content
 *         author:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             fullName:
 *               type: string
 *             avatar:
 *               type: string
 *         blog:
 *           type: string
 *           description: Blog ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CommentInput:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 1000
 *           description: Comment content
 */

/**
 * @swagger
 * /api/blogs/{blogId}/comments:
 *   post:
 *     summary: Create a comment on a blog
 *     description: Create a new comment on a published blog (requires authentication)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Comment created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     comment:
 *                       $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Bad request - Invalid input or blog not published
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Blog not found
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
 *     description: Retrieve all comments for a specific blog (public access)
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of comments per page
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Comments retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comment'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       404:
 *         description: Blog not found
 */
router.get('/blogs/:blogId/comments', commentController.getCommentsByBlog);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update your own comment
 *     description: Update the content of your own comment (requires authentication)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Comment updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     comment:
 *                       $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Not the comment owner
 *       404:
 *         description: Comment not found
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
 *     description: Delete your own comment (requires authentication, admins can delete any comment)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Comment deleted successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Not the comment owner
 *       404:
 *         description: Comment not found
 */
router.delete('/comments/:id', authenticate, commentController.deleteComment);

module.exports = router;
