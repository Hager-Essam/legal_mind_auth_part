# Legal Chunk Model Database Guide

> Status: Implemented
> Collection: `legalmind_rag.legal_chunks`
> Verified against: `src/models/chunk.model.ts`, `src/schemas/chunk.schema.ts`

---

## Overview

The `LegalChunk` model defines the database schema for indexed Egyptian legal text chunks stored in `legalmind_rag.legal_chunks`. It contains 1024-dimensional dense vector embeddings, normalized Arabic text, governance metadata, and parent/child chunk hierarchy references.

---

## Schema Fields & Types

| Field Name | Type | Required | Description |
|---|---|---|---|
| `chunk_id` | `String` | Yes | Unique string chunk identifier. |
| `authorityId` | `String` | No | Identifier of parent law or legal instrument. |
| `authorityTitleOfficial` | `String` | No | Official title of law in Arabic. |
| `authorityTitleNormalized` | `String` | No | Normalized Arabic title for text search matching. |
| `authorityType` | `String` | No | Enum (`'constitution'`, `'statute'`, `'regulation'`, `'court_ruling'`, `'official_guidance'`, `'secondary_source'`, `'generated_summary'`). |
| `jurisdiction` | `String` | Yes | Country code (Default: `'EG'`). |
| `law_number` | `String` | No | Official law number string (e.g. `'12'`). |
| `law_year` | `String` | No | Law year string (e.g. `'2003'`). |
| `article_number` | `String` | No | Article number (e.g. `'12'`). |
| `appeal_number` | `String` | No | Cassation court appeal number. |
| `judicial_year` | `String` | No | Cassation court judicial year. |
| `ruling_date` | `String` | No | Date of court judgment. |
| `case_subject` | `String` | No | Legal subject of court ruling. |
| `text` / `content` | `String` | Yes | Full legal chunk text content. |
| `textNormalized` | `String` | No | Normalized Arabic text content. |
| `text_len` | `Number` | Yes | Character length of chunk text. |
| `embedding` | `Array<Number>` | No | 1024-dimensional dense vector (`text-embedding-v4`). |
| `authorityStatus` | `String` | No | Enum (`'effective'`, `'amended'`, `'repealed'`, `'historical'`, `'unknown'`). |
| `reviewStatus` | `String` | No | Enum (`'draft'`, `'reviewed'`, `'published'`, `'quarantined'`). |
| `is_retrievable` | `Boolean` | Yes | Retrieval eligibility flag. |
| `parent_chunk_id` | `String` | No | Chunk ID of parent document for hierarchy expansion. |
| `child_index` | `Number` | No | Index among sibling chunks (`-1` or `null` for parent). |

---

## Atlas Search Indexes

- `legal_chunks_vector`: Vector search index (1024 dims, cosine similarity).
- `legal_chunks_text`: Full-text search index (`lucene.arabic` analyzer).

---

## Related Files

* Model source: `src/models/chunk.model.ts`
* Schema source: `src/schemas/chunk.schema.ts`
* Atlas setup: [MongoDB Atlas Setup](../MONGO_ATLAS_SETUP.md)
* Governance: [Legal Source Governance](../LEGAL_SOURCE_GOVERNANCE.md)
