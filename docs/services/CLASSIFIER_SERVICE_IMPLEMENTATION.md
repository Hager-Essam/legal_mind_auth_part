# Classifier Service Implementation Guide

> Status: Implemented
> Verified against: `src/services/classifier.service.ts`
> Related services: QueryService, LegalRefService, GenerationService

---

## Overview

`ClassifierService` determines the execution path of incoming queries before retrieval or generation runs. It identifies:
1. Social chat (e.g. greetings, thanks) which bypasses retrieval.
2. Exact legal references (e.g. specific article numbers or cassation appeal numbers) which route to exact lookup.
3. General legal questions which route to hybrid search.

---

## Inputs and Outputs

### Constructor Dependencies
None (`ClassifierService` is stateless).

### Public Methods

#### `classify(request: QueryRequest): ClassificationResult`
* **Inputs**: `QueryRequest` containing `query` string.
* **Outputs**: `ClassificationResult` (`category: 'chat' | 'law_ref' | 'arabic_rag'`, optional `parsedReference`).
* **Errors**: None.
* **Side Effects**: None.

---

## Dependency Diagram

```mermaid
flowchart LR
    QueryService --> ClassifierService
    ClassifierService --> legalRefParser["legal-ref-parser.ts"]
```

---

## Step-by-Step Runtime Flow

1. Trims query whitespace.
2. Tests query against `socialOnlyPatterns`. If matched, returns `{ category: 'chat' }`.
3. Strips non-substantive greeting prefixes via `stripGreetingPrefix()`.
4. Runs `parseLegalReference()` against full query.
5. If `articleNumbers`, `appealNumber`, `lawNumber`, or `lawYear` exist, returns `{ category: 'law_ref', parsedReference }`.
6. Otherwise, returns `{ category: 'arabic_rag' }`.

---

## Function-by-Function Analysis

### `stripGreetingPrefix(query: string): string`
* **Purpose**: Removes introductory salutations (*"السلام عليكم"*, *"مرحباً"*) leaving the substantive question intact.

### `classify(request: QueryRequest): ClassificationResult`
* **Purpose**: Primary classifier entry point called by `QueryService`.

---

## Configuration
No environment variables required.

---

## Database Interaction
None (Stateless pattern matching).

---

## Security Implications
* Prevents unnecessary database load for conversational greetings.
* Strips salutations to prevent prompt clutter.

---

## Known Limitations

### Current implementation
* Uses fixed regex arrays; does not support dynamic localized greetings.

### Recommended future improvement
* Support context-aware intent classification via lightweight ML classifier for complex multi-lingual queries.

---

## Tests
* Unit test: `src/query-tests/legal-query.unit.test.ts`

---

## Related Files and Call Sites

* Primary source: `src/services/classifier.service.ts`
* Consumers: [QueryService](QUERY_SERVICE_IMPLEMENTATION.md)
* Utilities: [Legal Reference Parser](../utilities/LEGAL_REFERENCE_PARSER.md)
