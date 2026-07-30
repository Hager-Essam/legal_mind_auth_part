const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class ProviderHttpError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

const retryAfterMs = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
};

const wait = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const requestProviderText = async (
  url: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
    totalRetryBudgetMs?: number;
    maxAttempts?: number;
  },
): Promise<string> => {
  const startedAt = Date.now();
  const totalBudgetMs = options.totalRetryBudgetMs ?? options.timeoutMs * 2;
  const maxAttempts = options.maxAttempts ?? 3;
  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const elapsed = Date.now() - startedAt;
    const remainingBudget = totalBudgetMs - elapsed;
    if (remainingBudget <= 0) break;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      Math.min(options.timeoutMs, remainingBudget),
    );
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      // Keep the timeout active until the response body has been read.
      const text = await response.text();
      if (response.ok) return text;

      const retryable = RETRYABLE_STATUS.has(response.status);
      if (!retryable || attempt === maxAttempts) {
        throw new ProviderHttpError(
          response.status,
          retryable,
          `Provider request failed with status ${response.status}.`,
        );
      }

      const requestedDelay = retryAfterMs(response.headers.get("retry-after"));
      const exponential = Math.min(250 * 2 ** (attempt - 1), 2_000);
      const jitter = Math.floor(Math.random() * 150);
      const delay = Math.min(
        requestedDelay ?? exponential + jitter,
        Math.max(0, totalBudgetMs - (Date.now() - startedAt)),
      );
      if (delay > 0) await wait(delay);
    } catch (error) {
      if (error instanceof ProviderHttpError) throw error;
      lastNetworkError = error;
      if (attempt === maxAttempts) break;
      const delay = Math.min(
        250 * 2 ** (attempt - 1) + Math.floor(Math.random() * 150),
        Math.max(0, totalBudgetMs - (Date.now() - startedAt)),
      );
      if (delay > 0) await wait(delay);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new ProviderHttpError(
    null,
    true,
    lastNetworkError instanceof Error &&
      lastNetworkError.name === "AbortError"
      ? "Provider request timed out."
      : "Provider network request failed.",
  );
};

