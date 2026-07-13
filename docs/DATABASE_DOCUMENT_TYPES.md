# Database Document Types — Full Explanation

## Start Here: What Is a "Chunk"?

The database does not store entire law PDFs as single documents. Each PDF is
broken into small pieces called **chunks**. Each chunk is one MongoDB document
in the `legal_chunks` collection.

Why small pieces? Because the vector search model has a token limit. You cannot
embed a 200-page law book as a single vector. You split it into paragraphs or
articles, embed each one separately, and search across all of them.

Every chunk document has these key fields:

```
chunk_id          — unique identifier for this chunk
parent_chunk_id   — which chunk is this chunk's parent
child_index       — this chunk's position number (-1 = parent, 0/1/2... = child)
text              — the actual legal text
text_len          — length of text in characters
embedding         — the vector representation of the text (1536 numbers)
is_retrievable    — true/false: should this chunk appear in search results?
article_number    — e.g. "5"
law_name          — e.g. "قانون العمل رقم 12 لسنة 2003"
law_name_normalized — same but normalized (hamza, ya, digits)
```

---

## The Three Types of Documents

Your collection has 22,727 documents split into exactly three types.

---

### Type 1 — Atomic Original Chunk

**Count: 16,941 documents**

This is the simplest case. An article (or section of a court ruling) was short
enough to be ingested as a single chunk. It was never split.

```
┌──────────────────────────────────────────────────────────────────┐
│  chunk_id:        "qanon-amal-art5"                              │
│  article_number:  "5"                                            │
│  law_name:        "قانون العمل رقم 12 لسنة 2003"                │
│  child_index:     -1           ← -1 means "I am a parent"       │
│  parent_chunk_id: "doc-001"   ← points to the source document   │
│  text:            "المادة الخامسة: يُطبَّق هذا القانون على..."   │
│  text_len:        850                                            │
│  embedding:       [0.12, -0.34, 0.87, ...]   ← 1536 numbers     │
│  is_retrievable:  true         ← appears in search results       │
└──────────────────────────────────────────────────────────────────┘
```

**Properties:**
- `child_index = -1` (it is a parent, never split)
- `is_retrievable = true` (appears in vector search and text search)
- Has an embedding (the text was embedded during ingestion)
- Standalone — does not depend on any other chunk for its text

---

### Type 2 — Restored Split Parent

**Count: 1,285 documents**

This is the most important type to understand. Here is the full story:

**The original problem:**

Some articles are very long — a single court ruling can be 4,000–8,000
characters. When the Python ingestion pipeline processed these, it split each
long chunk into smaller pieces called children. After splitting, it **deleted
the original parent document** from the collection.

The result:

```
BEFORE INGESTION (original article, 4,534 chars):
┌─────────────────────────────────────────────────────────────────┐
│  chunk_id: "abc"                                                │
│  text: "المادة الخامسة: [full 4534 characters of article text]" │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Python splits into children
                              ↓
AFTER SPLITTING (what ended up in the DB):

  chunk_id: "abc_c000"    text: "المادة الخامسة: [first 3171 chars]"
  chunk_id: "abc_c001"    text: "[remaining 1363 chars]"

  ← "abc" (the parent) was DELETED
```

**The problem this caused:**

The backend's `expandWithParentContext()` function fetches the parent chunk
when it needs to give the LLM full context around a retrieved child. It does:

```typescript
ChunkModel.find({ chunk_id: { $in: parentIds } })
```

But the parent (`"abc"`) was deleted. The lookup returned nothing. The LLM
received a tiny 3,171-character fragment instead of the full 4,534-character
article. Context was lost.

**The fix — `restore-split-parents.ts`:**

The script was written to reconstruct the missing parents:

```
Step 1: Find all parent_chunk_ids referenced by children
        that do NOT exist as documents in the collection.
        → Found 1,285 missing parents.

Step 2: For each missing parent:
        - Fetch its children sorted by child_index (0, 1, 2...)
        - Join their texts with \n to reconstruct full article text
        - Copy metadata (law_name, article_number, etc.) from children
        - Insert the reconstructed parent back into the collection

Step 3: Verify all orphaned children now have a parent.
        → 0 orphans remaining.
```

The restored parent document looks like this:

```
┌──────────────────────────────────────────────────────────────────┐
│  chunk_id:        "abc"                                          │
│  article_number:  "5"                                            │
│  law_name:        "قانون العمل رقم 12 لسنة 2003"                │
│  child_index:     -1           ← it is a parent                 │
│  text:            "المادة الخامسة: [full 4534 chars]"            │
│                   (reconstructed by joining children 0 + 1)     │
│  text_len:        4534                                           │
│  embedding:       null         ← NOT embedded                    │
│  is_retrievable:  false        ← does NOT appear in search       │
│  _restored:       true         ← marker that it was restored     │
│  _restored_from:  2            ← reconstructed from 2 children   │
└──────────────────────────────────────────────────────────────────┘
```

