import assert from "node:assert/strict";
import { test } from "node:test";
import type { LegalChunks } from "../schemas/chunk.schema";
import type { ProviderConfigService } from "../infrastructure/provider/provider-config.service";
import { QueryRewriteService } from "../modules/legal-query/query-rewrite.service";
import {
  MAX_AUTHORITY_BOOST,
  applyAuthorityBoosts,
  detectAuthorityHints,
} from "../utils/law-mapping";

const LABOR_ID = "eg-law-14-2025-labor";
const SOCIAL_INSURANCE_ID = "eg-law-148-2019-social-insurance-pensions";
const PUBLIC_CONTRACTS_ID = "eg-law-182-2018-public-contracts";
const LABOR_TITLE = "قانون العمل الصادر بالقانون رقم 14 لسنة 2025";

const chunk = (
  chunkId: string,
  rerankScore: number,
  authorityId?: string,
  authorityStatus: LegalChunks["authorityStatus"] = "effective",
): LegalChunks => ({
  chunk_id: chunkId,
  content: "نص قانوني منشور",
  law_name_normalized: "قانون تجريبي",
  law_category: "test",
  source_dataset: "test",
  language: "ar",
  semantic_unit: "article",
  hierarchy_path: "",
  is_retrievable: true,
  text_len: 16,
  jurisdiction: "EG",
  reviewStatus: "published",
  authorityStatus,
  authorityId,
  rerank_score: rerankScore,
});

test("detects every relevant domain in one query", () => {
  const hints = detectAuthorityHints("ما حقوق العامل التأمينية بعد الفصل؟");
  assert.deepEqual(
    new Set(hints.map((hint) => hint.authorityId)),
    new Set([LABOR_ID, SOCIAL_INSURANCE_ID]),
  );
});

test("specific phrases are stronger than individual words", () => {
  const phrase = detectAuthorityHints("ما شروط عقد عمل؟")[0];
  const word = detectAuthorityHints("ما حقوق عامل؟")[0];
  assert.equal(phrase.authorityId, LABOR_ID);
  assert.equal(word.authorityId, LABOR_ID);
  assert.ok(phrase.weight > word.weight);
});

test("ambiguous aliases do not activate a domain", () => {
  for (const query of [
    "عمل الخير مهم",
    "ما حكم التأمين في العقد؟",
    "ما اختصاص جهة إدارية؟",
    "ما عقوبة فصل في نزاع؟",
    "ما حقوق موظف؟",
  ]) {
    assert.deepEqual(detectAuthorityHints(query), []);
  }

  const procurement = detectAuthorityHints("ما قواعد شراء جهة إدارية للتوريدات؟");
  assert.equal(procurement[0]?.authorityId, PUBLIC_CONTRACTS_ID);
});

test("an explicit law reference suppresses automatic mapping for the same domain", () => {
  const hints = detectAuthorityHints(
    "ما حكم فصل العامل في قانون العمل رقم 12 لسنة 2003؟",
  );
  assert.equal(hints.some((hint) => hint.authorityId === LABOR_ID), false);
});

test("an explicit reference in one domain does not suppress another domain", () => {
  const hints = detectAuthorityHints(
    "تأثير قانون العمل رقم 14 لسنة 2025 على التأمينات الاجتماعية",
  );
  assert.equal(hints.some((hint) => hint.authorityId === LABOR_ID), false);
  assert.equal(
    hints.some((hint) => hint.authorityId === SOCIAL_INSURANCE_ID),
    true,
  );
});

test("authority boosts are bounded and cannot hide a stronger legacy result", () => {
  const boosted = applyAuthorityBoosts(
    [
      chunk("canonical", 0.9, LABOR_ID),
      chunk("legacy", 0.99, "legacy-judgment-1", "unknown"),
    ],
    [{ authorityId: LABOR_ID, weight: 0.5 }],
  );

  assert.equal(boosted[0].chunk_id, "legacy");
  assert.equal(boosted[0].rerank_score, 0.99);
  assert.equal(boosted[1].rerank_score, 0.9 + MAX_AUTHORITY_BOOST);
});

test("query rewriting preserves the exact original and expands only retrievalQuery", async () => {
  const service = new QueryRewriteService(
    {} as ProviderConfigService,
    async () => new Map([[LABOR_ID, LABOR_TITLE]]),
  );
  const original = "  ما مدة إجازة العامل؟  ";
  const result = await service.rewrite(original, "lawyer");

  assert.equal(result.originalQuery, original);
  assert.equal(result.rewrittenQuery, original.trim());
  assert.ok(result.retrievalQuery.startsWith(original.trim()));
  assert.ok(result.retrievalQuery.includes(LABOR_TITLE));
  assert.deepEqual(result.authorityBoosts.map((boost) => boost.authorityId), [LABOR_ID]);
});

test("unrelated queries keep their existing retrieval text and receive no boosts", async () => {
  const service = new QueryRewriteService(
    {} as ProviderConfigService,
    async () => new Map([[LABOR_ID, LABOR_TITLE]]),
  );
  const query = "ما شروط صحة عقد البيع؟";
  const result = await service.rewrite(query, "lawyer");

  assert.equal(result.originalQuery, query);
  assert.equal(result.rewrittenQuery, query);
  assert.equal(result.retrievalQuery, query);
  assert.deepEqual(result.authorityBoosts, []);
  assert.equal(result.usedMapping, false);
});
