import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoService, ragConnection } from "../services/mongo.service";
import { isDryRun } from "./script-utils";

type Article = { articleNumber: string; text: string };
type SourceReference = { kind: string; url: string };
type LawArtifact = {
  authorityId: string;
  authorityTitleOfficial: string;
  authorityTitleNormalized: string;
  lawNumber: string;
  lawYear: string;
  lawCategory: string;
  status: "amended";
  effectiveFrom?: string;
  consolidatedThrough: string;
  officialSourceUrl: string;
  sources: SourceReference[];
  articles: Article[];
};

const RELEASE_ID = "eg-current-laws-2026-07-30-v1";
const REVIEWED_AT = new Date("2026-07-30T00:00:00.000Z");
const INPUTS = [
  {
    path: resolve(process.cwd(), "corpus", "official", "eg-law-148-2019-social-insurance.json"),
    expectedCount: 170,
    sourceFile: "eg-law-148-2019-social-insurance.pdf",
    sourceDataset: "egyptian-social-insurance-consolidated",
  },
  {
    path: resolve(process.cwd(), "corpus", "official", "eg-law-182-2018-public-contracts.json"),
    expectedCount: 94,
    sourceFile: "eg-law-182-2018-public-contracts.pdf",
    sourceDataset: "egyptian-public-contracts-consolidated",
  },
] as const;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const readArtifact = async (path: string): Promise<LawArtifact> =>
  JSON.parse(await readFile(path, "utf8")) as LawArtifact;

const validateArtifact = (artifact: LawArtifact, expectedCount: number): void => {
  if (artifact.articles.length !== expectedCount) {
    throw new Error(
      artifact.authorityId + ": expected " + expectedCount + " articles, found " +
        artifact.articles.length + ".",
    );
  }
  const uniqueNumbers = new Set(artifact.articles.map(({ articleNumber }) => articleNumber));
  if (uniqueNumbers.size !== artifact.articles.length) {
    throw new Error(artifact.authorityId + ": duplicate article numbers detected.");
  }
  const shortArticles = artifact.articles.filter(({ text }) => text.trim().length < 25);
  if (shortArticles.length > 0) {
    throw new Error(
      artifact.authorityId + ": suspiciously short articles: " +
        shortArticles.map(({ articleNumber }) => articleNumber).join(", ") + ".",
    );
  }
};

const run = async (): Promise<void> => {
  const dryRun = isDryRun() || !process.argv.includes("--apply");
  const loaded = await Promise.all(
    INPUTS.map(async (input) => ({ ...input, artifact: await readArtifact(input.path) })),
  );
  for (const { artifact, expectedCount } of loaded) {
    validateArtifact(artifact, expectedCount);
  }

  const documents = loaded.flatMap(({ artifact, sourceFile, sourceDataset }) =>
    artifact.articles.map(({ articleNumber, text: body }) => {
      const articleKey = artifact.authorityId + ":article:" + articleNumber;
      const chunkId = sha256(articleKey).slice(0, 32);
      const text = "مادة (" + articleNumber + "):\n" + body.trim();
      return {
        chunk_id: chunkId,
        document_id: artifact.authorityId,
        parent_chunk_id: chunkId,
        child_index: -1,
        text,
        embedding_text: text,
        law_name: artifact.authorityTitleOfficial,
        law_name_normalized: artifact.authorityTitleNormalized,
        law_category: artifact.lawCategory,
        article_number: articleNumber,
        law_number: artifact.lawNumber,
        law_year: artifact.lawYear,
        semantic_unit: "article",
        hierarchy_path: artifact.authorityTitleOfficial + " > المادة " + articleNumber,
        source_dataset: sourceDataset,
        language: "ar",
        source_file: sourceFile,
        text_len: text.length,
        is_retrievable: true,
        authorityId: artifact.authorityId,
        authorityTitleOfficial: artifact.authorityTitleOfficial,
        authorityTitleNormalized: artifact.authorityTitleNormalized,
        jurisdiction: "EG",
        authorityType: "statute",
        authorityStatus: artifact.status,
        ...(artifact.effectiveFrom ? { effectiveFrom: artifact.effectiveFrom } : {}),
        textStatus: "extracted",
        officialSourceUrl: artifact.officialSourceUrl,
        reviewStatus: "published",
        reviewedBy: "codex-official-source-structure-check",
        reviewedAt: REVIEWED_AT,
        corpusReleaseId: RELEASE_ID,
        consolidatedThrough: artifact.consolidatedThrough,
        sourceReferences: artifact.sources,
        sourceTextHash: sha256(text),
        verificationMethod:
          "Base law structure checked against the cited PDF; readable article transcription consolidated with the cited amending laws.",
      };
    }),
  );

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun,
      releaseId: RELEASE_ID,
      totalArticles: documents.length,
      laws: loaded.map(({ artifact, path }) => ({
        authorityId: artifact.authorityId,
        inputPath: path,
        articleCount: artifact.articles.length,
        consolidatedThrough: artifact.consolidatedThrough,
      })),
    }, null, 2));
    return;
  }

  const mongo = new MongoService();
  await mongo.connect();
  try {
    const chunks = ragConnection.db!.collection("legal_chunks");
    const chunkIds = documents.map(({ chunk_id }) => chunk_id);
    const existing = await chunks.find(
      { chunk_id: { $in: chunkIds } },
      { projection: { chunk_id: 1, sourceTextHash: 1 } },
    ).toArray();
    const existingById = new Map(
      existing.map((document) => [String(document.chunk_id), document.sourceTextHash]),
    );
    const result = await chunks.bulkWrite(documents.map((document) => {
      const changed = existingById.has(document.chunk_id) &&
        existingById.get(document.chunk_id) !== document.sourceTextHash;
      return {
        updateOne: {
          filter: { chunk_id: document.chunk_id },
          update: {
            $set: document,
            ...(changed ? { $unset: {
              embedding: "",
              embeddingModel: "",
              embeddingDim: "",
              embeddingContentHash: "",
              embeddingUpdatedAt: "",
            } } : {}),
          },
          upsert: true,
        },
      };
    }), { ordered: false });

    const storedByLaw = await Promise.all(loaded.map(async ({ artifact }) => ({
      authorityId: artifact.authorityId,
      stored: await chunks.countDocuments({
        authorityId: artifact.authorityId,
        reviewStatus: "published",
        is_retrievable: true,
      }),
    })));
    console.log(JSON.stringify({
      dryRun,
      database: ragConnection.db!.databaseName,
      collection: "legal_chunks",
      releaseId: RELEASE_ID,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
      storedByLaw,
    }, null, 2));
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    "import:updated-social-procurement-laws failed: " +
      (error instanceof Error ? error.message : "unknown error"),
  );
  process.exitCode = 1;
});
