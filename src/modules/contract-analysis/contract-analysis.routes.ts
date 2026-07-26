import { Router } from 'express';
import { upload } from '../../middlewares/contract-analysis-upload.middleware';
import * as analyzeController from './contract-analysis.controller';

const router = Router();

router.get('/health', analyzeController.healthCheck);
router.post('/analyze', upload.single('file'), analyzeController.uploadContract);
router.get('/analyze', analyzeController.getJobStatus);
router.get('/analyze/', analyzeController.getJobStatus);
router.get('/analyze/progress', analyzeController.getJobProgress);
router.get('/analyze/stream', analyzeController.streamJobProgress);
router.get('/analyze/:jobId', analyzeController.getJobStatus);
router.get('/analyze/:jobId/progress', analyzeController.getJobProgress);
router.get('/analyze/:jobId/stream', analyzeController.streamJobProgress);
router.get('/jobs', analyzeController.getAllJobs);
router.delete('/analyze/:jobId', analyzeController.deleteJob);

export default router;
