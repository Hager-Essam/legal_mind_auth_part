import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { tryAsyncResult } from "../core/result";
import {
  errorHandler,
  toErrorResult,
} from "../middlewares/error-handler";
import { requestIdMiddleware } from "../middlewares/request-id.middleware";
import { validateBody } from "../middlewares/validation.middleware";
import { registerSchema } from "../modules/auth/auth.schemas";

test("Result captures expected asynchronous failures without throwing", async () => {
  const result = await tryAsyncResult(async () => {
    throw new Error("expected failure");
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal((result.error as Error).message, "expected failure");
  }
});

test("unknown errors are normalized without exposing their message", () => {
  const result = toErrorResult(new Error("database password is secret"));
  assert.equal(result.error.status, 500);
  assert.equal(result.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(
    result.error.message.includes("database password is secret"),
    false,
  );
  assert.equal(result.error.log, true);
});

test("registration validation returns field errors and a request ID", async () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.post(
    "/register",
    validateBody(registerSchema),
    (_request, response) => response.status(204).send(),
  );
  app.use(errorHandler);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const running = app.listen(0, "127.0.0.1", () => resolve(running));
  });

  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "signup-test-request",
      },
      body: JSON.stringify({
        fullName: "Test Lawyer",
        email: "lawyer@example.com",
        password: "weak",
        officeName: "Office",
        teamSize: "solo",
        barAssociationNumber: "",
      }),
    });
    const payload = (await response.json()) as {
      success: boolean;
      error: string;
      message: string;
      details: {
        fields: Record<string, string[]>;
        issues: Array<{ field: string; message: string }>;
      };
      request_id: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error, "VALIDATION_ERROR");
    assert.match(payload.message, /^password:/);
    assert.ok(payload.details.fields.password.length >= 1);
    assert.ok(
      payload.details.issues.some(
        (issue) =>
          issue.field === "password" &&
          issue.message.includes("uppercase"),
      ),
    );
    assert.equal(payload.request_id, "signup-test-request");
    assert.equal(
      response.headers.get("x-request-id"),
      "signup-test-request",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("empty optional registration strings normalize to undefined", () => {
  const parsed = registerSchema.parse({
    fullName: "Test Lawyer",
    email: "lawyer@example.com",
    password: "SecurePass123",
    officeName: "Office",
    teamSize: "solo",
    phone: " ",
    barAssociationNumber: "",
  });
  assert.equal(parsed.phone, undefined);
  assert.equal(parsed.barAssociationNumber, undefined);
});
