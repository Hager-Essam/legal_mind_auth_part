import { performance } from "node:perf_hooks";
import mongoose from "mongoose";
import { env } from "./conversation.config";
import {
  LegalChunks, QueryRequest, QueryResponse,
  ParsedLegalReference, RewriteResult, ClassificationResult,
  GroundingDecision, SearchOptions, ProviderSummary,
  TASHKEEL_RE, TATWEEL_RE, ARABIC_TO_WESTERN_DIGITS,
  ARTICLES_RE, PARAGRAPHS_RE, CLAUSES_RE, LAW_NAME_RE, APPEAL_RE, JUDICIAL_YEAR_RE,
  CHAT_RE,
} from "./conversation.types";

// ════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════

// ── arabic-normalize ────────────────────────────────────────────
const normalizeArabicQuery = (text: string): string =>
  text
    .replace(TASHKEEL_RE, "").replace(TATWEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => ARABIC_TO_WESTERN_DIGITS[d] ?? d)
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const normalizeLawName = (text: string): string =>
  text
    .replace(TASHKEEL_RE, "").replace(TATWEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => ARABIC_TO_WESTERN_DIGITS[d] ?? d)
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// ── legal-ref-parser ────────────────────────────────────────────
const normalizeArabicDigits = (text: string): string =>
  text.replace(/[٠-٩]/g, (digit) => ARABIC_TO_WESTERN_DIGITS[digit] ?? digit);

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();
const stripTrailingPunctuation = (lawName: string): string => normalizeWhitespace(lawName.replace(/[؟?.!,،]+$/g, ""));

const parseNumbers = (text: string): string[] => {
  const normalized = normalizeArabicDigits(text);
  const rangeMatch = normalized.match(/(\d+)\s*(?:-|إلى|الى|حتى)\s*(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10), end = parseInt(rangeMatch[2], 10);
    if (start < end && end - start < 1149) {
      const nums: string[] = [];
      for (let i = start; i <= end; i++) nums.push(i.toString());
      return nums;
    }
  }
  return normalized.match(/\d+/g) ?? [];
};

const extractSection = (text: string, keywordRegex: RegExp): string[] => {
  const match = text.match(keywordRegex);
  return match ? parseNumbers(match[1]) : [];
};

const extractLawInfo = (text: string) => {
  const match = text.match(LAW_NAME_RE);
  if (!match?.[1]) return { lawName: null, lawNumber: null, lawYear: null };
  const rawLawName = stripTrailingPunctuation(match[1]);
  if (rawLawName.length === 0) return { lawName: null, lawNumber: null, lawYear: null };
  const normalizedName = normalizeArabicDigits(rawLawName);
  return {
    lawName: rawLawName,
    lawNumber: normalizedName.match(/(?:رقم)\s*(\d+)/i)?.[1] ?? null,
    lawYear: normalizedName.match(/(?:لسنة|لعام|سنة|عام)\s*(\d{4})/i)?.[1] ?? null,
  };
};

const extractAppealInfo = (text: string) => {
  const normalized = normalizeArabicDigits(text);
  return {
    appealNumber: normalized.match(APPEAL_RE)?.[1] ?? null,
    judicialYear: normalized.match(JUDICIAL_YEAR_RE)?.[1] ?? null,
  };
};

export const parseLegalReference = (text: string): ParsedLegalReference => {
  const articleNumbers = extractSection(text, ARTICLES_RE);
  const { lawName, lawNumber, lawYear } = extractLawInfo(text);
  const { appealNumber, judicialYear } = extractAppealInfo(text);
  return {
    normalizedQuery: normalizeWhitespace(text),
    articleNumber: articleNumbers.length > 0 ? articleNumbers[0] : null,
    articleNumbers, paragraphs: extractSection(text, PARAGRAPHS_RE), clauses: extractSection(text, CLAUSES_RE),
    lawName, lawNumber, lawYear, appealNumber, judicialYear,
  };
};

// ── regex helper ────────────────────────────────────────────────
const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── evidence-selection ──────────────────────────────────────────
const QUERY_STOP_WORDS = new Set([
  "ما", "ماذا", "ماهي", "ما هي", "هل", "عن", "على", "في", "من", "الى", "إلى",
  "كيف", "شرح", "اشرح", "أشرح", "اريد", "أريد", "بشأن", "حول", "ذلك", "هذه",
  "هذا", "مع", "أو", "او", "ثم", "تم", "التي", "الذي", "التى", "الذى",
]);

const tokenize = (value: string): string[] =>
  normalizeArabicQuery(value).split(" ").map((t) => t.trim()).filter((t) => t.length > 1 && !QUERY_STOP_WORDS.has(t));

const getChunkText = (chunk: LegalChunks): string =>
  `${chunk.law_name_normalized || ""} ${chunk.law_category || ""} ${chunk.article_number ?? ""} ${chunk.content}`;

const getSimilarityScore = (chunk: LegalChunks): number => {
  const v = chunk.similarity_score;
  if (typeof v !== "number" || v < 0) return 0;
  return v > 1 ? 1 : v;
};

const getSemanticUnitBoost = (chunk: LegalChunks): number => {
  const u = chunk.semantic_unit;
  return u === "obligation" ? 0.1 : u === "right" ? 0.08 : u === "penalty" ? 0.12 : u === "definition" ? 0.06 : 0;
};

const getCitationBoost = (chunk: LegalChunks): number => {
  const hasLaw = typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim().length > 0;
  const hasArt = typeof chunk.article_number === "string" && chunk.article_number.trim().length > 0;
  return hasLaw && hasArt ? 0.08 : hasLaw || hasArt ? 0.04 : 0;
};

