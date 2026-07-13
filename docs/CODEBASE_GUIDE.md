# LegalMind Backend-TS — Codebase Reading Guide

A complete walkthrough of the codebase and the RAG pipeline from A to Z.
Read the files in the order listed in each section.

---

## Part 1 — Start Here: Configuration & Startup

Before touching any service, understand what the server needs to run.

### Step 1 — `src/config/env.ts`
**Read this first.** Every environment variable the server uses is defined, validated, and exported here using Zod. If a required variable is missing or wrong, the process crashes immediately on startup — this is intentional.

Key groups to notice:
- `mongodbUri / mongodbDb` — where the Egyptian law collection lives
- `dashscopeApiKeys` — comma-separated list, supports multiple keys for rotation
- `llmModel / llmModelFallback` — primary and fallback Qwen models
- `embeddingModel / embeddingDim` — `text-embedding-v4` at 1024 dimensions
- `enableHybridSearch / enableQueryRewrite / enableLlmRewrite` — feature flags that control which parts of the RAG pipeline run

### Step 2 — `src/index.ts`
The entry point. Three things happen:
1. `createServices()` — instantiates every class in the right order
2. `mongoService.connect()` — warm-up connection (failure is a warning, not a crash)
3. `createApp(services)` — mounts routes, starts listening

### Step 3 — `src/Services/service-container.ts`
The dependency injection wiring. Every service is a plain class. This file shows exactly which services depend on which others. Read it like a diagram:

```
ProviderConfigService       (no deps — reads from env)
    ↓
EmbeddingService            (needs ProviderConfigService)
MongoService                (no deps — reads from env)
    ↓
RetrievalService            (needs EmbeddingService + MongoService)
RerankerService             (no deps)
GenerationService           (needs ProviderConfigService)
ClassifierService           (no deps)
LegalRefService             (no deps)
QueryRewriteService         (needs ProviderConfigService)
    ↓
QueryService                (needs ALL of the above)
```

### Step 4 — `src/app/create-app.ts`
Registers the Express middleware stack and mounts routes:
- `GET /health` — is the DB reachable?
- `GET /ready` — are both DB and API key configured?
- `POST /api/v1/query` — the only real endpoint, the entire RAG system lives here

---

## Part 2 — The Data Shape

Before reading any service, understand what a document looks like in MongoDB and how it travels through the pipeline.

### Step 5 — `src/models/chunk.model.ts`
The Mongoose schema for the `egyptian_law` collection. This is the **raw DB shape**. Key facts:
- Every field is **top-level** — there is no nested `metadata` object in the DB
- `text` is the real content field (not `content`)
- `embedding` is a 1024-dimensional float array
- `is_retrievable: boolean` gates which chunks are surfaced
- `embedding_text` is the enriched text that was actually passed to the embedding model during indexing

### Step 6 — `src/Schemas/domain.ts`
The **internal pipeline shape** and **API contracts**.

**`QueryRequest`** — what the API accepts from the client:
- `query: string` — the user's question (3–2000 chars)
- `top_k: number` — how many source chunks to return
- `law_category: string` — (optional) filters retrieval to a specific law category
- `language: "ar" | "en" | "auto"`
- `user_role: "lawyer" | "citizen"`

**`DocumentChunk`** — the shape the pipeline operates on:
```typescript
{
  chunk_id: string,
  content: string,         // from DB "text" field
  article_number?: string,
  source_file: string,
  metadata: ChunkMetadata  // typed — not Record<string, unknown>
}
```

**`ChunkMetadata`** — the typed metadata object built in `toDocumentChunk()`:
```typescript
{
  law_name_normalized: string,  // consistent hamza/ya normalisation
  law_category: string,
  source_dataset: string,
  semantic_unit: string,        // "obligation" | "right" | "penalty" | "definition"
  similarity_score?: number,    // from vector/text search
  rerank_score?: number,        // from evidence-selection scoring
  evidence_rank?: number,       // final rank after reranking
  rrf_score?: number,           // from reciprocal rank fusion
  // ...more fields (see domain.ts for full schema)
}
```

