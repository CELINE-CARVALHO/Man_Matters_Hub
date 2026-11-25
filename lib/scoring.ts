export const WEIGHTS = { frequency: 0.3, severity: 0.25, impact: 0.25, feasibility: 0.2 };

/** All inputs on a 1–5 scale; frequency is scaled from "interviews mentioning it / eligible interviews". */
export function priorityScore(
  p: { frequency_count: number; severity: number; customer_impact: number; tech_feasibility: number },
  eligibleTotal: number,
): number {
  const freq = eligibleTotal > 0 ? (Math.min(p.frequency_count, eligibleTotal) / eligibleTotal) * 5 : 0;
  const s = freq * WEIGHTS.frequency + p.severity * WEIGHTS.severity + p.customer_impact * WEIGHTS.impact + p.tech_feasibility * WEIGHTS.feasibility;
  return Math.round(s * 100) / 100;
}
