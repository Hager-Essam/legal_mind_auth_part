# Conversations API

Base: `/api/v1/conversations`. Every route requires a bearer token and uses
user-plus-organization owner scope.

| Method/path | Input | Success |
|---|---|---|
| `POST /` | `{title?, user_role?}` | 201 conversation |
| `GET /` | `cursor?`, `limit=20` (1..50), `status=active` | items + next cursor |
| `GET /:id` | — | conversation |
| `GET /:id/messages` | `cursor?`, `limit=50` (1..100) | messages + next cursor |
| `POST /:id/messages` | send body | 201 saved pair; 20/min |
| `PATCH /:id` | at least one of `title`, `status` | conversation |
| `DELETE /:id` | — | 204 soft delete |

Create uses request field `user_role`, while the response names the stored value
`default_user_role`. Status input is `active|archived`.

Send body:

```json
{
  "content": "1..2000 characters",
  "idempotency_key": "UUID",
  "top_k": 5,
  "user_role": "citizen"
}
```

The response has `user_message` and nullable `assistant_message`. Message DTOs
include ID, role/status/sequence/content, original/retrieval query, category,
`source_snapshot`, `diagnostics`, idempotency key, safe error, and timestamps.
Conversation DTOs include summary, active legal context, counts, and timestamps.

Conversation listing is newest-first. Message listing starts at the oldest
records and advances forward. Cursor values are opaque.

A repeated identical key returns the existing turn. Reusing it for different
content/conversation returns 409. Failed assistants can be retried with the same
key. A pending record is returned without background resumption. Ownership
mismatches appear as 404.
