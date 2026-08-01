# LegalMind Backend Master Documentation Index

Welcome to the technical documentation suite for the **LegalMind Backend** (`backend-ts/`). This documentation describes the actual implemented architecture, RAG pipelines, authentication mechanisms, database models, and service interfaces.

---

## Targeted Reading Paths

Select the recommended reading path tailored to your role:

### 1. New Developer Onboarding Path
1. [Backend System Architecture](BACKEND_ARCHITECTURE.md) - High-level system structure, tech stack, and container graph.
2. [Request Lifecycle](REQUEST_LIFECYCLE.md) - Complete trace of HTTP requests from entry point to database persistence.
3. [Database Architecture](DATABASE_ARCHITECTURE.md) - Dual database topology (`legalmind_app` vs. `legalmind_rag`).
4. [Legal Query Pipeline](LEGAL_QUERY_PIPELINE.md) - RAG query classification, hybrid search, reranking, and generation.
5. [Conversation Architecture](CONVERSATION_ARCHITECTURE.md) - Thread memory, sequence allocation, and source snapshots.
6. [Auth Architecture](AUTH_ARCHITECTURE.md) - JWT token security, refresh rotation, and cookie configurations.
7. [Service Implementation Guides](services/CLASSIFIER_SERVICE_IMPLEMENTATION.md) - Individual service specs.
8. [Testing Strategy](TESTING_STRATEGY.md) - Test suites and benchmark evaluation execution.

### 2. Graduation Evaluator Path
1. [Project Overview & Architecture](BACKEND_ARCHITECTURE.md) - System goals, technologies, and graduation scope.
2. [Legal Query RAG Pipeline](LEGAL_QUERY_PIPELINE.md) - Multi-stage Egyptian legal retrieval and grounding policy.
3. [Conversation Persistence & Idempotency](CONVERSATION_ARCHITECTURE.md) - Sequence ordering, memory resolution, and immutable snapshots.
4. [Security & Data Isolation](SECURITY_ARCHITECTURE.md) - Authentication, ownership boundaries, and prompt injection defense.
5. [Graduation Demo Guide](GRADUATION_DEMO.md) - Step-by-step evaluator testing guide.

### 3. Backend Maintainer & Operator Path
1. [Environment Configuration](ENVIRONMENT_CONFIGURATION.md) - Master environment variable reference table.
2. [Database Architecture & Indexes](DATABASE_ARCHITECTURE.md) - Dual-database collection schemas and standard indexes.
3. [Search & Indexing](SEARCH_AND_INDEXING.md) - Master index reference matrix.
4. [MongoDB Atlas Setup](MONGO_ATLAS_SETUP.md) - Atlas Vector Search and Text Search JSON index definitions.
5. [Error Handling & Reliability](ERROR_HANDLING_AND_RELIABILITY.md) - Fault tolerance, retry backoff, and fallbacks.
6. [API Reference](API_REFERENCE.md) - Full OpenAPI REST endpoint specifications.

---

## Documentation Sitemap

### Core Architecture & System Guides (`docs/`)
- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) - High-level architecture, technology stack, and container graph.
- [REQUEST_LIFECYCLE.md](REQUEST_LIFECYCLE.md) - End-to-end request execution flows (Login, Chat turn, Idempotency, Tokens).
- [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md) - Authentication, JWT access tokens, refresh rotation, cookies, and RBAC.
- [CONVERSATION_ARCHITECTURE.md](CONVERSATION_ARCHITECTURE.md) - Conversation lifecycle, sequence numbers, memory, and snapshots.
- [LEGAL_QUERY_PIPELINE.md](LEGAL_QUERY_PIPELINE.md) - Detailed RAG query pipeline (Classification -> Retrieval -> Grounding).
- [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) - Dual-database setup, schemas, collections, and required legal filters.
- [MONGO_ATLAS_SETUP.md](MONGO_ATLAS_SETUP.md) - Atlas Search vector and text index JSON definitions.
- [SEARCH_AND_INDEXING.md](SEARCH_AND_INDEXING.md) - Master index reference matrix.
- [LEGAL_SOURCE_GOVERNANCE.md](LEGAL_SOURCE_GOVERNANCE.md) - Egyptian legal corpus authority status rules, filtering, and corpus lifecycle.
- [ERROR_HANDLING_AND_RELIABILITY.md](ERROR_HANDLING_AND_RELIABILITY.md) - Exception handling, timeouts, retries, and error envelopes.
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Security boundaries, prompt injection defense, ownership, and SaaS roadmap.
- [TESTING_STRATEGY.md](TESTING_STRATEGY.md) - Test suite structure, unit/integration scenarios, and benchmark evaluator.
- [ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md) - Environment schema reference table, defaults, and secrets.
- [API_REFERENCE.md](API_REFERENCE.md) - Complete HTTP API specification with request/response schemas.
- [GLOSSARY.md](GLOSSARY.md) - Standardized technical terminology glossary.

