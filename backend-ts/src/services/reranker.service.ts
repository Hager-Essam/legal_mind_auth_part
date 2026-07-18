import { performance } from "node:perf_hooks";
import { env } from "../config/env";
import type { LegalChunks } from "../schemas";
import {
  deduplicateEvidence,
  scoreEvidenceChunk,
  selectTopEvidence,
} from "../utils/evidence-selection";
import { ProviderConfigService } from "./provider-config.service";

// DashScope rerank endpoint uses "compatible-api" instead of "compatible-mode".
// Derive it from the configured base URL so regional overrides (e.g. -intl) propagate automatically.
const getRerankUrl = (baseUrl: string): string =>
  `${baseUrl.replace("compatible-mode", "compatible-api")}/reranks`;

const RERANK_TIMEOUT_MS = 10_000;

type RerankResult = {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
  error?: { message?: string };
};

// Build an enriched document string so the cross-encoder sees the same
// structural signals the heuristic used for boosting — law name and article
// number — prepended to the content as a bracketed header.
// Example: "[قانون العمل رقم 12 لسنة 2003 | مادة 109]\nيحق للعامل..."
const buildDocumentString = (chunk: LegalChunks): string => {
  const parts: string[] = [];
  if (
    typeof chunk.law_name_normalized === "string" &&
    chunk.law_name_normalized.trim()
  ) {
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

  async rerank(question: string,chunks: LegalChunks[],topK: number,): Promise<LegalChunks[]> 
  {
    const deduplicated = deduplicateEvidence(chunks);

    if (env.enableLlmRerank && deduplicated.length > 0) {
      const start = performance.now();
      try {
        const result = await this.rerankWithLlm(question, deduplicated, topK);
        const ms = Math.round(performance.now() - start);
        console.log(
          `[RerankerService] llm rerank: ${deduplicated.length} → ${result.length} chunks in ${ms}ms`,
        );
        return result;
      } catch (error) {
        const ms = Math.round(performance.now() - start);
        console.error(
          `[RerankerService] Qwen3-Reranker failed after ${ms}ms, falling back to heuristic:`,
          error,
        );
      }
    }

    // Heuristic fallback — synchronous, zero latency, no API call
    const start = performance.now();
    const result = this.rerankHeuristic(question, deduplicated, topK);
    const ms = Math.round(performance.now() - start);
    console.log(
      `[RerankerService] heuristic rerank: ${deduplicated.length} → ${result.length} chunks in ${ms}ms`,
    );
    return result;
  }

  // ── Qwen3-Reranker (cross-encoder) ────────────────────────────────────────

  private async rerankWithLlm(question: string,chunks: LegalChunks[],topK: number,): Promise<LegalChunks[]> 
  {
    const apiKey = this.providerConfigService.getDashScopeApiKey();
    const rerankUrl = getRerankUrl(env.dashscopeCompatUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);

    try {
      const response = await fetch(rerankUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: env.llmRerankModel,
          query: question,
          // Enriched strings — law name + article number prepended as a header
          // so the cross-encoder sees structural metadata alongside the content.
          documents: chunks.map(buildDocumentString),
          top_n: topK,
          // We map results back by index ourselves — no need to echo documents.
          return_documents: false,
        }),
        signal: controller.signal,
      });

      const text = await response.text();
      
      // Handle empty response
      if (!text || !text.trim()) {
        console.warn("[RerankerService] Empty response from rerank API, falling back to heuristic");
        throw new Error("Rerank API returned empty response");
      }

      const payload = JSON.parse(text) as RerankResult;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            `Rerank API failed with status ${response.status}`,
        );
      }

      if (!Array.isArray(payload.results) || payload.results.length === 0) {
        throw new Error("Rerank API returned empty results");
      }

      // Map results back to original chunks by their position index.
      // The API returns results sorted best-first; rank 1 = most relevant.
      return payload.results.map((result, rank) => ({
        ...chunks[result.index],
        rerank_score: Number(result.relevance_score.toFixed(6)),
        evidence_rank: rank + 1,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Heuristic fallback ─────────────────────────────────────────────────────

  private rerankHeuristic(question: string,
    chunks: LegalChunks[],
    topK: number,
  ): LegalChunks[] {
    const ranked = chunks
      .map((chunk) => ({
        ...chunk,
        rerank_score: Number(scoreEvidenceChunk(question, chunk).toFixed(6)),
      }))
      .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));

    return selectTopEvidence(ranked, topK).map((chunk, i) => ({
      ...chunk,
      evidence_rank: i + 1,
    }));
  }
}
