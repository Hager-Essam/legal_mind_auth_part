import { z } from "zod";
import { TEAM_SIZES } from "../auth/users/user.types";

const optionalClearableString = (maximum: number) => z.string().trim().max(maximum).optional();

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    officeName: z.string().trim().min(1).max(200).optional(),
    phone: optionalClearableString(30),
    barAssociationNumber: optionalClearableString(100),
    teamSize: z.enum(TEAM_SIZES).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be supplied.",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
