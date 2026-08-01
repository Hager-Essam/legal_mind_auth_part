export type AuthorityStatus = "effective" | "amended" | "repealed" | "historical" | "unknown";

export type AuthorityStatusEvidence = {
  title: string;
  url: string;
  publisher: string;
};

export type AuthorityMatch = {
  lawNumber: string;
  lawYear: string;
  lawCategory?: string;
  articleNumberFrom?: number;
  articleNumberTo?: number;
};

export type AuthorityStatusRegistryEntry = {
  authorityId: string;
  authorityTitleOfficial: string;
  authorityType: "statute";
  jurisdiction: "EG";
  authorityStatus: AuthorityStatus;
  effectiveTo?: string;
  replacedByAuthorityId?: string;
  replacementEffectiveFrom?: string;
  match: AuthorityMatch;
  evidence: AuthorityStatusEvidence[];
  verifiedAt: string;
  notes: string;
  safeToDisableLegacyRetrieval: boolean;
};

/**
 * Curated authority-status facts backed by Egyptian-government sources.
 * A status match does not verify that the legacy chunk text is verbatim,
 * complete, consolidated, or suitable for publication.
 */
export const authorityStatusRegistry: AuthorityStatusRegistryEntry[] = [
  {
    authorityId: "eg-law-12-2003-labor",
    authorityTitleOfficial: "قانون العمل الصادر بالقانون رقم 12 لسنة 2003",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    effectiveTo: "2025-08-31",
    replacedByAuthorityId: "eg-law-14-2025-labor",
    replacementEffectiveFrom: "2025-09-01",
    match: { lawNumber: "12", lawYear: "2003", lawCategory: "العمل" },
    evidence: [
      { title: "قانون العمل رقم 14 لسنة 2025", url: "https://www.labour.gov.eg/ar/القوانين-والتشريعات/", publisher: "وزارة العمل المصرية" },
      { title: "بدء تنفيذ قانون العمل الجديد من أول سبتمبر", url: "https://sis.gov.eg/ar/المركز-الإعلامي/عرض-الصحافة/عرض-الصحافة-اليومية-4-9-2025/", publisher: "الهيئة العامة للاستعلامات" },
    ],
    verifiedAt: "2026-07-30",
    notes: "Current labor-law answers require an official consolidated Law 14/2025 corpus.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-8-1997-investment-guarantees",
    authorityTitleOfficial: "قانون ضمانات وحوافز الاستثمار الصادر بالقانون رقم 8 لسنة 1997",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    replacedByAuthorityId: "eg-law-72-2017-investment",
    match: { lawNumber: "8", lawYear: "1997" },
    evidence: [{ title: "قانون الاستثمار رقم 72 لسنة 2017", url: "https://www.gafi.gov.eg/Arabic/StartaBusiness/Laws-and-Regulations/SiteAssets/Pages/BusinessLaws/قانون%20الاستثمار%2072%20لسنة%202017%20وفق%20التعديلات%20الأخيرة.pdf", publisher: "الهيئة العامة للاستثمار والمناطق الحرة" }],
    verifiedAt: "2026-07-30",
    notes: "Article 8 of Law 72/2017 repeals Law 8/1997.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-79-1975-social-insurance",
    authorityTitleOfficial: "قانون التأمين الاجتماعي الصادر بالقانون رقم 79 لسنة 1975",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    effectiveTo: "2019-12-31",
    replacedByAuthorityId: "eg-law-148-2019-social-insurance-pensions",
    replacementEffectiveFrom: "2020-01-01",
    match: { lawNumber: "79", lawYear: "1975" },
    evidence: [
      { title: "حكم المحكمة الدستورية العليا بشأن إلغاء قانون 79 لسنة 1975", url: "https://www.sccourt.gov.eg/SCC/faces/Rules_Html/14079_33_116_1_2.html?timestamp=1708044509165", publisher: "المحكمة الدستورية العليا" },
      { title: "قانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019", url: "https://www.nosi.gov.eg/ar/News/Pages/Pension-Law-1.aspx", publisher: "الهيئة القومية للتأمين الاجتماعي" },
    ],
    verifiedAt: "2026-07-30",
    notes: "Law 148/2019 applies from 2020-01-01.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-89-1998-public-procurement",
    authorityTitleOfficial: "قانون تنظيم المناقصات والمزايدات الصادر بالقانون رقم 89 لسنة 1998",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    replacedByAuthorityId: "eg-law-182-2018-public-contracts",
    match: { lawNumber: "89", lawYear: "1998" },
    evidence: [{ title: "قانون تنظيم التعاقدات التي تبرمها الجهات العامة رقم 182 لسنة 2018", url: "https://sis.gov.eg/ar/بوابة-معلومات-للمصريين-بالخارج/اقتصاد-واستثمار/التشريعات-الحاكمة-للاستثمار/", publisher: "الهيئة العامة للاستعلامات" }],
    verifiedAt: "2026-07-30",
    notes: "Law 182/2018 cancelled Law 89/1998.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-11-1991-general-sales-tax",
    authorityTitleOfficial: "قانون الضريبة العامة على المبيعات الصادر بالقانون رقم 11 لسنة 1991",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    replacedByAuthorityId: "eg-law-67-2016-vat",
    match: { lawNumber: "11", lawYear: "1991" },
    evidence: [{ title: "قانون الضريبة على القيمة المضافة رقم 67 لسنة 2016", url: "https://www.eta.gov.eg/ar/content/qwanyn-aldrybt-ly-alqymt-almdaft", publisher: "مصلحة الضرائب المصرية" }],
    verifiedAt: "2026-07-30",
    notes: "Article 2 of Law 67/2016 expressly repeals Law 11/1991.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-73-1956-political-rights",
    authorityTitleOfficial: "قانون تنظيم مباشرة الحقوق السياسية رقم 73 لسنة 1956",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    replacedByAuthorityId: "eg-law-45-2014-political-rights",
    match: { lawNumber: "73", lawYear: "1956" },
    evidence: [{ title: "قرار بقانون رقم 45 لسنة 2014 بتنظيم مباشرة الحقوق السياسية", url: "https://www.elections.eg/images/pdfs/laws/PoliRights-2014-45.pdf.pdf", publisher: "الهيئة الوطنية للانتخابات" }],
    verifiedAt: "2026-07-30",
    notes: "Article 1 of Law 45/2014 expressly repeals Law 73/1956.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-17-1999-commercial-bankruptcy-part",
    authorityTitleOfficial: "الباب الخامس من قانون التجارة رقم 17 لسنة 1999 (المواد 550 إلى 772)",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "repealed",
    replacedByAuthorityId: "eg-law-11-2018-restructuring-bankruptcy",
    match: { lawNumber: "17", lawYear: "1999", articleNumberFrom: 550, articleNumberTo: 772 },
    evidence: [{ title: "قانون التجارة رقم 17 لسنة 1999 - بيان المواد الملغاة", url: "https://stage.investment.gov.eg/legislation/download/187", publisher: "الهيئة العامة للاستثمار والمناطق الحرة" }],
    verifiedAt: "2026-07-30",
    notes: "Only Articles 550-772 are matched; the rest of Commercial Law 17/1999 remains outside this rule.",
    safeToDisableLegacyRetrieval: true,
  },
  {
    authorityId: "eg-law-150-1950-criminal-procedure",
    authorityTitleOfficial: "قانون الإجراءات الجنائية الصادر بالقانون رقم 150 لسنة 1950",
    authorityType: "statute",
    jurisdiction: "EG",
    authorityStatus: "amended",
    effectiveTo: "2026-09-30",
    replacedByAuthorityId: "eg-law-174-2025-criminal-procedure",
    replacementEffectiveFrom: "2026-10-01",
    match: { lawNumber: "150", lawYear: "1950" },
    evidence: [
      { title: "إصدار قانون الإجراءات الجنائية الجديد وموعد العمل به", url: "https://www.presidency.eg/AR/قسم-الأخبار/أخبار-رئاسية/news12112025/", publisher: "رئاسة جمهورية مصر العربية" },
      { title: "الجريدة الرسمية - قانون رقم 174 لسنة 2025", url: "https://mediadr.sis.gov.eg/handle/123456789/113663", publisher: "مطابع الأميرية / الهيئة العامة للاستعلامات" },
    ],
    verifiedAt: "2026-07-30",
    notes: "Law 174/2025 is enacted but starts on 2026-10-01; Law 150/1950 is still current today.",
    safeToDisableLegacyRetrieval: false,
  },
];

