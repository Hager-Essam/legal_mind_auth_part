/**
 * create-indexes.ts
 *
 * Creates all MongoDB indexes needed by the backend query pipeline.
 * Safe to run multiple times — createIndex() is idempotent (it skips
 * creation if an index with the same name already exists).
 *
 * Run with:
 *   npx tsx src/scripts/create-indexes.ts
 */

import { env } from "../config/env";
import { MongoService, ragConnection } from "../services/mongo.service";

async function createIndexes() {
  const mongoService = new MongoService();
  console.log("Connecting to MongoDB...");
  await mongoService.connect();
  console.log(`Connected. RAG DB: ${env.ragMongoDb}\n`);

  const col = ragConnection.db!.collection("legal_chunks");

  // ── 1. Article exact-lookup index ─────────────────────────────────────────
  // Used by: findByArticle()
  // Query pattern:
  //   { article_number: "5", law_name_normalized: /قانون.*العمل/i, child_index: {$in:[-1,null]} }
  //   .sort({ text_len: -1 })
  //
  // Without this index every findByArticle() call is a full 22K-doc scan.
  // With it the lookup is an O(log n) index seek + sort on a tiny candidate set.
  await col.createIndex(
    { article_number: 1, law_name_normalized: 1, child_index: 1 },
    { name: "article_lookup_idx" },
  );
  console.log("✅  article_lookup_idx  { article_number, law_name_normalized, child_index }");

  // ── 2. chunk_id unique index ───────────────────────────────────────────────
  // Used by:
  //   - findByArticle()  → children fetch: { parent_chunk_id: parent.chunk_id }
  //   - expandWithParentContext() → { chunk_id: { $in: parentIds } }
  //   - diagnose-parent-child.ts → various parent lookups
  //
  // chunk_id is the logical primary key but has no index in the raw collection.
  // sparse:true handles docs where chunk_id is null/missing without error.
  await col.createIndex(
    { chunk_id: 1 },
    { name: "chunk_id_idx", unique: false, sparse: true },
  );
  console.log("✅  chunk_id_idx        { chunk_id }");

  // ── 3. Parent→children index ───────────────────────────────────────────────
  // Used by: findByArticle() → fetch children of the matched parent
  //   ChunkModel.find({ parent_chunk_id: parent.chunk_id, child_index: {$gte:0} })
  //
  // Also used by expandWithParentContext() and restore-split-parents.ts.
  await col.createIndex(
    { parent_chunk_id: 1, child_index: 1 },
    { name: "parent_children_idx" },
  );
  console.log("✅  parent_children_idx { parent_chunk_id, child_index }");

  // ── 4. Appeal (court ruling) lookup index ─────────────────────────────────
  // Used by: findByAppeal()
  //   { appeal_number: "513", judicial_year: "16", is_retrievable: true }
  await col.createIndex(
    { appeal_number: 1, judicial_year: 1, is_retrievable: 1 },
    { name: "appeal_lookup_idx", sparse: true },
  );
  console.log("✅  appeal_lookup_idx   { appeal_number, judicial_year, is_retrievable }");

  // ── 5. Retrievability + law filter index ──────────────────────────────────
  // Used by: vectorSearch() and textSearch() pre-filter composition,
  //          and migrate-legal-structure.ts batch reads.
  // Covers: { is_retrievable: true, law_number: "12", law_year: "2003" }
  await col.createIndex(
    { is_retrievable: 1, law_number: 1, law_year: 1 },
    { name: "retrievable_law_idx", sparse: true },
  );
  console.log("✅  retrievable_law_idx { is_retrievable, law_number, law_year }");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n── All indexes in legal_chunks ───────────────────────────");
  const all = await col.indexes();
  for (const idx of all) {
    const keys = Object.entries(idx.key as Record<string, unknown>)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    console.log(`  [${idx.name}]  { ${keys} }`);
  }

  console.log("\n✅  Index creation complete.");
  await mongoService.close();
}

createIndexes().catch((err) => {
  console.error("❌  Index creation failed:", err);
  process.exit(1);
});
