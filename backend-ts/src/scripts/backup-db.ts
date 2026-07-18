import mongoose from "mongoose";
import { env } from "../config/env";

async function backupCollection() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  console.log(
    `Connected successfully to database: ${mongoose.connection.db!.databaseName}`,
  );

  const sourceCollection = "legal_chunks";
  const backupCollectionName = `${sourceCollection}_backup_${Date.now()}`;

  const sourceCount = await mongoose.connection
    .db!.collection(sourceCollection)
    .countDocuments();
  console.log(`Source '${sourceCollection}' has ${sourceCount} documents`);
  console.log(`Starting backup to '${backupCollectionName}'...`);

  await mongoose.connection
    .db!.collection(sourceCollection)
    .aggregate([{ $out: backupCollectionName }])
    .toArray();

  const backupCount = await mongoose.connection
    .db!.collection(backupCollectionName)
    .countDocuments();
  console.log(
    `✅ Backup completed. ${backupCount} documents copied to '${backupCollectionName}'`,
  );
  process.exit(0);
}

backupCollection().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
