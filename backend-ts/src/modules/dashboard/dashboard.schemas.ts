import { z } from "zod";

export const activityQuerySchema = z
  .object({
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;
