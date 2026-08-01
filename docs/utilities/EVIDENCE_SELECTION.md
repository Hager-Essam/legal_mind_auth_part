# Evidence Selection Utility Guide

> Status: Implemented
> Verified against: `src/utils/evidence-selection.ts`
> Related services: RerankerService, QueryService

---

## Overview

`evidence-selection.ts` scores and deduplicates candidate legal text chunks using structural metadata signals (semantic units, article number matches, deep hierarchy paragraph/clause matches, and term overlap).

---

## Functions & Signatures

### `scoreEvidenceChunk(question: string, chunk: LegalChunks): number`
* **Inputs**: User question string, target `LegalChunk`.
* **Outputs**: Calculated score in range `[0.0, 1.0]`.

### `deduplicateEvidence(chunks: LegalChunks[]): LegalChunks[]`
* **Outputs**: Array stripped of duplicate chunk IDs or identical text content.

### `selectTopEvidence(chunks: LegalChunks[], topK: number): LegalChunks[]`

---

## Heuristic Scoring Formula

The structural relevance score combines six weighted components:

\[
\text{Score} = (\text{Similarity} \times 0.45) + (\text{Overlap} \times 0.35) + \text{Boost}_{\text{unit}} + \text{Boost}_{\text{citation}} + \text{Boost}_{\text{article}} + \text{Boost}_{\text{structure}}
\]

* **Similarity**: Dense cosine embedding score.
* **Overlap**: Lexical keyword token overlap ratio (excluding Arabic stop-words).
* **Boost Unit**: `penalty` (+0.12), `obligation` (+0.10), `right` (+0.08), `definition` (+0.06).
* **Boost Article**: Matching requested article number (+0.20).
* **Boost Structure**: Matching requested paragraph (`الفقرة`) or clause (`البند`) (+0.30).

---

## Related Files

* Primary source: `src/utils/evidence-selection.ts`
* Consumers: [RerankerService](../services/RERANKER_SERVICE_IMPLEMENTATION.md), [QueryService](../services/QUERY_SERVICE_IMPLEMENTATION.md)
