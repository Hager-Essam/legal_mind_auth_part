import type { ProgressEvent } from './contract-generation.service';

export const GENERATION_STAGE_NAMES: Record<string, string> = {
  '0/5': '📥 استلام الطلب وتجهيز المدخلات...',
  '1/5': '🧠 استخراج مواصفات العقد من الوصف...',
  '2/5': '📚 جلب المراجع القانونية من قاعدة البيانات...',
  '3/5': '✍️ توليد نص العقد وفقاً للقانون المصري...',
  '4/5': '⚖️ فحص الامتثال القانوني...',
  '5/5': '✅ اكتمل التوليد — العقد جاهز!',
};

// Re-export types from service for convenience
export type { ProgressEvent };
export * from './contract-generation.service';
