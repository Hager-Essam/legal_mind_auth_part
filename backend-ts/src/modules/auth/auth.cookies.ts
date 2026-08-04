import type { CookieOptions, Response } from "express";
import { env } from "../../config/env";

export const REFRESH_COOKIE_NAME = "legalmind_refresh_token";

export const refreshCookieOptions = (): CookieOptions => {
  const crossSite = env.refreshCookieSameSite === "none";

  return {
    httpOnly: true,
    secure: env.nodeEnv === "production" || crossSite,
    sameSite: env.refreshCookieSameSite,
    path: "/api/v1/auth",
    maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000,
  };
};

export const setRefreshCookie = (response: Response, refreshToken: string): void => {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
};

export const clearRefreshCookie = (response: Response): void => {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  response.clearCookie(REFRESH_COOKIE_NAME, options);
};
