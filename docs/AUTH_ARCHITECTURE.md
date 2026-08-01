# LegalMind Authentication & Authorization Architecture

> **Status**: Implemented
> **Source verified**: `src/modules/auth/*`, `src/modules/users/*`, `src/modules/refresh-tokens/*`, `src/middlewares/auth.middleware.ts`
> **Last verified against code**: 2026-07-31

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Authentication vs. Authorization vs. Ownership](#2-authentication-vs-authorization-vs-ownership)
- [3. Token Lifecycle & Session Management](#3-token-lifecycle--session-management)
  - [3.1 Short-Lived Access Tokens (JWT)](#31-short-lived-access-tokens-jwt)
  - [3.2 Long-Lived Refresh Tokens & Rotation](#32-long-lived-refresh-tokens--rotation)
  - [3.3 Refresh Cookie Configuration](#33-refresh-cookie-configuration)
- [4. Authentication Workflows](#4-authentication-workflows)
  - [4.1 Registration & Role Assignment](#41-registration--role-assignment)
  - [4.2 Email Verification](#42-email-verification)
  - [4.3 Login & Session Issuance](#43-login--session-issuance)
  - [4.4 Logout & Single Session Revocation](#44-logout--single-session-revocation)
  - [4.5 Logout All (Revoke All Sessions)](#45-logout-all-revoke-all-sessions)
  - [4.6 Password Reset Workflow](#46-password-reset-workflow)
- [5. Authorization & Express Typing](#5-authorization--express-typing)
  - [5.1 Express Request User Extension](#51-express-request-user-extension)
  - [5.2 Role-Based Access Control (RBAC)](#52-role-based-access-control-rbac)
- [6. Security & Infrastructure Protection](#6-security--infrastructure-protection)
  - [6.1 Password Hashing](#61-password-hashing)
  - [6.2 Refresh Token Hashing](#62-refresh-token-hashing)
  - [6.3 Private Lawyer Credential Uploads](#63-private-lawyer-credential-uploads)
  - [6.4 CORS & Cookie Credentials](#64-cors--cookie-credentials)
  - [6.5 Rate Limiting](#65-rate-limiting)
- [7. Related Documentation](#7-related-documentation)

---

## 1. Overview

The LegalMind authentication architecture provides secure, multi-role access control for citizens, lawyers, and administrative evaluators. It combines short-lived JWT access tokens for stateless API authorization with stateful, hashed refresh token rotation stored in MongoDB and delivered via secure HTTP-only cookies.

---

## 2. Authentication vs. Authorization vs. Ownership

To enforce absolute security boundaries across LegalMind, three distinct security concepts are applied across every request:

```text
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ 1. AUTHENTICATION ("Who are you?")                                        │
 │ Verified by auth.middleware.ts checking JWT signature & expiration.       │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ 2. AUTHORIZATION ("What actions are you allowed to perform?")             │
 │ Verified by roleGuard middleware checking req.user.role (citizen/lawyer)  │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ 3. OWNERSHIP ("Do you own this specific resource?")                       │
 │ Enforced in database queries: { _id: id, ownerUserId: req.user.id }      │
 └───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Token Lifecycle & Session Management

### 3.1 Short-Lived Access Tokens (JWT)
* **Lifetime**: 15 minutes (`LEGALMIND_JWT_ACCESS_EXPIRES_IN=15m`)
* **Algorithm**: HMAC SHA-256 (`HS256`)
* **Signing Secret**: `LEGALMIND_JWT_SECRET` (Minimum 32 random characters in production)
* **Delivery**: Client includes token in HTTP header: `Authorization: Bearer <access-token>`
* **Payload Structure**:

```json
{
  "sub": "65b2f8a1c9e4b20012345678",
  "email": "user@example.com",
  "role": "citizen",
  "organizationId": "org_eg_law_firm_01",
  "iat": 1770000000,
  "exp": 1770000900
}
```

### 3.2 Long-Lived Refresh Tokens & Rotation
* **Lifetime**: 7 days (`LEGALMIND_REFRESH_TOKEN_DAYS=7`)
* **Format**: 32-byte cryptographically secure random string (hex encoded)
* **Rotation**: Every call to `POST /api/v1/auth/refresh-token` **revokes** the old refresh token and issues a new refresh token (Strict Token Rotation).
* **Reuse Detection**: If a revoked refresh token is presented, `AuthService` flags security compromise and revokes all active sessions for that user.

### 3.3 Refresh Cookie Configuration
Refresh tokens are stored exclusively in HTTP-only cookies, preventing XSS access:

```ts
res.cookie("refreshToken", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

---

## 4. Authentication Workflows

### 4.1 Registration & Role Assignment
* Endpoint: `POST /api/v1/auth/register`
* Input: `name`, `email`, `password`, `role` (`citizen` or `lawyer`)
* If role is `lawyer`, `uploadMiddleware` handles optional syndicate card upload.
* Creates `User` record with `isEmailVerified: false` and sends verification email.

### 4.2 Email Verification
* Endpoint: `POST /api/v1/auth/verify-email with a token body`
* Validates verification token, updates `isEmailVerified: true`, and clears token.

### 4.3 Login & Session Issuance
* Endpoint: `POST /api/v1/auth/login`
* Validates credentials against `bcrypt.compare()`.
* Generates new JWT access token + refresh token.
* Sets refresh token cookie and returns sanitized user DTO.

### 4.4 Logout & Single Session Revocation
* Endpoint: `POST /api/v1/auth/logout`
* Reads `refreshToken` cookie, hashes token, sets `revokedAt = new Date()` in database, and clears cookie.

### 4.5 Logout All (Revoke All Sessions)
* Endpoint: `POST /api/v1/auth/logout-all`
* Marks all active refresh tokens for `req.user.id` as revoked (`revokedAt = new Date()`).

### 4.6 Password Reset Workflow
1. Request: `POST /api/v1/auth/forgot-password` generates reset token (1h expiration) and emails link.
2. Complete: `POST /api/v1/auth/reset-password` validates token, updates password hash, and revokes all existing refresh tokens.

---

## 5. Authorization & Express Typing

### 5.1 Express Request User Extension
The `src/types/express.d.ts` declaration extends Express `Request` to include typed user data:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: "citizen" | "lawyer" | "admin";
        organizationId?: string;
      };
      requestId?: string;
    }
  }
}
```

### 5.2 Role-Based Access Control (RBAC)
Routes require specific roles via `requireRole(...)` middleware:
* `citizen`: Standard RAG search & conversational legal assistant access.
* `lawyer`: Enhanced search filters, professional reference tools, law mapping options.
* `admin`: Corpus governance management, index re-building, evaluator execution.

---

## 6. Security & Infrastructure Protection

### 6.1 Password Hashing
Passwords are hashed using **Bcrypt** with a salt round factor of **12** (`bcrypt.hash(password, 12)`). Plaintext passwords are never logged or stored.

### 6.2 Refresh Token Hashing
Refresh tokens are never stored in raw text. `AuthService.hashToken(token)` computes a SHA-256 digest (`crypto.createHash('sha256')`) before querying or inserting into `refresh_tokens`.

### 6.3 Private Lawyer Credential Uploads
Lawyer syndicate ID cards are uploaded via `upload.middleware.ts` (`Multer`).
* Storage path: `uploads/private/lawyer-ids/` (configured via `LEGALMIND_LAWYER_ID_UPLOAD_DIR`).
* Security: Files are stored outside public static directories; served only to admins via authenticated download routes.

### 6.4 CORS & Cookie Credentials
CORS configuration in `src/app/create-app.ts` requires:
* `credentials: true` (Allows browser cookie transmission).
* `origin`: Checked against whitelist `LEGALMIND_CORS_ORIGINS`.

### 6.5 Rate Limiting
Public authentication endpoints (`/login`, `/register`, `/forgot-password`) are guarded by `express-rate-limit` (10 requests per 15-minute window per IP) to block brute-force attacks.

---

## 7. Related Documentation

- [Backend Architecture](BACKEND_ARCHITECTURE.md) - System overview.
- [User Model](database/USER_MODEL.md) - User database schema details.
- [Refresh Token Model](database/REFRESH_TOKEN_MODEL.md) - Refresh token database schema details.
- [API Reference](API_REFERENCE.md) - Complete auth route specifications.
