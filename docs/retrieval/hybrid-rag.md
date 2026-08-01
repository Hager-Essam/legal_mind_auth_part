# Hybrid RAG

RAG begins with query rewriting. Disabled or failed rewriting returns a
deterministic original/mapping result. Legacy law mapping is disabled by
default; with it disabled, lawyer-role rewriting can bypass the LLM according
to current service rules.

The rewritten query is embedded, then Atlas Vector Search runs against
`legal_chunks_vector`. When hybrid search is enabled, Atlas Search runs
concurrently against `legal_chunks_text`; its failure becomes an empty text
list, leaving vector results. Embedding/vector failure still fails the query.

Both searches require retrievable, Egyptian, published chunks and allow
`effective|amended|unknown`, plus `historical` only for `court_ruling`.
Optional category/law/appeal identifiers become filters.

Text search boosts `text`, normalized/official titles, normalized law name, and
case subject. Vector and text rankings are combined by reciprocal-rank fusion
with configured `RRF_K`. RRF values are small rank signals, not normalized
similarity or legal confidence.

The reranker receives the original user question and candidates. LLM reranking
can fall back to deterministic evidence selection. The heuristic may favor
`similarity_score`; fused candidates may chiefly carry `rrf_score`, so score
origins must be preserved when diagnosing ordering.

`expandWithParentContext` is implemented but has no caller. Current RAG uses
retrieved chunk content without that expansion.
