import type { LegalChunks } from "../../schemas";

export type GroundingDecision = {
  shouldGenerate: boolean;
  refusalAnswer?: string;
  qualifiedChunks: LegalChunks[];
};
