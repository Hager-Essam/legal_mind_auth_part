# Frontend integration

`frontend/src/api.ts` defaults to `http://localhost:3000/api/v1`; production
builds should set `VITE_LEGALMIND_API_URL` to the full `/api/v1` base.
`frontend/.env.example` uses the same default port 3000.

The client keeps the access token only in module memory and sends the refresh
cookie with `credentials: "include"`. On application startup it refreshes the
session. A shared promise prevents concurrent 401s from rotating the same token
multiple times. `apiFetch` retries the original request once, then clears memory
if refresh fails.

Login/reset stores the returned access token. Logout clears cookie server-side
and memory locally. Registration sends a strict JSON profile without a document upload. Email-verification requests
are cached per token to tolerate React Strict Mode duplicate mounts.

For conversation sends, generate one UUID idempotency key and reuse that same
key for retries. Optimistic records may be shown locally, but replace them with
the returned persisted messages. A 502 can include the failed assistant ID;
retry the same content and key rather than creating another turn.

CORS must list the frontend’s exact origin. Credentialed wildcard CORS is
rejected. If frontend/backend are cross-site, configure SameSite=None, HTTPS,
Secure cookies, and an explicit origin.

Use `evidence_relevance_score` only as a retrieval diagnostic. Never label it
confidence, accuracy, or legal reliability.
