export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "canceled", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_INTENTS = ["contract_analysis", "consultation", "subscription"] as const;
export type PaymentIntent = (typeof PAYMENT_INTENTS)[number];

export type CreateCheckoutSessionInput = {
  userId: string;
  email: string;
  planId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
};

export type CheckoutSessionResult = {
  sessionId: string;
  url: string;
};

export type PaymentRecord = {
  userId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  planId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};
