import type { Document } from "mongoose";

export const USER_ROLES = [
  "user",
  "pending_lawyer",
  "lawyer",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const TEAM_SIZES = ["solo", "small", "medium", "large"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export type User = {
  email: string;
  password: string;
  fullName: string;
  officeName?: string;
  teamSize?: TeamSize;
  phone?: string;
  role: UserRole;
  barAssociationNumber?: string;
  lawyerIdDocument?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  organizationId: string | null;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserMethods = {
  comparePassword(candidatePassword: string): Promise<boolean>;
  createPasswordResetToken(): string;
  createEmailVerificationToken(): string;
};

export interface UserDocument extends Document, User, UserMethods {}

export type CreateUserInput = Pick<User, "email" | "password" | "fullName"> &
  Partial<
    Pick<
      User,
      | "officeName"
      | "teamSize"
      | "phone"
      | "barAssociationNumber"
      | "lawyerIdDocument"
      | "organizationId"
      | "role"
      | "isActive"
      | "isEmailVerified"
    >
  >;
