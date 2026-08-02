import { z } from "zod";

export const createConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const listConversationsSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["active", "archived"]).default("active"),
  })
  .strict();

export const listMessagesSchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(2_000),
    idempotency_key: z.string().uuid(),
    top_k: z.number().int().min(1).max(50).default(5),
  })
  .strict();

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.status !== undefined, {
    message: "At least one conversation field must be supplied.",
  });
