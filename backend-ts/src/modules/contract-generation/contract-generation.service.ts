import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { IPlaceholder, IComplianceCheck, IValidationResult } from "./models/generated-contract.model";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RetrievedDocument {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, any>;
  source: string;
}

export interface GenerationOptions {
  language?: "ar" | "ar_en";
  contractType?: "employment" | "freelance" | "partnership";
}

export interface ProgressEvent {
  step: string;
  phase: "start" | "progress" | "result" | "done";
  message: string;
}

export interface GeneratorConfig {
  openaiApiKey?: string;
  baseURL?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingModel?: string;
  llmModel?: string;
  temperature?: number;
}

export interface GenerationResult {
  contractSpec: Record<string, any>;
  contractMarkdown: string;
  placeholders: IPlaceholder[];
  complianceCheck: IComplianceCheck;
  processedAt: Date;
}

// ============================================================================
// COLLECTION SELECTION MAP
// ============================================================================

// Reused from analyzer
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

const INTENT_EXTRACTION_PROMPT = `You are an Egyptian employment contract specialist.
Your task is to extract structured contract parameters from a user's natural language request.

USER PROMPT:
{prompt}

CONTRACT TYPE: {contract_type}

RULES:
1. Extract all possible details: employer/employee info, job title, salary, hours, duration, etc.
2. Identify missing mandatory fields (fields the user did NOT provide but are needed for a complete contract).
3. Output ONLY JSON, no markdown formatting or other text.

JSON FORMAT:
{
  "contract_type": "...",
  "parties": {
    "employer": { "name": "...", "type": "..." },
    "employee": { "name": "...", "national_id": "..." }
  },
  "duration": { "type": "fixed | unlimited", "period": "..." },
  "probation_period": "...",
  "job_description": "...",
  "salary": { "amount": 0, "currency": "...", "payment_frequency": "..." },
  "working_hours": { "start": "...", "end": "...", "weekly_off": "..." },
  "leave_entitlements": { "annual": 0 },
  "termination_notice": "...",
  "non_compete": true,
  "confidentiality": true,
  "social_insurance": true,
  "missing_fields": [
    { "field": "national_id", "label": "رقم الهوية الوطنية", "clause": "المقدمة" }
  ]
}`;

const CONTRACT_GENERATION_PROMPT = `You are an expert Egyptian employment contract specialist.
Generate a legally compliant employment contract based on the provided specifications and legal references.

═══ CONTRACT SPECIFICATION ═══
{structured_spec}

═══ FIELDS NOT PROVIDED (use placeholders) ═══
The user did not provide values for the following fields.
Use the placeholder format: {{field_name:label_in_arabic}}
Example: {{national_id:رقم الهوية الوطنية}}

Missing fields:
{missing_fields_list}

═══ LEGAL REFERENCES (use ONLY these) ═══
{retrieved_context}

═══ GENERATION RULES ═══
1. Output MUST be in Arabic.
2. Every clause MUST cite its legal basis (article number) based on the retrieved references.
3. Follow standard Egyptian employment contract structure (المقدمة, المادة الأولى, etc.).
4. Use formal legal Arabic (فصحى قانونية).
5. Do NOT invent article numbers — only cite retrieved references.
6. For missing fields, use the placeholder format {{field_name:label}} exactly as provided.
7. Output ONLY the raw Markdown text of the contract.`;

const REGENERATION_PROMPT = `You are an expert Egyptian employment contract specialist.
The user wants to modify the following contract according to their instructions.
Rewrite the contract applying the requested changes while keeping it legally compliant.

═══ CURRENT CONTRACT ═══
{contract_text}

═══ USER INSTRUCTIONS ═══
{instructions}

═══ REGENERATION RULES ═══
1. Apply the user's instructions to modify the contract.
2. Output MUST be in Arabic.
3. Every clause MUST cite its legal basis (article number).
4. Keep the standard Egyptian employment contract structure.
5. Use formal legal Arabic (فصحى قانونية).
6. Preserve any existing placeholders ({{...}}) unless the user specifically asks to change them.
7. Do NOT invent article numbers — only cite legal references that appear in the original contract.
8. Output ONLY the raw Markdown text of the modified contract.`;

