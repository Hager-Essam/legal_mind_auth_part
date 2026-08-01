# Refresh Token Model Database Guide

> Status: Implemented
> Collection: `legalmind_app.refresh_tokens`
> Verified against: `src/modules/refresh-tokens/refresh-token.schema.ts`, `src/modules/refresh-tokens/refresh-token.model.ts`

---

## Overview

The `RefreshToken` model manages stateful refresh sessions in `legalmind_app`. Raw refresh tokens are never stored; only SHA-256 digests (`tokenHash`) are persisted to protect against database read compromises.

---

## Schema Fields & Types

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Yes | Auto | Unique MongoDB primary key. |
| `tokenHash` | `String` | Yes | None | SHA-256 digest of refresh token string. Unique index. |
| `userId` | `ObjectId` | Yes | None | Reference to `User` document. |
| `expiresAt` | `Date` | Yes | None | Expiration timestamp (7 days TTL). TTL index. |
| `revokedAt` | `Date` | No | `null` | Revocation timestamp if token was rotated or logged out. |
| `replacedByTokenHash` | `String` | No | `null` | Token hash of replacement token upon rotation. |
| `createdByIp` | `String` | No | `undefined` | IP address of creating request. |
| `revokedByIp` | `String` | No | `undefined` | IP address of revoking request. |
| `createdAt` | `Date` | Yes | Auto | Session creation timestamp. |
| `updatedAt` | `Date` | Yes | Auto | Last update timestamp. |

---

## Database Indexes

- `refresh_tokens_hash_unique`: `{ tokenHash: 1 }` (Unique)
- `refresh_tokens_expiry_ttl`: `{ expiresAt: 1 }` (TTL: `expireAfterSeconds: 0`)
- `refresh_tokens_user_revoked`: `{ userId: 1, revokedAt: 1 }`

---

## Related Files

* Model source: `src/modules/refresh-tokens/refresh-token.model.ts`
* Schema source: `src/modules/refresh-tokens/refresh-token.schema.ts`
* Repository: `src/modules/refresh-tokens/refresh-token.repository.ts`
* Architecture: [Auth Architecture](../AUTH_ARCHITECTURE.md)
