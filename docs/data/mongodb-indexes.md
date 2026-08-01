# MongoDB indexes

Schema/app indexes:

| Collection | Name | Keys/options |
|---|---|---|
| users | `users_email_unique` | `{email:1}`, unique |
| users | `users_role_active` | `{role:1,isActive:1}` |
| users | `users_organization_active` | `{organizationId:1,isActive:1}` |
| refresh_tokens | `refresh_tokens_hash_unique` | `{tokenHash:1}`, unique |
| refresh_tokens | `refresh_tokens_expiry_ttl` | `{expiresAt:1}`, expireAfterSeconds 0 |
| refresh_tokens | `refresh_tokens_user_revoked` | `{userId:1,revokedAt:1}` |
| conversations | `conversations_id_unique` | `{conversationId:1}`, unique |
| conversations | `conversations_owner_status_recent` | `{ownerUserId:1,status:1,lastMessageAt:-1}` |
| conversations | `conversations_org_owner_recent` | `{organizationId:1,ownerUserId:1,lastMessageAt:-1}` |
| messages | `messages_id_unique` | `{messageId:1}`, unique |
| messages | `messages_conversation_sequence_unique` | `{conversationId:1,sequence:1}`, unique |
| messages | `messages_conversation_created` | `{conversationId:1,createdAt:1}` |
| messages | `messages_owner_idempotency_unique` | `{ownerUserId:1,idempotencyKey:1}`, unique partial string |

`create-indexes.ts` separately creates RAG B-tree indexes:

- `article_lookup_idx`: `{article_number:1,law_name_normalized:1,child_index:1}`
- `chunk_id_idx`: `{chunk_id:1}`, sparse and explicitly non-unique
- `parent_children_idx`: `{parent_chunk_id:1,child_index:1}`
- `appeal_lookup_idx`: `{appeal_number:1,judicial_year:1,is_retrievable:1}`, sparse
- `retrievable_law_idx`: `{is_retrievable:1,law_number:1,law_year:1}`, sparse

`migration_chunk_unique` is created on governance changes only when the verified
status migration applies.

The current exact indexes do not fully lead with governance filters or cover
longest-text sorting. Recommended, not implemented: governed compound
article/appeal/parent-child indexes, a deliberate `chunk_id` uniqueness
decision, and tests comparing Mongo and Atlas filters.
