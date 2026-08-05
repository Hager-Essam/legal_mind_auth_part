import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
  askQuestion,
  createConversation,
  getAllConversations,
  getConversationById,
  renameConversation,
  deleteConversation,
  healthCheck,
} from "./conversation.controller";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/conversation/ask:
 *   post:
 *     summary: إرسال سؤال قانوني والحصول على إجابة
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 2000
 *                 example: "ما هي أحكام فسخ عقد العمل؟"
 *               top_k:
 *                 type: integer
 *                 default: 5
 *               law_category:
 *                 type: string
 *               user_role:
 *                 type: string
 *                 enum: [lawyer, citizen]
 *               conversationId:
 *                 type: string
 *                 description: معرّف المحادثة لحفظ الأسئلة والإجابات
 *     responses:
 *       200:
 *         description: تمت المعالجة بنجاح
 *       400:
 *         description: بيانات غير صحيحة
 */
router.post("/ask", askQuestion);

/**
 * @swagger
 * /api/conversation:
 *   post:
 *     summary: إنشاء محادثة جديدة
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "سؤال عن قانون العمل"
 *     responses:
 *       201:
 *         description: تم الإنشاء بنجاح
 */
router.post("/", createConversation);

/**
 * @swagger
 * /api/conversation:
 *   get:
 *     summary: جلب جميع المحادثات
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم الجلب بنجاح
 */
router.get("/", getAllConversations);

/**
 * @swagger
 * /api/conversation/health:
 *   get:
 *     summary: فحص صحة الخدمة
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الخدمة تعمل
 */
router.get("/health", healthCheck);

/**
 * @swagger
 * /api/conversation/{conversationId}:
 *   get:
 *     summary: جلب محادثة محددة مع رسائلها
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الجلب بنجاح
 *       404:
 *         description: المحادثة غير موجودة
 */
router.get("/:conversationId", getConversationById);

/**
 * @swagger
 * /api/conversation/{conversationId}:
 *   patch:
 *     summary: إعادة تسمية المحادثة
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: تم الإعادة التسمية بنجاح
 *       404:
 *         description: المحادثة غير موجودة
 */
router.patch("/:conversationId", renameConversation);

/**
 * @swagger
 * /api/conversation/{conversationId}:
 *   delete:
 *     summary: حذف المحادثة
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف بنجاح
 *       404:
 *         description: المحادثة غير موجودة
 */
router.delete("/:conversationId", deleteConversation);

export default router;