After retrieval, `ChunkDocument` (DB shape) is converted into `DocumentChunk` (pipeline shape). `RetrievalService.toDocumentChunk()` and `LegalRefService.toDocumentChunk()` are the only two places this mapping happens. All downstream code reads from `chunk.metadata.XXX` using the typed `ChunkMetadata` schema — full TypeScript safety on every field.

---

## Part 3 — The Request Enters the System

### Step 7 — `src/routes/api/query.ts`
One `POST /query` handler. Two things happen:
1. `queryRequestSchema.safeParse(req.body)` — Zod validates and coerces the input (e.g., applies defaults for `top_k`, `language`). If invalid, returns HTTP 400.
2. `services.queryService.runQuery(parsed.data)` — hands off to the RAG pipeline.

### Step 8 — `src/middleware/error-handler.ts`
Any unhandled error thrown inside `runQuery` propagates up here. Three error types are handled: `SyntaxError` (bad JSON), `ZodError` (validation), `HttpError` (explicit app errors). Everything else becomes a 500.

---

## Part 4 — The RAG Pipeline (Core Flow)

This is the heart of the system. `QueryService.runQuery()` is the orchestrator.

### Step 9 — `src/Services/query.service.ts`

`runQuery()` first classifies the query, then routes to one of four paths:

```
runQuery(request)
    │
    ▼
ClassifierService.classify()
    │
    ├─ "law_ref"    → runLawRefQuery()     exact article lookup
    ├─ "agent"      → return empty {}      not implemented yet
    ├─ "chat"       → runChatQuery()       conversational answer
    ├─ "general"    → runGeneralQuery()    non-Arabic / general
    └─ "arabic_rag" → runArabicRagQuery()  full RAG pipeline ← most important
```

### Step 10 — `src/Services/classifier.service.ts`

Classifies using pure regex — no LLM involved, so it's instant.

| Condition checked | Category returned |
|---|---|
| Query contains "المادة 5" or "مادة 3" (article number pattern) | `law_ref` |
| Query contains action verbs: "قارن", "حلل", "generate", "draft" | `agent` |
| Query is a greeting: "مرحبا", "hello", "شكرا" | `chat` |
| Language is `en` and no Arabic characters | `general` |
| Query contains any Arabic characters | `arabic_rag` |
| Fallback | `general` |

**Important:** The classifier runs BEFORE any DB call or API call. A badly classified query means the wrong path runs and retrieval is skipped entirely.

---

## Path A — `law_ref`: Exact Article Lookup

### Step 11 — `QueryService.runLawRefQuery()` → `LegalRefService` → `RetrievalService.findByArticle()`

Flow:
```
"ما هو حكم المادة 5 من قانون العمل؟"
    │
    ▼
LegalRefService.parse()
    │  uses legal-ref-parser.ts regex
    │  → articleNumber: "5"
    │  → lawName: "قانون العمل"
    │
    ▼
RetrievalService.findByArticle("5", "قانون العمل")
    │  Regular MongoDB findOne() — NOT Atlas Search
    │  1. Try exact regex: ^قانون العمل$
    │  2. Fallback: partial word match regex
    │
    ├─ Found → build exact match answer, return immediately (no LLM)
    └─ Not found → fall through to runArabicRagQuery() with a prefix message
```

### `src/Utils/legal-ref-parser.ts`
Two regex patterns:
- `ARTICLE_REFERENCE_RE` — extracts numbers after "المادة"/"مادة"/"article"
- `LAW_NAME_RE` — extracts law names after "من"/"في" followed by "قانون/لائحة/قرار"

**Limitation:** Only catches explicit patterns. "المادة 5 العمل" (no "من قانون") → `lawName` is null, search falls back to article number only.

---

## Path B — `arabic_rag`: Full RAG Pipeline

This is the main path for 90% of real queries. Five sequential stages.

### Stage 1 — Query Rewriting

### Step 12 — `src/Services/query-rewrite.service.ts`

