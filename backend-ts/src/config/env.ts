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

  // Authentication
  LEGALMIND_JWT_SECRET: z.string().min(32).optional(),
  LEGALMIND_JWT_ACCESS_EXPIRES_IN: z.string().min(2).default("15m"),
  LEGALMIND_REFRESH_TOKEN_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(7),
  LEGALMIND_FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  LEGALMIND_REFRESH_COOKIE_SAME_SITE: z
    .enum(["lax", "strict", "none"])
    .default("lax"),

  // Email
  LEGALMIND_EMAIL_MODE: z.enum(["console", "smtp"]).default("console"),
  LEGALMIND_EMAIL_FROM: z.string().default(""),
  LEGALMIND_EMAIL_HOST: z.string().optional(),
  LEGALMIND_EMAIL_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  LEGALMIND_EMAIL_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  LEGALMIND_EMAIL_USER: z.string().optional(),
  LEGALMIND_EMAIL_PASSWORD: z.string().optional(),

  // Private lawyer credential uploads
  LEGALMIND_LAWYER_ID_UPLOAD_DIR: z
    .string()
    .min(1)
    .default("uploads/private/lawyer-ids"),
  LEGALMIND_LAWYER_ID_MAX_MB: z.coerce
    .number()
    .positive()
    .max(25)
    .default(5),

  // ── Database ─────────────────────────────────────────────────
  LEGALMIND_APP_URI: z
    .string()
    .min(1)
    .default(process.env.LEGALMIND_MONGODB_URI ?? "mongodb://localhost:27017"),
  LEGALMIND_RAG_URI: z
    .string()
    .min(1)
    .default(process.env.LEGALMIND_MONGODB_URI ?? "mongodb://localhost:27017"),
  LEGALMIND_APP_DB: z.string().min(1).default("legalmind_app"),
  LEGALMIND_RAG_DB: z
    .string()
    .min(1)
    .default(process.env.LEGALMIND_MONGODB_DB ?? "legalmind_rag"),
  LEGALMIND_MONGO_SERVER_SELECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000),
  LEGALMIND_MONGO_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000),
  LEGALMIND_MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(1).default(10),
  LEGALMIND_MONGO_MIN_POOL_SIZE: z.coerce.number().int().min(0).default(0),

  // ── DashScope Provider ───────────────────────────────────────
  LEGALMIND_LLM_PROVIDER: z.literal("modelstudio").default("modelstudio"),
  LEGALMIND_EMBEDDING_PROVIDER: z
    .literal("modelstudio")
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
  LEGALMIND_ENABLE_AUTHORITY_HINTS: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
}).superRefine((value, context) => {
  if (splitCsv(value.LEGALMIND_CORS_ORIGINS).includes("*")) {
    context.addIssue({
      code: "custom",
      path: ["LEGALMIND_CORS_ORIGINS"],
      message:
        "Wildcard CORS origins are not allowed because credentials are enabled.",
    });
  }

  if (value.LEGALMIND_NODE_ENV === "production" && !value.LEGALMIND_JWT_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["LEGALMIND_JWT_SECRET"],
      message:
        "LEGALMIND_JWT_SECRET (at least 32 characters) is required in production.",
    });
  }

  if (value.LEGALMIND_EMAIL_MODE === "smtp") {
    for (const key of [
      "LEGALMIND_EMAIL_FROM",
      "LEGALMIND_EMAIL_HOST",
      "LEGALMIND_EMAIL_USER",
      "LEGALMIND_EMAIL_PASSWORD",
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when LEGALMIND_EMAIL_MODE=smtp.`,
        });
      }
    }
  }
});

const parsed = envSchema.parse(process.env);

export const env = {
  // App
  nodeEnv: parsed.LEGALMIND_NODE_ENV,
  appName: parsed.LEGALMIND_APP_NAME,
  apiHost: parsed.LEGALMIND_API_HOST,
  apiPort: parsed.LEGALMIND_API_PORT,
  corsOrigins: splitCsv(parsed.LEGALMIND_CORS_ORIGINS),

  // Authentication
  jwtSecret:
    parsed.LEGALMIND_JWT_SECRET ??
    "legalmind-development-only-secret-change-before-production",
  jwtAccessExpiresIn: parsed.LEGALMIND_JWT_ACCESS_EXPIRES_IN,
  refreshTokenDays: parsed.LEGALMIND_REFRESH_TOKEN_DAYS,
  frontendUrl: parsed.LEGALMIND_FRONTEND_URL,
  refreshCookieSameSite: parsed.LEGALMIND_REFRESH_COOKIE_SAME_SITE,

  // Email
  emailMode: parsed.LEGALMIND_EMAIL_MODE,
  emailFrom: parsed.LEGALMIND_EMAIL_FROM,
  emailHost: parsed.LEGALMIND_EMAIL_HOST,
  emailPort: parsed.LEGALMIND_EMAIL_PORT,
  emailSecure: parsed.LEGALMIND_EMAIL_SECURE,
  emailUser: parsed.LEGALMIND_EMAIL_USER,
  emailPassword: parsed.LEGALMIND_EMAIL_PASSWORD,

  // Uploads
  lawyerIdUploadDir: parsed.LEGALMIND_LAWYER_ID_UPLOAD_DIR,
  lawyerIdMaxMb: parsed.LEGALMIND_LAWYER_ID_MAX_MB,

  // Database
  appMongoUri: parsed.LEGALMIND_APP_URI,
  ragMongoUri: parsed.LEGALMIND_RAG_URI,
  appMongoDb: parsed.LEGALMIND_APP_DB,
  ragMongoDb: parsed.LEGALMIND_RAG_DB,
  mongoServerSelectionTimeoutMs:
    parsed.LEGALMIND_MONGO_SERVER_SELECTION_TIMEOUT_MS,
  mongoConnectTimeoutMs: parsed.LEGALMIND_MONGO_CONNECT_TIMEOUT_MS,
  mongoMaxPoolSize: parsed.LEGALMIND_MONGO_MAX_POOL_SIZE,
  mongoMinPoolSize: parsed.LEGALMIND_MONGO_MIN_POOL_SIZE,

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
  enableAuthorityHints: parsed.LEGALMIND_ENABLE_AUTHORITY_HINTS,
} as const;

export type Env = typeof env;
