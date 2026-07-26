import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import Tesseract from "tesseract.js";
import pdf2pic from "pdf2pic";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Clause {
  clause_id: string;
  clause_number: string;
  clause_title: string;
  clause_type: string;
  text: string;
}

export interface RetrievedDocument {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, any>;
  source: string;
}

export interface LegalBasis {
  law: string;
  article: string;
  text: string;
  relevance: "direct" | "indirect";
}

export interface RiskAssessment {
  level: number;
  category: "low" | "medium" | "high" | "critical";
  description: string;
  potential_penalty?: string;
}

export interface PartyBalance {
  favored_party: "employer" | "employee" | "neutral";
  score: number;
  explanation: string;
}

export interface RequiredAction {
  action_needed: boolean;
  severity: "info" | "warning" | "critical";
  suggested_fix: string;
  rationale: string;
}

export interface ClauseAnalysis {
  clause_id: string;
  clause_text: string;
  compliance: {
    status: "compliant" | "non_compliant" | "partially_compliant" | "missing";
    confidence: "high" | "medium" | "low";
    explanation: string;
  };
  legal_basis: LegalBasis[];
  risk_assessment: RiskAssessment;
  party_balance: PartyBalance;
  required_action: RequiredAction;
  comparison_to_standard: {
    standard_clause: string;
    deviation: "none" | "minor" | "major";
    deviation_details: string;
  };
}

export interface OverallScore {
  overall_score: number;
  classification:
    "excellent" | "good" | "needs_review" | "high_risk" | "critical";
  color: "green" | "yellow" | "orange" | "red";
  breakdown: {
    compliance: number;
    risk: number;
    completeness: number;
    balance: number;
  };
  mandatory_clauses: {
    present: number;
    missing: number;
    non_compliant: number;
  };
  summary: string;
  top_risks: string[];
  recommendations: string[];
}

export interface AnalysisReport {
  overall: OverallScore;
  clauses: ClauseAnalysis[];
  report_markdown: string;
  processed_at: string;
}

export interface ProgressEvent {
  step: string;
  phase: "start" | "progress" | "result" | "done";
  message: string;
}

export type ClauseWithType = ClauseAnalysis & { clause_type: string; clause_title: string };

export interface AnalyzerConfig {
  openaiApiKey?: string;
  baseURL?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingModel?: string;
  llmModel?: string;
  temperature?: number;
}

// ============================================================================
// COLLECTION SELECTION MAP
// ============================================================================

const COLLECTION_MAP: Record<string, string[]> = {
  probation_period: ["egyptian_labor_law", "legal_qa", "contract_clauses"],
  wages: ["egyptian_labor_law", "ministerial_decrees", "legal_qa"],
  working_hours: ["egyptian_labor_law", "ministerial_decrees"],
  leave: ["egyptian_labor_law", "legal_qa"],
  termination: ["egyptian_labor_law", "court_rulings", "legal_qa"],
  non_compete: ["egyptian_labor_law", "court_rulings", "contract_clauses"],
  confidentiality: ["egyptian_labor_law", "contract_clauses"],
  social_insurance: ["egyptian_labor_law", "ministerial_decrees"],
  contract_duration: ["egyptian_labor_law", "contract_clauses", "legal_qa"],
  job_description: ["egyptian_labor_law", "contract_clauses"],
  default: ["egyptian_labor_law", "legal_qa"],
};

// ============================================================================
// PROMPTS
// ============================================================================

const CLEANING_PROMPT = `You are a specialist in cleaning Arabic legal texts. Your task: clean text extracted from an employment contract file.

═══════════════════════════════════════════════════════════════════
STRICT RULES:

1. 🚫 NO HALLUCINATION — Do NOT add any text not in the original
2. 🚫 Do NOT invent words, clauses, or sentences
3. 🚫 Do NOT change legal meaning of any clause
4. ✅ ONLY clean existing text:
   - Fix OCR errors (split words, swapped letters)
   - Normalize numbers (٦ → 6)
   - Remove random symbols/garbage characters
   - Remove extra whitespace
5. ✅ Keep ALL legal clauses as-is (do not delete any clause)
6. ✅ Keep paragraphs separated as in original
7. ⚠️ CRITICAL: You MUST respond in Arabic. The output language must be Arabic.

═══════════════════════════════════════════════════════════════════
EXTRACTED TEXT:
{raw_text}

═══════════════════════════════════════════════════════════════════
⚠️ REMINDER: Your job is ONLY to clean the existing text. Do NOT add anything new.
Output ONLY the cleaned Arabic text (no comments):`;


