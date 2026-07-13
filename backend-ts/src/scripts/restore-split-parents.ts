/**
 * restore-split-parents.ts
 *
 * Problem:
 *   When original chunks were split into _c000/_c001/… children, the parent
 *   documents were deleted from the collection.  Children exist and are
 *   retrieved, but the parent text needed for context expansion is gone.
 *
 * What this script does:
 *   1. Finds every unique parent_chunk_id referenced by children that does NOT
 *      exist as a document in the collection (the 1,285 missing parents).
 *   2. For each missing parent, fetches its children sorted by child_index and
 *      concatenates their text to reconstruct the full original text.
 *   3. Copies all metadata from the children (law_name, law_category, etc.).
 *   4. Inserts the reconstructed parent with is_retrievable: false so it is
 *      never returned by vector/text search — it only exists for context lookup.
 *
 * Safe to re-run: uses upsert so existing parents are never duplicated.
 * No re-embedding needed: is_retrievable:false docs are excluded from search.
 */

import mongoose from "mongoose";
import { env } from "../config/env";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fields we do NOT want to copy from a child onto the reconstructed parent. */
const SKIP_FIELDS = new Set([
  "_id",
  "chunk_id",        // parent gets its own chunk_id
  "parent_chunk_id", // parent gets its own parent_chunk_id
  "child_index",     // parent is always -1
  "is_retrievable",  // parent is always false
  "text",            // parent text is the reconstructed concatenation
  "text_len",        // recalculated from reconstructed text
  "embedding",       // parent is not embedded
  "embedding_text",  // parent is not embedded
]);

// ── Main ──────────────────────────────────────────────────────────────────────

async function restoreSplitParents() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  RESTORE SPLIT PARENT DOCUMENTS");
  console.log("═══════════════════════════════════════════════════════\n");

  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  const db   = mongoose.connection.db!;
  const col  = db.collection("legal_chunks");

  // ── Step 1: find missing parents ─────────────────────────────────────────
  console.log("Step 1 – scanning for missing parent documents …");

  const allParentIds: string[] = await col.distinct("parent_chunk_id", {
    child_index: { $gte: 0 },
  });
  console.log(`  parent_chunk_ids referenced by children : ${allParentIds.length}`);

  // Which of those already exist as a document?
  const existingIds: string[] = await col.distinct("chunk_id", {
    chunk_id: { $in: allParentIds },
  });
  const existingSet = new Set(existingIds);

  const missingIds = allParentIds.filter(id => !existingSet.has(id));
  console.log(`  already present in collection           : ${existingIds.length}`);
  console.log(`  missing (need to be restored)           : ${missingIds.length}\n`);

  if (missingIds.length === 0) {
    console.log("✅  All parent documents already exist. Nothing to do.");
    process.exit(0);
  }

  // ── Step 2: reconstruct and upsert in batches ─────────────────────────────
  console.log("Step 2 – reconstructing parents from children …\n");

  const BATCH = 50;
  let restored  = 0;
  let skipped   = 0;
  let withErrors = 0;

  for (let i = 0; i < missingIds.length; i += BATCH) {
    const batchIds  = missingIds.slice(i, i + BATCH);
    const bulkOps: object[] = [];

    for (const parentId of batchIds) {
      // Fetch children in order
      const children = await col
        .find(
          { parent_chunk_id: parentId, child_index: { $gte: 0 } },
          { projection: { _id: 0 } },
        )
        .sort({ child_index: 1 })
        .toArray();

      if (children.length === 0) {
        console.warn(`  ⚠  No children found for ${parentId} — skipping`);
        skipped++;
        continue;
      }

      // Reconstruct full text by joining children in index order.
      // Children were split at paragraph / sentence boundaries, so we
      // rejoin with a single newline to preserve the original flow.
      const reconstructedText = children
        .map(c => (c.text as string | undefined) ?? "")
        .join("\n");

      if (!reconstructedText.trim()) {
        console.warn(`  ⚠  Reconstructed text is empty for ${parentId} — skipping`);
        skipped++;
        continue;
      }

      // Copy all non-excluded metadata from the first child.
      // Siblings share the same law_name, law_category, source_file, etc.
      const firstChild = children[0] as Record<string, unknown>;
      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(firstChild)) {
        if (!SKIP_FIELDS.has(key)) {
          metadata[key] = value;
        }
      }

      // Build the parent document.
      // parent_chunk_id follows the same convention as other original chunks:
      // an original chunk's parent is its document (parent_chunk_id = document_id).
      const parentDoc: Record<string, unknown> = {
        ...metadata,
        chunk_id:        parentId,
        parent_chunk_id: (firstChild.document_id as string | undefined) ?? null,
        child_index:     -1,
        is_retrievable:  false,
        text:            reconstructedText,
        text_len:        reconstructedText.length,
        embedding:       null,
        embedding_text:  null,
        // Provenance markers so you can identify restored docs later
        _restored:       true,
        _restored_from:  children.length,   // how many children were joined
      };

      bulkOps.push({
        updateOne: {
          filter: { chunk_id: parentId },
          update: { $setOnInsert: parentDoc },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      try {
        const result = await col.bulkWrite(bulkOps as Parameters<typeof col.bulkWrite>[0], {
          ordered: false,
        });
        restored += result.upsertedCount;
        // If upsertedCount < bulkOps.length, the rest already existed (matched but not inserted)
        const alreadyExisted = bulkOps.length - result.upsertedCount;
        if (alreadyExisted > 0) skipped += alreadyExisted;
      } catch (err: unknown) {
        console.error(`  ✗  bulkWrite error in batch starting at ${i}:`, err);
        withErrors++;
      }
    }

    const done = Math.min(i + BATCH, missingIds.length);
    console.log(`  [${String(done).padStart(4)} / ${missingIds.length}]  restored so far: ${restored}`);
  }

  // ── Step 3: verify ────────────────────────────────────────────────────────
  console.log("\nStep 3 – verification …");
  const afterCount = await col.countDocuments({ _restored: true });
  const stillMissing = await col
    .aggregate([
      { $match: { child_index: { $gte: 0 } } },
      {
        $lookup: {
          from: "legal_chunks",
          localField: "parent_chunk_id",
          foreignField: "chunk_id",
          as: "parent_doc",
        },
      },
      { $match: { parent_doc: { $size: 0 } } },
      { $count: "n" },
    ])
    .toArray();
  const orphansLeft = (stillMissing[0] as { n?: number } | undefined)?.n ?? 0;

  console.log(`  Restored docs in collection (_restored=true) : ${afterCount}`);
  console.log(`  Orphaned children remaining                  : ${orphansLeft}  ← should be 0`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  if (orphansLeft === 0) {
    console.log("✅  All parent documents restored successfully.");
  } else {
    console.log(`⚠️   ${orphansLeft} children are still orphaned — check warnings above.`);
  }
  console.log(`  Newly inserted : ${restored}`);
  console.log(`  Already existed / skipped : ${skipped}`);
  console.log(`  Batch errors   : ${withErrors}`);
  console.log("═══════════════════════════════════════════════════════");

  process.exit(0);
}

restoreSplitParents().catch(err => {
  console.error(err);
  process.exit(1);
});
