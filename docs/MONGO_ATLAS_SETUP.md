# MongoDB Atlas Search Setup & Deployment Guide

> **Status**: Implemented
> **Source verified**: `src/scripts/setup-atlas-search-indexes.ts`, `src/services/retrieval.service.ts`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Prerequisites & Atlas Requirements](#2-prerequisites--atlas-requirements)
- [3. Index Definitions](#3-index-definitions)
  - [3.1 Vector Search Index (`legal_chunks_vector`)](#31-vector-search-index-legal_chunks_vector)
  - [3.2 Text Search Index (`legal_chunks_text`)](#32-text-search-index-legal_chunks_text)
- [4. Automated Setup Script Execution](#4-automated-setup-script-execution)
- [5. Code Coupling & Naming Invariants](#5-code-coupling--naming-invariants)
- [6. Troubleshooting & Verification](#6-troubleshooting--verification)
- [7. Related Documentation](#7-related-documentation)

---

## 1. Overview

LegalMind relies on MongoDB Atlas Search to deliver high-precision hybrid retrieval over Egyptian legal texts. This guide provides the complete JSON index definitions and setup instructions for configuring the two required search indexes on the `legalmind_rag.legal_chunks` collection:
1. `legal_chunks_vector`: Vector Search index matching 1024-dimensional dense embeddings (`text-embedding-v4`).
2. `legal_chunks_text`: Lexical Full-Text Search index utilizing the Lucene Arabic language analyzer.

---

## 2. Prerequisites & Atlas Requirements

- **MongoDB Cluster**: MongoDB Atlas M10+ tier (Vector Search requires M10 or higher for production SLA, or Atlas Flex / M0 for development testing).
- **Collection Location**: `legalmind_rag` database -> `legal_chunks` collection.
- **Database User Permissions**: `readWrite` or `dbAdmin` privileges on `legalmind_rag`.

---

## 3. Index Definitions

### 3.1 Vector Search Index (`legal_chunks_vector`)

This index powers the `$vectorSearch` aggregation stage in `RetrievalService`.

* **Index Name**: `legal_chunks_vector`
* **Target Collection**: `legalmind_rag.legal_chunks`
* **Vector Dimensions**: `1024`
* **Similarity Metric**: `cosine`
* **JSON Definition**:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "jurisdiction"
    },
    {
      "type": "filter",
      "path": "isRetrievable"
    },
    {
      "type": "filter",
      "path": "reviewStatus"
    },
    {
      "type": "filter",
      "path": "authorityStatus"
    }
  ]
}
```

* **Why Filters Are Included**: Pre-filtering inside the vector index ensures non-Egyptian, draft, or quarantined documents are excluded before computing cosine similarity, drastically reducing memory usage and query latency.

---

### 3.2 Text Search Index (`legal_chunks_text`)

This index powers the `$search` aggregation stage in `RetrievalService`.

* **Index Name**: `legal_chunks_text`
* **Target Collection**: `legalmind_rag.legal_chunks`
* **Analyzer**: `lucene.arabic` (Provides Arabic stemming, normalization, and stop-word removal)
* **JSON Definition**:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text": {
        "type": "string",
        "analyzer": "lucene.arabic"
      },
      "textNormalized": {
        "type": "string",
        "analyzer": "lucene.arabic"
      },
      "authorityTitle": {
        "type": "string",
        "analyzer": "lucene.arabic"
      },
      "authorityTitleNormalized": {
        "type": "string",
        "analyzer": "lucene.arabic"
      },
      "articleNumber": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "lawNumber": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "jurisdiction": {
        "type": "token"
      },
      "isRetrievable": {
        "type": "boolean"
      },
      "reviewStatus": {
        "type": "token"
      },
      "authorityStatus": {
        "type": "token"
      }
    }
  }
}
```

---

## 4. Automated Setup Script Execution

Instead of manually creating indexes in the Atlas UI, run the automated setup script included in the repository:

```bash
cd backend-ts
npm run atlas:indexes
```

* **Script Source**: `src/scripts/setup-atlas-search-indexes.ts`
* **Behavior**: Uses the MongoDB Node.js driver `createSearchIndex()` API to create or update both search indexes programmatically.

---

## 5. Code Coupling & Naming Invariants

> [!IMPORTANT]
> The index names `legal_chunks_vector` and `legal_chunks_text` are hardcoded as constants in `src/services/retrieval.service.ts`:
> ```ts
> const VECTOR_INDEX_NAME = "legal_chunks_vector";
> const TEXT_INDEX_NAME = "legal_chunks_text";
> ```
> Changing index names in MongoDB Atlas without updating these TypeScript constants will cause runtime `$vectorSearch` and `$search` aggregation pipeline failures.

---

## 6. Troubleshooting & Verification

### 6.1 Index Build Status Verification
Run the database diagnostic script:
```bash
npm run diagnose
```
This script queries index build statuses and prints the total indexed document count.

### 6.2 Common Issues
- **`MongoServerError: Index not found`**: The index has not finished building. Atlas search index initial builds take 2-5 minutes depending on collection size.
- **`Vector dimension mismatch`**: Ensure `LEGALMIND_EMBEDDING_DIM=1024` matches the `numDimensions: 1024` definition in the vector index.

---

## 7. Related Documentation

- [Search & Indexing Guide](SEARCH_AND_INDEXING.md) - Standard database indexes reference.
- [Retrieval Service Implementation](services/RETRIEVAL_SERVICE_IMPLEMENTATION.md) - RAG retrieval execution.
- [Database Architecture](DATABASE_ARCHITECTURE.md) - Schema specifications.
