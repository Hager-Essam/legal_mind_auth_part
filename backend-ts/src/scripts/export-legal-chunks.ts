import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoService, ragConnection } from "../infrastructure/mongo/mongo.service";

const CHUNKS_PER_FILE = 500;
const OUTPUT_DIR = "exports";

const format = (process.argv.find((a) => a === "--format" || a === "-f")
  ? process.argv[process.argv.indexOf("--format") + 1] ?? "jsonl"
  : "jsonl") as "json" | "jsonl";

type ChunkExport = {
  chunk_id: string;
  document_id?: string;
  parent_chunk_id?: string;
  child_index?: number;
  text?: string;
  embedding_text?: string;
  law_name?: string;
  law_name_normalized?: string;
  law_category?: string;
  article_number?: string;
  law_number?: string;
  law_year?: string;
  appeal_number?: string;
  judicial_year?: string;
  ruling_date?: string;
  case_subject?: string;
  semantic_unit?: string;
  hierarchy_path?: string;
  source_dataset?: string;
  language?: string;
  source_file?: string;
  text_len?: number;
  is_retrievable?: boolean;
  authorityId?: string;
  authorityTitleOfficial?: string;
  authorityTitleNormalized?: string;
  jurisdiction?: string;
  authorityType?: string;
  authorityStatus?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  textStatus?: string;
  officialSourceUrl?: string;
  reviewStatus?: string;
  corpusReleaseId?: string;
  consolidatedThrough?: string;
  embeddingModel?: string;
  embeddingDim?: number;
  embeddingUpdatedAt?: string;
  _id: string;
};

const pickFields = (doc: Record<string, unknown>): ChunkExport => {
  const d = doc as Record<string, unknown>;
  return {
    _id: String(d._id ?? ""),
    chunk_id: String(d.chunk_id ?? ""),
    document_id: d.document_id ? String(d.document_id) : undefined,
    parent_chunk_id: d.parent_chunk_id ? String(d.parent_chunk_id) : undefined,
    child_index: typeof d.child_index === "number" ? d.child_index : undefined,
    text: d.text ? String(d.text) : undefined,
    embedding_text: d.embedding_text ? String(d.embedding_text) : undefined,
    law_name: d.law_name ? String(d.law_name) : undefined,
    law_name_normalized: d.law_name_normalized ? String(d.law_name_normalized) : undefined,
    law_category: d.law_category ? String(d.law_category) : undefined,
    article_number: d.article_number ? String(d.article_number) : undefined,
    law_number: d.law_number ? String(d.law_number) : undefined,
    law_year: d.law_year ? String(d.law_year) : undefined,
    appeal_number: d.appeal_number ? String(d.appeal_number) : undefined,
    judicial_year: d.judicial_year ? String(d.judicial_year) : undefined,
    ruling_date: d.ruling_date ? String(d.ruling_date) : undefined,
    case_subject: d.case_subject ? String(d.case_subject) : undefined,
    semantic_unit: d.semantic_unit ? String(d.semantic_unit) : undefined,
    hierarchy_path: d.hierarchy_path ? String(d.hierarchy_path) : undefined,
    source_dataset: d.source_dataset ? String(d.source_dataset) : undefined,
    language: d.language ? String(d.language) : undefined,
    source_file: d.source_file ? String(d.source_file) : undefined,
    text_len: typeof d.text_len === "number" ? d.text_len : undefined,
    is_retrievable: typeof d.is_retrievable === "boolean" ? d.is_retrievable : undefined,
    authorityId: d.authorityId ? String(d.authorityId) : undefined,
    authorityTitleOfficial: d.authorityTitleOfficial ? String(d.authorityTitleOfficial) : undefined,
    authorityTitleNormalized: d.authorityTitleNormalized ? String(d.authorityTitleNormalized) : undefined,
    jurisdiction: d.jurisdiction ? String(d.jurisdiction) : undefined,
    authorityType: d.authorityType ? String(d.authorityType) : undefined,
    authorityStatus: d.authorityStatus ? String(d.authorityStatus) : undefined,
    effectiveFrom: d.effectiveFrom ? String(d.effectiveFrom) : undefined,
    effectiveTo: d.effectiveTo ? String(d.effectiveTo) : undefined,
    textStatus: d.textStatus ? String(d.textStatus) : undefined,
    officialSourceUrl: d.officialSourceUrl ? String(d.officialSourceUrl) : undefined,
    reviewStatus: d.reviewStatus ? String(d.reviewStatus) : undefined,
    corpusReleaseId: d.corpusReleaseId ? String(d.corpusReleaseId) : undefined,
    consolidatedThrough: d.consolidatedThrough ? String(d.consolidatedThrough) : undefined,
    embeddingModel: d.embeddingModel ? String(d.embeddingModel) : undefined,
    embeddingDim: typeof d.embeddingDim === "number" ? d.embeddingDim : undefined,
    embeddingUpdatedAt: d.embeddingUpdatedAt ? String(d.embeddingUpdatedAt) : undefined,
  };
};