const getArticleMatchBoost = (question: string, chunk: LegalChunks): number => {
  if (!chunk.article_number) return 0;
  return normalizeArabicQuery(question).includes(chunk.article_number.trim()) ? 0.2 : 0;
};

const getDeepStructureBoost = (question: string, chunk: LegalChunks): number => {
  const parsed = parseLegalReference(question);
  let boost = 0;
  const searchable = `${chunk.hierarchy_path ?? ""} ${chunk.content}`;
  for (const p of parsed.paragraphs) {
    if (/الفقر[ةه]\s*(رقم\s*)?/.test(searchable) && searchable.includes(p)) boost += 0.3;
  }
  for (const c of parsed.clauses) {
    if (/البند\s*(رقم\s*)?/.test(searchable) && searchable.includes(c)) boost += 0.3;
  }
  return boost;
};

const scoreEvidenceChunk = (question: string, chunk: LegalChunks): number => {
  const qTokens = tokenize(question);
  const cTokens = new Set(tokenize(getChunkText(chunk)));
  const overlap = qTokens.filter((t) => cTokens.has(t)).length;
  const overlapScore = qTokens.length === 0 ? 0 : overlap / qTokens.length;
  return Math.max(0, Math.min(
    getSimilarityScore(chunk) * 0.45 + overlapScore * 0.35 + getSemanticUnitBoost(chunk) + getCitationBoost(chunk) + getArticleMatchBoost(question, chunk) + getDeepStructureBoost(question, chunk),
    1,
  ));
};

const deduplicateEvidence = (chunks: LegalChunks[]): LegalChunks[] => {
  const best = new Map<string, LegalChunks>();
  for (const c of chunks) {
    const key = c.chunk_id.trim().length > 0 ? c.chunk_id : normalizeArabicQuery(c.content).slice(0, 500);
    const existing = best.get(key);
    if (!existing || getSimilarityScore(c) > getSimilarityScore(existing)) best.set(key, c);
  }
  return Array.from(best.values());
};

// ── grounding-policy ────────────────────────────────────────────
const evaluateGrounding = (chunks: LegalChunks[]): GroundingDecision => {
  if (chunks.length === 0) return { shouldGenerate: false, refusalAnswer: "لم يتم العثور على أدلة قانونية كافية للإجابة عن السؤال بشكل موثوق." };
  const scores = chunks.map((c) => c.rerank_score).filter((v): v is number => typeof v === "number");
  const topScore = scores.length === 0 ? 0 : Math.max(...scores);
  const citedCount = chunks.filter((c) => {
    return (typeof c.law_name_normalized === "string" && c.law_name_normalized.trim().length > 0)
      || (typeof c.article_number === "string" && c.article_number.trim().length > 0)
      || (typeof c.appeal_number === "string" && c.appeal_number.trim().length > 0)
      || (typeof c.case_subject === "string" && c.case_subject.trim().length > 0);
  }).length;
  if (topScore < 0.35 || citedCount === 0) {
    return { shouldGenerate: false, refusalAnswer: "الأدلة القانونية المسترجعة غير كافية لتقديم إجابة موثوقة ومدعومة بنص صريح. يرجى إعادة صياغة السؤال أو تحديد القانون أو المادة بشكل أدق." };
  }
  return { shouldGenerate: true };
};

// ── context-builder ─────────────────────────────────────────────
const buildChunkCitation = (chunk: LegalChunks): string => {
  if (chunk.appeal_number) {
    const y = chunk.judicial_year ? ` لسنة ${chunk.judicial_year}` : "";
    const d = chunk.ruling_date ? ` - بتاريخ ${chunk.ruling_date}` : "";
    const s = chunk.case_subject ? ` - ${chunk.case_subject.trim()}` : "";
    return `[حكم النقض - الطعن رقم ${chunk.appeal_number}${y}${d}${s}]`;
  }
  const law = (typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim().length > 0)
    ? chunk.law_name_normalized.trim() : "التشريع المصري";
  const art = chunk.article_number?.trim() ? ` - المادة ${chunk.article_number.trim()}` : "";
  const cat = (typeof chunk.law_category === "string" && chunk.law_category.trim().length > 0) ? ` - ${chunk.law_category.trim()}` : "";
  const src = (typeof chunk.source_dataset === "string" && chunk.source_dataset.trim().length > 0) ? ` - ${chunk.source_dataset.trim()}` : "";
  return `[المصدر: ${law}${art}${cat}${src}]`;
};

const buildArabicLegalContext = (chunks: LegalChunks[]): string =>
  chunks.map((c) => `${buildChunkCitation(c)}\n${c.content.trim()}`).filter((e) => e.trim().length > 0).join("\n\n---\n\n");

// ── rrf ─────────────────────────────────────────────────────────
const reciprocalRankFusion = (resultLists: LegalChunks[][], k = 60): LegalChunks[] => {
  const entries = new Map<string, { chunk: LegalChunks; score: number }>();
  for (const list of resultLists) {
    list.forEach((chunk, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = entries.get(chunk.chunk_id);
      if (existing) existing.score += contribution;
      else entries.set(chunk.chunk_id, { chunk, score: contribution });
    });
  }
  return Array.from(entries.values())
    .sort((a, b) => b.score - a.score)
    .map(({ chunk, score }) => ({ ...chunk, rrf_score: Number(score.toFixed(6)) }));
};

