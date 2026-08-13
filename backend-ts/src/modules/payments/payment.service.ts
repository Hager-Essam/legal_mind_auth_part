import Stripe from "stripe";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http/http-error";
import type { PaymentRepository } from "./payment.repository";
import type { CreateCheckoutSessionInput, CheckoutSessionResult } from "./payment.types";

let stripeInstance: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!stripeInstance) {
    if (!env.stripeSecretKey) {
      throw new HttpError(
        500,
        "Stripe secret key is not configured.",
        undefined,
        "STRIPE_NOT_CONFIGURED"
      );
    }
    stripeInstance = new Stripe(env.stripeSecretKey);
  }
  return stripeInstance;
};

export class PaymentService {
  constructor(private readonly payments: PaymentRepository) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = getStripe();

    const frontendUrl = env.frontendUrl;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: input.currency,
            product_data: {
              name: input.description,
              metadata: {
                planId: input.planId,
                userId: input.userId,
              },
            },
            unit_amount: input.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: input.email,
      metadata: {
        userId: input.userId,
        planId: input.planId,
        ...input.metadata,
      },
    });

    await this.payments.create({
      userId: input.userId,
      stripeSessionId: session.id,
      planId: input.planId,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
      description: input.description,
      metadata: input.metadata,
    });

    if (!session.url) {
      throw new HttpError(
        500,
        "Failed to create checkout session URL.",
        undefined,
        "CHECKOUT_SESSION_URL_FAILED"
      );
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const payment = await this.payments.findBySessionId(session.id);

    if (!payment) {
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : undefined;

    await this.payments.updateBySessionId(session.id, {
      status: "succeeded",
      stripePaymentIntentId: paymentIntentId,
      metadata: {
        ...payment.metadata,
        ...(session.metadata as Record<string, string>),
        stripeCustomerId: session.customer as string,
      },
    });
  }

  async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await this.payments.updateByPaymentIntentId(paymentIntent.id, {
      status: "succeeded",
    });
  }

  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    await this.payments.updateByPaymentIntentId(paymentIntent.id, {
      status: "failed",
    });
  }

  async handleChargeRefunded(charge: Stripe.Charge) {
    if (typeof charge.payment_intent === "string") {
      await this.payments.updateByPaymentIntentId(charge.payment_intent, {
        status: "refunded",
      });
    }
  }

  async getPaymentHistory(userId: string, page: number, limit: number, status?: string) {
    const result = await this.payments.listByUser(userId, page, limit, status as any);

    return {
      payments: result.items.map((item) => ({
        id: String(item._id),
        plan_id: item.planId,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        description: item.description,
        stripe_session_id: item.stripeSessionId,
        created_at: item.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit),
      },
    };
  }

  async getSessionStatus(sessionId: string) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const payment = await this.payments.findBySessionId(sessionId);

    return {
      session_id: session.id,
      status: session.payment_status,
      amount: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      db_status: payment?.status ?? "unknown",
    };
  }
}
