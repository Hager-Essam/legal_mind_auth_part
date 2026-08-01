# Arabic Normalization Utility Guide

> Status: Implemented
> Verified against: `src/utils/arabic-normalize.ts`
> Related services: RetrievalService, QueryRewriteService, ClassifierService

---

## Overview

`arabic-normalize.ts` provides pure utility functions for Arabic text normalization, stripping diacritics (Tashkeel), Tatweel elongation characters, standardizing Alef variants (`أ`, `إ`, `آ` -> `ا`), converting Eastern Arabic numerals to Western digits, and flattening whitespace.

---

## Functions & Signatures

### `normalizeArabicQuery(text: string): string`
Normalizes search query text, converting `ة` -> `ه` to maximize keyword match recall across colloquial queries.

### `normalizeLawName(text: string): string`
Normalizes law titles without converting `ة` -> `ه` to preserve official title structure.

---

## Normalization Steps

1. **Digit Conversion**: Replaces Eastern Arabic numerals (`٠-٩`) with Western digits (`0-9`).
2. **Tashkeel Removal**: Strips Arabic vowel marks (Fatha, Damma, Kasra, Sukun, Tanwin).
3. **Tatweel Removal**: Strips elongation characters (`ـ`).
4. **Alef & Ya Standardisation**: Converts `أ`, `إ`, `آ` to `ا`, and `ى` to `ي`.
5. **Special Character Stripping**: Replaces non-letter/non-number punctuation with spaces.

---

## Related Files

* Primary source: `src/utils/arabic-normalize.ts`
* Regex patterns: `src/regex/arabic.patterns.ts`
* Consumers: [RetrievalService](../services/RETRIEVAL_SERVICE_IMPLEMENTATION.md), [QueryRewriteService](../services/QUERY_REWRITE_SERVICE_IMPLEMENTATION.md)
