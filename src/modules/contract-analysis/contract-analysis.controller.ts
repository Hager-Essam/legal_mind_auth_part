import { Response } from 'express';
import type { Request } from 'express-serve-static-core';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { processJob } from '../contract-analysis/helpers/job-processor';
import { jobRepository } from '../contract-analysis/repositories/job.repository';
import { resultsAnalysisRepository } from '../contract-analysis/repositories/results-analysis.repository';
import { r2Storage } from '../../config/r2.config';
import { STAGE_NAMES } from '../contract-analysis/contract-analysis.types';
import { IJob } from '../contract-analysis/models/job.model';

export const healthCheck = (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

export const uploadContract = async (req: Request & { file?: Express.Multer.File }, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a file with key 'file'." });
      return;
    }

    const jobId = uuidv4();

    // Upload contract file to R2
    const contractKey = r2Storage.generateKey(jobId, req.file.originalname, 'contracts');
    const contractUrl = await r2Storage.uploadFile(req.file.path, contractKey, req.file.mimetype);

    // Create job in MongoDB
    const job = await jobRepository.create({
      id: jobId,
      status: 'queued',
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      contractFileUrl: contractUrl,
      createdAt: new Date(),
      progressLogs: [],
    });

    // Delete temp file after uploading to R2
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Start processing asynchronously
    processJob(job).catch((err: unknown) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Analysis started. Poll GET /api/contract-analysis/:jobId for results.',
    });
  } catch (error: any) {
    console.error('Upload contract error:', error);
    res.status(500).json({ error: 'Failed to upload contract', details: error.message });
  }
};

export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.jobId as string | undefined;

    if (!jobId) {
      res.status(400).json({
        success: false,
        message: 'Please provide a jobId. Example: /api/analyze/:jobId',
      });
      return;
    }

    const job = await jobRepository.findById(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const response: Record<string, any> = {
      jobId: job.id,
      status: job.status,
      originalFileName: job.originalFileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      createdAt: job.createdAt,
    };

    if (job.status === 'completed' && job.analysisId) {
      // Fetch analysis results
      const analysis = await resultsAnalysisRepository.findById(job.analysisId.toString());
      
      if (analysis) {
        response.result = {
          overall: analysis.overall,
          clauses: analysis.clauses,
          report_markdown: analysis.reportMarkdown,
          processed_at: analysis.processedAt,
        };
      }

      response.completedAt = job.completedAt;
      response.files = {
        contract: job.contractFileUrl,
        report: job.reportFileUrl,
      };
    }

    if (job.status === 'processing') {
      const lastEvent = job.progressLogs
        .filter((e) => e.step !== 'done' && e.step !== 'error')
        .pop();
      
      if (lastEvent) {
        response.currentStage = STAGE_NAMES[lastEvent.step] || 'جاري المعالجة';
        response.currentStep = lastEvent.step;
        response.totalSteps = '7/7';
        const stepNum = parseInt(lastEvent.step.split('/')[0], 10);
        response.progress = Math.round((stepNum / 7) * 100);
      }
    }

    if (job.status === 'failed' && job.error) {
      response.error = job.error;
      response.completedAt = job.completedAt;
    }

    res.json(response);
  } catch (error: any) {
    console.error('Get job status error:', error);
    res.status(500).json({ error: 'Failed to get job status', details: error.message });
  }
};

export const getAllJobs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await jobRepository.findAll({ limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });

    const allJobs = jobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      originalFileName: job.originalFileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      contractUrl: job.contractFileUrl,
      reportUrl: job.reportFileUrl,
    }));

    res.json(allJobs);
  } catch (error: any) {
    console.error('Get all jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs', details: error.message });
  }
};

export const streamJobProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.jobId as string | undefined;

    if (!jobId) {
      res.status(400).json({
        success: false,
        message: 'Please provide a jobId. Example: /api/analyze/:jobId/stream',
      });
      return;
    }

    const job = await jobRepository.findById(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send existing progress logs
    for (const event of job.progressLogs) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // If job is complete or failed, end the stream
    if (job.status === 'completed' || job.status === 'failed') {
      res.end();
      return;
    }

    // For real-time updates, we need to poll the database
    // Set up polling interval (every 2 seconds)
    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await jobRepository.findById(jobId);
        
        if (!updatedJob) {
          clearInterval(pollInterval);
          res.end();
          return;
        }

        // Send only new logs (logs added since last poll)
        const newLogs = updatedJob.progressLogs.slice(job.progressLogs.length);
        for (const event of newLogs) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Update the local job reference
        job.progressLogs = updatedJob.progressLogs;

        // End stream if job is complete or failed
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          clearInterval(pollInterval);
          res.end();
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
        res.end();
      }
    }, 2000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval);
      res.end();
    });
  } catch (error: any) {
    console.error('Stream job progress error:', error);
    res.status(500).json({ error: 'Failed to stream progress', details: error.message });
  }
};

export const getJobProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.jobId as string | undefined;

    if (!jobId) {
      res.status(400).json({
        success: false,
        message: 'Please provide a jobId. Example: /api/analyze/:jobId/progress',
      });
      return;
    }

    const progressLogs = await jobRepository.getProgressLogs(jobId);

    if (!progressLogs) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({
      jobId: jobId,
      logs: progressLogs,
      totalLogs: progressLogs.length,
    });
  } catch (error: any) {
    console.error('Get job progress error:', error);
    res.status(500).json({ error: 'Failed to get progress', details: error.message });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = req.params.jobId as string | undefined;

    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    const job = await jobRepository.findById(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Delete contract file from R2
    if (job.contractFileUrl) {
      try {
        const contractKey = job.contractFileUrl.split('/').slice(-3).join('/');
        await r2Storage.deleteFile(contractKey);
      } catch (error) {
        console.error('Failed to delete contract from R2:', error);
      }
    }

    // Delete report file from R2
    if (job.reportFileUrl) {
      try {
        const reportKey = job.reportFileUrl.split('/').slice(-3).join('/');
        await r2Storage.deleteFile(reportKey);
      } catch (error) {
        console.error('Failed to delete report from R2:', error);
      }
    }

    // Delete analysis from MongoDB
    if (job.analysisId) {
      await resultsAnalysisRepository.deleteById(job.analysisId.toString());
    }

    // Delete job from MongoDB
    await jobRepository.delete(jobId);

    res.json({ message: 'Job deleted successfully', jobId });
  } catch (error: any) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job', details: error.message });
  }
};
