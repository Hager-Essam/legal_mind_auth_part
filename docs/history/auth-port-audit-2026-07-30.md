# Authentication port audit — 2026-07-30

> **Historical.** The original audit was a dated migration/decision record and
> contained baseline statements later superseded by the current frontend and
> backend. Use [authentication architecture](../architecture/authentication.md)
> and [authentication API](../api/authentication-api.md) for current behavior.

The useful preserved decision is that authentication was ported into the
TypeScript backend with users, hashed refresh-token rotation, email
verification/password reset, private lawyer credential upload, bearer
middleware, and frontend refresh handling. Current details must always be
verified from the canonical documents and source.