### Service Implementation Guides (`docs/services/`)
- [CLASSIFIER_SERVICE_IMPLEMENTATION.md](services/CLASSIFIER_SERVICE_IMPLEMENTATION.md) - Intent classification.
- [QUERY_SERVICE_IMPLEMENTATION.md](services/QUERY_SERVICE_IMPLEMENTATION.md) - RAG query orchestrator.
- [QUERY_REWRITE_SERVICE_IMPLEMENTATION.md](services/QUERY_REWRITE_SERVICE_IMPLEMENTATION.md) - LLM query expansion.
- [RETRIEVAL_SERVICE_IMPLEMENTATION.md](services/RETRIEVAL_SERVICE_IMPLEMENTATION.md) - Atlas vector/text search & RRF.
- [EMBEDDING_SERVICE_IMPLEMENTATION.md](services/EMBEDDING_SERVICE_IMPLEMENTATION.md) - DashScope vector generation.
- [RERANKER_SERVICE_IMPLEMENTATION.md](services/RERANKER_SERVICE_IMPLEMENTATION.md) - LLM reranker & heuristic fallback.
- [GENERATION_SERVICE_IMPLEMENTATION.md](services/GENERATION_SERVICE_IMPLEMENTATION.md) - Grounded LLM prompt generation.
- [LEGAL_REFERENCE_SERVICE_IMPLEMENTATION.md](services/LEGAL_REFERENCE_SERVICE_IMPLEMENTATION.md) - Exact article lookup answers.
- [CONVERSATION_SERVICE_IMPLEMENTATION.md](services/CONVERSATION_SERVICE_IMPLEMENTATION.md) - Thread CRUD & sequence numbers.
- [CHAT_ORCHESTRATOR_IMPLEMENTATION.md](services/CHAT_ORCHESTRATOR_IMPLEMENTATION.md) - Turn management & idempotency.
- [CONVERSATION_MEMORY_IMPLEMENTATION.md](services/CONVERSATION_MEMORY_IMPLEMENTATION.md) - Multi-turn memory & standalone query resolution.
- [SOURCE_SNAPSHOT_IMPLEMENTATION.md](services/SOURCE_SNAPSHOT_IMPLEMENTATION.md) - Immutable historical source snapshots.
- [AUTH_SERVICE_IMPLEMENTATION.md](services/AUTH_SERVICE_IMPLEMENTATION.md) - Authentication & session workflows.
- [MONGO_SERVICE_IMPLEMENTATION.md](services/MONGO_SERVICE_IMPLEMENTATION.md) - Dual Mongoose connection manager.
- [PROVIDER_CONFIG_SERVICE_IMPLEMENTATION.md](services/PROVIDER_CONFIG_SERVICE_IMPLEMENTATION.md) - Round-robin API key rotator.
- [EMAIL_SERVICE_IMPLEMENTATION.md](services/EMAIL_SERVICE_IMPLEMENTATION.md) - Nodemailer client.

### Utility Reference Guides (`docs/utilities/`)
- [LEGAL_REFERENCE_PARSER.md](utilities/LEGAL_REFERENCE_PARSER.md) - Citation regex parser.
- [ARABIC_NORMALIZATION.md](utilities/ARABIC_NORMALIZATION.md) - Arabic text normalization.
- [CONTEXT_BUILDER.md](utilities/CONTEXT_BUILDER.md) - XML evidence context formatter.
- [EVIDENCE_SELECTION.md](utilities/EVIDENCE_SELECTION.md) - Structural relevance scoring.
- [GROUNDING_POLICY.md](utilities/GROUNDING_POLICY.md) - Anti-hallucination score thresholds.
- [LAW_MAPPING.md](utilities/LAW_MAPPING.md) - Law dictionary mapping.
- [CHUNK_MAPPER.md](utilities/CHUNK_MAPPER.md) - Mongoose document to DTO converter.
- [RECIPROCAL_RANK_FUSION.md](utilities/RECIPROCAL_RANK_FUSION.md) - RRF search merger algorithm.
- [HTTP_RETRY_AND_TIMEOUT.md](utilities/HTTP_RETRY_AND_TIMEOUT.md) - HTTP retry & backoff client wrapper.

### Database & Governance Model Guides (`docs/database/`)
- [USER_MODEL.md](database/USER_MODEL.md) - Account user schema.
- [REFRESH_TOKEN_MODEL.md](database/REFRESH_TOKEN_MODEL.md) - Hashed refresh token schema.
- [CONVERSATION_MODEL.md](database/CONVERSATION_MODEL.md) - Thread metadata schema.
- [MESSAGE_MODEL.md](database/MESSAGE_MODEL.md) - Chat turn message schema.
- [LEGAL_CHUNK_MODEL.md](database/LEGAL_CHUNK_MODEL.md) - Vector legal chunk schema.
- [LEGAL_AUTHORITY_MODEL.md](database/LEGAL_AUTHORITY_MODEL.md) - Planned legal authority governance schema.
- [CORPUS_RELEASE_MODEL.md](database/CORPUS_RELEASE_MODEL.md) - Planned corpus release tracking schema.
