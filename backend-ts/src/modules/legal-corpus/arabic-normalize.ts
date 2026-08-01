import {
  ARABIC_TO_WESTERN_DIGITS,
  TASHKEEL_RE,
  TATWEEL_RE,
} from "./arabic.patterns";

const normalizeDigits = (text: string): string =>
  text.replace(
    /[٠-٩]/g,
    (digit) => ARABIC_TO_WESTERN_DIGITS[digit] ?? digit,
  );

const normalizeShared = (text: string): string =>
  normalizeDigits(text)
    .replace(TASHKEEL_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeArabicQuery = (text: string): string =>
  normalizeShared(text).replace(/ة/g, "ه");

export const normalizeLawName = (text: string): string =>
  normalizeShared(text);
