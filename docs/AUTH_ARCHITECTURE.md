# LegalMind Authentication Architecture

## Scope

Authentication is part of the LegalMind Express application. It uses the same
configuration, logging, request IDs, service container, validation, and error
pipeline as legal query and conversation features. Application records use
`appConnection`; authentication never binds models to `ragConnection`.

## User and role model

Public registration creates a `pending_lawyer`. The API rejects unknown fields,
so clients cannot assign `role`, `organizationId`, activation, verification, or
administrative values.

Supported roles are `user`, `pending_lawyer`, `lawyer`, and `admin`. Passwords
are hashed with bcrypt before persistence and are excluded from ordinary
queries. Emails are trimmed and lowercased before storage and lookup.

`toPublicUser` is the only mapper used for user responses. It excludes password
hashes, verification/reset hashes, refresh-token data, the private lawyer-ID
path, and Mongoose internals.

## Session flow

1. Login verifies the normalized email, password, active status, and email
   verification.
2. The API returns a short-lived access token and public user DTO.
3. A random refresh token is set in the `legalmind_refresh_token` HTTP-only
   cookie.
4. Only the refresh token's SHA-256 hash is stored in `refresh_tokens`.
5. Refresh rotates the record: the old record is revoked and points at the
   replacement hash. A revoked, expired, or replaced token cannot be reused.
6. Logout revokes the presented refresh token; logout-all revokes every active
   refresh token owned by the authenticated user.

Access tokens are signed and verified with HS256, issuer `legalmind-api`, and
audience `legalmind-web`. The decoded payload is validated with Zod before use.
`authenticate` then loads the current user and attaches a small typed
`req.user`; it never attaches a Mongoose document.

## Cookie and browser behavior

The refresh cookie is HTTP-only, has path `/api/v1/auth`, and uses the same
options when set and cleared. It is secure in production. SameSite defaults to
`lax`; a cross-site deployment must explicitly use `none`, HTTPS, and an exact
configured CORS origin. Wildcard CORS is not combined with credentials.

The frontend keeps the access token in memory and sends it as a Bearer token.
Refresh and logout use `credentials: "include"`. One shared refresh promise
prevents concurrent refresh storms, and a failed refresh clears user and
conversation state.

## Verification and password reset

Verification and reset tokens are random values sent to the user; only hashes
are stored. Forgot-password responses are identical for known and unknown
addresses. Reset validates the hash and expiration, changes the password,
clears reset fields, and revokes all existing sessions. A confirmation-email
failure does not roll back a completed password change.

Console email mode is development-only. It provides a local inspection path
without exposing tokens from production logs. SMTP mode uses the configured
provider values.

## Lawyer credential uploads

The registration upload accepts PDF, JPG, JPEG, and PNG within the configured
size limit. It rejects SVG, executable content types, and suspicious
double-extension filenames. Files receive randomized names and are kept below
the private upload directory, which is never mounted with `express.static`.
Failed validation or registration removes the orphaned file.

## Protected routes

`POST /api/v1/query` and all `/api/v1/conversations/*` routes require
authentication. No contract routes were present in the supplied LegalMind
repository; any added contract route must use `authenticate` and an
owner-scoped lookup before it is exposed.

## Stable error codes

Authentication uses stable API codes including `AUTH_REQUIRED`,
`AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS`,
`AUTH_EMAIL_NOT_VERIFIED`, `AUTH_ACCOUNT_DISABLED`,
`AUTH_REFRESH_TOKEN_INVALID`, `AUTH_REFRESH_TOKEN_REUSED`,
`AUTH_INSUFFICIENT_ROLE`, `AUTH_EMAIL_ALREADY_EXISTS`, and
`AUTH_RESET_TOKEN_INVALID`. Provider, database, JWT, and stack details are not
returned to clients.

