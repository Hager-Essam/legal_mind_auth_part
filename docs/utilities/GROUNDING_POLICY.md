# Grounding Policy Utility Guide

> Status: Implemented
> Verified against: `src/utils/grounding-policy.ts`
> Related services: QueryService, GenerationService

---

## Overview

`grounding-policy.ts` enforces anti-hallucination quality gates on retrieved evidence before LLM generation runs. It verifies that candidate chunks satisfy minimum score thresholds, metadata citation requirements, and Egyptian legal governance rules.

---

## Qualification Criteria (`isQualifiedGroundingChunk`)

A legal chunk is qualified for LLM generation **only** if all of the following conditions hold:

1. **Relevance Threshold**: `relevanceScore >= 0.35`.
2. **Metadata Pinpoint**: Must contain an official title AND an article/appeal number or authority ID.
3. **Jurisdiction**: `jurisdiction === 'EG'`.
4. **Retrieval Status**: `is_retrievable === true` and `reviewStatus === 'published'`.
5. **Authority Validity**: `authorityStatus` IN `['effective', 'amended', 'unknown']` (or `historical` for Court of Cassation rulings).
6. **Authority Type**: `authorityType !== 'generated_summary'` (Summaries are never primary legal evidence).

---

## Refusal Decision (`evaluateGrounding`)

If 0 retrieved chunks satisfy the qualification criteria, `evaluateGrounding()` returns:
```ts
{
  shouldGenerate: false,
  qualifiedChunks: [],
  refusalAnswer: "لا تتوفر أدلة قانونية مصرية منشورة وموثقة بما يكفي للإجابة بدقة. يرجى تحديد القانون أو المادة أو إعادة صياغة السؤال."
}
```

---

## Related Files

* Primary source: `src/utils/grounding-policy.ts`
* Types: `src/types/grounding.types.ts`
* Consumers: [QueryService](../services/QUERY_SERVICE_IMPLEMENTATION.md)
