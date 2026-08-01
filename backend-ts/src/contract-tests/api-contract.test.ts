import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../app/create-app";
import type { AppServices } from "../services/service-container";
import {
  endpointContracts,
  normalizeContractPayload,
  type EndpointContract,
} from "./endpoint-contracts";

const healthyServices = {
  mongoService: {
    health: async () => ({
      app: { connected: true, readyState: 1, pingOk: true },
      rag: { connected: true, readyState: 1, pingOk: true },
    }),
  },
  providerConfigService: {
    getSummary: () => ({ llmConfigured: true }),
  },
  authService: {
    verifyAccessToken: () => ({ sub: "contract-user" }),
  },
  userRepository: {
    findById: async () => null,
  },
} as unknown as AppServices;

const invoke = (
  app: ReturnType<typeof createApp>,
  contract: EndpointContract,
) => {
  switch (contract.method) {
    case "GET":
      return request(app).get(contract.path);
    case "POST":
      return request(app).post(contract.path).send({});
    case "PATCH":
      return request(app).patch(contract.path).send({});
    case "DELETE":
      return request(app).delete(contract.path);
  }
};

test("the explicit contract table inventories every mounted route", () => {
  assert.equal(endpointContracts.length, 21);
  assert.equal(
    endpointContracts.filter((contract) => contract.frontendBlocking).length,
    16,
  );
  assert.equal(
    new Set(
      endpointContracts.map(
        (contract) => contract.method + " " + contract.path,
      ),
    ).size,
    endpointContracts.length,
  );
});

test("every endpoint contract is reachable through the Express application", async () => {
  const app = createApp(healthyServices);
  for (const contract of endpointContracts) {
    const response = await invoke(app, contract);
    assert.equal(
      response.status,
      contract.probeStatus,
      contract.method + " " + contract.path,
    );
    assert.notEqual(response.body?.error, "ROUTE_NOT_FOUND");
  }
});

test("health fixtures are deterministic through the application boundary", async () => {
  const app = createApp(healthyServices);
  const health = await request(app).get("/health").expect(200);
  const readiness = await request(app).get("/ready").expect(200);

  assert.deepEqual(normalizeContractPayload(health.body), {
    status: "ok",
    service: "LegalMind API TS",
    environment: "development",
    checks: {
      applicationDatabase: { connected: true, readyState: 1, pingOk: true },
      ragDatabase: { connected: true, readyState: 1, pingOk: true },
    },
  });
  assert.deepEqual(normalizeContractPayload(readiness.body), {
    status: "ok",
    checks: {
      applicationDatabase: true,
      ragDatabase: true,
      provider: true,
    },
  });
});

test("normalization excludes only documented nondeterministic fields", () => {
  assert.deepEqual(
    normalizeContractPayload({
      request_id: "generated",
      answer: "provider text",
      latency_ms: 42,
      category: "arabic_rag",
      source_chunks: [{ chunk_id: "stable", content: "stable evidence" }],
    }),
    {
      category: "arabic_rag",
      source_chunks: [{ chunk_id: "stable", content: "stable evidence" }],
    },
  );
});
