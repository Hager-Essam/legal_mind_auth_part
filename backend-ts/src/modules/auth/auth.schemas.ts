import { z } from "zod";
import { normalizeEmail } from "./users/user.schema";

const passwordSchema = z
  .string()
  .min(8, "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.")
  .max(128, "يجب أن تحتوي كلمة المرور على 128 حرف على الأكثر.")
  .regex(/[a-z]/, "يجب أن تحتوي كلمة المرور على حرف صغير على الأقل.")
  .regex(/[A-Z]/, "يجب أن تحتوي كلمة المرور على حرف كبير على الأقل.")
  .regex(/[0-9]/, "يجب أن تحتوي كلمة المرور على رقم على الأقل.");

const emailSchema = z
  .string()
  .trim()
  .email("يجب عليك إدخال بريد إلكتروني صالح.")
  .transform((value) => normalizeEmail(value));

const optionalTrimmedString = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(maximum).optional()
  );

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "يجب أن تحتوي الاسم الكامل على 2 أحرف على الأقل.")
      .max(100, "يجب أن تحتوي الاسم الكامل على 100 حرف على الأكثر."),
    email: emailSchema,
    password: passwordSchema,
    officeName: z
      .string()
      .trim()
      .min(1, "يجب عليك تقديم اسم المكتب.")
      .max(200, "يجب أن تحتوي اسم المكتب على 200 حرف على الأكثر."),
    teamSize: z.enum(["solo", "small", "medium", "large"], {
      error: "يجب عليك تحديد حجم الفريق الصالح.",
    }),
    phone: optionalTrimmedString(30),
    barAssociationNumber: optionalTrimmedString(100),
  })
  .strict();

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(32).optional() }).strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z.object({ token: z.string().min(32), password: passwordSchema }).strict();

export const verifyEmailSchema = z.object({ token: z.string().min(32) }).strict();

export const resendVerificationSchema = z.object({ email: emailSchema }).strict();
