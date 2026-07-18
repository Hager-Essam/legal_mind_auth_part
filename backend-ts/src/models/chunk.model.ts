import mongoose from "mongoose";

const COLLECTION_NAME = "legal_chunks";

const chunkSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────
    chunk_id: { type: String },
    document_id: { type: String },
    parent_chunk_id: { type: String },
    child_index: { type: Number },

    // ── Content ──────────────────────────────────────────────
    text: { type: String }, // main text field (NOT "content")
    embedding_text: { type: String }, // text used for embedding generation

    // ── Law metadata (all top-level, NOT nested in "metadata") ─
    law_name: { type: String },
    law_name_normalized: { type: String },
    law_category: { type: String },
    article_number: { type: String },
    law_number: { type: String },
    law_year: { type: String },

    // ── Court ruling metadata (النقض — extracted from text field) ──
    appeal_number: { type: String }, // رقم الطعن  e.g. "513"
    judicial_year: { type: String }, // السنة القضائية  e.g. "16"
    ruling_date: { type: String }, // تاريخ الحكم  e.g. "28-04-1974"
    case_subject: { type: String }, // الموضوع  e.g. "اختصاص"

    // ── Chunk metadata ───────────────────────────────────────
    semantic_unit: { type: String },
    hierarchy_path: { type: String },
    source_dataset: { type: String },
    language: { type: String },
    source_file: { type: String },
    text_len: { type: Number },

    // ── Retrieval flags ──────────────────────────────────────
    is_retrievable: { type: Boolean },

    // ── Vector ──────────────────────────────────────────────
    embedding: { type: [Number] },
  },
  {
    collection: COLLECTION_NAME,
    strict: false, // allow extra fields from the DB without stripping them
  },
);

export type ChunkDocument = mongoose.InferSchemaType<typeof chunkSchema> & {
  _id: mongoose.Types.ObjectId;
  score?: number;
};

export const ChunkModel = mongoose.model<ChunkDocument>(
  "LegalChunk",
  chunkSchema,
);
