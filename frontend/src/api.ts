import type { PublicUser } from "./types";

const API_URL =
  import.meta.env.VITE_LEGALMIND_API_URL ??
  "http://localhost:3000/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<PublicUser> | null = null;
const verificationRequests = new Map<string, Promise<void>>();

type AuthResponse = {
  access_token: string;
  user: PublicUser;
};

type ApiErrorDetails = {
  fields?: Record<string, string[]>;
  issues?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorDetails,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    details?: ApiErrorDetails;
    request_id?: string;
  };
  if (!response.ok) {
    const issueMessage = payload.details?.issues
      ?.map((issue) => `${issue.field}: ${issue.message}`)
      .join(" • ");
    throw new ApiError(
      response.status,
      payload.error ?? "REQUEST_FAILED",
      issueMessage || payload.message || "تعذر إتمام الطلب.",
      payload.details,
      payload.request_id,
    );
  }
  return payload as T;
};

export const login = async (
  email: string,
  password: string,
): Promise<PublicUser> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseResponse<AuthResponse>(response);
  accessToken = payload.access_token;
  return payload.user;
};

export const register = async (form: FormData): Promise<void> => {
  await parseResponse(
    await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      credentials: "include",
      body: form,
    }),
  );
};

export const verifyEmail = (token: string): Promise<void> => {
  const existing = verificationRequests.get(token);
  if (existing) return existing;

  const request = fetch(`${API_URL}/auth/verify-email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    .then((response) => parseResponse<void>(response))
    .catch((error) => {
      // Strict Mode may mount twice in development. Cache HTTP outcomes, but
      // allow a genuine network failure to be retried.
      if (!(error instanceof ApiError)) verificationRequests.delete(token);
      throw error;
    });
  verificationRequests.set(token, request);
  return request;
};

export const resendVerification = async (email: string): Promise<void> => {
  await parseResponse(
    await fetch(`${API_URL}/auth/resend-verification`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
};

export const refreshAccessToken = (): Promise<PublicUser> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_URL}/auth/refresh-token`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
    .then(parseResponse<AuthResponse>)
    .then((payload) => {
      accessToken = payload.access_token;
      return payload.user;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

export const logout = async (): Promise<void> => {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } finally {
    accessToken = null;
    refreshPromise = null;
  }
};

export const apiFetch = async <T>(
  path: string,
  init: RequestInit = {},
  hasRetried = false,
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, init, true);
    } catch {
      accessToken = null;
    }
  }
  return parseResponse<T>(response);
};

