# Contract Generation: Design & Pipeline

## Overview

Contract Generation is the inverse of Contract Analysis. Instead of reading an existing contract and checking it against Egyptian law, the user describes what they want in natural language, and the system generates a legally compliant Egyptian employment contract.

The feature follows a **Generate → Preview → Edit → Validate → Print** workflow.

---

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER FLOW                                │
│                                                                 │
│  ┌──────────┐    ┌────────────┐    ┌──────────┐    ┌─────────┐ │
│  │  Prompt   │───▶│ Generation │───▶│ Preview  │───▶│  Print  │ │
│  │  Input    │    │ (backend)  │    │ + Edit   │    │         │ │
│  └──────────┘    └────────────┘    └────┬─────┘    └─────────┘ │
│                                         │                       │
│                                    ┌────▼─────┐                 │
│                                    │ Validate │                 │
│                                    │ (LLM)    │                 │
│                                    └──────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Pipeline

### Step 1: Prompt Input (Frontend)

The user writes a natural language description of the contract they need.

**Example prompts:**
- "عقد عمل لمدة سنة لمحامٍ في مكتب محاماة في القاهرة، راتب 15000 جنيه، ساعات العمل 9 صباحاً حتى 5 مساءً"
- "عقد عمل غير محدد المدة لمهندس برمجيات، عمل عن بُعد، فترة تجربة 3 أشهر"
- "عقد عمل جزئي времени لموظفة إدارية، 4 ساعات يومياً، بدون فترة تجربة"

**Frontend collects:**
- `prompt` (required) — the user's description
- `language` (optional) — Arabic (default) or bilingual (Arabic + English)
- `contractType` (optional) — `employment`, `freelance`, `partnership` (default: `employment`)

---

### Step 2: Intent Extraction (LLM Call #1)

The raw prompt is often ambiguous. The first LLM call extracts structured parameters from the user's description.

**Purpose:** Normalize the prompt into a structured contract specification and identify what the user didn't provide.

**Input:** User prompt

**Output (JSON):**
```json
{
  "contract_type": "employment",
  "parties": {
    "employer": {
      "name": "مكتب العدالة للمحاماة",
      "type": "شركة"
    },
    "employee": {
      "name": "هاجر عصام",
      "national_id": null
    }
  },
  "duration": {
    "type": "fixed",
    "period": "12 شهر",
    "renewable": true
  },
  "probation_period": "3 أشهر",
  "job_description": "محاماة وتصديق المستندات",
  "salary": {
    "amount": 15000,
    "currency": "EGP",
    "payment_frequency": "شهري"
  },
  "working_hours": {
    "start": "09:00",
    "end": "17:00",
    "weekly_off": "الجمعة والسبت"
  },
  "leave_entitlements": {
    "annual": 21,
    "sick": null,
    "public_holidays": true
  },
  "termination_notice": "30 يوم",
  "non_compete": true,
  "confidentiality": true,
  "social_insurance": true,
  "missing_fields": [
    { "field": "national_id", "label": "رقم الهوية الوطنية", "clause": "المقدمة" },
    { "field": "employee_address", "label": "عنوان العامل", "clause": "المقدمة" }
  ]
}
```

**Why this matters:**
- Converts ambiguous natural language into precise legal parameters
- Determines which clauses are needed
- Identifies missing fields so the generation prompt knows where to leave placeholders

---

### Step 3: Placeholder-Aware Generation (LLM Call #2)

Missing fields are **not** collected from the user upfront. Instead, the contract is generated immediately with placeholder markers where data is missing. The user fills in the blanks directly in the editor.

**Why this approach:**
- No interruption — user gets a full contract preview immediately
- User sees the contract structure and decides what to fill in
- Some "missing" fields may be intentionally omitted (e.g., national_id is optional)
- Better UX — one click to generate, edit in place

---

### Step 4: Clause Retrieval from Vector DB (RAG)

For each clause type needed in the contract, retrieve relevant legal references from Qdrant.

**Reuses the existing `COLLECTION_MAP` from contract analysis:**

