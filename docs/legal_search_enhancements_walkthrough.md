# Legal Search Enhancements: Handling Deep Legal Structures

This document explains the workarounds implemented to successfully query, retrieve, and summarize deep legal structures (like "Paragraphs" and "Clauses") and exact law years/numbers without needing to change the underlying MongoDB schema or re-chunk the legal text dataset.

## The Challenge

The legal texts ingested into MongoDB are chunked broadly (e.g. at the Article level) and the schema only explicitly stores `article_number`. This means an entire Article containing multiple Paragraphs (الفقرات) or Clauses (البنود) is squashed into a single `text` block. 

Because MongoDB lacks fields like `law_year`, `law_number`, `paragraph_number`, we cannot use strict database `$match` filters to get precisely "Paragraph 2 of Law 12, Year 2003".

## The Solution (Four-Pronged Approach)

We used the advanced `legal-ref-parser.ts` to implement four separate layers of intelligence on top of the existing schema:

### 1. Highly Boosted Text Search Queries (Retrieval Layer)
**File:** `src/services/retrieval.service.ts`

When a user searches for a specific law with a year and number (e.g., "قانون العمل رقم 12 لسنة 2003"), the backend intercepts the query and extracts `lawNumber` and `lawYear`.
It then automatically injects dynamic `should` clauses into the MongoDB Atlas Text Search. 
These clauses look specifically for `"رقم 12"` and `"لسنة 2003"` within the `text` and `law_name_normalized` fields and applies a **high multiplier boost (3.0)** to their scores.
**Result:** Documents matching the exact year and number instantly float to the top of the search results over older or differently numbered laws with the same name.

### 2. Smarter Post-Retrieval Re-ranking (In-Memory Layer)
**File:** `src/utils/evidence-selection.ts`

Even after the database returns top chunks (via Vector + Keyword RRF), we intercept them in-memory. We run `getDeepStructureBoost` to evaluate the chunks against the user's intent. 
If the user asked for `"الفقرة 2"` (Paragraph 2), the system scans the raw text and the `hierarchy_path` of every returned chunk. If a chunk explicitly contains text like `"الفقرة 2"` or `"الفقرة الثانية"`, we artificially boost its rank score by `+0.3`.
**Result:** The precise chunk containing the exact paragraph beats out other chunks of the same article that might be semantically similar.

### 3. Better Routing for General Law Queries
**File:** `src/services/query.service.ts`

Previously, if a user typed a query that identified a Law name/number but failed to specify an exact Article, the system errored out saying "Article number missing". 
We updated `runLawRefQuery` to catch this. If `lawNumber` or `lawYear` is present but `articleNumber` is missing, the system realizes the user wants general information about the law.
**Result:** It seamlessly reroutes the query into the full RAG pipeline (`runArabicRagQuery`) instead of returning an error.

### 4. LLM Prompt Intent Injection (Generation Layer)
**File:** `src/services/query.service.ts`

The ultimate paragraph extractor is the LLM itself. If a chunk contains Article 15 (which has 4 paragraphs), we need the LLM to only summarize Paragraph 2. 
Inside `runArabicRagQuery`, we detect if the user asked for a specific paragraph or clause. We then implicitly append a strict instruction to the final RAG Prompt sent to the AI:
> `ملاحظة هامة للاستخراج: ركز على استخراج الإجابة من الفقرة رقم 2 إن وجدت.`
**Result:** The LLM acts as an on-the-fly "paragraph cropper", reading the broad Article chunk and exclusively responding with the details of the requested paragraph.

---

## Future Roadmap

While these strategies provide a highly robust, immediate solution, a future database migration is recommended:
1. Run a one-time script that utilizes `legal-ref-parser.ts` to iterate over all existing `ChunkDocument` entries in the DB.
2. Extract the deep structures from `hierarchy_path` and `text`.
3. Save them explicitly into new DB fields (e.g. `law_year`, `paragraphs: []`).
4. Update the Vector / Text Search index mappings to support native filtering on these fields.
