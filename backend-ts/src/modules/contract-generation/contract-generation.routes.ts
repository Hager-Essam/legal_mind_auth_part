import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import * as generateController from './contract-generation.controller';
import type { AppServices } from '../../services/service-container';

/**
 * @swagger
 * tags:
 *   name: Contract Generation
 *   description: Contract generation endpoints
 */

/**
 * @swagger
 * /api/generate:
 *   post:
 *     summary: Create a new contract generation job
 *     tags: [Contract Generation]
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
 *         description: Job accepted and processing started
 * 
 *   get:
 *     summary: Get all generation jobs for current user
 *     tags: [Contract Generation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
 */

/**
 * @swagger
 * /api/generate/{jobId}:
 *   get:
 *     summary: Get status and result of a generation job
 *     tags: [Contract Generation]
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
 *         description: Job status and generated contract if completed
 * 
 *   put:
 *     summary: Save user edits to generated contract
 *     tags: [Contract Generation]
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
 *         description: Edits saved successfully
 * 
 *   delete:
 *     summary: Delete a generation job and all associated data
 *     tags: [Contract Generation]
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
 *         description: Job deleted successfully
 */

/**
 * @swagger
 * /api/generate/{jobId}/regenerate:
 *   post:
 *     summary: Regenerate contract with user instructions
 *     description: Modify an existing contract according to user instructions using AI.
 *     tags: [Contract Generation]
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
 *                 example: غيّر الرواتب إلى 20000 جنيه وأضف بند الإقامة
 *     responses:
 *       200:
 *         description: Contract regenerated successfully
 *       400:
 *         description: Instructions are required
 *       404:
 *         description: Contract not ready or not found
 */

/**
 * @swagger
 * /api/generate/{jobId}/validate:
 *   post:
 *     summary: Validate an edited contract for compliance
 *     tags: [Contract Generation]
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
 *         description: Validation results
 * 
 * /api/generate/{jobId}/download:
 *   get:
 *     summary: Download generated contract as Markdown file
 *     tags: [Contract Generation]
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
 *         description: Markdown file download
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
