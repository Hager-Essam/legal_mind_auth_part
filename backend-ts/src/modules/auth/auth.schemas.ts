import { z } from "zod";
import { normalizeEmail } from "../users/user.schema";

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => normalizeEmail(value));

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    officeName: z.string().trim().min(1).max(200),
    teamSize: z.enum(["solo", "small", "medium", "large"]),
    phone: z.string().trim().min(3).max(30).optional(),
    barAssociationNumber: z.string().trim().max(100).optional(),
  })
  .strict();

export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();

export const refreshSchema = z
  .object({ refreshToken: z.string().min(32).optional() })
  .strict();

export const forgotPasswordSchema = z
  .object({ email: emailSchema })
  .strict();

export const resetPasswordSchema = z
  .object({ token: z.string().min(32), password: passwordSchema })
  .strict();

export const verifyEmailSchema = z
  .object({ token: z.string().min(32) })
  .strict();

export const resendVerificationSchema = z
  .object({ email: emailSchema })
  .strict();

