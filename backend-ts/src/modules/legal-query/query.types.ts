export type RewriteResult = {
  originalQuery: string;
  rewrittenQuery: string;
  retrievalQuery: string;
  usedMapping: boolean;
  usedLlm: boolean;
  mappingMatch: string | null;
  mappingMatches: string[];
  authorityBoosts: Array<{ authorityId: string; weight: number }>;
};