**Why `is_retrievable = false`?**

The parent holds the SAME text as its children combined. If it were marked
`is_retrievable = true`, it would appear in vector search results alongside
its children. The same article would show up twice (or three times), wasting
result slots and confusing the user. The parent's only job is to provide
full-text context when a child is retrieved. It should never appear directly
in search results.

---

### Type 3 — Auto-Split Child

**Count: 4,501 documents**

When a long article was split by the ingestion pipeline, each resulting piece
is a child chunk. Children are what the search system actually retrieves.

```
┌──────────────────────────────────────────────────────────────────┐
│  chunk_id:        "abc_c000"                                     │
│  parent_chunk_id: "abc"        ← points to the parent           │
│  child_index:     0            ← first child (0-based)          │
│  article_number:  "5"                                            │
│  law_name:        "قانون العمل رقم 12 لسنة 2003"                │
│  text:            "المادة الخامسة: [first 3171 chars]"           │
│  text_len:        3171                                           │
│  embedding:       [0.08, -0.41, 0.93, ...]   ← has embedding    │
│  is_retrievable:  true         ← appears in search results       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  chunk_id:        "abc_c001"                                     │
│  parent_chunk_id: "abc"        ← same parent                    │
│  child_index:     1            ← second child                   │
│  article_number:  "5"          ← same article number            │
│  law_name:        "قانون العمل رقم 12 لسنة 2003"                │
│  text:            "[remaining 1363 chars of article 5]"          │
│  text_len:        1363                                           │
│  embedding:       [-0.22, 0.61, 0.15, ...]   ← has embedding    │
│  is_retrievable:  true         ← appears in search results       │
└──────────────────────────────────────────────────────────────────┘
```

**Properties:**
- `child_index >= 0` (sequential: 0, 1, 2...)
- `parent_chunk_id` points to their parent
- `is_retrievable = true` (they ARE the search results)
- Have embeddings (they were embedded at ingestion)
- Article number, law name etc. are copied from the original article

---

## All Three Types Side by Side

```
                    Type 1              Type 2              Type 3
                    Atomic Original     Restored Split      Auto-Split
                                        Parent              Child
────────────────────────────────────────────────────────────────────────
Count               16,941              1,285               4,501
child_index         -1                  -1                  0, 1, 2...
parent_chunk_id     document_id         document_id         "abc" (parent)
is_retrievable      true                FALSE               true
embedding           ✅ has one          ❌ null             ✅ has one
text                full article        reconstructed       fragment
                                        (children joined)   (piece of article)
Appears in search?  ✅ YES              ❌ NO               ✅ YES
────────────────────────────────────────────────────────────────────────
```

---

## The Relationships Between Types

The three types form a tree structure:

```
Source document (PDF article)
│
├── Was it long? ──── NO ──────────────────────────────►  Type 1 (Atomic Original)
│                                                          child_index = -1
│                                                          is_retrievable = true
│                                                          has embedding
│
└── Was it long? ──── YES
                       │
                       ├── Type 2 (Restored Split Parent)
                       │   chunk_id = "abc"
                       │   child_index = -1
                       │   is_retrievable = FALSE    ← hidden from search
                       │   text = child0 + child1 + child2  (reconstructed)
                       │
                       ├── Type 3 child 0
                       │   chunk_id = "abc_c000"
                       │   parent_chunk_id = "abc"   ← points up to parent
                       │   child_index = 0
                       │   is_retrievable = true      ← appears in search
                       │
                       ├── Type 3 child 1
                       │   chunk_id = "abc_c001"
                       │   parent_chunk_id = "abc"
                       │   child_index = 1
                       │   is_retrievable = true
                       │
                       └── Type 3 child 2 (if article had 3 pieces)
                           chunk_id = "abc_c002"
                           parent_chunk_id = "abc"
                           child_index = 2
                           is_retrievable = true
```

**Key rule:** Type 2 parent's text = Type 3 children's texts joined in order.

```
parent.text = child_0.text + "\n" + child_1.text + "\n" + child_2.text
```

The parent is the union of all its children. No information is lost.

---

## How the RAG Pipeline Uses the Types

When a user asks a general legal question (not requesting a specific article):

