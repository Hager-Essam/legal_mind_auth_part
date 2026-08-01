# LegalMind Legal Source Governance & Corpus Lifecycle

> **Status**: Implemented with Known Limitations
> **Source verified**: `src/legal-governance/authority-status-registry.ts`, `src/scripts/audit-legal-corpus.ts`, `src/scripts/apply-verified-authority-statuses.ts`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Governance Metadata Flags](#2-governance-metadata-flags)
  - [2.1 Jurisdiction Scoping (`jurisdiction`)](#21-jurisdiction-scoping-jurisdiction)
  - [2.2 Retrieval Eligibility (`isRetrievable`)](#22-retrieval-eligibility-isretrievable)
  - [2.3 Review Lifecycle (`reviewStatus`)](#23-review-lifecycle-reviewstatus)
  - [2.4 Legal Validity (`authorityStatus`)](#24-legal-validity-authoritystatus)
  - [2.5 Authority Type Weighting (`authorityType`)](#25-authority-type-weighting-authoritytype)
  - [2.6 Text Fidelity (`textStatus`)](#26-text-fidelity-textstatus)
- [3. Mandatory Retrieval Filter Rules](#3-mandatory-retrieval-filter-rules)
- [4. Authority Status Registry System](#4-authority-status-registry-system)
- [5. Corpus Management & Maintenance Scripts](#5-corpus-management--maintenance-scripts)
- [6. Known Limitations & Recommended SaaS Improvements](#6-known-limitations--recommended-saas-improvements)
- [7. Related Documentation](#7-related-documentation)

---

## 1. Overview

LegalMind operates over primary Egyptian legal materials (statutes, codes, executive regulations, and Court of Cassation rulings). To guarantee legal reliability and prevent outdated, unverified, or non-Egyptian legal text from corrupting answers, the system enforces a strict **Legal Source Governance Model** during retrieval and ingestion.

---

## 2. Governance Metadata Flags

Every `LegalChunk` document stored in `legalmind_rag.legal_chunks` is tagged with explicit governance metadata fields.

### 2.1 Jurisdiction Scoping (`jurisdiction`)
* **Value**: Always `'EG'` for Egyptian legal materials.
* **Purpose**: Restricts RAG retrieval strictly to Egyptian legal materials, preventing non-Egyptian legal principles from corrupting Egyptian law answers.

### 2.2 Retrieval Eligibility (`isRetrievable`)
* **Type**: Boolean (`true` or `false`).
* **Purpose**: Explicit permission flag. Only documents explicitly marked `isRetrievable: true` are accessible by `RetrievalService`.
* **Constraint**: Missing values must **never** default to `true`.

### 2.3 Review Lifecycle (`reviewStatus`)
Tracks the editorial review state of imported legal text:
* `draft`: Initial text ingestion or OCR output; barred from standard retrieval.
* `reviewed`: Human legal editor checked text structure; pending publishing.
* `published`: Fully verified legal text eligible for production RAG retrieval.
* `quarantined`: Flagged for formatting issues, legal dispute, or corruption; excluded from retrieval.

### 2.4 Legal Validity (`authorityStatus`)
Tracks the legislative status of the parent law or ruling:
* `effective`: Active, binding Egyptian legislation or active precedent.
* `amended`: Active law containing official legislative amendments.
* `repealed`: Superseded or abolished law; barred from standard RAG retrieval unless explicitly queried via a historical research endpoint.
* `quarantined`: Suspended pending status audit.
* `historical`: Archival legal text.
* `unknown`: Unverified status; barred from standard production retrieval.

### 2.5 Authority Type Weighting (`authorityType`)
Hierarchy of legal authorities used during evidence selection scoring:
1. `constitution`: Egyptian Constitution (Highest legal authority).
2. `statute`: Codes and Laws passed by Parliament.
3. `regulation`: Executive Regulations and Ministerial Decrees.
4. `court_ruling`: Court of Cassation Judgments.
5. `secondary_source` / `summary`: Derived summaries (Never treated as primary legal text).

### 2.6 Text Fidelity (`textStatus`)
* `verbatim`: Exact character-for-character official legal text.
* `extracted`: OCR or automated text extraction.
* `summary`: Derived executive summary.

---

## 3. Mandatory Retrieval Filter Rules

Standard RAG queries executed by `RetrievalService` enforce the following strict MongoDB filter:

```json
{
  "jurisdiction": "EG",
  "isRetrievable": true,
  "reviewStatus": "published",
  "authorityStatus": { "$in": ["effective", "amended"] }
}
```

---

## 4. Authority Status Registry System

The authority status registry (`src/legal-governance/authority-status-registry.ts`) manages verified legal authority classifications across Egyptian law categories (e.g., Labor Law No. 12 of 2003, Civil Code No. 131 of 1948, Social Insurance Law No. 148 of 2019).

```ts
export const AUTHORITY_STATUS_REGISTRY: Record<string, AuthorityGovernanceEntry> = {
  "eg-law-12-2003": {
    authorityId: "eg-law-12-2003",
    authorityTitle: "قانون العمل رقم 12 لسنة 2003",
    status: "effective",
    isRetrievable: true,
    reviewStatus: "published"
  }
  // Additional registered laws...
};
```

---

## 5. Corpus Management & Maintenance Scripts

The repository includes dedicated operator scripts to audit and manage the legal corpus:

- `audit-legal-corpus.ts` (`npm run audit:legal-corpus`): Generates a CSV audit report of all authorities in `legal_chunks`, identifying missing metadata, draft chunks, and unclassified laws.
- `apply-verified-authority-statuses.ts` (`npm run migrate:verified-authority-statuses`): Bulk-updates database chunks using the authoritative status registry.
- `publish-legacy-legal-chunks.ts` (`npm run publish:legacy-legal-chunks`): Transition reviewed legacy chunks to `published`.
- `reembed-legal-chunks.ts` (`npm run reembed:legal-chunks`): Re-generates 1024-dim dense vector embeddings for chunks using `text-embedding-v4`.
- `import-official-labor-law-2025.ts` (`npm run import:official-labor-law-2025`): Ingests the new 2025 Egyptian Labor Law amendments into `legal_chunks`.

---

## 6. Known Limitations & Recommended SaaS Improvements

### Current Implementation Limitations
1. **Embedded Authority State**: Authority metadata is duplicated across all child chunk records rather than stored in a normalized `legal_authorities` collection.
2. **Static Registry File**: Governance statuses are updated via TypeScript code edits (`authority-status-registry.ts`) rather than an admin API portal.

### Recommended SaaS Improvements
1. **Dedicated Governance API**: Build an admin dashboard for legal editors to publish, quarantine, or update law statuses dynamically.
2. **Normalized Authority Model**: Implement separate `legal_authorities` and `corpus_releases` database collections.

---

## 7. Related Documentation

- [Database Architecture](DATABASE_ARCHITECTURE.md) - Collection schemas and fields.
- [Legal Chunk Model](database/LEGAL_CHUNK_MODEL.md) - Deep dive into LegalChunk schema.
- [Retrieval Service Implementation](services/RETRIEVAL_SERVICE_IMPLEMENTATION.md) - Search filtering.
