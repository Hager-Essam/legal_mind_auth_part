const citationPattern = /\[((?:S\d+)(?:\s*,\s*S\d+)*)\]/g;

export const validateSourceCitations = (answer: string, evidenceCount: number): string => {
  const allowed = new Set(Array.from({ length: evidenceCount }, (_, index) => `S${index + 1}`));
  let validCitationCount = 0;
  const sanitized = answer.replace(citationPattern, (_fullCitation, sourceList: string) => {
    const ids = sourceList.split(",").map((value) => value.trim());

    if (ids.every((id) => allowed.has(id))) {
      validCitationCount += 1;

      return `[${ids.join(", ")}]`;
    }

    return "";
  });

  if (evidenceCount > 0 && validCitationCount === 0) {
    throw new Error("الجواب المولد لم يحتوي على إشارة توثيقية صالحة.");
  }

  return sanitized.trim();
};
