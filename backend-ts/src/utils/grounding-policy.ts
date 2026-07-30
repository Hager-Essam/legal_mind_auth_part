import type { LegalChunks } from "../schemas";
import type { GroundingDecision } from "../types/grounding.types";

const MIN_RELEVANCE = 0.35;

const relevanceScore = (chunk: LegalChunks): number =>
  chunk.rerank_score ?? chunk.similarity_score ?? chunk.rrf_score ?? 0;

const hasCitationMetadata = (chunk: LegalChunks): boolean => {
  const title = chunk.authorityTitleOfficial?.trim();
  const pinpoint =
    chunk.article_number?.trim() ||
    chunk.appeal_number?.trim() ||
    chunk.authorityId?.trim();
  return Boolean(title && pinpoint);
};

export const isQualifiedGroundingChunk = (chunk: LegalChunks): boolean =>
  relevanceScore(chunk) >= MIN_RELEVANCE &&
  hasCitationMetadata(chunk) &&
  chunk.jurisdiction === "EG" &&
  chunk.is_retrievable === true &&
  chunk.reviewStatus === "published" &&
  (chunk.authorityStatus === "effective" ||
    chunk.authorityStatus === "amended") &&
  chunk.authorityType !== "generated_summary";

export const evaluateGrounding = (
  chunks: LegalChunks[],
): GroundingDecision => {
  const qualifiedChunks = chunks.filter(isQualifiedGroundingChunk);
  if (qualifiedChunks.length === 0) {
    return {
      shouldGenerate: false,
      qualifiedChunks: [],
      refusalAnswer:
        "لا تتوفر أدلة قانونية مصرية منشورة وموثقة بما يكفي للإجابة بدقة. يرجى تحديد القانون أو المادة أو إعادة صياغة السؤال.",
    };
  }
  return { shouldGenerate: true, qualifiedChunks };
};
