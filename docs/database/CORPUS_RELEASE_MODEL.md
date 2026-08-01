# Corpus Release Model Specification (Planned Architecture)

> Status: Planned Architecture (Currently Scripted via Audit Scripts)
> Collection: `legalmind_rag.corpus_releases` (Planned)
> Verified against: `src/scripts/audit-legal-corpus.ts`, `src/services/source-snapshot.service.ts`

---

## Overview

In the current graduation scope, legal corpus release versions are tracked via operator audit scripts (`audit-legal-corpus.ts`). This document outlines the planned `CorpusRelease` collection model for future SaaS data governance.

---

## Planned Schema Fields & Types

| Field Name | Type | Required | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Yes | Unique primary key. |
| `releaseId` | `String` | Yes | Unique string release ID (e.g. `'rel_2026_07_v1'`). |
| `version` | `String` | Yes | Version string (e.g. `'1.2.0'`). |
| `chunkCount` | `Number` | Yes | Total number of published legal chunks in release. |
| `authorityCount` | `Number` | Yes | Total number of legal authorities included. |
| `embeddingModel` | `String` | Yes | Embedding model used (`'text-embedding-v4'`). |
| `vectorDimension` | `Number` | Yes | Vector dimension (`1024`). |
| `releasedBy` | `String` | Yes | Administrator ID who approved release. |
| `releasedAt` | `Date` | Yes | Publication timestamp. |

---

## Related Files

* Audit script: `src/scripts/audit-legal-corpus.ts`
* Snapshot service: [Source Snapshot Service](../services/SOURCE_SNAPSHOT_IMPLEMENTATION.md)
* Governance: [Legal Source Governance](../LEGAL_SOURCE_GOVERNANCE.md)