const normalizeDigits = (value: string): string => value
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const normalizeText = (value: unknown): string => normalizeDigits(typeof value === "string" ? value : "")
  .normalize("NFKC")
  .replace(/\s+/g, " ")
  .trim();

export type AuthorityMatchableChunk = {
  law_number?: unknown;
  law_year?: unknown;
  law_category?: unknown;
  law_name?: unknown;
  law_name_normalized?: unknown;
  article_number?: unknown;
};

export const matchesAuthorityEntry = (
  chunk: AuthorityMatchableChunk,
  entry: AuthorityStatusRegistryEntry,
): boolean => {
  const match = entry.match;
  if (normalizeText(chunk.law_number) !== match.lawNumber) return false;
  if (normalizeText(chunk.law_year) !== match.lawYear) return false;
  if (match.lawCategory && normalizeText(chunk.law_category) !== normalizeText(match.lawCategory)) return false;
  if (match.articleNumberFrom !== undefined || match.articleNumberTo !== undefined) {
    const normalizedArticle = normalizeText(chunk.article_number);
    if (!/^\d+$/.test(normalizedArticle)) return false;
    const article = Number(normalizedArticle);
    if (match.articleNumberFrom !== undefined && article < match.articleNumberFrom) return false;
    if (match.articleNumberTo !== undefined && article > match.articleNumberTo) return false;
  }
  return true;
};
