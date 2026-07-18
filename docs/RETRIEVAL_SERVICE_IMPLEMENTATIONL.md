# RetrievalService — Implementation Details

---

## Overview: All Functions at a Glance

| Function | Type | Purpose |
|---|---|---|
| `retrieveCandidateChunks` | public | Main entry point — runs hybrid search and returns merged candidates |
| `findByArticle` | public | Exact DB lookup for a specific law article by number + law name |
| `findByAppeal` | public | Exact DB lookup for a court ruling by appeal number |
| `vectorSearch` | public | Dense (semantic) search using MongoDB Atlas vector index |
| `textSearch` | public | Sparse (keyword) search using MongoDB Atlas full-text index |
| `expandWithParentContext` | public | Swaps child chunk content with the full parent article text |
| `extractContextWindow` | private (module) | Extracts a centred slice of parent text around the child's position |

---

## Full Pipeline Flow

```
QueryService.runQuery()
        │
        ├─ category = "chat"     → GenerationService only (no retrieval)
        │
        ├─ category = "law_ref"  → findByArticle / findByAppeal (exact DB lookup)
        │                          if not found → falls through to arabic_rag path
        │
        └─ category = "arabic_rag"
                │
                ▼
        QueryRewriteService.rewrite()          (transform colloquial → formal)
                │
                ▼
        retrieveCandidateChunks()              ← THIS FILE
                │
                ├── vectorSearch()             (semantic / dense pass)
                ├── textSearch()               (keyword / sparse pass, hybrid only)
                └── reciprocalRankFusion()     (merge both ranked lists)
                │
                ▼
        RerankerService.rerank()               (pick top-K from candidates)
                │
                ▼
        expandWithParentContext()              ← THIS FILE
                │
                ▼
        buildArabicLegalContext()              (format chunks for LLM prompt)
                │
                ▼
        GenerationService.generateGroundedArabicAnswer()
                │
                ▼
        QueryResponse → Frontend
```

---

## `retrieveCandidateChunks(request, parsedRef?)`

**The main entry point.** Decides between vector-only and hybrid search, runs the
appropriate search(es), merges results, and returns candidate chunks for reranking.

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `request` | `QueryRequest` | The full query request (query text, top_k, user_role, law_category, …) |
| `parsedRef` | `ParsedLegalReference?` | Optional pre-parsed legal reference (article number, law number, etc.) — avoids parsing the query twice |

### Step-by-step

**Step 1 — Parse the legal reference (if not already done)**
```ts
const ref = parsedRef ?? parseLegalReference(request.query);
```
Extracts structured filters from the query text: law number, law year, appeal number,
judicial year. These become MongoDB filter conditions narrowing the search space.

**Step 2 — Embed the query**
```ts
const queryVector = await this.embeddingService.embedQuery(request.query);
```
Calls DashScope to convert the (already rewritten) query string into a
`number[]` of `embeddingDim` floats (default: 1024). This is the "semantic fingerprint"
of the query — similar legal concepts produce vectors that are close in space.

**Step 3 — Compute overfetch count**
```ts
const overfetch = Math.max(env.retrievalOverfetch, request.top_k * 3);
```
Both searches return more documents than the final answer needs. This is intentional —
the reranker needs a large candidate pool to pick the best `top_k` from.
`Math.max` ensures overfetch is at least the env floor value, even for small `top_k`.

**Step 4a — Vector-only mode (hybrid disabled)**
```ts
if (!env.enableHybridSearch) {
  return (await this.vectorSearch(queryVector, opts)).map((d) => toLegalChunk(d, d.score));
}
```
If hybrid search is turned off in env, run only the vector search and return immediately.

**Step 4b — Hybrid mode (both searches in parallel)**
```ts
const [vectorDocs, keywordDocs] = await Promise.all([
  this.vectorSearch(queryVector, opts),
  this.textSearch(request.query, opts).catch(() => []),
]);
```
Both searches run at the same time using `Promise.all`. The `textSearch` call is wrapped
in `.catch(() => [])` — if the Atlas full-text index is missing or misconfigured,
text search returns an empty array and the system silently falls back to vector-only.
This makes the text search index optional for development environments.

**Step 5 — Merge with RRF**
```ts
return reciprocalRankFusion([vectorResults, keywordResults], env.rrfK);
```
Combines both ranked lists into a single ranked list. See the RRF section below.

---

## `findByArticle(parsedRef?)`

**Exact lookup for a specific law article.** Used when the user explicitly asks for
"المادة X من قانون Y". Returns the full article text with its child fragments attached.

### Why not use search here?

