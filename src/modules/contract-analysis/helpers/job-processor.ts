import fs from 'fs';
import path from 'path';
import type { ProgressEvent } from '../contract-analysis.types';
import { analyzer } from '../../../config/analyzer.config';
import { jobRepository } from '../repositories/job.repository';
import { resultsAnalysisRepository } from '../repositories/results-analysis.repository';
import { r2Storage } from '../../../config/r2.config';
import { IJob } from '../models/job.model';

export async function processJob(job: IJob): Promise<void> {
  const startTime = Date.now();

  try {
    // Update job status to processing
    await jobRepository.updateStatus(job.id, 'processing');

    // Progress event handler - saves to database
    const onProgress = async (event: ProgressEvent) => {
      const progressLog = {
        step: event.step,
        phase: event.phase,
        message: event.message,
        timestamp: new Date(),
      };
      
      await jobRepository.addProgressLog(job.id, progressLog);
      console.log(`[Job ${job.id}] ${event.step}: ${event.message}`);
    };

    // Note: job document has contractFileUrl, but the uploaded file is still at a temp path
    // We need to determine the temp file path from the multer upload
    // The controller should have stored this in a temp location
    // For now, we'll assume the file is uploaded to a temp directory and we have access via contractFileUrl
    
    // Download contract from R2 to temp location for processing
    const tempDir = path.join(__dirname, '../../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `${job.id}_${job.originalFileName}`);
    
    // If contractFileUrl exists, download from R2; otherwise the job was created incorrectly
    if (!job.contractFileUrl) {
      throw new Error('No contract file URL found. Job was created incorrectly.');
    }

    const key = job.contractFileUrl.split('/').slice(-3).join('/'); // Extract key from URL
    await r2Storage.downloadFile(key, tempFilePath);
    await onProgress({ step: '0/7', phase: 'start', message: '📥 Downloaded contract from R2 storage' });

    // Run analysis
    const result = await analyzer.analyze(tempFilePath, onProgress);

    // Sanitize clauses: ensure required_action.suggested_fix is never empty
    if (result.clauses) {
      result.clauses = result.clauses.map((clause: any) => ({
        ...clause,
        required_action: {
          ...clause.required_action,
          suggested_fix: clause.required_action?.suggested_fix || 'No suggestion provided',
        },
      }));
    }

    const processingTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    // Upload report markdown to R2
    const reportKey = r2Storage.generateKey(job.id, `${path.parse(job.originalFileName).name}_report.md`, 'reports');
    const reportUrl = await r2Storage.uploadString(result.report_markdown, reportKey, 'text/markdown');

    // Save analysis to MongoDB
    const analysis = await resultsAnalysisRepository.create({
      jobId: job.id,
      overall: result.overall,
      clauses: result.clauses,
      reportMarkdown: result.report_markdown,
      processedAt: new Date(result.processed_at),
      metadata: {
        totalClauses: result.clauses.length,
        processingTimeSeconds: parseFloat(processingTimeSeconds),
        modelUsed: 'qwen-mt-turbo', // From analyzer config
      },
    });

    // Update job with completed status and reference to analysis
    await jobRepository.updateStatus(job.id, 'completed', {
      completedAt: new Date(),
      analysisId: analysis._id,
      reportFileUrl: reportUrl,
    });

    await onProgress({ 
      step: '7/7', 
      phase: 'done', 
      message: `✅ Analysis complete! Score: ${result.overall.overall_score}/100 | Time: ${processingTimeSeconds}s` 
    });

    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

  } catch (error: any) {
    console.error(`Job ${job.id} failed:`, error);

    const errorMessage = error?.message || 'Unknown error occurred during analysis';

    await jobRepository.updateStatus(job.id, 'failed', {
      error: errorMessage,
      completedAt: new Date(),
    });

    await jobRepository.addProgressLog(job.id, {
      step: 'error',
      phase: 'done',
      message: `❌ Error: ${errorMessage}`,
      timestamp: new Date(),
    });

    // Clean up temp file on error
    const tempFilePath = path.join(__dirname, '../../../temp', `${job.id}_${job.originalFileName}`);
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}
