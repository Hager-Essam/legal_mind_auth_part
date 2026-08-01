import { z } from "zod";
import { ConversationModel } from "./conversation.model";
import { MessageModel } from "./message.model";
import type {
  ActiveLegalContext,
  Message,
} from "./conversation.types";

export const conversationRewriteResultSchema = z.object({
  isFollowUp: z.boolean(),
  standaloneQuery: z.string().min(1),
  referencedAuthorities: z.array(z.string()),
  referencedFacts: z.array(z.string()),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().optional(),
});

export type ConversationRewriteResult = z.infer<
  typeof conversationRewriteResultSchema
>;

const followUpPattern =
  /^(?:و?ماذا عن|و?ما (?:هو|هي|عن)|و?هل|طيب|ومدة|ومتى|وكيف|why|what about|and what|does that)(?:\s|[؟?،,:]|$)/i;

export class ConversationMemoryService {
  async resolve(input: {
    summary: string;
    activeLegalContext: ActiveLegalContext;
    recentMessages: Message[];
    currentMessage: string;
  }): Promise<ConversationRewriteResult> {
    try {
      const current = input.currentMessage.trim();
      const previousUserMessage = [...input.recentMessages]
        .reverse()
        .find(
          (message) =>
            message.role === "user" &&
            message.status === "completed" &&
            message.content.trim() !== current,
        );
      const isFollowUp =
        Boolean(previousUserMessage) &&
        (followUpPattern.test(current) ||
          (current.length < 100 &&
            /(?:ذلك|هذا|هذه|تلك|المذكور|السابق|it|that|this)/i.test(current)));

      return conversationRewriteResultSchema.parse({
        isFollowUp,
        standaloneQuery:
          isFollowUp && previousUserMessage
            ? `${previousUserMessage.content.trim()} ${current}`
            : current,
        referencedAuthorities: [
          ...input.activeLegalContext.authorityIds,
        ],
        referencedFacts: [...input.activeLegalContext.facts],
        needsClarification: false,
      });
    } catch {
      return {
        isFollowUp: false,
        standaloneQuery: input.currentMessage,
        referencedAuthorities: [],
        referencedFacts: [],
        needsClarification: false,
      };
    }
  }

  async loadRecentMessages(
    conversationId: string,
    ownerUserId: string,
    organizationId: string | null,
    limit = 12,
  ): Promise<Message[]> {
    const messages = await MessageModel.find({
      conversationId,
      ownerUserId,
      organizationId,
    })
      .sort({ sequence: -1 })
      .limit(limit)
      .lean();
    return messages.reverse() as Message[];
  }

  async updateSummaryIfNeeded(
    conversationId: string,
    ownerUserId: string,
    organizationId: string | null,
  ): Promise<void> {
    const conversation = await ConversationModel.findOne({
      conversationId,
      ownerUserId,
      organizationId,
      status: { $ne: "deleted" },
    });
    if (!conversation) return;

    const recent = await this.loadRecentMessages(
      conversationId,
      ownerUserId,
      organizationId,
      12,
    );
    const characterCount = recent.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    const shouldUpdate =
      conversation.messageCount > 0 &&
      (conversation.messageCount % 12 === 0 || characterCount > 8_000);
    if (!shouldUpdate) return;

    const userObjectives = recent
      .filter(
        (message) =>
          message.role === "user" && message.status === "completed",
      )
      .map((message) => message.content.trim())
      .filter(Boolean)
      .slice(-6);
    const unresolved = conversation.activeLegalContext.unresolvedQuestions;
    const summaryParts = [
      userObjectives.length
        ? `User objectives/questions: ${userObjectives.join(" | ")}`
        : "",
      conversation.activeLegalContext.facts.length
        ? `User-provided facts: ${conversation.activeLegalContext.facts.join(" | ")}`
        : "",
      unresolved.length
        ? `Unresolved questions: ${unresolved.join(" | ")}`
        : "",
      conversation.activeLegalContext.assumptions.length
        ? `Assumptions/uncertainties: ${conversation.activeLegalContext.assumptions.join(" | ")}`
        : "",
    ].filter(Boolean);

    conversation.summary = summaryParts.join("\n");
    conversation.summaryVersion += 1;
    await conversation.save();
  }
}
