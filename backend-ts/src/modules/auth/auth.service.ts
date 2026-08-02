import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import type { RefreshTokenRepository } from "./refresh-tokens/refresh-token.repository";
import type { UserRepository } from "./users/user.repository";
import { USER_ROLES, type UserDocument } from "./users/user.types";
import { AUTH_ERROR_CODES, AuthError } from "./auth.errors";
import type { AccessTokenPayload, RegisterInput } from "./auth.types";

const accessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
});

export const hashRefreshToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const createOpaqueToken = (): string => crypto.randomBytes(40).toString("hex");

const expiresAtFromNow = (): Date => new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);

export type AuthEmailSender = {
  sendVerificationEmail(to: string, token: string, fullName: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string, fullName: string): Promise<void>;
  sendPasswordResetConfirmation(to: string, fullName: string): Promise<void>;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly email: AuthEmailSender
  ) {}

  generateAccessToken(user: UserDocument): string {
    const payload: AccessTokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, env.jwtSecret, {
      algorithm: "HS256",
      issuer: "legalmind-api",
      audience: "legalmind-web",
      expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.jwtSecret, {
        algorithms: ["HS256"],
        issuer: "legalmind-api",
        audience: "legalmind-web",
      });

      return accessTokenPayloadSchema.parse(decoded);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError(401, AUTH_ERROR_CODES.tokenExpired, "The access token has expired.");
      }

      throw new AuthError(401, AUTH_ERROR_CODES.invalidToken, "The access token is invalid.");
    }
  }

  async register(input: RegisterInput): Promise<UserDocument> {
    if (await this.users.findByEmailWithoutPassword(input.email)) {
      throw new AuthError(
        409,
        AUTH_ERROR_CODES.emailAlreadyExists,
        "An account with this email already exists."
      );
    }

    let user: UserDocument;

    try {
      user = await this.users.create({
        ...input,
        role: "lawyer",
        organizationId: null,
        isActive: true,
        isEmailVerified: false,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new AuthError(
          409,
          AUTH_ERROR_CODES.emailAlreadyExists,
          "An account with this email already exists."
        );
      }

      throw error;
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await this.email.sendVerificationEmail(user.email, verificationToken, user.fullName);
    } catch {
      await this.users.deleteById(user._id);

      throw new AuthError(
        503,
        "AUTH_EMAIL_DELIVERY_FAILED",
        "Registration could not be completed. Please try again later."
      );
    }

    return user;
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string
  ): Promise<{
    user: UserDocument;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.users.findByEmailWithPassword(email);

    if (!user || !(await user.comparePassword(password))) {
      throw new AuthError(401, AUTH_ERROR_CODES.invalidCredentials, "Email or password is incorrect.");
    }
    this.assertUserMayLogin(user);
    await this.users.updateLastLogin(user._id);

    return this.createSession(user, ipAddress);
  }

  async refreshToken(
    rawToken: string,
    ipAddress?: string
  ): Promise<{
    user: UserDocument;
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = hashRefreshToken(rawToken);
    const storedToken = await this.refreshTokens.findActiveByTokenHash(tokenHash);

    if (!storedToken) {
      const consumed = await this.refreshTokens.findByTokenHash(tokenHash);

      if (consumed) {
        await this.refreshTokens.revokeAllUserTokens(consumed.userId, ipAddress);

        throw new AuthError(
          401,
          AUTH_ERROR_CODES.refreshTokenReused,
          "Refresh token reuse was detected. Sign in again."
        );
      }

      throw new AuthError(401, AUTH_ERROR_CODES.refreshTokenInvalid, "The refresh token is invalid.");
    }

    const user = await this.users.findById(storedToken.userId);

    if (!user) {
      await this.refreshTokens.revokeToken(tokenHash, ipAddress);

      throw new AuthError(401, AUTH_ERROR_CODES.refreshTokenInvalid, "The refresh token is invalid.");
    }
    this.assertUserMayLogin(user);

    const replacement = createOpaqueToken();
    const rotated = await this.refreshTokens.rotateToken(
      tokenHash,
      {
        tokenHash: hashRefreshToken(replacement),
        userId: user._id,
        expiresAt: expiresAtFromNow(),
        createdByIp: ipAddress,
      },
      ipAddress
    );

    if (!rotated) {
      await this.refreshTokens.revokeAllUserTokens(user._id, ipAddress);

      throw new AuthError(
        401,
        AUTH_ERROR_CODES.refreshTokenReused,
        "Refresh token reuse was detected. Sign in again."
      );
    }

    return {
      user,
      accessToken: this.generateAccessToken(user),
      refreshToken: replacement,
    };
  }

  async logout(rawToken: string, ipAddress?: string): Promise<void> {
    await this.refreshTokens.revokeToken(hashRefreshToken(rawToken), ipAddress);
  }

  async logoutAll(userId: string, ipAddress?: string): Promise<void> {
    await this.refreshTokens.revokeAllUserTokens(userId, ipAddress);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmailWithoutPassword(email);

    if (!user) return;
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      await this.email.sendPasswordResetEmail(user.email, resetToken, user.fullName);
    } catch {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error("[AuthService] Password reset email delivery failed.");
    }
  }

  async resetPassword(
    token: string,
    password: string,
    ipAddress?: string
  ): Promise<{
    user: UserDocument;
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await this.users.findByResetTokenHash(tokenHash);

    if (!user) {
      throw new AuthError(
        400,
        AUTH_ERROR_CODES.resetTokenInvalid,
        "The password reset token is invalid or expired."
      );
    }
    const updated = await this.users.updatePassword(user._id, password);

    if (!updated) {
      throw new AuthError(
        400,
        AUTH_ERROR_CODES.resetTokenInvalid,
        "The password reset token is invalid or expired."
      );
    }
    await this.refreshTokens.revokeAllUserTokens(updated._id, ipAddress);
    const session = await this.createSession(updated, ipAddress);

    try {
      await this.email.sendPasswordResetConfirmation(updated.email, updated.fullName);
    } catch {
      console.error("[AuthService] Password reset confirmation email failed.");
    }

    return session;
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await this.users.findByVerificationTokenHash(tokenHash);

    if (!user) {
      throw new AuthError(
        400,
        "AUTH_VERIFICATION_TOKEN_INVALID",
        "The email verification token is invalid or expired."
      );
    }
    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmailWithoutPassword(email);

    if (!user || user.isEmailVerified) return;
    const token = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await this.email.sendVerificationEmail(user.email, token, user.fullName);
    } catch {
      user.emailVerificationTokenHash = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      throw new AuthError(
        503,
        "AUTH_EMAIL_DELIVERY_FAILED",
        "The verification email could not be sent. Please try again later."
      );
    }
  }

  private async createSession(
    user: UserDocument,
    ipAddress?: string
  ): Promise<{
    user: UserDocument;
    accessToken: string;
    refreshToken: string;
  }> {
    const refreshToken = createOpaqueToken();
    await this.refreshTokens.create({
      tokenHash: hashRefreshToken(refreshToken),
      userId: user._id,
      expiresAt: expiresAtFromNow(),
      createdByIp: ipAddress,
    });

    return {
      user,
      accessToken: this.generateAccessToken(user),
      refreshToken,
    };
  }

  private assertUserMayLogin(user: UserDocument): void {
    if (!user.isActive) {
      throw new AuthError(403, AUTH_ERROR_CODES.accountDisabled, "This account is disabled.");
    }

    if (!user.isEmailVerified) {
      throw new AuthError(403, AUTH_ERROR_CODES.emailNotVerified, "Verify your email before signing in.");
    }
  }
}
