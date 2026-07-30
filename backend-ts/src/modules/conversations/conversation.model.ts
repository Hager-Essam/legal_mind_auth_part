import { appConnection } from "../../services/mongo.service";
import { conversationSchema } from "./conversation.schema";
import type { Conversation } from "./conversation.types";

export const ConversationModel = appConnection.model<Conversation>(
  "Conversation",
  conversationSchema,
);

