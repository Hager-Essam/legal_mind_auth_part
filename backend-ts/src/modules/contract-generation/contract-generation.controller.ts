import { Response } from 'express';
import type { Request } from 'express-serve-static-core';
import { v4 as uuidv4 } from 'uuid';
import { processGenerationJob } from '../contract-generation/helpers/generation-job-processor';
import { generationJobRepository } from '../contract-generation/repositories/generation-job.repository';
import { generatedContractRepository } from '../contract-generation/repositories/generated-contract.repository';
import { r2Storage } from '../../config/r2.config';
import { GENERATION_STAGE_NAMES } from '../contract-generation/contract-generation.types';
import { listJobsQuerySchema } from '../contract-generation/contract-generation.schemas';
import { generator } from '../../config/generator.config';
import { analyzer } from '../../config/analyzer.config';

const STATUS_LABELS_AR: Record<string, string> = {
  queued: 'في الانتظار',
  processing: 'قيد المعالجة',
  completed: 'مكتمل',
  failed: 'فشل',
  cancelled: 'ملغى',
};

const getJobId = (req: Request): string => req.params.jobId as string;

export const createGenerationJob = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt, language = 'ar', contractType = 'employment' } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'الرجاء إدخال وصف العقد المطلوب.',
      });
      return;
    }

    const userId = req.user!.id;
    const jobId = uuidv4();

    const job = await generationJobRepository.create({
      id: jobId,
      status: 'queued',
      userId,
      prompt: prompt.trim(),
      language,
      contractType,
      createdAt: new Date(),
      progressLogs: [],
    });

    // Start background processing immediately
    processGenerationJob(job).catch((err: unknown) => {
      console.error(`فشل توليد العقد ${job.id}:`, err);
    });

    res.status(202).json({
      success: true,
      message: 'تم استلام طلب التوليد بنجاح وجاري المعالجة.',
      data: {
        jobId: job.id,
        status: 'processing',
        createdAt: job.createdAt,
      },
    });
  } catch (error: any) {
    console.error('خطأ في طلب التوليد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في استلام الطلب. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const getJobStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من المعرف.',
      });
      return;
    }

    const response: Record<string, any> = {
      jobId: job.id,
      status: job.status,
      language: job.language,
      contractType: job.contractType,
      createdAt: job.createdAt,
    };

    if (job.status === 'completed' && job.generatedContractId) {
      const generatedContract = await generatedContractRepository.findById(
        job.generatedContractId.toString()
      );

      if (generatedContract) {
        response.result = {
          contractSpec: generatedContract.contractSpec,
          contractMarkdown: generatedContract.contractMarkdown,
          editedMarkdown: generatedContract.editedMarkdown,
          placeholders: generatedContract.placeholders,
          complianceCheck: generatedContract.complianceCheck,
          validationResult: generatedContract.validationResult,
          processed_at: generatedContract.processedAt,
        };
      }

      response.completedAt = job.completedAt;
      response.files = {
        report: job.contractFileUrl,
      };
    }

    if (job.status === 'processing') {
      const lastEvent = job.progressLogs
        .filter((e) => e.step !== 'done' && e.step !== 'error')
        .pop();

      if (lastEvent) {
        response.currentStage = GENERATION_STAGE_NAMES[lastEvent.step] || 'جاري المعالجة...';
        response.currentStep = lastEvent.step;
        response.totalSteps = '5/5';
        const stepNum = parseInt(lastEvent.step.split('/')[0], 10);
        response.progress = Math.round((stepNum / 5) * 100);
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
    console.error('خطأ في جلب حالة التوليد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب بيانات العقد. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const getAllJobs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const input = listJobsQuerySchema.parse(req.query);
    const skip = (input.page - 1) * input.limit;

    const [jobs, total] = await Promise.all([
      generationJobRepository.findAll({
        userId,
        limit: input.limit,
        skip,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
      generationJobRepository.count({ userId }),
    ]);

    const allJobs = jobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      promptExcerpt: job.prompt.substring(0, 50) + (job.prompt.length > 50 ? '...' : ''),
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));

    res.json({
      success: true,
      message: `تم جلب ${allJobs.length} طلب توليد بنجاح.`,
      data: allJobs,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        pages: Math.ceil(total / input.limit),
      },
    });
  } catch (error: any) {
    console.error('خطأ في جلب الطلبات:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب القائمة. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const streamJobProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد. يُرجى التأكد من المعرف.',
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
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
        const updatedJob = await generationJobRepository.findByIdAndUserId(jobId, userId);

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

        if (
          updatedJob.status === 'completed' ||
          updatedJob.status === 'failed'
        ) {
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
      message: 'فشل في المتابعة. يُرجى المحاولة مرة أخرى.',
      error: error.message,
    });
  }
};

