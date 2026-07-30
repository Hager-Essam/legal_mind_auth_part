import { HttpError } from "../../errors/http-error";

export const AUTH_ERROR_CODES = {
  required: "AUTH_REQUIRED",
  invalidToken: "AUTH_INVALID_TOKEN",
  tokenExpired: "AUTH_TOKEN_EXPIRED",
  invalidCredentials: "AUTH_INVALID_CREDENTIALS",
  emailNotVerified: "AUTH_EMAIL_NOT_VERIFIED",
  accountDisabled: "AUTH_ACCOUNT_DISABLED",
  refreshTokenInvalid: "AUTH_REFRESH_TOKEN_INVALID",
  refreshTokenReused: "AUTH_REFRESH_TOKEN_REUSED",
  insufficientRole: "AUTH_INSUFFICIENT_ROLE",
  emailAlreadyExists: "AUTH_EMAIL_ALREADY_EXISTS",
  resetTokenInvalid: "AUTH_RESET_TOKEN_INVALID",
} as const;

export class AuthError extends HttpError {
  constructor(statusCode: number, code: string, message: string) {
    super(statusCode, message, undefined, code);
  }
}

