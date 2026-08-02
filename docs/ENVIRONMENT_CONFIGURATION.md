# LegalMind Environment Configuration Reference

> **Status**: Implemented
> **Source verified**: `src/config/env.ts`, `backend-ts/.env.example`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Environment Variable Master Reference Table](#2-environment-variable-master-reference-table)
- [3. Categorized Configuration Details](#3-categorized-configuration-details)
  - [3.1 Application Settings](#31-application-settings)
  - [3.2 Authentication & JWT Settings](#32-authentication--jwt-settings)
  - [3.3 Email Settings](#33-email-settings)
  - [3.5 Database Settings](#35-database-settings)
  - [3.6 DashScope Provider & Round-Robin Keys](#36-dashscope-provider--round-robin-keys)
  - [3.7 LLM Generation Settings](#37-llm-generation-settings)
  - [3.8 Embedding Settings](#38-embedding-settings)
  - [3.9 Hybrid Retrieval Settings](#39-hybrid-retrieval-settings)
  - [3.10 Reranking Settings](#310-reranking-settings)
  - [3.11 Query Rewriting Settings](#311-query-rewriting-settings)
- [4. Environment Validation & Startup Behavior](#4-environment-validation--startup-behavior)
- [5. Production Deployment Guidelines](#5-production-deployment-guidelines)
- [6. Related Documentation](#6-related-documentation)

---

## 1. Overview

LegalMind uses Zod (`src/config/env.ts`) to validate environment variables during application startup. If a required variable is missing or malformed, server initialization aborts immediately with a clear diagnostic log.

---

## 2. Environment Variable Master Reference Table

| Variable Name | Group | Required | Default Value | Secret | Used By | Development Example | Production Guidelines |
|---|---|---|---|---|---|---|---|
| `LEGALMIND_NODE_ENV` | Application | No | `development` | No | App | `development` | Set to `production` |
| `LEGALMIND_APP_NAME` | Application | No | `LegalMind API TS` | No | App | `LegalMind API TS` | Descriptive app name |
| `LEGALMIND_API_HOST` | Application | No | `0.0.0.0` | No | App | `0.0.0.0` | Bind to host or `0.0.0.0` |
| `LEGALMIND_API_PORT` | Application | No | `3000` | No | App | `3000` | Target port number |
| `LEGALMIND_CORS_ORIGINS` | Application | No | (empty string) | No | Express | `http://localhost:5173` | Comma-separated CORS origins |
| `LEGALMIND_JWT_SECRET` | Auth | **Yes (Prod)** | `dev-secret-key-change-in-prod` | **YES** | AuthService | `dev-secret-32-char-random-value` | Cryptographically random string >= 32 chars |
| `LEGALMIND_JWT_ACCESS_EXPIRES_IN` | Auth | No | `15m` | No | AuthService | `15m` | Recommended `15m` |
| `LEGALMIND_REFRESH_TOKEN_DAYS` | Auth | No | `7` | No | AuthService | `7` | Session lifetime (days) |
| `LEGALMIND_FRONTEND_URL` | Auth | No | `http://localhost:5173` | No | Auth Email | `http://localhost:5173` | Production HTTPS frontend URL |
| `LEGALMIND_REFRESH_COOKIE_SAME_SITE` | Auth | No | `lax` | No | Express | `lax` | `lax` or `strict` |
| `LEGALMIND_EMAIL_MODE` | Email | No | `console` | No | EmailService | `console` | Set to `smtp` in production |
| `LEGALMIND_EMAIL_FROM` | Email | No | `noreply@legalmind.eg` | No | EmailService | `noreply@legalmind.eg` | Verified sender address |
| `LEGALMIND_EMAIL_HOST` | Email | Conditional | (empty string) | No | EmailService | `smtp.mailtrap.io` | Production SMTP host |
| `LEGALMIND_EMAIL_PORT` | Email | No | `587` | No | EmailService | `587` | Standard SMTP port (587 / 465) |
| `LEGALMIND_EMAIL_SECURE` | Email | No | `false` | No | EmailService | `false` | `true` for port 465 |
| `LEGALMIND_EMAIL_USER` | Email | Conditional | (empty string) | **YES** | EmailService | `smtp_username` | SMTP account username |
| `LEGALMIND_EMAIL_PASSWORD` | Email | Conditional | (empty string) | **YES** | EmailService | `smtp_password` | SMTP account password |
| `LEGALMIND_APP_URI` | Database | No | `mongodb://localhost:27017` | **YES** | MongoService | `mongodb://localhost:27017` | MongoDB Atlas application URI |
| `LEGALMIND_RAG_URI` | Database | No | `mongodb://localhost:27017` | **YES** | MongoService | `mongodb://localhost:27017` | MongoDB Atlas RAG URI |
| `LEGALMIND_APP_DB` | Database | No | `legalmind_app` | No | MongoService | `legalmind_app` | Application DB name |
| `LEGALMIND_RAG_DB` | Database | No | `legalmind_rag` | No | MongoService | `legalmind_rag` | RAG DB name |
| `LEGALMIND_MONGO_CONNECT_TIMEOUT_MS` | Database | No | `10000` | No | MongoService | `10000` | Connection timeout (ms) |
| `LEGALMIND_DASHSCOPE_BASE_URL` | Provider | No | `https://dashscope.aliyuncs.com/...` | No | ProviderHttp | Compatible endpoint URL | Official DashScope endpoint |
| `LEGALMIND_DASHSCOPE_API_KEYS` | Provider | **Yes** | `your-api-key-here` | **YES** | ProviderConfig | `sk-key1,sk-key2` | Comma-separated API keys for rotation |
| `LEGALMIND_LLM_MODEL` | LLM | No | `qwen-plus` | No | Generation | `qwen-plus` | Primary LLM model |
| `LEGALMIND_LLM_MODEL_FALLBACK` | LLM | No | `qwen-turbo` | No | Generation | `qwen-turbo` | Fallback LLM model |
| `LEGALMIND_EMBEDDING_MODEL` | Embedding | No | `text-embedding-v4` | No | Embedding | `text-embedding-v4` | Embedding model name |
| `LEGALMIND_EMBEDDING_DIM` | Embedding | No | `1024` | No | Embedding | `1024` | Vector dimension (Must match Atlas Index) |
| `LEGALMIND_RETRIEVAL_TOP_K` | Retrieval | No | `20` | No | Retrieval | `20` | Candidate chunk limit |
| `LEGALMIND_ENABLE_HYBRID_SEARCH` | Hybrid | No | `true` | No | Retrieval | `true` | Enables RRF hybrid search |
| `LEGALMIND_RRF_K` | Hybrid | No | `60` | No | Retrieval | `60` | RRF constant parameter |
| `LEGALMIND_ENABLE_LLM_RERANK` | Rerank | No | `true` | No | Reranker | `true` | Set to `false` for heuristic reranker |
| `LEGALMIND_LLM_RERANK_MODEL` | Rerank | No | `qwen3-rerank` | No | Reranker | `qwen3-rerank` | Reranker model identifier |
| `LEGALMIND_ENABLE_QUERY_REWRITE` | Query | No | `true` | No | QueryRewrite | `true` | Enables LLM query expansion |

---

## 3. Categorized Configuration Details

### 3.6 DashScope Provider & Round-Robin Keys
`LEGALMIND_DASHSCOPE_API_KEYS` accepts a comma-separated string of API keys (e.g., `sk-key1,sk-key2,sk-key3`). `ProviderConfigService` automatically cycles through these keys in round-robin fashion for each outbound HTTP request to distribute quota consumption across multiple DashScope accounts.

---

## 4. Environment Validation & Startup Behavior

Environment validation occurs in `src/config/env.ts` when `createApp()` is invoked:

```ts
export const env = validateEnv();
```

If validation fails (e.g. `LEGALMIND_NODE_ENV=production` but `LEGALMIND_JWT_SECRET` is missing), the application logs the missing variable names and exits immediately with process code `1`.

---

## 5. Production Deployment Guidelines

1. **Secrets Security**: Never commit `.env` files to git repositories. Use secrets management solutions (Docker Secrets, Kubernetes Secrets, AWS Secrets Manager).
2. **CORS Origins**: Ensure `LEGALMIND_CORS_ORIGINS` explicitly lists trusted production domains (e.g. `https://legalmind.eg`).
3. **Database URIs**: Use TLS-encrypted MongoDB Atlas URIs (`mongodb+srv://...`).

---

## 6. Related Documentation

- [Backend Architecture](BACKEND_ARCHITECTURE.md) - System overview.
- [Security Architecture](SECURITY_ARCHITECTURE.md) - Secret management safety controls.
- [MongoDB Atlas Setup](MONGO_ATLAS_SETUP.md) - Database index configuration.
