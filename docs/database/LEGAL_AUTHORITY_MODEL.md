# Legal Authority Model Specification (Planned Architecture)

> Status: Planned Architecture (Currently Embedded in LegalChunk Model)
> Collection: `legalmind_rag.legal_authorities` (Planned)
> Verified against: `src/legal-governance/authority-status-registry.ts`, `src/models/chunk.model.ts`

---

## Overview

In the current graduation build of LegalMind, authority metadata (`authorityTitle`, `authorityStatus`, `lawNumber`, `lawYear`) is embedded directly on every `LegalChunk` document in `legalmind_rag.legal_chunks`.

This document specifies the planned normalized `LegalAuthority` schema for future enterprise SaaS deployments.

---

## Planned Schema Fields & Types

| Field Name | Type | Required | Description |
|---|---|---|---|
| `_id` | `ObjectId` | Yes | Unique primary key. |
| `authorityId` | `String` | Yes | Unique string identifier (e.g. `'eg-law-12-2003'`). |
| `officialTitle` | `String` | Yes | Official Arabic title (e.g. `'قانون العمل رقم 12 لسنة 2003'`). |
| `normalizedTitle` | `String` | Yes | Normalized title for search matching. |
| `authorityType` | `String` | Yes | Enum (`'constitution'`, `'statute'`, `'regulation'`, `'court_ruling'`). |
| `jurisdiction` | `String` | Yes | Country code (`'EG'`). |
| `lawNumber` | `String` | No | Law number. |
| `lawYear` | `Number` | No | Promulgation year. |
| `authorityStatus` | `String` | Yes | Enum (`'effective'`, `'amended'`, `'repealed'`, `'quarantined'`). |
| `totalArticles` | `Number` | Yes | Total count of child articles. |
| `publishedAt` | `Date` | Yes | Official gazette publication date. |

---

## Migration Plan

When migrating to normalized authorities, operator script `src/scripts/classify-completed-legacy-authorities.ts` will populate `legal_authorities` from existing chunk metadata.

---

## Related Files

* Current registry: `src/legal-governance/authority-status-registry.ts`
* Current chunk model: [Legal Chunk Model](LEGAL_CHUNK_MODEL.md)
* Governance: [Legal Source Governance](../LEGAL_SOURCE_GOVERNANCE.md)
