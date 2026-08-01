# Provider failures

The shared provider HTTP layer retries response status 408, 429, and 5xx plus
network/timeout errors, bounded by maximum attempts and a total time budget.
Backoff uses Retry-After when present, exponential delay, and jitter, capped by
remaining budget. Other HTTP statuses are permanent.

| Stage failure | Current behavior |
|---|---|
| Rewrite | original/deterministic mapping fallback |
| Embedding/vector search | query fails |
| Text search | vector-only candidates |
| LLM rerank | heuristic rerank |
| Grounding insufficient | refusal; no generation |
| Primary grounded generation, retryable/network | fallback model |
| Primary permanent error | fails without model fallback |
| Social generation | one fallback model only |
| Citation/provider/query failure in saved turn | assistant saved failed; HTTP 502 |

Provider configuration errors can also fail before HTTP. API keys rotate
round-robin per process and are not marked unhealthy. `llm_provider_used`
identifies the configured provider, not the exact successful model and not a
success guarantee.

The evaluator’s judge call is a separate direct provider path and is not
calibrated or covered by the same retry guarantees.
