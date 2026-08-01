import { ConversationModel } from "../modules/conversations/conversation.model";
import { MessageModel } from "../modules/conversations/message.model";
import { RefreshTokenModel } from "../modules/auth/refresh-token.model";
import { UserModel } from "../modules/auth/user.model";
import { MongoService } from "../services/mongo.service";
import { isDryRun, printSummary } from "./script-utils";

const models = [UserModel, RefreshTokenModel, ConversationModel, MessageModel];

const run = async (): Promise<void> => {
  const dryRun = isDryRun();
  const mongo = new MongoService();
  await mongo.connect();
  try {
    let createdOrExisting = 0;
    for (const model of models) {
      const declared = model.schema.indexes();
      if (!dryRun) await model.createIndexes();
      createdOrExisting += declared.length;
      console.log(
        `${dryRun ? "would verify" : "verified"} ${model.collection.collectionName}: ${declared.length} declared indexes`,
      );
    }
    printSummary("indexes:app", {
      dryRun,
      createdOrExisting,
      failed: 0,
    });
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    `indexes:app failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});

