# LegalMind Chat API

All endpoints require `Authorization: Bearer <access-token>`. JSON uses
snake_case at the API boundary.

## Create a conversation

```http
POST /api/v1/conversations
Content-Type: application/json

{
  "title": "قانون العمل",
  "default_user_role": "lawyer"
}
```

Returns `201` with conversation metadata.

## List conversations

```http
GET /api/v1/conversations?status=active&limit=20&cursor=<opaque-cursor>
```

Results are ordered by `last_message_at` descending:

```json
{
  "conversations": [],
  "next_cursor": null
}
```

Treat the cursor as opaque.

## Get metadata and messages

```http
GET /api/v1/conversations/:conversationId
GET /api/v1/conversations/:conversationId/messages?limit=50&cursor=<opaque-cursor>
```

Message responses include their saved `source_snapshot`; clients must not
replace it with live corpus data.

## Send a message

```http
POST /api/v1/conversations/:conversationId/messages
Content-Type: application/json

{
  "content": "وماذا عن فترة الاختبار؟",
  "idempotency_key": "c4d973de-11ba-4fc0-88be-f29c1694dc2f",
  "top_k": 5,
  "user_role": "lawyer"
}
```

Returns `201`:

```json
{
  "user_message": {},
  "assistant_message": {}
}
```

Reuse the same idempotency key to retry an uncertain network result. Do not
generate a new key until the client intends to create a new turn.

## Rename, archive, or restore

```http
PATCH /api/v1/conversations/:conversationId
Content-Type: application/json

{
  "title": "الفصل وفترة الاختبار",
  "status": "archived"
}
```

## Soft delete

```http
DELETE /api/v1/conversations/:conversationId
```

Returns `204`. Deleted conversations are excluded from normal owner-scoped
queries.

## Errors

Errors use LegalMind's standard shape:

```json
{
  "error": "STABLE_ERROR_CODE",
  "message": "Safe client-facing description",
  "request_id": "..."
}
```

Another user's resource is reported as not found. Authentication failures are
401, validation failures are 400, and rate limiting is 429.

