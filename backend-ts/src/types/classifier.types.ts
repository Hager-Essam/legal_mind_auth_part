// ── Classifier types ─────────────────────────────────────────────────────────
// Types for the query classification system.

import type { QuestionCategory } from "../schemas";
import type { ParsedLegalReference } from "../utils/legal-ref-parser";

export type ClassificationResult = {
  category: QuestionCategory;
  parsedReference?: ParsedLegalReference;
};