export const getJobProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد.',
      });
      return;
    }

    const progressLogs = await generationJobRepository.getProgressLogs(jobId);

    res.json({
      success: true,
      message: `تم جلب سجل التقدم بنجاح.`,
      data: {
        jobId,
        logs: progressLogs,
        totalLogs: progressLogs.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'فشل في جلب سجل التقدم.',
      error: error.message,
    });
  }
};

export const updateContract = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;
    const { editedMarkdown } = req.body;

    if (!editedMarkdown || typeof editedMarkdown !== 'string') {
      res.status(400).json({
        success: false,
        message: 'الرجاء توفير النص المعدّل للعقد.',
      });
      return;
    }

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job || job.status !== 'completed' || !job.generatedContractId) {
      res.status(404).json({
        success: false,
        message: 'العقد غير جاهز أو غير موجود.',
      });
      return;
    }

    await generatedContractRepository.update(job.id, {
      editedMarkdown,
    });

    res.json({
      success: true,
      message: 'تم حفظ التعديلات بنجاح.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'فشل في حفظ التعديلات.',
      error: error.message,
    });
  }
};

export const regenerateContract = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;
    const { instructions } = req.body;

    if (!instructions || typeof instructions !== 'string' || instructions.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'الرجاء كتابة تعليمات التعديل.',
      });
      return;
    }

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job || job.status !== 'completed' || !job.generatedContractId) {
      res.status(404).json({
        success: false,
        message: 'العقد غير جاهز أو غير موجود.',
      });
      return;
    }

    const contract = await generatedContractRepository.findById(
      job.generatedContractId.toString()
    );

    if (!contract) {
      res.status(404).json({ success: false, message: 'بيانات العقد غير موجودة.' });
      return;
    }

    const currentMarkdown = contract.editedMarkdown || contract.contractMarkdown;

    // Regenerate with user instructions
    const newMarkdown = await generator.regenerateContract(currentMarkdown, instructions.trim());

    // Extract placeholders from the new contract
    const newPlaceholders = generator.extractPlaceholders(newMarkdown);

    // Update the contract
    await generatedContractRepository.update(job.id, {
      contractMarkdown: newMarkdown,
      placeholders: newPlaceholders,
    });

    res.json({
      success: true,
      message: 'تم إعادة توليد العقد بنجاح.',
      data: {
        contractMarkdown: newMarkdown,
        placeholders: newPlaceholders,
      },
    });
  } catch (error: any) {
    console.error('خطأ في إعادة توليد العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إعادة توليد العقد.',
      error: error.message,
    });
  }
};