| Clause Type | Collections Searched |
|---|---|
| `job_description` | `egyptian_labor_law`, `contract_clauses` |
| `contract_duration` | `egyptian_labor_law`, `contract_clauses`, `legal_qa` |
| `probation_period` | `egyptian_labor_law`, `legal_qa`, `contract_clauses` |
| `wages` | `egyptian_labor_law`, `ministerial_decrees`, `legal_qa` |
| `working_hours` | `egyptian_labor_law`, `ministerial_decrees` |
| `leave` | `egyptian_labor_law`, `legal_qa` |
| `termination` | `egyptian_labor_law`, `court_rulings`, `legal_qa` |
| `non_compete` | `egyptian_labor_law`, `court_rulings`, `contract_clauses` |
| `confidentiality` | `egyptian_labor_law`, `contract_clauses` |
| `social_insurance` | `egyptian_labor_law`, `ministerial_decrees` |

**Process:**
1. Embed the structured clause descriptions (from Step 2) using `text-embedding-v4`
2. Search Qdrant across relevant collections (top-5 per clause)
3. Gather all retrieved legal references into a context bundle

---

### Step 5: Contract Generation (LLM Call #2)

The main generation call. The LLM receives:
- The structured contract specification (Step 2)
- The retrieved legal references (Step 4)
- A generation prompt with strict rules

**Prompt structure:**
```
You are an Egyptian employment contract specialist. Generate a legally compliant contract.

═══ CONTRACT SPECIFICATION ═══
{structured_spec}

═══ FIELDS NOT PROVIDED (use placeholders) ═══
The user did not provide values for the following fields.
Use the placeholder format: {{field_name:label_in_arabic}}
Example: {{national_id:رقم الهوية الوطنية}}
These will be highlighted for the user to fill in.

Missing fields:
- national_id → {{national_id:رقم الهوية الوطنية}}
- employee_address → {{employee_address:عنوان العامل}}

═══ LEGAL REFERENCES (use ONLY these) ═══
{retrieved_context}

═══ GENERATION RULES ═══
1. Output MUST be in Arabic
2. Every clause MUST cite its legal basis (article number)
3. Follow the standard Egyptian employment contract structure:
   - مقدمة (Parties identification)
   - المادة الأولى: موضوع العقد (Job description)
   - المادة الثانية: مدة العقد (Duration)
   - المادة الثالثة: فترة التجربة (Probation)
   - المادة الرابعة: الأجر والحوافز (Salary)
   - المادة الخامسة: ساعات العمل (Working hours)
   - المادة السادسة: الإجازات (Leave)
   - المادة السابعة: إنهاء العقد (Termination)
   - المادة الثامنة: المنافسة (Non-compete)
   - المادة التاسعة: السرية (Confidentiality)
   - المادة العاشرة: التأمينات الاجتماعية (Social insurance)
   - المادة الحادية عشرة: تسوية النزاعات (Dispute resolution)
4. Use formal legal Arabic (فصحى قانونية)
5. Do NOT invent article numbers — only cite retrieved references
6. For missing fields, use the placeholder format {{field_name:label}} exactly as provided
7. Placeholders MUST appear in contextually correct positions (e.g., national_id in the parties section)
```

**Placeholder format:** `{{field_name:Arabic Label}}`

Examples in the generated contract:
```
الطرف الثاني (العامل): السيد/ة {{employee_name:اسم العامل}}، حامل رقم الهوية الوطنية
{{national_id:رقم الهوية الوطنية}}، المقيم بعنوان {{employee_address:عنوان العامل}}.
```

**Output:** Raw contract text in Markdown format with `{{...}}` placeholders for missing data.

---

### Step 6: Legal Compliance Pre-check (LLM Call #3)

Before showing the contract to the user, run a quick compliance check.

**Purpose:** Catch obvious legal violations before the user sees the contract.

**Process:**
- Feed the generated contract back through a lightweight analysis
- Check each clause against the same legal references
- Flag any non-compliant clauses
- If violations found, re-generate those specific clauses (max 2 retries)

**Output:**
```json
{
  "compliant": true,
  "warnings": [
    {
      "clause": "المادة السابعة",
      "severity": "warning",
      "message": "فترة الإشعار المحددة (15 يوم) أقل من الحد القانوني (60 يوم) للعقود غير محددة المدة"
    }
  ],
  "auto_fixes_applied": 1
}
```

---

### Step 8: Preview (Frontend)

The contract is displayed in a rich text editor with placeholders rendered as editable input fields.

