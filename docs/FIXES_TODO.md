# RAG Backend — All Wrongs & Fix Checklist

Every item is tied to a specific file and line. Work through them top-to-bottom (ordered by severity).

---

## GROUP A — Index Fixes (MongoDB Atlas Console)

These must be done in the Atlas UI / Atlas CLI **before** the code fixes will work.

---

### A-1 · Add `is_retrievable` to the Text Search Index
**Severity:** 🔴 Critical  
**Effect of bug:** Every keyword (text) search returns **0 results**. The `$search` compound `must` clause uses `equals` on `is_retrievable`, but the field is not mapped in the index (`dynamic: false`). Atlas silently matches nothing.

**Current text search index — missing field:**
```json
"is_retrievable": ???   ← not present
```

**Fix — add this entry to the `fields` object in the Atlas Text Search Index JSON:**
```json
"is_retrievable": { "type": "boolean" }
```

**Full corrected Text Search Index:**
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text":                { "type": "string", "analyzer": "lucene.arabic" },
      "law_name_normalized": { "type": "string", "analyzer": "lucene.arabic" },
      "law_category":        { "type": "token" },
      "is_retrievable":      { "type": "boolean" }
    }
  }
}
```

**Fields decision table:**

| Field | Decision | Reason |
|---|---|---|
| `text` | ✅ Keep | Primary content field, core of full-text search |
| `law_name_normalized` | ✅ Keep — **change analyzer from `lucene.keyword` to `lucene.arabic`** | Pre-normalized Arabic (consistent hamza/ya), better than raw `law_name`. Was broken because `keyword` analyzer stores the whole string as one token requiring exact full-string match |
| `law_name` | ❌ Remove | Redundant — `law_name_normalized` is the cleaner, already-normalized version |
| `law_category` | ✅ Keep | Used as a `phrase` pre-filter in `must` clause |
| `is_retrievable` | ✅ Add (was missing) | Required for `equals: true` must-clause — without it text search returns 0 results |
| `article_number` | ❌ Remove | Article lookup goes through `findByArticle()` → regular MongoDB `findOne()` + regex, never touches Atlas Search. For fallback RAG queries, the `text` field content naturally contains article number references |
| `document_id` | ❌ Do not add | Users cannot know an MD5 hash — see B-1 |

**How law_name is detected from the query:**
`legal-ref-parser.ts` already has `LAW_NAME_RE` that extracts law names from patterns like `"المادة 5 من قانون العمل"`. However, using the extracted name as a hard `must` filter risks returning 0 results if extraction fails or the name doesn't match exactly. The correct approach is to use it as an extra boosted `should` clause:
```typescript
// When a law name is extracted from the query, add a phrase boost (not a hard filter)
if (extractedLawName) {
  shouldClauses.push({
    phrase: {
      query: extractedLawName,
      path: "law_name_normalized",
      score: { boost: { value: 3.0 } },
    },
  });
}
```

---

## GROUP B — Logic Fixes (Wrong Design Decisions)

---

### B-1 · Remove `document_id` as a user-facing filter
**Severity:** 🔴 Critical (design mistake)  
**Files:** `src/Schemas/domain.ts`, `src/Services/retrieval.service.ts`

`document_id` in the sample document is `"cf868318130c841133b36ee55cce3ad9"` — an MD5 hash. No user will ever type this. There is no "list documents" endpoint to retrieve these IDs. The field in `QueryRequest` accepts input that can never meaningfully come from a human user.

The correct filter for scoping a search is `law_category` (human-readable, e.g. `"النقض و المحكمة الادارية"`), which is already indexed.

**Fix in `src/Schemas/domain.ts` — remove `document_id`, add `law_category`:**
```typescript
// BEFORE
export const queryRequestSchema = z.object({
  query: z.string().min(3).max(2000),
  top_k: z.number().int().min(1).max(50).default(5),
  document_id: z.string().min(1).optional(),   // ← REMOVE
  language: z.enum(["ar", "en", "auto"]).default("auto"),
  user_role: userRoleSchema.optional(),
});