const SEGMENTATION_PROMPT = `You are an Egyptian labor contract specialist. Your task: split the following employment contract into individual clauses.

Segmentation Rules:
1. Each clause starts with a number or title (e.g., "Clause 1", "Article I")
2. Separate clauses even if they're connected in the text
3. Identify each clause's type from this list:
   - job_description (Job details)
   - contract_duration (Duration)
   - probation_period (Trial period)
   - wages (Salary)
   - working_hours (Working hours)
   - leave (Leave/holidays)
   - termination (Termination)
   - non_compete (Non-compete)
   - confidentiality (Confidentiality)
   - social_insurance (Social insurance)
   - other (Other)

Employment contract:
{contract_text}

Output only JSON, no additional text:
[
  {
    "clause_id": "clause_001",
    "clause_number": "1",
    "clause_title": "Job",
    "clause_type": "job_description",
    "text": "..."
  }
]`;

const CORE_ANALYSIS_PROMPT = `You are an Egyptian labor law specialist with 20 years of experience. Your task: analyze a contract clause and determine its compliance with Egyptian labor law.

═══════════════════════════════════════════════════════════════════
Contract clause to analyze:
{clause_text}

Clause type: {clause_type}
Clause ID: {clause_id}

Retrieved legal references (use ONLY these):
{retrieved_context}

═══════════════════════════════════════════════════════════════════
STRICT INSTRUCTIONS:
1. Use ONLY the above references. Do NOT invent information.
2. If you're unsure, say "Unclear from available sources".
3. Cite the article number in every claim.
4. Output in legal Arabic.
5. Specify the violation exactly.
6. Suggest specific legal text for correction.

Anti-Hallucination Rules:
- Do NOT fabricate legal article numbers
- Do NOT invent court rulings
- If ambiguous, say so clearly

Output only JSON:
{
  "clause_id": "...",
  "clause_text": "...",
  "compliance": {
    "status": "compliant | non_compliant | partially_compliant | missing",
    "confidence": "high | medium | low",
    "explanation": "..."
  },
  "legal_basis": [
    {
      "law": "...",
      "article": "...",
      "text": "...",
      "relevance": "direct | indirect"
    }
  ],
  "risk_assessment": {
    "level": 1,
    "category": "low | medium | high | critical",
    "description": "...",
    "potential_penalty": "..."
  },
  "party_balance": {
    "favored_party": "employer | employee | neutral",
    "score": 50,
    "explanation": "..."
  },
  "required_action": {
    "action_needed": true,
    "severity": "info | warning | critical",
    "suggested_fix": "...",
    "rationale": "..."
  },
  "comparison_to_standard": {
    "standard_clause": "...",
    "deviation": "none | minor | major",
    "deviation_details": "..."
  }
}`;

// ============================================================================
// SCORING & REPORT PROMPTS
// ============================================================================

const SCORING_PROMPT = `You are a legal analyst. You have analyzed every contract clause. Calculate the overall contract score.

Clause Analyses:
{clause_analyses_json}

Calculate:
1. COMPLIANCE SCORE (40%) = (compliant / total) × 40
2. RISK SCORE (30%) = 30 - (sum of risk / max) × 30
3. COMPLETENESS SCORE (20%) = (present from 12 / 12) × 20
4. BALANCE SCORE (10%) = 10 - |balance - 50| / 5

Mandatory (12): job, duration, trial period, salary, hours, leave, termination, non-compete, confidentiality, social insurance, etc.

⚠️ CRITICAL: Output the "summary", "top_risks", and "recommendations" fields in Arabic. All other fields must remain in English/numbers.

Output only JSON:
{
  "overall_score": 72,
  "classification": "good | needs_review | high_risk | critical",
  "color": "green | yellow | orange | red",
  "breakdown": {
    "compliance": 32,
    "risk": 22,
    "completeness": 15,
    "balance": 3
  },
  "mandatory_clauses": {
    "present": 8,
    "missing": 3,
    "non_compliant": 1
  },
  "summary": "...",
  "top_risks": ["..."],
  "recommendations": ["..."]
}`;

const REPORT_PROMPT = `You are an Egyptian legal specialist. Write a comprehensive employment contract analysis report.

Analysis Data:
{analysis_data}

Write a Markdown report including:
1. Cover page (title, date, overall score)
2. Executive summary
3. Mandatory clauses list (table)
4. Detailed clause analysis for each clause
5. Final recommendations

⚠️ CRITICAL: The ENTIRE report must be written in Arabic. Do NOT use English anywhere in the report.`;

// ============================================================================
// MAIN ANALYZER CLASS
// ============================================================================

