import type { LegalChunks } from "./chunk.schema";

type ScoredEntry = { chunk: LegalChunks; score: number };

export const reciprocalRankFusion = (resultLists: LegalChunks[][], k = 60): LegalChunks[] => {
  const entries = new Map<string, ScoredEntry>();

  for (const list of resultLists) {
    list.forEach((chunk, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = entries.get(chunk.chunk_id);

      if (existing) {
        existing.score += contribution;
      } else {
        entries.set(chunk.chunk_id, { chunk, score: contribution });
      }
    });
  }

  return Array.from(entries.values())
    .sort((a, b) => b.score - a.score)
    .map(({ chunk, score }) => ({
      ...chunk,
      rrf_score: Number(score.toFixed(6)),
    }));
};