// AFTER
export const queryRequestSchema = z.object({
  query: z.string().min(3).max(2000),
  top_k: z.number().int().min(1).max(50).default(5),
  law_category: z.string().min(1).optional(),  // ← ADD
  language: z.enum(["ar", "en", "auto"]).default("auto"),
  user_role: userRoleSchema.optional(),
});
```

---

## GROUP C — Code Fixes (Bugs in Implementation)

---

### C-1 · `input_type` is buried inside `extra_body` — DashScope never sees it
**Severity:** 🔴 Critical  
**File:** `src/Services/embedding.service.ts` lines 57–59

`extra_body` is a Python SDK abstraction that merges extra keys before sending. When using raw `fetch`, it is just a nested JSON object that DashScope does not recognize. `input_type` is silently ignored, meaning every embedding — query and document — is generated with the same generic representation. The `text-embedding-v4` model produces meaningfully different (better) vectors when `input_type: "query"` is specified for queries.

```typescript
// BEFORE (broken)
body: JSON.stringify({
  model: provider.embeddingModel,
  input: sanitizedTexts,
  encoding_format: "float",
  extra_body: {          // ← Python SDK concept, not a real JSON key
    input_type: inputType,
  },
}),

// AFTER (correct)
body: JSON.stringify({
  model: provider.embeddingModel,
  input: sanitizedTexts,
  encoding_format: "float",
  input_type: inputType,  // ← top-level field in the request body
}),
```

---

### C-2 · Vector search: `document_id` post-filter anti-pattern
**Severity:** 🔴 Critical (becomes irrelevant after B-1)  
**File:** `src/Services/retrieval.service.ts` lines 125–129

After removing `document_id` from `QueryRequest` (B-1), this block becomes dead. Remove it.  
If `document_id` is ever re-added as an internal use case, the filter must live **inside** the `$vectorSearch` stage (and `document_id` must be added to the vector index as a filter type).

```typescript
// REMOVE these lines entirely
// document_id filter applied BEFORE implicit limit (we already limit via $vectorSearch.limit)
if (options.documentId) {
  pipeline.push({ $match: { document_id: options.documentId } });
}
```

Also update the method signature:
```typescript
// BEFORE
async vectorSearch(
  queryVector: number[],
  options: { topK?: number; documentId?: string } = {},
)

// AFTER
async vectorSearch(
  queryVector: number[],
  options: { topK?: number; lawCategory?: string } = {},
)
```

And add `law_category` to the `$vectorSearch` filter:
```typescript
const filter: Record<string, unknown> = { is_retrievable: { $eq: true } };
if (options.lawCategory) {
  filter.law_category = { $eq: options.lawCategory };
}
```

---

### C-3 · Text search: `document_id` post-filter anti-pattern
**Severity:** 🔴 Critical (becomes irrelevant after B-1)  
**File:** `src/Services/retrieval.service.ts` lines 193–196

Same as C-2. Remove the `$match` block and update the signature to accept `lawCategory` instead of `documentId`.

```typescript
// REMOVE
if (options.documentId) {
  pipeline.push({ $match: { document_id: options.documentId } });
}
```

For `law_category` filtering inside `$search`, use `phrase` — NOT `equals` (see C-4):
```typescript
const mustClauses: object[] = [
  { equals: { path: "is_retrievable", value: true } },
];
if (options.lawCategory) {
  mustClauses.push({ phrase: { path: "law_category", query: options.lawCategory } });
}
```

---

### C-4 · Text search: `law_category` uses wrong Atlas operator
**Severity:** 🔴 Critical  
**File:** `src/Services/retrieval.service.ts` — any `law_category` filter clause

The Atlas Search `equals` operator only supports `boolean`, `number`, `date`, and `objectId` types. `law_category` is a `token` (string) type. Using `equals` on it silently matches nothing.

```typescript
// WRONG — equals does not work on token strings in Atlas Search
{ equals: { path: "law_category", value: options.lawCategory } }

// CORRECT — phrase matches the full token value
{ phrase: { path: "law_category", query: options.lawCategory } }
```

---

### C-5 · `law_category` not forwarded from `QueryRequest` to search methods
**Severity:** 🔴 Critical  
**File:** `src/Services/retrieval.service.ts` — `retrieveCandidateChunks()`

Even after adding `law_category` to `QueryRequest` (B-1), the value is never passed into `vectorSearch` or `textSearch`. Both call sites must forward it.

```typescript
// BEFORE
this.vectorSearch(queryVector, { topK: overfetch, documentId: request.document_id })
this.textSearch(request.query, { topK: overfetch, documentId: request.document_id })

