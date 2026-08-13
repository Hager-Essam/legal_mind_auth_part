import { Schema } from "mongoose";
import { PAYMENT_STATUSES, type PaymentRecord } from "./payment.types";

export const paymentRecordSchema = new Schema<PaymentRecord>(
  {
    userId: { type: String, required: true, immutable: true },
    stripeSessionId: { type: String, required: true, immutable: true },
    stripePaymentIntentId: { type: String, required: false },
    planId: { type: String, required: true, immutable: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: [...PAYMENT_STATUSES],
      default: "pending",
    },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "payments",
    timestamps: true,
    versionKey: false,
  }
);

paymentRecordSchema.index({ stripeSessionId: 1 }, { unique: true, name: "payments_session_unique" });
paymentRecordSchema.index({ userId: 1, createdAt: -1 }, { name: "payments_user_recent" });
paymentRecordSchema.index({ stripePaymentIntentId: 1 }, { sparse: true, name: "payments_intent" });
paymentRecordSchema.index({ planId: 1 }, { name: "payments_plan" });
