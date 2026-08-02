# LegalMind API compatibility baseline

Status: frozen delivery contract
Verified against mounted routers: 2026-08-01
Base URL: http://localhost:3000

This document is generated from createApp and the route declarations it mounts. It is the compatibility authority for the delivery baseline. Endpoint success bodies are not wrapped. Except for rate-limit responses, failures use success=false, error, message, optional details, and request_id. Every response receives the x-request-id header.

## Mounted route inventory

| Method | Path | Authentication | Expected status codes |
|---|---|---|---|
| GET | / | Public | 200 |
| GET | /health | Public | 200, 503 |
| GET | /ready | Public | 200, 503 |
| POST | /api/v1/auth/register | Public; JSON | 201, 400, 409, 429, 503 |
| POST | /api/v1/auth/verify-email | Public | 200, 400 |
| POST | /api/v1/auth/resend-verification | Public | 200, 400, 429, 503 |
| POST | /api/v1/auth/login | Public | 200, 400, 401, 403, 429 |
| POST | /api/v1/auth/refresh-token | Refresh cookie or body token | 200, 400, 401, 429 |
| POST | /api/v1/auth/logout | Optional refresh cookie or body token | 204, 400, 401 |
| POST | /api/v1/auth/logout-all | Bearer | 204, 401 |
| POST | /api/v1/auth/forgot-password | Public | 200, 400, 429, 503 |
| POST | /api/v1/auth/reset-password | Public | 200, 400, 401 |
| GET | /api/v1/auth/me | Bearer | 200, 401 |
| POST | /api/v1/query | Bearer; 20/minute | 200, 400, 401, 429, 500, 502, 503 |
| GET | /api/v1/conversations | Bearer | 200, 400, 401 |
| POST | /api/v1/conversations | Bearer | 201, 400, 401 |
| GET | /api/v1/conversations/:conversationId | Bearer | 200, 401, 404 |
| GET | /api/v1/conversations/:conversationId/messages | Bearer | 200, 400, 401, 404 |
| POST | /api/v1/conversations/:conversationId/messages | Bearer; 20/minute | 201, 400, 401, 404, 409, 429, 502 |
| PATCH | /api/v1/conversations/:conversationId | Bearer | 200, 400, 401, 404 |
| DELETE | /api/v1/conversations/:conversationId | Bearer | 204, 401, 404 |

No mounted route may be removed or renamed during the protected refactor. The router source, rather than a smoke-test subset, controls this inventory.

## Shared HTTP behavior

Bearer authentication uses Authorization: Bearer ACCESS_TOKEN. Refresh and logout prefer the legalmind_refresh_token HTTP-only cookie, scoped to /api/v1/auth, over refreshToken in a JSON body. Browser clients send credentials.

Normalized failure body fields:

| Field | Type | Required |
|---|---|---|
| success | false | yes |
| error | string code | yes |
| message | string | yes |
| details | object or array | no |
| request_id | string | yes |

Known shared error codes include INVALID_JSON, VALIDATION_ERROR, RESOURCE_ALREADY_EXISTS, DATABASE_VALIDATION_ERROR, INVALID_IDENTIFIER, ROUTE_NOT_FOUND, CORS_ORIGIN_DENIED, INTERNAL_SERVER_ERROR, AUTH_REQUIRED, AUTH_INVALID_TOKEN, AUTH_TOKEN_EXPIRED, AUTH_INVALID_CREDENTIALS, AUTH_EMAIL_NOT_VERIFIED, AUTH_ACCOUNT_DISABLED, AUTH_REFRESH_TOKEN_INVALID, AUTH_REFRESH_TOKEN_REUSED, AUTH_INSUFFICIENT_ROLE, AUTH_EMAIL_ALREADY_EXISTS, AUTH_RESET_TOKEN_INVALID, CONVERSATION_NOT_FOUND, IDEMPOTENCY_KEY_CONFLICT, and CHAT_GENERATION_FAILED. Rate-limit bodies retain their existing endpoint-specific error and message fields and do not guarantee request_id.

## System response schemas

GET / returns name:string, version:string, and routes:string[].

GET /health returns status:"ok"|"degraded", service:string, environment:string, and checks. checks.applicationDatabase and checks.ragDatabase are database health objects containing connected:boolean, readyState:number, pingOk:boolean, and optional error:string.

GET /ready returns status:"ok"|"degraded" and checks with applicationDatabase:boolean, ragDatabase:boolean, provider:boolean.

## Authentication request schemas

POST /register accepts a strict JSON body.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| fullName | string | yes | trimmed, 2..100 |
| email | string | yes | valid email, trimmed and lowercased |
| password | string | yes | 8..128, lowercase, uppercase, digit |
| officeName | string | yes | trimmed, 1..200 |
| teamSize | string | yes | solo, small, medium, or large |
| phone | string | no | blank becomes absent, max 30 |
| barAssociationNumber | string | no | blank becomes absent, max 100 |

Other authentication JSON bodies are strict:

