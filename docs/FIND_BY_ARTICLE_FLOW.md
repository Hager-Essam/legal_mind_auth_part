# `findByArticle` — Detailed Flow

**File:** `backend-ts/src/services/retrieval.service.ts`

---

## Purpose

`findByArticle` is the **exact article lookup**. When a user asks for a specific
article by number (e.g. `"المادة 5 من قانون العمل"`), this function tries to
return the full article text directly from MongoDB — no vector search, no LLM,
no reranking. If it succeeds, the entire RAG pipeline is bypassed.

---

## Function Signature

```typescript
async findByArticle(
  articleNumber: string,          // e.g. "5"
  lawName?: string | null,        // e.g. "قانون العمل"
  parsedRef?: ParsedLegalReference, // the full parsed reference from the classifier
): Promise<(ChunkDocument & { _children: ChunkDocument[] }) | null>
```

### Why three parameters?

| Parameter | Where it comes from | Why it's needed |
|---|---|---|
| `articleNumber` | `parsedRef.articleNumber` | The primary search key |
| `lawName` | `parsedRef.lawName` | Disambiguates which law's Article N we want |
| `parsedRef` | Classifier result, threaded through | Provides `lawNumber`/`lawYear` for bonus precision |

All three come from one single `parseLegalReference()` call made by the classifier.
The function never re-parses the query.

---

## The RULE: Both `articleNumber` AND `lawName` Must Be Present

```typescript
if (!articleNumber || !lawName) return null;
```

If either is missing, the function returns `null` immediately. The caller
(`runLawRefQuery`) then falls through to the RAG pipeline.

**Why this rule matters:**

Article numbers are **not globally unique**. Every Egyptian law has an Article 1,
Article 5, Article 99. Across 22,727 documents, there can be dozens of chunks
with `article_number: "5"`. Without a law name, any result would be an arbitrary
article from an arbitrary law — a confident wrong answer is worse than no answer.

```
article_number: "5" exists in:
  ├── قانون العمل
  ├── قانون العقوبات
  ├── القانون المدني
  ├── قانون الإجراءات الجنائية
  └── ... every other law in the collection
```

Returning `null` sends the query to RAG, which uses the full query text and
semantic search to find the right context — a safe fallback.

---

## Step 1 — Normalize the Law Name

```typescript
const normName = normalizeLawName(lawName);
const words    = normName.split(/\s+/).filter((w) => w.length > 1);
if (words.length === 0) return null;
const nameRegex = words.map((w) => this.escapeRegex(w)).join(".*");
```

### What `normalizeLawName` does

Imported from `utils/arabic-normalize.ts`. It mirrors the Python ingestion
pipeline's `normalize_law_name` function so the query and the database use
identical normalization:

| Transformation | Before | After | Why |
|---|---|---|---|
| Remove tashkeel (diacritics) | `قَانُون` | `قانون` | DB stores undiacritized text |
| Remove tatweel | `قاـنون` | `قانون` | Cosmetic character, no meaning |
| أ / إ / آ / ٱ → ا | `إجراءات` | `اجراءات` | Hamza variants mean the same word |
| ى → ي | `المدنى` | `المدني` | Alef maqsura = ya in final position |
| ؤ → و, ئ → ي | `مؤسسة` | `موسسة` | Hamza on waaw/ya variants |
| Arabic digits → western | `٥` | `5` | DB stores western digits after migration |
| Remove punctuation | `قانون.` | `قانون` | Trailing punctuation from parser |
| Normalize whitespace | `قانون  العمل` | `قانون العمل` | Consistent spacing |

**Important:** `ة → ه` is NOT applied here. The DB's `law_name_normalized`
preserves taa marbuta (e.g. `"محكمة"` stays `"محكمة"`). If we converted it on
the query side, names like `"محكمة النقض"` would become `"محكمه النقض"` and
never match.

### Building the regex

After normalization, the law name is split into individual words and joined
with `.*` (matches any characters between words):

```
lawName = "قانون العمل"
normName = "قانون العمل"             (after normalization — same here)
words    = ["قانون", "العمل"]
nameRegex = "قانون.*العمل"
```

This tolerates extra content in the stored name:

| Stored `law_name_normalized` | Matches regex? | Why |
|---|---|---|
| `"قانون العمل"` | ✅ Yes | Exact words present in order |
| `"قانون العمل رقم 12 لسنة 2003"` | ✅ Yes | Extra suffix after, words still in order |
| `"قانون العمل المصري رقم 12 لسنة 2003"` | ✅ Yes | Extra words between, `.*` absorbs them |
| `"القانون المدني"` | ❌ No | Doesn't contain "العمل" |
| `"العمل قانون"` | ❌ No | Words are in wrong order — `.*` is one-directional |

### The empty-words guard

```typescript
if (words.length === 0) return null;
```

