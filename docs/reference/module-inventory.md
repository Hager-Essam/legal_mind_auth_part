# Backend module inventory

| Area | Primary source | Inputs → outputs | Main dependencies/state |
|---|---|---|---|
| Bootstrap/app | `src/index.ts`, `src/app/create-app.ts` | environment → listening Express app | both Mongo connections |
| Container | `src/services/service-container.ts` | constructors → `AppServices` | service/repository graph |
| Health/errors | `src/routes/health.ts`, `src/middlewares/*` | requests/errors → status/envelope | DB pings, request ID |
| Auth | `src/modules/auth/*` | credentials/tokens → user/session DTOs | users, refresh tokens, email, upload |
| Users/sessions | `src/modules/users/*`, `src/modules/refresh-tokens/*` | normalized records → persistence | app MongoDB |
| Conversations | `src/modules/conversations/*` | owner-scoped CRUD/messages → DTOs | conversations, messages |
| Chat orchestration | `src/services/chat-orchestrator.service.ts` | message/idempotency key → saved turn | memory, query, snapshots |
| Memory | `src/services/conversation-memory.service.ts` | recent messages → standalone query/summary | conversations, messages |
| Query orchestration | `src/services/query.service.ts` | `QueryRequest` → `QueryResponse` | classifier/retrieval/generation |
| Classifier/parser | `src/services/classifier.service.ts`, `src/utils/legal-ref-parser.ts` | query → branch/reference | regex/digit normalization |
| Exact references | `src/services/legal-ref.service.ts` | governed article/ruling → direct answer | legal chunks |
| Rewrite/retrieval | `src/services/query-rewrite.service.ts`, `retrieval.service.ts` | query → candidates | DashScope, Atlas, legal chunks |
| Rerank/grounding | `src/services/reranker.service.ts`, `src/utils/evidence-selection.ts`, `grounding-policy.ts` | candidates → qualified evidence/refusal | rerank provider/heuristic |
| Context/citations | `src/utils/context-builder.ts`, `citation-validator.ts` | evidence/model text → safe context/answer | source IDs |
| Providers | `src/services/provider-*.ts`, `embedding.service.ts`, `generation.service.ts` | HTTP calls → vectors/text/errors | DashScope |
| Chunk storage | `src/models/chunk.model.ts`, `src/schemas/chunk.schema.ts` | permissive DB documents → API chunks | RAG MongoDB |
| Governance | `src/legal-governance/*`, corpus scripts | artifacts/decisions → governed chunks/audits | registry, files, RAG DB |
| Operator scripts | `src/scripts/*` | flags/environment → migrations/indexes/reports | MongoDB/provider/files |
| Evaluator | `src/scripts/evaluate.ts` | questions/live calls → JSON report | full container, judge model |

For field/index details, see [MongoDB schema](../data/mongodb-schema.md) and
[MongoDB indexes](../data/mongodb-indexes.md). Risks and inactive helpers are
tracked in [implementation status](implementation-status.md) and
[known limitations](known-limitations.md).
