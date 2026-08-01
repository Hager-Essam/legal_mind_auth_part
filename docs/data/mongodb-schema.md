# MongoDB schema

## Implemented collections

| Database / collection | Active fields and behavior | Readers/writers |
|---|---|---|
| App / `users` | normalized email; hidden bcrypt password and credential/token fields; profile, role, verification/active flags, organization, login/timestamps | auth/user repository |
| App / `refresh_tokens` | token hash, user ObjectId, expiry, revocation/replacement/IP metadata, timestamps; expiry TTL | auth/refresh repository |
| App / `conversations` | public ID, immutable owner/org/jurisdiction, title/status/default role, summary/context, counts, soft-delete/timestamps | conversation/memory/orchestrator |
| App / `messages` | public/conversation/owner IDs, role/status/sequence/content, queries/category, snapshot, diagnostics, idempotency/error/timestamps | conversation/memory/orchestrator |
| RAG / `legal_chunks` | text/hierarchy/identity/search/governance/provenance/embedding fields | retrieval and corpus scripts |
| RAG / `corpus_governance_changes` | migration/chunk/authority, prior metadata, timestamp | verified-status migration |

There are no `legal_authorities`, `corpus_releases`, `audit_events`, or contract
collections.

## Ownership and retention

Conversation filters always combine user and organization. This isolates owners;
it does not share data across an organization. Soft-deleted records remain
stored. Refresh tokens expire through a TTL index; users/conversations/messages
do not.

## Legal chunks

The Mongoose schema uses `strict:false`, so stored records may contain more
fields than the API Zod schema exposes. Retrieval relies on snake-case content
fields (`chunk_id`, `article_number`, `law_number`, etc.) and camel-case
governance fields (`authorityTitleOfficial`, `authorityStatus`, `reviewStatus`).

Ordinary retrieval requires `is_retrievable=true`, `jurisdiction=EG`,
`reviewStatus=published`, and status `effective|amended|unknown`, or historical
only for court rulings. `unknown` eligibility is intentional current behavior.

Normalized name fields are lookup keys, official title is display/citation
metadata. `embeddingModel`/`embeddingDim` can be synthesized for legacy vectors.
`textStatus=extracted` is not verbatim certification. `activeLegalContext` is
initialized but not populated, and message `citationCoverage` is defined but
currently unset.
