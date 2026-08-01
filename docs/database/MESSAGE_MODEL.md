# Message Model Database Guide

> Status: Implemented
> Collection: `legalmind_app.messages`
> Verified against: `src/modules/conversations/message.schema.ts`, `src/modules/conversations/message.model.ts`

---

## Overview

The `Message` model stores individual chat turns in `legalmind_app.messages`. It enforces atomic sequence ordering per conversation, idempotency key uniqueness per user, immutable source snapshots, and execution diagnostics.

---

## Schema Fields & Types

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Yes | Auto | Unique MongoDB primary key. |
| `messageId` | `String` | Yes | None | Public UUID v4 message identifier. Unique index. |
| `conversationId` | `String` | Yes | None | Target conversation thread identifier. Unique compound index with sequence. |
| `ownerUserId` | `String` | Yes | None | Owning user ID (Immutable). |
| `organizationId` | `String` | No | `null` | Tenant organization identifier (Immutable). |
| `role` | `String` | Yes | None | Enum (`'user'`, `'assistant'`, `'system'`). |
| `status` | `String` | Yes | None | Enum (`'pending'`, `'completed'`, `'failed'`, `'cancelled'`). |
| `sequence` | `Number` | Yes | None | Monotonically increasing sequence integer (Min 1). |
| `content` | `String` | Yes | None | Message text payload. |
| `originalQuery` | `String` | No | `undefined` | Original user input prior to rewrite. |
| `retrievalQuery` | `String` | No | `undefined` | Standalone disambiguated retrieval query. |
| `category` | `String` | No | `undefined` | RAG intent branch (`'arabic_rag'`, `'law_ref'`, `'chat'`). |
| `sourceSnapshot` | `Array` | No | `undefined` | Array of frozen `SourceSnapshot` objects. |
| `diagnostics` | `Object` | No | `undefined` | Latency, provider, relevance score, and rewrite method. |
| `idempotencyKey` | `String` | No | `undefined` | Unique browser submission key. Unique partial index. |
| `error` | `Object` | No | `undefined` | Code and safe message if `status === 'failed'`. |
| `createdAt` | `Date` | Yes | Auto | Message creation timestamp. |
| `updatedAt` | `Date` | Yes | Auto | Last update timestamp. |

---

## Database Indexes

- `messages_id_unique`: `{ messageId: 1 }` (Unique)
- `messages_conversation_sequence_unique`: `{ conversationId: 1, sequence: 1 }` (Unique Compound)
- `messages_conversation_created`: `{ conversationId: 1, createdAt: 1 }`
- `messages_owner_idempotency_unique`: `{ ownerUserId: 1, idempotencyKey: 1 }` (Unique Partial)

---

## Related Files

* Model source: `src/modules/conversations/message.model.ts`
* Schema source: `src/modules/conversations/message.schema.ts`
* Service: [ChatOrchestratorService](../services/CHAT_ORCHESTRATOR_IMPLEMENTATION.md)
* Architecture: [Conversation Architecture](../CONVERSATION_ARCHITECTURE.md)
