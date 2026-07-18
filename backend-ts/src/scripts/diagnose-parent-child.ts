import mongoose from "mongoose";
import { env } from "../config/env";

async function diagnose() {
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  const db = mongoose.connection.db!;
  const col = db.collection("legal_chunks");

  console.log("═══════════════════════════════════════════════════════");
  console.log("  PARENT-CHILD STRUCTURE DIAGNOSTIC");
  console.log("═══════════════════════════════════════════════════════\n");

  const total = await col.countDocuments();
  console.log(`Total docs: ${total}`);

  // ── Group 1: Original chunks (child_index = -1) ─────────────────────────────
  const origTotal = await col.countDocuments({ child_index: -1 });
  // Which of those were actually split? (i.e. have children _c000 in collection)
  // A chunk was split if another doc has parent_chunk_id = this chunk's chunk_id
  // We detect this differently: a split parent has chunk_id that appears as
  // parent_chunk_id of a _cNNN doc.
  const splitParentIds = await col.distinct("parent_chunk_id", {
    child_index: { $gte: 0 },
  });
  const splitParentCount = splitParentIds.length;
  const notSplitCount = origTotal - splitParentCount;

  console.log("\n── Original chunks (child_index = -1) ───────────────────");
  console.log(`  Total                          : ${origTotal}`);
  console.log(`  Were split into _cNNN children : ${splitParentCount}`);
  console.log(`  Were NOT split (atomic chunks) : ${notSplitCount}`);

  // ── is_retrievable for split parents vs non-split ──────────────────────────
  const splitParentRetrievable = await col.countDocuments({
    chunk_id: { $in: splitParentIds },
    is_retrievable: true,
  });
  const splitParentNotRetrievable = await col.countDocuments({
    chunk_id: { $in: splitParentIds },
    is_retrievable: { $ne: true },
  });
  console.log("\n── is_retrievable for SPLIT parent chunks ────────────────");
  console.log(
    `  retrievable=true  : ${splitParentRetrievable}  ← PROBLEM if > 0`,
  );
  console.log(`  retrievable!=true : ${splitParentNotRetrievable}`);

  // ── Group 2: Auto-split children (child_index >= 0) ─────────────────────────
  const childTotal = await col.countDocuments({ child_index: { $gte: 0 } });
  const childRetrievable = await col.countDocuments({
    child_index: { $gte: 0 },
    is_retrievable: true,
  });
  const childNotRetrievable = childTotal - childRetrievable;

  console.log("\n── Auto-split children (child_index >= 0) ────────────────");
  console.log(`  Total             : ${childTotal}`);
  console.log(`  is_retrievable=true : ${childRetrievable}`);
  console.log(`  is_retrievable!=true: ${childNotRetrievable}`);

  // ── Does the backend use parent_chunk_id for context expansion? ────────────
  // Check: when a child _cNNN is retrieved, can its parent be found?
  // Sample 5 child chunks and verify parent exists
  console.log("\n── Sample: child chunk → can we find parent? ─────────────");
  const childSamples = await col
    .find(
      { child_index: { $gte: 0 } },
      {
        projection: {
          _id: 0,
          chunk_id: 1,
          parent_chunk_id: 1,
          child_index: 1,
          law_name: 1,
          text_len: 1,
        },
      },
    )
    .limit(5)
    .toArray();

  for (const child of childSamples) {
    const parent = await col.findOne(
      { chunk_id: child.parent_chunk_id },
      {
        projection: {
          _id: 0,
          chunk_id: 1,
          child_index: 1,
          text_len: 1,
          is_retrievable: 1,
        },
      },
    );
    console.log(
      `  child: ${child.chunk_id} (idx=${child.child_index}, len=${child.text_len})`,
    );
    if (parent) {
      console.log(
        `    → parent found: ${parent.chunk_id} (is_retrievable=${parent.is_retrievable}, len=${parent.text_len})`,
      );
    } else {
      console.log(`    → ❌ parent NOT FOUND: ${child.parent_chunk_id}`);
    }
  }

  // ── Orphaned children (parent_chunk_id not in collection) ──────────────────
  // Use aggregation $lookup to count orphans
  console.log("\n── Orphaned children (parent not in collection) ──────────");
  const orphanPipeline = [
    { $match: { child_index: { $gte: 0 } } },
    {
      $lookup: {
        from: "legal_chunks",
        localField: "parent_chunk_id",
        foreignField: "chunk_id",
        as: "parent_docs",
      },
    },
    { $match: { parent_docs: { $size: 0 } } },
    { $count: "orphan_count" },
  ];
  const orphanResult = await col.aggregate(orphanPipeline).toArray();
  const orphanCount = orphanResult[0]?.orphan_count ?? 0;
  console.log(`  Orphaned children: ${orphanCount}`);

  // ── Do original chunks' parent_chunk_id match their document_id? ──────────
  console.log("\n── Original chunks: parent_chunk_id vs document_id ───────");
  const sample5orig = await col
    .find(
      { child_index: -1 },
      {
        projection: {
          _id: 0,
          chunk_id: 1,
          document_id: 1,
          parent_chunk_id: 1,
          law_name: 1,
        },
      },
    )
    .limit(5)
    .toArray();

  for (const d of sample5orig) {
    const parentMatchesDocId = d.parent_chunk_id === d.document_id;
    const parentInCollection = !!(await col.findOne(
      { chunk_id: d.parent_chunk_id },
      { projection: { _id: 1 } },
    ));
    console.log(`  chunk_id     : ${d.chunk_id}`);
    console.log(`  document_id  : ${d.document_id}`);
    console.log(`  parent_chunk : ${d.parent_chunk_id}`);
    console.log(
      `  parent==docId: ${parentMatchesDocId}  parent_in_col: ${parentInCollection}`,
    );
    console.log();
  }

  // ── Global: parent_chunk_id matches document_id count ─────────────────────
  console.log("── How many orig chunks have parent_chunk_id == document_id? ─");
  const matchPipeline = [
    { $match: { child_index: -1 } },
    { $project: { matches: { $eq: ["$parent_chunk_id", "$document_id"] } } },
    { $group: { _id: "$matches", count: { $sum: 1 } } },
  ];
  const matchResult = await col.aggregate(matchPipeline).toArray();
  for (const r of matchResult) {
    console.log(`  parent==docId=${r._id}: ${r.count}`);
  }

  // ── Duplicate chunk_id check ────────────────────────────────────────────────
  console.log("\n── Duplicate chunk_id values ─────────────────────────────");
  const dupPipeline = [
    { $group: { _id: "$chunk_id", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "duplicate_ids" },
  ];
  const dupResult = await col.aggregate(dupPipeline).toArray();
  const dupCount = dupResult[0]?.duplicate_ids ?? 0;
  console.log(
    `  Duplicate chunk_ids: ${dupCount}  ← PROBLEM if > 0 (breaks parent lookup)`,
  );

  const missingChunkId = await col.countDocuments({
    chunk_id: { $in: [null, ""] },
  });
  console.log(`  Docs missing chunk_id: ${missingChunkId}  ← PROBLEM if > 0`);

  // ── Embedding health ────────────────────────────────────────────────────────
  console.log("\n── Embedding health ──────────────────────────────────────");
  // Retrievable docs with no embedding → invisible to vector search
  const retrievableNoEmbed = await col.countDocuments({
    is_retrievable: true,
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
    ],
  });
  // Retrievable docs with a valid embedding
  const retrievableWithEmbed = await col.countDocuments({
    is_retrievable: true,
    embedding: { $exists: true, $not: { $size: 0 }, $ne: null },
  });
  console.log(`  Retrievable WITH embedding    : ${retrievableWithEmbed}`);
  console.log(
    `  Retrievable WITHOUT embedding : ${retrievableNoEmbed}  ← PROBLEM if > 0 (invisible to vector search)`,
  );

  // Non-retrievable docs that have an embedding (wasted space)
  const nonRetrievableWithEmbed = await col.countDocuments({
    is_retrievable: { $ne: true },
    embedding: { $exists: true, $not: { $size: 0 }, $ne: null },
  });
  console.log(
    `  Non-retrievable WITH embedding: ${nonRetrievableWithEmbed}  ← wasted if > 0 (should be 0)`,
  );

  // ── Retrievable population cross-check ─────────────────────────────────────
  console.log("\n── Retrievable population cross-check ────────────────────");
  // Expected: total retrievable = non-split atomic chunks + auto-split children
  const totalRetrievable = await col.countDocuments({ is_retrievable: true });
  const atomsRetrievable = await col.countDocuments({
    child_index: -1,
    chunk_id: { $not: { $in: splitParentIds } },
    is_retrievable: true,
  });
  const childrenRetrievable = await col.countDocuments({
    child_index: { $gte: 0 },
    is_retrievable: true,
  });
  const expectedRetrievable = atomsRetrievable + childrenRetrievable;
  const retrievableMismatch = totalRetrievable - expectedRetrievable;
  console.log(`  Total is_retrievable=true         : ${totalRetrievable}`);
  console.log(`  Non-split atoms (retrievable)     : ${atomsRetrievable}`);
  console.log(`  Auto-split children (retrievable) : ${childrenRetrievable}`);
  console.log(`  Sum (atoms + children)            : ${expectedRetrievable}`);
  console.log(
    `  Discrepancy                       : ${retrievableMismatch}  ← PROBLEM if != 0`,
  );

  // ── Children data integrity ─────────────────────────────────────────────────
  console.log("\n── Children data integrity ───────────────────────────────");
  const childMissingParentId = await col.countDocuments({
    child_index: { $gte: 0 },
    $or: [
      { parent_chunk_id: { $exists: false } },
      { parent_chunk_id: null },
      { parent_chunk_id: "" },
    ],
  });
  const childMissingText = await col.countDocuments({
    child_index: { $gte: 0 },
    $or: [{ text: { $exists: false } }, { text: null }, { text: "" }],
  });
  const childMissingEmbedText = await col.countDocuments({
    child_index: { $gte: 0 },
    $or: [
      { embedding_text: { $exists: false } },
      { embedding_text: null },
      { embedding_text: "" },
    ],
  });
  console.log(
    `  Children missing parent_chunk_id  : ${childMissingParentId}  ← PROBLEM if > 0`,
  );
  console.log(
    `  Children missing text             : ${childMissingText}  ← PROBLEM if > 0`,
  );
  console.log(`  Children missing embedding_text   : ${childMissingEmbedText}`);

  // ── text_len accuracy sample ────────────────────────────────────────────────
  console.log("\n── text_len accuracy (sample of 5 retrievable docs) ──────");
  const lenSamples = await col
    .find(
      { is_retrievable: true },
      { projection: { _id: 0, chunk_id: 1, text: 1, text_len: 1 } },
    )
    .limit(5)
    .toArray();
  for (const s of lenSamples) {
    const actualLen = (s.text ?? "").length;
    const stored = s.text_len ?? null;
    const match = stored === actualLen ? "✓" : `❌ stored=${stored}`;
    console.log(`  ${s.chunk_id}  actual_len=${actualLen}  ${match}`);
  }

  // ── Collection indexes ──────────────────────────────────────────────────────
  console.log("\n── Collection indexes ────────────────────────────────────");
  const indexes = await col.indexes();
  for (const idx of indexes) {
    const keys = Object.entries(idx.key as Record<string, unknown>)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    console.log(`  [${idx.name}]  {${keys}}`);
  }
  const hasChunkIdIndex = indexes.some(
    (idx) => "chunk_id" in (idx.key as Record<string, unknown>),
  );
  if (!hasChunkIdIndex) {
    console.log(
      "  ⚠️  No index on chunk_id — parent lookups will do full scans!",
    );
  }

  console.log("\n═══════════════════════════════════════════════════════");
  process.exit(0);
}

diagnose().catch((err) => {
  console.error(err);
  process.exit(1);
});
