// ── Legal reference regex patterns ───────────────────────────────────────────
// Extracted from legal-ref-parser.ts for reuse and clarity.

/** Matches article references: "المادة 5", "مادة 3", "article 10" */
export const ARTICLES_RE =
  /(?:المادة|مادة|المواد|مواد|article|articles)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;

/** Matches paragraph references: "الفقرة 3", "فقرة 1" */
export const PARAGRAPHS_RE =
  /(?:الفقرة|فقرة|الفقرات|فقرات|paragraph|paragraphs)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;

/** Matches clause references: "البند 2", "بند 5" */
export const CLAUSES_RE =
  /(?:البند|بند|البلنود|بنود|clause|clauses)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;

/** Matches chapter references: "الفصل 4", "فصل 1" */
export const CHAPTERS_RE =
  /(?:الفصل|فصل|الفصول|فصول|chapter|chapters)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;

/** Matches part references: "الباب 2", "باب 1" */
export const PARTS_RE =
  /(?:الباب|باب|الأبواب|ابواب|أبواب|part|parts)\s*([0-9٠-٩\sو،,إلىالىحتى\-]+)/i;

/** Matches law name references: "قانون العمل", "لائحة التأمين" */
export const LAW_NAME_RE =
  /(?:(?:من|في)\s+)?((?:قانون|لائحة|اللائحة|قرار|نظام|مرسوم|تعميم|تشريع|أمر)[^؟\n\r،.]*)/i;

// ── Court ruling (النقض) regexes ─────────────────────────────────────────────

/** Matches appeal number: "الطعن رقم 513" */
export const APPEAL_RE = /الطعن\s+رقم\s+([\d٠-٩]+)/i;

/** Matches judicial year: "الطعن رقم 513 لسنة 16" */
export const JUDICIAL_YEAR_RE = /الطعن\s+رقم\s+[\d٠-٩]+\s+لسنة\s+([\d٠-٩]{1,4})/i;
