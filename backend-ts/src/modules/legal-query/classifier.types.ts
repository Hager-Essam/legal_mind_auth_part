import type { QuestionCategory } from "./query.schema";
import type { ParsedLegalReference } from "./legal-ref-parser";

export type ClassificationResult = {
  category: QuestionCategory;
  parsedReference?: ParsedLegalReference;
};
