import type { LegalChunks } from "./chunk.schema";
import { normalizeArabicQuery } from "./arabic-normalize";

export type LegalDomain = "labor" | "social_insurance" | "public_contracts";

export type DetectedAuthorityHint = {
  domain: LegalDomain;
  authorityId: string;
  weight: number;
  matchedAliases: string[];
};

export type ResolvedAuthorityHint = DetectedAuthorityHint & {
  officialTitle?: string;
};

type AliasRule = {
  phrase: string;
  weight: number;
  requiredContext?: string[];
};

type DomainDefinition = {
  domain: LegalDomain;
  authorityId: string;
  explicitLawReferences: Array<{ number: string; year: string }>;
  explicitDomainPhrases: string[];
  aliases: AliasRule[];
};

export const MAX_AUTHORITY_BOOST = 0.08;
const MIN_DOMAIN_WEIGHT = 0.02;

const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    domain: "labor",
    authorityId: "eg-law-14-2025-labor",
    explicitLawReferences: [
      { number: "14", year: "2025" },
      { number: "12", year: "2003" },
    ],
    explicitDomainPhrases: ["قانون العمل"],
    aliases: [
      { phrase: "قانون العمل", weight: 0.06 },
      { phrase: "عقد عمل", weight: 0.055 },
      { phrase: "صاحب العمل", weight: 0.05 },
      { phrase: "حقوق العامل", weight: 0.055 },
      { phrase: "فصل العامل", weight: 0.06 },
      { phrase: "فصل من العمل", weight: 0.055 },
      { phrase: "اجازه العامل", weight: 0.05 },
      { phrase: "ساعات العمل", weight: 0.05 },
      { phrase: "نهايه الخدمه", weight: 0.05 },
      { phrase: "عامل", weight: 0.028 },
      { phrase: "عمال", weight: 0.028 },
      { phrase: "اجر", weight: 0.026 },
      { phrase: "اجور", weight: 0.026 },
      { phrase: "رواتب", weight: 0.024 },
      { phrase: "موظف", weight: 0.01 },
      {
        phrase: "فصل",
        weight: 0.012,
        requiredContext: ["عامل", "عمال", "موظف", "صاحب العمل", "عقد عمل"],
      },
      {
        phrase: "الفصل",
        weight: 0.012,
        requiredContext: ["عامل", "عمال", "موظف", "صاحب العمل", "عقد عمل"],
      },
    ],
  },
  {
    domain: "social_insurance",
    authorityId: "eg-law-148-2019-social-insurance-pensions",
    explicitLawReferences: [
      { number: "148", year: "2019" },
      { number: "79", year: "1975" },
    ],
    explicitDomainPhrases: ["قانون التامينات الاجتماعيه", "قانون التامين الاجتماعي"],
    aliases: [
      { phrase: "قانون التامينات الاجتماعيه والمعاشات", weight: 0.07 },
      { phrase: "قانون التامينات الاجتماعيه", weight: 0.065 },
      { phrase: "التامينات الاجتماعيه", weight: 0.06 },
      { phrase: "التامين الاجتماعي", weight: 0.055 },
      { phrase: "اشتراك تاميني", weight: 0.05 },
      { phrase: "اشتراكات تامينيه", weight: 0.05 },
      { phrase: "مومن عليه", weight: 0.05 },
      { phrase: "الهييه القوميه للتامين الاجتماعي", weight: 0.07 },
      { phrase: "سن المعاش", weight: 0.05 },
      { phrase: "حقوق تامينيه", weight: 0.045 },
      { phrase: "حقوق العامل التامينيه", weight: 0.055 },
      { phrase: "معاش", weight: 0.03 },
      { phrase: "معاشات", weight: 0.03 },
    ],
  },
  {
    domain: "public_contracts",
    authorityId: "eg-law-182-2018-public-contracts",
    explicitLawReferences: [
      { number: "182", year: "2018" },
      { number: "89", year: "1998" },
    ],
    explicitDomainPhrases: [
      "قانون تنظيم التعاقدات التي تبرمها الجهات العامه",
      "قانون المناقصات والمزايدات",
    ],
    aliases: [
      { phrase: "قانون تنظيم التعاقدات التي تبرمها الجهات العامه", weight: 0.07 },
      { phrase: "قانون المناقصات والمزايدات", weight: 0.065 },
      { phrase: "تعاقد حكومي", weight: 0.055 },
      { phrase: "عقد حكومي", weight: 0.05 },
      { phrase: "مناقصة", weight: 0.035 },
      { phrase: "مناقصه", weight: 0.035 },
      { phrase: "مزايدة", weight: 0.035 },
      { phrase: "مزايده", weight: 0.035 },
      { phrase: "توريد", weight: 0.028 },
      { phrase: "شراء", weight: 0.01 },
      { phrase: "تعاقد", weight: 0.012 },
      {
        phrase: "جهه اداريه",
        weight: 0.02,
        requiredContext: ["مناقصة", "مناقصه", "مزايدة", "مزايده", "توريد", "شراء", "تعاقد"],
      },
    ],
  },
];

