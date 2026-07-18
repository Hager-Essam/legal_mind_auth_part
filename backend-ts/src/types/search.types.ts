// ── Search types ─────────────────────────────────────────────────────────────
// Options threaded from a parsed query into both search methods.

export type SearchOptions = {
  topK?: number;
  lawCategory?: string;
  lawNumber?: string;
  lawYear?: string;
  appealNumber?: string;
  judicialYear?: string;
};
