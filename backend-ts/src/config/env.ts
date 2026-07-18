import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const splitCsv = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const envSchema = z.object({
  // ── App ──────────────────────────────────────────────────────
  LEGALMIND_NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  LEGALMIND_APP_NAME: z.string().default("LegalMind API TS"),
  LEGALMIND_API_HOST: z.string().default("0.0.0.0"),
  LEGALMIND_API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LEGALMIND_CORS_ORIGINS: z.string().optional(),

  // ── Database ─────────────────────────────────────────────────
  LEGALMIND_MONGODB_URI: z.string().default("mongodb://localhost:27017"),
  LEGALMIND_MONGODB_DB: z.string().default("legalmind"),

  // ── DashScope Provider ───────────────────────────────────────
  LEGALMIND_LLM_PROVIDER: z
    .enum(["modelstudio", "ollama", "hfspaces"])
    .default("modelstudio"),
  LEGALMIND_EMBEDDING_PROVIDER: z
    .enum(["modelstudio", "ollama"])
    .default("modelstudio"),
  LEGALMIND_DASHSCOPE_BASE_URL: z
    .string()
    .url()
    .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
  LEGALMIND_DASHSCOPE_API_KEYS: z.string().optional(),

  // ── LLM ──────────────────────────────────────────────────────
  LEGALMIND_LLM_MODEL: z.string().default("qwen-plus"),
  LEGALMIND_LLM_MODEL_FALLBACK: z.string().default("qwen-turbo"),

  // ── Embedding ────────────────────────────────────────────────
  LEGALMIND_EMBEDDING_MODEL: z.string().default("text-embedding-v4"),
  LEGALMIND_EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),

  // ── Retrieval ────────────────────────────────────────────────
  LEGALMIND_RETRIEVAL_TOP_K: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  LEGALMIND_RETRIEVAL_OVERFETCH: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  LEGALMIND_RERANK_TOP_K: z.coerce.number().int().min(1).max(100).default(10),

  // ── Hybrid Search ────────────────────────────────────────────
  LEGALMIND_ENABLE_HYBRID_SEARCH: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true")
    .default(true),
  LEGALMIND_SPARSE_TOP_K: z.coerce.number().int().min(1).max(100).default(20),
  LEGALMIND_RRF_K: z.coerce.number().int().min(1).default(60),

  // ── Reranking ──────────────────────────────────────────────────
  LEGALMIND_ENABLE_LLM_RERANK: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true")
    .default(true),
  LEGALMIND_LLM_RERANK_MODEL: z.string().default("qwen3-rerank"),

  // ── Query Rewriting ──────────────────────────────────────────
  LEGALMIND_ENABLE_QUERY_REWRITE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true")
    .default(true),
  LEGALMIND_ENABLE_LLM_REWRITE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === "true")
    .default(true),
  LEGALMIND_LLM_REWRITE_MODEL: z.string().default("qwen-turbo"),
  LEGALMIND_DEFAULT_USER_ROLE: z.enum(["lawyer", "citizen"]).default("citizen"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  // App
  nodeEnv: parsed.LEGALMIND_NODE_ENV,
  appName: parsed.LEGALMIND_APP_NAME,
  apiHost: parsed.LEGALMIND_API_HOST,
  apiPort: parsed.LEGALMIND_API_PORT,
  corsOrigins: splitCsv(parsed.LEGALMIND_CORS_ORIGINS),

  // Database
  mongodbUri: parsed.LEGALMIND_MONGODB_URI,
  mongodbDb: parsed.LEGALMIND_MONGODB_DB,

  // DashScope
  llmProvider: parsed.LEGALMIND_LLM_PROVIDER,
  embeddingProvider: parsed.LEGALMIND_EMBEDDING_PROVIDER,
  dashscopeBaseUrl: parsed.LEGALMIND_DASHSCOPE_BASE_URL,
  dashscopeCompatUrl: parsed.LEGALMIND_DASHSCOPE_BASE_URL,  // Already in compatible-mode format
  dashscopeApiKeys: splitCsv(parsed.LEGALMIND_DASHSCOPE_API_KEYS),

  // LLM
  llmModel: parsed.LEGALMIND_LLM_MODEL,
  llmModelFallback: parsed.LEGALMIND_LLM_MODEL_FALLBACK,

  // Embedding
  embeddingModel: parsed.LEGALMIND_EMBEDDING_MODEL,
  embeddingDim: parsed.LEGALMIND_EMBEDDING_DIM,

  // Retrieval
  retrievalTopK: parsed.LEGALMIND_RETRIEVAL_TOP_K,
  retrievalOverfetch: parsed.LEGALMIND_RETRIEVAL_OVERFETCH,
  rerankTopK: parsed.LEGALMIND_RERANK_TOP_K,
  enableLlmRerank: parsed.LEGALMIND_ENABLE_LLM_RERANK,
  llmRerankModel: parsed.LEGALMIND_LLM_RERANK_MODEL,

  // Hybrid Search
  enableHybridSearch: parsed.LEGALMIND_ENABLE_HYBRID_SEARCH,
  sparseTopK: parsed.LEGALMIND_SPARSE_TOP_K,
  rrfK: parsed.LEGALMIND_RRF_K,

  // Query Rewriting
  enableQueryRewrite: parsed.LEGALMIND_ENABLE_QUERY_REWRITE,
  enableLlmRewrite: parsed.LEGALMIND_ENABLE_LLM_REWRITE,
  llmRewriteModel: parsed.LEGALMIND_LLM_REWRITE_MODEL,
  defaultUserRole: parsed.LEGALMIND_DEFAULT_USER_ROLE,
} as const;

export type Env = typeof env;
