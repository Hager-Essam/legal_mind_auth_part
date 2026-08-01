# Implementation status

## Implemented and active

- Express bootstrap, request IDs, exact-origin CORS, JSON/cookie parsing,
  global errors, health/readiness, authentication, standalone query, and
  persistent conversation APIs.
- Users, refresh-token rotation, email verification/password reset, and private
  lawyer-ID upload.
- Three query branches: social chat, direct exact legal reference, and hybrid
  Arabic RAG.
- Query rewriting, embeddings, Atlas Vector Search, best-effort Atlas Search,
  RRF, LLM/heuristic reranking, grounding, escaped context, generation fallback,
  citation-ID validation, and source snapshots.
- Mongo/App index, migration, corpus import/publication/re-embedding/audit, and
  evaluation operator scripts that exist in `backend-ts/src/scripts/`.

## Implemented but unused

- `RetrievalService.expandWithParentContext`.
- `utils/lru-cache.ts`.
- `authorize` and `optionalAuth` authentication middleware.
- Classifier regular-expression constants in `regex/classifier.patterns.ts`.
- Chapter/part parser patterns and several exact-answer helpers.

These are not part of the current request path.

## Planned—Not Implemented

Query enhancement modes are a proposal only; see
[the preserved plan](../plans/query-enhancement-mode.md). No
`enhancement_mode` HTTP field or runtime type exists.

### Contract analysis

**Planned—Not Implemented.** This repository contains no contract-analysis
routes, controllers, schemas, models, services, utilities, or tests. Therefore
there is no executable flow to document. Supply an implementation or approved
specification before adding an architecture/API guide.

## Not implemented as collections

`legal_authorities`, `corpus_releases`, `audit_events`, and all contract
collections are absent. The implemented collections are listed in
[MongoDB schema](../data/mongodb-schema.md).

## Known broken package aliases

`npm run migrate`, `npm run diagnose`, and `npm run view-db` reference absent
TypeScript files. They are retained in `package.json` but must not be presented
as working operator commands.
