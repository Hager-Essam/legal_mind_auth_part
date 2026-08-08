import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import * as generateController from './contract-generation.controller';
import type { AppServices } from '../../services/service-container';

/**
 * @swagger
 * tags:
 *   name: توليد العقود
 *   description: نقاط نهاية توليد العقود
 */

/**
 * @swagger
 * /api/generate:
 *   post:
 *     summary: إنشاء مهمة توليد عقد جديدة
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: أريد عقد عمل لمهندس برمجيات براتب 15000 جنيه مصري ومدة سنة وفترة اختبار 3 شهور
 *               language:
 *                 type: string
 *                 enum: [ar, ar_en]
 *                 default: ar
 *               contractType:
 *                 type: string
 *                 enum: [employment, freelance, partnership]
 *                 default: employment
 *     responses:
 *       202:
 *         description: تم استلام الطلب وبدأت المعالجة
 * 
 *   get:
 *     summary: جلب كل مهام التوليد للمستخدم الحالي
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة المهام
 */

/**
 * @swagger
 * /api/generate/{jobId}:
 *   get:
 *     summary: جلب حالة ونتيجة مهمة التوليد
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: حالة المهمة والعقد المُولَّد إن اكتمل
 * 
 *   put:
 *     summary: حفظ تعديلات المستخدم على العقد
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
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
 *               - editedMarkdown
 *             properties:
 *               editedMarkdown:
 *                 type: string
 *     responses:
 *       200:
 *         description: تم حفظ التعديلات بنجاح
 * 
 *   delete:
 *     summary: حذف مهمة التوليد وكل البيانات المرتبطة
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم حذف المهمة بنجاح
 */

/**
 * @swagger
 * /api/generate/{jobId}/regenerate:
 *   post:
 *     summary: إعادة توليد العقد حسب تعليمات المستخدم
 *     description: تعديل عقد موجود وفق تعليمات المستخدم باستخدام الذكاء الاصطناعي.
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
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
 *               - instructions
 *             properties:
 *               instructions:
 *                 type: string
 *                 example: غيّر الراتب إلى 20000 جنيه وأضف بند الإقامة
 *     responses:
 *       200:
 *         description: تم إعادة توليد العقد بنجاح
 *       400:
 *         description: تعليمات التعديل مطلوبة
 *       404:
 *         description: العقد غير جاهز أو غير موجود
 */

/**
 * @swagger
 * /api/generate/{jobId}/validate:
 *   post:
 *     summary: فحص امتثال العقد المعدّل
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: نتائج الفحص
 * 
 * /api/generate/{jobId}/download:
 *   get:
 *     summary: تنزيل العقد المُولَّد كملف Markdown
 *     tags: [توليد العقود]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تنزيل ملف Markdown
 */

export const createContractGenerationRouter = (services: AppServices) => {
  const router = Router();
  const auth = authenticate(services.authService, services.userRepository);

  // Generation Endpoints
  router.post('/generate', auth, generateController.createGenerationJob);
  router.get('/generate', auth, generateController.getAllJobs);
  // router.get('/generate/progress', auth, generateController.getJobProgress);
  // router.get('/generate/stream', auth, generateController.streamJobProgress);
  router.get('/generate/:jobId', auth, generateController.getJobStatus);
  router.get('/generate/:jobId/download', auth, generateController.downloadContract);
  router.put('/generate/:jobId', auth, generateController.updateContract);
  router.post('/generate/:jobId/regenerate', auth, generateController.regenerateContract);
  router.post('/generate/:jobId/validate', auth, generateController.validateContract);
  router.get('/generate/:jobId/progress', auth, generateController.getJobProgress);
  router.get('/generate/:jobId/stream', auth, generateController.streamJobProgress);
  router.post('/generate/:jobId/cancel', auth, generateController.cancelJob);
  router.delete('/generate/:jobId', auth, generateController.deleteJob);

  return router;
};

export default createContractGenerationRouter;
