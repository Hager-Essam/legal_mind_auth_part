import { z } from "zod";
import { normalizeEmail } from "../users/user.schema";

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(128, "Password must contain at most 128 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .transform((value) => normalizeEmail(value));

const optionalTrimmedString = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().min(1).max(maximum).optional(),
  );

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must contain at least 2 characters.")
      .max(100, "Full name must contain at most 100 characters."),
    email: emailSchema,
    password: passwordSchema,
    officeName: z
      .string()
      .trim()
      .min(1, "Office name is required.")
      .max(200, "Office name must contain at most 200 characters."),
    teamSize: z.enum(["solo", "small", "medium", "large"], {
      error: "Select a valid team size.",
    }),
    phone: optionalTrimmedString(30),
    barAssociationNumber: optionalTrimmedString(100),
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

