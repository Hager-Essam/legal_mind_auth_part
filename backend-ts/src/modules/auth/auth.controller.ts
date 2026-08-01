import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "./auth.service";
import { toPublicUser } from "./auth.mapper";
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from "./auth.cookies";
import { AUTH_ERROR_CODES, AuthError } from "./auth.errors";
import { removeUploadedFile } from "../../middlewares/upload.middleware";
import type { UserRepository } from "../users/user.repository";
import { tryAsyncResult } from "../../core/result";

const tokenFromRequest = (request: Request): string | undefined =>
  request.cookies?.[REFRESH_COOKIE_NAME] ?? request.body?.refreshToken;

export const createAuthController = (
  authService: AuthService,
  users: UserRepository,
) => ({
  register: async (request: Request, response: Response, next: NextFunction) => {
    const result = await tryAsyncResult(async () => {
      if (!request.file) {
        throw new AuthError(
          400,
          "AUTH_LAWYER_ID_REQUIRED",
          "A lawyer ID document is required.",
        );
      }
      const lawyerIdDocument = path.relative(
        process.cwd(),
        request.file.path,
      );
      return authService.register({
        ...request.body,
        lawyerIdDocument,
      });
    });
    if (!result.ok) {
      await removeUploadedFile(request.file);
      next(result.error);
      return;
    }
    const user = result.value;
    response.status(201).json({
      message:
        "Registration succeeded. Verify your email before signing in.",
      user: toPublicUser(user),
    });
  },

  login: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await authService.login(
        request.body.email,
        request.body.password,
        request.ip,
      );
      setRefreshCookie(response, result.refreshToken);
      response.json({
        access_token: result.accessToken,
        user: toPublicUser(result.user),
      });
    } catch (error) {
      next(error);
    }
  },

  refreshToken: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const token = tokenFromRequest(request);
      if (!token) {
        throw new AuthError(
          401,
          AUTH_ERROR_CODES.refreshTokenInvalid,
          "A refresh token is required.",
        );
      }
      const result = await authService.refreshToken(token, request.ip);
      setRefreshCookie(response, result.refreshToken);
      response.json({
        access_token: result.accessToken,
        user: toPublicUser(result.user),
      });
    } catch (error) {
      clearRefreshCookie(response);
      next(error);
    }
  },

  logout: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = tokenFromRequest(request);
      if (token) await authService.logout(token, request.ip);
      clearRefreshCookie(response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  logoutAll: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      if (!request.user) {
        throw new AuthError(
          401,
          AUTH_ERROR_CODES.required,
          "Authentication is required.",
        );
      }
      await authService.logoutAll(request.user.id, request.ip);
      clearRefreshCookie(response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  forgotPassword: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      await authService.forgotPassword(request.body.email);
      response.json({
        message:
          "If the email is registered, a password reset link will be sent.",
      });
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await authService.resetPassword(
        request.body.token,
        request.body.password,
        request.ip,
      );
      setRefreshCookie(response, result.refreshToken);
      response.json({
        message: "Password reset succeeded.",
        access_token: result.accessToken,
        user: toPublicUser(result.user),
      });
    } catch (error) {
      next(error);
    }
  },

  verifyEmail: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      await authService.verifyEmail(request.body.token);
      response.json({ message: "Email verification succeeded." });
    } catch (error) {
      next(error);
    }
  },

  resendVerification: async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      await authService.resendVerification(request.body.email);
      response.json({
        message:
          "If the account exists and is unverified, a verification email will be sent.",
      });
    } catch (error) {
      next(error);
    }
  },

  me: async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.user) {
        throw new AuthError(
          401,
          AUTH_ERROR_CODES.required,
          "Authentication is required.",
        );
      }
      const user = await users.findById(request.user.id);
      if (!user) {
        throw new AuthError(
          401,
          AUTH_ERROR_CODES.invalidToken,
          "The authenticated user no longer exists.",
        );
      }
      response.json({ user: toPublicUser(user) });
    } catch (error) {
      next(error);
    }
  },
});
