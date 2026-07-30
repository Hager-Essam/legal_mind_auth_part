# LegalMind Persistent Chat Architecture

## Storage and ownership

Conversations and messages use `appConnection` in `legalmind_app`. Legal
evidence remains in `legalmind_rag`. Every conversation lookup includes:

```ts
{
  conversationId,
  ownerUserId: authenticatedUser.id,
  organizationId: authenticatedUser.organizationId ?? null,
  status: { $ne: "deleted" }
}
```

The API never accepts owner or organization identifiers from a request. A
lookup for another user's conversation returns 404, which avoids revealing
whether the identifier exists.

## Message lifecycle

For each send operation, the chat orchestrator:

1. verifies ownership and checks the idempotency key;
2. atomically allocates message sequence numbers;
3. saves the user message;
4. loads the summary, active legal context, and recent messages;
5. resolves follow-up context into a standalone query;
6. classifies, retrieves, reranks, and applies the grounding policy;
7. generates and validates a source-ID-cited answer;
8. stores the assistant message and immutable source snapshots;
9. updates timestamps, counters, and the conversation summary when due.

The same user/idempotency-key pair returns the existing turn rather than
creating a duplicate. A generation failure preserves the user message and
creates a failed assistant record with a safe error code. Provider errors and
secrets are not stored.

Sequence allocation uses an atomic conversation counter. A rare concurrent
duplicate-key loser can leave an unused sequence number, but it cannot create a
duplicate message or reuse a sequence.

## Conversation memory

Memory is bounded to the conversation summary, structured active context, the
latest 10–12 messages, and the current message. History is used only to resolve
context; previous assistant statements are not treated as legal authorities.

The resolver returns a validated `ConversationRewriteResult`. If resolution
fails, retrieval safely falls back to the current user message. Summaries are
updated after 12 new messages or when recent content exceeds 8,000 characters.
They preserve the user's objective and facts while keeping assumptions and
uncertainties explicit.

## Source snapshots

Assistant messages store the exact qualified excerpts supplied to generation,
plus authority metadata, scores, corpus release, and retrieval time. These
embedded snapshots are immutable from the chat application's perspective.
Reopening an old conversation therefore shows the evidence used at generation
time even if a corpus record is later changed or removed.

## Deletion and retention

Deleting a conversation is a soft delete: `status` becomes `deleted` and
`deletedAt` is recorded. Conversations and messages intentionally have no TTL
indexes. A later retention or compliance policy should be implemented as an
explicit audited purge process.

