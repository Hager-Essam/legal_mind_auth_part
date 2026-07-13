import mongoose from "mongoose";
import { env } from "../config/env";
import type { LegalChunks, QueryRequest } from "../schemas";
import {
  parseLegalReference,
  type ParsedLegalReference,
} from "../utils/legal-ref-parser";
import { normalizeLawName } from "../utils/arabic-normalize";
import { reciprocalRankFusion } from "../utils/rrf";
import { escapeRegex } from "../utils/regex";
import { EmbeddingService } from "./embedding.service";
import { ChunkModel, type ChunkDocument } from "../models/chunk.model";
import { toLegalChunk } from "../utils/chunk-mapper";
import type { SearchOptions } from "../types/search.types";

const VECTOR_INDEX_NAME = "legal_chunks_vector";
const ATLAS_SEARCH_INDEX_NAME = "legal_chunks_text";

// Maximum characters of parent text passed to the LLM per chunk.
// Keeps 5 expanded chunks within ~5 000 tokens — safe for both qwen-turbo (8 K)
// and qwen-plus (32 K).  Raise this if you switch to a larger-context model.
const MAX_PARENT_CHARS = 4000;

// ── Context window helper ─────────────────────────────────────────────────────
// Extracts up to `maxChars` from `parentText` centred on where `childText`
// appears.  If the child text cannot be located the first `maxChars` chars are
// returned instead.  Ellipsis markers are added when text is trimmed.
function extractContextWindow(
  parentText: string,
  childText: string,
  maxChars: number,
): string {
  if (parentText.length <= maxChars) return parentText;

  // Use the first 120 chars of the child as a search probe
  const probe = childText.slice(0, 120).trim();
  const matchIdx = probe.length > 0 ? parentText.indexOf(probe) : -1;

  if (matchIdx === -1) {
    // Child position unknown — return the head of the parent
    return parentText.slice(0, maxChars) + " …";
  }

  // Centre the window on the matched child
  const half = Math.floor(maxChars / 2);
  let start = Math.max(0, matchIdx - half);
  let end = Math.min(parentText.length, start + maxChars);

  // If end was clamped (match near the tail of the parent), slide start back
  // to fill the full maxChars window instead of returning a short slice.
  if (end - start < maxChars) {
    start = Math.max(0, end - maxChars);
  }

  const prefix = start > 0 ? "… " : "";
  const suffix = end < parentText.length ? " …" : "";
  return prefix + parentText.slice(start, end) + suffix;
}

export class RetrievalService {
  constructor(private readonly embeddingService: EmbeddingService) {}

  // ── Main entry point ───────────────────────────────────────────────────────

  async retrieveCandidateChunks(
    request: QueryRequest,
    parsedRef?: ParsedLegalReference,
  ): Promise<LegalChunks[]> {
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
      return (await this.vectorSearch(queryVector, opts)).map((d) =>
        toLegalChunk(d, d.score),
      );
    }

    const [vectorDocs, keywordDocs] = await Promise.all([
      this.vectorSearch(queryVector, opts),
      this.textSearch(request.query, opts).catch(
        () => [] as (ChunkDocument & { score?: number })[],
      ),
    ]);

    const vectorResults = vectorDocs.map((d) => toLegalChunk(d, d.score));
    const keywordResults = keywordDocs.map((d) => toLegalChunk(d, d.score));

