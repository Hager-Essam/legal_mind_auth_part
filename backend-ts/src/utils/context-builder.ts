import type { LegalChunks } from "../schemas";

const buildChunkCitation = (chunk: LegalChunks): string => {
  if (chunk.appeal_number) {
    const yearPart = chunk.judicial_year ? ` لسنة ${chunk.judicial_year}` : "";
    const datePart = chunk.ruling_date ? ` - بتاريخ ${chunk.ruling_date}` : "";
    const subjectPart = chunk.case_subject ? ` - ${chunk.case_subject.trim()}` : "";
    return `[حكم النقض - الطعن رقم ${chunk.appeal_number}${yearPart}${datePart}${subjectPart}]`;
  }

  const lawName = typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim().length > 0
    ? chunk.law_name_normalized.trim()
    : "التشريع المصري";
  const articlePart = chunk.article_number?.trim() ? ` - المادة ${chunk.article_number.trim()}` : "";
  const lawCategory = typeof chunk.law_category === "string" && chunk.law_category.trim().length > 0
    ? ` - ${chunk.law_category.trim()}` : "";
  const sourceDataset = typeof chunk.source_dataset === "string" && chunk.source_dataset.trim().length > 0
    ? ` - ${chunk.source_dataset.trim()}` : "";

  return `[المصدر: ${lawName}${articlePart}${lawCategory}${sourceDataset}]`;
};

export const buildArabicLegalContext = (chunks: LegalChunks[]): string => {
  return chunks
    .map((chunk) => `${buildChunkCitation(chunk)}\n${chunk.content.trim()}`)
    .filter((entry) => entry.trim().length > 0)
    .join("\n\n---\n\n");
};
