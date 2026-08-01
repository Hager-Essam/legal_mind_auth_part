import { createHash } from "node:crypto";
import { env } from "../config/env";
import { EmbeddingService } from "../services/embedding.service";
import { MongoService, ragConnection } from "../services/mongo.service";
import { ProviderConfigService } from "../infrastructure/provider/provider-config.service";
import { isDryRun } from "./script-utils";

const conservativeMode = process.argv.includes("--conservative");
const BATCH_SIZE = conservativeMode ? 1 : 10;
const MAX_EMBEDDING_CHARACTERS = conservativeMode ? 4_000 : 8_000;
const EMBEDDING_OMISSION_MARKER = "\n[...middle omitted for embedding...]\n";
const toEmbeddingText = (text: string): string => {
  if (text.length <= MAX_EMBEDDING_CHARACTERS) return text;
  const remaining = MAX_EMBEDDING_CHARACTERS - EMBEDDING_OMISSION_MARKER.length;
  const headLength = Math.ceil(remaining / 2);
  return text.slice(0, headLength) + EMBEDDING_OMISSION_MARKER + text.slice(-(remaining - headLength));
};
type Chunk = { _id: unknown; chunk_id?: string; text?: string };
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const run = async (): Promise<void> => {
  const dryRun = isDryRun() || !process.argv.includes("--apply");
  const includeUnpublished = process.argv.includes("--include-unpublished");
  if (includeUnpublished && !process.argv.includes("--allow-unverified")) {
    throw new Error("--include-unpublished requires --allow-unverified.");
  }
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const chunks = ragConnection.db!.collection("legal_chunks");
    const filter: Record<string, unknown> = {
      text: { $type: "string", $ne: "" },
      ...(includeUnpublished ? {} : { jurisdiction: "EG", reviewStatus: "published",
        authorityStatus: { $in: ["effective", "amended", "unknown"] }, is_retrievable: true }),
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $not: { $type: "array" } } },
        { embeddingDim: { $ne: env.embeddingDim } }, { embeddingModel: { $nin: [env.embeddingModel, "legacy-unknown-1024"] } },
      ],
    };
    const eligibleFilter = includeUnpublished ? { text: { $type: "string", $ne: "" } } : {
      text: { $type: "string", $ne: "" }, jurisdiction: "EG", reviewStatus: "published",
      authorityStatus: { $in: ["effective", "amended", "unknown"] }, is_retrievable: true,
    };
    const eligibleCount = await chunks.countDocuments(eligibleFilter);
    const totalCandidates = eligibleCount === 0 ? 0 : await chunks.countDocuments(filter);
    if (dryRun) {
      console.log(JSON.stringify({ dryRun, database: ragConnection.db!.databaseName,
        collection: "legal_chunks", totalCandidates,
        scope: includeUnpublished ? "unpublished explicitly allowed" : "published current Egyptian sources only",
        embeddingModel: env.embeddingModel, embeddingDim: env.embeddingDim }, null, 2));
      return;
    }
    const service = new EmbeddingService(new ProviderConfigService());
    const cursor = chunks.find(filter, { projection: { chunk_id: 1, text: 1 } });
    let updated = 0; let failed = 0; let nextProgress = 100;
    const batches: Chunk[][] = [];
    let batch: Chunk[] = [];
    for await (const rawChunk of cursor) {
      batch.push(rawChunk as unknown as Chunk);
      if (batch.length >= BATCH_SIZE) { batches.push(batch); batch = []; }
    }
    if (batch.length > 0) batches.push(batch);

    let nextBatch = 0;
    const processBatch = async (current: Chunk[]): Promise<void> => {
      const sourceTexts = current.map((chunk) => chunk.text?.trim() ?? "");
      const texts = sourceTexts.map(toEmbeddingText);
      try {
        const embeddings = await service.embedDocuments(texts);
        await chunks.bulkWrite(current.map((chunk, index) => ({ updateOne: {
          filter: { _id: chunk._id as never }, update: { $set: { embedding: embeddings[index],
            embeddingModel: env.embeddingModel, embeddingDim: env.embeddingDim,
            embeddingContentHash: sha256(texts[index] ?? ""), embeddingUpdatedAt: new Date(),
            embedding_text: texts[index],
            embeddingWasTruncated: (sourceTexts[index]?.length ?? 0) > (texts[index]?.length ?? 0),
            embeddingSourceCharacterCount: sourceTexts[index]?.length ?? 0 } },
        } })), { ordered: false });
        updated += current.length;
        while (updated >= nextProgress) {
          console.log(`reembed progress ${updated}/${totalCandidates}`);
          nextProgress += 100;
        }
      } catch (error) {
        if (current.length > 1) {
          const middle = Math.ceil(current.length / 2);
          await processBatch(current.slice(0, middle));
          await processBatch(current.slice(middle));
          return;
        }
        failed += 1;
        console.error("Embedding failed for " + (current[0]?.chunk_id ?? String(current[0]?._id)) + ": " + (error instanceof Error ? error.message : "unknown error"));
      }
    };
    const workers = Array.from({ length: Math.min(conservativeMode ? 1 : 2, batches.length) }, async () => {
      while (true) {
        const index = nextBatch; nextBatch += 1;
        const current = batches[index];
        if (!current) return;
        await processBatch(current);
      }
    });
    await Promise.all(workers);
    console.log(JSON.stringify({ dryRun, totalCandidates, updated, failed,
      embeddingModel: env.embeddingModel, embeddingDim: env.embeddingDim }, null, 2));
    if (failed > 0) process.exitCode = 1;
  } finally { await mongo.close(); }
};

run().catch((error) => {
  console.error("reembed:legal-chunks failed: " + (error instanceof Error ? error.message : "unknown error"));
  process.exitCode = 1;
});
