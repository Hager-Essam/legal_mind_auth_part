# Law Mapping Utility Guide

> Status: Implemented with known limitations
> Verified against: `src/utils/law-mapping.ts`
> Related services: QueryRewriteService

---

## Overview

`law-mapping.ts` contains a dictionary matching common Egyptian legal terms, crimes, and colloquial concepts (e.g. *"نصب"*, *"إيجار"*, *"طلاق"*, *"شغل"*) to official Egyptian legislation titles (e.g. *"قانون العقوبات"*, *"قانون العمل رقم 12 لسنة 2003"*, *"قانون الإيجارات رقم 4 لسنة 1996"*).

---

## Functions & Signatures

### `rewriteWithMapping(query: string): LawMappingRewriteResult`
* **Inputs**: Normalized query text string.
* **Outputs**: `{ matched: boolean, rewritten: string, matchedTerm: string | null, appendedLaw: string | null }`.

---

## Law Categories Mapped

- **Corporate Law**: *"شركات"*, *"تأسيس شركة"* -> *"قانون الشركات رقم 159 لسنة 1981"*
- **Labor Law**: *"شغل"*, *"عقد عمل"*, *"إجازة"* -> *"قانون العمل رقم 12 لسنة 2003"*
- **Penal Code**: *"نصب"*, *"سرقة"*, *"اختلاس"* -> *"قانون العقوبات"*
- **Rent Law**: *"إيجار"*, *"مستأجر"* -> *"قانون الإيجارات رقم 4 لسنة 1996"*
- **Personal Status Law**: *"طلاق"*, *"نفقة"*, *"حضانة"* -> *"قانون الأحوال الشخصية"*
- **Customs Law**: *"جمارك"* -> *"قانون الجمارك رقم 66 لسنة 1963"*

---

## Related Files

* Primary source: `src/utils/law-mapping.ts`
* Consumers: [QueryRewriteService](../services/QUERY_REWRITE_SERVICE_IMPLEMENTATION.md)
