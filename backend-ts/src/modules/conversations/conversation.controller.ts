import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../errors/http-error";
import type { AppServices } from "../../services/service-container";
import type {
  Conversation,
  Message,
} from "./conversation.types";
import {
  createConversationSchema,
  listConversationsSchema,
  listMessagesSchema,
  sendMessageSchema,
  updateConversationSchema,
} from "./conversation.schemas";

const ownerFromRequest = (request: Request) => {
  if (!request.user) {
    throw new HttpError(
      401,
      "Authentication is required.",
      undefined,
      "AUTH_REQUIRED",
    );
  }
  return {
    id: request.user.id,
    organizationId: request.user.organizationId ?? null,
  };
};

const conversationResponse = (conversation: Conversation) => ({
  conversation_id: conversation.conversationId,
  title: conversation.title,
  status: conversation.status,
  jurisdiction: conversation.jurisdiction,
  default_user_role: conversation.defaultUserRole,
  summary: conversation.summary,
  summary_version: conversation.summaryVersion,
  active_legal_context: conversation.activeLegalContext,
  message_count: conversation.messageCount,
  last_message_at: conversation.lastMessageAt,
  created_at: conversation.createdAt,
  updated_at: conversation.updatedAt,
});

const messageResponse = (message: Message) => ({
  message_id: message.messageId,
  conversation_id: message.conversationId,
  role: message.role,
  status: message.status,
  sequence: message.sequence,
  content: message.content,
  original_query: message.originalQuery,
  retrieval_query: message.retrievalQuery,
  category: message.category,
  source_snapshot: message.sourceSnapshot,
  diagnostics: message.diagnostics,
  idempotency_key: message.idempotencyKey,
  error: message.error,
  created_at: message.createdAt,
  updated_at: message.updatedAt,
});

export const createConversationController = (services: AppServices) => ({
  create: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createConversationSchema.parse(request.body);
      const conversation = await services.conversationService.create(
        ownerFromRequest(request),
        input,
      );
      response
        .status(201)
        .json(conversationResponse(conversation as unknown as Conversation));
    } catch (error) {
      next(error);
    }
  },

  list: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = listConversationsSchema.parse(request.query);
      const result = await services.conversationService.list(
        ownerFromRequest(request),
        input,
      );
      response.json({
        conversations: result.items.map((item) =>
          conversationResponse(item as Conversation),
        ),
        next_cursor: result.nextCursor,
      });
    } catch (error) {
      next(error);
    }
  },

  get: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const conversation = await services.conversationService.get(
        String(request.params.conversationId),
        ownerFromRequest(request),
      );
      response.json(
        conversationResponse(conversation as unknown as Conversation),
      );
    } catch (error) {
      next(error);
    }
  },

  messages: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const input = listMessagesSchema.parse(request.query);
      const result = await services.conversationService.listMessages(
        String(request.params.conversationId),
        ownerFromRequest(request),
        input,
      );
      response.json({
        messages: result.items.map(messageResponse),
        next_cursor: result.nextCursor,
      });
    } catch (error) {
      next(error);
    }
  },

  sendMessage: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const input = sendMessageSchema.parse(request.body);
      const turn = await services.chatOrchestratorService.sendMessage(
        String(request.params.conversationId),
        ownerFromRequest(request),
        input,
      );
      response.status(201).json({
        user_message: messageResponse(turn.userMessage as Message),
        assistant_message: turn.assistantMessage
          ? messageResponse(turn.assistantMessage as unknown as Message)
          : null,
      });
    } catch (error) {
      next(error);
    }
  },

  update: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = updateConversationSchema.parse(request.body);
      const conversation = await services.conversationService.update(
        String(request.params.conversationId),
        ownerFromRequest(request),
        input,
      );
      response.json(
        conversationResponse(conversation as unknown as Conversation),
      );
    } catch (error) {
      next(error);
    }
  },

  remove: async (request: Request, response: Response, next: NextFunction) => {
    try {
      await services.conversationService.softDelete(
        String(request.params.conversationId),
        ownerFromRequest(request),
      );
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },
});

