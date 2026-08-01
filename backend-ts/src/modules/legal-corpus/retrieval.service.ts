import mongoose from "mongoose";
import { env } from "../../config/env";
import type { LegalChunks } from "./chunk.schema";
import type { QueryRequest } from "../legal-query/query.schema";
import { parseLegalReference, type ParsedLegalReference } from "../legal-query/legal-ref-parser";
import { normalizeLawName } from "./arabic-normalize";
import { reciprocalRankFusion } from "./rrf";
import { escapeRegex } from "./regex";
import { EmbeddingService } from "../../infrastructure/embeddings/embedding.service";
import { ChunkModel, type ChunkDocument } from "./chunk.model";
import { toLegalChunk } from "./chunk-mapper";
import type { SearchOptions } from "./search.types";

const VECTOR_INDEX_NAME = "legal_chunks_vector";
const ATLAS_SEARCH_INDEX_NAME = "legal_chunks_text";
const MAX_PARENT_CHARS = 4000;
type CurrentAuthorityStatus = "effective" | "amended" | "unknown";
const CURRENT_AUTHORITY_STATUSES: CurrentAuthorityStatus[] = ["effective", "amended", "unknown"];
const mongoAuthorityEligibility: Record<string, unknown> = {
  $or: [
    { authorityStatus: { $in: CURRENT_AUTHORITY_STATUSES } },
    { authorityType: "court_ruling", authorityStatus: "historical" },
  ],
};
const vectorAuthorityEligibility = {
  $or: [
    { authorityStatus: { $in: CURRENT_AUTHORITY_STATUSES } },
    { authorityType: { $eq: "court_ruling" }, authorityStatus: { $eq: "historical" } },
  ],
};
const atlasSearchAuthorityEligibility = {
  compound: {
    should: [
      { in: { path: "authorityStatus", value: CURRENT_AUTHORITY_STATUSES } },
      { compound: { must: [
        { equals: { path: "authorityType", value: "court_ruling" } },
        { equals: { path: "authorityStatus", value: "historical" } },
      ] } },
    ],
    minimumShouldMatch: 1,
  },
} as const;

// Extracts up to `maxChars` from `parentText` centred on where `childText` appears
function extractContextWindow(parentText: string, childText: string, maxChars: number): string {
  if (parentText.length <= maxChars) return parentText;

  const probe = childText.slice(0, 120).trim();
  const matchIdx = probe.length > 0 ? parentText.indexOf(probe) : -1;

  if (matchIdx === -1) return parentText.slice(0, maxChars) + " …";

  const half = Math.floor(maxChars / 2);
  let start = Math.max(0, matchIdx - half);
  let end = Math.min(parentText.length, start + maxChars);

  if (end - start < maxChars) start = Math.max(0, end - maxChars);

  const prefix = start > 0 ? "… " : "";
  const suffix = end < parentText.length ? " …" : "";
  return prefix + parentText.slice(start, end) + suffix;
}

export class RetrievalService {
  constructor(private readonly embeddingService: EmbeddingService) {}

  async retrieveCandidateChunks(request: QueryRequest, parsedRef?: ParsedLegalReference): Promise<LegalChunks[]> {
    const ref = parsedRef ?? parseLegalReference(request.query);
    const queryVector = await this.embeddingService.embedQuery(request.query);
    const overfetch = Math.max(env.retrievalOverfetch, request.top_k * 3);

    const opts: SearchOptions = {
      topK: overfetch,
      lawCategory: request.law_category,
      lawNumber: ref.lawNumber ?? undefined,
      lawYear: ref.lawYear ?? undefined,
      appealNumber: ref.appealNumber ?? undefined,
      judicialYear: ref.judicialYear ?? undefined,
    };

    if (!env.enableHybridSearch) {
      return (await this.vectorSearch(queryVector, opts)).map((d) => toLegalChunk(d, d.score));
    }

    const [vectorDocs, keywordDocs] = await Promise.all([
      this.vectorSearch(queryVector, opts),
      this.textSearch(request.query, opts).catch(() => [] as (ChunkDocument & { score?: number })[]),
    ]);

    const vectorResults = vectorDocs.map((d) => toLegalChunk(d, d.score));
    const keywordResults = keywordDocs.map((d) => toLegalChunk(d, d.score));

    if (keywordResults.length === 0) return vectorResults;
    return reciprocalRankFusion([vectorResults, keywordResults], env.rrfK);
  }

