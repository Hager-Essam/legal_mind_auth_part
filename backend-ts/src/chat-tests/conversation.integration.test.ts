import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { HttpError } from "../shared/http/http-error";
import { ConversationModel } from "../modules/conversations/conversation.model";
import { MessageModel } from "../modules/conversations/message.model";
import { ConversationService } from "../modules/conversations/conversation.service";
import type { QueryService } from "../modules/legal-query/query.service";
import { appConnection } from "../infrastructure/mongo/mongo.service";
import { ChatOrchestratorService } from "../modules/conversations/chat-orchestrator.service";
import { ConversationMemoryService } from "../modules/conversations/conversation-memory.service";
import { SourceSnapshotService } from "../modules/conversations/source-snapshot.service";

let mongo: MongoMemoryServer;
const conversations = new ConversationService();
const ownerA = { id: "user-a", organizationId: null };
const ownerB = { id: "user-b", organizationId: null };

const evidence = {
  chunk_id: "chunk-article-10",
  article_number: "10",
  content: "Published Egyptian legal evidence.",
  authorityId: "authority-labor",
  authorityTitleOfficial: "Official test authority",
  authorityTitleNormalized: "official test authority",
  authorityType: "statute" as const,
  authorityStatus: "effective" as const,
  textStatus: "verbatim" as const,
  reviewStatus: "published" as const,
  officialSourceUrl: "https://example.invalid/authority",
  corpusReleaseId: "release-test",
  law_name_normalized: "test authority",
  law_category: "labor",
  source_dataset: "integration-test",
  language: "ar",
  semantic_unit: "article",
  hierarchy_path: "",
  is_retrievable: true,
  jurisdiction: "EG",
  text_len: 34,
};

const successfulQueryService = () =>
  ({
    runQuery: async () => ({
      answer: "Grounded answer [S1]",
      source_chunks: [{ ...evidence }],
      llm_provider_used: "test-provider",
      category: "arabic_rag" as const,
      latency_ms: 5,
      evidence_relevance_score: 0.9,
    }),
  }) as unknown as QueryService;

const orchestrator = (queryService: QueryService) =>
  new ChatOrchestratorService(
    conversations,
    new ConversationMemoryService(),
    new SourceSnapshotService(),
    queryService,
  );

before(async () => {
  mongo = await MongoMemoryServer.create({
    instance: {
      args: ["--setParameter", "indexBuildMinAvailableDiskSpaceMB=50"],
    },
  });
  await appConnection.openUri(mongo.getUri(), {
    dbName: "legalmind_chat_test",
  });
  await ConversationModel.syncIndexes();
  await MessageModel.syncIndexes();
});

beforeEach(async () => {
  await Promise.all([
    ConversationModel.deleteMany({}),
    MessageModel.deleteMany({}),
  ]);
});

after(async () => {
  await appConnection.dropDatabase();
  await appConnection.close();
  await mongo.stop();
});

test("two users cannot read or mutate each other's conversations", async () => {
  const conversationA = await conversations.create(ownerA, {
    title: "A private matter",
  });
  await conversations.create(ownerB, { title: "B private matter" });

  const listA = await conversations.list(ownerA, {
    limit: 20,
    status: "active",
  });
  assert.equal(listA.items.length, 1);
  assert.equal(listA.items[0].ownerUserId, ownerA.id);

  const assertNotFound = async (operation: () => Promise<unknown>) => {
    await assert.rejects(
      operation(),
      (error) =>
        error instanceof HttpError &&
        error.statusCode === 404 &&
        error.code === "CONVERSATION_NOT_FOUND",
    );
  };

  await assertNotFound(() =>
    conversations.get(conversationA.conversationId, ownerB),
  );
  await assertNotFound(() =>
    conversations.listMessages(conversationA.conversationId, ownerB, {
      limit: 50,
    }),
  );
  await assertNotFound(() =>
    conversations.update(conversationA.conversationId, ownerB, {
      title: "stolen",
    }),
  );
  await assertNotFound(() =>
    conversations.softDelete(conversationA.conversationId, ownerB),
  );

  assert.equal(
    (await conversations.get(conversationA.conversationId, ownerA)).title,
    "A private matter",
  );
});

