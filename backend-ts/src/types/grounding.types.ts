// ── Grounding types ──────────────────────────────────────────────────────────
// Types for the evidence grounding policy.

export type GroundingDecision = {
  shouldGenerate: boolean;
  refusalAnswer?: string;
};
