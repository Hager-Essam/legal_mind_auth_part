# LegalMind AI — Project Context

## PROJECT OVERVIEW

**LegalMind** is an Arabic legal AI assistant for Egyptian law. It uses RAG (Retrieval-Augmented Generation) to answer legal questions based on Egyptian legislation, court rulings, and legal doctrine.

**Workspace:** `C:\Users\IRON LAPTOP\Desktop\Graduation Project`

**Goal:** Answer Arabic legal questions with grounded citations from Egyptian law. Never answer without retrieval-backed evidence.

---

## ARCHITECTURE

```
User Query (Arabic)
    │
    ▼
[1] ClassifierService          → regex-based intent routing
    │
    ▼
[2] QueryRewriteService        → mapping dictionary or LLM rewrite
    │
    ▼
[3] EmbeddingService           → DashScope text-embedding-v4 (1024-dim)
    │
    ▼
[4] RetrievalService           → hybrid search (vector + text) + RRF merge
    │
    ▼
[5] RerankerService            → local evidence scoring (no external API)
    │
    ▼
[6] GroundingPolicy            → refuse if evidence is weak
    │
    ▼
[7] GenerationService          → qwen-plus generates Arabic answer
    │
    ▼
Response + Source Chunks + Latency
```

---

## AI MODELS (Alibaba Cloud DashScope)

| Model | Purpose | Notes |
|-------|---------|-------|
| `text-embedding-v4` | Query & document embeddings | 1024 dimensions, 8K tokens, `input_type: "query"` |
| `qwen-plus` | Primary LLM for generation | Flagship model, temperature 0.2 |
| `qwen-turbo` | Fast/cheap LLM | Query rewrite fallback, classify fallback |
| `qwen3-rerank` | External reranker | NOT USED — local scoring used instead |

---

## DATABASE

- **MongoDB Atlas** with `egyptian_law` collection
- **Mongoose schema** at `backend-ts/src/models/chunk.model.ts`
- Fields: `text` (content), `embedding` (1024-dim float array), `is_retrievable` (boolean filter), `law_name_normalized`, `law_category`, `article_number`, etc.
- Vector search index for `$vectorSearch`
- Atlas search index for `$search` (text/BM25)

---

## PROJECT STRUCTURE

```
backend-ts/src/
├── app/
│   └── create-app.ts              # Express app setup
├── config/
│   └── env.ts                     # Environment variables (Zod validated)
├── controllers/
│   ├── health.controller.ts       # Health/readiness endpoints
│   └── query.controller.ts        # Query endpoint handler
├── errors/
│   └── http-error.ts              # Custom HTTP error class
├── middlewares/
│   └── error-handler.ts           # Express error middleware
├── models/
│   └── chunk.model.ts             # Mongoose schema for Egyptian law
├── regex/
│   ├── arabic.patterns.ts         # Tashkeel, tatweel, digit regex
│   ├── classifier.patterns.ts     # Agent intent + chat regex
│   └── legal-ref.patterns.ts      # Article, law name, appeal regex
├── routes/
│   ├── api/
│   │   └── query.ts               # POST /api/v1/query
│   └── health.ts                  # GET /health, /ready
├── schemas/
│   ├── app.schema.ts              # App info schema
│   ├── chunk.schema.ts            # LegalChunks Zod schema
│   ├── index.ts                   # Schema exports
│   └── query.schema.ts            # QueryRequest/Response schemas
├── services/
│   ├── classifier.service.ts      # Query classification
│   ├── embedding.service.ts       # DashScope embeddings
│   ├── generation.service.ts      # LLM answer generation
│   ├── legal-ref.service.ts       # Legal reference answers
│   ├── mongo.service.ts           # MongoDB connection
│   ├── provider-config.service.ts # DashScope config
│   ├── query-rewrite.service.ts   # Query enhancement
│   ├── query.service.ts           # Main RAG orchestrator
│   ├── readiness.service.ts       # Health checks
│   ├── reranker.service.ts        # Local evidence reranking
│   ├── retrieval.service.ts       # Hybrid search
│   └── service-container.ts       # Dependency injection
├── types/
│   ├── classifier.types.ts        # ClassificationResult
│   ├── grounding.types.ts         # GroundingDecision
│   ├── provider.types.ts          # ProviderSummary
│   ├── query.types.ts             # RewriteResult
│   └── search.types.ts            # SearchOptions
├── utils/
│   ├── arabic-normalize.ts        # Arabic text normalization
│   ├── context-builder.ts         # LLM context formatting
│   ├── evidence-selection.ts      # Reranking scoring logic
│   ├── grounding-policy.ts        # Evidence quality gate
│   ├── law-mapping.ts             # Colloquial → legal terms
│   ├── legal-ref-parser.ts        # Article/law name extraction
│   ├── regex.ts                   # Shared regex utilities
│   └── rrf.ts                     # Reciprocal Rank Fusion
└── index.ts                       # Server entry point
```