```
Original query: "عايز أعرف حقوقي لما صاحب الشغل يطردني"
    │
    ▼
normalizeArabicQuery()          → clean hamza/ya/tashkeel for mapping lookup
    │
    ▼
rewriteWithMapping()            → check against law-mapping.ts dictionary
    │  "شغل" → "قانون العمل رقم 12 لسنة 2003"
    │  Match found → append law name to query → DONE (no LLM needed)
    │
    └─ No match → rewriteWithLlm(ORIGINAL query)
                   → sends to qwen-turbo (fast cheap model)
                   → gets back a formal legal Arabic rewrite
```

**Important:** `normalizeArabicQuery()` is used **only** for the mapping dictionary lookup. The **original query** (not normalized) is sent to the LLM for rewriting. Normalizing garbles hamza/ya forms, which would lower rewrite quality.

### `src/Utils/arabic-normalize.ts`
Normalizes Arabic text: removes tashkeel (diacritics), tatweel (stretching), converts all hamza forms to bare alef, ya forms to ya, converts Arabic-Indic digits to Western digits. **Used only for mapping lookup — NOT sent to the LLM.**

### `src/Utils/law-mapping.ts`
A static dictionary of ~30 common colloquial Egyptian legal terms mapped to their official law names. Sorted longest-key-first so "شركة مساهمة" matches before "شركة". When matched, the official law name is **appended** to the query (not replaced), so both the original phrasing and the precise legal reference go into retrieval.

---

### Stage 2 — Retrieval (Hybrid Search)

### Step 13 — `src/Services/retrieval.service.ts` — `retrieveCandidateChunks()`

```
rewrittenQuery
    │
    ├─ EmbeddingService.embedQuery()    → 1024-dim float vector via DashScope
    │
    ├─ (parallel)
    │   ├─ vectorSearch()               → MongoDB $vectorSearch (semantic)
    │   └─ textSearch()                 → Atlas $search (keyword)
    │
    └─ reciprocalRankFusion()           → merge two ranked lists into one
```

**`vectorSearch()`**
Uses `$vectorSearch` pipeline stage. The filter runs **inside** the vector index:
```
filter = { is_retrievable: { $eq: true } }
+ optionally: { law_category: { $eq: "..." } }
```
If `lawCategory` is provided in the query, it is added as a pre-filter **inside** `$vectorSearch` so `numCandidates` is not wasted on irrelevant documents.

`numCandidates = topK * 10` — Atlas scans this many approximate neighbours, then returns the closest `topK`. Higher `numCandidates` = better recall but slower.

Returns `vectorSearchScore` (cosine similarity, 0–1).

**`textSearch()`**
Uses Atlas `$search` with a `compound` query:
- `must`:
  - `is_retrievable = true`
  - optionally `law_category` **phrase** match (not `equals` — `equals` only works on boolean/number/date in Atlas)
- `should` (any one must match):
  - `text` on `text` field — boost 1.5 (main content)
  - `text` on `law_name_normalized` — boost 2.0 (law name match scores higher)

Returns Atlas `searchScore` (BM25-like, not normalized).

**`src/Utils/rrf.ts` — Reciprocal Rank Fusion**
Merges the two ranked lists. For each chunk at rank `r` in a list: `score += 1 / (k + r + 1)` where `k=60`. Chunks appearing in both lists get scores from both contributions and naturally float to the top. This is why hybrid search outperforms either method alone.

### `src/Services/embedding.service.ts`
Calls DashScope `/embeddings` with:
- `input_type: "query"` — top-level field, tells the model this is a query (not a document), shifting the embedding into the query-optimized part of the space
- `encoding_format: "float"` — raw floats, not base64
- Validates that the returned vector count matches the input count

---

### Stage 3 — Reranking

### Step 14 — `src/Services/reranker.service.ts` → `src/Utils/evidence-selection.ts`

No external API call here — this is a local scoring function.

