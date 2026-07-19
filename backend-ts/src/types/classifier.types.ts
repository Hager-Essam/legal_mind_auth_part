import type { QuestionCategory } from "../schemas";
import type { ParsedLegalReference } from "../utils/legal-ref-parser";

export type ClassificationResult = {
  category: QuestionCategory;
  parsedReference?: ParsedLegalReference;
};
