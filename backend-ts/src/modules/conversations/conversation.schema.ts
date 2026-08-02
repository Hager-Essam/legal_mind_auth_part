import { Schema } from "mongoose";
import type { ActiveLegalContext, Conversation } from "./conversation.types";

const lawReferenceSchema = new Schema(
  {
    authorityId: String,
    officialTitle: String,
    lawNumber: String,
    lawYear: String,
    articleNumbers: [String],
  },
  { _id: false }
);

const activeLegalContextSchema = new Schema<ActiveLegalContext>(
  {
    jurisdiction: { type: String, enum: ["EG"], default: "EG" },
    authorityIds: { type: [String], default: [] },
    lawReferences: { type: [lawReferenceSchema], default: [] },
    facts: { type: [String], default: [] },
    assumptions: { type: [String], default: [] },
    unresolvedQuestions: { type: [String], default: [] },
  },
  { _id: false }
);

export const conversationSchema = new Schema<Conversation>(
  {
    conversationId: { type: String, required: true },
    ownerUserId: { type: String, required: true, immutable: true },
    organizationId: { type: String, default: null, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
      required: true,
    },
    jurisdiction: {
      type: String,
      enum: ["EG"],
      default: "EG",
      required: true,
      immutable: true,
    },
    defaultUserRole: {
      type: String,
      enum: ["lawyer", "citizen"],
      default: "citizen",
      required: true,
    },
    summary: { type: String, default: "" },
    summaryVersion: { type: Number, default: 0 },
    activeLegalContext: {
      type: activeLegalContextSchema,
      default: () => ({ jurisdiction: "EG" }),
    },
    messageCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now, required: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "conversations",
    timestamps: true,
    versionKey: false,
  }
);

conversationSchema.index({ conversationId: 1 }, { unique: true, name: "conversations_id_unique" });
conversationSchema.index(
  { ownerUserId: 1, status: 1, lastMessageAt: -1 },
  { name: "conversations_owner_status_recent" }
);
conversationSchema.index(
  { organizationId: 1, ownerUserId: 1, lastMessageAt: -1 },
  { name: "conversations_org_owner_recent" }
);
