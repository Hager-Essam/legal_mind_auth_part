import type { ChunkDocument } from "../models/chunk.model";
import type { LegalChunks } from "../schemas/chunk.schema";

// Maps a raw DB document into the API-facing LegalChunks shape.
// `score` is the search relevance score (vector/text) — when omitted the
// `similarity_score` field is left out (used for exact-match DB lookups that
// have no search score).

export function toLegalChunk(doc: ChunkDocument, score?: number): LegalChunks {
  const similarity_score =
    typeof score === "number" ? Number(score.toFixed(6)) : undefined;

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
    is_retrievable: doc.is_retrievable ?? true,
    text_len: doc.text_len ?? 0,
    law_number: doc.law_number ?? undefined,
    law_year: doc.law_year ?? undefined,
    appeal_number: doc.appeal_number ?? undefined,
    judicial_year: doc.judicial_year ?? undefined,
    ruling_date: doc.ruling_date ?? undefined,
    case_subject: doc.case_subject ?? undefined,
    child_index:
      typeof doc.child_index === "number" ? doc.child_index : undefined,
    parent_chunk_id: doc.parent_chunk_id ?? undefined,
    ...(similarity_score !== undefined ? { similarity_score } : {}),
  };
}
