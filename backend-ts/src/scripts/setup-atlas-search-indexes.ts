import { env } from "../config/env";
import { MongoService, ragConnection } from "../infrastructure/mongo/mongo.service";
import { isDryRun, printSummary } from "./script-utils";

const vectorDefinition = {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: env.embeddingDim,
      similarity: "cosine",
    },
    ...[
      "is_retrievable",
      "jurisdiction",
      "reviewStatus",
      "authorityStatus",
      "authorityType",
      "law_category",
      "law_number",
      "law_year",
      "appeal_number",
      "judicial_year",
    ].map((path) => ({ type: "filter", path })),
  ],
};

const textDefinition = {
  mappings: {
    dynamic: false,
    fields: {
      text: { type: "string", analyzer: "lucene.arabic" },
      authorityTitleOfficial: {
        type: "string",
        analyzer: "lucene.arabic",
      },
      authorityTitleNormalized: {
        type: "string",
        analyzer: "lucene.arabic",
      },
      law_name_normalized: {
        type: "string",
        analyzer: "lucene.arabic",
      },
      case_subject: { type: "string", analyzer: "lucene.arabic" },
      article_number: { type: "string" },
      is_retrievable: { type: "boolean" },
      jurisdiction: { type: "token" },
      reviewStatus: { type: "token" },
      authorityStatus: { type: "token" },
      authorityType: { type: "token" },
      law_category: { type: "token" },
      law_number: { type: "token" },
      law_year: { type: "token" },
      appeal_number: { type: "token" },
      judicial_year: { type: "token" },
    },
  },
};

const desired = [
  { name: "legal_chunks_vector", type: "vectorSearch", definition: vectorDefinition },
  { name: "legal_chunks_text", type: "search", definition: textDefinition },
];

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

const definitionsMatch = (actual: unknown, expected: unknown): boolean =>
  JSON.stringify(canonicalize(actual)) ===
  JSON.stringify(canonicalize(expected));

const run = async (): Promise<void> => {
  const dryRun = isDryRun();
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const existing = await ragConnection.db!
      .collection("legal_chunks")
      .aggregate([{ $listSearchIndexes: {} }])
      .toArray();
    let created = 0;
    let alreadyExists = 0;
    let updated = 0;
    let ready = 0;
    let pending = 0;
    for (const index of desired) {
      const current = existing.find((candidate) => candidate.name === index.name);
      if (current) {
        if (current.type && current.type !== index.type) {
          throw new Error(
            `Search index ${index.name} has incompatible type ${String(current.type)}; review and recreate it manually as ${index.type}.`,
          );
        }
        const actualDefinition =
          current.latestDefinition ?? current.definition;
        if (
          actualDefinition &&
          !definitionsMatch(actualDefinition, index.definition)
        ) {
          if (!dryRun) {
            await ragConnection.db!.command({
              updateSearchIndex: "legal_chunks",
              name: index.name,
              definition: index.definition,
            });
          }
          console.log(
            `${dryRun ? "would update" : "updated"} search index: ${index.name}`,
          );
          updated += 1;
        } else {
          console.log(`existing search index: ${index.name}`);
          alreadyExists += 1;
        }
        if (current.queryable === true || current.status === "READY") ready += 1;
        else pending += 1;
        continue;
      }
      if (!dryRun) {
        await ragConnection.db!.command({
          createSearchIndexes: "legal_chunks",
          indexes: [index],
        });
      }
      console.log(`${dryRun ? "would create" : "created"} search index: ${index.name}`);
      created += 1;
    }
    printSummary("atlas:indexes", {
      dryRun,
      created,
      updated,
      existing: alreadyExists,
      ready,
      pending,
      failed: 0,
    });
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    `atlas:indexes failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
