import { appConnection } from "../../services/mongo.service";
import { messageSchema } from "./message.schema";
import type { Message } from "./conversation.types";

export const MessageModel = appConnection.model<Message>(
  "Message",
  messageSchema,
);

