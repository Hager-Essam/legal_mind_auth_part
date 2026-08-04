const NUMBER_LIST = "([0-9٠-٩\\sو،,إاىحت\\-]+)";

export const ARTICLES_RE = new RegExp(`(?:المادة|مادة|المواد|مواد|article|articles)\\s*${NUMBER_LIST}`, "i");
export const PARAGRAPHS_RE = new RegExp(
  `(?:الفقرة|فقرة|الفقرات|فقرات|paragraph|paragraphs)\\s*${NUMBER_LIST}`,
  "i"
);
export const CLAUSES_RE = new RegExp(`(?:البند|بند|البنود|بنود|clause|clauses)\\s*${NUMBER_LIST}`, "i");
export const CHAPTERS_RE = new RegExp(`(?:الفصل|فصل|الفصول|فصول|chapter|chapters)\\s*${NUMBER_LIST}`, "i");
export const PARTS_RE = new RegExp(`(?:الباب|باب|الأبواب|ابواب|أبواب|part|parts)\\s*${NUMBER_LIST}`, "i");

export const LAW_NAME_RE =
  /(?:(?:من|في)\s+)?((?:قانون|لائحة|اللائحة|قرار|نظام|مرسوم|تعميم|تشريع|أمر)[^؟\n\r،.]*)/i;
export const APPEAL_RE = /الطعن\s+رقم\s+([\d٠-٩]+)/i;
export const JUDICIAL_YEAR_RE = /الطعن\s+رقم\s+[\d٠-٩]+\s+لسنة\s+([\d٠-٩]{1,4})/i;