// AFTER
this.vectorSearch(queryVector, { topK: overfetch, lawCategory: request.law_category })
this.textSearch(request.query,  { topK: overfetch, lawCategory: request.law_category })
```

---

### C-6 · API key rotation missing — always uses first key
**Severity:** 🟠 High  
**File:** `src/Services/provider-config.service.ts` lines 30–40

`LEGALMIND_DASHSCOPE_API_KEYS` is a comma-separated list, implying multiple keys were intended for rate-limit distribution. The current code always destructures index 0. Under any real load every request hits the same key and will trigger DashScope's per-key RPM/TPM limit.

```typescript
// BEFORE
getDashScopeApiKey(): string {
  const [apiKey] = env.dashscopeApiKeys;  // always index 0
  if (!apiKey) throw new Error("...");
  return apiKey;
}

// AFTER — add a private counter and rotate
private keyIndex = 0;

getDashScopeApiKey(): string {
  const keys = env.dashscopeApiKeys;
  if (keys.length === 0) {
    throw new Error("No DashScope API keys configured. Set LEGALMIND_DASHSCOPE_API_KEYS.");
  }
  const key = keys[this.keyIndex % keys.length];
  this.keyIndex++;
  return key;
}
```

---

### C-7 · Query rewrite sends garbled Arabic to the LLM
**Severity:** 🟠 High  
**File:** `src/Services/query-rewrite.service.ts` lines 44, 68

`normalizeArabicQuery` converts `ة → ه`, `أإآ → ا`, `ى → ي`, strips punctuation, etc. This is correct for **indexing and token matching**, but the normalized (garbled) form is then sent to the LLM for semantic rewriting. The LLM receives incorrect Arabic and produces lower-quality rewrites.

The original raw query should go to the LLM. Normalization only applies to the mapping lookup.

```typescript
// BEFORE
const normalized = normalizeArabicQuery(query);
const mappingResult = rewriteWithMapping(normalized);
// ...
const rewritten = await this.rewriteWithLlm(normalized);  // ← garbled Arabic

// AFTER
const normalized = normalizeArabicQuery(query);           // keep for mapping
const mappingResult = rewriteWithMapping(normalized);
// ...
const rewritten = await this.rewriteWithLlm(query);       // ← original Arabic
```

---

### C-8 · Grounded RAG generation has no `system` message
**Severity:** 🟠 High  
**File:** `src/Services/generation.service.ts` lines 116–128

`generateChatAnswer` correctly uses a `system` message for model identity and rules. `generateChatCompletion` (used for RAG answers) sends everything as a single `user` message. Without a `system` message the model does not receive behavioral constraints and may answer outside the retrieved context.

```typescript
// BEFORE — single user message
messages: [
  { role: "user", content: GROUNDED_ARABIC_RAG_PROMPT.replace(...) }
]

// AFTER — split into system rules + user context/question
messages: [
  {
    role: "system",
    content: `أنت مساعد قانوني مصري. أجب فقط بناءً على النصوص المسترجعة.
لا تخترع معلومات. لا تذكر قانوناً أو مادة غير موجودة في السياق.
أجب بالعربية الفصحى الرسمية.`,
  },
  {
    role: "user",
    content: `السياق القانوني:\n${params.context}\n\nالسؤال: ${params.question}\n\nعدد الأدلة: ${params.evidenceCount}`,
  },
]
```

---

### C-9 · Deduplication keyed on content prefix — removes genuinely distinct chunks
**Severity:** 🟡 Medium  
**File:** `src/Utils/evidence-selection.ts` line 164

```typescript
// BEFORE — first 500 chars of normalized content
const dedupeKey = normalizeArabicText(chunk.content).slice(0, 500);
```

Many chunks in this dataset begin with the same law name or case reference header. Two distinct chunks that share a common header will be treated as duplicates and one is silently discarded.

```typescript
// AFTER — use chunk_id (exact duplicate), fall back to content only if no id
const dedupeKey = chunk.chunk_id.trim().length > 0
  ? chunk.chunk_id
  : normalizeArabicText(chunk.content).slice(0, 500);
