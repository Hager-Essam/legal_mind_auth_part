import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const splitCsv = (value: string | undefined): string[] =>
  value ? value.split(",").map((e) => e.trim()).filter(Boolean) : [];

const envSchema = z.object({
  LEGALMIND_MONGODB_URI: z.string().default("mongodb://localhost:27017"),
  LEGALMIND_MONGODB_DB: z.string().default("legalmind"),
  LEGALMIND_DASHSCOPE_BASE_URL: z.string().url().default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
  LEGALMIND_DASHSCOPE_API_KEYS: z.string().optional(),
  LEGALMIND_LLM_MODEL: z.string().default("qwen-plus"),
  LEGALMIND_LLM_MODEL_FALLBACK: z.string().default("qwen-turbo"),
  LEGALMIND_EMBEDDING_MODEL: z.string().default("text-embedding-v4"),
  LEGALMIND_EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),
  LEGALMIND_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(100).default(20),
  LEGALMIND_RETRIEVAL_OVERFETCH: z.coerce.number().int().min(1).max(100).default(20),
  LEGALMIND_RERANK_TOP_K: z.coerce.number().int().min(1).max(100).default(10),
  LEGALMIND_ENABLE_HYBRID_SEARCH: z.union([z.string(), z.boolean()]).transform((v: string | boolean) => v === true || v === "true").default(true),
  LEGALMIND_SPARSE_TOP_K: z.coerce.number().int().min(1).max(100).default(20),
  LEGALMIND_RRF_K: z.coerce.number().int().min(1).default(60),
  LEGALMIND_ENABLE_LLM_RERANK: z.union([z.string(), z.boolean()]).transform((v: string | boolean) => v === true || v === "true").default(true),
  LEGALMIND_LLM_RERANK_MODEL: z.string().default("qwen3-rerank"),
  LEGALMIND_ENABLE_QUERY_REWRITE: z.union([z.string(), z.boolean()]).transform((v: string | boolean) => v === true || v === "true").default(true),
  LEGALMIND_LLM_REWRITE_MODEL: z.string().default("qwen-turbo"),
  LEGALMIND_DEFAULT_USER_ROLE: z.enum(["lawyer", "citizen"]).default("citizen"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  mongodbUri: parsed.LEGALMIND_MONGODB_URI,
  mongodbDb: parsed.LEGALMIND_MONGODB_DB,
  dashscopeCompatUrl: parsed.LEGALMIND_DASHSCOPE_BASE_URL,
  dashscopeApiKeys: splitCsv(parsed.LEGALMIND_DASHSCOPE_API_KEYS),
  llmModel: parsed.LEGALMIND_LLM_MODEL,
  llmModelFallback: parsed.LEGALMIND_LLM_MODEL_FALLBACK,
  embeddingModel: parsed.LEGALMIND_EMBEDDING_MODEL,
  embeddingDim: parsed.LEGALMIND_EMBEDDING_DIM,
  retrievalTopK: parsed.LEGALMIND_RETRIEVAL_TOP_K,
  retrievalOverfetch: parsed.LEGALMIND_RETRIEVAL_OVERFETCH,
  rerankTopK: parsed.LEGALMIND_RERANK_TOP_K,
  enableLlmRerank: parsed.LEGALMIND_ENABLE_LLM_RERANK,
  llmRerankModel: parsed.LEGALMIND_LLM_RERANK_MODEL,
  enableHybridSearch: parsed.LEGALMIND_ENABLE_HYBRID_SEARCH,
  sparseTopK: parsed.LEGALMIND_SPARSE_TOP_K,
  rrfK: parsed.LEGALMIND_RRF_K,
  enableQueryRewrite: parsed.LEGALMIND_ENABLE_QUERY_REWRITE,
  llmRewriteModel: parsed.LEGALMIND_LLM_REWRITE_MODEL,
  defaultUserRole: parsed.LEGALMIND_DEFAULT_USER_ROLE,
} as const;
