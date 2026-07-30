import { env } from "../config/env";
import type { RewriteResult } from "../types/query.types";
import { normalizeArabicQuery } from "../utils/arabic-normalize";
import { rewriteWithMapping } from "../utils/law-mapping";
import { ProviderConfigService } from "./provider-config.service";
import { requestProviderText } from "./provider-http.service";

const LLM_REWRITE_TIMEOUT_MS = 8_000;

const REWRITE_SYSTEM_PROMPT = `Rewrite the user's Egyptian legal question for retrieval.
Preserve every explicit law, article, case number, date, fact, and qualification.
Do not invent or infer a law number, article number, authority, penalty, or case number.
Use legal concepts as search hints, not as authority decisions.
Return only the rewritten question.`;

export class QueryRewriteService {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  private deterministicFallback(query: string): RewriteResult {
    const normalized = normalizeArabicQuery(query);
    const mapping = env.enableLegacyLawMapping
      ? rewriteWithMapping(normalized)
      : {
          matched: false,
          rewritten: normalized,
          matchedTerm: null,
          appendedLaw: null,
        };
    return {
      originalQuery: query,
      rewrittenQuery: mapping.rewritten,
      usedMapping: mapping.matched,
      usedLlm: false,
      mappingMatch: mapping.matchedTerm,
    };
  }

  async rewrite(
    query: string,
    userRole?: "lawyer" | "citizen",
  ): Promise<RewriteResult> {
    const role = userRole ?? env.defaultUserRole;
    if (role === "lawyer" && !env.enableLegacyLawMapping) {
      return {
        originalQuery: query,
        rewrittenQuery: query.trim(),
        usedMapping: false,
        usedLlm: false,
        mappingMatch: null,
      };
    }
    if (role === "lawyer" || !env.enableQueryRewrite || !env.enableLlmRewrite) {
      return this.deterministicFallback(query);
    }

    try {
      const rewritten = await this.rewriteWithLlm(query);
      if (!rewritten.trim() || rewritten.length > 2_000) {
        return this.deterministicFallback(query);
      }
      if (!env.enableLegacyLawMapping) {
        return {
          originalQuery: query,
          rewrittenQuery: rewritten.trim(),
          usedMapping: false,
          usedLlm: true,
          mappingMatch: null,
        };
      }
      const mapping = rewriteWithMapping(normalizeArabicQuery(rewritten));
      return {
        originalQuery: query,
        rewrittenQuery:
          mapping.appendedLaw && !rewritten.includes(mapping.appendedLaw)
            ? `${rewritten.trim()} ${mapping.appendedLaw}`
            : rewritten.trim(),
        usedMapping: mapping.matched,
        usedLlm: true,
        mappingMatch: mapping.matchedTerm,
      };
    } catch (error) {
      console.error(
        `[QueryRewriteService] Rewrite failed (${error instanceof Error ? error.name : "unknown"}); using the original query.`,
      );
      return this.deterministicFallback(query);
    }
  }

  private async rewriteWithLlm(query: string): Promise<string> {
    const apiKey = this.providerConfigService.getDashScopeApiKey();
    const text = await requestProviderText(
      `${env.dashscopeCompatUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: env.llmRewriteModel,
          messages: [
            { role: "system", content: REWRITE_SYSTEM_PROMPT },
            { role: "user", content: query },
          ],
          temperature: 0,
          max_tokens: 256,
        }),
      },
      {
        timeoutMs: LLM_REWRITE_TIMEOUT_MS,
        totalRetryBudgetMs: 12_000,
        maxAttempts: 2,
      },
    );
    let payload: {
      choices?: Array<{ message?: { content?: string } }>;
    };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new Error("Rewrite provider returned invalid JSON.");
    }
    return payload.choices?.[0]?.message?.content?.trim() || query;
  }
}
