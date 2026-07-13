# Classifier Service Implementation Guide

## Overview

This document provides a detailed explanation of the **Classifier Service** implementation, focusing on the **legal-ref-parser** utility and its design decisions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Decisions](#design-decisions)
3. [Function-by-Function Analysis](#function-by-function-analysis)
4. [Usage Examples](#usage-examples)
5. [Related Files](#related-files)

---

## Architecture Overview

### Service Flow

```
User Query → ClassifierService.classify()
                    ↓
            parseLegalReference()
                    ↓
        Classification Result (law_ref | chat | arabic_rag)
```

The classifier service determines what type of query the user has submitted:
- **law_ref**: Legal reference queries (e.g., "المادة 5 من قانون العمل")
- **chat**: Conversational queries (e.g., "مرحبا", "شكرا")
- **arabic_rag**: General legal questions requiring RAG retrieval

---

## Design Decisions

### 1. Why is `ParsedLegalReference` in `legal-ref-parser.ts` instead of `types/`?

**Answer**: **Colocation principle** - Types are defined where they are primarily used.

#### Reasoning:

1. **Single Source of Truth**
   - `ParsedLegalReference` is the direct output type of `parseLegalReference()`
   - Keeping the type adjacent to its producer function makes the contract explicit
   - Changes to parsing logic immediately show type implications

2. **Dependency Direction**
   - `legal-ref-parser.ts` has **no dependencies** on other domain logic
   - It's a pure utility that converts strings to structured data
   - Moving the type to `types/` would create an unnecessary bidirectional dependency

3. **Encapsulation**
   - The type is exported from the same module that creates it
   - Consumers import both the function and its type from one place:
     ```typescript
     import { parseLegalReference, type ParsedLegalReference } from "../utils/legal-ref-parser";
     ```

4. **Actual Usage Pattern**
   - `classifier.types.ts` imports `ParsedLegalReference` from `legal-ref-parser.ts`
   - This is the correct dependency direction: domain types depend on utility types, not vice versa

#### When to Use `types/` Directory:

- **Shared domain types** used across multiple services (e.g., `ClassificationResult`)
- **API contract types** (e.g., `QueryRequest`, `QuestionCategory`)
- **Interface definitions** that multiple implementations conform to

#### When to Colocate Types:

- **Output types** of specific utility functions
- **Internal types** used only within a module
- **Data structures** that are tightly coupled to implementation

---

### 2. Why are `normalizeArabicDigits`, `normalizeWhitespace`, and `normalizeLawName` not in `arabic-normalize.ts`?

**Answer**: **Different normalization contexts require different rules.**

#### The Problem:

There are **TWO DISTINCT normalization contexts** in the system:

1. **Query Normalization** (`arabic-normalize.ts`)
   - Used for: RAG retrieval, embedding generation, semantic search
   - Applies **aggressive normalization** including `ة → ه` conversion
   - Goal: Maximize semantic similarity between queries and documents

2. **Legal Reference Parsing** (`legal-ref-parser.ts`)
   - Used for: Extracting structured legal metadata (article numbers, law names)
   - Applies **minimal normalization** - NO `ة → ه` conversion
   - Goal: Preserve exact legal terminology for database lookups

#### Function-by-Function Breakdown:

##### `normalizeArabicDigits` - Local to `legal-ref-parser.ts`

**Why not shared?**
```typescript
// In legal-ref-parser.ts:
const normalizeArabicDigits = (text: string): string =>
  text.replace(/[٠-٩]/g, (digit) => ARABIC_TO_WESTERN_DIGITS[digit] ?? digit);
```

- **Scope**: Only used for parsing numeric references (articles, years, appeal numbers)
- **Context**: Part of a multi-step parsing pipeline specific to legal references
- **Simplicity**: Single-purpose, no side effects, doesn't need external exposure
- **Already shared where needed**: `ARABIC_TO_WESTERN_DIGITS` is in `arabic.patterns.ts`

##### `normalizeWhitespace` - Local to `legal-ref-parser.ts`

**Why not shared?**
```typescript
const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();
```

- **Ultra-simple utility**: Two operations that could be inlined
- **Context-specific**: Used in legal reference parsing, not general text processing
- **No reuse need**: If other modules need whitespace normalization, they might need different rules
- **Overhead**: Creating a shared utility for 1 line of code adds more import complexity than value

##### `normalizeLawName` - **DUPLICATED** in both files (This is the issue!)

**Status**: 🚨 **Code duplication detected**

```typescript
// In legal-ref-parser.ts (line 21-22):
const normalizeLawName = (lawName: string): string =>
  normalizeWhitespace(lawName.replace(/[؟?.!,،]+$/g, ""));

// In arabic-normalize.ts (exported function):
export const normalizeLawName = (text: string): string =>
  text
    .replace(TASHKEEL_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => ARABIC_TO_WESTERN_DIGITS[d] ?? d)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
```

**The functions do COMPLETELY DIFFERENT things!**

| Aspect | `legal-ref-parser.ts` version | `arabic-normalize.ts` version |
|--------|------------------------------|------------------------------|
| Purpose | Strip punctuation from extracted law name | Full normalization for DB lookup |
| Tashkeel removal | ❌ No | ✅ Yes |
| Tatweel removal | ❌ No | ✅ Yes |
| Alif normalization | ❌ No | ✅ Yes |
| Digit conversion | ❌ No | ✅ Yes |
| Punctuation removal | ✅ Only trailing | ✅ All non-letter/digit |

**This is NOT duplication - it's an unfortunate naming collision!**

#### Recommendation:

The local `normalizeLawName` in `legal-ref-parser.ts` should be renamed to avoid confusion:

```typescript
// Better name:
const stripTrailingPunctuation = (text: string): string =>
  normalizeWhitespace(text.replace(/[؟?.!,،]+$/g, ""));
```

---

## Function-by-Function Analysis

### 1. `normalizeArabicDigits(text: string): string`

**Purpose**: Convert Arabic-Indic numerals (٠-٩) to Western numerals (0-9).

**Implementation**:
```typescript
const normalizeArabicDigits = (text: string): string =>
  text.replace(/[٠-٩]/g, (digit) => ARABIC_TO_WESTERN_DIGITS[digit] ?? digit);
```

**Logic**:
- Uses regex `/[٠-٩]/g` to match all Arabic-Indic digits
- Maps each digit using the lookup table from `arabic.patterns.ts`
- Falls back to original digit if not in map (defensive programming)

**Why this approach**:
- Arabic-Indic numerals are common in Arabic text
- JavaScript's `parseInt()` doesn't natively handle Arabic-Indic digits
- Consistent number format enables range parsing and database queries

**Example**:
```typescript
normalizeArabicDigits("المادة ٥") → "المادة 5"
normalizeArabicDigits("قانون رقم ١٢٣") → "قانون رقم 123"
```

---

### 2. `normalizeWhitespace(text: string): string`

**Purpose**: Collapse multiple whitespace characters into single spaces and trim.

**Implementation**:
```typescript
const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();
```

**Logic**:
- `/\s+/g` matches one or more whitespace characters (spaces, tabs, newlines)
- Replace with single space
- `trim()` removes leading/trailing whitespace

**Why this approach**:
- Legal queries may have irregular spacing from copy-paste
- Consistent spacing improves regex matching reliability
- Database fields are typically stored with normalized spacing

**Example**:
```typescript
normalizeWhitespace("المادة    5   من  قانون") → "المادة 5 من قانون"
normalizeWhitespace("  قانون العمل  ") → "قانون العمل"
```

---

### 3. `normalizeLawName(lawName: string): string` (local version)

**Purpose**: Clean extracted law name by removing trailing punctuation.

**Implementation**:
```typescript
const normalizeLawName = (lawName: string): string =>
  normalizeWhitespace(lawName.replace(/[؟?.!,،]+$/g, ""));
```

**Logic**:
1. Remove trailing punctuation: `[؟?.!,،]+$` matches one or more punctuation at end
2. Normalize whitespace to clean up any spacing issues

**Why this approach**:
- Regex capture groups may include trailing punctuation
- Example: `LAW_NAME_RE` captures "قانون العمل،" → needs cleaning
- We only remove **trailing** punctuation because mid-text punctuation may be meaningful

**Example**:
```typescript
normalizeLawName("قانون العمل؟؟") → "قانون العمل"
normalizeLawName("لائحة التأمين.") → "لائحة التأمين"
normalizeLawName("قانون   رقم   5  ") → "قانون رقم 5"
```

**⚠️ Naming Issue**: This function should be renamed to `stripTrailingPunctuation` or `cleanExtractedLawName` to avoid confusion with the exported `normalizeLawName` in `arabic-normalize.ts`.

---

### 4. `parseNumbers(text: string): string[]`

**Purpose**: Extract numeric values, supporting ranges (e.g., "5-10").

**Implementation**:
```typescript
const parseNumbers = (text: string): string[] => {
  const normalized = normalizeArabicDigits(text);
  const rangeMatch = normalized.match(/(\d+)\s*(?:-|إلى|الى|حتى)\s*(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start < end && end - start < 100) {
      const nums: string[] = [];
      for (let i = start; i <= end; i++) nums.push(i.toString());
      return nums;
    }
  }
  const matches = normalized.match(/\d+/g);
  return matches ?? [];
};
```

**Logic Flow**:
1. **Normalize digits**: Convert Arabic-Indic to Western
2. **Check for range pattern**: Match "5-10" or "5 إلى 10" or "5 حتى 10"
3. **Validate range**:
   - `start < end`: Ensure valid range
   - `end - start < 100`: Prevent memory issues from large ranges
4. **Expand range**: Generate array of all numbers in range
5. **Fallback**: If no valid range, extract all individual numbers

**Why this approach**:
- **Range expansion**: User can query "المواد من 5 إلى 10" and get all articles
- **Safety limits**: 100-item cap prevents abuse (e.g., "1 to 1000000")
- **Flexible syntax**: Supports multiple Arabic range keywords and Western hyphen
- **Fallback**: If range is invalid, still extracts individual numbers

**Examples**:
```typescript
parseNumbers("المادة 5 إلى 8") → ["5", "6", "7", "8"]
parseNumbers("المواد 10-12") → ["10", "11", "12"]
parseNumbers("المواد 3 و 7 و 9") → ["3", "7", "9"]
parseNumbers("المادة 1 حتى 3") → ["1", "2", "3"]
parseNumbers("1-200") → ["1"] // Too large, returns only first number
```

---

### 5. `extractSection(text: string, keywordRegex: RegExp): string[]`

**Purpose**: Extract numeric sections (articles, paragraphs, clauses) by keyword.

**Implementation**:
```typescript
const extractSection = (text: string, keywordRegex: RegExp): string[] => {
  const match = text.match(keywordRegex);
  if (!match) return [];
  return parseNumbers(match[1]);
};
```

**Logic**:
1. Match text against keyword regex (e.g., `ARTICLES_RE`)
2. If no match, return empty array
3. Extract captured group (the number portion) and parse

**Why this approach**:
- **Generic pattern**: Works for articles, paragraphs, clauses, chapters, parts
- **Delegation**: Uses `parseNumbers()` to handle complex number parsing logic
- **Safe**: Returns empty array if keyword not found

**Regex Patterns Used**:
```typescript
ARTICLES_RE   = /(?:المادة|مادة|المواد|مواد|article|articles)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i
PARAGRAPHS_RE = /(?:الفقرة|فقرة|الفقرات|فقرات|paragraph|paragraphs)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i
CLAUSES_RE    = /(?:البند|بند|البلنود|بنود|clause|clauses)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i
```

**Examples**:
```typescript
extractSection("المادة 5", ARTICLES_RE) → ["5"]
extractSection("الفقرة 2 و 3", PARAGRAPHS_RE) → ["2", "3"]
extractSection("قانون العمل", ARTICLES_RE) → [] // No article keyword
```

---

### 6. `extractLawInfo(text: string)`

**Purpose**: Extract law metadata (name, number, year) from query text.

**Implementation**:
```typescript
const extractLawInfo = (text: string) => {
  const match = text.match(LAW_NAME_RE);
  if (!match?.[1]) return { lawName: null, lawNumber: null, lawYear: null };
  const rawLawName = normalizeLawName(match[1]);
  if (rawLawName.length === 0)
    return { lawName: null, lawNumber: null, lawYear: null };

  const normalizedName = normalizeArabicDigits(rawLawName);
  const numMatch = normalizedName.match(/(?:رقم)\s*(\d+)/i);
  const yearMatch = normalizedName.match(/(?:لسنة|لعام|سنة|عام)\s*(\d{4})/i);

  return {
    lawName: rawLawName,
    lawNumber: numMatch?.[1] ?? null,
    lawYear: yearMatch?.[1] ?? null,
  };
};
```

**Logic Flow**:
1. **Match law name pattern**: Use `LAW_NAME_RE` to find law references
2. **Validate match**: Return nulls if no match or empty capture group
3. **Clean law name**: Remove trailing punctuation and normalize spacing
4. **Validate cleaned name**: Return nulls if name is empty after cleaning
5. **Normalize digits**: Convert Arabic-Indic to Western for number extraction
6. **Extract law number**: Match "رقم 123" pattern
7. **Extract year**: Match "لسنة 2020" or variations
8. **Return structured data**: All three fields (name, number, year)

**Why this approach**:
- **Preservation**: Stores raw law name before digit normalization (for display)
- **Dual purpose**: Extracts both the law name AND embedded metadata
- **Flexible patterns**: Handles various year keywords (لسنة, لعام, سنة, عام)
- **4-digit year validation**: `\d{4}` ensures we don't match day/month numbers
- **Null safety**: Uses optional chaining and nullish coalescing throughout

**LAW_NAME_RE Pattern**:
```typescript
/(?:(?:من|في)\s+)?((?:قانون|لائحة|اللائحة|قرار|نظام|مرسوم|تعميم|تشريع|أمر)[^؟\n\r،.]*)/i
```
- **Optional prefix**: `(?:من|في)\s+)?` matches "من قانون" or "في لائحة"
- **Law type keywords**: قانون (law), لائحة (regulation), قرار (decision), etc.
- **Capture everything after**: `[^؟\n\r،.]*` captures until sentence boundaries

**Examples**:
```typescript
extractLawInfo("قانون العمل رقم 12 لسنة 2003")
// → { lawName: "قانون العمل رقم 12 لسنة 2003", lawNumber: "12", lawYear: "2003" }

extractLawInfo("لائحة التأمين")
// → { lawName: "لائحة التأمين", lawNumber: null, lawYear: null }

extractLawInfo("من قانون رقم ٥ لعام ٢٠٢٠")
// → { lawName: "قانون رقم ٥ لعام ٢٠٢٠", lawNumber: "5", lawYear: "2020" }

extractLawInfo("المادة 10")
// → { lawName: null, lawNumber: null, lawYear: null } // No law keyword
```

---

### 7. `extractAppealInfo(text: string)`

**Purpose**: Extract court ruling metadata (appeal number, judicial year).

**Implementation**:
```typescript
const extractAppealInfo = (text: string) => {
  const normalized = normalizeArabicDigits(text);
  const appealMatch = normalized.match(APPEAL_RE);
  const yearMatch = normalized.match(JUDICIAL_YEAR_RE);
  return {
    appealNumber: appealMatch?.[1] ?? null,
    judicialYear: yearMatch?.[1] ?? null,
  };
};
```

**Logic Flow**:
1. **Normalize digits**: Convert Arabic-Indic to Western
2. **Match appeal pattern**: Extract number after "الطعن رقم"
3. **Match year pattern**: Extract year after "لسنة"
4. **Return structured data**: Both fields with nullish coalescing

**Why this approach**:
- **Separate from law info**: Court rulings have different metadata structure
- **Year flexibility**: Uses `[\d٠-٩]{1,4}` to allow 2 or 4 digit years
- **Optional fields**: Either or both fields may be present

**Regex Patterns**:
```typescript
APPEAL_RE        = /الطعن\s+رقم\s+([\d٠-٩]+)/i
JUDICIAL_YEAR_RE = /الطعن\s+رقم\s+[\d٠-٩]+\s+لسنة\s+([\d٠-٩]{1,4})/i
```

**Examples**:
```typescript
extractAppealInfo("الطعن رقم 513 لسنة 16")
// → { appealNumber: "513", judicialYear: "16" }

extractAppealInfo("الطعن رقم ٢٥٨")
// → { appealNumber: "258", judicialYear: null }

extractAppealInfo("قانون العمل")
// → { appealNumber: null, judicialYear: null }
```

---

### 8. `parseLegalReference(text: string): ParsedLegalReference` (Main Function)

**Purpose**: Orchestrate all parsing logic to extract structured legal reference data.

**Implementation**:
```typescript
export const parseLegalReference = (text: string): ParsedLegalReference => {
  const articleNumbers = extractSection(text, ARTICLES_RE);
  const { lawName, lawNumber, lawYear } = extractLawInfo(text);
  const { appealNumber, judicialYear } = extractAppealInfo(text);

  return {
    normalizedQuery: normalizeWhitespace(text),
    articleNumber: articleNumbers.length > 0 ? articleNumbers[0] : null,
    articleNumbers,
    paragraphs: extractSection(text, PARAGRAPHS_RE),
    clauses: extractSection(text, CLAUSES_RE),
    lawName,
    lawNumber,
    lawYear,
    appealNumber,
    judicialYear,
  };
};
```

**Logic Flow**:
1. **Extract article numbers**: Using `ARTICLES_RE` pattern
2. **Extract law metadata**: Name, number, year
3. **Extract court ruling metadata**: Appeal number, judicial year
4. **Construct result object**: Combine all extracted data
5. **Normalize query**: Store cleaned version of original text
6. **Backward compatibility**: Provide both `articleNumber` (single) and `articleNumbers` (array)

**Why this approach**:
- **Parallel extraction**: All patterns run independently (order doesn't matter)
- **Comprehensive**: Captures all possible legal reference types in one pass
- **Backward compatible**: Maintains `articleNumber` field while adding `articleNumbers`
- **Always returns**: Never throws, always returns structured data (fields may be null)

**Return Type Structure**:
```typescript
type ParsedLegalReference = {
  normalizedQuery: string;      // Cleaned input text
  articleNumber: string | null; // Backward compat: first article
  articleNumbers: string[];     // All articles (supports ranges)
  paragraphs: string[];         // Paragraph numbers
  clauses: string[];            // Clause numbers
  lawName: string | null;       // Full law name
  lawNumber: string | null;     // Extracted from law name
  lawYear: string | null;       // Extracted from law name
  appealNumber: string | null;  // Court ruling number
  judicialYear: string | null;  // Court ruling year
};
```

**Examples**:
```typescript
parseLegalReference("المادة 5 من قانون العمل رقم 12 لسنة 2003")
// → {
//   normalizedQuery: "المادة 5 من قانون العمل رقم 12 لسنة 2003",
//   articleNumber: "5",
//   articleNumbers: ["5"],
//   paragraphs: [],
//   clauses: [],
//   lawName: "قانون العمل رقم 12 لسنة 2003",
//   lawNumber: "12",
//   lawYear: "2003",
//   appealNumber: null,
//   judicialYear: null
// }

parseLegalReference("المواد من 10 إلى 12 الفقرة 2")
// → {
//   normalizedQuery: "المواد من 10 إلى 12 الفقرة 2",
//   articleNumber: "10",
//   articleNumbers: ["10", "11", "12"],
//   paragraphs: ["2"],
//   clauses: [],
//   lawName: null,
//   lawNumber: null,
//   lawYear: null,
//   appealNumber: null,
//   judicialYear: null
// }

parseLegalReference("الطعن رقم 513 لسنة 16")
// → {
//   normalizedQuery: "الطعن رقم 513 لسنة 16",
//   articleNumber: null,
//   articleNumbers: [],
//   paragraphs: [],
//   clauses: [],
//   lawName: null,
//   lawNumber: null,
//   lawYear: null,
//   appealNumber: "513",
//   judicialYear: "16"
// }
```

---

## Usage Examples

### In Classifier Service

```typescript
// File: services/classifier.service.ts
import { parseLegalReference } from "../utils/legal-ref-parser";

export class ClassifierService {
  classify(request: QueryRequest): ClassificationResult {
    const query = request.query.trim();
    const parsedReference = parseLegalReference(query);

    // Check if query contains legal reference indicators
    const hasLaw =
      parsedReference.articleNumbers.length > 0 ||
      parsedReference.appealNumber ||
      parsedReference.lawNumber ||
      parsedReference.lawYear ||
      (parsedReference.lawName && parsedReference.lawName.split(" ").length >= 2);

    if (hasLaw) return { category: "law_ref", parsedReference };
    if (CHAT_RE.test(query)) return { category: "chat" };
    return { category: "arabic_rag", parsedReference };
  }
}
```

**Classification Logic**:
- **law_ref**: Has articles, appeal number, law number/year, or multi-word law name
- **chat**: Matches casual conversation patterns (CHAT_RE)
- **arabic_rag**: Everything else (general legal questions)

---

## Related Files

### Core Files
- **`legal-ref-parser.ts`**: Main parsing logic (this document)
- **`classifier.service.ts`**: Uses parser for query classification
- **`arabic-normalize.ts`**: General Arabic text normalization (different purpose)

### Pattern Definitions
- **`regex/legal-ref.patterns.ts`**: Regex patterns for legal references
- **`regex/arabic.patterns.ts`**: Arabic text patterns and digit mappings
- **`regex/classifier.patterns.ts`**: Chat detection patterns

### Type Definitions
- **`types/classifier.types.ts`**: `ClassificationResult` type
- **`schemas/`**: Zod schemas for API validation

---

## Summary

### Key Design Principles

1. **Colocation**: Types defined with their producer functions
2. **Context-specific normalization**: Different rules for different use cases
3. **Progressive enhancement**: Parse what you can, return nulls for missing data
4. **Range support**: Handle both single numbers and ranges naturally
5. **Backward compatibility**: Maintain old fields while adding new ones
6. **Defensive programming**: Null checks, fallbacks, safe defaults

### Naming Issue to Fix

The local `normalizeLawName` function in `legal-ref-parser.ts` should be renamed to avoid confusion with the exported `normalizeLawName` in `arabic-normalize.ts`. They serve completely different purposes:

```typescript
// Suggested rename in legal-ref-parser.ts:
const stripTrailingPunctuation = (text: string): string =>
  normalizeWhitespace(text.replace(/[؟?.!,،]+$/g, ""));
```

### Testing Recommendations

When testing `parseLegalReference()`, ensure coverage for:
- Single articles: "المادة 5"
- Article ranges: "المواد 10-15"
- Multiple sections: "المادة 3 الفقرة 2 البند 1"
- Law metadata: "قانون العمل رقم 12 لسنة 2003"
- Court rulings: "الطعن رقم 513 لسنة 16"
- Arabic-Indic digits: "المادة ٥"
- Edge cases: Empty strings, only keywords, malformed input