// ── chunk-mapper ────────────────────────────────────────────────
function toLegalChunk(doc: any, score?: number): LegalChunks {
  const s = typeof score === "number" ? Number(score.toFixed(6)) : undefined;
  const get = (k: string) => doc[k] as string | undefined;
  const obj: LegalChunks = {
    chunk_id: get("chunk_id") ?? String(doc._id ?? ""),
    content: (doc.text as string) ?? "",
    law_name_normalized: get("law_name_normalized") ?? "",
    law_category: get("law_category") ?? "",
    source_dataset: get("source_dataset") ?? "",
    language: get("language") ?? "",
    semantic_unit: get("semantic_unit") ?? "",
    hierarchy_path: get("hierarchy_path") ?? "",
    is_retrievable: (doc.is_retrievable as boolean) ?? true,
    text_len: (doc.text_len as number) ?? 0,
  };
  if (get("source_file")) obj.source_file = get("source_file");
  if (get("article_number")) obj.article_number = get("article_number");
  if (get("law_number")) obj.law_number = get("law_number");
  if (get("law_year")) obj.law_year = get("law_year");
  if (get("appeal_number")) obj.appeal_number = get("appeal_number");
  if (get("judicial_year")) obj.judicial_year = get("judicial_year");
  if (get("ruling_date")) obj.ruling_date = get("ruling_date");
  if (get("case_subject")) obj.case_subject = get("case_subject");
  if (typeof doc.child_index === "number") obj.child_index = doc.child_index as number;
  if (get("parent_chunk_id")) obj.parent_chunk_id = get("parent_chunk_id");
  if (s !== undefined) obj.similarity_score = s;
  return obj;
}

// ── law-mapping ─────────────────────────────────────────────────
const RAW_LAW_MAPPING: Record<string, string> = {
  شركات: "قانون الشركات رقم 159 لسنة 1981",
  "شركة ذات مسؤولية محدودة": "قانون الشركات رقم 159 لسنة 1981 المادة 4",
  شغل: "قانون العمل رقم 12 لسنة 2003", عمل: "قانون العمل رقم 12 لسنة 2003",
  عامل: "قانون العمل رقم 12 لسنة 2003", "عقد عمل": "قانون العمل رقم 12 لسنة 2003",
  اجر: "قانون العمل رقم 12 لسنة 2003", رواتب: "قانون العمل رقم 12 لسنة 2003",
  نصب: "جريمة النصب المادة 336 من قانون العقوبات",
  سرقة: "جريمة السرقة المادة 311 من قانون العقوبات",
  اختلاس: "جريمة الاختلاس المادة 119 من قانون العقوبات",
  رشوة: "جريمة الرشوة المادة 103 من قانون العقوبات",
  قتل: "جريمة القتل من قانون العقوبات",
  جرائم: "قانون العقوبات", عقوبة: "قانون العقوبات",
  ايجار: "قانون الايجارات رقم 4 لسنة 1996",
  طلاق: "قانون الاحوال الشخصية", نفقة: "قانون الاحوال الشخصية",
  حضانة: "قانون الاحوال الشخصية", ميراث: "قانون الاحوال الشخصية",
  جمارك: "قانون الجمارك رقم 66 لسنة 1963",
  ضرائب: "قانون الضرائب على الدخل رقم 91 لسنة 2005",
  تحقيق: "قانون الإجراءات الجنائية", نيابة: "قانون الإجراءات الجنائية",
  دعوى: "قانون المرافعات المدنية والتجارية", محكمة: "قانون المرافعات المدنية والتجارية",
  عقد: "القانون المدني", التزام: "القانون المدني",   مسؤولية: "القانون المدني",
  شهادة: "قانون الإثبات", ادلة: "قانون الإثبات",
  بيئة: "قانون حماية البيئة رقم 4 لسنة 1994",
  طفل: "قانون الطفل رقم 12 لسنة 1996",
  عسكري: "قانون الخدمة العسكرية والوطنية",
  "مجلس الدولة": "قانون مجلس الدولة",
  تحكيم: "قانون التحكيم",
  اسهم: "قانون تنظيم سوق رأس المال",
  مناقصة: "قانون المناقصات والمزايدات",
};

const SORTED_MAPPINGS = Object.entries(RAW_LAW_MAPPING)
  .map(([key, value]) => ({ key: normalizeArabicQuery(key), value, normalizedValue: normalizeArabicQuery(value) }))
  .sort((a, b) => b.key.length - a.key.length);

const rewriteWithMapping = (normalizedQuery: string) => {
  for (const { key, value, normalizedValue } of SORTED_MAPPINGS) {
    if (key.length === 0) continue;
    if (normalizedQuery.includes(key)) {
      if (normalizedQuery.includes(normalizedValue)) return { matched: true, rewritten: normalizedQuery, matchedTerm: key, appendedLaw: null };
      return { matched: true, rewritten: `${normalizedQuery} ${value}`, matchedTerm: key, appendedLaw: value };
    }
  }
  return { matched: false, rewritten: normalizedQuery, matchedTerm: null as string | null, appendedLaw: null as string | null };
};

// ════════════════════════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════════════════════════

// ── ProviderConfigService ───────────────────────────────────────
let keyIndex = 0;
const getProviderSummary = (): ProviderSummary => ({
  llmProvider: "modelstudio",
  baseUrl: env.dashscopeCompatUrl, llmModel: env.llmModel,
  llmModelFallback: env.llmModelFallback, embeddingModel: env.embeddingModel,
  embeddingDim: env.embeddingDim, configuredKeys: env.dashscopeApiKeys.length,
  llmConfigured: env.dashscopeApiKeys.length > 0,
});

const getDashScopeApiKey = (): string => {
  const keys = env.dashscopeApiKeys;
  if (keys.length === 0) throw new Error("No DashScope API keys configured.");
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
};

