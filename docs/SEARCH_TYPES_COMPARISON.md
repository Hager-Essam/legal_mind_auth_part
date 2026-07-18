# Search Types — Exact Lookup vs Text Search vs Vector Search

## The One-Sentence Summary

| Operation | What it does |
|---|---|
| `findByArticle` | "Give me **this exact document** — Article 5 of قانون العمل" |
| `findByAppeal` | "Give me **this exact document** — ruling 513, year 16" |
| `textSearch` | "Search **inside** documents that belong to this law and **rank** what matches my question" |
| `vectorSearch` | "Find documents whose **meaning** is closest to my question" |

The first two are **identity lookups** — you already know which document you want.
The last two are **relevance searches** — you have a question and need to find the answer.

---

## The Fundamental Difference

### Exact Lookup — you name the document

When a user says `"المادة 5 من قانون العمل"` they are not asking a question.
They are pointing at a specific row in the database by its identity:

```
Article number  = 5
Law             = قانون العمل
```

This is exactly like a SQL lookup by primary key:

```sql
SELECT * FROM legal_chunks
WHERE  article_number = '5'
AND    law_name_normalized LIKE '%قانون%العمل%'
AND    child_index IN (-1, NULL)   -- parents only, full text
ORDER BY text_len DESC
LIMIT 1;
```

MongoDB finds that one document and returns it. No ranking. No scoring.
No language model. Found or not found — binary result.

### Relevance Search — you ask a question

When a user says `"ما هي حقوق العامل عند الفصل التعسفي في قانون العمل؟"` they
are not naming a document. They want information. The system has to:

1. Look at many candidate documents
2. Score each one for relevance
3. Return the top K most relevant ones
4. Pass those to the LLM to generate an answer

Text search and vector search both do this, but in different ways.

---

## What "Filters" Mean in Each Context

Both exact lookups and text/vector search use the same field names —
`law_number`, `law_year`, `appeal_number`, `judicial_year`. But they serve
completely different roles.

### In `findByArticle` / `findByAppeal` — filters ARE the answer

```typescript
// findByArticle: finding Article 5 of قانون العمل
filter = {
  article_number:      "5",              // ← this IS what you want
  law_name_normalized: /قانون.*العمل/i,  // ← this IS which law it belongs to
  child_index:         { $in: [-1, null] }
}

// findByAppeal: finding ruling 513, year 16
filter = {
  appeal_number: "513",   // ← this IS what you want
  judicial_year: "16",    // ← this IS which year it belongs to
  child_index:   { $in: [-1, null] }
}
```

The metadata fields directly identify the document. MongoDB fetches it.
The filter is the entire answer — nothing else happens.

### In `textSearch` — filters are a fence, text content is the answer

```typescript
compound: {
  must: [
    // ── FENCE: restricts which documents are searched ──────────────────
    { equals: { path: "is_retrievable", value: true         } },
    { phrase: { path: "law_number",     query: "12"         } },
    { phrase: { path: "law_year",       query: "2003"       } },
  ],
  should: [
    // ── SCORING: ranks documents by text relevance ──────────────────────
    { text: { query: "حقوق العامل عند الفصل", path: "text",
              score: { boost: { value: 1.5 } } } },
    { text: { query: "حقوق العامل عند الفصل", path: "law_name_normalized",
              score: { boost: { value: 2.0 } } } },
    { text: { query: "حقوق العامل عند الفصل", path: "case_subject",
              score: { boost: { value: 1.8 } } } },
  ]
}
```

`must` clauses fence the search: "only search documents that belong to
قانون العمل رقم 12 لسنة 2003". But they do not find the answer.

The `should` clauses rank documents by how well their **text content**
matches the user's question using Lucene's Arabic analyzer (stemming,
stop words, morphology). The document that best answers "حقوق العامل عند
الفصل" floats to the top.

The filters don't find the answer. They shrink the space where the
search happens.

### In `vectorSearch` — filters are also a fence, the embedding finds the answer

```typescript
$vectorSearch: {
  queryVector: [0.12, -0.34, 0.87, ...],  // ← embedding of the user's question
  filter: {
    is_retrievable: { $eq: true    },
    law_number:     { $eq: "12"    },  // ← fence: only search within this law
    law_year:       { $eq: "2003"  },  // ← fence: only search within this year
  }
}
```

The filter is the same fence idea. The actual relevance is measured by
**cosine similarity** between the query vector and each document's stored
embedding. The document whose stored meaning is closest to the user's
question wins.

---

## What Each Operation Actually Searches

```
Operation        Searches these fields           How it ranks
─────────────────────────────────────────────────────────────────────────────
findByArticle    article_number                  No ranking — boolean match
                 law_name_normalized (regex)

findByAppeal     appeal_number                   No ranking — boolean match
                 judicial_year

textSearch       text           (boost ×1.5)     Lucene Arabic TF-IDF score
                 law_name_norm  (boost ×2.0)     (term frequency, stemming,
                 case_subject   (boost ×1.8)      morphology, stop words)
                 + metadata as fence

vectorSearch     embedding      (1536 numbers)   Cosine similarity between
                 = semantic meaning of text       query vector and doc vector
                 + metadata as fence
─────────────────────────────────────────────────────────────────────────────
```

Exact lookups match **structured identity fields**.
Text search matches **prose content by keyword and morphology**.
Vector search matches **semantic meaning**.

---

## How Many Results and What Kind