---

## QUERY CLASSIFICATION

The classifier at `backend-ts/src/services/classifier.service.ts` uses pure regex (no LLM, instant):

| Condition | Category | Action |
|-----------|----------|--------|
| Contains "المادة N" or law article pattern | `law_ref` | Exact article lookup |
| Contains action verbs: "قارن", "حلل", "generate", "draft", "استخرج", "لخص" | `agent` | Returns empty `{}` (not implemented) |
| Greeting: "مرحبا", "hello", "شكرا" | `chat` | Conversational answer |
| Arabic characters present | `arabic_rag` | Full RAG pipeline |
| Fallback | `general` | Full RAG pipeline |

**Important:** Classification happens BEFORE any DB/API call. Wrong classification = wrong path = bad results.

---

## QUERY FLOW DETAIL

### Stage 1: Query Rewriting (`query-rewrite.service.ts`)

```
Original: "عايز أعرف حقوقي لما صاحب الشغل يطردني"
    │
    ├─ normalizeArabicQuery()     → clean for mapping lookup only
    ├─ rewriteWithMapping()       → "شغل" → "قانون العمل رقم 12 لسنة 2003"
    │    Match found → append law name → DONE (no LLM)
    │
    └─ No match → rewriteWithLlm(ORIGINAL query) → qwen-turbo
```

- `normalizeArabicQuery()` is ONLY for mapping lookup, never sent to LLM
- `law-mapping.ts` has ~30 colloquial → legal term mappings

### Stage 2: Hybrid Search (`retrieval.service.ts`)

Two parallel searches merged with Reciprocal Rank Fusion:

**Vector Search (`$vectorSearch`):**
- Cosine similarity on 1024-dim embeddings
- Filter: `is_retrievable: true` + optional `law_category`
- `numCandidates = topK * 10`

**Text Search (`$search`):**
- Atlas compound query (BM25-like)
- `must`: `is_retrievable=true`, optional `law_category` phrase match
- `should`: `text` field (boost 1.5x) + `law_name_normalized` (boost 2.0x)

**RRF Merge (`rrf.ts`):**
- `score += 1 / (k + rank + 1)` where k=60
- Chunks in both lists get boosted naturally

### Stage 3: Reranking (`reranker.service.ts` + `evidence-selection.ts`)

Local scoring, no external API:

```
score = similarity_score × 0.45
      + overlapScore × 0.35
      + semanticUnitBoost (0.06–0.12)
      + citationBoost (0.04–0.08)
      + articleMatchBoost (0.20 if article in query)
```

- Deduplication by `chunk_id` first, fallback to first 500 chars
- Selects top-K after scoring

### Stage 4: Grounding Check (`grounding-policy.ts`)

Before LLM call, verify evidence quality:
- `chunks.length === 0` → refuse
- `topScore < 0.35` OR `citedCount === 0` → refuse with explanation
- Otherwise → proceed to generation

### Stage 5: Generation (`generation.service.ts`)

- Builds citation-prefixed context: `[المصدر: law_name - المادة N - category]\n{text}`
- System prompt: "أنت مساعد قانوني مصري. أجب فقط بناءً على النصوص المسترجعة"
- Primary: `qwen-plus`, Fallback: `qwen-turbo` on failure

---

## EXACT ARTICLE LOOKUP (`law_ref` path)

1. `legal-ref-parser.ts` extracts article number + law name via regex
2. `RetrievalService.findByArticle()` does MongoDB `findOne()` (NOT vector search)
3. Found → return exact match answer (no LLM needed)
4. Not found → fall through to RAG with prefix message

---

## KEY FILES (Read in Order)

### Configuration & Entry
| # | File | Purpose |
|---|------|---------|
| 1 | `backend-ts/src/config/env.ts` | All env vars, validated with Zod |
| 2 | `backend-ts/src/index.ts` | Server entry point |
| 3 | `backend-ts/src/app/create-app.ts` | Express middleware + routes |
| 4 | `backend-ts/src/services/service-container.ts` | Dependency injection wiring |

### Data Shape
| # | File | Purpose |
|---|------|---------|
| 5 | `backend-ts/src/models/chunk.model.ts` | MongoDB document schema |
| 6 | `backend-ts/src/schemas/query.schema.ts` | QueryRequest, QueryResponse types |

