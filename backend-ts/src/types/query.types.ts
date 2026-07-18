// ── Query rewrite types ──────────────────────────────────────────────────────
// Types for the query rewriting system.

export type RewriteResult = {
  originalQuery: string;
  rewrittenQuery: string;
  usedMapping: boolean;
  usedLlm: boolean;
  mappingMatch: string | null;
};