    if (keywordResults.length === 0) return vectorResults;
    return reciprocalRankFusion([vectorResults, keywordResults], env.rrfK);
  }

  // ── Exact law article lookup ───────────────────────────────────────────────

  async findByArticle(
    parsedRef?: ParsedLegalReference,
  ): Promise<(ChunkDocument & { _children: ChunkDocument[] }) | null> {
    // RULE: exact lookup requires BOTH article_number AND law_name.
    // Caller already guards this, but we keep it here as a safety net.
    // No law_name → no exact match; prevents returning a random law's Article N.
    const articleNumber = parsedRef?.articleNumber;
    const lawName = parsedRef?.lawName;
    if (!articleNumber || !lawName) return null;

    const normName = normalizeLawName(lawName);
    const words = normName.split(/\s+/).filter((w: string) => w.length > 1);
    // If normalization produced no usable words (e.g. single-char input), we
    // cannot build a meaningful regex — fall through to RAG instead of matching
    // every document with an empty pattern.
    if (words.length === 0) return null;
    const nameRegex = words.map((w: string) => escapeRegex(w)).join(".*");

    const filter: Record<string, unknown> = {
      article_number: articleNumber,
      // Match on law_name_normalized (orthographically normalized) so variants
      // like القانون المدنى vs القانون المدني (ى/ي) actually match.
      law_name_normalized: { $regex: nameRegex, $options: "i" },
      // PARENTS ONLY: atomic (child_index:-1) and restored split parents
      // (child_index:-1). Children have child_index >= 0 and are excluded.
      child_index: { $in: [-1, null] },
    };
    // Bonus precision: if the query parser also extracted law_number/law_year,
    // add them as EXACT filters on the dedicated fields.
    if (parsedRef?.lawNumber) filter.law_number = parsedRef.lawNumber;
    if (parsedRef?.lawYear) filter.law_year = parsedRef.lawYear;

    // NOTE: is_retrievable is intentionally NOT filtered. Restored split parents
    // are is_retrievable:false but hold the FULL article text we want for an
    // exact match. Filtering by is_retrievable:true would exclude them and
    // break every split article.

    // Prefer the longest (fullest) matching chunk = the parent (full article).
    // If embedding is null → Type 2 (restored split parent).
    // If embedding is set → Type 1 (atomic original).
    const parent = await ChunkModel.findOne(filter)
      .sort({ text_len: -1 })
      .lean();
    if (!parent) return null;

    // Attach this parent's children as supplementary source chunks. The parent
    // is the concatenation/superset of its children, so no text is lost;
    // children give precise fragment-level citations.
    const children = await ChunkModel.find({
      parent_chunk_id: parent.chunk_id,
      child_index: { $gte: 0 },
      is_retrievable: true,
    }).lean();

    return { ...parent, _children: children };
  }

  // ── Exact court ruling lookup ──────────────────────────────────────────────

  async findByAppeal(
    appealNumber: string,
    judicialYear?: string | null,
  ): Promise<(ChunkDocument & { _children: ChunkDocument[] }) | null> {
    // appeal_number + judicial_year already uniquely identifies one ruling —
    // no regex or normalization needed (numbers are normalized at ingestion).
    const filter: Record<string, unknown> = {
      appeal_number: appealNumber,
      // PARENTS ONLY: same logic as findByArticle.
      // Restored split parents have child_index=-1 and is_retrievable=false.
      // Filtering is_retrievable:true would exclude them and return a fragment.
      child_index: { $in: [-1, null] },
    };
    if (judicialYear) filter.judicial_year = judicialYear;

    // Take the longest matching chunk — the parent always has more text
    // than any of its children.
    const parent = await ChunkModel.findOne(filter)
      .sort({ text_len: -1 })
      .lean();
    if (!parent) return null;

    // Attach children as fragment-level citations (same pattern as findByArticle).
    const children = await ChunkModel.find({
      parent_chunk_id: parent.chunk_id,
      child_index: { $gte: 0 },
      is_retrievable: true,
    }).lean();

    return { ...parent, _children: children };
  }

  // ── Vector search ──────────────────────────────────────────────────────────
  // Vector index filter fields: is_retrievable, law_category,
  //                             law_number, law_year, appeal_number, judicial_year

  async vectorSearch(
    queryVector: number[],
    options: SearchOptions = {},): Promise<(ChunkDocument & { score?: number })[]> {
    if (queryVector.length === 0) return [];

    const topK = options.topK ?? env.retrievalTopK;

    const filter: Record<string, unknown> = { is_retrievable: { $eq: true } };
    if (options.lawCategory) filter.law_category = { $eq: options.lawCategory };
    if (options.lawNumber) filter.law_number = { $eq: options.lawNumber };
    if (options.lawYear) filter.law_year = { $eq: options.lawYear };
    if (options.appealNumber)
      filter.appeal_number = { $eq: options.appealNumber };
    if (options.judicialYear)
      filter.judicial_year = { $eq: options.judicialYear };

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

  // ── Atlas text search ──────────────────────────────────────────────────────
  // Text index fields:
  //   text                → lucene.arabic  (boost 1.5)
  //   law_name_normalized → lucene.arabic  (boost 2.0)
  //   case_subject        → lucene.arabic  (boost 1.8)
  //   law_category        → token  (filter)
  //   law_number          → token  (filter)
  //   law_year            → token  (filter)
  //   appeal_number       → token  (filter)
  //   judicial_year       → token  (filter)
  //   is_retrievable      → boolean (filter)

  async textSearch(
    query: string,
    options: SearchOptions = {},
  ): Promise<(ChunkDocument & { score?: number })[]> {
    const topK = options.topK ?? env.sparseTopK;

    const mustClauses: object[] = [
      { equals: { path: "is_retrievable", value: true } },
    ];
    if (options.lawCategory)
      mustClauses.push({
        phrase: { path: "law_category", query: options.lawCategory },
      });
    if (options.lawNumber)
      mustClauses.push({
        phrase: { path: "law_number", query: options.lawNumber },
      });
    if (options.lawYear)
      mustClauses.push({
        phrase: { path: "law_year", query: options.lawYear },
      });
    if (options.appealNumber)
      mustClauses.push({
        phrase: { path: "appeal_number", query: options.appealNumber },
      });
    if (options.judicialYear)
      mustClauses.push({
        phrase: { path: "judicial_year", query: options.judicialYear },
      });

    const pipeline: mongoose.PipelineStage[] = [
      {
        $search: {
          index: ATLAS_SEARCH_INDEX_NAME,
          compound: {
            must: mustClauses,
            should: [
              {
                text: { query, path: "text", score: { boost: { value: 1.5 } } },
              },
              {
                text: {
                  query,
                  path: "law_name_normalized",
                  score: { boost: { value: 2.0 } },
                },
              },
              {
                text: {
                  query,
                  path: "case_subject",
                  score: { boost: { value: 1.8 } },
                },
              },
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

  // ── Parent context expansion ───────────────────────────────────────────────
  // Called after reranking on the final top-K chunks.
  // For every child chunk (child_index >= 0) it fetches the restored parent doc
  // and replaces `content` with the full parent text so the LLM receives
  // complete context instead of a small fragment.
  // A single batched DB query is used regardless of how many children are present.

  async expandWithParentContext(chunks: LegalChunks[]): Promise<LegalChunks[]> {
    // Collect unique parent IDs from child chunks only
    const parentIds = [
      ...new Set(
        chunks
          .filter(
            (c) =>
              typeof c.child_index === "number" &&
              c.child_index >= 0 &&
              typeof c.parent_chunk_id === "string" &&
              c.parent_chunk_id.length > 0,
          )
          .map((c) => c.parent_chunk_id as string),
      ),
    ];

    if (parentIds.length === 0) return chunks; // no children — nothing to expand

    // Fetch all needed parents in one query (only text fields needed)
    const parents = await ChunkModel.find(
      { chunk_id: { $in: parentIds } },
      { chunk_id: 1, text: 1, text_len: 1 },
    ).lean();

    const parentMap = new Map(
      parents.map((p) => [p.chunk_id ?? "", p] as const),
    );

    return chunks.map((chunk) => {
      // Non-children pass through unchanged
      if (
        typeof chunk.child_index !== "number" ||
        chunk.child_index < 0 ||
        !chunk.parent_chunk_id
      ) {
        return chunk;
      }

      const parent = parentMap.get(chunk.parent_chunk_id);
      if (!parent?.text) return chunk; // parent not in DB — fall back to child text

      // For large parents, extract a window centred on the child's own text
      // so the LLM receives relevant surrounding context without being flooded.
      const contextText = extractContextWindow(
        parent.text,
        chunk.content,
        MAX_PARENT_CHARS,
      );

      return { ...chunk, content: contextText, text_len: contextText.length };
    });
  }
}