If normalization collapses the law name to nothing (e.g. input was `"."` or a
single character shorter than 2), `words` is empty and `nameRegex` would be
`""`. An empty MongoDB regex matches **every document**. The guard prevents
this from silently disabling the law name filter.

---

## Step 2 — Build the MongoDB Filter

```typescript
const filter: Record<string, unknown> = {
  article_number:      articleNumber,
  law_name_normalized: { $regex: nameRegex, $options: "i" },
  child_index:         { $in: [-1, null] },
};

if (parsedRef?.lawNumber) filter.law_number = parsedRef.lawNumber;
if (parsedRef?.lawYear)   filter.law_year   = parsedRef.lawYear;
```

### Field: `article_number`

Exact string equality. The parser extracts `"5"` from `"المادة 5"` and the
database stores `article_number: "5"`. Both are western digits (the migration
script normalized Arabic digits in the DB, and the parser also converts them).

### Field: `law_name_normalized` (not `law_name`)

The filter targets `law_name_normalized`, **not** `law_name`. This is the key
design decision:

| Field | Content | Used for search? |
|---|---|---|
| `law_name` | Raw original text, e.g. `"قانون العمل رقم 12 لسنة 2003"` | ❌ No |
| `law_name_normalized` | Normalized at ingestion, e.g. `"قانون العمل رقم 12 لسنة 2003"` | ✅ Yes |

Both `law_name_normalized` in the DB and the query's `lawName` go through the
same normalization — so variants like `"القانون المدنى"` (ى) in the query match
`"القانون المدني"` (ي) in the DB.

### Field: `child_index: { $in: [-1, null] }` — **parents only**

The database has three kinds of chunks:

| Type | `child_index` | `is_retrievable` | Text content |
|---|---|---|---|
| Atomic original | `-1` | `true` | Full article text |
| Restored split parent | `-1` | `false` | Full article text (concatenation of children) |
| Auto-split child | `>= 0` | `true` | Fragment (one paragraph / section) |

`{ $in: [-1, null] }` selects only atomic originals and restored split parents.
It excludes all 4,501 children (which are fragments, not complete articles).

A user asking for "المادة 5" expects the complete text of Article 5. A child
chunk might contain only the first paragraph — an incomplete answer.

### Field: `is_retrievable` — intentionally ABSENT

This is the most counter-intuitive part. The filter deliberately does NOT
include `is_retrievable: true`.

Restored split parents have `is_retrievable: false` because the system uses
their children for vector/text search (children are retrievable, parents are
not — this prevents the same article from appearing twice in search results).
But for the **exact lookup**, we specifically want the parent because it holds
the full article text.

If we added `is_retrievable: true`, all 1,285 restored split parents would be
excluded, and `findByArticle` would return `null` for every split article.

### Bonus filters: `law_number` and `law_year`

```typescript
if (parsedRef?.lawNumber) filter.law_number = parsedRef.lawNumber;
if (parsedRef?.lawYear)   filter.law_year   = parsedRef.lawYear;
```

When the user's query contains the full law identifier
(`"المادة 5 من قانون العمل رقم 12 لسنة 2003"`), the parser extracts not just
`lawName` but also `lawNumber: "12"` and `lawYear: "2003"`. These become
**exact equality filters** on the dedicated `law_number` and `law_year` fields
(populated by the migration script).

This means:
- For `"المادة 5 من قانون العمل"` → only name regex used
- For `"المادة 5 من قانون العمل رقم 12 لسنة 2003"` → name regex + exact
  `law_number = "12"` + exact `law_year = "2003"`

The bonus filters narrow a potentially ambiguous name match to an exact
law identity. This is important when multiple laws share similar names.

---

## Step 3 — Query with Sort

```typescript
const parent = await ChunkModel.findOne(filter)
  .sort({ text_len: -1 })
  .lean();
if (!parent) return null;
```

### Why `.sort({ text_len: -1 })`?

Even with `child_index: { $in: [-1, null] }`, there could theoretically be
multiple parent-level chunks for the same article (e.g. if data was ingested
twice). Sorting by `text_len` descending and taking `.findOne()` means we
always get the **longest** matching chunk, which is the parent (it is the
concatenation of all its children, so it always has more text than any child).

The live diagnostic confirmed: `parent.text_len` (4534) ≥ sum of children
(3171 + 1362). Sorting by length descending is a reliable tiebreaker.

### `.lean()`

Returns a plain JavaScript object instead of a full Mongoose Document. This is
faster (skips Mongoose hydration) and sufficient since we only read data from
the result.

---

## Step 4 — Fetch Children

```typescript
const children = await ChunkModel.find({
  parent_chunk_id: parent.chunk_id,
  child_index:     { $gte: 0 },
  is_retrievable:  true,
}).lean();

return { ...parent, _children: children };
```

After finding the parent, a second query fetches all its children. Children are
the precise fragments (individual paragraphs, sections) that serve as
**citation sources** — the client can show users exactly which part of the
article is most relevant.

