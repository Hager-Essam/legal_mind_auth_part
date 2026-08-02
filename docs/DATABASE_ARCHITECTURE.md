# LegalMind Database Architecture & Schema Specifications

> **Status**: Implemented with Planned Governance Models
> **Source verified**: `src/services/mongo.service.ts`, `src/models/*`, `src/modules/*/user.model.ts`, `refresh-token.model.ts`, `conversation.model.ts`, `message.model.ts`, `chunk.model.ts`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview & Dual-Database Separation](#1-overview--dual-database-separation)
- [2. Application Database Collections (`legalmind_app`)](#2-application-database-collections-legalmind_app)
  - [2.1 `users` Collection](#21-users-collection)
  - [2.2 `refresh_tokens` Collection](#22-refresh_tokens-collection)
  - [2.3 `conversations` Collection](#23-conversations-collection)
  - [2.4 `messages` Collection](#24-messages-collection)
  - [2.5 `audit_events` Collection (Planned)](#25-audit_events-collection-planned)
- [3. RAG Database Collections (`legalmind_rag`)](#3-rag-database-collections-legalmind_rag)
  - [3.1 `legal_chunks` Collection](#31-legal_chunks-collection)
  - [3.2 `legal_authorities` Collection (Planned Model / Currently Embedded)](#32-legal_authorities-collection-planned-model--currently-embedded)
  - [3.3 `corpus_releases` Collection (Planned Model / Currently Scripted)](#33-corpus_releases-collection-planned-model--currently-scripted)
- [4. Legal Retrieval Filters & Constraints](#4-legal-retrieval-filters--constraints)
  - [4.1 Mandated Egyptian Retrieval Filters](#41-mandated-egyptian-retrieval-filters)
  - [4.2 Exact Article Lookup Filters](#42-exact-article-lookup-filters)
  - [4.3 Court Ruling Filters](#43-court-ruling-filters)
  - [4.4 Conversation Scoping Filters](#44-conversation-scoping-filters)
- [5. Standard Database Indexes](#5-standard-database-indexes)
- [6. Related Documentation](#6-related-documentation)

---

## 1. Overview & Dual-Database Separation

LegalMind isolates application state from legal vector search data by maintaining two distinct MongoDB database connections via `MongoService`:

```text
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ Application Database: legalmind_app                                      │
 │ Connection: LEGALMIND_APP_URI                                           │
 │ Purpose: Transactional data, user credentials, JWT sessions, user chats │
 │ Collections: users, refresh_tokens, conversations, messages             │
 └─────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ RAG Database: legalmind_rag                                             │
 │ Connection: LEGALMIND_RAG_URI                                           │
 │ Purpose: Indexed Egyptian legal corpus, vector embeddings, Atlas search │
 │ Collections: legal_chunks                                               │
 └─────────────────────────────────────────────────────────────────────────┘
```

**Why Dual Separation Matters**:
1. **Security & Data Isolation**: User credentials and chat history are decoupled from public legal vector data.
2. **Scalability**: The RAG corpus can be scaled independently on dedicated high-RAM MongoDB Atlas nodes optimized for Vector Search index caching.

---

## 2. Application Database Collections (`legalmind_app`)

### 2.1 `users` Collection
* **Purpose**: Manages user accounts, authentication credentials, and user roles.
* **Fields**:
  - `_id` (ObjectId, Required): Primary Key.
  - `email` (String, Required, Unique): Normalized lowercase user email address.
  - `passwordHash` (String, Required): Bcrypt hash (12 salt rounds).
  - `name` (String, Required): Full name of the user.
  - `role` (String, Required, Enum: `['citizen', 'lawyer', 'admin']`): User access role.
  - `isEmailVerified` (Boolean, Default: `false`): Email verification status.
  - `emailVerificationToken` (String, Optional): Token for email verification.
  - `passwordResetToken` (String, Optional): Token for password reset.
  - `passwordResetExpires` (Date, Optional): Expiration timestamp for reset token.
  - `organizationId` (String, Optional): Multi-tenant organization identifier.
  - `isActive` (Boolean, Default: `true`): Account status flag.
  - `createdAt`, `updatedAt` (Date): Timestamps.

### 2.2 `refresh_tokens` Collection
* **Purpose**: Stateful refresh token storage for JWT token rotation.
* **Fields**:
  - `_id` (ObjectId, Required): Primary Key.
  - `userId` (ObjectId, Required, Ref: `User`): Account owner ID.
  - `tokenHash` (String, Required, Unique): SHA-256 digest of the raw refresh token string.
  - `expiresAt` (Date, Required, TTL Index): Token expiration timestamp (7 days from creation).
  - `revokedAt` (Date, Optional): Revocation timestamp if token was rotated or logged out.
  - `createdAt` (Date): Creation timestamp.

### 2.3 `conversations` Collection
* **Purpose**: Manages stateful conversation threads between a user and LegalMind.
* **Fields**:
  - `_id` (ObjectId, Required): Primary Key.
  - `conversationId` (String, Required, Unique): Public UUID v4 string identifier.
  - `ownerUserId` (ObjectId, Required, Ref: `User`): Owning user ID.
  - `organizationId` (String, Optional): Tenant organization scoping.
  - `title` (String, Required): Auto-generated or user-set thread title.
  - `summary` (String, Optional): Progressive LLM conversation summary.
  - `messageCount` (Number, Default: `0`): Total messages count in thread.
  - `status` (String, Required, Enum: `['active', 'archived', 'deleted']`): Soft deletion status.
  - `lastMessageAt` (Date, Default: `Date.now`): Timestamp of most recent activity.
  - `createdAt`, `updatedAt` (Date): Timestamps.

### 2.4 `messages` Collection
* **Purpose**: Stores individual chat turns within a conversation thread.
* **Fields**:
  - `_id` (ObjectId, Required): Primary Key.
  - `messageId` (String, Required, Unique): Public UUID v4 message identifier.
  - `conversationId` (String, Required, Index): Reference to `conversations.conversationId`.
  - `ownerUserId` (ObjectId, Required): Owning user ID.
  - `role` (String, Required, Enum: `['user', 'assistant', 'system']`): Message author role.
  - `content` (String, Required): Message text content.
  - `sequence` (Number, Required): Monotonically increasing sequence integer.
  - `idempotencyKey` (String, Optional, Unique Sparse): Unique submission key for user turns.
  - `status` (String, Optional, Enum: `['pending', 'completed', 'failed']`): Status for assistant turn.
  - `sourceSnapshots` (Array of Objects, Optional): Immutable frozen legal sources array.
  - `diagnostics` (Object, Optional): Metric details (RRF score, grounding score, latency).
  - `errorMetadata` (Object, Optional): Code and error message if status is `failed`.
  - `createdAt`, `updatedAt` (Date): Timestamps.

### 2.5 `audit_events` Collection (Planned)
* **Purpose**: Enterprise security audit logging (Planned for future SaaS scope).

---

## 3. RAG Database Collections (`legalmind_rag`)

### 3.1 `legal_chunks` Collection
* **Purpose**: Master collection of indexed Egyptian legal text chunks.
* **Fields**:
  - `chunkId` (String, Required, Unique): Primary chunk identifier.
  - `authorityId` (String, Required): Identifier of parent legal authority/law.
  - `authorityTitle` (String, Required): Official title of the legal authority (Arabic).
  - `authorityTitleNormalized` (String, Required): Arabic normalized title string.
  - `authorityType` (String, Required, Enum: `['constitution', 'statute', 'regulation', 'court_ruling', 'summary']`).
  - `jurisdiction` (String, Required, Default: `'EG'`): Country code.
  - `lawNumber` (String, Optional): Official law number (e.g., `"12"`).
  - `lawYear` (Number, Optional): Official law promulgation year (e.g., `2003`).
  - `articleNumber` (String, Optional): Article number string (e.g., `"12"`, `"12 مكرر"`).
  - `appealNumber` (Number, Optional): Cassation appeal number.
  - `judicialYear` (Number, Optional): Judicial year for court rulings.
  - `rulingDate` (Date, Optional): Date of court judgment.
  - `court` (String, Optional): Court name (e.g., `"محكمة النقض"`).
  - `chamber` (String, Optional): Court chamber.
  - `text` (String, Required): Raw legal chunk text content.
  - `textNormalized` (String, Required): Normalized Arabic text.
  - `textStatus` (String, Required, Enum: `['verbatim', 'extracted', 'summary', 'unknown']`).
  - `embedding` (Array of Numbers, 1024 dims): Dense vector generated by `text-embedding-v4`.
  - `authorityStatus` (String, Required, Enum: `['effective', 'amended', 'repealed', 'quarantined', 'unknown']`).
  - `reviewStatus` (String, Required, Enum: `['draft', 'reviewed', 'published', 'quarantined']`).
  - `isRetrievable` (Boolean, Required, Default: `true`): Retrieval eligibility flag.
  - `parentChunkId` (String, Optional): Parent chunk ID for chunk hierarchy expansion.
  - `childIndex` (Number, Optional): Relative index among sibling chunks.

### 3.2 `legal_authorities` Collection (Planned Model / Currently Embedded)
* Currently, authority metadata (`authorityTitle`, `authorityStatus`, `lawNumber`, `lawYear`) is embedded directly in each `legal_chunk` document. A dedicated `legal_authorities` collection is planned for future SaaS governance.

### 3.3 `corpus_releases` Collection (Planned Model / Currently Scripted)
* Release versions are currently tracked via operator scripts (`audit-legal-corpus.ts`). A dedicated `corpus_releases` tracking collection is planned for future SaaS deployment.

---

## 4. Legal Retrieval Filters & Constraints

### 4.1 Mandated Egyptian Retrieval Filters
Every standard RAG query executed against `legal_chunks` must enforce these filters:
```ts
const standardFilters = {
  jurisdiction: "EG",
  isRetrievable: true,
  reviewStatus: "published",
  authorityStatus: { $in: ["effective", "amended"] }
};
```
* **Why**: Prevents non-Egyptian material, unverified draft text, or repealed laws from corrupting legal answers.

### 4.2 Exact Article Lookup Filters
```ts
const exactArticleFilter = {
  authorityId: targetAuthorityId,
  articleNumber: targetArticleNumber,
  jurisdiction: "EG",
  isRetrievable: true,
  reviewStatus: "published"
};
```

### 4.3 Court Ruling Filters
```ts
const courtRulingFilter = {
  appealNumber: targetAppealNumber,
  judicialYear: targetJudicialYear,
  jurisdiction: "EG",
  isRetrievable: true,
  reviewStatus: "published"
};
```

### 4.4 Conversation Scoping Filters
```ts
const conversationSecurityFilter = {
  conversationId: targetId,
  ownerUserId: authenticatedUser.id,
  status: { $ne: "deleted" }
};
```

---

## 5. Standard Database Indexes

### 5.1 `users` Collection Indexes
* `email` (Unique): `db.users.createIndex({ email: 1 }, { unique: true })`
* `role + isActive`: `db.users.createIndex({ role: 1, isActive: 1 })`
* `organizationId`: `db.users.createIndex({ organizationId: 1 })`

### 5.2 `refresh_tokens` Collection Indexes
* `tokenHash` (Unique): `db.refresh_tokens.createIndex({ tokenHash: 1 }, { unique: true })`
* `expiresAt` (TTL Index): `db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })`
* `userId + revokedAt`: `db.refresh_tokens.createIndex({ userId: 1, revokedAt: 1 })`

### 5.3 `conversations` Collection Indexes
* `conversationId` (Unique): `db.conversations.createIndex({ conversationId: 1 }, { unique: true })`
* `ownerUserId + status + lastMessageAt`: `db.conversations.createIndex({ ownerUserId: 1, status: 1, lastMessageAt: -1 })`

### 5.4 `messages` Collection Indexes
* `messageId` (Unique): `db.messages.createIndex({ messageId: 1 }, { unique: true })`
* `conversationId + sequence` (Unique): `db.messages.createIndex({ conversationId: 1, sequence: 1 }, { unique: true })`
* `ownerUserId + idempotencyKey` (Unique Sparse): `db.messages.createIndex({ ownerUserId: 1, idempotencyKey: 1 }, { unique: true, sparse: true })`

### 5.5 `legal_chunks` Collection Standard Indexes
* `chunkId` (Unique): `db.legal_chunks.createIndex({ chunkId: 1 }, { unique: true })`
* `authorityId + articleNumber`: `db.legal_chunks.createIndex({ authorityId: 1, articleNumber: 1 })`
* `governance_filter`: `db.legal_chunks.createIndex({ jurisdiction: 1, reviewStatus: 1, authorityStatus: 1, isRetrievable: 1 })`
* `law_lookup`: `db.legal_chunks.createIndex({ lawNumber: 1, lawYear: 1, articleNumber: 1 })`
* `cassation_lookup`: `db.legal_chunks.createIndex({ appealNumber: 1, judicialYear: 1 })`

---

## 6. Related Documentation

- [Search & Indexing](SEARCH_AND_INDEXING.md) - MongoDB Atlas Search vector & text index setup.
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Dual database connection overview.
- [User Model Guide](database/USER_MODEL.md) - Deep dive into User model.
- [Legal Chunk Model Guide](database/LEGAL_CHUNK_MODEL.md) - Deep dive into LegalChunk model.
