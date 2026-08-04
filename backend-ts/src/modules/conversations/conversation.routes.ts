import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthService } from "../auth/auth.service";
import type { UserRepository } from "../auth/users/user.repository";
import { authenticate } from "../auth/auth.middleware";
import {
  createConversationController,
  type ConversationControllerDependencies,
} from "./conversation.controller";

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "CHAT_RATE_LIMITED",
    message: "Please wait before sending more messages.",
  },
});

export type ConversationDependencies = ConversationControllerDependencies & {
  authService: AuthService;
  userRepository: UserRepository;
};

export const createConversationRouter = (services: ConversationDependencies) => {
  const router = Router();
  const requireAuth = authenticate(services.authService, services.userRepository);
  const controller = createConversationController(services);
  router.use(requireAuth);
  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:conversationId", controller.get);
  router.get("/:conversationId/messages", controller.messages);
  router.post("/:conversationId/messages", messageLimiter, controller.sendMessage);
  router.patch("/:conversationId", controller.update);
  router.delete("/:conversationId", controller.remove);

  return router;
};
