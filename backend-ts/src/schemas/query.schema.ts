import { z } from "zod";
import { legalChunksSchema } from "./chunk.schema";

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
