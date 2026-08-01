import crypto from "node:crypto";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http/http-error";
import { ConversationModel } from "./conversation.model";
import { MessageModel } from "./message.model";
import type {
  Message,
  SourceSnapshot,
} from "./conversation.types";
import type {
  ConversationOwner,
  ConversationService,
} from "./conversation.service";
import type { QueryService } from "../../services/query.service";
import type { ConversationMemoryService } from "./conversation-memory.service";
import type { SourceSnapshotService } from "./source-snapshot.service";

export type SendConversationMessageInput = {
  content: string;
  idempotency_key: string;
  top_k: number;
  user_role?: "lawyer" | "citizen";
};

export class ChatOrchestratorService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly memory: ConversationMemoryService,
    private readonly snapshots: SourceSnapshotService,
    private readonly queryService: QueryService,
  ) {}

  async sendMessage(
    conversationId: string,
    owner: ConversationOwner,
    input: SendConversationMessageInput,
  ) {
    const conversation = await this.conversations.get(conversationId, owner);
    const existingUser = await MessageModel.findOne({
      ownerUserId: owner.id,
      idempotencyKey: input.idempotency_key,
    });
    if (existingUser) {
      if (
        existingUser.conversationId !== conversationId ||
        existingUser.content !== input.content
      ) {
        throw new HttpError(
          409,
          "The idempotency key was already used for another request.",
          undefined,
          "IDEMPOTENCY_KEY_CONFLICT",
        );
      }
      return this.resumeOrReturnExisting(
        conversation,
        existingUser as unknown as Message,
        owner,
        input,
      );
    }

    const allocated = await ConversationModel.findOneAndUpdate(
      this.conversations.ownershipFilter(conversationId, owner),
      {
        $inc: { messageCount: 2 },
        $set: { lastMessageAt: new Date() },
      },
      { returnDocument: "after" },
    );
    if (!allocated) {
      throw new HttpError(
        404,
        "Conversation not found.",
        undefined,
        "CONVERSATION_NOT_FOUND",
      );
    }
    const assistantSequence = allocated.messageCount;
    const userSequence = assistantSequence - 1;

    let userMessage;
    try {
      userMessage = await MessageModel.create({
        messageId: crypto.randomUUID(),
        conversationId,
        ownerUserId: owner.id,
        organizationId: owner.organizationId ?? null,
        role: "user",
        status: "completed",
        sequence: userSequence,
        content: input.content,
        originalQuery: input.content,
        idempotencyKey: input.idempotency_key,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        const duplicate = await MessageModel.findOne({
          ownerUserId: owner.id,
          idempotencyKey: input.idempotency_key,
        });
        if (duplicate) {
          return this.resumeOrReturnExisting(
            conversation,
            duplicate as unknown as Message,
            owner,
            input,
          );
        }
      }
      throw error;
    }

    const assistantMessage = await MessageModel.create({
      messageId: crypto.randomUUID(),
      conversationId,
      ownerUserId: owner.id,
      organizationId: owner.organizationId ?? null,
      role: "assistant",
      status: "pending",
      sequence: assistantSequence,
      content: "Processing request.",
    });

    return this.processAssistant(
      conversation,
      userMessage as unknown as Message,
      assistantMessage.messageId,
      owner,
      input,
    );
  }

  private async resumeOrReturnExisting(
    conversation: InstanceType<typeof ConversationModel>,
    userMessage: Message,
    owner: ConversationOwner,
    input: SendConversationMessageInput,
  ) {
    let assistant = await MessageModel.findOne({
      conversationId: userMessage.conversationId,
      ownerUserId: owner.id,
      organizationId: owner.organizationId ?? null,
      sequence: userMessage.sequence + 1,
      role: "assistant",
    });
    if (!assistant) {
      assistant = await MessageModel.create({
        messageId: crypto.randomUUID(),
        conversationId: userMessage.conversationId,
        ownerUserId: owner.id,
        organizationId: owner.organizationId ?? null,
        role: "assistant",
        status: "pending",
        sequence: userMessage.sequence + 1,
        content: "Processing request.",
      });
    }
    if (assistant.status === "completed" || assistant.status === "pending") {
      return { userMessage, assistantMessage: assistant };
    }
    assistant.status = "pending";
    assistant.content = "Processing request.";
    assistant.error = undefined;
    await assistant.save();
    return this.processAssistant(
      conversation,
      userMessage,
      assistant.messageId,
      owner,
      input,
    );
  }

  private async processAssistant(
    conversation: InstanceType<typeof ConversationModel>,
    userMessage: Message,
    assistantMessageId: string,
    owner: ConversationOwner,
    input: SendConversationMessageInput,
  ) {
    try {
      const recentMessages = await this.memory.loadRecentMessages(
        conversation.conversationId,
        owner.id,
        owner.organizationId,
      );
      const rewrite = await this.memory.resolve({
        summary: conversation.summary,
        activeLegalContext: conversation.activeLegalContext,
        recentMessages,
        currentMessage: input.content,
      });
      const result = await this.queryService.runQuery({
        query: rewrite.standaloneQuery,
        top_k: input.top_k,
        user_role: input.user_role ?? conversation.defaultUserRole,
      });
      const sourceSnapshot = this.snapshots.create(result.source_chunks);
      const assistant = await MessageModel.findOneAndUpdate(
        {
          messageId: assistantMessageId,
          conversationId: conversation.conversationId,
          ownerUserId: owner.id,
          organizationId: owner.organizationId ?? null,
        },
        {
          $set: {
            status: "completed",
            content: result.answer,
            originalQuery: input.content,
            retrievalQuery: rewrite.standaloneQuery,
            category: result.category,
            sourceSnapshot,
            diagnostics: {
              rewriteUsed: rewrite.isFollowUp,
              rewriteMethod: rewrite.isFollowUp ? "conversation" : "none",
              evidenceRelevanceScore: result.evidence_relevance_score,
              latencyMs: result.latency_ms,
              llmProvider: result.llm_provider_used,
              llmModel: result.llm_provider_used ? env.llmModel : null,
              corpusReleaseId: this.releaseId(sourceSnapshot),
            },
          },
          $unset: { error: 1 },
        },
        { returnDocument: "after", runValidators: true },
      );
      await this.memory.updateSummaryIfNeeded(
        conversation.conversationId,
        owner.id,
        owner.organizationId,
      );
      return { userMessage, assistantMessage: assistant };
    } catch (error) {
      console.error(
        `[ChatOrchestrator] Turn failed (${error instanceof Error ? error.name : "unknown"}).`,
      );
      const assistant = await MessageModel.findOneAndUpdate(
        {
          messageId: assistantMessageId,
          conversationId: conversation.conversationId,
          ownerUserId: owner.id,
          organizationId: owner.organizationId ?? null,
        },
        {
          $set: {
            status: "failed",
            content: "The answer could not be generated. Please retry.",
            error: {
              code: "CHAT_GENERATION_FAILED",
              safeMessage:
                "The answer could not be generated. Please retry.",
            },
          },
        },
        { returnDocument: "after" },
      );
      throw new HttpError(
        502,
        "The message was saved, but answer generation failed.",
        { assistant_message_id: assistant?.messageId },
        "CHAT_GENERATION_FAILED",
      );
    }
  }

  private releaseId(snapshots: SourceSnapshot[]): string | undefined {
    const releaseIds = new Set(
      snapshots
        .map((snapshot) => snapshot.corpusReleaseId)
        .filter((value): value is string => Boolean(value)),
    );
    return releaseIds.size === 1 ? [...releaseIds][0] : undefined;
  }
}
