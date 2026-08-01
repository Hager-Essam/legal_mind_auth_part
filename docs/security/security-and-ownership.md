# Security and ownership

Protected requests require a signed access JWT and a fresh active user lookup.
Conversation queries then filter by both user and organization; inaccessible
records return 404. Organization membership does not grant organization-wide
conversation access.

Refresh tokens are opaque, hashed at rest, rotated, and reusable-token detection
revokes sessions. Access tokens are short-lived but remain bearer credentials.
The frontend keeps them in memory; the refresh cookie is HTTP-only. Rotation is
not transactional.

CORS is exact-origin with credentials. Empty allowlist permits only origin-less
traffic; wildcard is rejected. Rate limits protect auth entry points, query,
and message sends, but are process-local middleware policy unless an external
shared store is configured.

Corpus content is untrusted. Governance filters remove ineligible records;
context content is XML-escaped; prompts instruct the model not to follow source
instructions; citations are restricted to supplied IDs. These are defense
layers, not proof against all prompt injection or unsupported claims.

Logs must avoid secrets and sensitive content. The current query controller
logs complete request bodies and should be treated as a privacy risk. Request
IDs support correlation; rate-limit responses do not include them.
