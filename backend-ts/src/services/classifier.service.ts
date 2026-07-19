import type { QuestionCategory, QueryRequest } from "../schemas";
import { parseLegalReference } from "../utils/legal-ref-parser";
import { CHAT_RE } from "../regex/classifier.patterns";
import type { ClassificationResult } from "../types/classifier.types";

export class ClassifierService {
  classify(request: QueryRequest): ClassificationResult
  {
    const query = request.query.trim();
    const parsedReference = parseLegalReference(query);

    const hasLaw =
      parsedReference.articleNumbers.length > 0 ||
      parsedReference.appealNumber ||
      parsedReference.lawNumber ||
      parsedReference.lawYear ||
      (parsedReference.lawName && parsedReference.lawName.split(" ").length >= 2);

    if (hasLaw) return { category: "law_ref", parsedReference };

    if (CHAT_RE.test(query)) return { category: "chat" };
    
    return { category: "arabic_rag", parsedReference };
  }
}
