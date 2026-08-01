import crypto from "node:crypto";
import { HttpError } from "../../shared/http/http-error";
import { ConversationModel } from "./conversation.model";
import { MessageModel } from "./message.model";
import type {
  ConversationStatus,
  Message,
} from "./conversation.types";

export type ConversationOwner = {
  id: string;
  organizationId: string | null;
};

const encodeCursor = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const decodeCursor = <T>(cursor: string): T => {
  try {
    return JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as T;
  } catch {
    throw new HttpError(
      400,
      "The pagination cursor is invalid.",
      undefined,
      "INVALID_CURSOR",
    );
  }
};

export class ConversationService {
  ownershipFilter(conversationId: string, owner: ConversationOwner) {
    return {
      conversationId,
      ownerUserId: owner.id,
      organizationId: owner.organizationId ?? null,
      status: { $ne: "deleted" as const },
    };
  }

  async create(
    owner: ConversationOwner,
    input: { title?: string; user_role?: "lawyer" | "citizen" },
  ) {
    return ConversationModel.create({
      conversationId: crypto.randomUUID(),
      ownerUserId: owner.id,
      organizationId: owner.organizationId ?? null,
      title: input.title ?? "New legal conversation",
      status: "active",
      jurisdiction: "EG",
      defaultUserRole: input.user_role ?? "citizen",
      summary: "",
      summaryVersion: 0,
      activeLegalContext: {
        jurisdiction: "EG",
        authorityIds: [],
        lawReferences: [],
        facts: [],
        assumptions: [],
        unresolvedQuestions: [],
      },
      messageCount: 0,
      lastMessageAt: new Date(),
    });
  }

  async list(
    owner: ConversationOwner,
    input: {
      cursor?: string;
      limit: number;
      status: Exclude<ConversationStatus, "deleted">;
    },
  ) {
    const filter: Record<string, unknown> = {
      ownerUserId: owner.id,
      organizationId: owner.organizationId ?? null,
      status: input.status,
    };
    if (input.cursor) {
      const cursor = decodeCursor<{
        lastMessageAt: string;
        conversationId: string;
      }>(input.cursor);
      const cursorDate = new Date(cursor.lastMessageAt);
      if (
        Number.isNaN(cursorDate.getTime()) ||
        typeof cursor.conversationId !== "string"
      ) {
        throw new HttpError(
          400,
          "The pagination cursor is invalid.",
          undefined,
          "INVALID_CURSOR",
        );
      }
      filter.$or = [
        { lastMessageAt: { $lt: cursorDate } },
        {
          lastMessageAt: cursorDate,
          conversationId: { $lt: cursor.conversationId },
        },
      ];
    }
    const rows = await ConversationModel.find(filter)
      .sort({ lastMessageAt: -1, conversationId: -1 })
      .limit(input.limit + 1)
      .lean();
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              lastMessageAt: last.lastMessageAt.toISOString(),
              conversationId: last.conversationId,
            })
          : null,
    };
  }

  async get(conversationId: string, owner: ConversationOwner) {
    const conversation = await ConversationModel.findOne(
      this.ownershipFilter(conversationId, owner),
    );
    if (!conversation) {
      throw new HttpError(
        404,
        "Conversation not found.",
        undefined,
        "CONVERSATION_NOT_FOUND",
      );
    }
    return conversation;
  }

  async listMessages(
    conversationId: string,
    owner: ConversationOwner,
    input: { cursor?: string; limit: number },
  ) {
    await this.get(conversationId, owner);
    const filter: Record<string, unknown> = {
      conversationId,
      ownerUserId: owner.id,
      organizationId: owner.organizationId ?? null,
    };
    if (input.cursor) {
      const cursor = decodeCursor<{ sequence: number }>(input.cursor);
      if (!Number.isInteger(cursor.sequence) || cursor.sequence < 0) {
        throw new HttpError(
          400,
          "The pagination cursor is invalid.",
          undefined,
          "INVALID_CURSOR",
        );
      }
      filter.sequence = { $gt: cursor.sequence };
    }
    const rows = await MessageModel.find(filter)
      .sort({ sequence: 1 })
      .limit(input.limit + 1)
      .lean();
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit) as Message[];
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor({ sequence: last.sequence }) : null,
    };
  }

  async update(
    conversationId: string,
    owner: ConversationOwner,
    input: { title?: string; status?: "active" | "archived" },
  ) {
    const conversation = await ConversationModel.findOneAndUpdate(
      this.ownershipFilter(conversationId, owner),
      { $set: input },
      { returnDocument: "after", runValidators: true },
    );
    if (!conversation) {
      throw new HttpError(
        404,
        "Conversation not found.",
        undefined,
        "CONVERSATION_NOT_FOUND",
      );
    }
    return conversation;
  }

  async softDelete(
    conversationId: string,
    owner: ConversationOwner,
  ): Promise<void> {
    const result = await ConversationModel.updateOne(
      this.ownershipFilter(conversationId, owner),
      { $set: { status: "deleted", deletedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new HttpError(
        404,
        "Conversation not found.",
        undefined,
        "CONVERSATION_NOT_FOUND",
      );
    }
  }
}