const run = async (): Promise<void> => {
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const collection = ragConnection.db!.collection("legal_chunks");

    const totalChunks = await collection.countDocuments();
    console.log(`Total chunks in database: ${totalChunks}`);
    console.log(`Format: ${format.toUpperCase()}`);

    const totalFiles = Math.ceil(totalChunks / CHUNKS_PER_FILE);
    console.log(`Will export into ${totalFiles} files (${CHUNKS_PER_FILE} chunks each)\n`);

    const outputDir = resolve(process.cwd(), OUTPUT_DIR);
    await mkdir(outputDir, { recursive: true });

    const manifestFiles: { file: string; chunkCount: number; startId: string; endId: string }[] = [];
    let exported = 0;

    for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
      const skip = fileIndex * CHUNKS_PER_FILE;
      const cursor = collection
        .find({}, {
          projection: {
            embedding: 0,
            sourceReferences: 0,
            embeddingContentHash: 0,
            embeddingWasTruncated: 0,
            embeddingSourceCharacterCount: 0,
            sourceTextHash: 0,
            reviewedBy: 0,
            reviewedAt: 0,
            verificationMethod: 0,
            provenanceStatus: 0,
          },
        })
        .skip(skip)
        .limit(CHUNKS_PER_FILE);

      const chunks: ChunkExport[] = [];
      for await (const doc of cursor) {
        chunks.push(pickFields(doc as unknown as Record<string, unknown>));
      }

      if (chunks.length === 0) break;

      const ext = format === "jsonl" ? "jsonl" : "json";
      const fileName = `legal-chunks-${String(fileIndex + 1).padStart(3, "0")}.${ext}`;
      const filePath = resolve(outputDir, fileName);

      if (format === "jsonl") {
        const lines = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
        await writeFile(filePath, lines, "utf8");
      } else {
        const payload = {
          exportedAt: new Date().toISOString(),
          fileIndex: fileIndex + 1,
          totalFiles,
          chunkCount: chunks.length,
          chunks,
        };
        await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
      }

      manifestFiles.push({
        file: fileName,
        chunkCount: chunks.length,
        startId: chunks[0]?.chunk_id ?? "",
        endId: chunks[chunks.length - 1]?.chunk_id ?? "",
      });

      exported += chunks.length;
      console.log(`  [${fileIndex + 1}/${totalFiles}] ${fileName} — ${chunks.length} chunks`);
    }

    const manifest = {
      exportedAt: new Date().toISOString(),
      database: ragConnection.db!.databaseName,
      collection: "legal_chunks",
      format,
      totalChunks,
      totalFiles: manifestFiles.length,
      chunksPerFile: CHUNKS_PER_FILE,
      note: "Embedding vectors and internal tracking fields excluded to reduce file size.",
      files: manifestFiles,
    };

    const manifestPath = resolve(outputDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    console.log(`\nExport complete:`);
    console.log(`  Chunks exported: ${exported}`);
    console.log(`  Files created: ${manifestFiles.length}`);
    console.log(`  Format: ${format.toUpperCase()}`);
    console.log(`  Output directory: ${outputDir}`);
    console.log(`  Manifest: ${manifestPath}`);
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    "export-legal-chunks failed: " +
      (error instanceof Error ? error.message : "unknown error"),
  );
  process.exitCode = 1;
});
