import express from 'express';
import bookmarkController from './bookmark.controller';
import { authenticate } from '../auth/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bookmarks
 *   description: Blog bookmarks management
 */

router.use(authenticate);

/**
 * @swagger
 * /api/users/me/bookmarks:
 *   get:
 *     summary: Get my bookmarks
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Bookmarks retrieved successfully
 */
router.get('/me/bookmarks', bookmarkController.getUserBookmarks);

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   delete:
 *     summary: Remove bookmark
 *     tags: [Bookmarks]
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
 *         description: Bookmark removed successfully
 */
router.delete('/:id', bookmarkController.removeBookmark);

export default router;
