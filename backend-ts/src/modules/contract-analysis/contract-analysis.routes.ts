import { Router } from 'express';
import { upload } from './upload.middleware';
import { authenticate } from '../auth/auth.middleware';
import * as analyzeController from './contract-analysis.controller';
import type { AppServices } from '../../services/service-container';

export const createContractAnalysisRouter = (services: AppServices) => {
  const router = Router();
  const auth = authenticate(services.authService, services.userRepository);

  router.get('/health', analyzeController.healthCheck);

  router.post('/analyze', auth, upload.single('file'), analyzeController.uploadContract);
  router.post('/analyze/:jobId/start', auth, analyzeController.startAnalysis);
  router.get('/analyze', auth, analyzeController.getAllJobs);
  // router.get('/analyze/progress', auth, analyzeController.getJobProgress);
  // router.get('/analyze/stream', auth, analyzeController.streamJobProgress);
  router.get('/analyze/:jobId', auth, analyzeController.getJobStatus);
  router.get('/analyze/:jobId/progress', auth, analyzeController.getJobProgress);
  router.get('/analyze/:jobId/stream', auth, analyzeController.streamJobProgress);
  router.get('/analyze/:jobId/report/download', auth, analyzeController.downloadReport);
  router.post('/analyze/:jobId/cancel', auth, analyzeController.cancelJob);
  router.delete('/analyze/:jobId', auth, analyzeController.deleteJob);

  return router;
};

export default createContractAnalysisRouter;
