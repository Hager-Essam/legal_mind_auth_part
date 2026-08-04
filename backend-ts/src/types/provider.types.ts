export type ProviderSummary = {
  llmProvider: string;
  embeddingProvider: string;
  baseUrl: string;
  llmModel: string;
  llmModelFallback: string;
  embeddingModel: string;
  embeddingDim: number;
  configuredKeys: number;
  llmConfigured: boolean;
};
