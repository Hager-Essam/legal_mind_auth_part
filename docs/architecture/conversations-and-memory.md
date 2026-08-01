# Conversations and memory

All conversation routes require authentication. Persistence filters include
`conversationId`, `ownerUserId`, and the owner’s `organizationId`; absence is
reported as 404 to avoid disclosing another owner’s resource.

Conversations can be active, archived, or soft-deleted. Single-resource reads
exclude deleted records. Updates can target archived records. Deletion retains
conversation/message data and has no TTL.

Creating a turn reserves two sequence numbers by incrementing `messageCount`,
then stores the user and pending assistant records. A per-user idempotency-key
unique index prevents duplicate user messages. Reuse with different content or
conversation returns 409. Allocation and inserts are not transactional.

Memory loads the latest 12 messages and restores ascending sequence order. A
regular-expression heuristic finds a prior completed user message; a short
follow-up is concatenated to it. There is no LLM memory resolver. Stored summary
does not participate in the standalone query. `activeLegalContext` contributes
returned authority/fact arrays but is never populated by current code.

Summary update occurs when total `messageCount` is divisible by 12 or recent
text exceeds 8,000 characters. It deterministically records recent user
objectives and any already-stored facts/assumptions/unresolved questions.

Conversation lists are newest-first with a cursor. Message lists are
oldest-first and the cursor advances forward. Source snapshots and diagnostics
belong to completed assistant records; see
[source snapshots](../retrieval/source-snapshots.md).
