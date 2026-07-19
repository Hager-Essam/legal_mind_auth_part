export type RewriteResult = {
  originalQuery: string;
  rewrittenQuery: string;
  usedMapping: boolean;
  usedLlm: boolean;
  mappingMatch: string | null;
};
