# Context Builder Utility Guide

> Status: Implemented
> Verified against: `src/utils/context-builder.ts`
> Related services: QueryService, GenerationService

---

## Overview

`context-builder.ts` formats qualified `LegalChunks` into a structured XML evidence block (`<legal_evidence>`) consumed by `GenerationService` during LLM prompt assembly.

---

## Functions & Signatures

### `buildArabicLegalContext(chunks: LegalChunks[]): string`
* **Inputs**: Array of qualified `LegalChunks`.
* **Outputs**: Formatted XML string containing `<source id="S1">` blocks with escaped HTML/XML special characters.

---

## Format Specification

```xml
<legal_evidence>
  <source id="S1">
    <jurisdiction>EG</jurisdiction>
    <authority_type>statute</authority_type>
    <official_title>قانون العمل رقم 12 لسنة 2003</official_title>
    <article_number>12</article_number>
    <status>effective</status>
    <text>يلتزم صاحب العمل...</text>
  </source>
</legal_evidence>
```

---

## Security Features
* Escapes `<` `, `>` `, `&` `, `'` `, `"` characters via `escapeXml()` to prevent prompt injection and malformed XML tags inside evidence text.

---

## Related Files

* Primary source: `src/utils/context-builder.ts`
* Consumers: [QueryService](../services/QUERY_SERVICE_IMPLEMENTATION.md), [GenerationService](../services/GENERATION_SERVICE_IMPLEMENTATION.md)
