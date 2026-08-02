import type { ChunkDocument } from "./chunk.model";
import type { LegalChunks } from "./chunk.schema";

// Maps a raw DB document into the API-facing LegalChunks shape
export function toLegalChunk(doc: ChunkDocument, score?: number): LegalChunks {
  const similarity_score = typeof score === "number" ? Number(score.toFixed(6)) : undefined;

  return {
    chunk_id: doc.chunk_id ?? String(doc._id ?? ""),
    source_file: doc.source_file ?? undefined,
    article_number: doc.article_number ?? undefined,
    content: doc.text ?? "",
    law_name_normalized: doc.law_name_normalized ?? "",
    law_category: doc.law_category ?? "",
    source_dataset: doc.source_dataset ?? "",
    language: doc.language ?? "",
    semantic_unit: doc.semantic_unit ?? "",
    hierarchy_path: doc.hierarchy_path ?? "",
    is_retrievable: doc.is_retrievable === true,
    text_len: doc.text_len ?? 0,
    law_number: doc.law_number ?? undefined,
    law_year: doc.law_year ?? undefined,
    appeal_number: doc.appeal_number ?? undefined,
    judicial_year: doc.judicial_year ?? undefined,
    ruling_date: doc.ruling_date ?? undefined,
    case_subject: doc.case_subject ?? undefined,
    child_index: typeof doc.child_index === "number" ? doc.child_index : undefined,
    parent_chunk_id: doc.parent_chunk_id ?? undefined,
    ...(similarity_score !== undefined ? { similarity_score } : {}),
    authorityId: doc.authorityId ?? undefined,
    authorityTitleOfficial: doc.authorityTitleOfficial ?? undefined,
    authorityTitleNormalized: doc.authorityTitleNormalized ?? undefined,
    jurisdiction: doc.jurisdiction ?? "EG",
    authorityType: doc.authorityType ?? undefined,
    authorityStatus: doc.authorityStatus ?? undefined,
    effectiveFrom: doc.effectiveFrom ?? undefined,
    effectiveTo: doc.effectiveTo ?? undefined,
    textStatus: doc.textStatus ?? undefined,
    officialSourceUrl: doc.officialSourceUrl ?? undefined,
    reviewStatus: doc.reviewStatus ?? undefined,
    reviewedBy: doc.reviewedBy ?? undefined,
    reviewedAt: doc.reviewedAt ?? undefined,
    corpusReleaseId: doc.corpusReleaseId ?? undefined,
  };
}
