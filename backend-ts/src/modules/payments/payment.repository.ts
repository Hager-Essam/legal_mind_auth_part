import { Types } from "mongoose";
import { PaymentModel } from "./payment.model";
import type { PaymentStatus } from "./payment.types";

type PaymentListRow = {
  _id: Types.ObjectId;
  userId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  planId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export class PaymentRepository {
  async findBySessionId(sessionId: string) {
    return PaymentModel.findOne({ stripeSessionId: sessionId });
  }

  async findByPaymentIntentId(paymentIntentId: string) {
    return PaymentModel.findOne({ stripePaymentIntentId: paymentIntentId });
  }

  async create(data: {
    userId: string;
    stripeSessionId: string;
    stripePaymentIntentId?: string;
    planId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    description: string;
    metadata?: Record<string, string>;
  }) {
    return PaymentModel.create(data);
  }

  async updateBySessionId(
    sessionId: string,
    update: Partial<{
      status: PaymentStatus;
      stripePaymentIntentId: string;
      metadata: Record<string, unknown>;
    }>
  ) {
    return PaymentModel.findOneAndUpdate(
      { stripeSessionId: sessionId },
      { $set: update },
      { new: true }
    );
  }

  async updateByPaymentIntentId(
    paymentIntentId: string,
    update: Partial<{
      status: PaymentStatus;
      metadata: Record<string, unknown>;
    }>
  ) {
    return PaymentModel.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      { $set: update },
      { new: true }
    );
  }

  async existsBySessionId(sessionId: string): Promise<boolean> {
    return (await PaymentModel.exists({ stripeSessionId: sessionId })) !== null;
  }

  async listByUser(userId: string, page: number, limit: number, status?: PaymentStatus) {
    const skip = (page - 1) * limit;
    const matchFilter: Record<string, unknown> = { userId };
    if (status) matchFilter.status = status;

    const [result] = await PaymentModel.aggregate<{
      items: PaymentListRow[];
      totals: Array<{ value: number }>;
    }>([
      { $match: matchFilter },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          totals: [{ $count: "value" }],
        },
      },
    ]);

    return {
      items: result?.items ?? [],
      total: result?.totals[0]?.value ?? 0,
    };
  }

  async getTotalRevenue(): Promise<number> {
    const [result] = await PaymentModel.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return result?.total ?? 0;
  }

  async countByStatus(): Promise<Record<PaymentStatus, number>> {
    const results = await PaymentModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r._id] = r.count;
    }
    return counts as Record<PaymentStatus, number>;
  }
}