**Placeholder rendering:**
- `{{national_id:رقم الهوية الوطنية}}` → inline input field labeled "رقم الهوية الوطنية"
- `{{employee_address:عنوان العامل}}` → inline input field labeled "عنوان العامل"
- Placeholders are highlighted with a distinct style (dashed border, light background)
- User can type directly into the placeholder fields
- Once filled, the placeholder converts to regular text

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────┐  │
│  │          عقد عمل مصر                       │  │
│  │                                           │  │
│  │  في يوم 27 يوليو 2026                     │  │
│  │                                           │  │
│  │  بين:                                     │  │
│  │  (1) مكتب العدالة للمحاماة               │  │
│  │  (2) السيد/ة هاجر عصام، حامل رقم         │  │
│  │      الهوية الوطنية ┌──────────────────┐  │  │
│  │      (رقم الهوية الوطنية)               │  │  │
│  │                      └──────────────────┘  │  │
│  │      المقيم بعنوان ┌──────────────────┐    │  │
│  │      (عنوان العامل) └──────────────────┘    │  │
│  │                                           │  │
│  │  المادة الأولى: موضوع العقد               │  │
│  │  ...                                      │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ⚠️ حقول مطلوبة: 2 (يُرجى ملء جميع الحقول)    │
│                                                 │
│  [💾 حفظ]  [✅ التحقق من الامتثال]  [🖨️ طباعة] │
└─────────────────────────────────────────────────┘
```

**Editor features:**
- Editable rich text (TipTap/ProseMirror recommended for placeholder support)
- Arabic RTL layout
- Placeholders rendered as `<span class="placeholder" data-field="...">` with inline inputs
- Legal formatting (numbered articles, proper spacing)
- Change tracking (highlights what the user edited vs. original)
- Progress indicator: "2 حقول مطلوبة متبقية"

**Placeholder validation:**
- Before enabling "التحقق من الامتثال", check if all required placeholders are filled
- Required placeholders: `national_id`, `employee_name`
- Optional placeholders: `employee_address`, `sick_leave` (user can skip these)
- Visual warning for unfilled required fields

---

### Step 8: Validate Edits (LLM Call #4)

When the user clicks "التحقق من الامتثال", the edited contract is sent back for validation.

**Purpose:** Check if the user's edits introduced any legal violations.

**Process:**
1. Send the edited contract text to the backend
2. Run clause segmentation (reuse from analysis pipeline)
3. For each clause, retrieve legal references and analyze compliance
4. Return results with specific fix suggestions

**This reuses the exact same analysis pipeline** from the contract analysis feature — the edited contract text is passed directly to `analyzer.analyzeText()` which handles cleaning, segmentation, clause-level retrieval, analysis, scoring, and report generation.

**Output:**
```json
{
  "valid": false,
  "score": 72,
  "issues": [
    {
      "clause": "المادة السابعة - إنهاء العقد",
      "status": "non_compliant",
      "explanation": "فترة الإشعار 15 يوم لا تتوافق مع المادة 111 من قانون العمل المصري",
      "suggested_fix": "تعديل فترة الإشعار إلى 60 يوم على الأقل",
      "severity": "critical"
    }
  ],
  "compliant_clauses": 7,
  "total_clauses": 9
}
```

**Frontend behavior:**
- Show a summary bar: "✅ 7 ممتثل | ⚠️ 2 يحتاج مراجعة"
- Highlight problematic clauses in the editor
- Show suggestions inline
- User can click "تطبيق الإصلاح" to auto-apply the suggested fix

---

### Step 9: Print / Export

Two export options:

**1. Print (PDF via browser)**
- Clean print stylesheet (no editor UI)
- Proper Arabic font rendering
- Legal document formatting (A4, margins, headers)

**2. Download Markdown**
- Save the contract as `.md` file
- Upload to R2 for cloud storage
- Generate a shareable link

---

## Data Model

### GeneratedContract Collection

```typescript
interface IGeneratedContract {
  id: string;                          // UUID
  userId: string;                      // Owner
  prompt: string;                      // Original user prompt
  contractSpec: {                      // Structured specification
    contractType: string;
    parties: { employer: any; employee: any };
    duration: any;
    salary: any;
    // ... other fields
  };
  contractMarkdown: string;            // The generated contract text
  editedMarkdown?: string;             // User's edited version
  status: 'generating' | 'preview' | 'validated' | 'exported';
  validationScore?: number;            // Latest validation score
  validationIssues?: ValidationIssue[];
  r2FileUrl?: string;                  // R2 URL for exported file
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    generationTimeSeconds?: number;
    validationTimeSeconds?: number;
    modelUsed?: string;
    totalLlmCalls?: number;
  };
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Start generation from prompt |
| `GET` | `/api/generate` | List user's generated contracts |
| `GET` | `/api/generate/progress` | Get progress for all jobs |
| `GET` | `/api/generate/stream` | SSE stream for all jobs |
| `GET` | `/api/generate/:id` | Get contract status/content |
| `GET` | `/api/generate/:id/download` | Download as Markdown |
| `GET` | `/api/generate/:id/progress` | Get progress for a specific job |
| `GET` | `/api/generate/:id/stream` | SSE stream for a specific job |
| `POST` | `/api/generate/:id/validate` | Validate edited contract |
| `PUT` | `/api/generate/:id` | Save edited contract |
| `DELETE` | `/api/generate/:id` | Delete generated contract |

