# Conversation Model Database Guide

> Status: Implemented
> Collection: `legalmind_app.conversations`
> Verified against: `src/modules/conversations/conversation.schema.ts`, `src/modules/conversations/conversation.model.ts`

---

## Overview

The `Conversation` model stores stateful chat thread metadata, ownership scoping (`ownerUserId`, `organizationId`), thread title, soft deletion status, running context summary, and message counters.

---

## Schema Fields & Types

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Yes | Auto | Unique MongoDB primary key. |
| `conversationId` | `String` | Yes | None | Public UUID v4 thread identifier. Unique index. |
| `ownerUserId` | `String` | Yes | None | Owning user ID (Immutable). |
| `organizationId` | `String` | No | `null` | Multi-tenant organization identifier (Immutable). |
| `title` | `String` | Yes | None | Thread title (Max 160 chars). |
| `status` | `String` | Yes | `'active'` | Enum (`'active'`, `'archived'`, `'deleted'`). |
| `jurisdiction` | `String` | Yes | `'EG'` | Country code (Immutable). |
| `defaultUserRole` | `String` | Yes | `'citizen'` | Enum (`'lawyer'`, `'citizen'`). |
| `summary` | `String` | No | `""` | Progressive LLM summary text. |
| `summaryVersion` | `Number` | No | `0` | Incremental summary version counter. |
| `activeLegalContext` | `Object` | Yes | Default object | Active legal context object (`facts`, `assumptions`, `authorityIds`). |
| `messageCount` | `Number` | Yes | `0` | Total messages counter (Min 0). |
| `lastMessageAt` | `Date` | Yes | `Date.now` | Timestamp of latest message activity. |
| `deletedAt` | `Date` | No | `null` | Soft deletion timestamp. |
| `createdAt` | `Date` | Yes | Auto | Thread creation timestamp. |
| `updatedAt` | `Date` | Yes | Auto | Last update timestamp. |

---

## Database Indexes

- `conversations_id_unique`: `{ conversationId: 1 }` (Unique)
- `conversations_owner_status_recent`: `{ ownerUserId: 1, status: 1, lastMessageAt: -1 }`
- `conversations_org_owner_recent`: `{ organizationId: 1, ownerUserId: 1, lastMessageAt: -1 }`

---

## Related Files

* Model source: `src/modules/conversations/conversation.model.ts`
* Schema source: `src/modules/conversations/conversation.schema.ts`
* Service: `src/modules/conversations/conversation.service.ts`
* Architecture: [Conversation Architecture](../CONVERSATION_ARCHITECTURE.md)
