import mongoose from "mongoose";
import { env } from "../config/env";
import { ChunkModel } from "../models/chunk.model";
import { parseLegalReference } from "../utils/legal-ref-parser";

// ── Regexes applied directly against the text field (النقض header format) ────
// Format: "... الطعن رقم 0513 لسنة 16 مكتب فنى 19 صفحة رقم 316 بتاريخ 28-04-1974 الموضوع : ..."
const APPEAL_FROM_TEXT_RE = /الطعن\s+رقم\s+([\d٠-٩]+)/i;
const JUD_YEAR_FROM_TEXT_RE = /لسنة\s+([\d٠-٩]{1,4})\s+مكتب/i;
const DATE_FROM_TEXT_RE = /بتاريخ\s+([\d\-\/]+)/;
const SUBJECT_FROM_TEXT_RE = /الموضوع\s*:\s*([^\n\r،.]{3,60})/;

const ARABIC_TO_WESTERN: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};
const normalizeDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => ARABIC_TO_WESTERN[d] ?? d);

async function runMigration() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.mongodbUri, { dbName: env.mongodbDb });
  console.log("Connected successfully.");

  const totalDocuments = await ChunkModel.countDocuments();
  console.log(`Starting migration for ${totalDocuments} documents...`);
  console.log("Pass 1: law_number / law_year / paragraphs / clauses");
  console.log(
    "Pass 2: appeal_number / judicial_year / ruling_date / case_subject (from text)",
  );

  const batchSize = 1000;
  let processed = 0;
  let updatedCount = 0;

  // We'll iterate using lean() and skip/limit to avoid CursorNotFound
  for (let skip = 0; skip < totalDocuments; skip += batchSize) {
    const docs = await ChunkModel.find({}).lean().skip(skip).limit(batchSize);
    const bulkOps = [];

    for (const doc of docs) {
      let hasChanges = false;
      const updates: any = {};

      // ── Pass 1: extract from law_name_normalized + hierarchy_path ────────────
      const fullContext = `${doc.law_name_normalized ?? ""} ${doc.hierarchy_path ?? ""}`;
      const parsedRef = parseLegalReference(fullContext);

      if (parsedRef.lawNumber && doc.law_number !== parsedRef.lawNumber) {
        updates.law_number = parsedRef.lawNumber;
        hasChanges = true;
      }
      if (parsedRef.lawYear && doc.law_year !== parsedRef.lawYear) {
        updates.law_year = parsedRef.lawYear;
        hasChanges = true;
      }
      // paragraphs / clauses are not in the typed schema (strict:false allows
      // them in MongoDB) so we cast via `unknown` to read the stored value.
      const docAny = doc as unknown as Record<string, unknown>;
      if (
        parsedRef.paragraphs.length > 0 &&
        JSON.stringify(docAny.paragraphs) !==
          JSON.stringify(parsedRef.paragraphs)
      ) {
        updates.paragraphs = parsedRef.paragraphs;
        hasChanges = true;
      }
      if (
        parsedRef.clauses.length > 0 &&
        JSON.stringify(docAny.clauses) !== JSON.stringify(parsedRef.clauses)
      ) {
        updates.clauses = parsedRef.clauses;
        hasChanges = true;
      }
      // ── Pass 2: extract court ruling metadata from the text field ────────────
      const text = doc.text ?? "";

      const appealMatch = APPEAL_FROM_TEXT_RE.exec(text);
      const judYearMatch = JUD_YEAR_FROM_TEXT_RE.exec(text);
      const dateMatch = DATE_FROM_TEXT_RE.exec(text);
      const subjectMatch = SUBJECT_FROM_TEXT_RE.exec(text);

      if (appealMatch) {
        const val =
          normalizeDigits(appealMatch[1]).replace(/^0+/, "") || appealMatch[1];
        if (doc.appeal_number !== val) {
          updates.appeal_number = val;
          hasChanges = true;
        }
      }
      if (judYearMatch) {
        const val =
          normalizeDigits(judYearMatch[1]).replace(/^0+/, "") ||
          judYearMatch[1];
        if (doc.judicial_year !== val) {
          updates.judicial_year = val;
          hasChanges = true;
        }
      }
      if (dateMatch) {
        const val = dateMatch[1].trim();
        if (doc.ruling_date !== val) {
          updates.ruling_date = val;
          hasChanges = true;
        }
      }
      if (subjectMatch) {
        const val = subjectMatch[1].trim();
        if (doc.case_subject !== val) {
          updates.case_subject = val;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: updates },
          },
        });
      }
      processed++;
    }

    if (bulkOps.length > 0) {
      await ChunkModel.bulkWrite(bulkOps);
      updatedCount += bulkOps.length;
    }

    console.log(
      `Progress: ${processed} / ${totalDocuments} processed. Updated: ${updatedCount}`,
    );
  }

  console.log("─────────────────────────────────────────");
  console.log("✅ Migration completed successfully.");
  console.log(`Total Processed : ${processed}`);
  console.log(`Total Updated   : ${updatedCount}`);
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