```
candidateChunks (many, e.g. 60)
    │
    ▼
deduplicateEvidence()       → remove near-duplicates by chunk_id first,
    │                              fallback to first 500 chars of normalized content
    │
    ▼
scoreEvidenceChunk()        → compute composite score for each chunk
    │
    │  score = similarity_score  × 0.45   (from vector/text search)
    │         + overlapScore      × 0.35   (query token overlap with chunk text)
    │         + semanticUnitBoost          (0.06–0.12 based on obligation/penalty/right/definition)
    │         + citationBoost              (0.04–0.08 for having law_name + article_number)
    │         + articleMatchBoost          (0.20 if article number appears in question)
    │
    ▼
sort descending → selectTopEvidence(topK)
    │
    ▼
add evidence_rank: 1, 2, 3... to metadata
```

**`src/Utils/evidence-selection.ts`** contains all scoring logic. The weights (0.45 / 0.35) reflect that vector similarity is the most reliable signal, but exact token overlap provides a strong secondary confirmation for legal text where specific terms matter.

**Note on deduplication:** `chunk_id` is used as the primary deduplication key. Only if `chunk_id` is empty does the system fall back to the first 500 characters of normalized content. This prevents two genuinely distinct chunks that happen to share a common header from being treated as duplicates.

---

### Stage 4 — Grounding Check

### Step 15 — `src/Utils/grounding-policy.ts` — `evaluateGrounding()`

Before calling the LLM, the system checks if the retrieved evidence is good enough to generate a trustworthy answer:

```
if chunks.length === 0 → refuse (no evidence at all)

topScore = max(rerank_score across all chunks)
citedCount = count of chunks that have law_name_normalized

if topScore < 0.35 OR citedCount === 0 → refuse with explanation
else → proceed to generation
```

This gate exists because the LLM will hallucinate if given weak evidence. A refusal with "الأدلة غير كافية" is better than a confident wrong answer. The threshold of `0.35` was chosen because anything lower means the retrieved chunks barely overlap with the question.

---

### Stage 5 — Generation

### Step 16 — `src/Services/generation.service.ts` — `generateGroundedArabicAnswer()`

```
sourceChunks
    │
    ▼
buildArabicLegalContext()       → format chunks into citation-prefixed text blocks
    │  "[المصدر: قانون العمل - المادة 5 - النقض]\nنص المادة..."
    │  chunks joined with "---" separator
    │
    ▼
generateChatCompletion(primaryModel, { question, context, evidenceCount })
    │
    │  messages:
    │    system: "أنت مساعد قانوني مصري. أجب فقط بناءً على النصوص المسترجعة..."
    │    user:   "السياق القانوني:\n{context}\n\nالسؤال: {question}\n\nعدد الأدلة: {N}"
    │
    ├─ Success → return answer string
    └─ Failure → retry with fallbackModel (qwen-turbo instead of qwen-plus)
```

### `src/Utils/context-builder.ts`
Builds the citation string for each chunk:
```
[المصدر: {law_name_normalized}{articlePart}{law_category}{source_dataset}]
{chunk.content}
```
`articlePart` includes the article number only if present. If empty, it is silently omitted — many النقض court rulings have no article number and the citation avoids showing a confusing label.

---

## Part 5 — Supporting Infrastructure

### `src/Utils/grounding-policy.ts`
Already covered in Stage 4.

### `src/Utils/http-error.ts`
Simple class: `new HttpError(404, "message", optionalDetails)`. Thrown anywhere in the pipeline, caught by `error-handler.ts`.

### `src/Services/provider-config.service.ts`
Central place for all DashScope configuration. `getDashScopeApiKey()` uses a round-robin counter so multiple API keys are rotated per request, distributing rate-limit load.

### `src/Services/mongo.service.ts`
Lazy connection — only connects when first needed. Idempotent: calling `connect()` multiple times is safe. Used at startup for warm-up, and called at the start of every retrieval method.

---

## Part 6 — Complete Flow Diagram

