# Legal Reference Service Implementation Guide

> Status: Implemented
> Verified against: `src/services/legal-ref.service.ts`
> Related services: QueryService, RetrievalService

---

## Overview

`LegalRefService` generates formatted text answers and citations when an exact legal reference (article number, law number/year) or Court of Cassation ruling (appeal number, judicial year) is matched directly in the database.

---

## Inputs and Outputs

### Constructor Dependencies
None (`LegalRefService` is stateless).

### Public Methods

#### `buildExactMatchAnswer(doc: ChunkDocument): string`
* **Inputs**: Matched Mongoose `ChunkDocument`.
* **Outputs**: Formatted Arabic string with source header `[المصدر: <lawName> - المادة <articleNumber>]`.

#### `buildRulingAnswer(doc: ChunkDocument): string`
* **Inputs**: Matched Cassation court ruling `ChunkDocument`.
* **Outputs**: Formatted Arabic string with appeal number, judicial year, ruling date, and subject header.

#### `buildMissingArticleNumberAnswer(): string`
#### `buildNoExactMatchAnswer(ref: ParsedLegalReference): string`
#### `buildNoRulingMatchAnswer(ref: ParsedLegalReference): string`

---

## Dependency Diagram

```mermaid
flowchart LR
    QueryService --> LegalRefService
```

---

## Step-by-Step Runtime Flow

1. Called by `QueryService.runLawReference()` when exact lookup finds target chunk.
2. Extracts law name, article number, content, or appeal details from document fields.
3. Formats verbatim legal text into clean Markdown output.
4. Returns answer string.

---

## Function-by-Function Analysis

### `buildExactMatchAnswer(doc: ChunkDocument): string`
Builds verbatim response string for exact statutory article matches.

### `buildRulingAnswer(doc: ChunkDocument): string`
Builds response string for Cassation Court ruling matches.

---

## Configuration
No environment variables required.

---

## Database Interaction
None (Formats in-memory Mongoose document).

---

## Security Implications
* Guarantees exact article text matches are returned verbatim without LLM hallucination risk.

---

## Known Limitations

### Current implementation
* Formatting strings are static in code.

---

## Tests
* Unit test: `src/query-tests/legal-query.unit.test.ts`

---

## Related Files and Call Sites

* Primary source: `src/services/legal-ref.service.ts`
* Consumers: [QueryService](QUERY_SERVICE_IMPLEMENTATION.md)
