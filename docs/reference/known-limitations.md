# Known limitations

- Readiness verifies both MongoDB pings and provider configuration, not live
  provider reachability.
- An empty CORS allowlist accepts origin-less requests only. The legacy
  `.env.example` comment saying empty means allow-all is incorrect.
- Query controller logging includes the full request body.
- Rate-limit responses use limiter-defined JSON and bypass the normal error
  envelope/request ID.
- Upload validation checks extension and MIME type, not file signatures.
  Successful credentials have no implemented review/deletion lifecycle.
- Refresh rotation is not transactional; replacement creation can fail after
  the old token was revoked.
- Conversation sequence allocation is not transactional and can leave count or
  sequence gaps after persistence failures.
- Retrying an existing pending assistant returns it immediately; no worker
  resumes pending work in the background.
- Message pagination proceeds from oldest to newer records. Soft-deleted
  conversations/messages have no TTL.
- Follow-up resolution is deterministic. Stored summary is not used to build
  the standalone query; `activeLegalContext` is initialized but never populated.
- Summary cadence is based on total `messageCount % 12` (normally six turns) or
  recent text over 8,000 characters.
- Text-search failure silently degrades to vector-only. Embedding failure has no
  retrieval fallback.
- Grounding uses a fixed `0.35` threshold and currently allows published
  `unknown` authorities and historical court rulings.
- Citation validation removes invalid source IDs but does not prove that every
  legal claim is supported.
- Snapshots omit some corpus provenance fields and are immutable only by
  convention. `citationCoverage` exists but is not set.
- API-key rotation is per process, round-robin, and not health-aware.
- Social chat has no model fallback. Grounded fallback applies only after
  retryable/network primary-model failures.
- No automated full-route E2E, live Atlas integration, CORS,
  SMTP, or contract-analysis tests exist.
