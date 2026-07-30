import { MongoService, appConnection } from "../services/mongo.service";
import { isDryRun, printSummary } from "./script-utils";

const run = async (): Promise<void> => {
  const dryRun = isDryRun();
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const conversations = appConnection.db!.collection("conversations");
    const messages = appConnection.db!.collection("messages");
    const conversationFilter = {
      $or: [
        { jurisdiction: { $exists: false } },
        { organizationId: { $exists: false } },
        { activeLegalContext: { $exists: false } },
        { summaryVersion: { $exists: false } },
      ],
    };
    const messageFilter = { organizationId: { $exists: false } };
    const conversationCount =
      await conversations.countDocuments(conversationFilter);
    const messageCount = await messages.countDocuments(messageFilter);
    if (!dryRun) {
      await conversations.updateMany(conversationFilter, [
        {
          $set: {
            jurisdiction: { $ifNull: ["$jurisdiction", "EG"] },
            organizationId: { $ifNull: ["$organizationId", null] },
            summaryVersion: { $ifNull: ["$summaryVersion", 0] },
            activeLegalContext: {
              $ifNull: [
                "$activeLegalContext",
                {
                  jurisdiction: "EG",
                  authorityIds: [],
                  lawReferences: [],
                  facts: [],
                  assumptions: [],
                  unresolvedQuestions: [],
                },
              ],
            },
          },
        },
      ]);
      await messages.updateMany(messageFilter, [
        {
          $set: {
            organizationId: { $ifNull: ["$organizationId", null] },
          },
        },
      ]);
    }
    printSummary("migrate:chat", {
      dryRun,
      conversationsChanged: conversationCount,
      messagesChanged: messageCount,
      failed: 0,
    });
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    `migrate:chat failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
