import { MongoService, ragConnection } from "../services/mongo.service";
import { isDryRun, printSummary } from "./script-utils";

const run = async (): Promise<void> => {
  const dryRun = isDryRun();
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const chunks = ragConnection.db!.collection("legal_chunks");
    const filter = {
      $or: [
        { jurisdiction: { $exists: false } },
        { reviewStatus: { $exists: false } },
        { authorityStatus: { $exists: false } },
        { authorityTitleOfficial: { $exists: false } },
      ],
    };
    const changed = await chunks.countDocuments(filter);
    if (!dryRun) {
      await chunks.updateMany(filter, [
        {
          $set: {
            jurisdiction: { $ifNull: ["$jurisdiction", "EG"] },
            authorityTitleOfficial: {
              $ifNull: ["$authorityTitleOfficial", "$law_name"],
            },
            authorityTitleNormalized: {
              $ifNull: [
                "$authorityTitleNormalized",
                "$law_name_normalized",
              ],
            },
            authorityStatus: {
              $ifNull: ["$authorityStatus", "unknown"],
            },
            textStatus: { $ifNull: ["$textStatus", "unknown"] },
            reviewStatus: { $ifNull: ["$reviewStatus", "draft"] },
            // Missing governance metadata must fail closed.
            is_retrievable: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$reviewStatus", "published"] },
                    {
                      $in: [
                        "$authorityStatus",
                        ["effective", "amended"],
                      ],
                    },
                    { $eq: ["$is_retrievable", true] },
                  ],
                },
                true,
                false,
              ],
            },
          },
        },
      ]);
    }
    printSummary("migrate:legal-source-metadata", {
      dryRun,
      changed,
      failed: 0,
    });
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    `migrate:legal-source-metadata failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});

