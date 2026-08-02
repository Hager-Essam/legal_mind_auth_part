import type { QueryRequest } from "./query.schema";
import { parseLegalReference } from "./legal-ref-parser";
import type { ClassificationResult } from "./classifier.types";

const socialOnlyPatterns = [
  /^(?:مرحبا|مرحباً|أهلا|أهلاً|اهلا|السلام عليكم|سلام)[!,.،؟?\s]*$/i,
  /^(?:شكرا|شكراً|شكرا لك|شكراً لك)[!,.،؟?\s]*$/i,
  /^(?:كيف حالك|إزيك|ازيك|عامل ايه|عاملة ايه)[!,.،؟?\s]*$/i,
  /^(?:hi|hello|hey|thanks|thank you|how are you)[!,.?\s]*$/i,
];

const greetingPrefix =
  /^(?:(?:مرحبا|مرحباً|أهلا|أهلاً|اهلا|السلام عليكم|سلام|شكرا|شكراً|hi|hello|hey|thanks|thank you)\s*[,،:؛;.!؟?-]*\s*)+/i;

export const stripGreetingPrefix = (query: string): string => query.trim().replace(greetingPrefix, "").trim();

export class ClassifierService {
  classify(request: QueryRequest): ClassificationResult {
    const query = request.query.trim();

    if (socialOnlyPatterns.some((pattern) => pattern.test(query))) {
      return { category: "chat" };
    }

    const substantiveQuery = stripGreetingPrefix(query) || query;
    const parsedReference = parseLegalReference(query);
    const hasExplicitReference =
      parsedReference.articleNumbers.length > 0 ||
      Boolean(parsedReference.appealNumber) ||
      Boolean(parsedReference.lawNumber) ||
      Boolean(parsedReference.lawYear);

    if (hasExplicitReference) {
      return { category: "law_ref", parsedReference };
    }

    return {
      category: "arabic_rag",
      parsedReference: parseLegalReference(substantiveQuery),
    };
  }
}
