import { env } from "../config/env";
import { ChunkModel } from "../models/chunk.model";
import type { RewriteResult } from "../types/query.types";
import {
  detectAuthorityHints,
  expandRetrievalQuery,
  type ResolvedAuthorityHint,
} from "../utils/law-mapping";
import { ProviderConfigService } from "./provider-config.service";
import { requestProviderText } from "./provider-http.service";

const LLM_REWRITE_TIMEOUT_MS = 8_000;
const AUTHORITY_TITLE_CACHE_MS = 5 * 60_000;

type AuthorityTitleLoader = (
  authorityIds: string[],
) => Promise<Map<string, string>>;

const loadOfficialAuthorityTitles: AuthorityTitleLoader = async (authorityIds) => {
  const rows = await ChunkModel.find({
    authorityId: { $in: authorityIds },
    jurisdiction: "EG",
    is_retrievable: true,
    reviewStatus: "published",
    authorityStatus: { $in: ["effective", "amended"] },
    authorityTitleOfficial: { $type: "string", $ne: "" },
  })
    .select({ authorityId: 1, authorityTitleOfficial: 1, _id: 0 })
    .lean();

  const titles = new Map<string, string>();
  for (const row of rows) {
    if (row.authorityId && row.authorityTitleOfficial && !titles.has(row.authorityId)) {
      titles.set(row.authorityId, row.authorityTitleOfficial);
    }
  }
  return titles;
};

const REWRITE_SYSTEM_PROMPT = `Rewrite the user's Egyptian legal question for retrieval.
Preserve every explicit law, article, case number, date, fact, and qualification.
Do not invent or infer a law number, article number, authority, penalty, or case number.
Use legal concepts as search hints, not as authority decisions.
Return only the rewritten question.`;

export class QueryRewriteService {
  private authorityTitleCache = new Map<string, string>();
  private authorityTitleCacheExpiresAt = 0;

  constructor(
    private readonly providerConfigService: ProviderConfigService,
    private readonly authorityTitleLoader: AuthorityTitleLoader = loadOfficialAuthorityTitles,
  ) {}

  private async resolveAuthorityHints(query: string): Promise<ResolvedAuthorityHint[]> {
    if (!env.enableAuthorityHints) return [];

    const hints = detectAuthorityHints(query);
    if (hints.length === 0) return [];

    const now = Date.now();
    const authorityIds = hints.map((hint) => hint.authorityId);
    const cacheIsFresh = now < this.authorityTitleCacheExpiresAt;
    const cacheHasAll = authorityIds.every((authorityId) =>
      this.authorityTitleCache.has(authorityId),
    );

    if (!cacheIsFresh || !cacheHasAll) {
      try {
        this.authorityTitleCache = await this.authorityTitleLoader(authorityIds);
        this.authorityTitleCacheExpiresAt = now + AUTHORITY_TITLE_CACHE_MS;
      } catch (error) {
        console.error(
          `[QueryRewriteService] Authority-title lookup failed (${error instanceof Error ? error.name : "unknown"}); continuing without query expansion.`,
        );
      }
    }

    return hints.map((hint) => ({
      ...hint,
      officialTitle: this.authorityTitleCache.get(hint.authorityId),
    }));
  }

  private async buildResult(
    originalQuery: string,
    rewrittenQuery: string,
    usedLlm: boolean,
  ): Promise<RewriteResult> {
    const hints = await this.resolveAuthorityHints(originalQuery);
    const mappingMatches = hints.flatMap((hint) => hint.matchedAliases);

    return {
      originalQuery,
      rewrittenQuery: rewrittenQuery.trim(),
      retrievalQuery: expandRetrievalQuery(rewrittenQuery, hints),
      usedMapping: hints.length > 0,
      usedLlm,
      mappingMatch: mappingMatches[0] ?? null,
      mappingMatches,
      authorityBoosts: hints.map(({ authorityId, weight }) => ({ authorityId, weight })),
    };
  }

  async rewrite(
    query: string,
    userRole?: "lawyer" | "citizen",
  ): Promise<RewriteResult> {
    const role = userRole ?? env.defaultUserRole;
    if (role === "lawyer" || !env.enableQueryRewrite || !env.enableLlmRewrite) {
      return this.buildResult(query, query, false);
    }

    try {
      const rewritten = await this.rewriteWithLlm(query);
      if (!rewritten.trim() || rewritten.length > 2_000) {
        return this.buildResult(query, query, false);
      }
      return this.buildResult(query, rewritten, true);
    } catch (error) {
      console.error(
        `[QueryRewriteService] Rewrite failed (${error instanceof Error ? error.name : "unknown"}); using the original query.`,
      );
      return this.buildResult(query, query, false);
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
