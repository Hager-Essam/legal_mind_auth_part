# `runLawRefQuery` — Detailed Flow

## When Does This Run?

`runLawRefQuery` is called only when `ClassifierService.classify()` returns
`category: "law_ref"`. That happens when `parseLegalReference()` finds at least
one of the following in the user's query:

| Signal | Example query |
|---|---|
| Article number | `"المادة 5 من قانون العمل"` |
| Multiple article numbers | `"المواد 3 و 7 من قانون العقوبات"` |
| Appeal (court ruling) number | `"الطعن رقم 513 لسنة 16"` |
| Law number | `"قانون رقم 12 لسنة 2003"` |
| Law year | `"قانون العمل لسنة 2003"` |
| Named law (2+ words) | `"قانون التجارة"` |

---

## Entry Point

```
POST /api/v1/query
    │
    ▼
runQuery()
    │
    ├─ classify() → { category: "law_ref", parsedReference }
    │                                      └── parsed ONCE here, carried forward
    │
    └─► runLawRefQuery(request, startedAt, llmProviderUsed, parsedReference)
```

`parsedReference` was already computed by the classifier. `runLawRefQuery` receives
it as a parameter — it does NOT parse the query again.

```typescript
const reference = parsedReference ?? parseLegalReference(request.query);
//                └─────────────────────────────────────────────────────
//                Always uses the classifier's result.
//                The ?? fallback only fires in isolated unit tests.
```

---

## The Four Paths Inside `runLawRefQuery`

```
runLawRefQuery
    │
    ├── Path 1: reference.articleNumber is set?
    │       │
    │       ├── YES → findByArticle(articleNumber, lawName)
    │       │             │
    │       │             ├── found  → return exact article text  [DONE — no LLM]
    │       │             └── not found → runArabicRagQuery(... , answerPrefix, reference)
    │       │
    ├── Path 2: reference.appealNumber is set?
    │       │
    │       ├── YES → findByAppeal(appealNumber, judicialYear)
    │       │             │
    │       │             ├── found  → return exact ruling text  [DONE — no LLM]
    │       │             └── not found → runArabicRagQuery(... , answerPrefix, reference)
    │       │
    ├── Path 3: reference.lawNumber OR lawYear OR lawName is set?
    │       │
    │       └── YES → runArabicRagQuery(... , reference)
    │                  (no exact lookup — go straight to RAG with filters)
    │
    └── Path 4: nothing parseable
            └── return "تعذر تحديد رقم المادة..." message  [DONE — no LLM, no DB]
```

---

## Path 1 — Explicit Article Number

**Triggered by:** `reference.articleNumber` is not null.

**Example query:** `"المادة 5 من قانون العمل"`

### Step 1 — `findByArticle(articleNumber, lawName)`

This is a **direct MongoDB lookup** — NOT vector search, NOT text search.

```typescript
// If lawName is provided:
ChunkModel.findOne({
  article_number: "5",
  law_name: { $regex: /^قانون العمل$/i },   // exact match first
  is_retrievable: true,
})

// If exact name match fails, tries partial word match:
ChunkModel.findOne({
  article_number: "5",
  law_name: { $regex: /قانون.*العمل/i },    // each word as a segment
  is_retrievable: true,
})
```

**Why not vector search?**
The user specified the exact document they want by its primary key (`article_number`).
Vector search finds *semantically similar* documents — it is for when you don't know
which document you want. Fetching by `article_number` is like a SQL `WHERE id = 5`.
It is faster, cheaper, and guaranteed to return the right article if it exists.

### Step 1a — Article found

Returns immediately with **no LLM call**:

```typescript
return {
  answer: buildExactMatchAnswer(document),
  //       └─ formats: "تم العثور على المادة المطلوبة.\n\n[المصدر: قانون العمل - المادة 5]\n\n<article text>"
  source_chunks: [toDocumentChunk(document)],
  category: "law_ref",
  latency_ms: ...,
}
```

Total cost: **1 MongoDB query**. No embedding, no reranking, no LLM. This is the
fastest possible path in the entire system (~10–50 ms).

### Step 1b — Article NOT found

