import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "./auth.service";
import { toPublicUser } from "./auth.mapper";
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "./auth.cookies";
import { AUTH_ERROR_CODES, AuthError } from "./auth.errors";
import type { UserRepository } from "./users/user.repository";
import { tryAsyncResult } from "../../shared/result";

const tokenFromRequest = (request: Request): string | undefined =>
  request.cookies?.[REFRESH_COOKIE_NAME] ?? request.body?.refreshToken;

export const createAuthController = (authService: AuthService, users: UserRepository) => ({
  register: async (request: Request, response: Response, next: NextFunction) => {
    const result = await tryAsyncResult(() => authService.register(request.body));

    if (!result.ok) {
      next(result.error);
      return;
    }
    const user = result.value;
    response.status(201).json({
      message: "تم التسجيل بنجاح. يرجى التحقق من بريدك الإلكتروني قبل تسجيل الدخول.",
      user: toPublicUser(user),
    });
  },

  login: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await authService.login(request.body.email, request.body.password, request.ip);
      setRefreshCookie(response, result.refreshToken);
      response.json({
        access_token: result.accessToken,
        user: toPublicUser(result.user),
      });
    } catch (error) {
      next(error);
    }
  },

  refreshToken: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = tokenFromRequest(request);

      if (!token) {
        throw new AuthError(401, AUTH_ERROR_CODES.refreshTokenInvalid, "يجب عليك تقديم رمز تحديث.");
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

  logoutAll: async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.user) {
        throw new AuthError(401, AUTH_ERROR_CODES.required, "يجب عليك تسجيل الدخول لتسجيل الخروج.");
      }
      await authService.logoutAll(request.user.id, request.ip);
      clearRefreshCookie(response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  forgotPassword: async (request: Request, response: Response, next: NextFunction) => {
    try {
      await authService.forgotPassword(request.body.email);
      response.json({
        message: "إذا كان البريد الإلكتروني مسجل, سيتم إرسال رابط إعادة تعيين كلمة المرور.",
      });
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await authService.resetPassword(request.body.token, request.body.password, request.ip);
      setRefreshCookie(response, result.refreshToken);
      response.json({
        message: "تم إعادة تعيين كلمة المرور بنجاح.",
        access_token: result.accessToken,
        user: toPublicUser(result.user),
      });
    } catch (error) {
      next(error);
    }
  },

  verifyEmail: async (request: Request, response: Response, next: NextFunction) => {
    try {
      await authService.verifyEmail(request.body.token);
      response.json({ message: "تم التحقق من بريدك الإلكتروني بنجاح." });
    } catch (error) {
      next(error);
    }
  },

  resendVerification: async (request: Request, response: Response, next: NextFunction) => {
    try {
      await authService.resendVerification(request.body.email);
      response.json({
        message: "إذا كان الحساب موجود وغير متحقق, سيتم إرسال بريد إلكتروني للتحقق.",
      });
    } catch (error) {
      next(error);
    }
  },

  me: async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.user) {
        throw new AuthError(401, AUTH_ERROR_CODES.required, "Authentication is required.");
      }
      const user = await users.findById(request.user.id);

      if (!user) {
        throw new AuthError(401, AUTH_ERROR_CODES.invalidToken, "The authenticated user no longer exists.");
      }
      response.json({ user: toPublicUser(user) });
    } catch (error) {
      next(error);
    }
  },
});
