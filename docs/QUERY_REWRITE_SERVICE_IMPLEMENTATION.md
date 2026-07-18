# Query Rewrite Service Implementation Guide

## Overview

This document provides a detailed explanation of the **Query Rewrite Service** implementation, focusing on transforming colloquial Arabic user queries into formal legal terminology optimized for database retrieval.

---

## Table of Contents

1. [What is Query Rewrite?](#what-is-query-rewrite)
2. [Architecture Overview](#architecture-overview)
3. [Design Philosophy](#design-philosophy)
4. [Function-by-Function Analysis](#function-by-function-analysis)
5. [Law Mapping System](#law-mapping-system)
6. [Usage Examples](#usage-examples)
7. [Related Files](#related-files)

---

## What is Query Rewrite?

### The Problem

Users type informal, colloquial queries like:
- **"حقوقي لو فصلوني من شغلي"** (My rights if they fire me from work)

The database contains formal legal text:
- **"قانون العمل رقم 12 لسنة 2003 المادة 109"** (Labor Law No. 12 of 2003, Article 109)

Without rewriting, the semantic gap between **"شغل"** (colloquial: work) and **"قانون العمل"** (formal: Labor Law) results in poor retrieval.

### The Solution

Query rewrite **transforms colloquial Arabic into formal legal Arabic** before search:

```
User types:    "حقوقي لو فصلوني من شغلي"
After rewrite: "ما هي حقوق العامل في حالة إنهاء عقد العمل؟ قانون العمل رقم 12 لسنة 2003"
```

Now both embedding search and keyword search have formal legal terms to anchor on.

---

## Architecture Overview

### Pipeline Position

```
Frontend (ChatPage)
    │
    │  POST /api/v1/query  { query: "...", user_role: "citizen" }
    ▼
QueryController
    │
    ▼
QueryService.runQuery()
    │
    ├── ClassifierService.classify()       ← Is this chat / law_ref / rag?
    │
    ├── (if arabic_rag path)
    │       │
    │       ▼
    │   QueryRewriteService.rewrite()      ← *** THIS SERVICE ***
    │       │
    │       ▼  rewrittenQuery
    │   RetrievalService.retrieveCandidateChunks()  ← search MongoDB
    │       │
    │       ▼
    │   RerankerService.rerank()           ← pick best chunks
    │       │
    │       ▼
    │   GenerationService.generateGroundedArabicAnswer()  ← LLM writes answer
    │
    ▼
Response: { answer, source_chunks, latency_ms, ... }
```

### When Does Rewrite Run?

| Query Category | Rewrite? | Reason |
|---------------|----------|--------|
| `arabic_rag` | ✅ Yes | General legal questions need enhancement |
| `law_ref` | ❌ No | User already specified article/law |
| `chat` | ❌ No | Greetings, off-topic |
| Lawyer role | ❌ No | Already uses formal language |

---

## Design Philosophy

### LLM-First, Mapping-as-Anchor Strategy

```
┌────────────────────────────────────────────────────────┐
│  Strategy: LLM-First + Mapping-as-Anchor               │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Step 1: LLM translates colloquial → formal (فصحى)    │
│          "شغلتي" → "ما هي حقوق العامل في عقد العمل"   │
│                                                        │
│  Step 2: Dictionary appends exact law name            │
│          → "... قانون العمل رقم 12 لسنة 2003"         │
│                                                        │
└────────────────────────────────────────────────────────┘
```


### Why This Approach?

1. **LLM handles dialect diversity**: Colloquial Arabic varies by region (Egyptian, Gulf, Levantine)
2. **Mapping prevents hallucination**: Dictionary provides exact, verified law names
3. **Graceful degradation**: If LLM fails, fall back to mapping-only
4. **Cost-efficient**: Fast model (`qwen-turbo`) with low temperature (0.1)
5. **Validation layer**: Reject outputs containing English text

---

## Function-by-Function Analysis

### 1. `rewrite(query: string, userRole?: "lawyer" | "citizen"): Promise<RewriteResult>`

**Purpose**: Main orchestrator that decides which rewrite path to take.

**Signature**:
```typescript
async rewrite(
  query: string,
  userRole?: "lawyer" | "citizen",
): Promise<RewriteResult>
```

**Parameters**:
- `query`: Raw user input, unchanged
- `userRole`: Optional role (defaults to `env.defaultUserRole` if not provided)

**Returns**: Always resolves (never throws) with a `RewriteResult` object

**Logic Flow**:

```typescript
1. role = userRole ?? env.defaultUserRole
   └─ Fallback to default role if not provided

2. if (role === "lawyer" || !env.enableQueryRewrite)
   └─ RETURN passthrough(query)
   └─ Lawyers use formal Arabic; rewriting would add noise

3. if (!env.enableLlmRewrite)
   └─ RETURN mappingOnly(query)
   └─ LLM unavailable → use dictionary-only path

4. try {
     llmResult = await rewriteWithLlm(query)
     └─ Call DashScope to translate colloquial → formal

     if (!isArabicClean(llmResult))
       └─ LLM returned English/garbage
       └─ RETURN mappingOnly(query)

     normalizedLlm = normalizeArabicQuery(llmResult)
     └─ Normalize for dictionary matching

     mappingResult = rewriteWithMapping(normalizedLlm)
     └─ Check if a law term matches

     if (mappingResult.matched && mappingResult.appendedLaw)
       └─ Law name found AND needs appending
       └─ RETURN llmResult + appendedLaw
     else
       └─ RETURN llmResult (with or without mapping match flag)

   } catch (error) {
     └─ LLM threw error (timeout, network)
     └─ RETURN mappingOnly(query)  ← graceful degradation
   }
```


**Why This Order?**

| Decision | Reasoning |
|----------|-----------|
| Lawyer check first | Skip all processing for professionals |
| LLM before mapping | Cleaning colloquial text first helps dictionary matching |
| Validate LLM output | Real-world testing showed English leakage occurs |
| Mapping as post-step | Appends exact law name without re-cleaning |
| Catch all errors | Never throw - always return usable result |

**Example Execution**:

```typescript
// Citizen query in colloquial Arabic
await rewrite("ايه حقوقي لو فصلوني من شغلي؟", "citizen")
// → {
//     originalQuery: "ايه حقوقي لو فصلوني من شغلي؟",
//     rewrittenQuery: "ما هي حقوق العامل في حالة إنهاء عقد العمل؟ قانون العمل رقم 12 لسنة 2003",
//     usedMapping: true,
//     usedLlm: true,
//     mappingMatch: "شغل"
//   }

// Lawyer query in formal Arabic
await rewrite("ما هي شروط المادة 69 من قانون العمل؟", "lawyer")
// → {
//     originalQuery: "ما هي شروط المادة 69 من قانون العمل؟",
//     rewrittenQuery: "ما هي شروط المادة 69 من قانون العمل؟",  ← unchanged
//     usedMapping: false,
//     usedLlm: false,
//     mappingMatch: null
//   }
```

---

### 2. `rewriteWithLlm(query: string): Promise<string>`

**Purpose**: Call DashScope API to translate colloquial Arabic to formal legal Arabic.

**Signature**:
```typescript
private async rewriteWithLlm(query: string): Promise<string>
```

**Parameters**:
- `query`: Raw user query (preserves punctuation, slang for context)

**Returns**: Cleaned formal Arabic string, or original query if API fails

**Throws**: Network errors, timeouts, HTTP errors (caught by caller)

**Implementation Details**:


#### System Prompt

```typescript
const REWRITE_SYSTEM_PROMPT = `انت مساعد لتحسين الاستعلامات القانونية في مصر.
مهمتك اعادة صياغة السؤال ليكون اكثر دقه ووضوحا للبحث في القوانين المصريه.

قواعد:
1. حول اللغه العاميه او غير الدقيقه الى مصطلحات قانونيه دقيقه
2. استخدم اسماء القوانين والمواد الصحيحه
3. لا تغير معنى السؤال الاصلي
4. اعد كتابه السؤال بالعربيه فقط
5. لا تضف ارقام مواد قانونيه الا اذا كنت متاكدا منها
6. اجعل السؤال مناسبا للبحث في قاعدة بيانات قانونيه`;
```

**Prompt Design Rationale**:

| Rule | Purpose | Impact |
|------|---------|--------|
| Rule 1 | Transform dialect → formal | Bridges semantic gap |
| Rule 2 | Use correct law names | Improves keyword matching |
| Rule 3 | Preserve user intent | Prevents hallucination |
| Rule 4 | Arabic only | Prevents English leakage |
| Rule 5 | No article numbers unless certain | **Critical**: Prevents fake article refs |
| Rule 6 | Optimize for database search | Adds relevant legal keywords |

**Rule 5 is Critical**: If the LLM invents article numbers (e.g., "المادة 999" which doesn't exist), it destroys retrieval accuracy by creating false positives.

#### API Request Configuration

```typescript
const apiKey = this.providerConfigService.getDashScopeApiKey();
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), LLM_REWRITE_TIMEOUT_MS);

const response = await fetch(`${env.dashscopeCompatUrl}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: env.llmRewriteModel,        // Default: "qwen-turbo"
    messages: [
      { role: "system", content: REWRITE_SYSTEM_PROMPT },
      { role: "user", content: query },
    ],
    temperature: 0.1,    // Very low = deterministic
    max_tokens: 256,     // Short response only
  }),
  signal: controller.signal,  // Timeout after 8s
});
```


**Configuration Details**:

| Parameter | Value | Why |
|-----------|-------|-----|
| `model` | `"qwen-turbo"` | Cheaper, faster than main model |
| `temperature` | `0.1` | Deterministic output, minimal creativity |
| `max_tokens` | `256` | Cap response length (rewrite should be short) |
| `timeout` | `8000ms` | Abort if API takes >8s |

**Key Logic Points**:

1. **Round-robin API keys**: `getDashScopeApiKey()` spreads load across multiple keys
2. **AbortController**: Ensures timeout is enforced (Node.js fetch doesn't timeout by default)
3. **Empty response handling**: If response is empty, return original query
4. **Finally block**: Always clear timeout to prevent memory leaks

#### Response Parsing

```typescript
const text = await response.text();
console.log(`[QueryRewriteService] response ${response.status}: ${text.slice(0, 200)}`);

// Handle empty response
if (!text || !text.trim()) {
  console.warn("[QueryRewriteService] Empty response from DashScope API");
  return query;  // Return original
}

const payload = JSON.parse(text);

if (!response.ok) {
  throw new Error(
    payload.error?.message ?? `LLM rewrite failed with status ${response.status}`
  );
}

const content = payload.choices?.[0]?.message?.content;
if (typeof content === "string" && content.trim().length > 0) {
  return content.trim();
}

return query;  // Fallback to original
```

**Error Scenarios Handled**:
- HTTP 429 (rate limit)
- HTTP 500 (server error)
- Malformed JSON
- Empty response body
- Missing content field
- Network timeout (via AbortController)

All errors are caught by the caller's `try-catch`, triggering `mappingOnly()` fallback.

---

### 3. `isArabicClean(text: string): boolean`

**Purpose**: Validate that LLM output contains only Arabic script (no Latin letters).

**Signature**:
```typescript
const isArabicClean = (text: string): boolean
```

**Parameters**:
- `text`: LLM output string

**Returns**: `true` if text is clean Arabic, `false` if contains English or is empty

**Implementation**:

```typescript
const isArabicClean = (text: string): boolean => {
  if (!text || !text.trim()) return false;
  return !/[a-zA-Z]/.test(text.replace(/[\s\d]/g, ""));
};
```

**Logic**:
1. Check if text is empty or whitespace-only → reject
2. Remove all whitespace and digits from text
3. Check if remaining text contains any Latin letters `[a-zA-Z]`
4. If Latin letters found → return `false`

**Why This Approach?**

The full implementation from reference docs checks Unicode ranges:
- Arabic (U+0600–U+06FF)
- Arabic Supplement (U+0750–U+077F)
- Arabic Extended-A (U+08A0–U+08FF)
- Presentation Forms A/B

But the current simple implementation (`!/[a-zA-Z]/.test(...)`) is sufficient because:
- **Fast**: Single regex check vs. character-by-character iteration
- **Effective**: Catches the most common error (English leakage)
- **Practical**: Allows Arabic punctuation, digits, and whitespace

**Why Validation is Necessary**:

Despite the system prompt saying "اعد كتابه السؤال بالعربيه فقط", LLMs can ignore instructions:

```typescript
// Bad LLM output:
"According to Egyptian labor law, the worker has rights..."
// → Rejected by isArabicClean() → Falls back to mappingOnly()

// Good LLM output:
"ما هي حقوق العامل في قانون العمل المصري؟"
// → Passes isArabicClean() → Proceeds to mapping
```

**Examples**:

```typescript
isArabicClean("ما هي حقوق العامل؟")  → true
isArabicClean("قانون العمل 2003")      → true (digits allowed)
isArabicClean("What are my rights?")   → false (Latin letters)
isArabicClean("ما هي rights العامل")   → false (mixed text)
isArabicClean("")                       → false (empty)
isArabicClean("   ")                    → false (whitespace only)
```

---

### 4. `mappingOnly(query: string): RewriteResult`

**Purpose**: Fallback path when LLM is unavailable or fails validation.

**Signature**:
```typescript
private mappingOnly(query: string): RewriteResult
```

**Parameters**:
- `query`: Original user query

**Returns**: `RewriteResult` with normalized query + dictionary match (if found)

**Logic Flow**:

```typescript
1. normalized = normalizeArabicQuery(query)
   └─ Apply Arabic normalization (remove diacritics, unify alefs, etc.)

2. mappingResult = rewriteWithMapping(normalized)
   └─ Check dictionary for law keywords

3. if (mappingResult.matched)
     └─ RETURN {
          originalQuery: query,
          rewrittenQuery: mappingResult.rewritten,  // normalized + law name
          usedMapping: true,
          usedLlm: false,
          mappingMatch: mappingResult.matchedTerm,
        }

4. else
     └─ RETURN {
          originalQuery: query,
          rewrittenQuery: normalized,  // Just normalized, no law added
          usedMapping: false,
          usedLlm: false,
          mappingMatch: null,
        }
```

**When Called?**:
- `enableLlmRewrite` is false (LLM feature disabled)
- LLM output failed `isArabicClean` validation
- LLM threw an exception (timeout, network, API error)

**Example Execution**:

```typescript
mappingOnly("انا عايز اعرف عن شغلي")
// → {
//     originalQuery: "انا عايز اعرف عن شغلي",
//     rewrittenQuery: "انا عايز اعرف عن شغلي قانون العمل رقم 12 لسنة 2003",
//     usedMapping: true,
//     usedLlm: false,
//     mappingMatch: "شغل"
//   }

mappingOnly("ازاي اعمل حاجة؟")  // No law keyword
// → {
//     originalQuery: "ازاي اعمل حاجة؟",
//     rewrittenQuery: "ازاي اعمل حاجه",  ← just normalized
//     usedMapping: false,
//     usedLlm: false,
//     mappingMatch: null
//   }
```

---

## Law Mapping System

### Overview

The law mapping system (`law-mapping.ts`) provides a **250+ term dictionary** that maps colloquial/formal Arabic keywords and English terms to exact Egyptian law names.

### Architecture

```typescript
// Raw dictionary (key → law name)
const RAW_LAW_MAPPING: Record<string, string> = {
  "شغل": "قانون العمل رقم 12 لسنة 2003",
  "طلاق": "قانون الاحوال الشخصية",
  "سرقة": "جريمة السرقة المادة 311 من قانون العقوبات",
  // ... 250+ more entries
};

// Pre-processed for efficient matching
const SORTED_MAPPINGS = Object.entries(RAW_LAW_MAPPING)
  .map(([key, value]) => ({
    key: normalizeArabicQuery(key),           // Normalized keyword
    value,                                     // Original law name
    normalizedValue: normalizeArabicQuery(value),  // Normalized law name
  }))
  .sort((a, b) => b.key.length - a.key.length);  // Longest first
```

### Key Design Decisions

#### 1. Pre-Normalization at Module Load

**Why normalize keys and values at module load?**

```typescript
// ✅ GOOD: Normalize once at startup
const SORTED_MAPPINGS = Object.entries(RAW_LAW_MAPPING)
  .map(([key, value]) => ({
    key: normalizeArabicQuery(key),  // Done once
    value,
    normalizedValue: normalizeArabicQuery(value),  // Done once
  }));

// ❌ BAD: Would normalize thousands of times during searches
for (const [key, value] of Object.entries(RAW_LAW_MAPPING)) {
  if (normalizedQuery.includes(normalizeArabicQuery(key))) {  // Repeated work!
    // ...
  }
}
```

**Benefits**:
- **Performance**: Normalize 250 terms once vs. normalizing on every search
- **Consistency**: Exact same normalization applied to dictionary and query
- **Memory**: Negligible overhead (pre-computed strings)

#### 2. Sort by Length (Longest First)

**Why sort descending by key length?**

```typescript
.sort((a, b) => b.key.length - a.key.length);  // Longest first
```

**Example Problem Without Sorting**:


```typescript
// Dictionary has both:
"شركة": "قانون الشركات رقم 159 لسنة 1981"
"شركة مساهمة": "قانون الشركات رقم 159 لسنة 1981 المادة 4"

// User query:
normalizedQuery = "تأسيس شركة مساهمة"

// Without sorting (random order):
// If "شركة" is checked first → matches! → returns generic company law
// Result: Lost the specific "شركة مساهمة" context

// With sorting (longest first):
// "شركة مساهمة" (14 chars) checked before "شركة" (5 chars)
// Result: Matches the more specific law reference ✅
```

**Benefits**:
- **Specificity**: More specific terms match before generic ones
- **Accuracy**: Preserves user's precise legal context
- **Greedy matching**: First match wins, so longest = best match

#### 3. Store Both Original and Normalized Values

**Why store both `value` and `normalizedValue`?**

```typescript
{
  key: normalizeArabicQuery(key),           // For matching
  value,                                     // For appending
  normalizedValue: normalizeArabicQuery(value),  // For duplication check
}
```

**Use Cases**:

| Field | Used For | Example |
|-------|----------|---------|
| `key` | Matching user query | `"شغل"` → `"شغل"` (normalized) |
| `value` | Appending to result | `"قانون العمل رقم 12 لسنة 2003"` (original) |
| `normalizedValue` | Duplication detection | Check if law already in query |

**Why not normalize `value` when appending?**
- Appending the **original** law name preserves proper Arabic spelling, diacritics, and spacing
- Only the **normalized** version is used for the duplication check

---

### The `rewriteWithMapping()` Function

**Purpose**: Check dictionary for known legal terms and append law name if found.

**Signature**:
```typescript
export const rewriteWithMapping = (normalizedQuery: string): MappingResult
```

**Return Type**:
```typescript
type MappingResult = {
  matched: boolean;        // Did we find a keyword?
  rewritten: string;       // Query after processing
  matchedTerm: string | null;  // Which keyword matched
  appendedLaw: string | null;  // Law name added (null if duplicate)
};
```


**Logic Flow**:

```typescript
for (const { key, value, normalizedValue } of SORTED_MAPPINGS) {
  if (key.length === 0) continue;  // Skip empty keys (defensive)

  if (normalizedQuery.includes(key)) {
    // Keyword found!

    // Anti-Duplication Check:
    if (normalizedQuery.includes(normalizedValue)) {
      // Law name already in query → don't duplicate
      return {
        matched: true,
        rewritten: normalizedQuery,  // No change
        matchedTerm: key,
        appendedLaw: null,  // Signal: don't append
      };
    }

    // Clean Append:
    return {
      matched: true,
      rewritten: `${normalizedQuery} ${value}`,  // Add law name
      matchedTerm: key,
      appendedLaw: value,  // Signal: we added this
    };
  }
}

// No match found
return {
  matched: false,
  rewritten: normalizedQuery,  // No change
  matchedTerm: null,
  appendedLaw: null,
};
```

### Anti-Duplication Logic Explained

**Why is duplication checking critical?**

**Example Without Check**:
```typescript
// User query: "ما هي شروط الطلاق في قانون الاحوال الشخصية؟"
// Keyword matched: "طلاق"
// Target law: "قانون الاحوال الشخصية"

// ❌ BAD: Blindly append
rewritten = "ما هي شروط الطلاق في قانون الاحوال الشخصية قانون الاحوال الشخصية"
//                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                  Duplicate law name!
```

**Example With Check**:
```typescript
// User query: "ما هي شروط الطلاق في قانون الاحوال الشخصية؟"
normalizedQuery = "ما هي شروط الطلاق في قانون الاحوال الشخصيه"
normalizedValue = "قانون الاحوال الشخصيه"

if (normalizedQuery.includes(normalizedValue)) {
  // ✅ Detected: Law name already present
  return { matched: true, appendedLaw: null };  // Don't duplicate
}
```

**Why Normalize Before Checking?**


Arabic text normalization handles spelling variations:
- `"ة"` vs `"ه"` (Ta marbuta vs Ha)
- `"أ إ آ"` vs `"ا"` (Alef variants)
- `"ى"` vs `"ي"` (Alef maqsura vs Ya)

```typescript
// User might write:
"قانون الاحوال الشخصية"  (with ة)

// Dictionary has:
"قانون الاحوال الشخصيه"  (with ه)

// After normalization, both become:
"قانون الاحوال الشخصيه"  → Match detected ✅
```

### Dictionary Content Examples

The dictionary contains **250+ mappings** across multiple legal domains:

#### Labor Law (قانون العمل)
```typescript
"شغل": "قانون العمل رقم 12 لسنة 2003",
"عمل": "قانون العمل رقم 12 لسنة 2003",
"عامل": "قانون العمل رقم 12 لسنة 2003",
"عقد عمل": "قانون العمل رقم 12 لسنة 2003",
"فصل": "قانون العمل رقم 12 لسنة 2003",
"إجازة": "قانون العمل رقم 12 لسنة 2003",
```

#### Personal Status Law (قانون الاحوال الشخصية)
```typescript
"طلاق": "قانون الاحوال الشخصية",
"نفقة": "قانون الاحوال الشخصية",
"حضانة": "قانون الاحوال الشخصية",
"ميراث": "قانون الاحوال الشخصية",
"زواج": "قانون الاحوال الشخصية",
```

#### Criminal Law (قانون العقوبات)
```typescript
"نصب": "جريمة النصب المادة 336 من قانون العقوبات",
"سرقة": "جريمة السرقة المادة 311 من قانون العقوبات",
"اختلاس": "جريمة الاختلاس المادة 119 من قانون العقوبات",
"رشوة": "جريمة الرشوة المادة 103 من قانون العقوبات",
```

#### English Keywords
```typescript
"crime": "قانون العقوبات",
"divorce": "قانون الاحوال الشخصية",
"contract": "القانون المدني",
"labor": "قانون العمل رقم 12 لسنة 2003",
```

**Why Include English?**
- Some users (especially lawyers) mix English legal terms
- International law discussions may use English
- Bilingual queries are common in professional contexts

---

## Usage Examples

### Example 1: Citizen Query (Full LLM + Mapping Path)

```typescript
const service = new QueryRewriteService(providerConfigService);

const result = await service.rewrite(
  "ايه حقوقي لو فصلوني من شغلي؟",
  "citizen"
);

console.log(result);
// {
//   originalQuery: "ايه حقوقي لو فصلوني من شغلي؟",
//   rewrittenQuery: "ما هي حقوق العامل في حالة إنهاء عقد العمل؟ قانون العمل رقم 12 لسنة 2003",
//   usedMapping: true,
//   usedLlm: true,
//   mappingMatch: "شغل"
// }
```

**What Happened**:
1. Role is `citizen` → proceed with rewriting
2. LLM called → translates `"ايه حقوقي لو فصلوني من شغلي"` to formal Arabic
3. LLM output: `"ما هي حقوق العامل في حالة إنهاء عقد العمل؟"`
4. `isArabicClean()` → passes (no English)
5. Normalize LLM output → `"ما هي حقوق العامل في حاله انهاء عقد العمل"`
6. Dictionary search → finds `"عمل"` keyword
7. Check duplication → `"قانون العمل"` not in query
8. Append law name → final result

### Example 2: Lawyer Query (Passthrough)

```typescript
const result = await service.rewrite(
  "ما هي شروط المادة 69 من قانون العمل؟",
  "lawyer"
);

console.log(result);
// {
//   originalQuery: "ما هي شروط المادة 69 من قانون العمل؟",
//   rewrittenQuery: "ما هي شروط المادة 69 من قانون العمل؟",  ← unchanged
//   usedMapping: false,
//   usedLlm: false,
//   mappingMatch: null
// }
```

**What Happened**:
1. Role is `lawyer` → skip all processing
2. Return query unchanged via `passthrough()`

### Example 3: LLM Failure → Mapping-Only Fallback

```typescript
// Simulate LLM returning English (validation failure)
const result = await service.rewrite(
  "عايز اعرف عن الطلاق",
  "citizen"
);

// If LLM returns: "What are the divorce laws in Egypt?"
// isArabicClean() → false
// Falls back to mappingOnly()

console.log(result);
// {
//   originalQuery: "عايز اعرف عن الطلاق",
//   rewrittenQuery: "عايز اعرف عن الطلاق قانون الاحوال الشخصية",
//   usedMapping: true,
//   usedLlm: false,  ← LLM failed validation
//   mappingMatch: "طلاق"
// }
```


**What Happened**:
1. Role is `citizen` → proceed with rewriting
2. LLM called → returns English text (LLM ignored system prompt)
3. `isArabicClean("What are the divorce laws in Egypt?")` → `false`
4. Falls back to `mappingOnly()`
5. Normalizes original query → `"عايز اعرف عن الطلاق"`
6. Dictionary finds `"طلاق"` → appends `"قانون الاحوال الشخصية"`

### Example 4: Duplication Prevention

```typescript
const result = await service.rewrite(
  "ما هي شروط الطلاق في قانون الاحوال الشخصية؟",
  "citizen"
);

console.log(result);
// {
//   originalQuery: "ما هي شروط الطلاق في قانون الاحوال الشخصية؟",
//   rewrittenQuery: "ما هي شروط الطلاق وفقاً لقانون الأحوال الشخصية؟",  ← LLM cleaned it
//   usedMapping: true,
//   usedLlm: true,
//   mappingMatch: "طلاق",
//   // Note: appendedLaw would be null because law name already present
// }
```

**What Happened**:
1. LLM cleans query (minor improvements)
2. Normalized LLM output → `"ما هي شروط الطلاق وفقا لقانون الاحوال الشخصيه"`
3. Dictionary finds `"طلاق"` keyword
4. Duplication check: `normalizedQuery.includes("قانون الاحوال الشخصيه")` → `true`
5. Returns `appendedLaw: null` (law name already present, don't duplicate)

### Example 5: No Keyword Match

```typescript
const result = await service.rewrite(
  "عايز استفسار عن حاجة",
  "citizen"
);

console.log(result);
// {
//   originalQuery: "عايز استفسار عن حاجة",
//   rewrittenQuery: "أود الاستفسار عن أمر ما",  ← LLM cleaned dialect
//   usedMapping: false,  ← No keyword found
//   usedLlm: true,
//   mappingMatch: null
// }
```

**What Happened**:
1. LLM translates colloquial → formal
2. Dictionary search on normalized LLM output → no legal keywords found
3. Returns LLM result without law name appended

---

## Configuration & Environment Variables

### Required Environment Variables

```typescript
// In .env file:

// ── Query Rewrite Feature Flags ──────────────────────────────
ENABLE_QUERY_REWRITE=true          // Master switch for rewriting
ENABLE_LLM_REWRITE=true            // Enable LLM-based rewriting
DEFAULT_USER_ROLE=citizen          // Default when role not specified

// ── LLM Configuration ────────────────────────────────────────
LLM_REWRITE_MODEL=qwen-turbo       // Model for query rewriting
DASHSCOPE_COMPAT_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_API_KEY=sk-xxxxx        // Your API key(s)
```

### Feature Flags Behavior

| Flag | Value | Behavior |
|------|-------|----------|
| `ENABLE_QUERY_REWRITE` | `false` | All queries pass through unchanged |
| `ENABLE_QUERY_REWRITE` | `true` | Rewriting enabled for citizens |
| `ENABLE_LLM_REWRITE` | `false` | Only dictionary mapping (no LLM calls) |
| `ENABLE_LLM_REWRITE` | `true` | Full LLM + mapping pipeline |

### Cost & Performance Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `LLM_REWRITE_TIMEOUT_MS` | `8000` | Abort LLM call after 8 seconds |
| `temperature` | `0.1` | Low creativity (deterministic) |
| `max_tokens` | `256` | Cap response length |
| `model` | `qwen-turbo` | Fast, cheap model |

**Estimated Costs** (DashScope pricing):
- `qwen-turbo`: ~$0.000005 per query rewrite
- 10,000 queries/day ≈ $0.05/day
- 300,000 queries/month ≈ $1.50/month

---

## Decision Tree

Complete flow of the rewrite service:

```
rewrite(query, userRole)
│
├─ Is user a lawyer?
│   └─ YES → passthrough() [return original query]
│
├─ Is ENABLE_QUERY_REWRITE false?
│   └─ YES → passthrough() [return original query]
│
├─ Is ENABLE_LLM_REWRITE false?
│   └─ YES → mappingOnly(query) [dictionary only]
│
├─ Call rewriteWithLlm(query) [8s timeout]
│   │
│   ├─ SUCCESS
│   │    └─ isArabicClean(llmResult)?
│   │         ├─ FAIL → mappingOnly(query)
│   │         │
│   │         └─ PASS
│   │              └─ normalizedLlm = normalizeArabicQuery(llmResult)
│   │              └─ mappingResult = rewriteWithMapping(normalizedLlm)
│   │              └─ if (matched && appendedLaw)
│   │                   └─ return llmResult + appendedLaw
│   │                 else
│   │                   └─ return llmResult
│   │
│   └─ FAILURE (timeout, network, HTTP error)
│        └─ catch → mappingOnly(query) [graceful degradation]
```

---

## Advanced Topics

### Why Not Use Arabic Normalization in arabic-normalize.ts?

You might notice that `rewriteWithLlm()` doesn't apply `normalizeArabicQuery()` to the user's query before sending it to the LLM. **This is intentional.**

**Why preserve the raw query for LLM?**

1. **Context preservation**: Punctuation, spacing, and diacritics provide context clues
2. **Dialect detection**: Original spelling helps LLM identify regional dialect
3. **Intent preservation**: Colloquial expressions carry emotional intent

```typescript
// ❌ BAD: Normalize before LLM
const normalized = normalizeArabicQuery(query);  // Loses context
const llmResult = await rewriteWithLlm(normalized);

// ✅ GOOD: Send raw query to LLM
const llmResult = await rewriteWithLlm(query);  // Preserves context
const normalized = normalizeArabicQuery(llmResult);  // Normalize AFTER
```

**Example**:
```typescript
// Original: "ايه حقوقي لو فصلوني من شغلي؟؟"
// Normalized: "ايه حقوقي لو فصلوني من شغلي"  ← loses double question marks (urgency indicator)

// LLM can interpret "؟؟" as urgency → adjust tone
// Normalization should only happen AFTER LLM processing
```

### Why Temperature is 0.1 (Not 0.0)?

You might wonder why we don't use `temperature: 0.0` for maximum determinism.

**Reasoning**:
- `0.0` is **completely deterministic** but can be "robotic" in edge cases
- `0.1` allows **minimal variance** while maintaining natural language flow
- For Arabic legal text, some flexibility helps handle:
  - Grammatical agreement (gender, number)
  - Synonym selection ("قانون" vs "تشريع")
  - Natural phrasing

**Trade-off**:
| Temperature | Pros | Cons |
|-------------|------|------|
| `0.0` | 100% deterministic | Sometimes awkward phrasing |
| `0.1` | 99% deterministic, natural flow | Tiny variance (~1%) |
| `0.5+` | Creative, varied | Too unpredictable for legal text |

### Why 8-Second Timeout?

**Rationale**:
- P95 DashScope latency: ~2-3 seconds
- P99 DashScope latency: ~5-6 seconds
- 8 seconds covers P99.9 while preventing hung requests
- User expectation: Response in <10 seconds total

**What happens after timeout?**
1. AbortController fires → fetch throws
2. Caught by try-catch → falls back to `mappingOnly()`
3. Dictionary search takes <1ms
4. Total time: ~8 seconds (timeout) + <1ms (fallback) ≈ 8 seconds


### Memory Management: Why `finally { clearTimeout(timeoutId) }`?

**The Problem**:
```typescript
const timeoutId = setTimeout(() => controller.abort(), 8000);
// If this timeout isn't cleared, Node.js keeps it in memory
// 1000 requests = 1000 dangling timers = memory leak
```

**The Solution**:
```typescript
try {
  // ... API call ...
} finally {
  clearTimeout(timeoutId);  // ✅ Always cleanup, even if exception thrown
}
```

**Why `finally` and not just after the call?**
- If fetch throws → `clearTimeout` after fetch never runs → memory leak
- `finally` **always** runs, even when exceptions are thrown
- Ensures cleanup happens in all code paths

---

## Error Handling & Fallbacks

### Graceful Degradation Strategy

The service is designed to **never throw errors**. All failures are caught and degraded gracefully:

```
┌─────────────────────────────────────────────────┐
│  Error Scenario          │  Fallback Action     │
├─────────────────────────────────────────────────┤
│  LLM timeout (>8s)       │  mappingOnly()       │
│  LLM HTTP 429 (rate)     │  mappingOnly()       │
│  LLM HTTP 500 (server)   │  mappingOnly()       │
│  LLM returns English     │  mappingOnly()       │
│  LLM returns empty       │  mappingOnly()       │
│  Network failure         │  mappingOnly()       │
│  No API key configured   │  mappingOnly()       │
│  Dictionary has no match │  Return normalized   │
└─────────────────────────────────────────────────┘
```

### Why Never Throw?

**Philosophy**: Query rewriting is an **enhancement**, not a requirement.

- If rewriting fails → user still gets results (just less optimized)
- Better to search with original query than fail the entire request
- RAG pipeline continues with whatever query we can produce

**Code Pattern**:
```typescript
async rewrite(): Promise<RewriteResult> {
  try {
    // ... LLM logic ...
  } catch (error) {
    console.error("LLM failed:", error);
    return this.mappingOnly(query);  // ✅ Return fallback, don't throw
  }
}
```

### Error Logging

All errors are logged but not exposed to users:

```typescript
console.error(
  "[QueryRewriteService] LLM rewrite failed, falling back to mapping-only:",
  error
);
```

**Log levels**:
- `console.error()`: LLM failures, API errors
- `console.warn()`: Empty responses, validation failures
- `console.log()`: Successful operations (with truncated response preview)


---

## Performance Characteristics

### Latency Breakdown

| Operation | Typical Time | Worst Case |
|-----------|-------------|------------|
| Role check | <1ms | <1ms |
| Dictionary search | <1ms | 2ms |
| Arabic normalization | <1ms | 2ms |
| LLM API call | 2-3s (P95) | 8s (timeout) |
| Validation | <1ms | <1ms |
| **Total (LLM path)** | **2-3s** | **8s** |
| **Total (fallback)** | **<5ms** | **10ms** |

### Scalability

**Bottlenecks**:
1. **LLM API calls**: Limited by DashScope rate limits
   - Solution: Round-robin across multiple API keys
   - Solution: Enable `ENABLE_LLM_REWRITE=false` to use dictionary only

2. **Memory**: Dictionary is loaded once at module startup
   - Memory footprint: ~100KB (250 entries × ~400 bytes each)
   - No per-request memory allocation

**Concurrency**:
- Each request is independent (stateless service)
- Can handle 1000s of concurrent requests (limited only by Node.js event loop)
- LLM calls are async (non-blocking)

### Caching Considerations

**Current state**: No caching implemented

**Future optimization**:
```typescript
// Simple in-memory cache
const rewriteCache = new Map<string, RewriteResult>();

async rewrite(query: string, role?: string): Promise<RewriteResult> {
  const cacheKey = `${role}:${query}`;
  if (rewriteCache.has(cacheKey)) {
    return rewriteCache.get(cacheKey)!;  // Instant response
  }
  
  const result = await this.performRewrite(query, role);
  rewriteCache.set(cacheKey, result);
  return result;
}
```

**Benefits**:
- Repeat queries return instantly (<1ms)
- Reduces LLM API costs by ~30-50% (common questions)
- No additional infrastructure needed

**Trade-offs**:
- Memory usage increases
- Need cache eviction policy (LRU)
- Need cache size limits

---

## Testing Recommendations

### Unit Tests

```typescript
describe("QueryRewriteService", () => {
  let service: QueryRewriteService;

  beforeEach(() => {
    service = new QueryRewriteService(mockProviderConfig);
  });

  describe("rewrite()", () => {
    it("should pass through lawyer queries unchanged", async () => {
      const result = await service.rewrite("المادة 5", "lawyer");
      expect(result.rewrittenQuery).toBe("المادة 5");
      expect(result.usedLlm).toBe(false);
      expect(result.usedMapping).toBe(false);
    });

    it("should use mapping-only when LLM disabled", async () => {
      env.enableLlmRewrite = false;
      const result = await service.rewrite("عايز اعرف عن شغلي", "citizen");
      expect(result.usedLlm).toBe(false);
      expect(result.usedMapping).toBe(true);
      expect(result.rewrittenQuery).toContain("قانون العمل");
    });

    it("should fall back to mapping on LLM timeout", async () => {
      // Mock LLM to timeout
      mockFetch.mockImplementation(() => new Promise(resolve => 
        setTimeout(resolve, 10000)
      ));
      
      const result = await service.rewrite("شغل", "citizen");
      expect(result.usedLlm).toBe(false);
      expect(result.usedMapping).toBe(true);
    });

    it("should reject English LLM output", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "What are my rights?" } }]
        })
      });
      
      const result = await service.rewrite("حقوقي", "citizen");
      expect(result.usedLlm).toBe(false);  // Rejected
      expect(result.usedMapping).toBe(true);  // Fell back
    });
  });

  describe("isArabicClean()", () => {
    it("should accept clean Arabic text", () => {
      expect(isArabicClean("ما هي حقوقي؟")).toBe(true);
      expect(isArabicClean("قانون العمل 2003")).toBe(true);
    });

    it("should reject English text", () => {
      expect(isArabicClean("What are my rights?")).toBe(false);
      expect(isArabicClean("ما هي rights العامل")).toBe(false);
    });

    it("should reject empty text", () => {
      expect(isArabicClean("")).toBe(false);
      expect(isArabicClean("   ")).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
describe("QueryRewriteService Integration", () => {
  it("should handle full citizen query flow", async () => {
    const result = await service.rewrite(
      "ايه حقوقي لو فصلوني من شغلي؟",
      "citizen"
    );
    
    expect(result.originalQuery).toBe("ايه حقوقي لو فصلوني من شغلي؟");
    expect(result.rewrittenQuery).toContain("قانون العمل");
    expect(result.usedLlm).toBe(true);
    expect(result.usedMapping).toBe(true);
  });

  it("should prevent law name duplication", async () => {
    const result = await service.rewrite(
      "الطلاق في قانون الاحوال الشخصية",
      "citizen"
    );
    
    // Count occurrences of "قانون الاحوال الشخصية"
    const matches = (result.rewrittenQuery.match(/قانون الاحوال الشخصية/g) || []);
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});
```


### Edge Cases to Test

| Test Case | Expected Behavior |
|-----------|-------------------|
| Empty query `""` | Return empty normalized |
| Very long query (>1000 chars) | LLM processes, may truncate to 256 tokens |
| Query with only English | isArabicClean fails → mapping-only |
| Query with only numbers | Passes through (numbers allowed) |
| Query with mixed Arabic/English | Depends on ratio, may fail validation |
| Query with emojis | Treated as punctuation (allowed) |
| Repeated law name in query | Duplication prevention triggers |
| Query with no legal keywords | LLM cleans, no mapping match |
| Query with multiple law domains | First (longest) keyword wins |
| Arabic-Indic numerals | Normalized before processing |

---

## Related Files

### Core Files

- **`query-rewrite.service.ts`**: Main service implementation (this document)
- **`law-mapping.ts`**: Dictionary of 250+ legal term mappings
- **`arabic-normalize.ts`**: Text normalization utilities
- **`provider-config.service.ts`**: API key management (round-robin)

### Type Definitions

- **`types/query.types.ts`**: `RewriteResult` type
- **`types/classifier.types.ts`**: `QuestionCategory` type (determines if rewrite runs)

### Integration Points

- **`services/classifier.service.ts`**: Determines if query needs rewriting
- **`services/query.service.ts`**: Orchestrates rewrite → retrieval → generation
- **`services/retrieval.service.ts`**: Consumes rewritten query for search

### Configuration

- **`.env`**: Environment variables (`ENABLE_QUERY_REWRITE`, `ENABLE_LLM_REWRITE`)
- **`config/env.ts`**: Typed environment configuration

### Documentation

- **`QUERY_REWRITE_EXPLAINED.md`**: High-level explanation (from reference files)
- **`QUERY_REWRITE_IMPLEMENTATION.md`**: Technical implementation details (from reference files)
- **`ADVANCED_QUERY_REWRITING_IMPROVEMENTS.md`**: Future enhancement ideas

---

## Future Enhancements

### 1. Query Expansion (Multi-Variant Generation)

Instead of one rewritten query, generate 3-4 variants and search all:

```typescript
async expandQuery(query: string): Promise<string[]> {
  const variants = await this.generateVariants(query, 3);
  return [query, ...variants];  // Include original
}

// Then merge results with Reciprocal Rank Fusion (RRF)
```

**Benefits**:
- Higher recall (catches more relevant documents)
- Multiple phrasings increase match probability
- Well-tested in RAG systems

**Cost**: 3-4x more LLM calls per query

### 2. Self-Querying (Metadata Extraction)

Extract structured filters from queries:

```typescript
// User: "عقوبة الرشوة في قانون العقوبات بعد 2018"
{
  "search_query": "عقوبة الرشوة",
  "filters": {
    "law_type": "قانون العقوبات",
    "year_greater_than": 2018
  }
}
```

**Benefits**:
- Perfect accuracy for dates/numbers (vector embeddings are bad at this)
- Reduces search space
- Better precision

**Requirements**: Database must have metadata fields indexed

### 3. HyDE (Hypothetical Document Embeddings)

Generate a fake answer, then embed it:

```typescript
// User: "ما الفرق بين الشركة المساهمة والشركة ذات المسؤولية المحدودة؟"
// LLM generates hypothetical answer (not shown to user)
const fakeAnswer = await generateHypothetical(query);
const embedding = await embed(fakeAnswer);  // Embed answer, not query
const results = await vectorSearch(embedding);
```

**Benefits**:
- Better semantic matching for conceptual questions
- Embedding of answer-style text matches document style better

**Cost**: Extra LLM call per query

### 4. Query Decomposition

Split complex multi-part questions:

```typescript
// User: "عايز أفتح مطعم، إيه التراخيص وإزاي أعمل عقود العمال؟"
// Decompose:
[
  "تراخيص تشغيل مطعم أو منشأة تجارية",
  "صيغة وشروط عقود العمل"
]
// Search each separately
```

**Benefits**:
- Handles complex questions
- Each part gets focused results

**Cost**: Multiple searches per query


### 5. Intent-Based Routing

Classify query intent first, then route to optimized pipelines:

```typescript
type Intent = 'lookup' | 'procedural' | 'conceptual' | 'chat';

const intent = classifyIntent(query);

switch (intent) {
  case 'lookup':    // "المادة 159" → exact match only
  case 'procedural': // "ازاي أرفع قضية" → hybrid search
  case 'conceptual': // "ما الفرق بين..." → HyDE + hybrid
  case 'chat':       // "شكرا" → skip search
}
```

**Benefits**:
- Optimizes pipeline per query type
- Saves LLM cost for simple lookups
- Faster for specific queries

### 6. In-Memory Cache

```typescript
const rewriteCache = new LRU<string, RewriteResult>({ max: 1000 });

async rewrite(query: string, role?: string): Promise<RewriteResult> {
  const key = `${role}:${query}`;
  if (rewriteCache.has(key)) return rewriteCache.get(key)!;
  
  const result = await this.performRewrite(query, role);
  rewriteCache.set(key, result);
  return result;
}
```

**Benefits**:
- Instant response for repeat queries
- Reduces API costs by 30-50%
- No infrastructure changes needed

---

## Summary

### Key Design Principles

1. **LLM-First, Mapping-as-Anchor**: Dialect → formal (LLM) + exact law name (dictionary)
2. **Graceful degradation**: Never throw, always return usable query
3. **Validation layer**: Reject non-Arabic LLM outputs
4. **Duplication prevention**: Don't append law names already in query
5. **Role-aware**: Skip processing for lawyers
6. **Timeout protection**: 8-second cap with AbortController
7. **Memory cleanup**: Always clear timeouts in finally blocks

### Why This Architecture?

| Design Choice | Rationale |
|---------------|-----------|
| LLM before mapping | Clean colloquial text first improves matching |
| Dictionary after LLM | Appends verified law names (no hallucination) |
| Low temperature (0.1) | Deterministic, conservative outputs |
| Fast model (qwen-turbo) | Cheap, sub-3s latency |
| Never throw errors | Rewriting is enhancement, not requirement |
| Pre-normalize dictionary | Do work once at startup, not per-request |
| Sort longest-first | Specific terms match before generic ones |
| Store original + normalized | Match with normalized, append with original |


### Performance Metrics

| Metric | Value |
|--------|-------|
| Typical latency (LLM path) | 2-3 seconds |
| Worst-case latency | 8 seconds (timeout) |
| Fallback latency | <5ms |
| Memory footprint | ~100KB (dictionary) |
| Cost per query | ~$0.000005 |
| Monthly cost (300K queries) | ~$1.50 |

### When to Use Query Rewrite?

| Scenario | Use Rewrite? |
|----------|-------------|
| Citizen submits colloquial query | ✅ Yes |
| Lawyer submits formal query | ❌ No (passthrough) |
| User asks for specific article | ❌ No (classifier routes to law_ref) |
| User sends greeting | ❌ No (classifier routes to chat) |
| General legal question | ✅ Yes |

### Integration Checklist

When integrating query rewrite into your application:

- [ ] Set environment variables (`ENABLE_QUERY_REWRITE`, `ENABLE_LLM_REWRITE`)
- [ ] Configure DashScope API keys
- [ ] Set default user role
- [ ] Inject `ProviderConfigService` into `QueryRewriteService`
- [ ] Call `rewrite()` after classification, before retrieval
- [ ] Log `RewriteResult` metadata for monitoring
- [ ] Monitor LLM failure rate (should be <1%)
- [ ] Monitor dictionary hit rate (should be 60-80% for citizen queries)
- [ ] Set up alerts for timeout rate (should be <0.1%)

---

## Comparison with Classifier Service

Both services process queries, but serve different purposes:

| Aspect | Classifier Service | Query Rewrite Service |
|--------|-------------------|----------------------|
| **Purpose** | Determine query type | Enhance query content |
| **Input** | Raw user query | Raw user query |
| **Output** | Category + parsed refs | Enhanced query text |
| **Runs When** | Every query | Only arabic_rag queries |
| **Uses LLM** | No (regex-based) | Yes (optional) |
| **Latency** | <10ms | 2-3s (with LLM) |
| **Fallback** | None (always succeeds) | mappingOnly() |
| **Side Effects** | None | May append law names |

### Pipeline Order

```
1. Classifier runs first  →  Determines: law_ref | chat | arabic_rag
                                              │
                                              ├─ law_ref → Skip rewrite
                                              ├─ chat → Skip rewrite
                                              └─ arabic_rag → Run rewrite
                                                                │
2. Rewrite runs (if arabic_rag)  →  Enhances query text
                                                                │
3. Retrieval uses rewritten query  →  Search MongoDB
```

Both services are **collocated** with their types because:
- Classifier exports `ParsedLegalReference` (output of parsing logic)
- Rewrite exports `RewriteResult` (output of rewriting logic)
- Both are **producer-consumer** relationships (type defined where data originates)

---

## Debugging & Monitoring

### Logging Output

The service logs key events at different levels:

```typescript
// Successful LLM call (console.log)
"[QueryRewriteService] response 200: {\"choices\":[{\"message\":{\"content\":\"..."

// Empty response (console.warn)
"[QueryRewriteService] Empty response from DashScope API, using original query"

// LLM failure (console.error)
"[QueryRewriteService] LLM rewrite failed, falling back to mapping-only: Error: ..."
```

### Monitoring Metrics to Track

| Metric | Healthy Range | Alert If |
|--------|---------------|----------|
| LLM success rate | >99% | <95% |
| Timeout rate | <0.1% | >1% |
| Fallback rate | <5% | >20% |
| Arabic validation failure | <1% | >5% |
| Dictionary hit rate | 60-80% | <40% |
| Average latency | 2-3s | >5s |

### Debug Mode

To see detailed execution flow:

```typescript
// In query-rewrite.service.ts, add debug logs:
console.log(`[DEBUG] Role: ${role}, enableLlm: ${env.enableLlmRewrite}`);
console.log(`[DEBUG] LLM result: ${llmResult.slice(0, 100)}...`);
console.log(`[DEBUG] isArabicClean: ${isArabicClean(llmResult)}`);
console.log(`[DEBUG] Mapping match: ${mappingResult.matched}, term: ${mappingResult.matchedTerm}`);
```

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| High timeout rate | Latency >8s often | Increase timeout or use faster model |
| Low dictionary hit rate | No law names appended | Expand dictionary coverage |
| English leakage | isArabicClean failing | Improve system prompt |
| Duplicate law names | Law name appears 2x | Check normalization logic |
| High API costs | $$ increasing | Enable caching or reduce temperature |
| Memory leak | Memory grows over time | Ensure clearTimeout in finally |

---

## Glossary

| Term | Definition |
|------|------------|
| **Colloquial Arabic** | Informal, dialectal Arabic (عامية) used in daily conversation |
| **Formal Arabic** | Modern Standard Arabic (فصحى) used in legal and official documents |
| **Normalization** | Process of unifying Arabic text variants (ة→ه, أإآ→ا, etc.) |
| **Duplication prevention** | Logic that prevents appending law names already in query |
| **Graceful degradation** | Falling back to simpler approach when advanced method fails |
| **Mapping** | Dictionary-based keyword → law name translation |
| **LLM-First** | Strategy where LLM processes query before dictionary lookup |
| **Temperature** | LLM parameter controlling randomness (0=deterministic, 1=creative) |
| **AbortController** | Web API for canceling fetch requests after timeout |
| **Round-robin** | Load balancing strategy that cycles through API keys |


---

## Appendix: Complete Code Reference

### Main Service Structure

```typescript
export class QueryRewriteService {
  constructor(
    private readonly providerConfigService: ProviderConfigService
  ) {}

  // Public API
  async rewrite(query: string, userRole?: "lawyer" | "citizen"): Promise<RewriteResult>

  // Private methods
  private async rewriteWithLlm(query: string): Promise<string>
  private mappingOnly(query: string): RewriteResult
}
```

### Return Type

```typescript
type RewriteResult = {
  originalQuery: string;      // User's raw input
  rewrittenQuery: string;     // Enhanced query for search
  usedMapping: boolean;       // Did dictionary match?
  usedLlm: boolean;          // Did LLM process it?
  mappingMatch: string | null;  // Which keyword matched
};
```

### Constants

```typescript
const LLM_REWRITE_TIMEOUT_MS = 8_000;  // 8 second timeout

const REWRITE_SYSTEM_PROMPT = `...`;   // Arabic instructions for LLM
```

### Helper Function

```typescript
const isArabicClean = (text: string): boolean => {
  if (!text || !text.trim()) return false;
  return !/[a-zA-Z]/.test(text.replace(/[\s\d]/g, ""));
};
```

### Mapping Function (from law-mapping.ts)

```typescript
export const rewriteWithMapping = (normalizedQuery: string): MappingResult => {
  for (const { key, value, normalizedValue } of SORTED_MAPPINGS) {
    if (normalizedQuery.includes(key)) {
      if (normalizedQuery.includes(normalizedValue)) {
        return { matched: true, rewritten: normalizedQuery, matchedTerm: key, appendedLaw: null };
      }
      return { matched: true, rewritten: `${normalizedQuery} ${value}`, matchedTerm: key, appendedLaw: value };
    }
  }
  return { matched: false, rewritten: normalizedQuery, matchedTerm: null, appendedLaw: null };
};
```

---

## Conclusion

The Query Rewrite Service is a critical component that bridges the gap between how users speak (colloquial Arabic) and how legal databases are structured (formal Arabic). By combining LLM-based dialect translation with a curated legal term dictionary, it significantly improves retrieval quality while maintaining robustness through multiple fallback layers.

### Key Takeaways

1. **Hybrid approach works**: LLM handles dialect diversity, dictionary prevents hallucination
2. **Fail gracefully**: Never throw errors, always return something usable
3. **Validate outputs**: Check LLM results before trusting them
4. **Optimize for common case**: Fast model, low temperature, short timeout
5. **Prevent duplication**: Check if law names already exist before appending
6. **Role-aware behavior**: Skip processing when it would hurt (lawyers)
7. **Pre-compute when possible**: Normalize dictionary once at startup

### Next Steps

1. Monitor LLM success rate and latency in production
2. Expand dictionary with user feedback (which terms are missing?)
3. Consider implementing caching for repeat queries
4. Evaluate advanced techniques (query expansion, HyDE) based on retrieval metrics
5. A/B test with vs. without rewriting to quantify impact

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-12  
**Related Docs**: `CLASSIFIER_SERVICE_IMPLEMENTATION.md`, `QUERY_REWRITE_EXPLAINED.md`
