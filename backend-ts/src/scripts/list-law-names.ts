import mongoose from "mongoose";
import { env } from "../config/env";

async function listLawNames() {
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  console.log(`Connected to database: ${mongoose.connection.db!.databaseName}\n`);

  const collection = mongoose.connection.db!.collection("legal_chunks");

  // Get distinct law_name values
  const lawNames = await collection.distinct("law_name");
  console.log(`Found ${lawNames.length} unique law_name values:\n`);

  // Sort and display
  lawNames.sort((a, b) => a.localeCompare(b, "ar"));
  for (const name of lawNames) {
    console.log(`- ${name}`);
  }

  // Also get law_category values
  const categories = await collection.distinct("law_category");
  console.log(`\n\nFound ${categories.length} unique law_category values:\n`);
  categories.sort((a, b) => a.localeCompare(b, "ar"));
  for (const cat of categories) {
    console.log(`- ${cat}`);
  }

  // Get sample documents with law_name to see structure
  console.log("\n\nSample documents with law_name:");
  const samples = await collection.find({ law_name: { $exists: true, $ne: null } }).limit(5).toArray();
  for (const doc of samples) {
    console.log(`\n--- Document ---`);
    console.log(`law_name: ${doc.law_name}`);
    console.log(`law_name_normalized: ${doc.law_name_normalized}`);
    console.log(`law_category: ${doc.law_category}`);
    console.log(`law_number: ${doc.law_number}`);
    console.log(`law_year: ${doc.law_year}`);
  }

  process.exit(0);
}

listLawNames().catch(console.error);
