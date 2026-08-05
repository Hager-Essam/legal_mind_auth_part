import { z } from "zod";

// ── Regex Patterns ─────────────────────────────────────────────
export const TASHKEEL_RE = /[\u0617-\u061a\u064b-\u0652\u0670]/g;
export const TATWEEL_RE = /\u0640/g;
export const ARABIC_TO_WESTERN_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};
export const ARTICLES_RE = /(?:المادة|مادة|المواد|مواد|article|articles)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;
export const PARAGRAPHS_RE = /(?:الفقرة|فقرة|الفقرات|فقرات|paragraph|paragraphs)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;
export const CLAUSES_RE = /(?:البند|بند|البلنود|بنود|clause|clauses)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;
export const LAW_NAME_RE = /(?:(?:من|في)\s+)?((?:قانون|لائحة|اللائحة|قرار|نظام|مرسوم|تعميم|تشريع|أمر)[^؟\n\r،.]*)/i;
export const APPEAL_RE = /الطعن\s+رقم\s+([\د٠-٩]+)/i;
export const JUDICIAL_YEAR_RE = /الطعن\s+رقم\s+[\د٠-٩]+\s+لسنة\s+([\د٠-٩]{1,4})/i;
export const CHAT_RE = /^(شكرا|شكراً|ممتاز|جيد|مرحبا|أهلا|اهلا|سلام|السلام عليكم|hi|hello|thanks|thank you|how are you|ازيك|عامل ايه|عامله ايه|ايه الاخبار)/i;

// ── Schemas ────────────────────────────────────────────────────
export const legalChunksSchema = z.object({
  chunk_id: z.string(),
  article_number: z.string().optional(),
  content: z.string(),
  source_file: z.string().optional(),
  law_name_normalized: z.string().default(""),
  law_category: z.string().default(""),
  source_dataset: z.string().default(""),
  language: z.string().default(""),
  semantic_unit: z.string().default(""),
  hierarchy_path: z.string().default(""),
  is_retrievable: z.boolean().default(true),
  text_len: z.number().default(0),
  law_number: z.string().optional(),
  law_year: z.string().optional(),
  appeal_number: z.string().optional(),
  judicial_year: z.string().optional(),
  ruling_date: z.string().optional(),
  case_subject: z.string().optional(),
  child_index: z.number().optional(),
  parent_chunk_id: z.string().optional(),
  similarity_score: z.number().optional(),
  rerank_score: z.number().optional(),
  evidence_rank: z.number().optional(),
  rrf_score: z.number().optional(),
});
export type LegalChunks = z.infer<typeof legalChunksSchema>;

export const questionCategorySchema = z.enum(["arabic_rag", "law_ref", "chat"]);
export type QuestionCategory = z.infer<typeof questionCategorySchema>;

export const userRoleSchema = z.enum(["lawyer", "citizen"]);

export const queryRequestSchema = z.object({
  query: z.string().min(3).max(2000),
  top_k: z.number().int().min(1).max(50).default(5),
  law_category: z.string().min(1).optional(),
  user_role: userRoleSchema.optional(),
});
export type QueryRequest = z.infer<typeof queryRequestSchema>;

export const queryResponseSchema = z.object({
  answer: z.string(),
  source_chunks: z.array(legalChunksSchema).default([]),
  llm_provider_used: z.string().nullable(),
  category: questionCategorySchema.default("arabic_rag" as const),
  latency_ms: z.number().int().nonnegative().default(0),
  confidence_score: z.number().min(0).max(1).optional(),
});
export type QueryResponse = z.infer<typeof queryResponseSchema>;

// ── Types ──────────────────────────────────────────────────────
export type ParsedLegalReference = {
  normalizedQuery: string;
  articleNumber: string | null;
  articleNumbers: string[];
  paragraphs: string[];
  clauses: string[];
  lawName: string | null;
  lawNumber: string | null;
  lawYear: string | null;
  appealNumber: string | null;
  judicialYear: string | null;
};

export type RewriteResult = {
  originalQuery: string;
  rewrittenQuery: string;
  usedMapping: boolean;
  usedLlm: boolean;
  mappingMatch: string | null;
};

export type ClassificationResult = {
  category: QuestionCategory;
  parsedReference?: ParsedLegalReference;
};

export type GroundingDecision = {
  shouldGenerate: boolean;
  refusalAnswer?: string;
};

export type SearchOptions = {
  topK?: number;
  lawCategory?: string;
  lawNumber?: string;
  lawYear?: string;
  appealNumber?: string;
  judicialYear?: string;
};

export type ProviderSummary = {
  llmProvider: string;
  baseUrl: string;
  llmModel: string;
  llmModelFallback: string;
  embeddingModel: string;
  embeddingDim: number;
  configuredKeys: number;
  llmConfigured: boolean;
};
