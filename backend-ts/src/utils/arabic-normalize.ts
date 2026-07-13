import { TASHKEEL_RE, TATWEEL_RE, ARABIC_TO_WESTERN_DIGITS } from "../regex/arabic.patterns";

// General Arabic query normalization — used for query rewriting, overlap
// scoring, and any context where ة→ه collapsing is acceptable.
export const normalizeArabicQuery = (text: string): string =>
  text
    .replace(TASHKEEL_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => ARABIC_TO_WESTERN_DIGITS[d] ?? d)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// Law-name normalization — used to match user-supplied law names against the
// DB's law_name_normalized field. Intentionally does NOT apply ة→ه.
export const normalizeLawName = (text: string): string =>
  text
    .replace(TASHKEEL_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => ARABIC_TO_WESTERN_DIGITS[d] ?? d)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
