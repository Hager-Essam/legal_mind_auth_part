# LegalMind Search & Indexing Reference

> **Status**: Implemented
> **Source verified**: `src/scripts/setup-app-indexes.ts`, `src/scripts/setup-atlas-search-indexes.ts`, `src/scripts/create-indexes.ts`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Master Index Matrix](#2-master-index-matrix)
- [3. Application Database Indexes (`legalmind_app`)](#3-application-database-indexes-legalmind_app)
- [4. RAG Database Standard Indexes (`legalmind_rag`)](#4-rag-database-standard-indexes-legalmind_rag)
- [5. MongoDB Atlas Search Indexes](#5-mongodb-atlas-search-indexes)
- [6. Index Setup & Maintenance Commands](#6-index-setup--maintenance-commands)
- [7. Related Documentation](#7-related-documentation)

---

## 1. Overview

This document provides a comprehensive index specification for LegalMind, covering standard Mongoose B-Tree indexes across `legalmind_app` and `legalmind_rag`, alongside Atlas Search indexes for hybrid legal retrieval.

---

## 2. Master Index Matrix

| Database | Collection | Index Name / Fields | Type | Purpose & Supported Query | Script Source |
|---|---|---|---|---|---|
| `legalmind_app` | `users` | `email_1` | Unique B-Tree | Login lookup (`findByEmail`) | `setup-app-indexes.ts` |
| `legalmind_app` | `users` | `role_1_isActive_1` | B-Tree | Admin role queries | `setup-app-indexes.ts` |
| `legalmind_app` | `users` | `organizationId_1` | B-Tree | Organization user listing | `setup-app-indexes.ts` |
| `legalmind_app` | `refresh_tokens` | `tokenHash_1` | Unique B-Tree | Refresh token lookup (`findByTokenHash`) | `setup-app-indexes.ts` |
| `legalmind_app` | `refresh_tokens` | `expiresAt_1` | TTL (0s) | Automatic MongoDB deletion of expired sessions | `setup-app-indexes.ts` |
| `legalmind_app` | `refresh_tokens` | `userId_1_revokedAt_1` | B-Tree | User session revocation queries | `setup-app-indexes.ts` |
| `legalmind_app` | `conversations` | `conversationId_1` | Unique B-Tree | Direct thread lookup | `setup-app-indexes.ts` |
| `legalmind_app` | `conversations` | `ownerUserId_1_status_1_lastMessageAt_-1` | Compound B-Tree | User thread sidebar query | `setup-app-indexes.ts` |
| `legalmind_app` | `messages` | `messageId_1` | Unique B-Tree | Direct message lookup | `setup-app-indexes.ts` |
| `legalmind_app` | `messages` | `conversationId_1_sequence_1` | Unique Compound | Strict chronological turn order & concurrency lock | `setup-app-indexes.ts` |
| `legalmind_app` | `messages` | `ownerUserId_1_idempotencyKey_1` | Unique Sparse | Replay prevention for duplicate browser submissions | `setup-app-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `chunkId_1` | Unique B-Tree | Direct chunk retrieval | `create-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `authorityId_1_articleNumber_1` | Compound B-Tree | Exact article lookup (`LegalRefService`) | `create-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `lawNumber_1_lawYear_1_articleNumber_1` | Compound B-Tree | Article lookup by law number and year | `create-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `appealNumber_1_judicialYear_1` | Compound B-Tree | Court of Cassation ruling lookup | `create-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `governance_filters` | Compound B-Tree | Mandated Egyptian law retrieval filtering | `create-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `legal_chunks_vector` | Atlas Vector | Dense vector search (`text-embedding-v4`, 1024 dims) | `setup-atlas-search-indexes.ts` |
| `legalmind_rag` | `legal_chunks` | `legal_chunks_text` | Atlas Search | Full-text Arabic lexical search (`lucene.arabic`) | `setup-atlas-search-indexes.ts` |

---

## 3. Application Database Indexes (`legalmind_app`)

### 3.1 `messages.conversationId_1_sequence_1` (Unique Compound)
* **Definition**: `{ conversationId: 1, sequence: 1 }`
* **Why Unique**: Guarantees that two messages in the same conversation thread can never share the same sequence number, avoiding race conditions during rapid multi-turn chats.

### 3.2 `refresh_tokens.expiresAt_1` (TTL Index)
* **Definition**: `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`
* **Why Needed**: Enables MongoDB's background TTL thread to automatically purge expired refresh tokens without requiring manual cleanup cron jobs.

---

## 4. RAG Database Standard Indexes (`legalmind_rag`)

### 4.1 Governance Compound Index
* **Definition**: `{ jurisdiction: 1, reviewStatus: 1, authorityStatus: 1, isRetrievable: 1 }`
* **Why Needed**: Accelerates pre-filtering queries so MongoDB can quickly isolate `published` and `effective` Egyptian legal text chunks prior to vector calculations.

---

## 5. MongoDB Atlas Search Indexes

For detailed JSON mappings of `legal_chunks_vector` and `legal_chunks_text`, refer to [MongoDB Atlas Setup Guide](MONGO_ATLAS_SETUP.md).

---

## 6. Index Setup & Maintenance Commands

Execute index creation via standard `npm` package scripts:

```bash
# 1. Create standard B-Tree indexes for legalmind_app
npm run indexes:app

# 2. Create standard B-Tree indexes for legalmind_rag
npm run create-indexes

# 3. Create MongoDB Atlas Search vector and text indexes
npm run atlas:indexes
```

---

## 7. Related Documentation

- [MongoDB Atlas Setup](MONGO_ATLAS_SETUP.md) - Complete Atlas Search vector & text JSON definitions.
- [Database Architecture](DATABASE_ARCHITECTURE.md) - Collection schemas and field types.
- [Retrieval Service Implementation](services/RETRIEVAL_SERVICE_IMPLEMENTATION.md) - RAG execution.
