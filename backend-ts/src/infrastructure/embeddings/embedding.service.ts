import { ProviderConfigService } from "../provider/provider-config.service";
import { env } from "../../config/env";
import { requestProviderText } from "../provider/provider-http.service";

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

    if (embeddings.length === 0) throw new Error("DashScope returned no query embedding.");

    return embeddings[0];
  }

  private async embed(texts: string[], inputType: DashScopeEmbeddingInputType): Promise<number[][]> {
    const sanitizedTexts = texts.map((t) => t.trim()).filter((t) => t.length > 0);

    if (sanitizedTexts.length === 0) return [];

    const provider = this.providerConfigService.getSummary();
    const apiKey = this.providerConfigService.getDashScopeApiKey();

    const text = await requestProviderText(
      `${provider.baseUrl}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.embeddingModel,
          input: sanitizedTexts,
          input_type: inputType,
        }),
      },
      { timeoutMs: 20_000, totalRetryBudgetMs: 35_000 }
    );

    if (!text.trim()) throw new Error("تم إرجاع إجابة فارغة من الموفر.");

    let payload: DashScopeEmbeddingResponse;

    try {
      payload = JSON.parse(text) as DashScopeEmbeddingResponse;
    } catch {
      throw new Error("تم إرجاع إجابة غير صالحة من الموفر.");
    }

    // MaaS native response: output.embeddings[].embedding
    // OpenAI-compatible response: data[].embedding
    const rawEmbeddings = payload.output?.embeddings ?? payload.data ?? [];

    if (rawEmbeddings.length !== sanitizedTexts.length) {
      throw new Error(
        `عدد التضمينات غير متطابق. متوقع ${sanitizedTexts.length}, حصل على ${rawEmbeddings.length}.`
      );
    }

    return rawEmbeddings.map((item, index) => {
      const embedding = item.embedding;

      if (
        !Array.isArray(embedding) ||
        embedding.length !== env.embeddingDim ||
        !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
      ) {
        throw new Error(`التضمين ${index} يجب أن يحتوي على ${env.embeddingDim} قيمة محددة.`);
      }

      return embedding;
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts, "document");
  }
}