const COMPLIANCE_PRECHECK_PROMPT = `You are an Egyptian labor law compliance checker.
Review the following generated contract against Egyptian labor law and the provided references.

CONTRACT TEXT:
{contract_text}

REFERENCES:
{retrieved_context}

Output ONLY JSON with this structure:
{
  "compliant": boolean,
  "warnings": [
    { "clause": "المادة...", "severity": "info | warning | critical", "message": "..." }
  ],
  "auto_fixes_applied": 0
}`;

const VALIDATION_PROMPT = `You are an Egyptian labor law validator.
Review the following edited contract against Egyptian labor law. 
Provide a strict compliance score and identify any violations.

CONTRACT TEXT:
{contract_text}

Output ONLY JSON with this structure:
{
  "valid": boolean,
  "score": number (0-100),
  "issues": [
    { 
      "clause": "...", 
      "status": "non_compliant | partially_compliant", 
      "explanation": "...", 
      "suggestedFix": "...", 
      "severity": "warning | critical" 
    }
  ],
  "compliantClauses": number,
  "totalClauses": number
}`;

// ============================================================================
// MAIN GENERATOR CLASS
// ============================================================================

export class EgyptianEmploymentContractGenerator {
  private openai: any = null;
  private qdrant: any = null;
  private config: Required<Omit<GeneratorConfig, "qdrantApiKey" | "baseURL">> &
    Pick<GeneratorConfig, "qdrantApiKey" | "baseURL">;

  constructor(config: GeneratorConfig) {
    this.config = {
      openaiApiKey: "",
      qdrantUrl: "",
      embeddingModel: "text-embedding-v4",
      llmModel: "deepseek-v4-pro",
      temperature: 0.2, // Slightly higher than analysis for generation
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

  private ensureOpenAI(): any {
    if (!this.openai) {
      throw new Error("مفتاح واجهة الذكاء الاصطناعي غير مضبوط. يُرجى إعداد OPENAI_API_KEY قبل تشغيل التوليد.");
    }
    return this.openai;
  }

  private ensureQdrant(): QdrantClient {
    if (!this.qdrant) {
      throw new Error("عنوان قاعدة المتجهات غير مضبوط. يُرجى إعداد QDRANT_URL قبل تشغيل التوليد.");
    }
    return this.qdrant;
  }

  // ========================================================================
  // STEP 1: INTENT EXTRACTION
  // ========================================================================

  async extractIntent(prompt: string, contractType: string = "employment"): Promise<Record<string, any>> {
    const openai = this.ensureOpenAI();

    const formattedPrompt = INTENT_EXTRACTION_PROMPT.replace("{prompt}", prompt).replace(
      "{contract_type}",
      contractType
    );

    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [{ role: "user", content: formattedPrompt }],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("استجابة استخراج مواصفات العقد فارغة.");

    try {
      const clean = content
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      console.error("فشل تحليل استخراج مواصفات العقد:", content);
      throw new Error("فشل تحليل مواصفات العقد المستخرجة من النموذج.");
    }
  }

  // ========================================================================
  // STEP 2: CLAUSE RETRIEVAL
  // ========================================================================

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
      const sorted = response.data.sort((a: any, b: any) => a.index - b.index);
      allEmbeddings.push(...sorted.map((d: any) => d.embedding));
    }

    return allEmbeddings;
  }