test("saved turns remain ordered, idempotent, and snapshot corpus evidence", async () => {
  const conversation = await conversations.create(ownerA, {
    title: "Persistent chat",
  });
  const chat = orchestrator(successfulQueryService());
  const input = {
    content: "What does Article 10 provide?",
    idempotency_key: "735d1bdc-f80e-4dda-8745-42ef723edaa4",
    top_k: 5,
  };

  const first = await chat.sendMessage(
    conversation.conversationId,
    ownerA,
    input,
  );
  const repeated = await chat.sendMessage(
    conversation.conversationId,
    ownerA,
    input,
  );

  assert.equal(first.userMessage.messageId, repeated.userMessage.messageId);
  assert.equal(
    first.assistantMessage?.messageId,
    repeated.assistantMessage?.messageId,
  );
  assert.equal(await MessageModel.countDocuments({}), 2);

  evidence.content = "The live corpus was changed after generation.";
  const stored = await conversations.listMessages(
    conversation.conversationId,
    ownerA,
    { limit: 50 },
  );
  assert.deepEqual(
    stored.items.map((message) => message.sequence),
    [1, 2],
  );
  assert.equal(
    stored.items[1].sourceSnapshot?.[0].excerpt,
    "Published Egyptian legal evidence.",
  );
  assert.equal(
    stored.items[1].sourceSnapshot?.[0].corpusReleaseId,
    "release-test",
  );
});

test("concurrent sends allocate unique sequence numbers", async () => {
  const conversation = await conversations.create(ownerA, {
    title: "Concurrent chat",
  });
  const chat = orchestrator(successfulQueryService());

  await Promise.all(
    Array.from({ length: 3 }, (_, index) =>
      chat.sendMessage(conversation.conversationId, ownerA, {
        content: `Question ${index + 1}`,
        idempotency_key: `d3e1ef0d-ec74-4ab2-97c8-3eca37a3890${index}`,
        top_k: 5,
      }),
    ),
  );

  const messages = await MessageModel.find({
    conversationId: conversation.conversationId,
  })
    .sort({ sequence: 1 })
    .lean();
  assert.equal(messages.length, 6);
  assert.deepEqual(
    messages.map((message) => message.sequence),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(new Set(messages.map((message) => message.sequence)).size, 6);
});

test("failed generation is saved safely and retries do not duplicate the user message", async () => {
  let attempts = 0;
  const queryService = {
    runQuery: async () => {
      attempts += 1;

      if (attempts === 1) throw new Error("secret provider failure");

      return {
        answer: "Retry succeeded [S1]",
        source_chunks: [{ ...evidence }],
        llm_provider_used: "test-provider",
        category: "arabic_rag" as const,
        latency_ms: 8,
        evidence_relevance_score: 0.8,
      };
    },
  } as unknown as QueryService;
  const conversation = await conversations.create(ownerA, {
    title: "Retry chat",
  });
  const chat = orchestrator(queryService);
  const input = {
    content: "Retry this legal question",
    idempotency_key: "10a45679-6537-4cc8-8c3b-a694572d6363",
    top_k: 5,
  };

  await assert.rejects(
    chat.sendMessage(conversation.conversationId, ownerA, input),
    (error) =>
      error instanceof HttpError &&
      error.code === "CHAT_GENERATION_FAILED",
  );
  const failed = await MessageModel.findOne({
    conversationId: conversation.conversationId,
    role: "assistant",
  }).lean();
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error?.code, "CHAT_GENERATION_FAILED");
  assert.doesNotMatch(JSON.stringify(failed), /secret provider failure/);

  const retry = await chat.sendMessage(
    conversation.conversationId,
    ownerA,
    input,
  );
  assert.equal(retry.assistantMessage?.status, "completed");
  assert.equal(await MessageModel.countDocuments({}), 2);
  assert.equal(attempts, 2);
});
