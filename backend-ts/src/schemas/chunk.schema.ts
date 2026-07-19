import { z } from "zod";

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
