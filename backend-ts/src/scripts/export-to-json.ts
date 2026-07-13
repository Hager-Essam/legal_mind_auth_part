import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { env } from "../config/env";

const EXPORT_DIR = path.join(__dirname, "..", "..", "backups");
const BATCH_SIZE = 1000;

async function exportCollection() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  console.log(`Connected to database: ${mongoose.connection.db!.databaseName}`);

  const collection = mongoose.connection.db!.collection("legal_chunks");
  const count = await collection.countDocuments();
  console.log(`Found ${count} documents in 'legal_chunks'\n`);

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const exportFile = path.join(EXPORT_DIR, `legal_chunks_${timestamp}.json`);

  console.log("Exporting documents in batches...");
  const cursor = collection.find({}, { projection: { _id: 1 } });
  const docIds: any[] = [];

  for await (const doc of cursor) {
    docIds.push(doc._id);
  }
  console.log(`Collected ${docIds.length} document IDs. Now exporting data...`);

  const writeStream = fs.createWriteStream(exportFile);
  writeStream.write("[\n");

  let exported = 0;
  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batch = docIds.slice(i, i + BATCH_SIZE);
    const docs = await collection.find({ _id: { $in: batch } }).toArray();

    for (let j = 0; j < docs.length; j++) {
      const { _id, ...rest } = docs[j];
      const json = JSON.stringify({ _id: _id.toString(), ...rest });
      writeStream.write(json);
      if (exported < count - 1) writeStream.write(",\n");
      exported++;
    }

    process.stdout.write(`\r  Exported ${exported}/${count} documents...`);
  }

  writeStream.write("\n]");
  writeStream.end();

  await new Promise<void>((resolve) => writeStream.on("finish", resolve));

  const fileSize = fs.statSync(exportFile).size;
  console.log(`\n\n✅ Export complete!`);
  console.log(`   File: ${exportFile}`);
  console.log(`   Documents: ${exported}`);
  console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  process.exit(0);
}

exportCollection().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
