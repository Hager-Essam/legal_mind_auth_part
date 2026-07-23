const express = require('express');
const bookmarkController = require('./bookmark.controller');
const { authenticate } = require('../auth/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bookmarks
 *   description: Blog bookmarks management
 */

// All bookmark routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/users/me/bookmarks:
 *   get:
 *     summary: Get my bookmarks
 *     description: Get all bookmarked blogs for authenticated user with pagination
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Bookmarks retrieved successfully
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
 *                   example: Bookmarks retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookmarks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           user:
 *                             type: string
 *                           blog:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               excerpt:
 *                                 type: string
 *                               category:
 *                                 type: string
 *                               views:
 *                                 type: integer
 *                               author:
 *                                 type: object
 *                           createdAt:
 *                             type: string
 *                             format: date-time
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
 *       401:
 *         description: Unauthorized
 */
router.get('/me/bookmarks', bookmarkController.getUserBookmarks);

/**
 * @swagger
 * /api/blogs/{id}/bookmark:
 *   post:
 *     summary: Toggle bookmark
 *     description: Add or remove a bookmark for a blog (toggle behavior)
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Bookmark toggled successfully
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
 *                   example: Blog bookmarked successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookmarked:
 *                       type: boolean
 *                       description: True if bookmarked, false if removed
 *                     action:
 *                       type: string
 *                       enum: [added, removed]
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Blog not found
 */

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   delete:
 *     summary: Remove bookmark
 *     description: Remove a specific bookmark
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bookmark ID
 *     responses:
 *       200:
 *         description: Bookmark removed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Bookmark not found
 */
router.delete('/:id', bookmarkController.removeBookmark);

module.exports = router;
