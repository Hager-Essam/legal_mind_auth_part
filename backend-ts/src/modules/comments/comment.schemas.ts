import { z } from "zod";

export const commentBodySchema = z.object({ content: z.string().trim().min(1).max(1000) }).strict();

export const listCommentsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