### Shared Types
| # | File | Purpose |
|---|------|---------|
| 7 | `backend-ts/src/types/search.types.ts` | SearchOptions for retrieval |
| 8 | `backend-ts/src/types/classifier.types.ts` | ClassificationResult |
| 9 | `backend-ts/src/types/grounding.types.ts` | GroundingDecision |
| 10 | `backend-ts/src/types/query.types.ts` | RewriteResult |
| 11 | `backend-ts/src/types/provider.types.ts` | ProviderSummary |

### Regex Patterns
| # | File | Purpose |
|---|------|---------|
| 12 | `backend-ts/src/regex/classifier.patterns.ts` | Agent intent + chat regex |
| 13 | `backend-ts/src/regex/legal-ref.patterns.ts` | Article, law name, appeal regex |
| 14 | `backend-ts/src/regex/arabic.patterns.ts` | Tashkeel, tatweel, digit mapping |

### RAG Pipeline
| # | File | Purpose |
|---|------|---------|
| 15 | `backend-ts/src/routes/api/query.ts` | POST /query endpoint |
| 16 | `backend-ts/src/services/classifier.service.ts` | Intent routing (regex) |
| 17 | `backend-ts/src/utils/legal-ref-parser.ts` | Article/law name extraction |
| 18 | `backend-ts/src/utils/law-mapping.ts` | Colloquial → legal term dictionary |
| 19 | `backend-ts/src/services/query-rewrite.service.ts` | Query enhancement |
| 20 | `backend-ts/src/services/embedding.service.ts` | DashScope embeddings |
| 21 | `backend-ts/src/services/retrieval.service.ts` | Hybrid vector + text search |
| 22 | `backend-ts/src/utils/rrf.ts` | Reciprocal Rank Fusion |
| 23 | `backend-ts/src/utils/evidence-selection.ts` | Local reranking logic |
| 24 | `backend-ts/src/utils/grounding-policy.ts` | Answer safety gate |
| 25 | `backend-ts/src/utils/context-builder.ts` | Format context for LLM |
| 26 | `backend-ts/src/services/generation.service.ts` | LLM answer generation |
| 27 | `backend-ts/src/services/query.service.ts` | Main orchestrator |

### Infrastructure
| # | File | Purpose |
|---|------|---------|
| 28 | `backend-ts/src/services/provider-config.service.ts` | DashScope config + API key rotation |
| 29 | `backend-ts/src/services/mongo.service.ts` | Lazy MongoDB connection |
| 30 | `backend-ts/src/middlewares/error-handler.ts` | Error handling |
| 31 | `backend-ts/src/errors/http-error.ts` | Custom error class |
| 32 | `backend-ts/src/utils/regex.ts` | Shared regex utilities |

### Reference Docs
| # | File | Purpose |
|---|------|---------|
| 33 | `backend-ts/CODEBASE_GUIDE.md` | Full codebase walkthrough |
| 34 | `backend-ts/FIXES_TODO.md` | Known bugs and fixes |
| 35 | `backend-ts/RUN_LAW_REF_FLOW.md` | Law reference flow detail |

---

## KNOWN ISSUES

1. **`agent` category is dead** — classifier detects action verbs but returns empty `{}`. No agents implemented in TS backend.
2. **Reranker is local only** — `qwen3-rerank` from DashScope is not used. Scoring is formula-based.
3. **`law_category` filter** — Previously broken (used `equals` instead of `phrase` in Atlas). Verify before using.
4. **No auth** — JWT planned but not built. No user isolation.
5. **No caching** — Every query hits DB + LLM. No result caching.
6. **Single endpoint** — Only `POST /api/v1/query` exists. No document upload, no agent endpoints.

---

## ENVIRONMENT VARIABLES

```bash
# Required
MONGODB_URI=mongodb+srv://...
MONGODB_DB=legalmind
DASHSCOPE_API_KEY=sk-...

# Optional (have defaults)
LLM_MODEL=qwen-plus
LLM_MODEL_FALLBACK=qwen-turbo
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIM=1024
RERANK_TOP_K=10
ENABLE_HYBRID_SEARCH=true
ENABLE_QUERY_REWRITE=true
```

---

## COST

| Operation | Cost |
|-----------|------|
| Embed 19K chunks (one-time) | ~$0.27 |
| Per query (embed + rerank + LLM) | ~$0.02 |
| 100 queries | ~$2.50 |

---

## DATA

- **19,120 Egyptian law chunks** in `data/processed/legal_chunks.parquet`
- Article-level chunking with metadata: law_name, law_category, article_number, hierarchy
- MongoDB collection: `egyptian_law`
- Embedding text is enriched (not raw article text)