export class EgyptianEmploymentContractAnalyzer {
  private openai: OpenAI | null = null;
  private qdrant: QdrantClient | null = null;
  private config: Required<Omit<AnalyzerConfig, "qdrantApiKey" | "baseURL">> &
    Pick<AnalyzerConfig, "qdrantApiKey" | "baseURL">;

  constructor(config: AnalyzerConfig) {
    this.config = {
      openaiApiKey: '',
      qdrantUrl: '',
      embeddingModel: 'text-embedding-v4',
      llmModel: 'qwen-mt-turbo',
      temperature: 0.1,
      ...config,
    };

    if (config.openaiApiKey?.trim()) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.baseURL,
      });
    }

    if (config.qdrantUrl?.trim()) {
      this.qdrant = new QdrantClient({
        url: config.qdrantUrl,
        apiKey: config.qdrantApiKey,
      });
    }
  }

  private ensureOpenAI(): OpenAI {
    if (!this.openai) {
      throw new Error('Missing OPENAI_API_KEY. Configure it before running contract analysis.');
    }
    return this.openai;
  }

  private ensureQdrant(): QdrantClient {
    if (!this.qdrant) {
      throw new Error('Missing QDRANT_URL. Configure it before running contract analysis.');
    }
    return this.qdrant;
  }

  // ========================================================================
  // STEP 1: OCR & TEXT EXTRACTION
  // ========================================================================

  /**
   * Extract text from PDF or image file
   */
  async extractText(filePath: string): Promise<{ text: string; needsCleaning: boolean }> {
    const ext = path.extname(filePath).toLowerCase();
    let text = "";
    let needsCleaning = false;

    if (ext === ".pdf") {
      const result = await this.extractFromPDFWithFlag(filePath);
      text = result.text;
      needsCleaning = result.needsCleaning;
    } else if (ext === ".docx") {
      text = await this.extractFromDocx(filePath);
      needsCleaning = false; // .docx text is clean
    } else if ([".png", ".jpg", ".jpeg", ".tiff", ".bmp"].includes(ext)) {
      text = await this.extractFromImage(filePath);
      needsCleaning = true; // OCR text always needs cleaning
    } else if (ext === ".txt") {
      text = fs.readFileSync(filePath, "utf-8");
      needsCleaning = false;
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    // Validate extracted text
    const cleaned = text.replace(/[\s\u0000-\u001F\u200B-\u200D\uFEFF]/g, "").trim();

    // Check for contract-related keywords to ensure it's actually a contract
    const contractKeywords = [
      "طرف", "عقد", "عمل", "أجر", "وظيفة", "-company", "contract", "employee",
      "salary", "work", "hire", "employment", "بند",
      "المادة", "فسخ", "إجازة", "تأمين", "ساعات", "تجربة",
    ];
    const lowerText = cleaned.toLowerCase();
    const hasContractKeyword = contractKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    
    if (!hasContractKeyword) {
      throw new Error(
        `The extracted text does not appear to be an employment contract. ` +
        `No contract-related keywords found. ` +
        `Please upload a valid Egyptian employment contract (Arabic or English).`
      );
    }

    return { text, needsCleaning };
  }

  private async extractFromPDFWithFlag(filePath: string): Promise<{ text: string; needsCleaning: boolean }> {
    // Step 1: Try direct text extraction with pdfjs-dist (for text-based PDFs)
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(fs.readFileSync(filePath));
      const doc = await pdfjsLib.getDocument({ data }).promise;

      let fullText = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      const cleaned = fullText.replace(/[\s\u0000-\u001F\u200B-\u200D\uFEFF]/g, "").trim();
      if (cleaned.length > 10) {
        console.log(`  ✅ Extracted ${fullText.length} characters via pdfjs-dist (text PDF) — no cleaning needed`);
        return { text: fullText, needsCleaning: false };
      }
    } catch (err: any) {
      console.log(`  ⚠️ pdfjs-dist failed: ${err.message}, falling back to OCR...`);
    }

    // Step 2: Fall back to OCR (for scanned/image PDFs)
    console.log("  📷 Falling back to OCR for scanned PDF...");
    const convert = pdf2pic.fromPath(filePath, {
      density: 300,
      format: "png",
      width: 2480,
      height: 3508,
    });

    const images = await convert.bulk(-1);
    let ocrText = "";

    for (let i = 0; i < images.length; i++) {
      const imagePath = images[i].path || images[i].name;
      const result = await Tesseract.recognize(imagePath, "ara+eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`  OCR Page ${i + 1}: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      ocrText += result.data.text + "\n";

      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    return { text: ocrText, needsCleaning: true };
  }

  private async extractFromImage(filePath: string): Promise<string> {
    const result = await Tesseract.recognize(filePath, "ara+eng");
    return result.data.text;
  }

  private async extractFromDocx(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // ========================================================================
  // TEXT CHUNKING HELPER
  // ========================================================================

  /**
   * Split text into chunks by paragraph breaks, respecting max token limit
   */
  private chunkText(text: string, maxChars: number = 6000): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
      if ((currentChunk + "\n\n" + para).length > maxChars && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  // ========================================================================
  // STEP 2: TEXT CLEANING
  // ========================================================================

  /**
   * Clean OCR errors using LLM
   */
  async cleanText(rawText: string): Promise<string> {
    const openai = this.ensureOpenAI();

    const response = await openai.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          {
            role: "user",
            content: CLEANING_PROMPT.replace("{raw_text}", rawText),
          },
        ],
        temperature: this.config.temperature,
      });
      return response.choices[0].message.content?.trim() || rawText;
    // }

    // // For long texts, chunk and clean separately
    // const chunks = this.chunkText(rawText, 5000);
    // const cleanedChunks: string[] = [];

    // for (const chunk of chunks) {
    //   const response = await this.openai.chat.completions.create({
    //     model: this.config.llmModel,
    //     messages: [
    //       {
    //         role: "user",
    //         content: CLEANING_PROMPT.replace("{raw_text}", chunk),
    //       },
    //     ],
    //     temperature: this.config.temperature,
    //   });
    //   cleanedChunks.push(response.choices[0].message.content?.trim() || chunk);
    // }

    // return cleanedChunks.join("\n\n");
  }

  // ========================================================================
  // STEP 3: CLAUSE SEGMENTATION
  // ========================================================================

  /**
   * Split contract into individual clauses
   */
  async segmentClauses(cleanText: string): Promise<Clause[]> {
    let allClauses: Clause[] = [];

    // If text is short, send directly
    if (cleanText.length < 5000) {
      const clauses = await this.segmentChunk(cleanText);
      allClauses.push(...clauses);
    } else {
      // For long texts, chunk and segment separately
      const chunks = this.chunkText(cleanText, 4500);
      for (const chunk of chunks) {
        const clauses = await this.segmentChunk(chunk);
        allClauses.push(...clauses);
      }
    }

    if (allClauses.length === 0) {
      throw new Error("Segmentation returned no clauses");
    }

    return allClauses;
  }

  /**
   * Segment a single chunk into clauses
   */
  private async segmentChunk(text: string): Promise<Clause[]> {
    const openai = this.ensureOpenAI();
    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [
        {
          role: "user",
          content: SEGMENTATION_PROMPT.replace("{contract_text}", text),
        },
      ],
      temperature: this.config.temperature,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty segmentation response");

    // Remove markdown code block fences if present
    const clean = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Extract JSON array from response (find first [ and last ])
    const jsonStart = clean.indexOf("[");
    const jsonEnd = clean.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("No JSON array found in segmentation response");
    }
    const jsonStr = clean.substring(jsonStart, jsonEnd + 1);

    try {
      const parsed = JSON.parse(jsonStr);
      const clauses = Array.isArray(parsed) ? parsed : [];

      if (clauses.length === 0) {
        throw new Error("Segmentation returned an empty array");
      }

      // Deduplicate by text content (keep first occurrence)
      const seenTexts = new Set<string>();
      const unique: Clause[] = [];

      for (const c of clauses) {
        const text = (c.text || "").trim();
        if (!text) continue;

        // Normalize text for deduplication (remove whitespace differences)
        const normalizedText = text.replace(/\s+/g, " ").trim();

        // Skip duplicates
        if (seenTexts.has(normalizedText)) continue;
        seenTexts.add(normalizedText);

        unique.push({
          clause_id: c.clause_id || `clause_${String(unique.length + 1).padStart(3, "0")}`,
          clause_number: c.clause_number || String(unique.length + 1),
          clause_title: c.clause_title || "",
          clause_type: c.clause_type || "other",
          text: text,
        });
      }

      if (unique.length === 0) {
        throw new Error("No valid clauses found after deduplication");
      }

      // Cap at reasonable max (20 clauses)
      const capped = unique.slice(0, 20);

      console.log(`  Parsed ${clauses.length} raw clauses, ${unique.length} unique, ${capped.length} after cap`);
      return capped;

    } catch (e) {
      console.error("Failed to parse segmentation:", jsonStr.substring(0, 500));
      throw e;
    }
  }

  // ========================================================================
  // STEP 4: RETRIEVAL (PER CLAUSE)
  // ========================================================================

  /**
   * Generate embeddings for multiple texts in one API call (batch ≤ 10)
   */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    const BATCH_SIZE = 10;
    const allEmbeddings: number[][] = [];
    const openai = this.ensureOpenAI();

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await openai.embeddings.create({
        model: this.config.embeddingModel,
        input: batch,
      });
      // Sort by index to maintain order
      const sorted = response.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sorted.map((d) => d.embedding));
    }

    return allEmbeddings;
  }

  /**
   * Retrieve relevant legal documents using a pre-computed vector
   */
  private async retrieveWithVector(
    queryVector: number[],
    clauseType: string,
    topK: number = 5,
  ): Promise<RetrievedDocument[]> {
    const collections = COLLECTION_MAP[clauseType] || COLLECTION_MAP.default;
    const allResults: RetrievedDocument[] = [];

    if (!this.qdrant) {
      return [];
    }

    for (const collectionName of collections) {
      try {
        const searchResult = await this.qdrant.search(collectionName, {
          vector: queryVector,
          limit: topK * 2,
          with_payload: true,
        });

        for (const point of searchResult) {
          allResults.push({
            id: point.id as string,
            score: point.score,
            text:
              (point.payload?.text_ar as string) ||
              (point.payload?.text as string) ||
              "",
            metadata: point.payload || {},
            source: collectionName,
          });
        }
      } catch (err) {
        console.warn(`Collection ${collectionName} not found or error:`, err);
      }
    }

    allResults.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const unique: RetrievedDocument[] = [];
    for (const doc of allResults) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        unique.push(doc);
      }
    }

    return unique.slice(0, topK);
  }

  // ========================================================================
  // STEP 5: ANALYSIS (PER CLAUSE)
  // ========================================================================

  /**
   * Analyze a single clause using retrieved legal context
   */
  async analyzeClause(
    clause: Clause,
    retrievedDocs: RetrievedDocument[],
  ): Promise<ClauseAnalysis> {
    // Build context string
    const contextText = retrievedDocs
      .map(
        (doc, i) =>
          `[المصدر ${i + 1} - ${doc.source}]\n${doc.text}\nMetadata: ${JSON.stringify(
            doc.metadata,
          )}`,
      )
      .join("\n\n");

    const prompt = CORE_ANALYSIS_PROMPT.replace("{clause_text}", clause.text)
      .replace("{clause_type}", clause.clause_type)
      .replace("{clause_id}", clause.clause_id)
      .replace("{retrieved_context}", contextText);

    const openai = this.ensureOpenAI();
    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [{ role: "user", content: prompt }],
      temperature: this.config.temperature,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty analysis response");

    try {
      const clean = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return JSON.parse(clean) as ClauseAnalysis;
    } catch (e) {
      console.error("Failed to parse analysis:", content);
      throw e;
    }
  }

  // ========================================================================
  // STEP 6: OVERALL SCORING (LOCAL - no LLM)
  // ========================================================================

  /**
   * Calculate overall contract score from clause analyses using local logic
   */
  async calculateOverallScore(clauseAnalyses: ClauseWithType[]): Promise<OverallScore> {
    const total = clauseAnalyses.length;
    if (total === 0) {
      return {
        overall_score: 0,
        classification: "critical",
        color: "red",
        breakdown: { compliance: 0, risk: 0, completeness: 0, balance: 0 },
        mandatory_clauses: { present: 0, missing: 12, non_compliant: 0 },
        summary: "No clauses to analyze.",
        top_risks: [],
        recommendations: [],
      };
    }

    // Mandatory clause types (12 total)
    const MANDATORY_TYPES = [
      "job_description", "contract_duration", "probation_period",
      "wages", "working_hours", "leave", "termination", "non_compete",
      "confidentiality", "social_insurance", "other",
    ];

    // 1. COMPLIANCE SCORE (40%)
    const compliant = clauseAnalyses.filter((c) => c.compliance.status === "compliant").length;
    const nonCompliant = clauseAnalyses.filter((c) => c.compliance.status === "non_compliant").length;
    const complianceScore = Math.round((compliant / total) * 40);

    // 2. RISK SCORE (30%) — lower risk = higher score
    const riskMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const maxRisk = total * 4;
    const currentRisk = clauseAnalyses.reduce((sum, c) => sum + (riskMap[c.risk_assessment.category] || 0), 0);
    const riskScore = Math.round(30 - (currentRisk / maxRisk) * 30);

    // 3. COMPLETENESS SCORE (20%) — mandatory types present
    const presentTypes = new Set(clauseAnalyses.map((c) => c.clause_type));
    const presentCount = MANDATORY_TYPES.filter((t) => presentTypes.has(t)).length;
    const missingCount = MANDATORY_TYPES.length - presentCount;
    const completenessScore = Math.round((presentCount / MANDATORY_TYPES.length) * 20);

    // 4. BALANCE SCORE (10%) — neutral is best (score=50)
    const avgBalance = clauseAnalyses.reduce((sum, c) => sum + c.party_balance.score, 0) / total;
    const balanceScore = Math.round(10 - Math.abs(avgBalance - 50) / 5);

    const overallScore = complianceScore + riskScore + completenessScore + balanceScore;

    // Classification
    let classification: OverallScore["classification"];
    let color: OverallScore["color"];
    if (overallScore >= 85) { classification = "excellent"; color = "green"; }
    else if (overallScore >= 70) { classification = "good"; color = "green"; }
    else if (overallScore >= 50) { classification = "needs_review"; color = "yellow"; }
    else if (overallScore >= 30) { classification = "high_risk"; color = "orange"; }
    else { classification = "critical"; color = "red"; }

    // Collect top risks
    const topRisks = clauseAnalyses
      .filter((c) => c.risk_assessment.category === "high" || c.risk_assessment.category === "critical")
      .map((c) => `${c.compliance.explanation}`)
      .slice(0, 5);

    // Generate recommendations
    const recommendations: string[] = [];
    if (nonCompliant > 0) {
      recommendations.push(`إصلاح ${nonCompliant} بند مخالف`);
    }
    if (missingCount > 0) {
      recommendations.push(`إضافة ${missingCount} بند إلزامي مفقود`);
    }
    if (riskScore < 15) {
      recommendations.push("مراجعة بنود المخاطر العالية");
    }
    if (balanceScore < 5) {
      recommendations.push("تعديل التوازن بين الطرفين");
    }
    recommendations.push("مراجعة محامٍ متخصص قبل التوقيع");

    // Summary
    const summary =
      `يحتوي العقد على ${total} بند. ` +
      `${compliant} ممتثل، ${nonCompliant} غير ممتثل. ` +
      `${presentCount}/${MANDATORY_TYPES.length} بنود إلزامية موجودة. ` +
      `النتيجة الإجمالية: ${overallScore}/100.`;

    return {
      overall_score: overallScore,
      classification,
      color,
      breakdown: {
        compliance: complianceScore,
        risk: riskScore,
        completeness: completenessScore,
        balance: balanceScore,
      },
      mandatory_clauses: {
        present: presentCount,
        missing: missingCount,
        non_compliant: nonCompliant,
      },
      summary,
      top_risks: topRisks,
      recommendations,
    };
  }

  // ========================================================================
  // STEP 7: REPORT GENERATION (LOCAL TEMPLATE - no LLM)
  // ========================================================================

  /**
   * Generate final Markdown report using local template (no LLM)
   */
  async generateReport(overall: OverallScore, clauses: ClauseWithType[]): Promise<string> {
    const date = new Date().toISOString().split("T")[0];

    // Color mapping
    const colorEmoji: Record<string, string> = {
      green: "🟢", yellow: "🟡", orange: "🟠", red: "🔴"
    };

    // Status mapping
    const statusArabic: Record<string, string> = {
      compliant: "ممتثل", non_compliant: "غير ممتثل",
      partially_compliant: "ممتثل جزئياً", missing: "مفقود"
    };

    // Build report
    let report = `# تقرير تحليل عقد العمل المصري

---

**تاريخ التحليل:** ${date}
**النتيجة الإجمالية:** ${overall.overall_score}/100 ${colorEmoji[overall.color] || ""}
**التصنيف:** ${overall.classification}

---

## ملخص تنفيذي

${overall.summary}

---

## بنود العقد الإلزامية

| البند | الحالة |
|--------|--------|
| وصف العمل | ${overall.mandatory_clauses.present >= 1 ? "✅ موجود" : "❌ مفقود"} |
| مدة العقد | ${overall.mandatory_clauses.present >= 2 ? "✅ موجود" : "❌ مفقود"} |
| فترة التجربة | ${overall.mandatory_clauses.present >= 3 ? "✅ موجود" : "❌ مفقود"} |
| الراتب | ${overall.mandatory_clauses.present >= 4 ? "✅ موجود" : "❌ مفقود"} |
| ساعات العمل | ${overall.mandatory_clauses.present >= 5 ? "✅ موجود" : "❌ مفقود"} |
| الإجازات | ${overall.mandatory_clauses.present >= 6 ? "✅ موجود" : "❌ مفقود"} |
| إنهاء العقد | ${overall.mandatory_clauses.present >= 7 ? "✅ موجود" : "❌ مفقود"} |
| منافسة | ${overall.mandatory_clauses.present >= 8 ? "✅ موجود" : "❌ مفقود"} |
| سرية | ${overall.mandatory_clauses.present >= 9 ? "✅ موجود" : "❌ مفقود"} |
| التأمينات الاجتماعية | ${overall.mandatory_clauses.present >= 10 ? "✅ موجود" : "❌ مفقود"} |

---

## تفاصيل تحليل كل بند

`;

    for (const clause of clauses) {
      report += `### ${clause.clause_id}: ${clause.clause_type}

**النص:** ${clause.clause_text.substring(0, 200)}${clause.clause_text.length > 200 ? "..." : ""}

**حالة الامتثال:** ${statusArabic[clause.compliance.status] || clause.compliance.status}
**مستوى الثقة:** ${clause.compliance.confidence}

**التفسير:** ${clause.compliance.explanation}

**تقييم المخاطر:** ${clause.risk_assessment.category} - ${clause.risk_assessment.description}

**التوازن بين الطرفين:** ${clause.party_balance.favored_party} - ${clause.party_balance.explanation}

---

`;
    }

    report += `## توصيات

`;

    for (let i = 0; i < overall.recommendations.length; i++) {
      report += `${i + 1}. ${overall.recommendations[i]}\n`;
    }

    report += `
---

**تنبيه:** هذا التقرير تم إعداده بواسطة نظام تحليل آلي. يُنصح بمراجعة محامٍ متخصص للتحقق من النتائج.

`;
    return report;
  }

  // ========================================================================
  // MAIN PIPELINE
  // ========================================================================

  /**
   * Full pipeline: file path → complete analysis report
   */
  async analyze(
    filePath: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<AnalysisReport> {
    const emit = (event: ProgressEvent) => {
      console.log(`[${event.step}] ${event.message}`);
      onProgress?.(event);
    };

    const startTime = Date.now();

    // ── STEP 1: Text Extraction ──
    emit({ step: "1/7", phase: "start", message: "🔍 Step 1/7: Extracting text from document..." });
    const { text: rawText, needsCleaning } = await this.extractText(filePath);
    emit({
      step: "1/7", phase: "result", message:
        `✅ Extracted ${rawText.length} characters\n` +
        `─────────────────────────────────────\n` +
        `${rawText.substring(0, 500)}${rawText.length > 500 ? "\n... (truncated)" : ""}\n` +
        `─────────────────────────────────────`,
    });

    // ── STEP 2: Text Cleaning (mandatory for all inputs) ──
    emit({ step: "2/7", phase: "start", message: "🧹 Step 2/7: Cleaning and validating text..." });
    const cleanText = await this.cleanText(rawText);

    // Check if cleaning LLM determined there's no legal content
    if (cleanText.includes("لا يوجد محتوى قانوني") || cleanText.includes("لا يوجد نص قانوني")) {
      throw new Error(
        "The uploaded file does not contain an employment contract. " +
        "The text appears to be garbage or unrelated content (e.g., a profile picture). " +
        "Please upload a valid Egyptian employment contract."
      );
    }

    const cleanLen = cleanText.replace(/[\s\u0000-\u001F\u200B-\u200D\uFEFF]/g, "").trim().length;
    if (cleanLen < 50) {
      throw new Error(
        `Insufficient contract text after cleaning (${cleanLen} characters). ` +
        `The file may not contain an employment contract. ` +
        `Please upload a valid Egyptian employment contract.`
      );
    }

    emit({
        step: "2/7", phase: "result", message:
          `✅ Cleaned text: ${cleanText.length} characters\n` +
          `─────────────────────────────────────\n` +
          `${cleanText.substring(0, 500)}${cleanText.length > 500 ? "\n... (truncated)" : ""}\n` +
          `─────────────────────────────────────`,
      });

    // ── STEP 3: Segmentation ──
    emit({ step: "3/7", phase: "start", message: "✂️ Step 3/7: Segmenting contract into clauses..." });
    const clauses = await this.segmentClauses(cleanText);

    if (clauses.length === 0) {
      throw new Error(
        "No contract clauses could be identified in the document. " +
        "The file may not contain an employment contract. " +
        "Please upload a valid Egyptian employment contract."
      );
    }

    emit({
      step: "3/7", phase: "result",
      message:
        `✅ Found ${clauses.length} clauses:\n` +
        clauses.map((c, i) =>
          `  ${i + 1}. [${c.clause_type}] ${c.clause_title || "(no title)"} — ${c.text.substring(0, 80)}${c.text.length > 80 ? "..." : ""}`
        ).join("\n"),
    });

    // ── STEP 4: Batch Embed + Retrieval + Analysis (per clause) ──
    emit({ step: "4/7", phase: "start", message: "📚 Step 4/7: Embedding all clauses in batch..." });

    // Batch embed all clauses at once (1 API call instead of N)
    const clauseTexts = clauses.map((c) => c.text);
    const embeddings = await this.embedBatch(clauseTexts);
    emit({ step: "4/7", phase: "progress", message: `  📦 Embedded ${embeddings.length} clauses in 1 API call` });

    const clauseAnalyses: ClauseAnalysis[] = [];

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const clauseStart = Date.now();

      emit({
        step: "4/7", phase: "progress",
        message:
          `\n  ┌─ Clause ${i + 1}/${clauses.length}: [${clause.clause_type}] ${clause.clause_title || "untitled"}\n` +
          `  │  Text: ${clause.text.substring(0, 120)}${clause.text.length > 120 ? "..." : ""}`,
      });

      // Retrieve using pre-computed vector (no extra API call)
      emit({ step: "4/7", phase: "progress", message: `  │  📖 Searching legal collections: ${COLLECTION_MAP[clause.clause_type]?.join(", ") || "default"}` });
      const retrieved = await this.retrieveWithVector(embeddings[i], clause.clause_type, 5);
      emit({
        step: "4/7", phase: "progress",
        message:
          `  │  📖 Retrieved ${retrieved.length} documents:\n` +
          retrieved.map((d, j) => `  │    ${j + 1}. [${d.source}] score=${d.score.toFixed(3)} — ${d.text.substring(0, 100)}...`).join("\n"),
      });

      // Analyze
      emit({ step: "4/7", phase: "progress", message: `  │  ⚖️ Analyzing clause with LLM...` });
      const analysis = await this.analyzeClause(clause, retrieved);
      const clauseTime = ((Date.now() - clauseStart) / 1000).toFixed(1);

      emit({
        step: "4/7", phase: "progress",
        message:
          `  │  ✅ Analysis result (${clauseTime}s):\n` +
          `  │     Compliance: ${analysis.compliance.status} (confidence: ${analysis.compliance.confidence})\n` +
          `  │     Risk: ${analysis.risk_assessment.category} (level ${analysis.risk_assessment.level})\n` +
          `  │     Balance: favors ${analysis.party_balance.favored_party} (score ${analysis.party_balance.score})\n` +
          `  │     Action needed: ${analysis.required_action.action_needed ? analysis.required_action.severity : "no"}\n` +
          `  └──────────────────────────────`,
      });

      clauseAnalyses.push(analysis);
    }

    // Pair clause metadata with analysis results for scoring & reporting
    const clauseResults = clauses.map((c, i) => ({
      clause_type: c.clause_type,
      clause_title: c.clause_title,
      ...clauseAnalyses[i],
    }));

    // ── STEP 5: Scoring (LLM) ──
    emit({ step: "5/7", phase: "start", message: "📊 Step 5/7: Calculating overall score..." });
    const overall = await this.calculateOverallScore(clauseResults);
    emit({
      step: "5/7", phase: "result",
      message:
        `✅ Overall Score: ${overall.overall_score}/100 [${overall.classification}] (${overall.color})\n` +
        `   Breakdown: compliance=${overall.breakdown.compliance} risk=${overall.breakdown.risk} completeness=${overall.breakdown.completeness} balance=${overall.breakdown.balance}\n` +
        `   Mandatory: ${overall.mandatory_clauses.present} present, ${overall.mandatory_clauses.missing} missing, ${overall.mandatory_clauses.non_compliant} non-compliant\n` +
        `   Top risks: ${overall.top_risks.join("; ")}`,
    });

    // ── STEP 6: Report Generation (LLM) ──
    emit({ step: "6/7", phase: "start", message: "📄 Step 6/7: Generating Markdown report..." });
    const reportMarkdown = await this.generateReport(overall, clauseResults);
    emit({
      step: "6/7", phase: "result",
      message: `✅ Report generated: ${reportMarkdown.length} characters`,
    });

    // ── STEP 7: Complete ──
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    emit({
      step: "7/7", phase: "done",
      message: `🎉 Analysis complete! Total time: ${totalTime}s | ${clauses.length} clauses analyzed | Score: ${overall.overall_score}/100`,
    });

    return {
      overall,
      clauses: clauseAnalyses,
      report_markdown: reportMarkdown,
      processed_at: new Date().toISOString(),
    };
  }
}

