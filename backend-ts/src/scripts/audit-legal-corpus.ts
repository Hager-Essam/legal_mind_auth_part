import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { authorityStatusRegistry, matchesAuthorityEntry } from "../modules/legal-corpus/authority-status-registry";
import { MongoService, ragConnection } from "../infrastructure/mongo/mongo.service";

type Chunk = Record<string, unknown> & {
  embeddingDimension?: number; law_number?: unknown; law_year?: unknown;
  law_category?: unknown; law_name?: unknown; law_name_normalized?: unknown;
  article_number?: unknown;
};
type Group = {
  key: string; lawCategory: string; lawName: string; lawNumber: string;
  lawYear: string; sourceDataset: string; chunkCount: number;
  articles: Set<string>; missingEmbeddingCount: number; retrievableCount: number;
  registryIds: Set<string>;
};

const str = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const csv = (value: string | number): string => '"' + String(value).replace(/"/g, '""') + '"';
const sortedCounts = (values: Map<string, number>) => [...values]
  .map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);

const run = async (): Promise<void> => {
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const collection = ragConnection.db!.collection("legal_chunks");
    const cursor = collection.aggregate<Chunk>([{ $project: {
      chunk_id: 1, law_name: 1, law_name_normalized: 1, law_number: 1, law_year: 1,
      law_category: 1, article_number: 1, source_dataset: 1, source_file: 1,
      officialSourceUrl: 1, jurisdiction: 1, authorityId: 1, authorityTitleOfficial: 1,
      authorityStatus: 1, reviewStatus: 1, textStatus: 1, is_retrievable: 1,
      embeddingModel: 1,
      embeddingDimension: { $cond: [{ $isArray: "$embedding" }, { $size: "$embedding" }, 0] },
    } }]);

    const groups = new Map<string, Group>();
    const categories = new Map<string, number>();
    const datasets = new Map<string, number>();
    const registryCounts = new Map<string, number>();
    const dimensions = new Map<string, number>();
    const summary = {
      totalChunks: 0, retrievableChunks: 0, missingEmbedding: 0,
      missingEmbeddingProvenance: 0, missingJurisdiction: 0, missingAuthorityId: 0,
      missingOfficialTitle: 0, missingOfficialSource: 0, missingReviewStatus: 0,
      missingAuthorityStatus: 0, missingTextStatus: 0, registryMatchedChunks: 0,
      confirmedLegacyChunksToDisable: 0, nonEgyptianNameSignals: 0,
    };

    for await (const chunk of cursor) {
      summary.totalChunks += 1;
      if (chunk.is_retrievable === true) summary.retrievableChunks += 1;
      const dimension = typeof chunk.embeddingDimension === "number" ? chunk.embeddingDimension : 0;
      dimensions.set(String(dimension), (dimensions.get(String(dimension)) ?? 0) + 1);
      if (dimension === 0) summary.missingEmbedding += 1;
      if (dimension > 0 && !str(chunk.embeddingModel)) summary.missingEmbeddingProvenance += 1;
      if (!str(chunk.jurisdiction)) summary.missingJurisdiction += 1;
      if (!str(chunk.authorityId)) summary.missingAuthorityId += 1;
      if (!str(chunk.authorityTitleOfficial)) summary.missingOfficialTitle += 1;
      if (!str(chunk.officialSourceUrl) && !str(chunk.source_file)) summary.missingOfficialSource += 1;
      if (!str(chunk.reviewStatus)) summary.missingReviewStatus += 1;
      if (!str(chunk.authorityStatus)) summary.missingAuthorityStatus += 1;
      if (!str(chunk.textStatus)) summary.missingTextStatus += 1;

      const lawCategory = str(chunk.law_category) || "(missing)";
      const lawName = str(chunk.law_name) || str(chunk.law_name_normalized) || "(missing)";
      const lawNumber = str(chunk.law_number);
      const lawYear = str(chunk.law_year);
      const sourceDataset = str(chunk.source_dataset) || "(missing)";
      const rawKey = [lawCategory, lawName, lawNumber, lawYear, sourceDataset].join("\u001f");
      let group = groups.get(rawKey);
      if (!group) {
        group = { key: createHash("sha256").update(rawKey).digest("hex").slice(0, 16), lawCategory, lawName, lawNumber, lawYear, sourceDataset, chunkCount: 0, articles: new Set(), missingEmbeddingCount: 0, retrievableCount: 0, registryIds: new Set() };
        groups.set(rawKey, group);
      }
      group.chunkCount += 1;
      if (str(chunk.article_number)) group.articles.add(str(chunk.article_number));
      if (dimension === 0) group.missingEmbeddingCount += 1;
      if (chunk.is_retrievable === true) group.retrievableCount += 1;
      categories.set(lawCategory, (categories.get(lawCategory) ?? 0) + 1);
      datasets.set(sourceDataset, (datasets.get(sourceDataset) ?? 0) + 1);
      if (/السعودي|السعودية|المملكة العربية السعودية|الكويتي|الإماراتي|الاماراتي/i.test(lawName)) summary.nonEgyptianNameSignals += 1;

      for (const entry of authorityStatusRegistry) {
        if (!matchesAuthorityEntry(chunk, entry)) continue;
        summary.registryMatchedChunks += 1;
        if (entry.safeToDisableLegacyRetrieval) summary.confirmedLegacyChunksToDisable += 1;
        group.registryIds.add(entry.authorityId);
        registryCounts.set(entry.authorityId, (registryCounts.get(entry.authorityId) ?? 0) + 1);
      }
    }

    const authorityGroups = [...groups.values()]
      .sort((a, b) => b.chunkCount - a.chunkCount || a.lawCategory.localeCompare(b.lawCategory, "ar"))
      .map((g) => ({ key: g.key, lawCategory: g.lawCategory, lawName: g.lawName,
        lawNumber: g.lawNumber, lawYear: g.lawYear, sourceDataset: g.sourceDataset,
        chunkCount: g.chunkCount, distinctArticleCount: g.articles.size,
        missingEmbeddingCount: g.missingEmbeddingCount, retrievableCount: g.retrievableCount,
        registryAuthorityIds: [...g.registryIds] }));
    const report = {
      generatedAt: new Date().toISOString(), database: ragConnection.db!.databaseName,
      collection: "legal_chunks", summary: { ...summary, authorityGroupCount: authorityGroups.length },
      embeddingDimensions: sortedCounts(dimensions), sourceDatasets: sortedCounts(datasets),
      categories: sortedCounts(categories),
      confirmedAuthorityStatusMatches: authorityStatusRegistry.map((entry) => ({
        authorityId: entry.authorityId, title: entry.authorityTitleOfficial,
        status: entry.authorityStatus, replacedByAuthorityId: entry.replacedByAuthorityId,
        replacementEffectiveFrom: entry.replacementEffectiveFrom,
        matchedChunkCount: registryCounts.get(entry.authorityId) ?? 0,
        safeToDisableLegacyRetrieval: entry.safeToDisableLegacyRetrieval,
        evidence: entry.evidence, notes: entry.notes,
      })),
      authorityGroups,
      interpretation: {
        verifiedMeaning: "Authority status verified means an official source supports the status fact; it does not make each chunk verbatim, complete, or legally reviewed.",
        reembeddingMeaning: "Embedding regenerates a search vector; it does not update legal text or confer verification.",
        publicationRule: "Only current consolidated text checked against an official source should receive reviewStatus=published and is_retrievable=true.",
      },
    };
    const outputDir = resolve(process.cwd(), "reports");
    const date = new Date().toISOString().slice(0, 10);
    const jsonPath = resolve(outputDir, "legal-corpus-audit-" + date + ".json");
    const csvPath = resolve(outputDir, "legal-corpus-authorities-" + date + ".csv");
    const headers = ["group_key","law_category","law_name","law_number","law_year","source_dataset","chunk_count","distinct_article_count","missing_embedding_count","retrievable_count","registry_authority_ids"];
    const lines = [headers.map(csv).join(","), ...authorityGroups.map((g) => [g.key,g.lawCategory,g.lawName,g.lawNumber,g.lawYear,g.sourceDataset,g.chunkCount,g.distinctArticleCount,g.missingEmbeddingCount,g.retrievableCount,g.registryAuthorityIds.join("|")].map(csv).join(","))];
    await mkdir(outputDir, { recursive: true });
    await Promise.all([writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8"), writeFile(csvPath, lines.join("\n") + "\n", "utf8")]);
    console.log(JSON.stringify({ ...report.summary, jsonPath, csvPath }, null, 2));
  } finally { await mongo.close(); }
};

run().catch((error) => {
  console.error("audit:legal-corpus failed: " + (error instanceof Error ? error.message : "unknown error"));
  process.exitCode = 1;
});
