# Authentication architecture

Registration accepts a multipart lawyer profile and credential. Multer writes a
randomized PDF/JPEG/PNG filename in the private directory; Zod validates text
fields. The service normalizes email, creates a bcrypt-hashed user, stores only
the SHA-256 verification-token hash, and sends the raw token by link. If email
sending fails, user and upload are rolled back.

Login selects the hidden password, compares bcrypt, requires an active and
verified account, records `lastLoginAt`, creates a JWT access token and a hashed
opaque refresh-token record, and sets `legalmind_refresh_token`.

The refresh cookie is HTTP-only, scoped to `/api/v1/auth`, uses configured
SameSite, becomes Secure in production or with SameSite=None, and expires with
the refresh record. The access token is returned in JSON. Refresh accepts the
cookie first, then an optional JSON token, rotates the stored token, and detects
reuse. Presenting a stored consumed/expired token revokes active sessions.
Rotation is two writes rather than a transaction.

Verification tokens last 24 hours; reset tokens last one hour. Resend and
forgot-password responses do not reveal whether an account exists. Password
reset changes the password, clears reset state, revokes existing sessions, and
issues a new session.

`authenticate` verifies bearer JWT claims and reloads current user state.
Conversation access then adds owner filters. Role authorization and optional
authentication helpers exist but no route calls them.

The indexes and hidden fields are detailed in
[MongoDB schema](../data/mongodb-schema.md). Endpoint contracts are in
[authentication API](../api/authentication-api.md).
