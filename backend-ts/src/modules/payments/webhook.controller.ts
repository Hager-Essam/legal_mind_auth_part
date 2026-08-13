import Stripe from "stripe";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http/http-error";
import type { PaymentService } from "./payment.service";

let stripeInstance: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!stripeInstance) {
    if (!env.stripeSecretKey) {
      throw new HttpError(500, "Stripe secret key is not configured.", undefined, "STRIPE_NOT_CONFIGURED");
    }
    stripeInstance = new Stripe(env.stripeSecretKey);
  }
  return stripeInstance;
};

export const createWebhookController = (payments: PaymentService) => ({
  handleWebhook: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sig = request.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") {
        throw new HttpError(400, "Missing stripe-signature header.", undefined, "MISSING_SIGNATURE");
      }

      if (!env.stripeWebhookSecret) {
        throw new HttpError(500, "Stripe webhook secret is not configured.", undefined, "WEBHOOK_SECRET_MISSING");
      }

      const stripe = getStripe();
      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(request.body, sig, env.stripeWebhookSecret);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown verification error";
        throw new HttpError(400, `Webhook signature verification failed: ${message}`, undefined, "INVALID_SIGNATURE");
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await payments.handleCheckoutCompleted(session);
          break;
        }
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await payments.handlePaymentIntentSucceeded(paymentIntent);
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await payments.handlePaymentIntentFailed(paymentIntent);
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          await payments.handleChargeRefunded(charge);
          break;
        }
        default:
          break;
      }

      response.json({ received: true });
    } catch (error) {
      next(error);
    }
  },
});
