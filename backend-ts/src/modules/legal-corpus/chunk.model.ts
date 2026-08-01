import mongoose from "mongoose";
import { ragConnection } from "../../services/mongo.service";

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
    authorityId: { type: String },
    authorityTitleOfficial: { type: String },
    authorityTitleNormalized: { type: String },
    jurisdiction: { type: String },
    authorityType: {
      type: String,
      enum: [
        "constitution",
        "statute",
        "regulation",
        "court_ruling",
        "official_guidance",
        "secondary_source",
        "generated_summary",
      ],
    },
    authorityStatus: {
      type: String,
      enum: ["effective", "amended", "repealed", "historical", "unknown"],
    },
    effectiveFrom: { type: String },
    effectiveTo: { type: String },
    textStatus: {
      type: String,
      enum: ["verbatim", "extracted", "summary", "unknown"],
    },
    officialSourceUrl: { type: String },
    reviewStatus: {
      type: String,
      enum: ["draft", "reviewed", "published", "quarantined"],
    },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    corpusReleaseId: { type: String },
    consolidatedThrough: { type: String },
    sourceTextHash: { type: String },
    sourceReferences: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    verificationMethod: { type: String },
    provenanceStatus: { type: String },
    embeddingModel: { type: String },
    embeddingDim: { type: Number },
    embeddingContentHash: { type: String },
    embeddingUpdatedAt: { type: Date },
    embeddingWasTruncated: { type: Boolean },
    embeddingSourceCharacterCount: { type: Number },
    embedding: { type: [Number] },
  },
  { collection: COLLECTION_NAME, strict: false },
);

export type ChunkDocument = mongoose.InferSchemaType<typeof chunkSchema> & {
  _id: mongoose.Types.ObjectId;
  score?: number;
};

export const ChunkModel = ragConnection.model<ChunkDocument>("LegalChunk",chunkSchema);
