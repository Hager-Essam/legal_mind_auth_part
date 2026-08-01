# Chunk Mapper Utility Guide

> Status: Implemented
> Verified against: `src/utils/chunk-mapper.ts`
> Related services: RetrievalService, QueryService

---

## Overview

`chunk-mapper.ts` provides the `toLegalChunk()` converter function that transforms raw Mongoose `ChunkDocument` database records into sanitized, strongly-typed API DTO objects (`LegalChunks`).

---

## Functions & Signatures

### `toLegalChunk(doc: ChunkDocument, score?: number): LegalChunks`
* **Inputs**: Mongoose database document `ChunkDocument`, optional similarity/RRF score number.
* **Outputs**: Cleaned `LegalChunks` schema DTO object with formatted floating-point score (`toFixed(6)`).

---

## Field Mapping Strategy

- Converts database string IDs `_id` to public string `chunk_id`.
- Defaults missing string values to clean `undefined` or default `jurisdiction: 'EG'`.
- Rounds numerical relevance scores to 6 decimal places (`Number(score.toFixed(6))`).

---

## Related Files

* Primary source: `src/utils/chunk-mapper.ts`
* Schemas: `src/schemas/chunk.schema.ts`
* Consumers: [RetrievalService](../services/RETRIEVAL_SERVICE_IMPLEMENTATION.md), [QueryService](../services/QUERY_SERVICE_IMPLEMENTATION.md)
