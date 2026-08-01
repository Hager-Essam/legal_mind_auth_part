# Legal Reference Parser Utility Guide

> Status: Implemented
> Verified against: `src/utils/legal-ref-parser.ts`
> Related services: ClassifierService, LegalRefService, QueryService

---

## Overview

`legal-ref-parser.ts` extracts explicit Egyptian legal citations (law names, law numbers, law years, article numbers, ranges of articles, and Court of Cassation appeal numbers) from Arabic query text using regular expressions and digit normalization.

---

## Functions & Signatures

### `parseLegalReference(text: string): ParsedLegalReference`
* **Inputs**: Query string in Arabic or Western digits.
* **Outputs**: `ParsedLegalReference` (`articleNumber`, `articleNumbers`, `lawName`, `lawNumber`, `lawYear`, `appealNumber`, `judicialYear`).

### `normalizeArabicDigits(text: string): string`
* **Inputs**: Text string containing Eastern Arabic numerals (`٠-٩`).
* **Outputs**: Text string converted to Western numerals (`0-9`).

---

## Extraction Examples

- Input: `"المادة 12 من قانون العمل رقم 12 لسنة 2003"`
- Output: `{ articleNumber: '12', lawName: 'قانون العمل رقم 12 لسنة 2003', lawNumber: '12', lawYear: '2003' }`

- Input: `"الطعن رقم 450 لسنة 85 قضائية"`
- Output: `{ appealNumber: '450', judicialYear: '85' }`

---

## Related Files

* Primary source: `src/utils/legal-ref-parser.ts`
* Regex patterns: `src/regex/legal-ref.patterns.ts`, `src/regex/arabic.patterns.ts`
* Consumers: [ClassifierService](../services/CLASSIFIER_SERVICE_IMPLEMENTATION.md), [QueryService](../services/QUERY_SERVICE_IMPLEMENTATION.md)