```

---

### C-10 · `chunk_type` boost references values not present in actual data
**Severity:** 🟡 Medium  
**File:** `src/Utils/evidence-selection.ts` lines 91–106

The sample document has **no `chunk_type` field**. The scoring boost for `"article"`, `"clause"`, `"document"` will always return `0`, making those branches permanently dead code.

```typescript
// BEFORE — dead code, chunk_type is never set in the collection
const getChunkTypeBoost = (chunk: DocumentChunk): number => {
  if (chunkType === "article")  return 0.12;
  if (chunkType === "clause")   return 0.08;
  if (chunkType === "document") return 0.02;
  return 0;
};
```

Replace with a `semantic_unit` boost — this field IS present (`"obligation"`, `"right"`, etc.):

```typescript
const getSemanticUnitBoost = (chunk: DocumentChunk): number => {
  const unit = chunk.metadata.semantic_unit;
  if (unit === "obligation") return 0.10;
  if (unit === "right")      return 0.08;
  if (unit === "penalty")    return 0.12;
  if (unit === "definition") return 0.06;
  return 0;
};
```

Update `scoreEvidenceChunk` to call `getSemanticUnitBoost` instead of `getChunkTypeBoost`.

---

### C-11 · Grounding threshold too low — allows near-random answers through
**Severity:** 🟡 Medium  
**File:** `src/Utils/grounding-policy.ts` line 44

```typescript
// BEFORE — 0.18 is near random noise for this composite score
if (topScore < 0.18 || citedCount === 0) {
```

A composite score of 0.18 means the retrieved chunk barely overlaps with the question. For a legal domain where wrong answers have real-world consequences, the threshold should be meaningfully higher.

```typescript
// AFTER
if (topScore < 0.35 || citedCount === 0) {
```

---

### C-12 · Empty `article_number` shows misleading label in citation
**Severity:** 🟢 Low  
**File:** `src/Utils/context-builder.ts` lines 15–18

Many documents in this collection are court rulings (أحكام النقض) with no article number. Displaying `"مرجع بلا رقم مادة"` in the citation string shown to the user is confusing.

```typescript
// BEFORE
const articleNumber =
  chunk.article_number && chunk.article_number.trim().length > 0
    ? `المادة ${chunk.article_number.trim()}`
    : "مرجع بلا رقم مادة";   // ← confusing for court rulings

// AFTER — omit silently if empty
const articlePart =
  chunk.article_number && chunk.article_number.trim().length > 0
    ? ` - المادة ${chunk.article_number.trim()}`
    : "";

// then use `articlePart` directly in the citation string, no fallback label
return `[المصدر: ${lawName}${articlePart}${lawCategory}${sourceDataset}]`;
```

---

### C-13 · `classifyRagSubIntent()` is dead code — never called
**Severity:** 🟢 Low  
**File:** `src/Services/classifier.service.ts` lines 43–53

The method correctly classifies `"procedural" | "conceptual" | "factual"` sub-intent but is never called in `QueryService`. Either wire it into `runArabicRagQuery` to adjust retrieval (e.g. different `top_k` for procedural vs factual) or remove it.

---

## Summary Checklist

| # | Group | File | Action | Done |
|---|---|---|---|---|
| A-1 | Index | Atlas Console | Add `is_retrievable: boolean` to Text Search Index | ☐ |
| B-1 | Logic | `domain.ts` | Remove `document_id`, add `law_category` to `QueryRequest` | ☐ |
| C-1 | Code | `embedding.service.ts` | Move `input_type` to top-level in request body | ☐ |
| C-2 | Code | `retrieval.service.ts` | Remove `documentId` from `vectorSearch`, add `lawCategory` pre-filter | ☐ |
| C-3 | Code | `retrieval.service.ts` | Remove `documentId` from `textSearch`, add `lawCategory` pre-filter | ☐ |
| C-4 | Code | `retrieval.service.ts` | Change `law_category` Atlas operator from `equals` to `phrase` | ☐ |
| C-5 | Code | `retrieval.service.ts` | Forward `request.law_category` in `retrieveCandidateChunks` | ☐ |
| C-6 | Code | `provider-config.service.ts` | Add round-robin API key rotation | ☐ |
| C-7 | Code | `query-rewrite.service.ts` | Send original `query` (not normalized) to LLM rewrite | ☐ |
| C-8 | Code | `generation.service.ts` | Add `system` message to grounded RAG generation | ☐ |
| C-9 | Code | `evidence-selection.ts` | Deduplicate by `chunk_id` first, not content prefix | ☐ |
| C-10 | Code | `evidence-selection.ts` | Replace `chunk_type` boost with `semantic_unit` boost | ☐ |
| C-11 | Code | `grounding-policy.ts` | Raise grounding threshold from `0.18` to `0.35` | ☐ |
| C-12 | Code | `context-builder.ts` | Remove "مرجع بلا رقم مادة" fallback label | ☐ |
| C-13 | Code | `classifier.service.ts` | Wire `classifyRagSubIntent()` into pipeline or remove it | ☐ |
