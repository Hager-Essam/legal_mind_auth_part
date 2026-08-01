# Terminology

- **Authority**: a legal instrument or ruling represented by one or more
  `legal_chunks`. No `legal_authorities` collection exists.
- **Official title** (`authorityTitleOfficial`): display and citation title.
- **Normalized title** (`authorityTitleNormalized`, `law_name_normalized`):
  search key; not a display title or proof of identity.
- **Exact match**: equality on normalized title or structured law identifiers.
  The ordered-word regular-expression fallback is fuzzy and is accepted only
  when candidates resolve to one authority.
- **Candidate**: a vector/text retrieval result before final selection.
- **Reranked evidence**: deduplicated candidates ordered by an LLM reranker or
  deterministic heuristic.
- **Qualified evidence**: reranked chunks passing governance, citation-metadata,
  and relevance gates; only these enter generation.
- **Source chunk**: qualified evidence returned by the query API.
- **Source snapshot**: a selected subset of source-chunk fields copied into an
  assistant message. Schema does not enforce immutability.
- **Corpus release ID**: provenance value stored on chunks/snapshots. There is
  no `corpus_releases` collection.
- **Evidence relevance score**: retrieval/reranking signal. It is never legal
  accuracy, currency, completeness, correctness, or confidence.
- **Extracted text**: text obtained from a source. `textStatus=extracted` is not
  certification that it is verbatim.
- **Conversation context**: user messages and deterministic follow-up handling;
  it is never legal authority.
- **Owner scope**: both user ID and organization ID are used in conversation
  filters. This does not provide organization-wide sharing.
