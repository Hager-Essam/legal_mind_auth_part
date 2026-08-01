# Reciprocal Rank Fusion (RRF) Utility Guide

> Status: Implemented
> Verified against: `src/utils/rrf.ts`
> Related services: RetrievalService

---

## Overview

`rrf.ts` implements the Reciprocal Rank Fusion (RRF) algorithm to combine multiple ranked candidate lists (dense vector search results and sparse keyword text search results) into a unified, re-scored candidate list without needing score calibration across disparate search engines.

---

## Functions & Signatures

### `reciprocalRankFusion(resultLists: LegalChunks[][], k = 60): LegalChunks[]`
* **Inputs**: Array of ranked `LegalChunks` lists, rank constant `k` (default `60`).
* **Outputs**: Single array of `LegalChunks` sorted by merged `rrf_score` descending.

---

## Mathematical Formula

For a document \( d \) present across rank lists \( L \):

\[
RRF\_Score(d) = \sum_{l \in L} \frac{1}{k + r_l(d)}
\]

where \( r_l(d) \) is the 1-based rank index of document \( d \) in list \( l \), and \( k = 60 \).

---

## Related Files

* Primary source: `src/utils/rrf.ts`
* Consumers: [RetrievalService](../services/RETRIEVAL_SERVICE_IMPLEMENTATION.md)