export const validateContract = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job || job.status !== 'completed' || !job.generatedContractId) {
      res.status(404).json({
        success: false,
        message: 'العقد غير جاهز أو غير موجود.',
      });
      return;
    }

    const contract = await generatedContractRepository.findById(job.generatedContractId.toString());
    
    if (!contract) {
      res.status(404).json({ success: false, message: 'بيانات العقد غير موجودة.' });
      return;
    }

    const textToValidate = contract.editedMarkdown || contract.contractMarkdown;

    // Reuse the full analysis pipeline (Step 8 per design doc)
    const analysisReport = await analyzer.analyzeText(textToValidate);

    // Check if job/contract was deleted during validation
    const jobStillExists = await generationJobRepository.findByIdAndUserId(jobId, userId);
    if (!jobStillExists) {
      // Job was deleted while validation was running — abort silently
      return;
    }

    // Convert analysis report to validation result format
    const validationResult = {
      valid: analysisReport.overall.overall_score >= 70,
      score: analysisReport.overall.overall_score,
      issues: analysisReport.clauses
        .filter((c: any) => c.compliance.status !== 'compliant')
        .map((c: any) => ({
          clause: c.clause_text.substring(0, 80) + (c.clause_text.length > 80 ? '...' : ''),
          status: c.compliance.status,
          explanation: c.compliance.explanation,
          suggestedFix: c.required_action.suggested_fix,
          severity: c.required_action.severity,
        })),
      compliantClauses: analysisReport.clauses.filter((c: any) => c.compliance.status === 'compliant').length,
      totalClauses: analysisReport.clauses.length,
    };

    await generatedContractRepository.update(job.id, {
      validationResult,
    });

    res.json({
      success: true,
      message: 'تم فحص العقد بنجاح.',
      data: {
        validationResult,
        report: analysisReport.report_markdown,
      },
    });
  } catch (error: any) {
    console.error('خطأ في التحقق من العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل فحص العقد.',
      error: error.message,
    });
  }
};

export const downloadContract = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job || job.status !== 'completed' || !job.generatedContractId) {
      res.status(404).json({
        success: false,
        message: 'العقد غير جاهز أو غير موجود.',
      });
      return;
    }

    const contract = await generatedContractRepository.findById(
      job.generatedContractId.toString()
    );

    if (!contract) {
      res.status(404).json({
        success: false,
        message: 'بيانات العقد غير موجودة.',
      });
      return;
    }

    const markdown = contract.editedMarkdown || contract.contractMarkdown;
    const fileName = `contract_${jobId}.md`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(markdown);
  } catch (error: any) {
    console.error('خطأ في تحميل العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحميل العقد.',
      error: error.message,
    });
  }
};

export const cancelJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد.',
      });
      return;
    }

    if (job.status !== 'queued' && job.status !== 'processing') {
      res.status(400).json({
        success: false,
        message: `لا يمكن إلغاء العقد في الحالة الحالية (${STATUS_LABELS_AR[job.status] || job.status}).`,
      });
      return;
    }

    // Mark as cancelled so the processor aborts
    await generationJobRepository.updateStatus(job.id, 'cancelled', {
      completedAt: new Date(),
    });

    // Wait briefly to let the processor detect cancellation and exit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean up: R2 file, generated contract, job record
    if (job.contractFileUrl) {
      try {
        const reportKey = job.contractFileUrl.split('/').slice(-3).join('/');
        await r2Storage.deleteFile(reportKey);
      } catch (error) {
        console.error('فشل حذف العقد من التخزين السحابي:', error);
      }
    }

    if (job.generatedContractId) {
      await generatedContractRepository.deleteById(job.generatedContractId.toString());
    }

    await generationJobRepository.delete(jobId);

    res.json({
      success: true,
      message: 'تم إلغاء التوليد وحذف العقد بنجاح.',
      data: { jobId },
    });
  } catch (error: any) {
    console.error('خطأ في إلغاء العقد:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إلغاء العقد.',
      error: error.message,
    });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await generationJobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'لم يتم العثور على العقد.',
      });
      return;
    }

    if (job.contractFileUrl) {
      try {
        const reportKey = job.contractFileUrl.split('/').slice(-3).join('/');
        await r2Storage.deleteFile(reportKey);
      } catch (error) {
        console.error('فشل حذف العقد من التخزين السحابي:', error);
      }
    }

    if (job.generatedContractId) {
      await generatedContractRepository.deleteById(job.generatedContractId.toString());
    }

    await generationJobRepository.delete(jobId);

    res.json({
      success: true,
      message: 'تم حذف العقد بنجاح.',
      data: { jobId },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'فشل في حذف العقد.',
      error: error.message,
    });
  }
};