  async findByArticle(parsedRef?: ParsedLegalReference): Promise<(ChunkDocument & { _children: ChunkDocument[] }) | null> {
    const articleNumber = parsedRef?.articleNumber;
    const lawName = parsedRef?.lawName;
    if (!articleNumber || !lawName) return null;

    const normName = normalizeLawName(lawName);
    const words = normName.split(/\s+/).filter((w: string) => w.length > 1);
    if (words.length === 0) return null;
    const nameRegex = words.map((w: string) => escapeRegex(w)).join(".*");

    const baseFilter: Record<string, unknown> = {
      article_number: articleNumber,
      child_index: { $in: [-1, null] },
      jurisdiction: "EG",
      is_retrievable: true,
      reviewStatus: "published",
      ...mongoAuthorityEligibility,
    };
    let parent = await ChunkModel.findOne({
      ...baseFilter,
      authorityTitleNormalized: normName,
    })
      .sort({ text_len: -1 })
      .lean();

    if (!parent && parsedRef?.lawNumber && parsedRef?.lawYear) {
      parent = await ChunkModel.findOne({
        ...baseFilter,
        law_number: parsedRef.lawNumber,
        law_year: parsedRef.lawYear,
      })
        .sort({ text_len: -1 })
        .lean();
    }

    if (!parent) {
      const candidates = await ChunkModel.find({
        ...baseFilter,
        authorityTitleNormalized: { $regex: nameRegex, $options: "i" },
      })
        .sort({ text_len: -1 })
        .limit(3)
        .lean();
      const authorities = new Set(
        candidates.map(
          (candidate) =>
            candidate.authorityId ?? candidate.authorityTitleOfficial,
        ),
      );
      if (authorities.size === 1) parent = candidates[0] ?? null;
    }
    if (!parent) return null;

    const children = await ChunkModel.find({
      parent_chunk_id: parent.chunk_id,
      child_index: { $gte: 0 },
      is_retrievable: true,
      jurisdiction: "EG",
      reviewStatus: "published",
      ...mongoAuthorityEligibility,
    })
      .sort({ child_index: 1 })
      .lean();

    return { ...parent, _children: children };
  }

  async findByAppeal(appealNumber: string, judicialYear?: string | null): Promise<(ChunkDocument & { _children: ChunkDocument[] }) | null> {
    const filter: Record<string, unknown> = {
      appeal_number: appealNumber,
      child_index: { $in: [-1, null] },
      jurisdiction: "EG",
      is_retrievable: true,
      reviewStatus: "published",
      ...mongoAuthorityEligibility,
    };
    if (judicialYear) filter.judicial_year = judicialYear;

    const parent = await ChunkModel.findOne(filter).sort({ text_len: -1 }).lean();
    if (!parent) return null;

    const children = await ChunkModel.find({
      parent_chunk_id: parent.chunk_id,
      child_index: { $gte: 0 },
      is_retrievable: true,
      jurisdiction: "EG",
      reviewStatus: "published",
      ...mongoAuthorityEligibility,
    })
      .sort({ child_index: 1 })
      .lean();

    return { ...parent, _children: children };
  }

