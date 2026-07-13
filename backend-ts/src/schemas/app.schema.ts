import { z } from "zod";

export const appInfoSchema = z.object({
  name: z.string(),
  environment: z.enum(["development", "test", "staging", "production"]),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
});

export type AppInfo = z.infer<typeof appInfoSchema>;