Search is probabilistic — it returns the _most relevant_ documents but might miss the
exact article. An exact DB query is deterministic and immediate. For "what does Article
109 say?", the exact text is what matters, not a semantically similar article.

### Algorithm

```
parsedRef.articleNumber  ─┐
parsedRef.lawName        ─┤── both required (missing either → return null)
                           │
                           ▼
normalizeLawName(lawName) → "قانون العمل رقم 12 لسنه 2003"
    │
    ▼
Split into words: ["قانون", "العمل", "رقم", "12", "لسنه", "2003"]
    │
    ▼
Build regex: "قانون.*العمل.*رقم.*12.*لسنه.*2003"
    │
    ▼
MongoDB query:
  {
    article_number: 109,
    law_name_normalized: { $regex: "قانون.*العمل...", $options: "i" },
    child_index: { $in: [-1, null] },   ← PARENTS ONLY
    // bonus: law_number, law_year if available
  }
    │
    ▼
Sort by text_len descending → take the longest (= fullest) parent
    │
    ▼
Fetch children: { parent_chunk_id: parent.chunk_id, child_index: { $gte: 0 } }
    │
    ▼
Return { ...parent, _children: children }
```

### Key design decisions

**Why regex on `law_name_normalized`?**
The user might type "قانون العمل المصري" but the DB stores "قانون العمل رقم 12 لسنة 2003".
A regex with `.*` between words handles this mismatch. `law_name_normalized` is already
orthographically cleaned at ingestion (ة→ه, ى→ي, etc.).

**Why sort by `text_len` descending?**
The same article can exist as multiple chunks in the DB — the original parent (full text)
and split children (fragments). `child_index: { $in: [-1, null] }` already filters to
parents only, but taking the longest ensures we get the most complete version.

