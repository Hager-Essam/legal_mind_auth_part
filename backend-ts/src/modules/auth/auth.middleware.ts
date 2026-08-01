import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AuthService } from "./auth.service";
import type { UserRepository } from "./user.repository";
import type { UserRole } from "./user.types";
import { AUTH_ERROR_CODES, AuthError } from "./auth.errors";

const bearerToken = (request: Request): string | null => {
  const authorization = request.headers.authorization;
  if (!authorization) return null;
  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) return null;
  return token;
};

export const authenticate = (
  authService: AuthService,
  users: UserRepository,
): RequestHandler => {
  return async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = bearerToken(request);
      if (!token) {
        throw new AuthError(
          401,
          AUTH_ERROR_CODES.required,
          "Authentication is required.",
        );
      }
      const payload = authService.verifyAccessToken(token);
      const user = await users.findById(payload.sub);
      if (!user) {
        throw new AuthError(
          401,
          AUTH_ERROR_CODES.invalidToken,
          "The access token is invalid.",
        );
      }
      if (!user.isActive) {
        throw new AuthError(
          403,
          AUTH_ERROR_CODES.accountDisabled,
          "This account is disabled.",
        );
      }
      if (!user.isEmailVerified) {
        throw new AuthError(
          403,
          AUTH_ERROR_CODES.emailNotVerified,
          "Verify your email before continuing.",
        );
      }
      request.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        organizationId: user.organizationId ?? null,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (request, _response, next): void => {
    if (!request.user) {
      next(
        new AuthError(
          401,
          AUTH_ERROR_CODES.required,
          "Authentication is required.",
        ),
      );
      return;
    }
    if (!roles.includes(request.user.role)) {
      next(
        new AuthError(
          403,
          AUTH_ERROR_CODES.insufficientRole,
          "This account does not have permission to perform that action.",
        ),
      );
      return;
    }
    next();
  };
};

export const optionalAuth = (
  authService: AuthService,
  users: UserRepository,
): RequestHandler => {
  return async (request, _response, next): Promise<void> => {
    const token = bearerToken(request);
    if (!token) {
      next();
      return;
    }
    try {
      const payload = authService.verifyAccessToken(token);
      const user = await users.findById(payload.sub);
      if (user?.isActive && user.isEmailVerified) {
        request.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          isActive: true,
          isEmailVerified: true,
          organizationId: user.organizationId ?? null,
        };
      }
    } catch {
      // Optional authentication deliberately treats invalid credentials as absent.
    }
    next();
  };
};