const normalizeTokens = (value: string): string[] =>
  normalizeArabicQuery(value)
    .split(/\s+/u)
    .filter(Boolean);

const containsTokenPhrase = (tokens: string[], phrase: string): boolean => {
  const phraseTokens = normalizeTokens(phrase);
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) return false;

  for (let start = 0; start <= tokens.length - phraseTokens.length; start += 1) {
    if (phraseTokens.every((token, offset) => tokens[start + offset] === token)) return true;
  }
  return false;
};

const extractExplicitLawReferences = (normalizedQuery: string) => {
  const references: Array<{ number: string; year: string; index: number }> = [];
  const pattern = /(?:رقم\s+)?(\d+)\s+(?:(?:لسنه|سنه)\s+)?(\d{4})/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalizedQuery)) !== null) {
    references.push({ number: match[1], year: match[2], index: match.index });
  }
  return references;
};

const hasSameDomainExplicitReference = (
  normalizedQuery: string,
  definition: DomainDefinition,
): boolean => {
  const references = extractExplicitLawReferences(normalizedQuery);
  if (references.length === 0) return false;

  if (
    references.some((reference) =>
      definition.explicitLawReferences.some(
        (known) => known.number === reference.number && known.year === reference.year,
      ),
    )
  ) {
    return true;
  }

  return definition.explicitDomainPhrases.some((phrase) => {
    const normalizedPhrase = normalizeArabicQuery(phrase);
    const phraseIndex = normalizedQuery.indexOf(normalizedPhrase);
    return (
      phraseIndex >= 0 &&
      references.some((reference) => Math.abs(reference.index - phraseIndex) <= 80)
    );
  });
};

export const detectAuthorityHints = (query: string): DetectedAuthorityHint[] => {
  const normalizedQuery = normalizeArabicQuery(query);
  const tokens = normalizeTokens(query);

  return DOMAIN_DEFINITIONS.flatMap((definition) => {
    if (hasSameDomainExplicitReference(normalizedQuery, definition)) return [];

    const matches = definition.aliases.filter((alias) => {
      if (!containsTokenPhrase(tokens, alias.phrase)) return false;
      return (
        !alias.requiredContext ||
        alias.requiredContext.some((context) => containsTokenPhrase(tokens, context))
      );
    });

    const weight = Math.min(
      MAX_AUTHORITY_BOOST,
      matches.reduce((sum, match) => sum + match.weight, 0),
    );
    if (weight < MIN_DOMAIN_WEIGHT) return [];

    return [
      {
        domain: definition.domain,
        authorityId: definition.authorityId,
        weight: Number(weight.toFixed(3)),
        matchedAliases: matches.map((match) => normalizeArabicQuery(match.phrase)),
      },
    ];
  });
};

export const expandRetrievalQuery = (
  baseQuery: string,
  hints: ResolvedAuthorityHint[],
): string => {
  const titles = [
    ...new Set(
      hints
        .map((hint) => hint.officialTitle?.trim())
        .filter((title): title is string => Boolean(title)),
    ),
  ];
  return titles.length === 0 ? baseQuery.trim() : `${baseQuery.trim()} ${titles.join(" ")}`;
};

export const applyAuthorityBoosts = (
  chunks: LegalChunks[],
  boosts: Array<{ authorityId: string; weight: number }>,
): LegalChunks[] => {
  const weights = new Map(
    boosts.map((boost) => [
      boost.authorityId,
      Math.min(MAX_AUTHORITY_BOOST, Math.max(0, boost.weight)),
    ]),
  );

  return chunks
    .map((chunk) => {
      const boost = chunk.authorityId ? weights.get(chunk.authorityId) ?? 0 : 0;
      if (boost === 0) return { ...chunk };
      return {
        ...chunk,
        rerank_score: Number(Math.min(1, (chunk.rerank_score ?? 0) + boost).toFixed(6)),
      };
    })
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0))
    .map((chunk, index) => ({ ...chunk, evidence_rank: index + 1 }));
};
