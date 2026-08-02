import { env } from "../../config/env";
import type { ProviderSummary } from "../../types/provider.types";

export class ProviderConfigService {
  private keyIndex = 0;

  getSummary(): ProviderSummary {
    return {
      llmProvider: "modelstudio",
      embeddingProvider: "modelstudio",
      baseUrl: env.dashscopeCompatUrl,
      llmModel: env.llmModel,
      llmModelFallback: env.llmModelFallback,
      embeddingModel: env.embeddingModel,
      embeddingDim: env.embeddingDim,
      configuredKeys: env.dashscopeApiKeys.length,
      llmConfigured: env.dashscopeApiKeys.length > 0,
    };
  }

  getDashScopeApiKey(): string {
    const keys = env.dashscopeApiKeys;

    if (keys.length === 0)
      throw new Error(
        "No DashScope API keys configured. Set LEGALMIND_DASHSCOPE_API_KEYS in the environment."
      );
    const key = keys[this.keyIndex % keys.length];
    this.keyIndex++;

    return key;
  }
}
