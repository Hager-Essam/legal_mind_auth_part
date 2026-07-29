import { Router } from 'express';
import { upload } from '../../middlewares/contract-analysis-upload.middleware';
import { authenticate } from '../auth/auth.middleware';
import * as analyzeController from './contract-analysis.controller';

const router = Router();

router.get('/health', analyzeController.healthCheck);

router.post('/analyze', authenticate, upload.single('file'), analyzeController.uploadContract);
router.post('/analyze/:jobId/start', authenticate, analyzeController.startAnalysis);
router.get('/analyze', authenticate, analyzeController.getAllJobs);
// router.get('/analyze/progress', authenticate, analyzeController.getJobProgress);
// router.get('/analyze/stream', authenticate, analyzeController.streamJobProgress);
router.get('/analyze/:jobId', authenticate, analyzeController.getJobStatus);
router.get('/analyze/:jobId/progress', authenticate, analyzeController.getJobProgress);
router.get('/analyze/:jobId/stream', authenticate, analyzeController.streamJobProgress);
router.get('/analyze/:jobId/report/download', authenticate, analyzeController.downloadReport);
router.post('/analyze/:jobId/cancel', authenticate, analyzeController.cancelJob);
router.delete('/analyze/:jobId', authenticate, analyzeController.deleteJob);

export default router;
