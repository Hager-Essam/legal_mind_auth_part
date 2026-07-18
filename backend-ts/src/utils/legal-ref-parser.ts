import {ARTICLES_RE,PARAGRAPHS_RE,CLAUSES_RE,LAW_NAME_RE,APPEAL_RE,JUDICIAL_YEAR_RE,} from "../regex/legal-ref.patterns";
import { ARABIC_TO_WESTERN_DIGITS } from "../regex/arabic.patterns";

export type ParsedLegalReference = {
  normalizedQuery: string;
  articleNumber: string | null; // kept for backward compatibility
  articleNumbers: string[];
  paragraphs: string[];
  clauses: string[];
  lawName: string | null;
  lawNumber: string | null;
  lawYear: string | null;
  // Court ruling fields
  appealNumber: string | null;
  judicialYear: string | null;
};




const normalizeArabicDigits = (text: string): string =>
  text.replace(/[٠-٩]/g, (digit) => ARABIC_TO_WESTERN_DIGITS[digit] ?? digit);

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const stripTrailingPunctuation  = (lawName: string): string =>
  normalizeWhitespace(lawName.replace(/[؟?.!,،]+$/g, ""));



const parseNumbers = (text: string): string[] => 
{
  const normalized = normalizeArabicDigits(text);
  const rangeMatch = normalized.match(/(\d+)\s*(?:-|إلى|الى|حتى)\s*(\d+)/);

  if (rangeMatch) 
  {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);

    // 1149 is the maximum number of articles in the Egyptian Penal Code, so we limit the range to avoid generating too many numbers.
    if (start < end && end - start < 1149) {
      const nums: string[] = [];
      for (let i = start; i <= end; i++) nums.push(i.toString());
      return nums;
    }
  }

  const matches = normalized.match(/\d+/g);
  return matches ?? [];
};

const extractSection = (text: string, keywordRegex: RegExp): string[] => {
  const match = text.match(keywordRegex);
  if (!match) return [];
  return parseNumbers(match[1]);
};

const extractLawInfo = (text: string) => {
  const match = text.match(LAW_NAME_RE);
  if (!match?.[1]) return { lawName: null, lawNumber: null, lawYear: null };
  const rawLawName = stripTrailingPunctuation(match[1]);
  if (rawLawName.length === 0)
    return { lawName: null, lawNumber: null, lawYear: null };

  const normalizedName = normalizeArabicDigits(rawLawName);
  const numMatch = normalizedName.match(/(?:رقم)\s*(\d+)/i);
  const yearMatch = normalizedName.match(/(?:لسنة|لعام|سنة|عام)\s*(\d{4})/i);

  return {
    lawName: rawLawName,
    lawNumber: numMatch?.[1] ?? null,
    lawYear: yearMatch?.[1] ?? null,
  };
};

const extractAppealInfo = (text: string) => {
  const normalized = normalizeArabicDigits(text);
  const appealMatch = normalized.match(APPEAL_RE);
  const yearMatch = normalized.match(JUDICIAL_YEAR_RE);
  return {
    appealNumber: appealMatch?.[1] ?? null,
    judicialYear: yearMatch?.[1] ?? null,
  };
};

export const parseLegalReference = (text: string): ParsedLegalReference => {
  const articleNumbers = extractSection(text, ARTICLES_RE);
  const { lawName, lawNumber, lawYear } = extractLawInfo(text);
  const { appealNumber, judicialYear } = extractAppealInfo(text);

  return {
    normalizedQuery: normalizeWhitespace(text),
    articleNumber: articleNumbers.length > 0 ? articleNumbers[0] : null,
    articleNumbers,
    paragraphs: extractSection(text, PARAGRAPHS_RE),
    clauses: extractSection(text, CLAUSES_RE),
    lawName,
    lawNumber,
    lawYear,
    appealNumber,
    judicialYear,
  };
};
