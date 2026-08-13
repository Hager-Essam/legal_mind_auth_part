import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../shared/http/http-error";
import type { PaymentService } from "./payment.service";
import { createCheckoutSessionSchema, paymentListSchema } from "./payment.schemas";

const userId = (request: Request): string => {
  if (!request.user) {
    throw new HttpError(401, "يجب عليك تسجيل الدخول لتسجيل الدخول.", undefined, "AUTH_REQUIRED");
  }
  return request.user.id;
};

const userEmail = (request: Request): string => {
  if (!request.user) {
    throw new HttpError(401, "يجب عليك تسجيل الدخول لتسجيل الدخول.", undefined, "AUTH_REQUIRED");
  }
  return request.user.email;
};

export const createPaymentController = (payments: PaymentService) => ({
  createCheckout: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = createCheckoutSessionSchema.parse(request.body);
      const result = await payments.createCheckoutSession({
        userId: userId(request),
        email: userEmail(request),
        planId: input.planId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        metadata: input.metadata as Record<string, string> | undefined,
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  sessionStatus: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sessionId = String(request.query.session_id);
      if (!sessionId) {
        throw new HttpError(400, "session_id query parameter is required.", undefined, "MISSING_SESSION_ID");
      }
      const result = await payments.getSessionStatus(sessionId);
      response.json(result);
    } catch (error) {
      next(error);
    }
  },

  history: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = paymentListSchema.parse(request.query);
      const result = await payments.getPaymentHistory(userId(request), input.page, input.limit, input.status);
      response.json(result);
    } catch (error) {
      next(error);
    }
  },
});
