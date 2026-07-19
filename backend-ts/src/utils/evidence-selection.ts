import type { LegalChunks } from "../schemas";
import { parseLegalReference } from "./legal-ref-parser";
import { normalizeArabicQuery } from "./arabic-normalize";

const QUERY_STOP_WORDS = new Set([
  "ما", "ماذا", "ماهي", "ما هي", "هل", "عن", "على", "في", "من", "الى", "إلى",
  "كيف", "شرح", "اشرح", "أشرح", "اريد", "أريد", "بشأن", "حول", "ذلك", "هذه",
  "هذا", "مع", "أو", "او", "ثم", "تم", "التي", "الذي", "التى", "الذى",
]);

const tokenize = (value: string): string[] => {
  return normalizeArabicQuery(value).split(" ").map((token) => token.trim()).filter((token) => token.length > 1 && !QUERY_STOP_WORDS.has(token));
};

const getChunkText = (chunk: LegalChunks): string => {
  const lawNameNorm = typeof chunk.law_name_normalized === "string" ? chunk.law_name_normalized : "";
  const lawCategory = typeof chunk.law_category === "string" ? chunk.law_category : "";
  return `${lawNameNorm} ${lawCategory} ${chunk.article_number ?? ""} ${chunk.content}`;
};

const getSimilarityScore = (chunk: LegalChunks): number => {
  const value = chunk.similarity_score;
  if (typeof value !== "number") return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const getSemanticUnitBoost = (chunk: LegalChunks): number => {
  const unit = chunk.semantic_unit;
  if (unit === "obligation") return 0.1;
  if (unit === "right") return 0.08;
  if (unit === "penalty") return 0.12;
  if (unit === "definition") return 0.06;
  return 0;
};

const getCitationBoost = (chunk: LegalChunks): number => {
  const hasLawName = typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim().length > 0;
  const hasArticleNumber = typeof chunk.article_number === "string" && chunk.article_number.trim().length > 0;
  return hasLawName && hasArticleNumber ? 0.08 : hasLawName || hasArticleNumber ? 0.04 : 0;
};

const getArticleMatchBoost = (question: string, chunk: LegalChunks): number => {
  if (!chunk.article_number) return 0;
  const normalizedQuestion = normalizeArabicQuery(question);
  return normalizedQuestion.includes(chunk.article_number.trim()) ? 0.2 : 0;
};

const getDeepStructureBoost = (question: string, chunk: LegalChunks): number => {
  const parsed = parseLegalReference(question);
  let boost = 0;
  const searchableText = `${chunk.hierarchy_path ?? ""} ${chunk.content}`;
  for (const p of parsed.paragraphs) {
    if (searchableText.includes(`الفقرة ${p}`) || searchableText.includes(`الفقره ${p}`) || searchableText.includes(`الفقرة رقم ${p}`) || searchableText.includes(`فقرة ${p}`)) {
      boost += 0.3;
    }
  }
  for (const c of parsed.clauses) {
    if (searchableText.includes(`بند ${c}`) || searchableText.includes(`البند ${c}`) || searchableText.includes(`البند رقم ${c}`)) {
      boost += 0.3;
    }
  }
  return boost;
};

export const scoreEvidenceChunk = (question: string, chunk: LegalChunks): number => {
  const queryTokens = tokenize(question);
  const chunkTokens = new Set(tokenize(getChunkText(chunk)));
  const overlapCount = queryTokens.filter((token) => chunkTokens.has(token)).length;
  const overlapScore = queryTokens.length === 0 ? 0 : overlapCount / queryTokens.length;
  const similarityScore = getSimilarityScore(chunk);
  const score = similarityScore * 0.45 + overlapScore * 0.35 + getSemanticUnitBoost(chunk) + getCitationBoost(chunk) + getArticleMatchBoost(question, chunk) + getDeepStructureBoost(question, chunk);
  return Math.max(0, Math.min(score, 1));
};

export const deduplicateEvidence = (chunks: LegalChunks[]): LegalChunks[] => {
  const bestByKey = new Map<string, LegalChunks>();
  for (const chunk of chunks) {
    const dedupeKey = chunk.chunk_id.trim().length > 0 ? chunk.chunk_id : normalizeArabicQuery(chunk.content).slice(0, 500);
    const existing = bestByKey.get(dedupeKey);
    if (!existing) { bestByKey.set(dedupeKey, chunk); continue; }
    if (getSimilarityScore(chunk) > getSimilarityScore(existing)) bestByKey.set(dedupeKey, chunk);
  }
  return Array.from(bestByKey.values());
};

export const selectTopEvidence = (chunks: LegalChunks[], topK: number): LegalChunks[] => {
  return chunks.slice(0, Math.max(1, topK));
};
