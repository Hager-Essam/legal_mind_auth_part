# Reranking and grounding

Evidence selection deduplicates candidates and either calls the configured
DashScope reranker or applies a heuristic fallback. Only the configured top
count continues.

Grounding assigns relevance from `rerank_score`, then `similarity_score`, then
`rrf_score`. A chunk qualifies only when its score is at least 0.35, it has an
official title and article/appeal/authority pinpoint, it is retrievable and
published in Egypt, and its authority status is currently eligible. The
threshold is fixed in source.

If none qualify, the service returns a refusal with no source chunks and does
not invoke answer generation. If chunks qualify, the context builder escapes
their content into source-ID-tagged XML. The generator is instructed to treat
evidence as untrusted data and cite supplied IDs.

Citation validation checks cited IDs are in range and removes invalid IDs. It
does not perform claim-level entailment or guarantee every claim has support;
unsupported prose may remain after a bad ID is removed.

Every score in this flow represents evidence retrieval/relevance. It must never
be described as legal confidence, legal accuracy, currency, completeness, or
correctness.
