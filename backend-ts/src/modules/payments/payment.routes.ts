import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import type { AuthService } from "../auth/auth.service";
import { authenticate } from "../auth/auth.middleware";
import type { UserRepository } from "../auth/users/user.repository";
import type { PaymentService } from "./payment.service";
import { createPaymentController } from "./payment.controller";
import { createWebhookController } from "./webhook.controller";

export type PaymentRouteDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  paymentService: PaymentService;
};

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export const createPaymentRouter = (services: PaymentRouteDependencies) => {
  const router = Router();
  const payments = createPaymentController(services.paymentService);
  const required = authenticate(services.authService, services.userRepository);

  router.post("/checkout", required, checkoutLimiter, payments.createCheckout);
  router.get("/checkout/status", required, payments.sessionStatus);
  router.get("/history", required, payments.history);

  return router;
};

export const createWebhookRouter = (services: PaymentRouteDependencies) => {
  const router = Router();
  const webhook = createWebhookController(services.paymentService);

  router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    webhook.handleWebhook
  );

  return router;
};