**Why is `is_retrievable` NOT filtered?**
Restored split parents (the parents of split articles) have `is_retrievable: false`
because they should not appear in normal search results (they're duplicates). But for
exact lookup, we explicitly want the parent — it holds the full article text.
Filtering `is_retrievable: true` would exclude these parents and break every split article.

**Why attach children?**
The parent (`_children: [...]`) gives the LLM the full article. The children give
the response precise fragment-level citations (`source_chunks` in the API response).

---

## `findByAppeal(appealNumber, judicialYear?)`

**Exact lookup for a court ruling by appeal number.** Used when the user asks about
a specific ruling like "الطعن رقم 1234 لسنة 2020".

### How it differs from `findByArticle`

| | `findByArticle` | `findByAppeal` |
|---|---|---|
| Unique key | `article_number` + `law_name` (regex) | `appeal_number` + optional `judicial_year` |
| Normalization needed? | Yes (law name has variants) | No (numbers are normalized at ingestion) |
| Regex needed? | Yes | No — exact number match |

### Algorithm

```ts
const filter = {
  appeal_number: appealNumber,         // exact match
  child_index: { $in: [-1, null] },    // parents only
};
if (judicialYear) filter.judicial_year = judicialYear;

const parent = await ChunkModel.findOne(filter).sort({ text_len: -1 }).lean();
```

Same parent/child pattern as `findByArticle`: fetch the longest parent, then
attach its children as fragment-level citations.

Appeal numbers are stored as strings and are already normalized (digits only,
no diacritics) at ingestion time, so no regex or normalization is needed here.

---

## `vectorSearch(queryVector, options)`

**Semantic (dense) search** using a MongoDB Atlas vector index.

### What "semantic" means

The query `"حقوقي في فترة التجربة"` (what are my rights during probation) has **no
exact words** in common with `"يجوز للعامل خلال مدة التجربة..."` (the worker may during
the probation period...) — but they are semantically related. The embedding model
converts both into vectors that are close in 1024-dimensional space. Vector search
finds this closeness; keyword search would miss it entirely.

### How it works

**Step 1 — Guard**
```ts
if (queryVector.length === 0) return [];
```
If the embedding service failed and returned an empty array, abort immediately.
Passing an empty vector to `$vectorSearch` would throw or return garbage results.

**Step 2 — Build filter**
```ts
const filter: Record<string, unknown> = { is_retrievable: { $eq: true } };
if (options.lawCategory) filter.law_category = { $eq: options.lawCategory };
// ...
```
Filters are applied **inside** the vector search — only documents matching these
conditions enter the HNSW graph. This dramatically reduces the search space.
All filter fields use `$eq` (not `$regex`) because the vector index requires
exact-match operators on token fields.

**Step 3 — `$vectorSearch` stage**
```ts
{
  $vectorSearch: {
    index: "vector_index",
    path: "embedding",
    queryVector,
    numCandidates: Math.max(topK * 10, 50),
    limit: topK,
    filter,
  }
}
```

| Parameter | Value | Why |
|---|---|---|
| `index` | `"vector_index"` | Name of the Atlas HNSW index |
| `path` | `"embedding"` | The field containing the 1024-float vector |
| `queryVector` | `number[]` | The query's own embedding |
| `numCandidates` | `max(topK×10, 50)` | HNSW exploration breadth — higher = better recall, slower |
| `limit` | `topK` | Documents returned after ranking the candidates |
| `filter` | `{...}` | Pre-filter applied before HNSW traversal |

**HNSW in one sentence:** Instead of comparing the query vector against every document,
HNSW builds a graph of vector clusters and navigates toward closer clusters greedily.
`numCandidates` controls how many nodes it visits — more visits = better chance of
finding the true nearest neighbour, but slower.

**Step 4 — Attach score**
```ts
{ $addFields: { score: { $meta: "vectorSearchScore" } } }
```
`$meta: "vectorSearchScore"` reads the cosine similarity computed by the previous
stage and writes it as `.score` on each document. Without this, the score is internal
to the pipeline and inaccessible downstream.

### Index definition (created separately in Atlas)

| Field | Type | Notes |
|---|---|---|
| `embedding` | `vector` | `embeddingDim`-dimensional float array (default: 1024) |
| `is_retrievable` | `boolean` | filtered with `$eq` |
| `law_category` | `token` | filtered with `$eq` |
| `law_number` | `token` | filtered with `$eq` |
| `law_year` | `token` | filtered with `$eq` |
| `appeal_number` | `token` | filtered with `$eq` |
| `judicial_year` | `token` | filtered with `$eq` |

---

## `textSearch(query, options)`

**Keyword (sparse) search** using Atlas Full-Text Search (Apache Lucene under the hood).

### What "keyword" means

The query `"قانون العمل المادة 109"` contains the **exact tokens** "قانون", "العمل",
"109". BM25 (the underlying ranking algorithm) scores documents by how often and how
uniquely these tokens appear in them. Vector search might rank a semantically similar
but differently worded document higher — text search anchors on exact legal terminology.

### Why use both?

Vector search catches semantically related but differently worded documents.
Text search catches exact legal terminology and law names.
Hybrid (both merged via RRF) beats either alone for legal text retrieval.

### How it works

The pipeline uses a **compound query** with two layers:

**Layer 1 — `must` clauses (hard filters, no scoring)**
```ts
must: [
  { equals: { path: "is_retrievable", value: true } },
  { phrase: { path: "law_category", query: "تجاري" } },  // if provided
  { phrase: { path: "law_number",   query: "12"     } },  // if provided
  // ...
]
```
A document failing any `must` clause is **excluded entirely**. The `equals` operator
is an exact boolean match. The `phrase` operator matches the exact token sequence —
not tokenized, not stemmed — which makes it reliable for structured fields like
law numbers and categories.

**Layer 2 — `should` clauses (scoring, at least one must match)**

| Field | Boost | Why |
|---|---|---|
| `text` | 1.5× | Main legal content — where the answer actually lives |
| `law_name_normalized` | 2.0× | Strongest signal — if the query mentions a law name, this is the most valuable match |
| `case_subject` | 1.8× | Subject line of court rulings — important for ruling lookups |

```ts
minimumShouldMatch: 1
```
At least one `should` clause must match. Without this, a document passing `must`
filters but matching zero `should` clauses would still appear in results (with a
near-zero score). This setting excludes such irrelevant documents.

**`lucene.arabic` analyzer** — what it does to both query and indexed text:
- Strips diacritics (تَشْكِيل)
- Normalizes ة→ه, إأآ→ا, ى→ي
- Arabic morphological stemming (removes prefixes/suffixes)
- Result: "العاملين" and "عامل" and "عمال" all stem to the same root and match each other

This is why text search works well for Arabic legal text despite morphological variation.

**Score attachment and limit**
```ts
{ $addFields: { score: { $meta: "searchScore" } } },  // BM25 score
{ $limit: topK },                                       // cap results
```
Unlike `$vectorSearch` which has a built-in `limit`, `$search` returns all matching
documents. The `$limit` stage is required to cap the output.

**Error handling in caller**
```ts
this.textSearch(request.query, opts).catch(() => [])
```
If the Atlas search index is missing (common in dev environments without Atlas),
`$search` throws. The `.catch` silently returns `[]` and the system continues
with vector-only results.

### Text index definition (created separately in Atlas)

| Field | Analyzer | Boost |
|---|---|---|
| `text` | `lucene.arabic` | 1.5 |
| `law_name_normalized` | `lucene.arabic` | 2.0 |
| `case_subject` | `lucene.arabic` | 1.8 |
| `law_category` | token (filter) | — |
| `law_number` | token (filter) | — |
| `law_year` | token (filter) | — |
| `appeal_number` | token (filter) | — |
| `judicial_year` | token (filter) | — |
| `is_retrievable` | boolean (filter) | — |

---

## Reciprocal Rank Fusion (RRF)

After both searches run, RRF merges their ranked lists into one unified ranking.

### The problem it solves

Vector search returns a list sorted by cosine similarity. Text search returns a list
sorted by BM25 score. These scores are on **different scales** — you cannot simply
average them or concatenate the lists.

### How RRF works

For each document at position `rank` (0-indexed) in a list:

```
contribution = 1 / (k + rank + 1)
```

`k = 60` (configured via `env.rrfK`) is a smoothing constant. It prevents the first
result from dominating — the difference between rank 0 and rank 1 is `1/61 - 1/62 ≈ 0.00026`,
which is small compared to `1/1 - 1/2 = 0.5` without `k`.

A document appearing in both lists accumulates contributions from both:

```
rrf_score = (1 / (k + rank_in_vector + 1)) + (1 / (k + rank_in_text + 1))
```

Documents appearing in only one list get only one contribution. The final list is
sorted by `rrf_score` descending.

### Example

```
Vector results:    [A(rank 0), B(rank 1), C(rank 2)]
Text results:      [B(rank 0), D(rank 1), A(rank 2)]

With k=60:
A: 1/61 + 1/63 = 0.01639 + 0.01587 = 0.03226  (in both, ranks 0 and 2)
B: 1/62 + 1/61 = 0.01613 + 0.01639 = 0.03252  (in both, ranks 1 and 0)
C: 1/63            = 0.01587                   (vector only, rank 2)
D: 1/62            = 0.01613                   (text only, rank 1)

Final order: B > A > D > C
```

B wins because it appeared highly in both lists. C and D each appeared in only one list.

---

## `expandWithParentContext(chunks)`

**Post-retrieval step that replaces child chunk text with full parent article text.**
Called after reranking, on the final top-K chunks only.

### Why it exists

During ingestion, long articles are split into smaller child chunks (300–500 tokens each)
for embedding. The search returns these children because they match the query precisely.
But the LLM needs the full article to produce a complete answer — a fragment often
lacks the surrounding context.

```
Ingestion:                     Search retrieves:        LLM needs:
Full article (2000 chars)  →   Child chunk (400 chars)  Full article text
├── child 0 (400 chars)        ↑ matched the query       (or a 4000-char window around it)
├── child 1 (400 chars)
├── child 2 (400 chars)  ←── retrieved
└── child 3 (400 chars)
```

### Algorithm

**Step 1 — Collect unique parent IDs**
```ts
const parentIds = [...new Set(
  chunks
    .filter(c => c.child_index >= 0 && c.parent_chunk_id)
    .map(c => c.parent_chunk_id)
)];
```
Only children (where `child_index >= 0`) have a `parent_chunk_id`. Parents themselves
pass through unchanged — they already hold the full text.
`new Set` deduplicates: if 3 children from the same article were all retrieved, we
fetch the parent only once.

**Step 2 — Early exit**
```ts
if (parentIds.length === 0) return chunks;
```
If all chunks are already parents (or the input is empty), return immediately.
Avoids an unnecessary DB round-trip.

**Step 3 — Batch fetch parents (one query)**
```ts
const parents = await ChunkModel.find(
  { chunk_id: { $in: parentIds } },
  { chunk_id: 1, text: 1, text_len: 1 },
).lean();
```
One query for all parents regardless of how many children were retrieved.
Projection `{ chunk_id: 1, text: 1, text_len: 1 }` fetches only the three
needed fields — the 1024-float embedding array is not transferred.
`.lean()` returns plain objects (faster, lower memory than Mongoose documents).

**Step 4 — Build O(1) lookup map**
```ts
const parentMap = new Map(parents.map(p => [p.chunk_id, p]));
```
`Array.find()` on every child would be O(n×m). `Map.get()` is O(1).

**Step 5 — Replace content**
```ts
return chunks.map(chunk => {
  if (chunk.child_index < 0 || !chunk.parent_chunk_id) return chunk; // parent → passthrough
  const parent = parentMap.get(chunk.parent_chunk_id);
  if (!parent?.text) return chunk;                                    // missing → fallback to child
  const contextText = extractContextWindow(parent.text, chunk.content, MAX_PARENT_CHARS);
  return { ...chunk, content: contextText, text_len: contextText.length };
});
```
The original chunk's metadata (chunk_id, article_number, law_name_normalized, etc.)
is preserved via `{ ...chunk, ... }`. Only `content` and `text_len` are replaced.

---

## `extractContextWindow(parentText, childText, maxChars)`

**Private helper** that extracts up to `maxChars` from a parent, centred on where
the child text appears.

### Why not just return the whole parent?

`MAX_PARENT_CHARS = 4000`. A long article could be 15 000 characters. Passing 15 000
characters to the LLM per chunk would overflow the context window (5 chunks × 15 000 = 75 000
chars ≈ 50 000 tokens, exceeding qwen-plus's 32 K limit). We take a window around
the relevant fragment instead.

### Step-by-step with example

**Inputs:** parentText (8000 chars), childText starts at index 5500, maxChars = 4000

```ts
if (parentText.length <= maxChars) return parentText;
```
If the parent is already short enough → return as-is (no trimming needed). Here 8000 > 4000,
so we continue.

```ts
const probe = childText.slice(0, 120).trim();
const matchIdx = probe.length > 0 ? parentText.indexOf(probe) : -1;
```
Take the first 120 chars of the child as a search probe. `indexOf` finds the
position in the parent where this probe appears (5500 in our example).

```ts
if (matchIdx === -1) {
  return parentText.slice(0, maxChars) + " …";
}
```
If the probe wasn't found (child text was rewritten during ingestion), fall back
to returning the head of the parent.

```ts
let start = Math.max(0, matchIdx - half);   // max(0, 5500-2000) = 3500
let end   = Math.min(parentText.length, start + maxChars);  // min(8000, 7500) = 7500
```
Centre the window: go 2000 chars before the match and 2000 after.

```ts
// Fix: if end was clamped, slide start back to fill the full window
if (end - start < maxChars) {
  start = Math.max(0, end - maxChars);
}
```
**This is the key fix.** Without it, when the match is near the **end** of the parent
(e.g. matchIdx = 7800), `start = 5800`, `end = 8000 (clamped)`, result = 2200 chars
instead of 4000. The fix slides `start` back: `start = max(0, 8000-4000) = 4000`,
result = 4000 chars. The window is always fully filled.

Example values:
| matchIdx | start (before fix) | end | chars | start (after fix) | chars |
|---|---|---|---|---|---|
| 5500 | 3500 | 7500 | 4000 | 3500 | 4000 |
| 7800 | 5800 | 8000 | 2200 | 4000 | 4000 ✓ |
| 50 | 0 | 4000 | 4000 | 0 | 4000 |

```ts
const prefix = start > 0 ? "… " : "";
const suffix = end < parentText.length ? " …" : "";
return prefix + parentText.slice(start, end) + suffix;
```
Add ellipsis markers when text was trimmed from either end. These signal to the LLM
that the text is an excerpt, not the complete document.

### Context budget

| Constant | Value | Reasoning |
|---|---|---|
| `MAX_PARENT_CHARS` | 4000 | ≈ 5000 tokens per chunk. 5 chunks × 5000 = 25 000 tokens — safe for qwen-turbo (8 K per request) and qwen-plus (32 K). Raise if switching to a larger model. |

---

## What is `aggregate()`?

`Model.aggregate([...stages])` is MongoDB's aggregation framework. Documents flow
through a sequence of stages; each stage transforms the output of the previous one.

```
Input documents
  → Stage 1: $vectorSearch / $search   (filter + rank by relevance)
  → Stage 2: $addFields                (attach relevance score)
  → Stage 3: $limit                    (textSearch only — cap results)
  → Output: ranked array of documents
```

Both `vectorSearch` and `textSearch` require `aggregate()` because `$vectorSearch`
and `$search` are Atlas-specific aggregation stages — they are not available through
`find()`. `expandWithParentContext` uses `find()` instead because it only needs a
simple key lookup (no search stages, no reshaping).

---

## How the methods fit the two query paths

```
User query
    │
    ├─ Exact reference? (article number + law name, or appeal number)
    │       │
    │       ▼
    │   findByArticle() / findByAppeal()
    │       → direct MongoDB findOne, sorted by text_len
    │       → returns full parent + children
    │       → NO embedding, NO vector search
    │
    └─ General legal question?
            │
            ▼
        retrieveCandidateChunks()
            → embeds query → vectorSearch → textSearch → RRF
            → returns LegalChunks[] (candidates for reranking)
            → after reranking: expandWithParentContext()
```
