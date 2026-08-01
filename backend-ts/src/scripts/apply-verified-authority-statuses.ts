import {
  authorityStatusRegistry,
  matchesAuthorityEntry,
  type AuthorityStatusRegistryEntry,
} from "../legal-governance/authority-status-registry";
import { MongoService, ragConnection } from "../services/mongo.service";
import { isDryRun } from "./script-utils";

const MIGRATION_ID = "authority-status-2026-07-30-v1";
type Chunk = Record<string, unknown> & {
  _id: unknown; chunk_id?: unknown; law_number?: unknown; law_year?: unknown;
  law_category?: unknown; law_name?: unknown; law_name_normalized?: unknown;
  article_number?: unknown;
};

const baseFilter = (entry: AuthorityStatusRegistryEntry): Record<string, unknown> => ({
  law_number: entry.match.lawNumber,
  law_year: entry.match.lawYear,
  ...(entry.match.lawCategory ? { law_category: entry.match.lawCategory } : {}),
});
const previous = (chunk: Chunk) => ({
  jurisdiction: chunk.jurisdiction, authorityId: chunk.authorityId,
  authorityTitleOfficial: chunk.authorityTitleOfficial, authorityType: chunk.authorityType,
  authorityStatus: chunk.authorityStatus, effectiveFrom: chunk.effectiveFrom,
  effectiveTo: chunk.effectiveTo, textStatus: chunk.textStatus,
  officialSourceUrl: chunk.officialSourceUrl, reviewStatus: chunk.reviewStatus,
  is_retrievable: chunk.is_retrievable, replacedByAuthorityId: chunk.replacedByAuthorityId,
  corpusReleaseId: chunk.corpusReleaseId,
});
const values = (entry: AuthorityStatusRegistryEntry) => ({
  jurisdiction: entry.jurisdiction, authorityId: entry.authorityId,
  authorityTitleOfficial: entry.authorityTitleOfficial, authorityType: entry.authorityType,
  authorityStatus: entry.authorityStatus,
  ...(entry.effectiveTo ? { effectiveTo: entry.effectiveTo } : {}),
  textStatus: "unknown", officialSourceUrl: entry.evidence[0]?.url,
  reviewStatus: "reviewed", is_retrievable: false,
  replacedByAuthorityId: entry.replacedByAuthorityId, corpusReleaseId: MIGRATION_ID,
  authorityStatusVerifiedAt: new Date(entry.verifiedAt), authorityStatusEvidence: entry.evidence,
});

const run = async (): Promise<void> => {
  const dryRun = isDryRun() || !process.argv.includes("--apply");
  const mongo = new MongoService(); await mongo.connect();
  try {
    const chunks = ragConnection.db!.collection("legal_chunks");
    const changes = ragConnection.db!.collection("corpus_governance_changes");
    const results: Array<{ authorityId: string; matched: number; pending: number }> = [];
    for (const entry of authorityStatusRegistry.filter((item) => item.safeToDisableLegacyRetrieval)) {
      const candidates = (await chunks.find(baseFilter(entry), { projection: { embedding: 0, text: 0 } }).toArray()) as Chunk[];
      const matched = candidates.filter((chunk) => matchesAuthorityEntry(chunk, entry));
      const pending = matched.filter((chunk) => !(chunk.corpusReleaseId === MIGRATION_ID && chunk.authorityId === entry.authorityId && chunk.is_retrievable === false));
      if (!dryRun && pending.length > 0) {
        const now = new Date();
        await changes.bulkWrite(pending.map((chunk) => ({ updateOne: {
          filter: { migrationId: MIGRATION_ID, chunkMongoId: chunk._id },
          update: { $setOnInsert: { migrationId: MIGRATION_ID, chunkMongoId: chunk._id,
            chunkId: chunk.chunk_id, authorityId: entry.authorityId,
            previous: previous(chunk), createdAt: now } }, upsert: true,
        } })), { ordered: false });
        await chunks.bulkWrite(pending.map((chunk) => ({ updateOne: {
          filter: { _id: chunk._id as never }, update: { $set: values(entry) },
        } })), { ordered: false });
      }
      results.push({ authorityId: entry.authorityId, matched: matched.length, pending: pending.length });
    }
    if (!dryRun) await changes.createIndex({ migrationId: 1, chunkMongoId: 1 }, { unique: true, name: "migration_chunk_unique" });
    console.log(JSON.stringify({ migrationId: MIGRATION_ID, dryRun,
      database: ragConnection.db!.databaseName, collection: "legal_chunks", results,
      totalMatched: results.reduce((sum, item) => sum + item.matched, 0),
      totalPending: results.reduce((sum, item) => sum + item.pending, 0),
      note: "This verifies authority status only; it never marks legacy text as published." }, null, 2));
  } finally { await mongo.close(); }
};
run().catch((error) => { console.error("migrate:verified-authority-statuses failed: " + (error instanceof Error ? error.message : "unknown error")); process.exitCode = 1; });
