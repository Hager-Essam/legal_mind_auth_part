# Configuration

`backend-ts/src/config/env.ts` validates the following groups at import time.

| Group | Variables / defaults |
|---|---|
| App | `LEGALMIND_NODE_ENV=development`, `APP_NAME`, `API_HOST=0.0.0.0`, `API_PORT=3000`, comma-separated `CORS_ORIGINS` |
| Auth | `JWT_SECRET` (required in production, min 32), `JWT_ACCESS_EXPIRES_IN=15m`, `REFRESH_TOKEN_DAYS=7`, `FRONTEND_URL=http://localhost:3000`, `REFRESH_COOKIE_SAME_SITE=lax` |
| Email | `EMAIL_MODE=console`, `EMAIL_FROM`, `EMAIL_HOST`, `EMAIL_PORT=587`, `EMAIL_SECURE=false`, `EMAIL_USER`, `EMAIL_PASSWORD`; SMTP fields required in smtp mode |
| Mongo | `APP_URI`, `RAG_URI`, `APP_DB=legalmind_app`, `RAG_DB=legalmind_rag`, server/connect timeout 10000, pool max 10/min 0 |
| Provider | `LLM_PROVIDER=modelstudio`, `EMBEDDING_PROVIDER=modelstudio`, `DASHSCOPE_BASE_URL`, comma-separated `DASHSCOPE_API_KEYS` |
| Models | `LLM_MODEL=qwen-plus`, `LLM_MODEL_FALLBACK=qwen-turbo`, `EMBEDDING_MODEL=text-embedding-v4`, `EMBEDDING_DIM=1024` |
| Retrieval | `RETRIEVAL_TOP_K=20`, `RETRIEVAL_OVERFETCH=20`, `RERANK_TOP_K=10`, hybrid true, `SPARSE_TOP_K=20`, `RRF_K=60` |
| Rerank/rewrite | LLM rerank true/model `qwen3-rerank`; query and LLM rewrite true/model `qwen-turbo`; default role citizen; legacy mapping false |

Each name above is prefixed `LEGALMIND_`. Hidden compatibility fallbacks use
`LEGALMIND_MONGODB_URI` for both URIs and `LEGALMIND_MONGODB_DB` for the RAG
database. Prefer the current explicit variables.

Empty CORS does not allow browser origins; list exact origins. `*` is rejected.
The development JWT fallback is unsafe for deployed environments. Provider,
Mongo, SMTP, and JWT secrets must never appear in documentation or Postman
assets. Frontend configuration is only
`VITE_LEGALMIND_API_URL=<origin>/api/v1`.
