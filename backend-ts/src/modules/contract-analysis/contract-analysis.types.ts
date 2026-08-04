import type { ProgressEvent } from '../../modules/contract-analysis/contract-analysis.service';

// Note: Job interface is now defined in models/job.model.ts as IJob
// This file now only exports shared types and constants

export const STAGE_NAMES: Record<string, string> = {
  '0/7': '📥 تحميل الملف إلى التخزين السحابي...',
  '1/7': '📄 استخراج النص من العقد...',
  '2/7': '✨ تنقية النص والتحقق من صحته...',
  '3/7': '✂️ تقسيم العقد إلى بنود منفصلة...',
  '4/7': '📚 المطابقة مع قانون العمل المصري...',
  '5/7': '📊 تقييم الامتثال وحساب النتيجة...',
  '6/7': '📝 إعداد التقرير القانوني...',
  '7/7': '✅ اكتمل التحليل — التقرير جاهز!',
};

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.txt'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Re-export types from service for convenience
export type { ProgressEvent };
export * from './contract-analysis.service';
