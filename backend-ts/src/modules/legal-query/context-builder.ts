import type { LegalChunks } from "../../schemas";

const escapeXml = (value: string): string =>
  value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character]!,
  );

const element = (name: string, value: string | undefined): string =>
  value?.trim()
    ? `    <${name}>${escapeXml(value.trim())}</${name}>`
    : "";

export const buildArabicLegalContext = (chunks: LegalChunks[]): string => {
  const sources = chunks.map((chunk, index) => {
    const fields = [
      `  <source id="S${index + 1}">`,
      element("jurisdiction", chunk.jurisdiction),
      element("authority_type", chunk.authorityType),
      element("official_title", chunk.authorityTitleOfficial),
      element("article_number", chunk.article_number),
      element("status", chunk.authorityStatus),
      element("text", chunk.content),
      "  </source>",
    ].filter(Boolean);
    return fields.join("\n");
  });
  return `<legal_evidence>\n${sources.join("\n")}\n</legal_evidence>`;
};
