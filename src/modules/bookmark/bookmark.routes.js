const express = require('express');
const bookmarkController = require('./bookmark.controller');
const { authenticate } = require('../auth/auth.middleware');

const router = express.Router();

// All bookmark routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/users/me/bookmarks:
 *   get:
 *     summary: Get my bookmarks
 *     description: Get all bookmarked blogs for authenticated user
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookmarks:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
// Get user's bookmarks
router.get('/me/bookmarks', bookmarkController.getUserBookmarks);

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
// Remove bookmark
router.delete('/:id', bookmarkController.removeBookmark);

module.exports = router;