The article exists in the query but was not found in the database (either not ingested
or the law name didn't match). Falls through to RAG with a prefix message:

```typescript
const answerPrefix = buildNoExactMatchAnswer(reference);
// → "لم يتم العثور على تطابق مباشر لـ المادة 5 من قانون العمل.
//    سيتم البحث في قاعدة البيانات للعثور على أقرب نص قانوني ذي صلة."

return runArabicRagQuery(request, startedAt, llmProviderUsed, answerPrefix, reference);
```

`reference` is passed forward so `runArabicRagQuery` does not re-parse the query.
The final answer will be prefixed with the "not found" message.

---

## Path 2 — Court Ruling (Appeal Number)

**Triggered by:** `reference.appealNumber` is not null (and `articleNumber` is null).

**Example query:** `"الطعن رقم 513 لسنة 16"`

### Step 1 — `findByAppeal(appealNumber, judicialYear)`

```typescript
ChunkModel.findOne({
  appeal_number: "513",
  judicial_year: "16",   // only added if judicialYear was parsed
  is_retrievable: true,
})
```

Same reasoning as article lookup — the user named a specific court ruling.
Direct key lookup beats vector search.

### Step 1a — Ruling found

Returns immediately with **no LLM call**:

```typescript
return {
  answer: buildRulingAnswer(document),
  //       └─ formats: "تم العثور على حكم النقض المطلوب.\nالموضوع: ...\n\n[حكم النقض - الطعن رقم 513 لسنة 16 - بتاريخ ...]\n\n<ruling text>"
  source_chunks: [toDocumentChunk(document)],
  category: "law_ref",
}
```

### Step 1b — Ruling NOT found

```typescript
const answerPrefix = buildNoRulingMatchAnswer(reference);
// → "لم يتم العثور على الطعن رقم 513 لسنة 16 في قاعدة البيانات.
//    سيتم البحث عن أقرب حكم ذي صلة."

return runArabicRagQuery(request, startedAt, llmProviderUsed, answerPrefix, reference);
```

---

## Path 3 — Law Name / Number / Year Only (No Article or Appeal)

**Triggered by:** no `articleNumber`, no `appealNumber`, but `lawNumber` or `lawYear`
or `lawName` is present.

**Example query:** `"قانون العمل رقم 12 لسنة 2003"` (asking about the law, not a specific article)

There is no single document to look up — the user is asking a general question about
a law. Goes straight to RAG, but `reference` carries the law filters:

```typescript
return runArabicRagQuery(request, startedAt, llmProviderUsed, undefined, reference);
```

Inside `runArabicRagQuery` → inside `retrieveCandidateChunks`, `reference.lawNumber`
and `reference.lawYear` become MongoDB pre-filters:

```typescript
opts = {
  lawNumber: "12",    // ← from reference
  lawYear:   "2003",  // ← from reference
}
```

These narrow the vector search and text search to only chunks from that specific law —
a much more precise retrieval than searching the entire collection.

---

## Path 4 — Nothing Parseable

**Triggered by:** the classifier said "law_ref" (because `lawName` matched 2+ words)
but `lawNumber`, `lawYear`, `lawName` are all null after re-inspection.

This is a rare edge case. Returns a static message asking the user to rephrase:

```typescript
return {
  answer: "تعذر تحديد رقم المادة من السؤال. اذكر رقم المادة واسم القانون بصيغة أوضح.",
  source_chunks: [],
  category: "law_ref",
}
```

---

## Full Flow Diagram

```
User query: "المادة 5 من قانون العمل"
                │
                ▼
        parseLegalReference()         ← called ONCE in classifier
        {
          articleNumber: "5",
          articleNumbers: ["5"],
          paragraphs: [],
          clauses: [],
          lawName: "قانون العمل",
          lawNumber: null,
          lawYear: null,
          appealNumber: null,
          judicialYear: null,
        }
                │
                ▼
        classify() → "law_ref"
                │
                ▼
        runLawRefQuery(request, parsedReference)
                │
                ▼
        reference.articleNumber = "5"  ← Path 1
                │
                ▼
        findByArticle("5", "قانون العمل")
          ├── MongoDB query: article_number="5" AND law_name ≈ "قانون العمل"
          │
          ├── FOUND ──────────────────────────────────────────────────────────►
          │           return { answer: "تم العثور على المادة...", category: "law_ref" }
          │           [No LLM, no embedding — ~10-50ms total]
          │
          └── NOT FOUND
                    │
                    ▼
            runArabicRagQuery(
              request,
              answerPrefix = "لم يتم العثور على تطابق مباشر...",
              reference     ← passed directly, NO re-parse
            )
                    │
                    ▼
            parseLegalReference NOT called again
            reference.paragraphs → build prompt hints (if any)
                    │
                    ▼
            queryRewriteService.rewrite()        ← LLM call 1
                    │
                    ▼
            retrieveCandidateChunks(rewrittenQuery, reference)
              ├── embeddingService.embedQuery()   ← embedding call
              ├── vectorSearch(vector, opts)      ← MongoDB vector search
              └── textSearch(query, opts)         ← MongoDB text search
                    │
                    ▼
            rerankerService.rerank()             ← in-memory scoring
                    │
                    ▼
            evaluateGrounding()                  ← in-memory check
                    │
                    ▼
            expandWithParentContext()            ← MongoDB batch fetch
                    │
                    ▼
            generationService.generateGroundedArabicAnswer()  ← LLM call 2
                    │
                    ▼
            return {
              answer: "لم يتم العثور على تطابق مباشر...\n\n<RAG answer>",
              source_chunks: [...],
              category: "arabic_rag",   ← note: category changes to arabic_rag
            }
```

---

## Key Design Points

### 1. `parsedReference` is never re-computed

The classifier parses the query once and passes the result through the entire chain:

```
classify()
  └─► runLawRefQuery(... , parsedReference)
            └─► runArabicRagQuery(... , reference)
                      └─► retrieveCandidateChunks(rewriteRequest, reference)
```

`parseLegalReference()` runs exactly once per request, regardless of which path is taken.

### 2. Exact lookup paths have no LLM cost

Paths 1a and 2a (article found / ruling found) return the raw document text directly.
The answer is built by string formatting, not by a language model. This means:

- Zero LLM tokens consumed
- Zero embedding cost  
- Response time: ~10–50 ms (one MongoDB query)
- Deterministic answer (same input → same output, every time)

### 3. The category in the response can differ from the classified category

When Path 1b or 2b fires (exact match not found, falls through to RAG), the response
comes back with `category: "arabic_rag"`, not `"law_ref"`. This is because the actual
work was done by the RAG pipeline. The client should be aware that a query classified
as `law_ref` may return `arabic_rag` in the response if no exact match was found.

### 4. `lawNumber` and `lawYear` as retrieval filters

When `reference.lawNumber` or `reference.lawYear` is set (Paths 1b, 2b, 3), those
values are passed as pre-filters into both the MongoDB vector search and the Atlas
text search. This narrows the candidate pool before any semantic similarity scoring —
a major precision improvement for queries about specific numbered laws.

```
Without filters: search all 21,442 chunks
With lawNumber="12", lawYear="2003": search only ~367 chunks (قانون العمل)
```

This is why running the migration script to populate `law_number` and `law_year`
on the stored documents matters — without those fields in MongoDB, the filters
find nothing even when the query specifies them.
