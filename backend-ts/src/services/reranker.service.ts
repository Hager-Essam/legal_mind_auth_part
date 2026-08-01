import { performance } from "node:perf_hooks";
import { env } from "../config/env";
import type { LegalChunks } from "../schemas";
import { deduplicateEvidence, scoreEvidenceChunk, selectTopEvidence } from "../utils/evidence-selection";
import { ProviderConfigService } from "../infrastructure/provider/provider-config.service";
import { requestProviderText } from "../infrastructure/provider/provider-http.service";

// DashScope rerank endpoint uses "compatible-api" instead of "compatible-mode"
const getRerankUrl = (baseUrl: string): string => `${baseUrl.replace("compatible-mode", "compatible-api")}/reranks`;

const RERANK_TIMEOUT_MS = 10_000;

type RerankResult = {
  results: Array<{ index: number; relevance_score: number }>;
  error?: { message?: string };
};

export const validateRerankResults = (
  payload: RerankResult,
  chunkCount: number,
  topK: number,
): void => {
  if (
    !Array.isArray(payload.results) ||
    payload.results.length === 0 ||
    payload.results.length > topK
  ) {
    throw new Error("Reranker returned an invalid result count.");
  }
  const indexes = new Set<number>();
  for (const result of payload.results) {
    if (
      !Number.isInteger(result.index) ||
      result.index < 0 ||
      result.index >= chunkCount ||
      indexes.has(result.index)
    ) {
      throw new Error("Reranker returned an invalid or duplicate index.");
    }
    if (
      !Number.isFinite(result.relevance_score) ||
      result.relevance_score < 0 ||
      result.relevance_score > 1
    ) {
      throw new Error("Reranker returned an invalid relevance score.");
    }
    indexes.add(result.index);
  }
};

// Build an enriched document string so the cross-encoder sees structural signals
const buildDocumentString = (chunk: LegalChunks): string => {
  const parts: string[] = [];
  if (typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim()) {
    parts.push(chunk.law_name_normalized.trim());
  }
  if (typeof chunk.article_number === "string" && chunk.article_number.trim()) {
    parts.push(`مادة ${chunk.article_number.trim()}`);
  }
  const header = parts.join(" | ");
  return header ? `[${header}]\n${chunk.content}` : chunk.content;
};

export class RerankerService {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  async rerank(question: string, chunks: LegalChunks[], topK: number): Promise<LegalChunks[]> {
    const deduplicated = deduplicateEvidence(chunks);

    if (env.enableLlmRerank && deduplicated.length > 0) {
      const start = performance.now();
      try {
        const result = await this.rerankWithLlm(question, deduplicated, topK);
        const ms = Math.round(performance.now() - start);
        console.log(`[RerankerService] llm rerank: ${deduplicated.length} → ${result.length} chunks in ${ms}ms`);
        return result;
      } catch (error) {
        const ms = Math.round(performance.now() - start);
        console.error(`[RerankerService] Qwen3-Reranker failed after ${ms}ms, falling back to heuristic:`, error);
      }
    }

    // Heuristic fallback — synchronous, zero latency, no API call
    const start = performance.now();
    const result = this.rerankHeuristic(question, deduplicated, topK);
    const ms = Math.round(performance.now() - start);
    console.log(`[RerankerService] heuristic rerank: ${deduplicated.length} → ${result.length} chunks in ${ms}ms`);
    return result;
  }

  private async rerankWithLlm(question: string, chunks: LegalChunks[], topK: number): Promise<LegalChunks[]> {
    const apiKey = this.providerConfigService.getDashScopeApiKey();
    const rerankUrl = getRerankUrl(env.dashscopeCompatUrl);

    const text = await requestProviderText(
      rerankUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: env.llmRerankModel,
          query: question,
          documents: chunks.map(buildDocumentString),
          top_n: topK,
          return_documents: false,
        }),
      },
      { timeoutMs: RERANK_TIMEOUT_MS, totalRetryBudgetMs: 20_000 },
    );
      if (!text || !text.trim()) {
        throw new Error("Rerank API returned empty response");
      }

      let payload: RerankResult;
      try {
        payload = JSON.parse(text) as RerankResult;
      } catch {
        throw new Error("Reranker returned invalid JSON.");
      }
      validateRerankResults(payload, chunks.length, topK);

      // Map results back to original chunks by their position index
      return payload.results.map((result, rank) => ({
        ...chunks[result.index],
        rerank_score: Number(result.relevance_score.toFixed(6)),
        evidence_rank: rank + 1,
      }));
  }

  private rerankHeuristic(question: string, chunks: LegalChunks[], topK: number): LegalChunks[] {
    const ranked = chunks
      .map((chunk) => ({ ...chunk, rerank_score: Number(scoreEvidenceChunk(question, chunk).toFixed(6)) }))
      .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));

    return selectTopEvidence(ranked, topK).map((chunk, i) => ({ ...chunk, evidence_rank: i + 1 }));
  }
}