// ── MongoService ────────────────────────────────────────────────
const COLLECTION_NAME = "legal_chunks";
const chunkSchema = new mongoose.Schema(
  {
    chunk_id: { type: String }, document_id: { type: String }, parent_chunk_id: { type: String },
    child_index: { type: Number }, text: { type: String }, embedding_text: { type: String },
    law_name: { type: String }, law_name_normalized: { type: String }, law_category: { type: String },
    article_number: { type: String }, law_number: { type: String }, law_year: { type: String },
    appeal_number: { type: String }, judicial_year: { type: String }, ruling_date: { type: String },
    case_subject: { type: String }, semantic_unit: { type: String }, hierarchy_path: { type: String },
    source_dataset: { type: String }, language: { type: String }, source_file: { type: String },
    text_len: { type: Number }, is_retrievable: { type: Boolean }, embedding: { type: [Number] },
  },
  { collection: COLLECTION_NAME, strict: false },
);

export let convConnection: mongoose.Connection;
let ChunkModel: mongoose.Model<any>;

export const mongoConnect = async (): Promise<void> => {
  if (convConnection?.readyState === 1) return;
  convConnection = mongoose.createConnection(env.mongodbUri, { dbName: env.mongodbDb });
  ChunkModel = convConnection.model("LegalChunk", chunkSchema);
  ConversationModel = convConnection.model<IConversationDoc>("Conversation", conversationSchema);
  console.log(`[Conversation] Connected to MongoDB: ${env.mongodbUri.replace(/\/\/.*@/, "//***@")} / ${env.mongodbDb}`);
};

export const mongoClose = async (): Promise<void> => {
  if (convConnection) await convConnection.close();
};

