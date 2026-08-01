# LegalMind Testing & Benchmark Evaluation Strategy

> **Status**: Implemented
> **Source verified**: `src/auth-tests/*`, `src/chat-tests/*`, `src/query-tests/*`, `src/security-tests/*`, `src/scripts/evaluate.ts`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Test Suite Architecture](#2-test-suite-architecture)
- [3. Mandatory Test Scenarios & Specifications](#3-mandatory-test-scenarios--specifications)
  - [3.1 Authentication & Session Security Tests](#31-authentication--session-security-tests)
  - [3.2 Conversation Security & Multi-Tenant Isolation Tests](#32-conversation-security--multi-tenant-isolation-tests)
  - [3.3 Conversation Persistence & Idempotency Tests](#33-conversation-persistence--idempotency-tests)
  - [3.4 Legal RAG Pipeline & Governance Tests](#34-legal-rag-pipeline--governance-tests)
  - [3.5 Provider Fault Tolerance & Failure Recovery Tests](#35-provider-fault-tolerance--failure-recovery-tests)
- [4. Benchmark RAG Evaluator (`src/scripts/evaluate.ts`)](#4-benchmark-rag-evaluator-srcscriptsevaluatets)
- [5. Test Execution Commands](#5-test-execution-commands)
- [6. Related Documentation](#6-related-documentation)

---

## 1. Overview

LegalMind employs a multi-tiered quality assurance suite combining Node.js native test runner scripts, in-memory MongoDB integration testing (`mongodb-memory-server`), and an automated LLM benchmark evaluator (`evaluate.ts`) that scores grounded legal precision across Egyptian law datasets.

---

## 2. Test Suite Architecture

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Unit Tests (src/*-tests/*.unit.test.ts)                                 │
 │ Tests isolated utilities, regex parsers, RRF algorithm, and error classes│
 ├──────────────────────────────────────────────────────────────────────────┤
 │ Integration Tests (src/*-tests/*.integration.test.ts)                    │
 │ Tests full HTTP endpoints using mongodb-memory-server & mock providers   │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ Automated Benchmark Evaluation (src/scripts/evaluate.ts)                 │
 │ Runs 50+ benchmark legal questions against live backend; scores accuracy │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mandatory Test Scenarios & Specifications

### 3.1 Authentication & Session Security Tests
* **Registration & Duplicate Email**: Verifies registration creates user; duplicate email registration rejects with `400 Bad Request`.
* **Role Injection Defense**: Verifies client cannot inject `role: 'admin'` in registration body to escalate privileges.
* **Invalid Password**: Verifies incorrect password returns `401 Unauthorized`.
* **Unverified & Inactive Users**: Verifies unverified or `isActive: false` accounts cannot log in.
* **Token Expiry**: Verifies expired JWT access tokens reject with `TOKEN_EXPIRED` (401).
* **Refresh Token Rotation & Reuse**: Verifies using a refresh token issues a new token and revokes the old token. Verifies presenting a revoked token revokes all active sessions.
* **Logout Revocation**: Verifies logout revokes the current session refresh token.

### 3.2 Conversation Security & Multi-Tenant Isolation Tests
* **Cross-User Conversation Access**: User A attempts `GET /api/v1/conversations/:id` for User B's conversation. Must return `404 Not Found`.
* **Cross-User Message Injection**: User A attempts `POST /api/v1/conversations/:id/messages` targeting User B's conversation. Must return `404 Not Found`.

### 3.3 Conversation Persistence & Idempotency Tests
* **Sequence Allocation**: Verifies messages are saved with strictly increasing sequences (1, 2, 3, 4).
* **Idempotency Replay**: Submitting duplicate `idempotencyKey` returns cached assistant response without re-executing RAG.
* **Snapshot Immutability**: Verifies historical message `sourceSnapshots` remain unchanged even if the target chunk in `legal_chunks` is updated.

### 3.4 Legal RAG Pipeline & Governance Tests
* **Greeting with Legal Question**: Mixed input (*"Hello, what is Article 12?"*) correctly routes to RAG pipeline.
* **Exact Reference Precision**: Searching *"Article 10"* returns Article 10, not Article 1.
* **Governance Filters**: Verified that `draft`, `quarantined`, or `authorityStatus = 'repealed'` chunks are excluded from retrieval.
* **Grounding Refusal**: Low relevance score (`< 0.40`) returns standard Arabic refusal message without hallucinating.

### 3.5 Provider Fault Tolerance & Failure Recovery Tests
* **Provider Timeout**: LLM timeout disarms cleanly, user turn is preserved, assistant turn saves with `status = 'failed'`.
* **Reranker Failure Fallback**: LLM reranker 500 error triggers automatic fallback to `heuristicRerank()`.

---

## 4. Benchmark RAG Evaluator (`src/scripts/evaluate.ts`)

The evaluation script loads test questions from `src/scripts/evaluation_questions.json` and evaluates LegalMind's performance across four dimensions:

1. **Retrieval Precision**: Percentage of top-K chunks containing the ground-truth legal article.
2. **Grounding Accuracy**: Judge model verifies answer contains zero unsupported legal claims.
3. **Citation Validity**: Verifies every bracketed citation `[المصدر X]` resolves to a valid source.
4. **Latency Budget**: Measures total turn execution time (Target: `< 2.5s`).

---

## 5. Test Execution Commands

Run test suites via `npm` package scripts in `backend-ts/`:

```bash
# Run all authentication tests (Unit + Integration)
npm run test:auth

# Run authentication unit tests only
npm run test:auth:unit

# Run authentication integration tests (with Memory MongoDB)
npm run test:auth:integration

# Run chat & conversation tests
npm run test:chat

# Run legal RAG query tests
npm run test:query

# Run security & provider error tests
npm run test:security

# Run complete benchmark evaluator report
npm run evaluate
```

---

## 6. Related Documentation

- [Backend Architecture](BACKEND_ARCHITECTURE.md) - System overview.
- [Error Handling & Reliability](ERROR_HANDLING_AND_RELIABILITY.md) - Fault tolerance specs.
- [Legal Query Pipeline](LEGAL_QUERY_PIPELINE.md) - Pipeline execution.
