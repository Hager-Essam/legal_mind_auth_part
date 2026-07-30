import { Schema } from "mongoose";
import type { Message, SourceSnapshot } from "./conversation.types";

const sourceSnapshotSchema = new Schema<SourceSnapshot>(
  {
    sourceId: { type: String, required: true },
    chunkId: { type: String, required: true },
    authorityId: String,
    authorityTitleOfficial: String,
    authorityType: String,
    jurisdiction: { type: String, required: true },
    authorityStatus: String,
    articleNumber: String,
    lawNumber: String,
    lawYear: String,
    appealNumber: String,
    judicialYear: String,
    rulingDate: String,
    sourceDataset: String,
    sourceFile: String,
    officialSourceUrl: String,
    excerpt: { type: String, required: true },
    retrievalScore: Number,
    rerankScore: Number,
    corpusReleaseId: String,
    retrievedAt: { type: Date, required: true },
  },
  { _id: false },
);

const diagnosticsSchema = new Schema(
  {
    rewriteUsed: { type: Boolean, required: true },
    rewriteMethod: {
      type: String,
      enum: ["none", "mapping", "llm", "conversation"],
    },
    evidenceRelevanceScore: Number,
    citationCoverage: Number,
    latencyMs: Number,
    llmProvider: { type: String, default: null },
    llmModel: { type: String, default: null },
    corpusReleaseId: String,
  },
  { _id: false },
);

const messageErrorSchema = new Schema(
  {
    code: { type: String, required: true },
    safeMessage: { type: String, required: true },
  },
  { _id: false },
);

export const messageSchema = new Schema<Message>(
  {
    messageId: { type: String, required: true, immutable: true },
    conversationId: { type: String, required: true, immutable: true },
    ownerUserId: { type: String, required: true, immutable: true },
    organizationId: { type: String, default: null, immutable: true },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      required: true,
    },
    sequence: { type: Number, required: true, min: 1, immutable: true },
    content: { type: String, required: true },
    originalQuery: String,
    retrievalQuery: String,
    category: { type: String, enum: ["arabic_rag", "law_ref", "chat"] },
    sourceSnapshot: {
      type: [sourceSnapshotSchema],
      default: undefined,
    },
    diagnostics: { type: diagnosticsSchema },
    idempotencyKey: { type: String, immutable: true },
    error: { type: messageErrorSchema },
  },
  {
    collection: "messages",
    timestamps: true,
    versionKey: false,
  },
);

messageSchema.index(
  { messageId: 1 },
  { unique: true, name: "messages_id_unique" },
);
messageSchema.index(
  { conversationId: 1, sequence: 1 },
  { unique: true, name: "messages_conversation_sequence_unique" },
);
messageSchema.index(
  { conversationId: 1, createdAt: 1 },
  { name: "messages_conversation_created" },
);
messageSchema.index(
  { ownerUserId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "messages_owner_idempotency_unique",
  },
);
