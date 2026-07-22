const express = require('express');
const blogController = require('./blog.controller');
const bookmarkController = require('../bookmark/bookmark.controller');
const validate = require('../../middlewares/validation.middleware');
const { authenticate, optionalAuth } = require('../auth/auth.middleware');
const { isAdmin } = require('../../middlewares/authorization.middleware');
const {
  createBlogSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
} = require('./blog.validator');

const router = express.Router();

/**
 * @swagger
 * /api/blogs:
 *   get:
 *     summary: Get all published blogs
 *     description: Retrieve all published blogs with pagination, search, and filtering
 *     tags: [Blogs]
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
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and content
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Criminal Law, Civil Law, Corporate Law, Family Law, Labor Law, Tax Law, Other]
 *         description: Filter by category
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, popular]
 *           default: newest
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of blogs retrieved successfully
 */
// Public routes (no authentication required)
router.get('/', blogController.getAllBlogs);

/**
 * @swagger
 * /api/blogs/popular:
 *   get:
 *     summary: Get popular blogs
 *     description: Get most viewed blogs
 *     tags: [Blogs]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of blogs to return
 *     responses:
 *       200:
 *         description: Popular blogs retrieved successfully
 */
router.get('/popular', blogController.getPopularBlogs);

/**
 * @swagger
 * /api/blogs/trending:
 *   get:
 *     summary: Get trending blogs
 *     description: Get trending blogs from last 7 days
 *     tags: [Blogs]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of blogs to return
 *     responses:
 *       200:
 *         description: Trending blogs retrieved successfully
 */
router.get('/trending', blogController.getTrendingBlogs);

/**
 * @swagger
 * /api/blogs/{id}:
 *   get:
 *     summary: Get blog by ID
 *     description: Get single blog details and increment view count
 *     tags: [Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blog retrieved successfully
 *       404:
 *         description: Blog not found
 */
router.get('/:id', optionalAuth, blogController.getBlogById);

/**
 * @swagger
 * /api/blogs:
 *   post:
 *     summary: Create new blog
 *     description: Create a new blog post (authentication required)
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *                 example: "Understanding Egyptian Criminal Law"
 *               content:
 *                 type: string
 *                 minLength: 20
 *                 example: "Criminal law in Egypt is primarily governed by..."
 *               excerpt:
 *                 type: string
 *                 maxLength: 500
 *                 example: "A comprehensive guide to criminal law"
 *               category:
 *                 type: string
 *                 enum: [Criminal Law, Civil Law, Corporate Law, Family Law, Labor Law, Tax Law, Other]
 *                 example: "Criminal Law"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 example: ["criminal", "egypt", "law"]
 *               coverImage:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/image.jpg"
 *               status:
 *                 type: string
 *                 enum: [draft, pending, published]
 *                 default: draft
 *     responses:
 *       201:
 *         description: Blog created successfully
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
// Protected routes (authentication required)
router.post('/', authenticate, validate(createBlogSchema), blogController.createBlog);

/**
 * @swagger
 * /api/blogs/me/my-blogs:
 *   get:
 *     summary: Get my blogs
 *     description: Get all blogs created by authenticated user
 *     tags: [Blogs]
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
 *         description: User's blogs retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me/my-blogs', authenticate, blogController.getMyBlogs);

/**
 * @swagger
 * /api/blogs/{id}:
 *   put:
 *     summary: Update blog
 *     description: Update blog (author only)
 *     tags: [Blogs]
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
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               coverImage:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Blog updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the author
 *       404:
 *         description: Blog not found
 */
router.put('/:id', authenticate, validate(updateBlogSchema), blogController.updateBlog);

/**
 * @swagger
 * /api/blogs/{id}:
 *   delete:
 *     summary: Delete blog
 *     description: Delete blog (author or admin only)
 *     tags: [Blogs]
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
 *         description: Blog deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Blog not found
 */
router.delete('/:id', authenticate, blogController.deleteBlog);

/**
 * @swagger
 * /api/blogs/{id}/bookmark:
 *   post:
 *     summary: Toggle bookmark
 *     description: Add or remove blog bookmark (toggle)
 *     tags: [Blogs]
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
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookmarked:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Blog not found
 */
// Bookmark routes
router.post('/:id/bookmark', authenticate, bookmarkController.toggleBookmark);

/**
 * @swagger
 * /api/blogs/{id}/status:
 *   patch:
 *     summary: Update blog status (Admin only)
 *     description: Update blog status (draft, pending, published, rejected)
 *     tags: [Blogs]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, pending, published, rejected]
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Blog status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Blog not found
 */
// Admin only routes
router.patch(
  '/:id/status',
  authenticate,
  isAdmin,
  validate(updateBlogStatusSchema),
  blogController.updateBlogStatus
);

module.exports = router;
