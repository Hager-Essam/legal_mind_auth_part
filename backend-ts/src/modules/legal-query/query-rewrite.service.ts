import { env } from "../../config/env";
import { ChunkModel } from "../legal-corpus/chunk.model";
import type { RewriteResult } from "./query.types";
import {
  detectAuthorityHints,
  expandRetrievalQuery,
  type ResolvedAuthorityHint,
} from "../legal-corpus/law-mapping";
const AUTHORITY_TITLE_CACHE_MS = 5 * 60_000;

type AuthorityTitleLoader = (authorityIds: string[]) => Promise<Map<string, string>>;

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

export class QueryRewriteService {
  private authorityTitleCache = new Map<string, string>();
  private authorityTitleCacheExpiresAt = 0;

  constructor(
    private readonly authorityTitleLoader: AuthorityTitleLoader = loadOfficialAuthorityTitles
  ) {}

  private async resolveAuthorityHints(query: string): Promise<ResolvedAuthorityHint[]> {
    if (!env.enableAuthorityHints) return [];

    const hints = detectAuthorityHints(query);

    if (hints.length === 0) return [];

    const now = Date.now();
    const authorityIds = hints.map((hint) => hint.authorityId);
    const cacheIsFresh = now < this.authorityTitleCacheExpiresAt;
    const cacheHasAll = authorityIds.every((authorityId) => this.authorityTitleCache.has(authorityId));

    if (!cacheIsFresh || !cacheHasAll) {
      try {
        this.authorityTitleCache = await this.authorityTitleLoader(authorityIds);
        this.authorityTitleCacheExpiresAt = now + AUTHORITY_TITLE_CACHE_MS;
      } catch (error) {
        console.error(
          `[QueryRewriteService] Authority-title lookup failed (${error instanceof Error ? error.name : "unknown"}); continuing without query expansion.`
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
    usedLlm: boolean
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
      authorityBoosts: hints.map(({ authorityId, weight }) => ({
        authorityId,
        weight,
      })),
    };
  }

  async rewrite(query: string): Promise<RewriteResult> {
    // LegalMind serves lawyers only. Preserve their legal wording and apply
    // deterministic authority expansion without audience-specific rewriting.
    return this.buildResult(query, query, false);
  }
}
