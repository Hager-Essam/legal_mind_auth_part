import mongoose from "mongoose";

const COLLECTION_NAME = "legal_chunks";

const chunkSchema = new mongoose.Schema(
  {
    chunk_id: { type: String },
    document_id: { type: String },
    parent_chunk_id: { type: String },
    child_index: { type: Number },
    text: { type: String },
    embedding_text: { type: String },
    law_name: { type: String },
    law_name_normalized: { type: String },
    law_category: { type: String },
    article_number: { type: String },
    law_number: { type: String },
    law_year: { type: String },
    appeal_number: { type: String },
    judicial_year: { type: String },
    ruling_date: { type: String },
    case_subject: { type: String },
    semantic_unit: { type: String },
    hierarchy_path: { type: String },
    source_dataset: { type: String },
    language: { type: String },
    source_file: { type: String },
    text_len: { type: Number },
    is_retrievable: { type: Boolean },
    embedding: { type: [Number] },
  },
  { collection: COLLECTION_NAME, strict: false },
);

export type ChunkDocument = mongoose.InferSchemaType<typeof chunkSchema> & {
  _id: mongoose.Types.ObjectId;
  score?: number;
};

export const ChunkModel = mongoose.model<ChunkDocument>("LegalChunk", chunkSchema);