```
POST /api/v1/query
{ query: "ما هي حقوق العامل عند الفصل؟", law_category: "..." }
    │
    ▼
[routes/api/query.ts]
Zod validation → parsed QueryRequest
    │
    ▼
[QueryService.runQuery()]
    │
    ▼
[ClassifierService.classify()]
"arabic_rag"
    │
    ▼
[QueryRewriteService.rewrite()]
    ├─ normalizeArabicQuery()
    ├─ rewriteWithMapping() → "عمل" → appends "قانون العمل رقم 12 لسنة 2003"
    └─ or rewriteWithLlm(ORIGINAL query)  → sends to qwen-turbo
    │
    ▼
rewrittenQuery
    │
    ▼
[RetrievalService.retrieveCandidateChunks()]
    │
    ├─ EmbeddingService.embedQuery(rewrittenQuery)
    │       → DashScope /embeddings  (input_type: "query")
    │       → float[1024]
    │
    ├─ (parallel)
    │   ├─ vectorSearch(vector, { lawCategory })
    │   │       → $vectorSearch  (cosine, filter: is_retrievable + law_category)
    │   │       → top-N chunks with vectorSearchScore
    │   │
    │   └─ textSearch(rewrittenQuery, { lawCategory })
    │           → $search compound
    │               must:   is_retrievable=true, law_category phrase
    │               should: text(1.5x) + law_name_normalized(2.0x)
    │           → top-N chunks with searchScore
    │
    └─ reciprocalRankFusion([vectorResults, keywordResults])
           → merged list, both-list chunks ranked higher
    │
    ▼
candidateChunks (DocumentChunk[])
    │
    ▼
[RerankerService.rerank()]
    ├─ deduplicateEvidence()   → remove duplicates by chunk_id
    ├─ scoreEvidenceChunk()    → similarity(0.45) + overlap(0.35) + boosts
    └─ selectTopEvidence(topK) → final ranked list
    │
    ▼
sourceChunks
    │
    ▼
[evaluateGrounding()]
    ├─ topScore < 0.35 → REFUSE (return message, no LLM call)
    └─ ok → continue
    │
    ▼
[buildArabicLegalContext()]
"[المصدر: ...]\nنص المادة...\n\n---\n\n[المصدر: ...]\n..."
    │
    ▼
[GenerationService.generateGroundedArabicAnswer()]
    ├─ system: legal assistant rules
    ├─ user:   context + question + evidence count
    ├─ primary model (qwen-plus, temperature 0.2)
    └─ fallback model (qwen-turbo) if primary fails
    │
    ▼
QueryResponse {
  answer: string,
  source_chunks: DocumentChunk[],
  llm_provider_used: string,
  category: "arabic_rag",
  latency_ms: number
}
```

---

## Part 7 — Reading Order Summary

Start here if you want to understand the system in 30 minutes:

| Order | File | Why |
|---|---|---|
| 1 | `src/config/env.ts` | All configuration in one place |
| 2 | `src/models/chunk.model.ts` | What a DB document looks like |
| 3 | `src/Schemas/domain.ts` | What the pipeline operates on |
| 4 | `src/Services/service-container.ts` | How all services connect |
| 5 | `src/index.ts` + `src/app/create-app.ts` | Server startup |
| 6 | `src/routes/api/query.ts` | Entry point for a query |
| 7 | `src/Services/classifier.service.ts` | Intent routing |
| 8 | `src/Utils/legal-ref-parser.ts` | Article/law name extraction |
| 9 | `src/Utils/law-mapping.ts` | Colloquial → legal term mapping |
| 10 | `src/Services/query-rewrite.service.ts` | Query enhancement |
| 11 | `src/Services/embedding.service.ts` | Query → vector |
| 12 | `src/Services/retrieval.service.ts` | Vector + keyword search |
| 13 | `src/Utils/rrf.ts` | Hybrid merge |
| 14 | `src/Utils/evidence-selection.ts` | Local reranking |
| 15 | `src/Utils/grounding-policy.ts` | Answer safety gate |
| 16 | `src/Utils/context-builder.ts` | Format context for LLM |
| 17 | `src/Services/generation.service.ts` | LLM answer generation |
| 18 | `src/Services/query.service.ts` | The full orchestrator |
| 19 | `src/middleware/error-handler.ts` | Error handling |
