import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ProviderHttpError,
  requestProviderText,
} from "../services/provider-http.service";
import { EmbeddingService } from "../services/embedding.service";
import type { ProviderConfigService } from "../services/provider-config.service";
import { env } from "../config/env";

const originalFetch = globalThis.fetch;

const embeddingProvider = {
  getSummary: () => ({
    llmProvider: "modelstudio",
    embeddingProvider: "modelstudio",
    baseUrl: "https://provider.invalid",
    llmModel: "test",
    llmModelFallback: "test",
    embeddingModel: "test-embedding",
    embeddingDim: env.embeddingDim,
    configuredKeys: 1,
    llmConfigured: true,
  }),
  getDashScopeApiKey: () => "test-key",
} as unknown as ProviderConfigService;

test("provider HTTP does not retry permanent 401 errors", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    return new Response("unauthorized", { status: 401 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      requestProviderText(
        "https://provider.invalid",
        {},
        { timeoutMs: 100, maxAttempts: 3 },
      ),
      (error) =>
        error instanceof ProviderHttpError &&
        error.status === 401 &&
        error.retryable === false,
    );
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider HTTP retries a retryable 500 and preserves the successful body", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    return attempts === 1
      ? new Response("temporary", { status: 500 })
      : new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  try {
    const text = await requestProviderText(
      "https://provider.invalid",
      {},
      {
        timeoutMs: 1_000,
        totalRetryBudgetMs: 2_000,
        maxAttempts: 2,
      },
    );
    assert.equal(text, '{"ok":true}');
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider timeout remains active while reading the body", async () => {
  globalThis.fetch = (async (_url, init) => {
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () =>
        new Promise<string>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    } as Response;
  }) as typeof fetch;
  try {
    await assert.rejects(
      requestProviderText(
        "https://provider.invalid",
        {},
        {
          timeoutMs: 25,
          totalRetryBudgetMs: 30,
          maxAttempts: 1,
        },
      ),
      (error) =>
        error instanceof ProviderHttpError &&
        error.message === "Provider request timed out.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("embedding validation enforces dimensions, finite values, and batch ordering", async () => {
  const first = Array.from({ length: env.embeddingDim }, () => 0);
  const second = Array.from({ length: env.embeddingDim }, () => 0);
  first[0] = 1;
  second[0] = 2;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding: first }, { embedding: second }],
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    const service = new EmbeddingService(embeddingProvider);
    const result = await service.embedDocuments(["first", "second"]);
    assert.equal(result[0][0], 1);
    assert.equal(result[1][0], 2);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }),
      { status: 200 },
    )) as typeof fetch;
  try {
    await assert.rejects(
      new EmbeddingService(embeddingProvider).embedQuery("invalid"),
      /exactly/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