```
findByArticle   →  0 or 1 document    — full article (parent, Type 1 or Type 2)
findByAppeal    →  0 or 1 document    — full ruling  (parent, Type 1 or Type 2)
textSearch      →  topK documents     — fragments    (Type 1 or Type 3, is_retrievable=true)
vectorSearch    →  topK documents     — fragments    (Type 1 or Type 3, is_retrievable=true)
```

### Why exact lookups return parents, search returns fragments

Exact lookups target the full article or ruling — the user asked for a
specific document and wants all of it. They omit `is_retrievable` to reach
Type 2 restored split parents (which hold the complete reconstructed text).

Text and vector search target `is_retrievable: true` — only Type 1 atomics
and Type 3 children. These are the embeddable, searchable fragments.
Type 2 parents are hidden from search on purpose (they are duplicates of
their children combined — showing them in search would pollute results).

```
Document types in collection (22,727 total):

  Type 1  Atomic original      16,941   child_index=-1   is_retrievable=true
  Type 2  Restored split parent  1,285   child_index=-1   is_retrievable=FALSE
  Type 3  Auto-split child       4,501   child_index≥0    is_retrievable=true

                     findByArticle  findByAppeal  textSearch  vectorSearch
                     findByAppeal
  Type 1  ────────►      ✅              ✅           ✅           ✅
  Type 2  ────────►      ✅              ✅           ❌           ❌
  Type 3  ────────►      ❌              ❌           ✅           ✅
```

---

## Concrete Example — Same Fields, Different Roles

User query: `"الطعن رقم 513 لسنة 16"`

Parser extracts: `appealNumber = "513"`, `judicialYear = "16"`

### Path A — findByAppeal succeeds

```
MongoDB query:
  { appeal_number: "513", judicial_year: "16", child_index: {$in:[-1,null]} }
  .sort({ text_len: -1 })

appeal_number and judicial_year → IDENTIFY the document
Result: the one document that IS ruling 513/16
        full text returned directly — no LLM
        latency: ~10–50 ms
```

### Path B — findByAppeal returns null, falls to textSearch

```
Atlas Search:
  must:   appeal_number="513", judicial_year="16"    ← FENCE: only inside ruling 513/16
  should: text matches "الطعن رقم 513 لسنة 16"        ← RANK by content relevance

appeal_number and judicial_year → RESTRICT the search space
Result: topK fragments from ruling 513/16, ranked by relevance
        → reranked → LLM generates answer
        latency: ~600–3000 ms
```

Same two fields (`appeal_number`, `judicial_year`), completely different purpose:
- In `findByAppeal`: those fields **are** the result
- In `textSearch`: those fields **restrict where the search looks**,
  and the query text is what actually finds the answer

---

## When Each One Fires

```
User query arrives
       │
       ▼
parseLegalReference()  ←  called ONCE, result threaded through pipeline
       │
       ├── articleNumber is set?
       │       │
       │       └──► findByArticle
       │               │
       │               ├── FOUND  → return full article, no LLM     ~10–50 ms
       │               └── NULL   → fall to RAG ──────────────────────────────►
       │                                                                        │
       ├── appealNumber is set?                                                 │
       │       │                                                                │
       │       └──► findByAppeal                                                │
       │               │                                                        │
       │               ├── FOUND  → return full ruling, no LLM      ~10–50 ms  │
       │               └── NULL   → fall to RAG ──────────────────────────────►│
       │                                                                        │
       └── lawName / lawNumber / lawYear only?                                  │
               │                                                                │
               └──► straight to RAG ─────────────────────────────────────────► │
                                                                                │
                                              RAG pipeline ◄────────────────────
                                                   │
                                                   ├── queryRewriteService.rewrite()   LLM call 1
                                                   │
                                                   ├── vectorSearch(embedding, filters)
                                                   │   filters: law_number, law_year,     FENCE
                                                   │            appeal_number, judicial_year
                                                   │   ranking: cosine similarity          RANK
                                                   │
                                                   ├── textSearch(query, filters)
                                                   │   filters: law_number, law_year,     FENCE
                                                   │            appeal_number, judicial_year
                                                   │   ranking: Lucene Arabic TF-IDF       RANK
                                                   │
                                                   ├── reciprocalRankFusion()  (merge results)
                                                   ├── reranker.rerank()       (re-score)
                                                   ├── expandWithParentContext() (fetch Type 2)
                                                   │
                                                   └── generationService.generateGroundedArabicAnswer()
                                                           LLM call 2                ~600–3000 ms total
```

---

## Summary

```
                   findByArticle    findByAppeal    textSearch      vectorSearch
                   findByAppeal
────────────────────────────────────────────────────────────────────────────────
User intent        Name a document  Name a document  Ask a question  Ask a question
Matching basis     Metadata fields  Metadata fields  Text content    Semantic meaning
Field role         Identify result  Identify result  Fence + rank    Fence + rank
Number of results  0 or 1           0 or 1           topK            topK
Scoring            None             None             TF-IDF + boost  Cosine similarity
LLM needed         Never            Never            Always          Always
Document types     Type 1 + Type 2  Type 1 + Type 2  Type 1 + Type 3 Type 1 + Type 3
is_retrievable     Omitted          Omitted          Required true   Required true
Speed              ~10–50 ms        ~10–50 ms        ~600–3000 ms    ~600–3000 ms
────────────────────────────────────────────────────────────────────────────────
```
