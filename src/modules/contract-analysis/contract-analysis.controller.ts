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

const getJobId = (req: Request): string => req.params.jobId as string;

export const healthCheck = (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

export const uploadContract = async (req: Request & { file?: Express.Multer.File }, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف. يُرجى إرسال ملف بمفتاح "file".',
      });
      return;
    }

    const userId = (req as any).user._id.toString();
    const jobId = uuidv4();

    const contractKey = r2Storage.generateKey(jobId, req.file.originalname, 'contracts');
    const contractUrl = await r2Storage.uploadFile(req.file.path, contractKey, req.file.mimetype);

    const job = await jobRepository.create({
      id: jobId,
      status: 'queued',
      userId,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      contractFileUrl: contractUrl,
      createdAt: new Date(),
      progressLogs: [],
    });

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(201).json({
      success: true,
      message: 'تم رفع العقد بنجاح! يمكنك الآن بدء التحليل عند الجاهزية.',
      data: {
        jobId: job.id,
        status: job.status,
        fileName: job.originalFileName,
        fileSize: job.fileSize,
        fileType: job.fileType,
        createdAt: job.createdAt,
      },
    });
  } catch (error: any) {
    console.error('خطأ في رفع العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في رفع العقد. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const startAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.',
      });
      return;
    }

    if (job.status !== 'queued') {
      const statusMessages: Record<string, string> = {
        processing: 'العقد قيد التحليل حالياً. يُرجى الانتظار حتى اكتمال التحليل.',
        completed: 'تم تحليل هذا العقد بالفعل. يمكنك الاطلاع على النتائج.',
        failed: 'فشل التحليل سابقاً. يُرجى رفع العقد مجدداً.',
      };
      res.status(409).json({
        success: false,
        message: statusMessages[job.status] || 'حالة العقد غير صالحة للبدء في التحليل.',
      });
      return;
    }

    processJob(job).catch((err: unknown) => {
      console.error(`فشل تحليل العقد ${job.id}:`, err);
    });

    res.status(202).json({
      success: true,
      message: 'تم بدء تحليل العقد بنجاح! يمكنك متابعة التقدم عبر معرّف العقد.',
      data: {
        jobId: job.id,
        status: 'processing',
      },
    });
  } catch (error: any) {
    console.error('خطأ في بدء التحليل:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في بدء التحليل. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.',
      });
      return;
    }

    const response: Record<string, any> = {
      jobId: job.id,
      status: job.status,
      fileName: job.originalFileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      createdAt: job.createdAt,
    };

    if (job.status === 'completed' && job.analysisId) {
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
        response.currentStage = STAGE_NAMES[lastEvent.step] || 'جاري المعالجة...';
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

    res.json({
      success: true,
      message: 'تم جلب بيانات العقد بنجاح.',
      data: response,
    });
  } catch (error: any) {
    console.error('خطأ في جلب حالة العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات العقد. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const getAllJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    const jobs = await jobRepository.findAll({ userId, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });

    const allJobs = jobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      fileName: job.originalFileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      contractUrl: job.contractFileUrl,
      reportUrl: job.reportFileUrl,
    }));

    res.json({
      success: true,
      message: `تم جلب ${allJobs.length} عقد بنجاح.`,
      data: allJobs,
    });
  } catch (error: any) {
    console.error('خطأ في جلب العقود:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب قائمة العقود. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const streamJobProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.',
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    for (const event of job.progressLogs) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      res.end();
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await jobRepository.findByIdAndUserId(jobId, userId);

        if (!updatedJob) {
          clearInterval(pollInterval);
          res.end();
          return;
        }

        const newLogs = updatedJob.progressLogs.slice(job.progressLogs.length);
        for (const event of newLogs) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        job.progressLogs = updatedJob.progressLogs;

        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          clearInterval(pollInterval);
          res.end();
        }
      } catch (error) {
        console.error('خطأ في متابعة التقدم:', error);
        clearInterval(pollInterval);
        res.end();
      }
    }, 2000);

    req.on('close', () => {
      clearInterval(pollInterval);
      res.end();
    });
  } catch (error: any) {
    console.error('خطأ في متابعة تقدم العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في متابعة تقدم العقد. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const getJobProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.',
      });
      return;
    }

    const progressLogs = await jobRepository.getProgressLogs(jobId);

    res.json({
      success: true,
      message: `تم جلب سجل التقدم بنجاح (${progressLogs.length} سجل).`,
      data: {
        jobId,
        logs: progressLogs,
        totalLogs: progressLogs.length,
      },
    });
  } catch (error: any) {
    console.error('خطأ في جلب سجل التقدم:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب سجل التقدم. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.',
      });
      return;
    }

    if (job.contractFileUrl) {
      try {
        const contractKey = job.contractFileUrl.split('/').slice(-3).join('/');
        await r2Storage.deleteFile(contractKey);
      } catch (error) {
        console.error('فشل في حذف العقد من التخزين السحابي:', error);
      }
    }

    if (job.reportFileUrl) {
      try {
        const reportKey = job.reportFileUrl.split('/').slice(-3).join('/');
        await r2Storage.deleteFile(reportKey);
      } catch (error) {
        console.error('فشل في حذف التقرير من التخزين السحابي:', error);
      }
    }

    if (job.analysisId) {
      await resultsAnalysisRepository.deleteById(job.analysisId.toString());
    }

    await jobRepository.delete(jobId);

    res.json({
      success: true,
      message: 'تم حذف العقد وجميع البيانات المرتبطة بنجاح.',
      data: { jobId },
    });
  } catch (error: any) {
    console.error('خطأ في حذف العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف العقد. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const downloadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.',
      });
      return;
    }

    if (job.status !== 'completed') {
      res.status(400).json({
        success: false,
        message: 'العقد لم يتم تحليله بعد. يُرجى بدء التحليل أولاً.',
      });
      return;
    }

    if (!job.analysisId) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على نتائج التحليل لهذا العقد.',
      });
      return;
    }

    const analysis = await resultsAnalysisRepository.findById(job.analysisId.toString());

    if (!analysis) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على بيانات التحليل. يُرجى إعادة التحليل.',
      });
      return;
    }

    const reportName = `report_${job.originalFileName.replace(/\.[^/.]+$/, '')}.md`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${reportName}"`);
    res.status(200).send(analysis.reportMarkdown);
  } catch (error: any) {
    console.error('خطأ في تحميل التقرير:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحميل التقرير. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};
