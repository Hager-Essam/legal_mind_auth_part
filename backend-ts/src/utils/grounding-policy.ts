import type { LegalChunks } from "../schemas";
import type { GroundingDecision } from "../types/grounding.types";

const getTopRerankScore = (chunks: LegalChunks[]): number => {
  const scores = chunks.map((c) => c.rerank_score).filter((v): v is number => typeof v === "number");
  return scores.length === 0 ? 0 : Math.max(...scores);
};

const hasStructuredCitation = (chunk: LegalChunks): boolean => {
  const hasLawName = typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim().length > 0;
  const hasArticle = typeof chunk.article_number === "string" && chunk.article_number.trim().length > 0;
  const hasAppeal = typeof chunk.appeal_number === "string" && chunk.appeal_number.trim().length > 0;
  const hasCaseSubject = typeof chunk.case_subject === "string" && chunk.case_subject.trim().length > 0;
  return hasLawName || hasArticle || hasAppeal || hasCaseSubject;
};

export const evaluateGrounding = (chunks: LegalChunks[]): GroundingDecision => {
  if (chunks.length === 0) {
    return { shouldGenerate: false, refusalAnswer: "لم يتم العثور على أدلة قانونية كافية للإجابة عن السؤال بشكل موثوق." };
  }
  const topScore = getTopRerankScore(chunks);
  const citedCount = chunks.filter(hasStructuredCitation).length;
  if (topScore < 0.35 || citedCount === 0) {
    return { shouldGenerate: false, refusalAnswer: "الأدلة القانونية المسترجعة غير كافية لتقديم إجابة موثوقة ومدعومة بنص صريح. يرجى إعادة صياغة السؤال أو تحديد القانون أو المادة بشكل أدق." };
  }
  return { shouldGenerate: true };
};