The result merges parent and children into a single object:
```typescript
{
  // all parent fields (chunk_id, text, law_name, article_number, ...)
  _children: [
    { chunk_id: "..._c000", text: "paragraph 1 text", child_index: 0 },
    { chunk_id: "..._c001", text: "paragraph 2 text", child_index: 1 },
  ]
}
```

If the article was never split (atomic original), `_children` is `[]`.

---

## Step 5 — Caller Uses the Result (`query.service.ts`)

```typescript
if (document) {
  return {
    answer: this.legalRefService.buildExactMatchAnswer(document),
    source_chunks: [
      this.legalRefService.toDocumentChunk(document),          // parent (full article)
      ...document._children.map(c => this.legalRefService.toDocumentChunk(c)), // fragments
    ],
    category: "law_ref",
    latency_ms: ...,
  };
}
```

- `answer` — formatted text built from the parent's raw `text` field. No LLM.
- `source_chunks[0]` — the parent chunk (full article text).
- `source_chunks[1..n]` — the child chunks (precise fragment citations).

The client receives both: the full article for reading, plus fragment-level
citations for precise highlighting.

---

## Complete Flow Diagram

```
User query: "المادة 5 من قانون العمل رقم 12 لسنة 2003"
                │
                ▼
        parseLegalReference()                     [called ONCE in classifier]
        {
          articleNumber: "5",
          lawName:       "قانون العمل رقم 12 لسنة 2003",
          lawNumber:     "12",
          lawYear:       "2003",
          ...
        }
                │
                ▼
        runLawRefQuery() → findByArticle("5", "قانون العمل رقم 12 لسنة 2003", ref)
                │
                ▼
        RULE CHECK: articleNumber="5" ✓  lawName="قانون العمل..." ✓  → proceed
                │
                ▼
        normalizeLawName("قانون العمل رقم 12 لسنة 2003")
          → "قانون العمل رقم 12 لسنة 2003"   (already clean)
        words   = ["قانون", "العمل", "رقم", "12", "لسنة", "2003"]
        nameRegex = "قانون.*العمل.*رقم.*12.*لسنة.*2003"
                │
                ▼
        MongoDB findOne({
          article_number:      "5",
          law_name_normalized: { $regex: "قانون.*العمل.*رقم.*12.*لسنة.*2003", $options: "i" },
          child_index:         { $in: [-1, null] },   ← parents only
          law_number:          "12",                   ← bonus filter
          law_year:            "2003",                 ← bonus filter
          // is_retrievable intentionally omitted
        }).sort({ text_len: -1 })
                │
          ┌─────┴─────┐
       found         not found
          │               │
          ▼               ▼
    fetch children    return null
    { parent_chunk_id: parent.chunk_id,     → caller falls to RAG
      child_index: { $gte: 0 },               with prefix message
      is_retrievable: true }
          │
          ▼
    return {
      ...parent,          ← full article text
      _children: [...]    ← fragment citations
    }
          │
          ▼
    runLawRefQuery builds response:
    {
      answer:       "تم العثور على المادة المطلوبة.\n[المصدر: قانون العمل - المادة 5]\n<full text>",
      source_chunks: [ parent_chunk, child_0, child_1, ... ],
      category:     "law_ref",
      latency_ms:   ~15ms   ← no LLM, no embedding
    }
```

---

## MongoDB Indexes Used

All created by `src/scripts/create-indexes.ts`:

```
article_lookup_idx   { article_number: 1, law_name_normalized: 1, child_index: 1 }
  ↑ used by the findOne() in Step 3

parent_children_idx  { parent_chunk_id: 1, child_index: 1 }
  ↑ used by the children find() in Step 4

chunk_id_idx         { chunk_id: 1 }
  ↑ used by expandWithParentContext() (RAG pipeline, not this function)
```

Without `article_lookup_idx`, every call is a full collection scan of ~22K
documents. With it, the exact lookup + children fetch completes in ~5–15 ms.

---

## Behavior Matrix

| Query | `articleNumber` | `lawName` | `lawNumber`/`lawYear` | Result |
|---|---|---|---|---|
| `"المادة 5 من قانون العمل"` | `"5"` | `"قانون العمل"` | `null`/`null` | Full Article 5 of العمل (name regex only) |
| `"المادة 5 من قانون العمل رقم 12 لسنة 2003"` | `"5"` | `"قانون العمل رقم 12..."` | `"12"`/`"2003"` | Same article, bonus exact filters add precision |
| `"المادة 5"` (no law name) | `"5"` | `null` | — | `null` → falls to RAG (never returns a random law) |
| `"المادة 99 من قانون العمل"` (doesn't exist) | `"99"` | `"قانون العمل"` | — | `null` → falls to RAG with "not found" prefix |
| `"القانون المدنى"` (ى variant) | `null` | `"القانون المدنى"` | — | `null` (no article) → Path 3 (RAG with filters) |
