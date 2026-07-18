import mongoose from "mongoose";
import { MongoService } from "../services/mongo.service";

const viewDatabase = async () => {
  const mongoService = new MongoService();
  
  try {
    console.log("🔌 Connecting to MongoDB...\n");
    await mongoService.connect();
    
    const db = mongoose.connection.db;
    
    // List all collections
    console.log("📚 Collections in 'legalmind' database:\n");
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log("❌ No collections found. The database might be empty.");
      return;
    }
    
    console.log(`Found ${collections.length} collection(s):\n`);
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const coll = db.collection(collectionName);
      
      // Get document count
      const count = await coll.countDocuments();
      console.log(`📦 ${collectionName}`);
      console.log(`   Documents: ${count}`);
      
      if (count > 0) {
        // Get a sample document
        const sample = await coll.findOne({});
        console.log(`   Sample fields: ${Object.keys(sample || {}).join(", ")}`);
        
        // Show first document preview
        if (sample) {
          console.log(`   Sample data:`);
          const preview = JSON.stringify(sample, null, 2)
            .split("\n")
            .slice(0, 10)
            .join("\n");
          console.log(preview.substring(0, 500) + "...");
        }
      }
      console.log("");
    }
    
    console.log("✅ Database inspection complete!");
    
  } catch (error) {
    console.error("❌ Error viewing database:", error);
  } finally {
    await mongoService.close();
    process.exit(0);
  }
};

void viewDatabase();
