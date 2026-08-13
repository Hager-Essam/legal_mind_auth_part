import { z } from "zod";

export const createCheckoutSessionSchema = z
  .object({
    planId: z.string().min(1, "planId is required"),
    amount: z.number().int().positive("Amount must be a positive integer (in smallest currency unit)"),
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .default("usd"),
    description: z.string().min(1).max(500),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const paymentListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z
      .enum(["pending", "succeeded", "failed", "canceled", "refunded"])
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .strict();
