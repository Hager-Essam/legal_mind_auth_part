/**
 * Check MongoDB database structure
 */
import mongoose from "mongoose";
import { ChunkModel } from "../src/models/chunk.model";

const MONGODB_URI = process.env.LEGALMIND_MONGODB_URI || 
  "mongodb://muhmmadmaged107_db_user:B3u2LEHVIk9E7c4Y@ac-k9irtmz-shard-00-00.plpmsfy.mongodb.net:27017,ac-k9irtmz-shard-00-01.plpmsfy.mongodb.net:27017,ac-k9irtmz-shard-00-02.plpmsfy.mongodb.net:27017/?ssl=true&replicaSet=atlas-uharfr-shard-0&authSource=admin&appName=Cluster0";
const DB_NAME = "legalmind";

async function checkDatabase() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
    console.log("✅ Connected!\n");

    // 1. Check counts
    console.log("=".repeat(60));
    console.log("1. COLLECTION SIZE");
    console.log("=".repeat(60));
    
    const totalCount = await ChunkModel.countDocuments();
    console.log(`Total documents: ${totalCount}`);

    const retrievableCount = await ChunkModel.countDocuments({ is_retrievable: true });
    console.log(`Retrievable documents (is_retrievable: true): ${retrievableCount}`);

    const nonRetrievableCount = await ChunkModel.countDocuments({ is_retrievable: false });
    console.log(`Non-retrievable documents (is_retrievable: false): ${nonRetrievableCount}`);

    if (totalCount === 0) {
      console.log("\n❌ ERROR: Collection is EMPTY!");
      console.log("   You need to import legal documents first.");
      return;
    }

    // 2. Sample document
    console.log("\n" + "=".repeat(60));
    console.log("2. SAMPLE RETRIEVABLE DOCUMENT");
    console.log("=".repeat(60));

    const sampleDoc = await ChunkModel.findOne({ is_retrievable: true }).lean();
    
    if (!sampleDoc) {
      console.log("❌ ERROR: No retrievable documents found!");
      console.log("   All documents have is_retrievable: false\n");
      
      const anySample = await ChunkModel.findOne().lean();
      if (anySample) {
        console.log("Sample non-retrievable document fields:");
        console.log(Object.keys(anySample).join(", "));
      }
      return;
    }

    console.log("✅ Found retrievable document\n");
    console.log("Fields:");
    Object.keys(sampleDoc).forEach(key => {
      const value = sampleDoc[key];
      let info = "";
      
      if (Array.isArray(value)) {
        if (key === "embedding") {
          info = `array[${value.length}] (embedding dimension)`;
        } else {
          info = `array[${value.length}]`;
        }
      } else if (typeof value === "string") {
        info = value.length > 50 
          ? `"${value.substring(0, 50)}..."` 
          : `"${value}"`;
      } else {
        info = String(value);
      }
      
      console.log(`  ${key}: ${info}`);
    });

    // 3. Critical fields check
    console.log("\n" + "=".repeat(60));
    console.log("3. CRITICAL FIELDS");
    console.log("=".repeat(60));

    const checks = [
      { field: "chunk_id", exists: !!sampleDoc.chunk_id },
      { field: "text", exists: !!sampleDoc.text },
      { field: "content", exists: !!sampleDoc.content },
      { field: "embedding", exists: Array.isArray(sampleDoc.embedding) },
      { field: "is_retrievable", exists: sampleDoc.is_retrievable !== undefined },
      { field: "law_name_normalized", exists: !!sampleDoc.law_name_normalized },
    ];

    checks.forEach(check => {
      const status = check.exists ? "✅" : "❌";
      console.log(`${status} ${check.field}: ${check.exists ? "EXISTS" : "MISSING"}`);
    });

    if (Array.isArray(sampleDoc.embedding)) {
      console.log(`   Embedding dimension: ${sampleDoc.embedding.length}`);
    }

    // 4. Field name inconsistency check
    console.log("\n" + "=".repeat(60));
    console.log("4. FIELD NAME CHECK");
    console.log("=".repeat(60));

    const hasText = await ChunkModel.countDocuments({ text: { $exists: true } });
    const hasContent = await ChunkModel.countDocuments({ content: { $exists: true } });

    console.log(`Documents with 'text' field: ${hasText}`);
    console.log(`Documents with 'content' field: ${hasContent}`);

    if (hasText > 0 && hasContent === 0) {
      console.log("\n⚠️  WARNING: Using 'text' field but code expects 'content'");
      console.log("   You may need to map 'text' → 'content' in chunk-mapper.ts");
    }

    // 5. Test vector search
    console.log("\n" + "=".repeat(60));
    console.log("5. TEST VECTOR SEARCH");
    console.log("=".repeat(60));

    if (!Array.isArray(sampleDoc.embedding) || sampleDoc.embedding.length === 0) {
      console.log("❌ Cannot test vector search - no embedding found");
    } else {
      try {
        const testVector = sampleDoc.embedding;
        const vectorResults = await ChunkModel.aggregate([
          {
            $vectorSearch: {
              index: "legal_chunks_vector",
              path: "embedding",
              queryVector: testVector,
              numCandidates: 10,
              limit: 3,
              filter: { is_retrievable: { $eq: true } }
            }
          },
          { $limit: 3 }
        ]);

        console.log(`✅ Vector search works! Found ${vectorResults.length} results`);
      } catch (error: any) {
        console.log("❌ Vector search failed:");
        console.log(`   ${error.message}`);
      }
    }

    // 6. Test text search
    console.log("\n" + "=".repeat(60));
    console.log("6. TEST TEXT SEARCH");
    console.log("=".repeat(60));

    try {
      const textResults = await ChunkModel.aggregate([
        {
          $search: {
            index: "legal_chunks_text",
            compound: {
              must: [
                { equals: { path: "is_retrievable", value: true } }
              ],
              should: [
                { text: { query: "عمل", path: "text" } }
              ],
              minimumShouldMatch: 1
            }
          }
        },
        { $limit: 3 }
      ]);

      console.log(`✅ Text search works! Found ${textResults.length} results`);
    } catch (error: any) {
      console.log("❌ Text search failed:");
      console.log(`   ${error.message}`);
    }

    // 7. Sample content
    console.log("\n" + "=".repeat(60));
    console.log("7. SAMPLE CONTENT");
    console.log("=".repeat(60));

    const contentText = sampleDoc.content || sampleDoc.text || "";
    console.log(contentText.substring(0, 200) + "...");

    console.log("\n" + "=".repeat(60));
    console.log("✅ DATABASE CHECK COMPLETE");
    console.log("=".repeat(60));

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

checkDatabase();
