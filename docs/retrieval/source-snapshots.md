# Source snapshots

The evidence sets are distinct:

1. vector/text candidates;
2. fused and reranked candidates;
3. governance/score-qualified generation evidence;
4. `source_chunks` returned by `QueryService`;
5. snapshots copied into a completed assistant message.

The current query path uses the same qualified excerpts for generation and API
`source_chunks`. `SourceSnapshotService.create` then maps those chunks to IDs,
authority/title/type/status, legal pinpoints, selected source provenance,
excerpt, retrieval/rerank scores, release ID, and retrieval time.

Snapshots do not contain all permissive `legal_chunks` fields. They are
historical evidence attached to the saved answer, not proof the corpus text was
verbatim or legally current. The message schema does not enforce immutability;
application code simply does not currently edit completed snapshots.

Direct `/api/v1/query` calls are not saved and therefore produce no persistent
snapshot. Conversation turns save snapshots only after successful query
completion.