- verify-email: token:string, minimum 32
- resend-verification: email:string
- login: email:string, password:string 1..128
- refresh-token: refreshToken?:string, minimum 32
- logout: refreshToken?:string, minimum 32
- logout-all: empty body
- forgot-password: email:string
- reset-password: token:string minimum 32, password using the strong password rules
- me: no body

Public user response fields are id:string, fullName:string, email:string, role:"user"|"pending_lawyer"|"lawyer"|"admin", officeName?:string, teamSize?:"solo"|"small"|"medium"|"large", phone?:string, barAssociationNumber?:string, isActive:boolean, isEmailVerified:boolean, organizationId:string|null, createdAt:date-time, and updatedAt:date-time.

Authentication success bodies:

- register 201: message:string, user:PublicUser
- verify-email 200: message:string
- resend-verification 200: message:string
- login 200: access_token:string, user:PublicUser; sets refresh cookie
- refresh-token 200: access_token:string, user:PublicUser; rotates refresh cookie
- logout 204: no body; clears refresh cookie
- logout-all 204: no body; clears refresh cookie
- forgot-password 200: generic message:string
- reset-password 200: message:string, access_token:string, user:PublicUser; sets refresh cookie
- me 200: user:PublicUser

## Query contract

POST /api/v1/query accepts a strict JSON object:

| Field | Type | Required | Constraints/default |
|---|---|---:|---|
| query | string | yes | 3..2000 |
| top_k | integer | no | 1..50; default 5 |
| law_category | string | no | minimum 1 |
| user_role | string | no | lawyer or citizen |

The 200 response fields are answer:string, source_chunks:LegalChunk[], llm_provider_used:string|null, category:"arabic_rag"|"law_ref"|"chat", latency_ms:nonnegative integer, and optional evidence_relevance_score:number from 0 through 1.

A LegalChunk always includes chunk_id, content, law_name_normalized, law_category, source_dataset, language, semantic_unit, hierarchy_path, is_retrievable, text_len, and jurisdiction. Optional fields are article_number, source_file, law_number, law_year, appeal_number, judicial_year, ruling_date, case_subject, child_index, parent_chunk_id, similarity_score, rerank_score, evidence_rank, rrf_score, authorityId, authorityTitleOfficial, authorityTitleNormalized, authorityType, authorityStatus, effectiveFrom, effectiveTo, textStatus, officialSourceUrl, reviewStatus, reviewedBy, reviewedAt, and corpusReleaseId.

## Conversation request schemas

All conversation routes require bearer authentication and owner scope.

POST /api/v1/conversations accepts a strict object with optional title:string trimmed 1..160 and optional user_role:"lawyer"|"citizen".

GET /api/v1/conversations accepts cursor?:string, limit?:integer 1..50 default 20, and status?:"active"|"archived" default active.

GET messages accepts cursor?:string and limit?:integer 1..100 default 50.

POST messages accepts a strict object:

| Field | Type | Required | Constraints/default |
|---|---|---:|---|
| content | string | yes | trimmed, 1..2000 |
| idempotency_key | UUID string | yes | reuse for retries of the same turn |
| top_k | integer | no | 1..50; default 5 |
| user_role | string | no | lawyer or citizen |

PATCH conversation accepts at least one of title:string trimmed 1..160 or status:"active"|"archived".

Conversation response fields are conversation_id:string, title:string, status:"active"|"archived"|"deleted", jurisdiction:"EG", default_user_role:"lawyer"|"citizen", summary:string, summary_version:number, active_legal_context:object, message_count:number, last_message_at:date-time, created_at:date-time, and updated_at:date-time.

Message response fields are message_id:string, conversation_id:string, role:"user"|"assistant"|"system", status:"pending"|"completed"|"failed"|"cancelled", sequence:number, content:string, optional original_query, retrieval_query, category, source_snapshot, diagnostics, idempotency_key, error, plus created_at and updated_at date-times.

Conversation success bodies:

- create 201, get 200, and patch 200: Conversation
- list 200: conversations:Conversation[], next_cursor:string|null
- list messages 200: messages:Message[], next_cursor:string|null
- send message 201: user_message:Message, assistant_message:Message|null
- delete 204: no body

## Frozen deterministic fixtures

The sanitized fixtures are stored in docs/api/frontend-contract-fixtures.json. They cover every frontend-blocking route. Generated identifiers, timestamps, latency, provider/model metadata, nondeterministic answer text, source-score ordering ties, and cookie token values use stable placeholders or are excluded from equality comparisons. Structural fields, enums, status codes, semantic messages, and deterministic values remain frozen.

During refactoring, compare normalized responses after removing only:

- request_id and x-request-id values
- generated user, conversation, message, and cursor identifiers
- created, updated, last-message, retrieved, and reviewed timestamps
- latency fields
- access/refresh token values
- provider and model metadata
- generated answer text
- equal-score ordering where no stable tiebreaker exists

Do not normalize away required keys, HTTP status, authentication behavior, error codes, ownership behavior, collection/model names, or semantic response values.
