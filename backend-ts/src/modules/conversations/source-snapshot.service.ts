import type { LegalChunks } from "../../schemas";
import type { SourceSnapshot } from "./conversation.types";

const optionalNumber = (
  record: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

export class SourceSnapshotService {
  create(chunks: LegalChunks[]): SourceSnapshot[] {
    const retrievedAt = new Date();
    return chunks.map((chunk, index) => {
      const record = chunk as unknown as Record<string, unknown>;
      return {
        sourceId: `S${index + 1}`,
        chunkId: chunk.chunk_id,
        authorityId: chunk.authorityId,
        authorityTitleOfficial: chunk.authorityTitleOfficial,
        authorityType: chunk.authorityType,
        jurisdiction: chunk.jurisdiction,
        authorityStatus: chunk.authorityStatus,
        articleNumber: chunk.article_number,
        lawNumber: chunk.law_number,
        lawYear: chunk.law_year,
        appealNumber: chunk.appeal_number,
        judicialYear: chunk.judicial_year,
        rulingDate: chunk.ruling_date,
        sourceDataset: chunk.source_dataset || undefined,
        sourceFile: chunk.source_file,
        officialSourceUrl: chunk.officialSourceUrl,
        excerpt: chunk.content,
        retrievalScore:
          optionalNumber(record, "similarity_score") ??
          optionalNumber(record, "rrf_score"),
        rerankScore: chunk.rerank_score,
        corpusReleaseId: chunk.corpusReleaseId,
        retrievedAt,
      };
    });
  }
}
