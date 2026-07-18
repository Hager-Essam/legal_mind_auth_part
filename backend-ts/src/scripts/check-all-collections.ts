import mongoose from "mongoose";
import { env } from "../config/env";

async function checkAllCollections() {
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  console.log(`Connected to database: ${mongoose.connection.db!.databaseName}\n`);

  const collections = await mongoose.connection.db!.listCollections().toArray();

  for (const col of collections) {
    const count = await mongoose.connection.db!.collection(col.name).countDocuments();
    console.log(`${col.name}: ${count} documents`);
  }

  process.exit(0);
}

checkAllCollections().catch(console.error);