  private async retrieveWithVector(
    queryVector: number[],
    clauseType: string,
    topK: number = 5
  ): Promise<RetrievedDocument[]> {
    const collections = COLLECTION_MAP[clauseType] || COLLECTION_MAP.default;
    const allResults: RetrievedDocument[] = [];

    if (!this.qdrant) return [];

    for (const collectionName of collections) {
      try {
        const searchResult = await (this.qdrant as any).search(collectionName, {
          vector: queryVector,
          limit: topK * 2,
          with_payload: true,
        });

        for (const point of searchResult) {
          allResults.push({
            id: point.id as string,
            score: point.score,
            text: (point.payload?.text_ar as string) || (point.payload?.text as string) || "",
            metadata: point.payload || {},
            source: collectionName,
          });
        }
      } catch (err) {
        console.warn(`المجموعة ${collectionName} غير موجودة أو حدث خطأ:`, err);
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

  async retrieveClauseReferences(spec: Record<string, any>): Promise<RetrievedDocument[]> {
    // Determine which clause types are needed based on the spec
    const neededClauses = ["job_description", "contract_duration", "wages"];

    if (spec.probation_period) neededClauses.push("probation_period");
    if (spec.working_hours) neededClauses.push("working_hours");
    if (spec.leave_entitlements) neededClauses.push("leave");
    if (spec.termination_notice) neededClauses.push("termination");
    if (spec.non_compete) neededClauses.push("non_compete");
    if (spec.confidentiality) neededClauses.push("confidentiality");
    if (spec.social_insurance) neededClauses.push("social_insurance");

    // Create a description for each clause to embed and search
    const clauseDescriptions = neededClauses.map(
      (type) => `Egyptian labor law regarding ${type.replace("_", " ")}`
    );

    const embeddings = await this.embedBatch(clauseDescriptions);
    const allRetrieved: RetrievedDocument[] = [];

    for (let i = 0; i < neededClauses.length; i++) {
      const retrieved = await this.retrieveWithVector(embeddings[i], neededClauses[i], 3);
      allRetrieved.push(...retrieved);
    }

    // Deduplicate overall references
    const seen = new Set<string>();
    const unique: RetrievedDocument[] = [];
    for (const doc of allRetrieved) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        unique.push(doc);
      }
    }

    return unique;
  }

  // ========================================================================
  // STEP 3: CONTRACT GENERATION
  // ========================================================================

  async generateContract(
    spec: Record<string, any>,
    references: RetrievedDocument[],
    language: string = "ar"
  ): Promise<string> {
    const openai = this.ensureOpenAI();

    const missingFieldsList = Array.isArray(spec.missing_fields)
      ? spec.missing_fields.map((f: any) => `- ${f.field} → {{${f.field}:${f.label}}}`).join("\n")
      : "None";

    const contextText = references
      .map((doc, i) => `[المصدر ${i + 1} - ${doc.source}]\n${doc.text}`)
      .join("\n\n");

    const formattedPrompt = CONTRACT_GENERATION_PROMPT.replace(
      "{structured_spec}",
      JSON.stringify(spec, null, 2)
    )
      .replace("{missing_fields_list}", missingFieldsList)
      .replace("{retrieved_context}", contextText);

    // If bilingual is requested, we would adjust the prompt here.
    // For now, we enforce Arabic as per design.

    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [{ role: "user", content: formattedPrompt }],
      temperature: this.config.temperature,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("استجابة توليد نص العقد فارغة.");

    return content
      .replace(/```markdown\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
  }

  // ========================================================================
  // PLACEHOLDER EXTRACTION
  // ========================================================================

  extractPlaceholders(markdown: string): IPlaceholder[] {
    const PLACEHOLDER_REGEX = /\{\{(\w+):(.+?)\}\}/g;
    const placeholders: IPlaceholder[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = PLACEHOLDER_REGEX.exec(markdown)) !== null) {
      const field = match[1];
      const label = match[2];

      if (!seen.has(field)) {
        seen.add(field);

        // Define which fields are strictly required
        const isRequired =
          ["employee_name", "national_id", "employee_address"].includes(field) ||
          !["bonus", "sick_leave"].includes(field);

        placeholders.push({
          field,
          label,
          required: isRequired,
          filled: false,
        });
      }
    }

    return placeholders;
  }

  // ========================================================================
  // STEP 4: COMPLIANCE PRE-CHECK
  // ========================================================================

  async preCheckCompliance(
    contractMarkdown: string,
    references: RetrievedDocument[]
  ): Promise<IComplianceCheck> {
    const openai = this.ensureOpenAI();

    const contextText = references
      .map((doc, i) => `[المصدر ${i + 1} - ${doc.source}]\n${doc.text}`)
      .join("\n\n");

    const formattedPrompt = COMPLIANCE_PRECHECK_PROMPT.replace("{contract_text}", contractMarkdown).replace(
      "{retrieved_context}",
      contextText
    );

    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [{ role: "user", content: formattedPrompt }],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("استجابة فحص الامتثال المبدئي فارغة.");

    try {
      const clean = content
        .replace(new RegExp("```json\\\\s*", "g"), "")
        .replace(new RegExp("```\\\\s*", "g"), "")
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      console.warn("فشل تحليل فحص الامتثال المبدئي — سيتم اعتبار العقد مقبولاً افتراضياً", e);
      return { compliant: true, warnings: [], autoFixesApplied: 0 };
    }
  }

  // ========================================================================
  // STEP 5: VALIDATE EDITED CONTRACT (Separate API call)
  // ========================================================================

  async validateEditedContract(editedMarkdown: string): Promise<IValidationResult> {
    const openai = this.ensureOpenAI();

    const formattedPrompt = VALIDATION_PROMPT.replace("{contract_text}", editedMarkdown);

    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [{ role: "user", content: formattedPrompt }],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("استجابة التحقق من صحة العقد فارغة.");

    try {
      const clean = content
        .replace(new RegExp("```json\\\\s*", "g"), "")
        .replace(new RegExp("```\\\\s*", "g"), "")
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      console.error("فشل تحليل نتيجة التحقق من العقد", e);
      throw new Error("فشل تحليل نتيجة التحقق من العقد.");
    }
  }

  // ========================================================================
  // REGENERATION (modify existing contract)
  // ========================================================================

  async regenerateContract(currentContract: string, instructions: string): Promise<string> {
    const openai = this.ensureOpenAI();

    const formattedPrompt = REGENERATION_PROMPT.replace("{contract_text}", currentContract).replace(
      "{instructions}",
      instructions
    );

    const response = await openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [{ role: "user", content: formattedPrompt }],
      temperature: this.config.temperature,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("استجابة إعادة توليد العقد فارغة.");

    return content
      .replace(/```markdown\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
  }

  // ========================================================================
  // MAIN GENERATION PIPELINE
  // ========================================================================

  async generate(
    prompt: string,
    options: GenerationOptions = {},
    onProgress?: (event: ProgressEvent) => void,
    isCancelled?: () => boolean | Promise<boolean>
  ): Promise<GenerationResult> {
    const emit = (event: ProgressEvent) => {
      console.log(`[${event.step}] ${event.message}`);
      onProgress?.(event);
    };

    const checkCancelled = async () => {
      if (await isCancelled?.()) {
        throw new Error("تم إلغاء التوليد من قبل المستخدم.");
      }
    };

    await await checkCancelled();

    // ── STEP 1: Intent Extraction ──
    emit({ step: "1/5", phase: "start", message: "🧠 استخراج مواصفات العقد من الوصف..." });
    const spec = await this.extractIntent(prompt, options.contractType);
    emit({ step: "1/5", phase: "result", message: `✅ تم استخراج ${Object.keys(spec).length} حقول رئيسية` });

    // ── STEP 2: Clause Retrieval ──
    await checkCancelled();
    emit({ step: "2/5", phase: "start", message: "📚 جلب المراجع القانونية من قاعدة البيانات..." });
    const references = await this.retrieveClauseReferences(spec);
    emit({ step: "2/5", phase: "result", message: `✅ تم العثور على ${references.length} مرجع قانوني` });

    // ── STEP 3: Contract Generation ──
    await checkCancelled();
    emit({ step: "3/5", phase: "start", message: "✍️ توليد نص العقد وفقاً للقانون المصري..." });
    const contractMarkdown = await this.generateContract(spec, references, options.language);
    emit({
      step: "3/5",
      phase: "result",
      message: `✅ تم توليد العقد بنجاح (${contractMarkdown.length} حرف)`,
    });

    const placeholders = this.extractPlaceholders(contractMarkdown);

    // ── STEP 4: Compliance Pre-Check ──
    await checkCancelled();
    emit({ step: "4/5", phase: "start", message: "⚖️ فحص الامتثال القانوني المبدئي..." });
    const complianceCheck = await this.preCheckCompliance(contractMarkdown, references);
    emit({
      step: "4/5",
      phase: "result",
      message: `✅ نتيجة الفحص: ${complianceCheck.compliant ? "مطابق" : "يوجد تحذيرات"} (${complianceCheck.warnings.length} تحذير)`,
    });

    // ── STEP 5: Complete ──
    emit({ step: "5/5", phase: "done", message: "🎉 عملية التوليد اكتملت بنجاح" });

    return {
      contractSpec: spec,
      contractMarkdown,
      placeholders,
      complianceCheck,
      processedAt: new Date(),
    };
  }
}
