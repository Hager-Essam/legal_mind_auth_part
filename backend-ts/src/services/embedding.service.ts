import { ProviderConfigService } from "./provider-config.service";

type DashScopeEmbeddingInputType = "query" | "document";

type DashScopeEmbeddingResponse = {
  output?: { embeddings?: Array<{ embedding?: number[] }> };
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string; code?: string };
  message?: string;
};

export class EmbeddingService {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embed([text], "query");
    if (embeddings.length === 0) {
      throw new Error("DashScope returned no query embedding.");
    }
    return embeddings[0];
  }

  private async embed(texts: string[], inputType: DashScopeEmbeddingInputType): Promise<number[][]> {
    const sanitizedTexts = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (sanitizedTexts.length === 0) return [];

    const provider = this.providerConfigService.getSummary();
    const apiKey = this.providerConfigService.getDashScopeApiKey();

    const response = await fetch(`${provider.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: provider.embeddingModel,
        input: sanitizedTexts,
        // input_type parameter for compatible-mode endpoint
        input_type: inputType,
      }),
    });

    const text = await response.text();
    
    // Handle empty response
    if (!text || !text.trim()) {
      throw new Error(`DashScope embeddings returned empty response (status ${response.status})`);
    }

    const payload = JSON.parse(text) as DashScopeEmbeddingResponse;
    if (!response.ok) throw new Error(this.buildErrorMessage(payload, response.status));

    // MaaS native response: output.embeddings[].embedding
    // OpenAI-compatible response: data[].embedding
    const embeddings = payload.output?.embeddings?.map((item) => item.embedding).filter(this.isVector)
      ?? payload.data?.map((item) => item.embedding).filter(this.isVector)
      ?? [];
    if (embeddings.length !== sanitizedTexts.length) {
      throw new Error(`DashScope count mismatch. Expected ${sanitizedTexts.length}, got ${embeddings.length}.`);
    }

    return embeddings;
  }

  private buildErrorMessage(payload: DashScopeEmbeddingResponse, status: number): string {
    const msg = payload.error?.message ?? payload.message ?? "Unknown DashScope error.";
    const code = payload.error?.code ? ` (${payload.error.code})` : "";
    return `DashScope embeddings failed with status ${status}${code}: ${msg}`;
  }

  private isVector(embedding: number[] | undefined): embedding is number[] {
    return Array.isArray(embedding) && embedding.every((v) => typeof v === "number");
  }
}
