import assert from "node:assert/strict";
import { test } from "node:test";
import { appConnection } from "../services/mongo.service";
import { ConversationMemoryService } from "../services/conversation-memory.service";
import { SourceSnapshotService } from "../services/source-snapshot.service";
import { ConversationModel } from "../modules/conversations/conversation.model";
import { MessageModel } from "../modules/conversations/message.model";
import { conversationSchema } from "../modules/conversations/conversation.schema";
import { messageSchema } from "../modules/conversations/message.schema";
import {
  createConversationSchema,
  sendMessageSchema,
} from "../modules/conversations/conversation.schemas";
import { ConversationService } from "../modules/conversations/conversation.service";
import type {
  ActiveLegalContext,
  Message,
} from "../modules/conversations/conversation.types";
import type { LegalChunks } from "../schemas";

const emptyContext: ActiveLegalContext = {
  jurisdiction: "EG",
  authorityIds: [],
  lawReferences: [],
  facts: [],
  assumptions: [],
  unresolvedQuestions: [],
};

test("contextual follow-up includes employment and probation context", async () => {
  const memory = new ConversationMemoryService();
  const previous = {
    role: "user",
    status: "completed",
    content: "ما شروط فصل العامل؟",
  } as Message;
  const result = await memory.resolve({
    summary: "",
    activeLegalContext: emptyContext,
    recentMessages: [previous],
    currentMessage: "وماذا عن فترة الاختبار؟",
  });
  assert.equal(result.isFollowUp, true);
  assert.match(result.standaloneQuery, /فصل العامل/);
  assert.match(result.standaloneQuery, /فترة الاختبار/);
});

test("memory resolver safely falls back for standalone questions", async () => {
  const result = await new ConversationMemoryService().resolve({
    summary: "",
    activeLegalContext: emptyContext,
    recentMessages: [],
    currentMessage: "ما عقوبة التزوير؟",
  });
  assert.equal(result.isFollowUp, false);
  assert.equal(result.standaloneQuery, "ما عقوبة التزوير؟");
});

test("conversation request schemas reject ownership fields", () => {
  assert.equal(
    createConversationSchema.safeParse({
      title: "Injected",
      ownerUserId: "another-user",
    }).success,
    false,
  );
  assert.equal(
    sendMessageSchema.safeParse({
      content: "Question",
      idempotency_key: "b777492e-7d2d-4fcb-b7d3-21282c886277",
      owner_user_id: "another-user",
    }).success,
    false,
  );
});

test("every ownership filter includes user, organization, and non-deleted status", () => {
  const filter = new ConversationService().ownershipFilter("conversation-1", {
    id: "user-a",
    organizationId: null,
  });
  assert.deepEqual(filter, {
    conversationId: "conversation-1",
    ownerUserId: "user-a",
    organizationId: null,
    status: { $ne: "deleted" },
  });
});

test("conversation and message models use appConnection with required indexes and no TTL", () => {
  assert.equal(ConversationModel.db, appConnection);
  assert.equal(MessageModel.db, appConnection);
  const conversationIndexes = conversationSchema.indexes();
  const messageIndexes = messageSchema.indexes();
  assert.ok(
    conversationIndexes.some(
      ([keys, options]) =>
        keys.conversationId === 1 && options.unique === true,
    ),
  );
  assert.ok(
    messageIndexes.some(
      ([keys, options]) =>
        keys.conversationId === 1 &&
        keys.sequence === 1 &&
        options.unique === true,
    ),
  );
  assert.ok(
    messageIndexes.some(
      ([keys, options]) =>
        keys.ownerUserId === 1 &&
        keys.idempotencyKey === 1 &&
        options.unique === true &&
        options.partialFilterExpression?.idempotencyKey?.$type === "string",
    ),
  );
  assert.equal(
    [...conversationIndexes, ...messageIndexes].some(
      ([, options]) => options.expireAfterSeconds !== undefined,
    ),
    false,
  );
});

test("source snapshots preserve the evidence excerpt after corpus data changes", () => {
  const chunk = {
    chunk_id: "chunk-1",
    article_number: "10",
    content: "Original legal evidence.",
    law_name_normalized: "Test law",
    law_category: "labor",
    source_dataset: "test",
    language: "ar",
    semantic_unit: "article",
    hierarchy_path: "",
    is_retrievable: true,
    jurisdiction: "EG",
    text_len: 24,
  } satisfies LegalChunks;
  const snapshot = new SourceSnapshotService().create([chunk]);
  chunk.content = "Changed corpus evidence.";
  assert.equal(snapshot[0].excerpt, "Original legal evidence.");
  assert.notEqual(snapshot[0].excerpt, chunk.content);
});
