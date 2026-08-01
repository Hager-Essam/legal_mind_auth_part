import {
  APPEAL_RE,
  ARTICLES_RE,
  CLAUSES_RE,
  JUDICIAL_YEAR_RE,
  LAW_NAME_RE,
  PARAGRAPHS_RE,
} from "./legal-ref.patterns";
import { ARABIC_TO_WESTERN_DIGITS } from "../../regex/arabic.patterns";

export type ParsedLegalReference = {
  normalizedQuery: string;
  articleNumber: string | null;
  articleNumbers: string[];
  paragraphs: string[];
  clauses: string[];
  lawName: string | null;
  lawNumber: string | null;
  lawYear: string | null;
  appealNumber: string | null;
  judicialYear: string | null;
};

const normalizeArabicDigits = (text: string): string =>
  text.replace(
    /[٠-٩]/g,
    (digit) => ARABIC_TO_WESTERN_DIGITS[digit] ?? digit,
  );

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const parseNumbers = (text: string): string[] => {
  const normalized = normalizeArabicDigits(text);
  const range = normalized.match(/(\d+)\s*(?:-|إلى|الى|حتى)\s*(\d+)/);
  if (range) {
    const start = Number.parseInt(range[1], 10);
    const end = Number.parseInt(range[2], 10);
    if (start <= end && end - start < 1_150) {
      return Array.from({ length: end - start + 1 }, (_, index) =>
        String(start + index),
      );
    }
  }
  return normalized.match(/\d+/g) ?? [];
};

const extractSection = (text: string, pattern: RegExp): string[] => {
  const match = text.match(pattern);
  return match?.[1] ? parseNumbers(match[1]) : [];
};

const extractLawInfo = (text: string) => {
  const match = text.match(LAW_NAME_RE);
  if (!match?.[1]) {
    return { lawName: null, lawNumber: null, lawYear: null };
  }
  const lawName = normalizeWhitespace(match[1].replace(/[؟?.!,،]+$/g, ""));
  const normalized = normalizeArabicDigits(lawName);
  return {
    lawName: lawName || null,
    lawNumber: normalized.match(/رقم\s*(\d+)/i)?.[1] ?? null,
    lawYear:
      normalized.match(/(?:لسنة|لعام|سنة|عام)\s*(\d{4})/i)?.[1] ?? null,
  };
};
export const parseLegalReference = (
  text: string,
): ParsedLegalReference => {
  const normalized = normalizeArabicDigits(text);
  const articleNumbers = extractSection(normalized, ARTICLES_RE);
  const law = extractLawInfo(normalized);
  return {
    normalizedQuery: normalizeWhitespace(normalized),
    articleNumber: articleNumbers[0] ?? null,
    articleNumbers,
    paragraphs: extractSection(normalized, PARAGRAPHS_RE),
    clauses: extractSection(normalized, CLAUSES_RE),
    lawName: law.lawName,
    lawNumber: law.lawNumber,
    lawYear: law.lawYear,
    appealNumber: normalized.match(APPEAL_RE)?.[1] ?? null,
    judicialYear: normalized.match(JUDICIAL_YEAR_RE)?.[1] ?? null,
  };
};
