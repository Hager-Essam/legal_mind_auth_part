# HTTP API

Default local base URL: `http://localhost:3000/api/v1`. Success bodies are
endpoint-specific. Except for limiter responses, failures use:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Safe message",
  "details": {},
  "request_id": "uuid"
}
```

Malformed JSON, Zod/Mongoose/Multer validation, duplicate keys, typed HTTP
errors, missing routes, and unknown errors are normalized. Authentication uses
`Authorization: Bearer <access-token>`.

| Method/path | Auth | Limit | Result |
|---|---:|---:|---|
| `GET /` | no | — | app metadata and route roots |
| `GET /health` | no | — | liveness |
| `GET /ready` | no | — | 200/503 DB/provider-configuration summary |
| `POST /api/v1/query` | bearer | 20/min | unsaved `QueryResponse` |
| `/api/v1/auth/*` | mixed | per endpoint | [authentication API](authentication-api.md) |
| `/api/v1/conversations/*` | bearer | send: 20/min | [conversation API](conversations-api.md) |

`POST /query` accepts:

```json
{
  "query": "string, 3..2000",
  "top_k": 5,
  "law_category": "optional string",
  "user_role": "lawyer"
}
```

`top_k` is 1..50 and defaults to 5; `user_role` is `lawyer|citizen`.
Response fields are `answer`, `source_chunks`, `llm_provider_used` (nullable),
`category`, `latency_ms`, and optional `evidence_relevance_score`. Direct query
answers are not stored. The current controller logs the complete body.

Rate-limit bodies are defined by `express-rate-limit` and do not include
`success` or `request_id`. Standard rate-limit headers are enabled.