---

## Pipeline Summary (LLM Calls)

| Call | Purpose | Input | Output |
|------|---------|-------|--------|
| **#1** | Intent extraction | User prompt | Structured spec JSON + missing fields list |
| **#2** | Contract generation | Spec + legal references + missing fields | Raw contract Markdown with `{{...}}` placeholders |
| **#3** | Pre-check compliance | Generated contract | Compliance report |
| **#4** | Validate edits | Edited contract (placeholders filled) | Validation report |

**Total LLM calls:** 3-4 per generation (depending on retries)
**Total embedding calls:** N (one per clause type, batched)

---

## Placeholder System

### Format
`{{field_name:Arabic Label}}`

### Parsing (Backend)
The contract text is parsed to extract placeholders before sending to the editor:
```typescript
const PLACEHOLDER_REGEX = /\{\{(\w+):(.+?)\}\}/g;
// Matches: {{national_id:رقم الهوية الوطنية}}
// Groups:  [1] field_name  [2] Arabic label
```

### Rendering (Frontend)
Each placeholder is replaced with an inline editable field:
```html
<span class="placeholder-field" contenteditable="true"
      data-field="national_id" data-label="رقم الهوية الوطنية"
      data-required="true">
</span>
```

### Required vs Optional
| Field | Required | Notes |
|-------|----------|-------|
| `employee_name` | ✅ | Name of the employee |
| `national_id` | ✅ | National ID number |
| `employee_address` | ✅ | Home address |
| `sick_leave` | ❌ | Defaults to legal minimum ( varies by years of service) |
| `bonus` | ❌ | Can be omitted entirely |

### Validation Before Submit
1. Scan editor for remaining `{{...}}` markers
2. Check `data-required="true"` fields
3. If required placeholders remain → block validation, show count

---

## Reused Components from Analysis

| Component | Reuse | Notes |
|-----------|-------|-------|
| `EgyptianEmploymentContractAnalyzer` | ✅ Embedding, retrieval, clause analysis | Same Qdrant collections, same embedding model |
| `COLLECTION_MAP` | ✅ Exact reuse | Maps clause types to relevant collections |
| `R2StorageService` | ✅ File storage | Store generated contracts |
| `Job` model pattern | ✅ Similar | `GeneratedContract` follows same async pattern |
| `processJob` pattern | ✅ Similar | Background processing with progress events |
| Claude/OpenAI prompts | 🔧 Adapted | Generation prompts instead of analysis prompts |

---

## Frontend Components

| Component | Description |
|-----------|-------------|
| `PromptInput` | Text area for user prompt + optional settings |
| `ContractPreview` | Rich text editor with placeholder-aware inline inputs |
| `PlaceholderField` | Inline editable field that replaces `{{...}}` markers |
| `ValidationBar` | Summary of compliance score + issues |
| `IssueCard` | Individual issue with fix suggestion |
| `PrintButton` | Print-optimized export |
| `DownloadButton` | Markdown file download |

---

## Error Handling

| Error | Handling |
|-------|----------|
| Generation fails | Show error, allow retry |
| Required placeholders unfilled | Block validation, show warning |
| Compliance check fails | Show warnings, allow manual review |
| Validation timeout | Show partial results |
| R2 upload fails | Save locally, retry upload |

---

## Future Enhancements

1. **Template library** — Pre-built templates for common contract types
2. **Multi-party contracts** — Support for more than 2 parties
3. **Clause library** — User can browse and insert standard clauses
4. **Version history** — Track all edits with timestamps
5. **Collaborative editing** — Multiple users edit the same contract
6. **AI chat** — conversational refinement ("make the salary clause more detailed")
7. **Comparison mode** — Compare generated contract against a standard template
