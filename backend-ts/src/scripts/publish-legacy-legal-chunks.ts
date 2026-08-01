import { createHash } from "node:crypto";
import type { AnyBulkWriteOperation, Document } from "mongodb";
import { normalizeLawName } from "../modules/legal-corpus/arabic-normalize";
import { MongoService, ragConnection } from "../services/mongo.service";
import { isDryRun } from "./script-utils";

const RELEASE_ID = "eg-legacy-publication-2026-07-31-v1";
const REVIEWED_AT = new Date("2026-07-31T00:00:00.000Z");
const LEGACY_DATASETS = ["dataflare", "corporate_law"];
const BATCH_SIZE = 100;

type AuthorityGroup = {
  _id: {
    lawCategory: string | null;
    lawName: string | null;
    lawNameNormalized: string | null;
    lawNumber: string | null;
    lawYear: string | null;
    sourceDataset: string | null;
  };
  count: number;
  hasAppealSignals: boolean;
};

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const authorityTypeFor = (
  group: AuthorityGroup,
): "constitution" | "statute" | "court_ruling" | "secondary_source" => {
  const category = str(group._id.lawCategory);
  const title = str(group._id.lawName);
  if (
    group.hasAppealSignals ||
    /النقض|المحكمة\s+الادارية|المحكمة\s+الإدارية/i.test(category)
  ) {
    return "court_ruling";
  }
  if (/دستور/i.test(category) || /دستور/i.test(title)) return "constitution";
  if (/موسوعات/i.test(category) || /شرح|موسوعة/i.test(title)) {
    return "secondary_source";
  }
  return "statute";
};

const fieldMatch = (
  field: string,
  value: string | null,
): Record<string, unknown> =>
  value === null
    ? { $or: [{ [field]: null }, { [field]: { $exists: false } }] }
    : { [field]: value };

const run = async (): Promise<void> => {
  const dryRun = isDryRun() || !process.argv.includes("--apply");
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const chunks = ragConnection.db!.collection("legal_chunks");
    const scope = { source_dataset: { $in: LEGACY_DATASETS } };
    const [total, missingEmbeddings, groups] = await Promise.all([
      chunks.countDocuments(scope),
      chunks.countDocuments({
        ...scope,
        $or: [
          { embedding: { $exists: false } },
          { embedding: { $not: { $type: "array" } } },
        ],
      }),
      chunks.aggregate<AuthorityGroup>([
        { $match: scope },
        {
          $group: {
            _id: {
              lawCategory: "$law_category",
              lawName: "$law_name",
              lawNameNormalized: "$law_name_normalized",
              lawNumber: "$law_number",
              lawYear: "$law_year",
              sourceDataset: "$source_dataset",
            },
            count: { $sum: 1 },
            hasAppealSignals: {
              $max: {
                $or: [
                  { $eq: [{ $type: "$appeal_number" }, "string"] },
                  { $eq: [{ $type: "$judicial_year" }, "string"] },
                  { $eq: [{ $type: "$ruling_date" }, "string"] },
                ],
              },
            },
          },
        },
      ]).toArray(),
    ]);

    if (dryRun) {
      console.log(JSON.stringify({
        migrationId: RELEASE_ID,
        dryRun,
        database: ragConnection.db!.databaseName,
        collection: "legal_chunks",
        scoped: total,
        authorityGroups: groups.length,
        missingEmbeddings,
        publicationBasis: "explicit project-owner approval",
        legalStatusTreatment:
          "Unknown is preserved for legacy records whose current legal status was not established.",
      }, null, 2));
      return;
    }

    let matched = 0;
    let modified = 0;
    let processedGroups = 0;
    const authorityTypes = new Map<string, number>();
    let operations: AnyBulkWriteOperation<Document>[] = [];

    const flush = async (): Promise<void> => {
      if (operations.length === 0) return;
      const result = await chunks.bulkWrite(operations, { ordered: false });
      matched += result.matchedCount;
      modified += result.modifiedCount;
      operations = [];
    };

    for (const group of groups) {
      const category = str(group._id.lawCategory) || "(missing)";
      const title =
        str(group._id.lawName) ||
        str(group._id.lawNameNormalized) ||
        "Legacy legal source";
      const dataset = str(group._id.sourceDataset) || "(missing)";
      const rawAuthorityKey = [
        category,
        title,
        str(group._id.lawNumber),
        str(group._id.lawYear),
        dataset,
      ].join("\u001f");
      const authorityId = "legacy-" + sha256(rawAuthorityKey).slice(0, 16);
      const authorityType = authorityTypeFor(group);
      authorityTypes.set(
        authorityType,
        (authorityTypes.get(authorityType) ?? 0) + group.count,
      );

      operations.push({
        updateMany: {
          filter: {
            $and: [
              fieldMatch("law_category", group._id.lawCategory),
              fieldMatch("law_name", group._id.lawName),
              fieldMatch("law_name_normalized", group._id.lawNameNormalized),
              fieldMatch("law_number", group._id.lawNumber),
              fieldMatch("law_year", group._id.lawYear),
              fieldMatch("source_dataset", group._id.sourceDataset),
            ],
          },
          update: [
            {
              $set: {
                authorityId,
                authorityTitleOfficial: title,
                authorityTitleNormalized: normalizeLawName(
                  str(group._id.lawNameNormalized) || title,
                ),
                jurisdiction: "EG",
                authorityType,
                authorityStatus: {
                  $cond: [
                    { $in: ["$authorityStatus", ["effective", "amended"]] },
                    "$authorityStatus",
                    "unknown",
                  ],
                },
                textStatus: "extracted",
                reviewStatus: "published",
                is_retrievable: true,
                reviewedBy:
                  "graduation-project-owner-approved-legacy-publication",
                reviewedAt: REVIEWED_AT,
                corpusReleaseId: RELEASE_ID,
                embedding_text: "$text",
                sourceReferences: [
                  {
                    kind: "legacy-dataset",
                    dataset,
                    documentId: "$document_id",
                  },
                ],
                verificationMethod:
                  "Published for graduation-project retrieval by explicit project-owner approval; official-source provenance and current legal status were not established for this legacy record.",
                provenanceStatus: "legacy-project-published",
                embeddingDim: {
                  $cond: [
                    { $isArray: "$embedding" },
                    { $size: "$embedding" },
                    "$$REMOVE",
                  ],
                },
                embeddingModel: {
                  $cond: [
                    { $isArray: "$embedding" },
                    { $ifNull: ["$embeddingModel", "legacy-unknown-1024"] },
                    "$$REMOVE",
                  ],
                },
              },
            },
          ],
        },
      });

      processedGroups += 1;
      if (operations.length >= BATCH_SIZE) await flush();
      if (processedGroups % 250 === 0) {
        console.log(
          "publish:legacy progress " + processedGroups + "/" + groups.length,
        );
      }
    }
    await flush();

    console.log(JSON.stringify({
      migrationId: RELEASE_ID,
      dryRun,
      database: ragConnection.db!.databaseName,
      collection: "legal_chunks",
      scoped: total,
      matched,
      modified,
      authorityGroups: groups.length,
      missingEmbeddings,
      authorityTypes: Object.fromEntries(authorityTypes),
      publicationBasis: "explicit project-owner approval",
      legalStatusTreatment:
        "Unknown is preserved for legacy records whose current legal status was not established.",
    }, null, 2));
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    "publish:legacy-legal-chunks failed: " +
      (error instanceof Error ? error.message : "unknown error"),
  );
  process.exitCode = 1;
});
