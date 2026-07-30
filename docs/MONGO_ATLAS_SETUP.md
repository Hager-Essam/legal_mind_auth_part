# MongoDB Atlas Setup

## Databases and permissions

Use one Atlas cluster and two logical databases:

- `legalmind_app`: `users`, `refresh_tokens`, `conversations`, `messages`,
  and future `audit_events`.
- `legalmind_rag`: `legal_chunks`, `legal_authorities`, and
  `corpus_releases`.

Grant the application database user read/write access only to these two
databases. Do not grant Atlas administrative roles to the running API. Restrict
the Atlas IP access list to deployment egress addresses and approved developer
addresses.

Configure:

```env
LEGALMIND_APP_URI=mongodb+srv://...
LEGALMIND_RAG_URI=mongodb+srv://...
LEGALMIND_APP_DB=legalmind_app
LEGALMIND_RAG_DB=legalmind_rag
LEGALMIND_EMBEDDING_DIM=1024
```

The URIs may point at the same cluster, but model binding and database names
remain separate. Complete URIs must never be logged.

## Safe setup sequence

Run from `backend-ts` after taking a backup:

```bash
npm install
npm run migrate:auth -- --dry-run
npm run migrate:chat -- --dry-run
npm run migrate:legal-source-metadata -- --dry-run
npm run indexes:app -- --dry-run
npm run atlas:indexes -- --dry-run
```

Review the summaries, then remove `--dry-run` in the same order. Scripts are
idempotent and exit non-zero when an operation fails.

`migrate:auth` adapts legacy records already present in `legalmind_app`; moving
records from a separate legacy cluster/database still requires an Atlas
export/import or a controlled transfer before running this migration.

## Standard indexes

`npm run indexes:app` creates or verifies:

- normalized unique user email and user role/organization indexes;
- unique refresh-token hash, expiry TTL, and user/revocation indexes;
- unique conversation identifier and owner/list indexes;
- unique message identifier, sequence, list, and partial idempotency indexes.

The idempotency index is partial rather than merely sparse because it is a
compound index with an always-present owner field. MongoDB sparse compound
indexes can still index a missing idempotency value as `null`, which would
incorrectly limit each owner to one assistant message.

## Atlas Search indexes

`npm run atlas:indexes` targets:

- `legal_chunks_vector` for the configured embedding dimension and governance
  filters;
- `legal_chunks_text` for Arabic legal text, official/normalized titles,
  normalized law name, subject, and article number.

Atlas Search index creation is asynchronous. In Atlas, open Search & Vector
Search for `legalmind_rag.legal_chunks` and wait until both indexes report
`READY` before retrieval verification. Confirm the vector dimension exactly
matches `LEGALMIND_EMBEDDING_DIM`.

## Verification

1. Start the API and inspect `/health` and `/ready`; application and RAG
   connectivity are reported separately.
2. Confirm no raw refresh token exists in `refresh_tokens`.
3. Confirm legacy corpus records remain non-retrievable until governance
   metadata is reviewed and published.
4. Execute one authenticated query and one saved conversation turn.
5. Reopen that turn and compare its saved source snapshots with the answer.

## Rollback

Do not delete the source backup until functional verification is complete.
Application index creation is additive. Governance migration intentionally
fails closed; its safe rollback is to restore reviewed metadata from backup,
not to make unknown records retrievable. If deployment must be reverted, stop
the new API first, restore the database snapshot, and deploy the prior
application version.