  async vectorSearch(queryVector: number[], options: SearchOptions = {}): Promise<(ChunkDocument & { score?: number })[]> {
    if (queryVector.length === 0) return [];

    const topK = options.topK ?? env.retrievalTopK;
    const filter: Record<string, unknown> = {
      is_retrievable: { $eq: true },
      jurisdiction: { $eq: "EG" },
      reviewStatus: { $eq: "published" },
      ...vectorAuthorityEligibility,
    };

    if (options.lawCategory) filter.law_category = { $eq: options.lawCategory };
    if (options.lawNumber) filter.law_number = { $eq: options.lawNumber };
    if (options.lawYear) filter.law_year = { $eq: options.lawYear };
    if (options.appealNumber) filter.appeal_number = { $eq: options.appealNumber };
    if (options.judicialYear) filter.judicial_year = { $eq: options.judicialYear };

    const pipeline: mongoose.PipelineStage[] = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(topK * 10, 50),
          limit: topK,
          filter,
        },
      },
      { $addFields: { score: { $meta: "vectorSearchScore" } } },
    ];

    return ChunkModel.aggregate(pipeline);
  }

  async textSearch(query: string, options: SearchOptions = {}): Promise<(ChunkDocument & { score?: number })[]> {
    const topK = options.topK ?? env.sparseTopK;
    const mustClauses: object[] = [
      { equals: { path: "is_retrievable", value: true } },
      { equals: { path: "jurisdiction", value: "EG" } },
      { equals: { path: "reviewStatus", value: "published" } },
      atlasSearchAuthorityEligibility,
    ];

    if (options.lawCategory) mustClauses.push({ phrase: { path: "law_category", query: options.lawCategory } });
    if (options.lawNumber) mustClauses.push({ phrase: { path: "law_number", query: options.lawNumber } });
    if (options.lawYear) mustClauses.push({ phrase: { path: "law_year", query: options.lawYear } });
    if (options.appealNumber) mustClauses.push({ phrase: { path: "appeal_number", query: options.appealNumber } });
    if (options.judicialYear) mustClauses.push({ phrase: { path: "judicial_year", query: options.judicialYear } });

    const pipeline: mongoose.PipelineStage[] = [
      {
        $search: {
          index: ATLAS_SEARCH_INDEX_NAME,
          compound: {
            must: mustClauses,
            should: [
              { text: { query, path: "text", score: { boost: { value: 1.5 } } } },
              { text: { query, path: "law_name_normalized", score: { boost: { value: 2.0 } } } },
              { text: { query, path: "authorityTitleOfficial", score: { boost: { value: 2.2 } } } },
              { text: { query, path: "authorityTitleNormalized", score: { boost: { value: 2.0 } } } },
              { text: { query, path: "case_subject", score: { boost: { value: 1.8 } } } },
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      { $addFields: { score: { $meta: "searchScore" } } },
    ];

    pipeline.push({ $limit: topK });
    return ChunkModel.aggregate(pipeline);
  }

  async expandWithParentContext(chunks: LegalChunks[]): Promise<LegalChunks[]> {
    const parentIds = [
      ...new Set(
        chunks
          .filter((c) => typeof c.child_index === "number" && c.child_index >= 0 && typeof c.parent_chunk_id === "string" && c.parent_chunk_id.length > 0)
          .map((c) => c.parent_chunk_id as string),
      ),
    ];

    if (parentIds.length === 0) return chunks;

    const parents = await ChunkModel.find(
      { chunk_id: { $in: parentIds } },
      { chunk_id: 1, text: 1, text_len: 1 },
    ).lean();

    const parentMap = new Map(parents.map((p) => [p.chunk_id ?? "", p] as const));

    return chunks.map((chunk) => {
      if (typeof chunk.child_index !== "number" || chunk.child_index < 0 || !chunk.parent_chunk_id) return chunk;

      const parent = parentMap.get(chunk.parent_chunk_id);
      if (!parent?.text) return chunk;

      const contextText = extractContextWindow(parent.text, chunk.content, MAX_PARENT_CHARS);
      return { ...chunk, content: contextText, text_len: contextText.length };
    });
  }
}
