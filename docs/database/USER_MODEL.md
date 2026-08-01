# User Model Database Guide

> Status: Implemented
> Collection: `legalmind_app.users`
> Verified against: `src/modules/users/user.schema.ts`, `src/modules/users/user.model.ts`

---

## Overview

The `User` model defines the database schema for application accounts, storing authentication credentials, password hashes, email verification tokens, lawyer credentials, and role authorizations.

---

## Schema Fields & Types

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Yes | Auto | Unique MongoDB primary key. |
| `email` | `String` | Yes | None | Lowercase normalized email address. Unique index. |
| `password` | `String` | Yes | None | Bcrypt password hash (Cost factor 10/12). `select: false`. |
| `fullName` | `String` | Yes | None | User's full name (2 to 100 characters). |
| `officeName` | `String` | No | `undefined` | Optional law firm or office name. |
| `teamSize` | `String` | No | `undefined` | Enum (`'1'`, `'2-5'`, `'6-20'`, `'20+'`). |
| `phone` | `String` | No | `undefined` | Contact telephone number. |
| `role` | `String` | Yes | `'pending_lawyer'` | Enum (`'citizen'`, `'pending_lawyer'`, `'lawyer'`, `'admin'`). |
| `barAssociationNumber` | `String` | No | `undefined` | Bar association card number. |
| `lawyerIdDocument` | `String` | No | `undefined` | Private upload filepath to lawyer card document. |
| `isActive` | `Boolean` | Yes | `true` | Account active status. |
| `isEmailVerified` | `Boolean` | Yes | `false` | Email verification flag. |
| `emailVerificationTokenHash` | `String` | No | `undefined` | SHA-256 digest of email verification token. |
| `emailVerificationExpires` | `Date` | No | `undefined` | Expiration timestamp for email verification. |
| `passwordResetTokenHash` | `String` | No | `undefined` | SHA-256 digest of password reset token. |
| `passwordResetExpires` | `Date` | No | `undefined` | Expiration timestamp for password reset (1 hour TTL). |
| `organizationId` | `String` | No | `null` | Multi-tenant organization identifier. |
| `lastLoginAt` | `Date` | No | `undefined` | Timestamp of last successful login. |
| `createdAt` | `Date` | Yes | Auto | Account creation timestamp. |
| `updatedAt` | `Date` | Yes | Auto | Last update timestamp. |

---

## Database Indexes

- `users_email_unique`: `{ email: 1 }` (Unique)
- `users_role_active`: `{ role: 1, isActive: 1 }`
- `users_organization_active`: `{ organizationId: 1, isActive: 1 }`

---

## Pre-Save Hooks & Instance Methods

- `pre('save')`: Hashes `password` using Bcrypt when modified.
- `comparePassword(candidatePassword)`: Validates raw password against stored hash.
- `createPasswordResetToken()`: Generates 32-byte hex token, hashes with SHA-256, sets 1-hour expiration.
- `createEmailVerificationToken()`: Generates 32-byte hex token, hashes with SHA-256, sets 24-hour expiration.

---

## Related Files

* Model source: `src/modules/users/user.model.ts`
* Schema source: `src/modules/users/user.schema.ts`
* Repository: `src/modules/users/user.repository.ts`
* Architecture: [Auth Architecture](../AUTH_ARCHITECTURE.md)