```
User: "ما هي حقوق العامل في حالة الفصل التعسفي؟"

Step 1 — Vector search + text search
         Searches ONLY is_retrievable=true documents
         → Can return Type 1 (atomic) or Type 3 (children)
         → Type 2 parents are invisible here

         Result: [ child_c000 (score 0.91),
                   child_c001 (score 0.87),
                   atomic_xyz (score 0.84) ]

Step 2 — Reranking
         Scores and picks top-K from the candidates

Step 3 — expandWithParentContext()
         For each retrieved Type 3 child:
           look up its parent (Type 2) by parent_chunk_id
           replace child's text with parent's full text
         For each retrieved Type 1 atomic:
           no expansion needed, already has full text

         → LLM receives full article texts, not fragments

Step 4 — LLM generates answer from full context
```

The Type 2 parent exists ONLY to serve Step 3. It is never a search result.
It is a context supplier.

---

## How `findByArticle` Uses the Types

When a user asks for a SPECIFIC article by number:

```
User: "المادة 5 من قانون العمل"

findByArticle("5", "قانون العمل", reference)
```

The function needs the **complete Article 5 text** to show the user directly.
It does NOT do semantic search. It asks MongoDB a direct question.

**Which types can satisfy this?**

```
Type 1 (Atomic Original)
  child_index = -1      → has full article text          ✅ WANT THIS
  is_retrievable = true

Type 2 (Restored Split Parent)
  child_index = -1      → has full article text          ✅ WANT THIS
  is_retrievable = false

Type 3 (Auto-Split Child)
  child_index >= 0      → has FRAGMENT only              ❌ DON'T WANT
  is_retrievable = true
```

We want Type 1 AND Type 2 (both have full article text).
We don't want Type 3 (only a fragment).

**How the filter selects the right types:**

```typescript
{
  article_number:      "5",
  law_name_normalized: { $regex: "قانون.*العمل", $options: "i" },
  child_index:         { $in: [-1, null] },   // ← selects Type 1 AND Type 2
  // is_retrievable is NOT here               // ← would exclude Type 2 if added
}
```

`child_index: { $in: [-1, null] }` means:
- `child_index = -1` → matches Type 1 ✅ and Type 2 ✅
- `child_index = null` → matches any document where the field is missing ✅ (safety net)
- `child_index = 0, 1, 2...` → does NOT match → Type 3 excluded ✅

If `is_retrievable: true` were added to the filter:
- Type 1 (is_retrievable=true) → still found ✅
- Type 2 (is_retrievable=false) → EXCLUDED ❌ ← breaks split articles
- Type 3 → already excluded by child_index filter

The 1,285 Type 2 documents are `is_retrievable: false` on purpose (to hide
them from search). Adding that filter to `findByArticle` would make them
invisible to exact lookup too — the wrong article (or null) would be returned
for every split article.

**After finding the parent, it fetches the children:**

```typescript
// Found parent (Type 1 or Type 2): chunk_id = "abc"
// Now fetch its Type 3 children for fragment-level citations

ChunkModel.find({
  parent_chunk_id: "abc",
  child_index:     { $gte: 0 },   // Type 3 only
  is_retrievable:  true,
})
```

The result returned to the caller:

```
{
  // Everything from the parent (full article text)
  chunk_id: "abc",
  text: "المادة الخامسة: [full 4534 chars]",
  article_number: "5",
  ...

  // Children attached as supplementary citations
  _children: [
    { chunk_id: "abc_c000", text: "[first 3171 chars]", child_index: 0 },
    { chunk_id: "abc_c001", text: "[last 1363 chars]",  child_index: 1 },
  ]
}
```

The API response gives the user:
- `answer` — formatted from the parent's full text (no LLM needed)
- `source_chunks[0]` — the parent chunk (full article)
- `source_chunks[1..n]` — the child chunks (precise fragment citations)

---

## Summary: Which Type Goes Where

```
                        Vector Search    findByArticle    expandWithParentContext
                        (RAG pipeline)   (exact lookup)   (context expansion)
────────────────────────────────────────────────────────────────────────────────
Type 1  Atomic          ✅ retrieved     ✅ found          (no expansion needed)
        is_ret=true     by search        by lookup

Type 2  Split Parent    ❌ hidden        ✅ found          ✅ used as full context
        is_ret=false    from search      by lookup         for its children

Type 3  Child           ✅ retrieved     ❌ excluded        (triggers expansion
        is_ret=true     by search        by child_index     → fetches Type 2 parent)
────────────────────────────────────────────────────────────────────────────────
```

Each type has exactly one role. The system works because each role has a
different access pattern, and the filters are written to match exactly that.
