import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoService, ragConnection } from "../services/mongo.service";
import { isDryRun } from "./script-utils";

const AUTHORITY_ID = "eg-law-14-2025-labor";
const AUTHORITY_TITLE = "قانون العمل الصادر بالقانون رقم 14 لسنة 2025";
const RELEASE_ID = "eg-official-2026-07-30-v1";
const SOURCE_URL = "https://www.labour.gov.eg/media/0iedik3q/القانون-رقم-14-لسنة-2025-بإصدار-قانون-العمل.pdf";
const DEFAULT_INPUT = resolve(process.cwd(), "corpus", "official", "eg-law-14-2025-labor.txt");

const westernDigits = (value: string): string => value
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const cleanArticleText = (articleNumber: number, body: string): string => {
  const cleaned = body.split(/\r?\n/)
    .filter((line) => !/الج[رـ]?ی?دة\s+الرسمیة|الجريدة\s+الرسمية/.test(line) && !/^\s*[0-9٠-٩۰-۹]+\s*$/.test(line))
    .map((line) => line.replace(/[ـ]/g, "").replace(/اال/g, "الا").replace(/األ/g, "الأ").replace(/اإل/g, "الإ").replace(/اآل/g, "الآ").replace(/(^|\s)وال(?=\s)/g, "$1ولا").replace(/(^|\s)فال(?=\s)/g, "$1فلا").replace(/(^|\s)ال(?=\s|[،؛:.])/g, "$1لا").replace(/\s+/g, " ").trim())
    .filter(Boolean).join("\n").replace(/\s+([،؛:.])/g, "$1").trim();
  return "مادة (" + articleNumber + "):\n" + cleaned;
};
const parseArticles = (text: string) => {
  const heading = /^مادة\s*\(([0-9٠-٩۰-۹]+)\)\s*:\s*$/gm;
  const matches = [...text.matchAll(heading)];
  return matches.map((match, index) => {
    const number = Number(westernDigits(match[1] ?? ""));
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? text.length;
    return { articleNumber: number, text: cleanArticleText(number, text.slice(bodyStart, bodyEnd)) };
  });
};

const run = async (): Promise<void> => {
  const dryRun = isDryRun() || !process.argv.includes("--apply");
  const inputArgIndex = process.argv.indexOf("--input");
  const inputPath = inputArgIndex >= 0 ? resolve(process.argv[inputArgIndex + 1] ?? "") : DEFAULT_INPUT;
  const sourceText = await readFile(inputPath, "utf8");
  const articles = parseArticles(sourceText);
  const numbers = articles.map((article) => article.articleNumber);
  if (articles.length !== 298 || numbers.some((number, index) => number !== index + 1)) {
    throw new Error("Expected the complete Article 1-298 sequence; parsed " + articles.length + ".");
  }
  const short = articles.filter((article) => article.text.length < 30);
  if (short.length > 0) throw new Error("Suspiciously short articles: " + short.map((article) => article.articleNumber).join(", "));
  const reviewedAt = new Date("2026-07-30T00:00:00.000Z");
  const documents = articles.map((article) => {
    const articleKey = AUTHORITY_ID + ":article:" + article.articleNumber;
    const chunkId = sha256(articleKey).slice(0, 32);
    return {
      chunk_id: chunkId, document_id: AUTHORITY_ID, parent_chunk_id: chunkId, child_index: -1,
      text: article.text, embedding_text: article.text, law_name: AUTHORITY_TITLE,
      law_name_normalized: "قانون العمل 14 لسنة 2025", law_category: "العمل",
      article_number: String(article.articleNumber), law_number: "14", law_year: "2025",
      semantic_unit: "article", hierarchy_path: AUTHORITY_TITLE + " > المادة " + article.articleNumber,
      source_dataset: "egyptian_official_gazette", language: "ar",
      source_file: "egypt-labor-law-14-2025.pdf", text_len: article.text.length,
      is_retrievable: true, authorityId: AUTHORITY_ID, authorityTitleOfficial: AUTHORITY_TITLE,
      authorityTitleNormalized: "قانون العمل 14 لسنة 2025", jurisdiction: "EG",
      authorityType: "statute", authorityStatus: "effective", effectiveFrom: "2025-09-01",
      textStatus: "extracted", officialSourceUrl: SOURCE_URL, reviewStatus: "published",
      reviewedBy: "codex-official-source-structure-check", reviewedAt, corpusReleaseId: RELEASE_ID,
      sourceTextHash: sha256(article.text),
      verificationMethod: "Official Ministry PDF; normalized embedded text; complete unique Article 1-298 sequence.",
    };
  });
  if (dryRun) {
    console.log(JSON.stringify({ dryRun, inputPath, sourceFileHash: sha256(sourceText),
      articleCount: documents.length, firstArticleLength: documents[0]?.text_len,
      lastArticleLength: documents.at(-1)?.text_len, releaseId: RELEASE_ID }, null, 2));
    return;
  }
  const mongo = new MongoService(); await mongo.connect();
  try {
    const chunks = ragConnection.db!.collection("legal_chunks");
    const existing = await chunks.find({ authorityId: AUTHORITY_ID }, { projection: { chunk_id: 1, sourceTextHash: 1 } }).toArray();
    const existingById = new Map(existing.map((document) => [String(document.chunk_id), document.sourceTextHash]));
    await chunks.bulkWrite(documents.map((document) => {
      const changed = existingById.has(document.chunk_id) && existingById.get(document.chunk_id) !== document.sourceTextHash;
      return { updateOne: { filter: { chunk_id: document.chunk_id }, update: {
        $set: document,
        ...(changed ? { $unset: { embedding: "", embeddingModel: "", embeddingDim: "", embeddingContentHash: "", embeddingUpdatedAt: "" } } : {}),
      }, upsert: true } };
    }), { ordered: false });
    const stored = await chunks.countDocuments({ authorityId: AUTHORITY_ID, reviewStatus: "published", is_retrievable: true });
    console.log(JSON.stringify({ dryRun, database: ragConnection.db!.databaseName,
      articleCount: documents.length, stored, releaseId: RELEASE_ID }, null, 2));
  } finally { await mongo.close(); }
};
run().catch((error) => { console.error("import:official-labor-law-2025 failed: " + (error instanceof Error ? error.message : "unknown error")); process.exitCode = 1; });
