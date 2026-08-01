# HTTP Retry and Timeout Utility Guide

> Status: Implemented
> Verified against: `src/services/provider-http.service.ts`
> Related services: EmbeddingService, GenerationService, QueryRewriteService, RerankerService

---

## Overview

`provider-http.service.ts` provides the lower-level `requestProviderText()` client wrapper for issuing outbound HTTP requests to LLM and provider APIs. It enforces request timeouts via Node.js `AbortController`, exponential backoff with randomized jitter, and total retry time budgets.

---

## Functions & Signatures

### `requestProviderText(url: string, init: RequestInit, options: { timeoutMs: number, totalRetryBudgetMs?: number, maxAttempts?: number }): Promise<string>`
* **Inputs**: Target URL, fetch request options, timeout and retry budget options.
* **Outputs**: Raw text response body.
* **Errors**: Throws `ProviderHttpError` (`status`, `retryable`, `message`).

---

## Retry Policy & Exponential Backoff

- **Retryable HTTP Statuses**: `408`, `429`, `500`, `502`, `503`, `504`.
- **Non-Retryable Statuses**: `400`, `401`, `403`, `404` (Fails immediately).
- **Backoff Formula**: `delay = min(250 * 2^(attempt - 1) + jitter, remainingBudget)`
- **`Retry-After` Support**: Parses HTTP `Retry-After` header when present.

---

## Related Files

* Primary source: `src/services/provider-http.service.ts`
* Consumers: All external provider services
* Error handling: [Error Handling & Reliability](../ERROR_HANDLING_AND_RELIABILITY.md)
