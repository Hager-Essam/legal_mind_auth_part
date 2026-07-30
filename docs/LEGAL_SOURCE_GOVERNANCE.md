# Legal Source Governance

## Required metadata

Legal chunks and authorities carry an immutable authority identity, official
and normalized titles, jurisdiction, authority and text types, temporal status,
review status, official URL, reviewer information, corpus release, and an
explicit `isRetrievable` decision.

Missing metadata fails closed. The metadata migration assigns conservative
`unknown`/`draft` values and does not publish legacy records automatically.
Publication must be a deliberate legal/editorial review decision.

## Ordinary Egyptian-law retrieval

Normal queries require all of the following on the same chunk:

- `jurisdiction = EG`;
- `isRetrievable = true`;
- `reviewStatus = published`;
- `authorityStatus` is `effective` or `amended`;
- relevance passes the configured grounding threshold;
- sufficient citation metadata is present.

Historical or repealed material requires an explicit historical/date-specific
workflow. Draft, quarantined, wrong-jurisdiction, generated-summary-as-statute,
and incomplete records do not qualify.

## Authority and article resolution

Exact-reference lookup proceeds from authority ID, to exact normalized title,
to law number/year/jurisdiction, to a verified alias. Fuzzy titles are accepted
only when they resolve uniquely. Article identifiers are parsed and compared
exactly, so Article 10 does not boost Article 1. Multi-article requests may
return partial results, with child chunks ordered by `child_index`.

Official titles are used in citations. Normalized titles exist for matching and
must not be displayed as though they were official names.

## Generation boundary

Qualified evidence is serialized with source IDs inside
`<legal_evidence>`. The generation prompt declares evidence untrusted data and
forbids following instructions contained in it. Legal claims must cite valid
IDs such as `[S1]` or `[S1, S3]`; invalid IDs are removed and an answer without
valid grounding is rejected.

The excerpts returned to clients and saved with messages are the excerpts
actually supplied to generation. Retrieval/reranker values are described as
evidence relevance, never as legal correctness or accuracy.

## Releases and change control

Every published ingestion should receive a `corpusReleaseId`. Record the input
dataset, review decision, ingestion time, embedding model/dimension, and Search
index version. Changes to official text or status create a new reviewed release
rather than mutating the source snapshot stored in an old assistant message.

