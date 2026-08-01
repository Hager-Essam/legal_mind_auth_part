export type EndpointContract = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  authentication: "public" | "refresh-token" | "bearer";
  expectedStatuses: readonly number[];
  probeStatus: number;
  frontendBlocking: boolean;
};

export const endpointContracts = [
  { method: "GET", path: "/", authentication: "public", expectedStatuses: [200], probeStatus: 200, frontendBlocking: false },
  { method: "GET", path: "/health", authentication: "public", expectedStatuses: [200, 503], probeStatus: 200, frontendBlocking: true },
  { method: "GET", path: "/ready", authentication: "public", expectedStatuses: [200, 503], probeStatus: 200, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/register", authentication: "public", expectedStatuses: [201, 400, 409, 429, 503], probeStatus: 400, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/verify-email", authentication: "public", expectedStatuses: [200, 400], probeStatus: 400, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/resend-verification", authentication: "public", expectedStatuses: [200, 400, 429, 503], probeStatus: 400, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/login", authentication: "public", expectedStatuses: [200, 400, 401, 403, 429], probeStatus: 400, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/refresh-token", authentication: "refresh-token", expectedStatuses: [200, 400, 401, 429], probeStatus: 401, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/logout", authentication: "refresh-token", expectedStatuses: [204, 400, 401], probeStatus: 204, frontendBlocking: true },
  { method: "POST", path: "/api/v1/auth/logout-all", authentication: "bearer", expectedStatuses: [204, 401], probeStatus: 401, frontendBlocking: false },
  { method: "POST", path: "/api/v1/auth/forgot-password", authentication: "public", expectedStatuses: [200, 400, 429, 503], probeStatus: 400, frontendBlocking: false },
  { method: "POST", path: "/api/v1/auth/reset-password", authentication: "public", expectedStatuses: [200, 400, 401], probeStatus: 400, frontendBlocking: false },
  { method: "GET", path: "/api/v1/auth/me", authentication: "bearer", expectedStatuses: [200, 401], probeStatus: 401, frontendBlocking: false },
  { method: "POST", path: "/api/v1/query", authentication: "bearer", expectedStatuses: [200, 400, 401, 429, 500, 502, 503], probeStatus: 401, frontendBlocking: true },
  { method: "GET", path: "/api/v1/conversations", authentication: "bearer", expectedStatuses: [200, 400, 401], probeStatus: 401, frontendBlocking: true },
  { method: "POST", path: "/api/v1/conversations", authentication: "bearer", expectedStatuses: [201, 400, 401], probeStatus: 401, frontendBlocking: true },
  { method: "GET", path: "/api/v1/conversations/contract-id", authentication: "bearer", expectedStatuses: [200, 401, 404], probeStatus: 401, frontendBlocking: true },
  { method: "GET", path: "/api/v1/conversations/contract-id/messages", authentication: "bearer", expectedStatuses: [200, 400, 401, 404], probeStatus: 401, frontendBlocking: true },
  { method: "POST", path: "/api/v1/conversations/contract-id/messages", authentication: "bearer", expectedStatuses: [201, 400, 401, 404, 409, 429, 502], probeStatus: 401, frontendBlocking: true },
  { method: "PATCH", path: "/api/v1/conversations/contract-id", authentication: "bearer", expectedStatuses: [200, 400, 401, 404], probeStatus: 401, frontendBlocking: true },
  { method: "DELETE", path: "/api/v1/conversations/contract-id", authentication: "bearer", expectedStatuses: [204, 401, 404], probeStatus: 401, frontendBlocking: true }
] as const satisfies readonly EndpointContract[];

const excludedKeys = new Set([
  "request_id",
  "id",
  "conversation_id",
  "message_id",
  "next_cursor",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
  "last_message_at",
  "retrievedAt",
  "reviewedAt",
  "latency_ms",
  "latencyMs",
  "access_token",
  "refreshToken",
  "llm_provider_used",
  "llmProvider",
  "llmModel",
  "answer"
]);

export const normalizeContractPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeContractPayload);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !excludedKeys.has(key))
      .map(([key, entry]) => [key, normalizeContractPayload(entry)]),
  );
};
