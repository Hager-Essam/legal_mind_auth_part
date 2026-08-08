import fs from 'fs';
import path from 'path';
import type { ProgressEvent } from '../contract-generation.types';
import { generator } from '../../../config/generator.config';
import { generationJobRepository } from '../repositories/generation-job.repository';
import { generatedContractRepository } from '../repositories/generated-contract.repository';
import { r2Storage } from '../../../config/r2.config';
import { IGenerationJob } from '../models/generation-job.model';

export async function processGenerationJob(job: IGenerationJob): Promise<void> {
  const startTime = Date.now();

  try {
    // Update job status to processing
    await generationJobRepository.updateStatus(job.id, 'processing');

    // Cancellation check — reads fresh status from DB
    const isCancelled = async (): Promise<boolean> => {
      const fresh = await generationJobRepository.findById(job.id);
      return fresh?.status === 'cancelled';
    };

    // Progress event handler - saves to database
    const onProgress = async (event: ProgressEvent) => {
      const progressLog = {
        step: event.step,
        phase: event.phase,
        message: event.message,
        timestamp: new Date(),
      };
      
      await generationJobRepository.addProgressLog(job.id, progressLog);
      console.log(`[مهمة التوليد ${job.id}] ${event.step}: ${event.message}`);
    };

    await onProgress({ step: '0/5', phase: 'start', message: '📥 استلام الطلب وتجهيز المدخلات...' });

    // Run generation pipeline
    const result = await generator.generate(
      job.prompt,
      {
        language: job.language,
        contractType: job.contractType,
      },
      onProgress,
      isCancelled,
    );

    const processingTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    // Check if job was deleted during generation
    const jobStillExists = await generationJobRepository.findById(job.id);
    if (!jobStillExists) {
      console.log(`تم حذف مهمة التوليد ${job.id} أثناء المعالجة — تم الإيقاف.`);
      return;
    }

    // Upload generated contract markdown to R2
    const reportKey = r2Storage.generateKey(job.id, `generated_contract_${job.id}.md`, 'generated-contracts');
    const reportUrl = await r2Storage.uploadString(result.contractMarkdown, reportKey, 'text/markdown');

    // Save generated contract to MongoDB
    const generatedContract = await generatedContractRepository.create({
      jobId: job.id,
      contractSpec: result.contractSpec,
      contractMarkdown: result.contractMarkdown,
      placeholders: result.placeholders,
      complianceCheck: result.complianceCheck,
      processedAt: result.processedAt,
      metadata: {
        generationTimeSeconds: parseFloat(processingTimeSeconds),
        modelUsed: 'qwen3.7-plus-2026-05-26',
      },
    });

    // Update job with completed status and reference to generated contract
    await generationJobRepository.updateStatus(job.id, 'completed', {
      completedAt: new Date(),
      generatedContractId: generatedContract._id,
      contractFileUrl: reportUrl,
    });

    await onProgress({ 
      step: '5/5', 
      phase: 'done', 
      message: `✅ التوليد اكتمل! الوقت: ${processingTimeSeconds} ثانية | ${result.placeholders.length} حقول مطلوبة` 
    });

  } catch (error: any) {
    console.error(`فشلت مهمة التوليد ${job.id}:`, error);

    // Don't mark as failed if already cancelled
    const fresh = await generationJobRepository.findById(job.id);
    if (fresh?.status === 'cancelled') {
      return;
    }

    const errorMessage = error?.message || 'حدث خطأ غير معروف أثناء توليد العقد.';

    await generationJobRepository.updateStatus(job.id, 'failed', {
      error: errorMessage,
      completedAt: new Date(),
    });

    await generationJobRepository.addProgressLog(job.id, {
      step: 'error',
      phase: 'done',
      message: `❌ خطأ: ${errorMessage}`,
      timestamp: new Date(),
    });
  }
}