// ── EmbeddingService ────────────────────────────────────────────
const embedQuery = async (text: string): Promise<number[]> => {
  const provider = getProviderSummary();
  const apiKey = getDashScopeApiKey();
  const response = await fetch(`${provider.baseUrl}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: provider.embeddingModel, input: [text], input_type: "query" }),
  });
  const raw = await response.text();
  if (!raw || !raw.trim()) throw new Error(`DashScope embeddings empty (status ${response.status})`);
  const payload = JSON.parse(raw) as { output?: { embeddings?: Array<{ embedding?: number[] }> }; data?: Array<{ embedding?: number[] }> };
  if (!response.ok) throw new Error(`DashScope embeddings failed with status ${response.status}`);
  const embeddings = payload.output?.embeddings?.map((e) => e.embedding).filter((e): e is number[] => Array.isArray(e))
    ?? payload.data?.map((e) => e.embedding).filter((e): e is number[] => Array.isArray(e)) ?? [];
  if (embeddings.length === 0) throw new Error("DashScope returned no query embedding.");
  return embeddings[0];
};

// ── RetrievalService ────────────────────────────────────────────
const VECTOR_INDEX_NAME = "legal_chunks_vector";
const ATLAS_SEARCH_INDEX_NAME = "legal_chunks_text";
const MAX_PARENT_CHARS = 4000;

function extractContextWindow(parentText: string, childText: string, maxChars: number): string {
  if (parentText.length <= maxChars) return parentText;
  const probe = childText.slice(0, 120).trim();
  const matchIdx = probe.length > 0 ? parentText.indexOf(probe) : -1;
  if (matchIdx === -1) return parentText.slice(0, maxChars) + " …";
  const half = Math.floor(maxChars / 2);
  let start = Math.max(0, matchIdx - half);
  let end = Math.min(parentText.length, start + maxChars);
  if (end - start < maxChars) start = Math.max(0, end - maxChars);
  return (start > 0 ? "… " : "") + parentText.slice(start, end) + (end < parentText.length ? " …" : "");
}

const vectorSearch = async (queryVector: number[], options: SearchOptions = {}): Promise<any[]> => {
  if (queryVector.length === 0) return [];
  const topK = options.topK ?? env.retrievalTopK;
  const filter: any = { is_retrievable: { $eq: true } };
  if (options.lawCategory) filter.law_category = { $eq: options.lawCategory };
  if (options.lawNumber) filter.law_number = { $eq: options.lawNumber };
  if (options.lawYear) filter.law_year = { $eq: options.lawYear };
  if (options.appealNumber) filter.appeal_number = { $eq: options.appealNumber };
  if (options.judicialYear) filter.judicial_year = { $eq: options.judicialYear };
  return ChunkModel.aggregate([
    { $vectorSearch: { index: VECTOR_INDEX_NAME, path: "embedding", queryVector, numCandidates: Math.max(topK * 10, 50), limit: topK, filter } },
    { $addFields: { score: { $meta: "vectorSearchScore" } } },
  ]);
};

const textSearch = async (query: string, options: SearchOptions = {}): Promise<any[]> => {
  const topK = options.topK ?? env.sparseTopK;
  const mustClauses: any[] = [{ equals: { path: "is_retrievable", value: true } }];
  if (options.lawCategory) mustClauses.push({ phrase: { path: "law_category", query: options.lawCategory } });
  if (options.lawNumber) mustClauses.push({ phrase: { path: "law_number", query: options.lawNumber } });
  if (options.lawYear) mustClauses.push({ phrase: { path: "law_year", query: options.lawYear } });
  if (options.appealNumber) mustClauses.push({ phrase: { path: "appeal_number", query: options.appealNumber } });
  if (options.judicialYear) mustClauses.push({ phrase: { path: "judicial_year", query: options.judicialYear } });
  return ChunkModel.aggregate([
    { $search: { index: ATLAS_SEARCH_INDEX_NAME, compound: { must: mustClauses, should: [
      { text: { query, path: "text", score: { boost: { value: 1.5 } } } },
      { text: { query, path: "law_name_normalized", score: { boost: { value: 2.0 } } } },
      { text: { query, path: "case_subject", score: { boost: { value: 1.8 } } } },
    ], minimumShouldMatch: 1 } } },
    { $addFields: { score: { $meta: "searchScore" } } },
    { $limit: topK },
  ]);
};

const retrieveCandidateChunks = async (request: QueryRequest, parsedRef?: ParsedLegalReference): Promise<LegalChunks[]> => {
  const ref = parsedRef ?? parseLegalReference(request.query);
  const queryVector = await embedQuery(request.query);
  const overfetch = Math.max(env.retrievalOverfetch, request.top_k * 3);
  const opts: SearchOptions = {
    topK: overfetch, lawCategory: request.law_category,
    lawNumber: ref.lawNumber ?? undefined, lawYear: ref.lawYear ?? undefined,
    appealNumber: ref.appealNumber ?? undefined, judicialYear: ref.judicialYear ?? undefined,
  };
  if (!env.enableHybridSearch) return (await vectorSearch(queryVector, opts)).map((d) => toLegalChunk(d, d.score));
  const [vectorDocs, keywordDocs] = await Promise.all([
    vectorSearch(queryVector, opts),
    textSearch(request.query, opts).catch(() => []),
  ]);
  const vectorResults = vectorDocs.map((d) => toLegalChunk(d, d.score));
  const keywordResults = keywordDocs.map((d) => toLegalChunk(d, d.score));
  if (keywordResults.length === 0) return vectorResults;
  return reciprocalRankFusion([vectorResults, keywordResults], env.rrfK);
};

const findByArticle = async (parsedRef?: ParsedLegalReference) => {
  const articleNumber = parsedRef?.articleNumber, lawName = parsedRef?.lawName;
  if (!articleNumber || !lawName) return null;
  const normName = normalizeLawName(lawName);
  const words = normName.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return null;
  const nameRegex = words.map((w) => escapeRegex(w)).join(".*");
  const filter: any = { article_number: articleNumber, law_name_normalized: { $regex: nameRegex, $options: "i" }, child_index: { $in: [-1, null] } };
  if (parsedRef?.lawNumber) filter.law_number = parsedRef.lawNumber;
  if (parsedRef?.lawYear) filter.law_year = parsedRef.lawYear;
  const parent = await ChunkModel.findOne(filter).sort({ text_len: -1 }).lean() as any | null;
  if (!parent) return null;
  const children = await ChunkModel.find({ parent_chunk_id: parent.chunk_id, child_index: { $gte: 0 }, is_retrievable: true }).lean();
  return { ...parent, _children: children };
};

const findByAppeal = async (appealNumber: string, judicialYear?: string | null) => {
  const filter: any = { appeal_number: appealNumber, child_index: { $in: [-1, null] } };
  if (judicialYear) filter.judicial_year = judicialYear;
  const parent = await ChunkModel.findOne(filter).sort({ text_len: -1 }).lean() as any | null;
  if (!parent) return null;
  const children = await ChunkModel.find({ parent_chunk_id: parent.chunk_id, child_index: { $gte: 0 }, is_retrievable: true }).lean();
  return { ...parent, _children: children };
};

const expandWithParentContext = async (chunks: LegalChunks[]): Promise<LegalChunks[]> => {
  const parentIds = [...new Set(chunks.filter((c) => typeof c.child_index === "number" && c.child_index >= 0 && typeof c.parent_chunk_id === "string" && c.parent_chunk_id.length > 0).map((c) => c.parent_chunk_id as string))];
  if (parentIds.length === 0) return chunks;
  const parents = await ChunkModel.find({ chunk_id: { $in: parentIds } }, { chunk_id: 1, text: 1, text_len: 1 }).lean();
  const parentMap = new Map(parents.map((p) => [p.chunk_id ?? "", p] as const));
  return chunks.map((chunk) => {
    if (typeof chunk.child_index !== "number" || chunk.child_index < 0 || !chunk.parent_chunk_id) return chunk;
    const parent = parentMap.get(chunk.parent_chunk_id);
    if (!parent?.text) return chunk;
    const contextText = extractContextWindow(parent.text as string, chunk.content, MAX_PARENT_CHARS);
    return { ...chunk, content: contextText, text_len: contextText.length };
  });
};

// ── RerankerService ─────────────────────────────────────────────
const getRerankUrl = (baseUrl: string): string => `${baseUrl.replace("compatible-mode", "compatible-api")}/reranks`;
const RERANK_TIMEOUT_MS = 10_000;

const buildDocumentString = (chunk: LegalChunks): string => {
  const parts: string[] = [];
  if (typeof chunk.law_name_normalized === "string" && chunk.law_name_normalized.trim()) parts.push(chunk.law_name_normalized.trim());
  if (typeof chunk.article_number === "string" && chunk.article_number.trim()) parts.push(`مادة ${chunk.article_number.trim()}`);
  const header = parts.join(" | ");
  return header ? `[${header}]\n${chunk.content}` : chunk.content;
};

const rerankHeuristic = (question: string, chunks: LegalChunks[], topK: number): LegalChunks[] => {
  const ranked = chunks
    .map((c) => ({ ...c, rerank_score: Number(scoreEvidenceChunk(question, c).toFixed(6)) }))
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));
  return ranked.slice(0, Math.max(1, topK)).map((c, i) => ({ ...c, evidence_rank: i + 1 }));
};

const rerankWithLlm = async (question: string, chunks: LegalChunks[], topK: number): Promise<LegalChunks[]> => {
  const apiKey = getDashScopeApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);
  try {
    const response = await fetch(getRerankUrl(env.dashscopeCompatUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: env.llmRerankModel, query: question, documents: chunks.map(buildDocumentString), top_n: topK, return_documents: false }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text || !text.trim()) throw new Error("Rerank API returned empty response");
    const payload = JSON.parse(text) as { results?: Array<{ index: number; relevance_score: number }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? `Rerank API failed with status ${response.status}`);
    if (!Array.isArray(payload.results) || payload.results.length === 0) throw new Error("Rerank API returned empty results");
    return payload.results.map((r, rank) => ({ ...chunks[r.index], rerank_score: Number(r.relevance_score.toFixed(6)), evidence_rank: rank + 1 }));
  } finally { clearTimeout(timeoutId); }
};

const rerank = async (question: string, chunks: LegalChunks[], topK: number): Promise<LegalChunks[]> => {
  const deduplicated = deduplicateEvidence(chunks);
  if (env.enableLlmRerank && deduplicated.length > 0) {
    try { return await rerankWithLlm(question, deduplicated, topK); } catch { /* fallback */ }
  }
  return rerankHeuristic(question, deduplicated, topK);
};

// ── QueryRewriteService ─────────────────────────────────────────
const LLM_REWRITE_TIMEOUT_MS = 10_000;
const REWRITE_SYSTEM_PROMPT = `انت مساعد لتحسين الاستعلامات القانونية في مصر.
مهمتك اعادة صياغة السؤال ليكون اكثر دقه ووضوحا للبحث في القوانين المصريه.
قواعد: 1. حول اللغه العاميه الى مصطلحات قانونيه دقيقه 2. استخدم اسماء القوانين الصحيحه 3. لا تغير معنى السؤال 4. اعد كتابه السؤال بالعربيه فقط 5. لا تضف ارقام مواد الا اذا كنت متاكدا منها`;

const isArabicClean = (text: string): boolean => {
  if (!text || !text.trim()) return false;
  return !/[a-zA-Z]/.test(text.replace(/[\s\d]/g, ""));
};

const rewriteWithLlm = async (query: string): Promise<string> => {
  const apiKey = getDashScopeApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_REWRITE_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.dashscopeCompatUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: env.llmRewriteModel, messages: [{ role: "system", content: REWRITE_SYSTEM_PROMPT }, { role: "user", content: query }], temperature: 0.1, max_tokens: 256 }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text || !text.trim()) return query;
    const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? `LLM rewrite failed with status ${response.status}`);
    return payload.choices?.[0]?.message?.content?.trim() || query;
  } finally { clearTimeout(timeoutId); }
};

const mappingOnly = (query: string): RewriteResult => {
  const normalized = normalizeArabicQuery(query);
  const mappingResult = rewriteWithMapping(normalized);
  if (mappingResult.matched) return { originalQuery: query, rewrittenQuery: mappingResult.rewritten, usedMapping: true, usedLlm: false, mappingMatch: mappingResult.matchedTerm };
  return { originalQuery: query, rewrittenQuery: normalized, usedMapping: false, usedLlm: false, mappingMatch: null };
};

const rewriteQuery = async (query: string, userRole?: "lawyer" | "citizen"): Promise<RewriteResult> => {
  const role = userRole ?? env.defaultUserRole;
  if (role === "lawyer" || !env.enableQueryRewrite) return mappingOnly(query);
  try {
    const llmResult = await rewriteWithLlm(query);
    if (!isArabicClean(llmResult)) return mappingOnly(query);
    const normalizedLlm = normalizeArabicQuery(llmResult);
    const mappingResult = rewriteWithMapping(normalizedLlm);
    if (mappingResult.matched && mappingResult.appendedLaw) {
      return { originalQuery: query, rewrittenQuery: `${llmResult} ${mappingResult.appendedLaw}`, usedMapping: true, usedLlm: true, mappingMatch: mappingResult.matchedTerm };
    }
    return { originalQuery: query, rewrittenQuery: llmResult, usedMapping: mappingResult.matched, usedLlm: true, mappingMatch: mappingResult.matchedTerm };
  } catch { return mappingOnly(query); }
};

// ── ClassifierService ───────────────────────────────────────────
const classify = (request: QueryRequest): ClassificationResult => {
  const query = request.query.trim();
  const parsedReference = parseLegalReference(query);
  const hasLaw = parsedReference.articleNumbers.length > 0 || parsedReference.appealNumber || parsedReference.lawNumber || parsedReference.lawYear || (parsedReference.lawName && parsedReference.lawName.split(" ").length >= 2);
  if (hasLaw) return { category: "law_ref", parsedReference };
  if (CHAT_RE.test(query)) return { category: "chat" };
  return { category: "arabic_rag", parsedReference };
};

// ── LegalRefService ─────────────────────────────────────────────
const buildExactMatchAnswer = (doc: any): string => {
  const lawName = (doc.law_name as string) ?? "مرجع غير محدد";
  const articleNumber = (doc.article_number as string) ?? "غير معروف";
  const content = ((doc.text as string) ?? "").trim();
  return `تم العثور على المادة المطلوبة.\n\n[المصدر: ${lawName} - المادة ${articleNumber}]\n\n${content}`;
};

const buildRulingAnswer = (doc: any): string => {
  const appealNumber = (doc.appeal_number as string) ?? "غير معروف";
  const judicialYear = (doc.judicial_year as string) ?? "غير معروف";
  const date = (doc.ruling_date as string) ?? "";
  const subject = (doc.case_subject as string) ?? "";
  const datePart = date ? ` - بتاريخ ${date}` : "";
  const subjectPart = subject ? `\nالموضوع: ${subject}` : "";
  const content = ((doc.text as string) ?? "").trim();
  return `تم العثور على حكم النقض المطلوب.${subjectPart}\n\n[حكم النقض - الطعن رقم ${appealNumber} لسنة ${judicialYear}${datePart}]\n\n${content}`;
};

const buildMissingArticleNumberAnswer = (): string => "تعذر تحديد رقم المادة من السؤال. اذكر رقم المادة واسم القانون بصيغة أوضح.";

const buildNoExactMatchAnswer = (ref: ParsedLegalReference): string => {
  const target = ref.articleNumber && ref.lawName ? `المادة ${ref.articleNumber} من ${ref.lawName}` : ref.articleNumber ? `المادة ${ref.articleNumber}` : "المرجع القانوني المطلوب";
  return `لم يتم العثور على تطابق مباشر لـ ${target}. سيتم البحث في قاعدة البيانات للعثور على أقرب نص قانوني ذي صلة.`;
};

const buildNoRulingMatchAnswer = (ref: ParsedLegalReference): string => {
  const label = ref.judicialYear ? `الطعن رقم ${ref.appealNumber ?? "غير محدد"} لسنة ${ref.judicialYear}` : `الطعن رقم ${ref.appealNumber ?? "غير محدد"}`;
  return `لم يتم العثور على ${label} في قاعدة البيانات. سيتم البحث عن أقرب حكم ذي صلة.`;
};

// ── GenerationService ───────────────────────────────────────────
type DashScopeResponse = { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> | null } }>; error?: { message?: string; code?: string }; message?: string };

const GENERATION_TIMEOUT_MS = 30_000;

const CHAT_SYSTEM_PROMPT = `أنت مساعد قانوني مصري اسمه LegalMind. مهمتك مساعدة المستخدمين في الأسئلة القانونية المصرية.
قواعد: 1. أجب بالعربية الفصحى 2. كن مختصراً 3. إذا كان السؤال قانونياً، اقترح التوضيح 4. لا تخترع معلومات قانونية`;

const GROUNDED_SYSTEM_PROMPT = `أنت مستشار قانوني مصري متخصص. أجب حصرياً بناءً على النصوص القانونية في السياق.
ابدأ بالحكم القانوني الرئيسي، ثم فسّر الأساس القانوني، وأشر لكل نقطة بمصدرها [المصدر: اسم القانون - المادة N].
إذا لم تجد إجابة كافية، قل ذلك. لا تخترع مواداً قانونية.`;

const extractAnswerText = (payload: DashScopeResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((i) => i.text ?? "").join("").trim();
  return "";
};

const generateChatCompletion = async (model: string, systemPrompt: string, userContent: string, maxTokens: number): Promise<string> => {
  const apiKey = getDashScopeApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.dashscopeCompatUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }], temperature: 0.2, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text || !text.trim()) throw new Error(`DashScope empty response (status ${response.status})`);
    const payload = JSON.parse(text) as DashScopeResponse;
    if (!response.ok) throw new Error(payload.error?.message ?? `DashScope failed with status ${response.status}`);
    const answer = extractAnswerText(payload);
    if (!answer) throw new Error("DashScope returned empty answer.");
    return answer;
  } finally { clearTimeout(timeoutId); }
};

const generateGroundedArabicAnswer = async (params: { question: string; context: string; evidenceCount: number }): Promise<string> => {
  const provider = getProviderSummary();
  const userContent = `السياق القانوني المسترجع:\n${params.context}\n\nالسؤال: ${params.question}\n\nملاحظة: عدد المصادر المسترجعة: ${params.evidenceCount}.`;
  try { return await generateChatCompletion(provider.llmModel, GROUNDED_SYSTEM_PROMPT, userContent, 2048); }
  catch { return generateChatCompletion(provider.llmModelFallback, GROUNDED_SYSTEM_PROMPT, userContent, 2048); }
};

const generateChatAnswer = async (question: string): Promise<string> => {
  const provider = getProviderSummary();
  try { return await generateChatCompletion(provider.llmModelFallback, CHAT_SYSTEM_PROMPT, question, 1024); }
  catch { return "مرحباً! كيف يمكنني مساعدتك؟"; }
};

// ════════════════════════════════════════════════════════════════
// QUERY PIPELINE
// ════════════════════════════════════════════════════════════════

const runChatQuery = async (request: QueryRequest, startedAt: number, llmProviderUsed: string): Promise<QueryResponse> => {
  try {
    const answer = await generateChatAnswer(request.query);
    return { answer, source_chunks: [], llm_provider_used: llmProviderUsed, category: "chat", latency_ms: Math.round(performance.now() - startedAt) };
  } catch {
    return { answer: "مرحباً! كيف يمكنني مساعدتك في استفساراتك القانونية؟", source_chunks: [], llm_provider_used: llmProviderUsed, category: "chat", latency_ms: Math.round(performance.now() - startedAt) };
  }
};

const runLawRefQuery = async (request: QueryRequest, startedAt: number, llmProviderUsed: string, parsedReference?: ParsedLegalReference): Promise<QueryResponse> => {
  const reference = parsedReference ?? parseLegalReference(request.query);
  if (reference.articleNumber && reference.lawName) {
    const document = await findByArticle(reference);
    if (document) return {
      answer: buildExactMatchAnswer(document),
      source_chunks: [toLegalChunk(document), ...document._children.map((c: any) => toLegalChunk(c))],
      llm_provider_used: null, category: "law_ref", latency_ms: Math.round(performance.now() - startedAt),
    };
    return runArabicRagQuery(request, startedAt, llmProviderUsed, buildNoExactMatchAnswer(reference), reference);
  }
  if (reference.appealNumber) {
    const document = await findByAppeal(reference.appealNumber, reference.judicialYear);
    if (document) return {
      answer: buildRulingAnswer(document),
      source_chunks: [toLegalChunk(document), ...document._children.map((c: any) => toLegalChunk(c))],
      llm_provider_used: null, category: "law_ref", latency_ms: Math.round(performance.now() - startedAt),
    };
    return runArabicRagQuery(request, startedAt, llmProviderUsed, buildNoRulingMatchAnswer(reference), reference);
  }
  if (reference.lawNumber || reference.lawYear || reference.lawName) return runArabicRagQuery(request, startedAt, llmProviderUsed, undefined, reference);
  return { answer: buildMissingArticleNumberAnswer(), source_chunks: [], llm_provider_used: null, category: "law_ref", latency_ms: Math.round(performance.now() - startedAt) };
};

const runArabicRagQuery = async (request: QueryRequest, startedAt: number, llmProviderUsed: string, answerPrefix?: string, parsedReference?: ParsedLegalReference): Promise<QueryResponse> => {
  const reference = parsedReference ?? parseLegalReference(request.query);
  let promptInstruction = "";
  if (reference.paragraphs.length > 0) promptInstruction += `\n- ركز على استخراج الإجابة من الفقرة رقم ${reference.paragraphs.join(" و ")} إن وجدت.`;
  if (reference.clauses.length > 0) promptInstruction += `\n- ركز على استخراج الإجابة من البند رقم ${reference.clauses.join(" و ")} إن وجدت.`;

  const rewrite = await rewriteQuery(request.query, request.user_role);
  const rewriteRequest: QueryRequest = { ...request, query: rewrite.rewrittenQuery };
  const candidateChunks = await retrieveCandidateChunks(rewriteRequest, reference);
  const rerankTopK = Math.min(request.top_k, env.rerankTopK);
  const sourceChunks = await rerank(request.query, candidateChunks, rerankTopK);

  if (sourceChunks.length === 0) {
    const answerParts = [answerPrefix, "لم يتم العثور على مواد قانونية ذات صلة كافية للإجابة عن السؤال في الوقت الحالي."].filter(Boolean);
    return { answer: answerParts.join(" "), source_chunks: [], llm_provider_used: llmProviderUsed, category: "arabic_rag", latency_ms: Math.round(performance.now() - startedAt) };
  }

  const groundingDecision = evaluateGrounding(sourceChunks);
  if (!groundingDecision.shouldGenerate) {
    const answerParts = [answerPrefix, groundingDecision.refusalAnswer].filter(Boolean);
    return { answer: answerParts.join(" "), source_chunks: sourceChunks, llm_provider_used: llmProviderUsed, category: "arabic_rag", latency_ms: Math.round(performance.now() - startedAt) };
  }

  const expandedChunks = await expandWithParentContext(sourceChunks);
  const context = buildArabicLegalContext(expandedChunks);
  const finalQuestion = promptInstruction ? `${request.query}\n\nتعليمات إضافية للاستخراج:${promptInstruction}` : request.query;
  const answer = await generateGroundedArabicAnswer({ question: finalQuestion, context, evidenceCount: sourceChunks.length });

  return {
    answer: answerPrefix ? `${answerPrefix}\n\n${answer}` : answer,
    source_chunks: sourceChunks, llm_provider_used: llmProviderUsed,
    category: "arabic_rag", latency_ms: Math.round(performance.now() - startedAt),
    confidence_score: sourceChunks[0]?.rerank_score,
  };
};

export const runQuery = async (request: QueryRequest): Promise<QueryResponse> => {
  const startedAt = performance.now();
  const provider = getProviderSummary();
  const llmProviderUsed = provider.llmProvider;
  const { category, parsedReference } = classify(request);
  if (category === "chat") return runChatQuery(request, startedAt, llmProviderUsed);
  if (category === "law_ref") return runLawRefQuery(request, startedAt, llmProviderUsed, parsedReference);
  return runArabicRagQuery(request, startedAt, llmProviderUsed, undefined, parsedReference);
};

// ════════════════════════════════════════════════════════════════
// CONVERSATION MODEL (on dedicated connection)
// ════════════════════════════════════════════════════════════════

export interface IConversationMessage {
  role: "user" | "assistant";
  content: string;
  category?: string;
  source_chunks?: any[];
  latency_ms?: number;
  confidence_score?: number;
}

interface IConversationDoc {
  user: mongoose.Types.ObjectId;
  title: string;
  messages: IConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSubSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    category: { type: String },
    source_chunks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    latency_ms: { type: Number },
    confidence_score: { type: Number },
  },
  { _id: false, timestamps: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "محادثة جديدة", trim: true },
    messages: { type: [messageSubSchema], default: [] },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, updatedAt: -1 });

let ConversationModel: mongoose.Model<IConversationDoc>;

// ════════════════════════════════════════════════════════════════
// CONVERSATION CRUD
// ════════════════════════════════════════════════════════════════

export const conversationService = {
  async createConversation(userId: string, title?: string) {
    return ConversationModel.create({ user: userId, title: title || "محادثة جديدة" });
  },

  async getAllConversations(userId: string) {
    return ConversationModel.find({ user: userId })
      .select("-messages")
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  },

  async getConversationById(conversationId: string, userId: string) {
    return ConversationModel.findOne({ _id: conversationId, user: userId }).exec();
  },

  async addMessage(conversationId: string, userId: string, message: IConversationMessage) {
    return ConversationModel.findOneAndUpdate(
      { _id: conversationId, user: userId },
      { $push: { messages: message } },
      { new: true }
    ).exec();
  },

  async renameConversation(conversationId: string, userId: string, title: string) {
    return ConversationModel.findOneAndUpdate(
      { _id: conversationId, user: userId },
      { title },
      { new: true }
    ).select("-messages").lean().exec();
  },

  async deleteConversation(conversationId: string, userId: string) {
    return ConversationModel.findOneAndDelete({ _id: conversationId, user: userId }).exec();
  },
};
