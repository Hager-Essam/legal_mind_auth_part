import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Schema } from "mongoose";
import { TEAM_SIZES, USER_ROLES, type UserDocument } from "./user.types";

const BCRYPT_COST = 10;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const sha256 = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

export const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    officeName: { type: String, trim: true, maxlength: 200 },
    teamSize: { type: String, enum: TEAM_SIZES },
    phone: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    avatarObjectKey: { type: String, trim: true, select: false },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "pending_lawyer",
      required: true,
    },
    barAssociationNumber: { type: String, trim: true },
    lawyerIdDocument: { type: String, trim: true, select: false },
    isActive: { type: Boolean, default: true, required: true },
    isEmailVerified: { type: Boolean, default: false, required: true },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    organizationId: { type: String, default: null },
    lastLoginAt: { type: Date },
  },
  {
    collection: "users",
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ email: 1 }, { unique: true, name: "users_email_unique" });
userSchema.index({ role: 1, isActive: 1 }, { name: "users_role_active" });
userSchema.index({ organizationId: 1, isActive: 1 }, { name: "users_organization_active" });

userSchema.pre("validate", function () {
  if (this.email) this.email = normalizeEmail(this.email);
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function (): string {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetTokenHash = sha256(token);
  this.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  return token;
};

userSchema.methods.createEmailVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationTokenHash = sha256(token);
  this.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  return token;
};
