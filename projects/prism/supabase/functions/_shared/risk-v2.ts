// PRISM — risk engine V2 (scoring_version 2.0.0). Pure, Node-testable.
// Implements docs/RISK-METHODOLOGY-V2.md exactly. The AI proposes; this
// code gates, validates, computes and explains. No numeric probabilities.

export const SCORING_VERSION = "2.0.0";

export const V2_WEIGHTS: Record<string, number> = Object.freeze({
  escalation: 1.0, economic: 1.2, supply_chain: 1.3,
  geographic: 0.9, strategic: 0.8, persistence: 0.8,
});

export const V2_DIMENSIONS = ["escalation", "economic", "supply_chain", "geographic", "strategic", "persistence"] as const;
export type V2Dimension = typeof V2_DIMENSIONS[number];

export const MAJOR_ECONOMIES = ["US", "CN", "JP", "DE", "GB", "FR", "IT", "CA", "IN", "BR", "KR", "AU"];
export const CHOKEPOINT_STATES = ["EG", "PA", "SG", "MY", "IR", "OM", "YE", "DJ", "TR"];

export type LikelihoodLevel = "insufficient_evidence" | "very_low" | "low" | "moderate" | "high" | "very_high";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface RiskV2Inputs {
  dimensions: Record<V2Dimension, { proposed: number; verified_evidence: boolean }>;
  major_economy_affected: boolean;
  independent_sources: number;
  material_contradictions: boolean;
  verified_fact_count: number;
  ai_likelihood: { level: string; horizon_days: number; outcome: string };
  ongoing_confirmed: boolean;
}

export interface RiskV2Result {
  gated: Record<V2Dimension, number>;
  gate_notes: string[];
  impact_index: number;
  impact_band: string;
  likelihood: LikelihoodLevel;
  likelihood_notes: string[];
  horizon_days: number;
  ongoing: boolean;
  confidence: ConfidenceLevel;
  risk_index: number | null;
  risk_band: string; // "UNRATED" when likelihood is insufficient_evidence
}

export function impactBand(i: number): string {
  return i < 20 ? "NEGLIGIBLE" : i < 40 ? "LIMITED" : i < 60 ? "SIGNIFICANT" : i < 80 ? "SEVERE" : "EXTREME";
}
export function riskBand(i: number): string {
  return i < 20 ? "MINIMAL" : i < 40 ? "LOW" : i < 60 ? "MODERATE" : i < 80 ? "HIGH" : "CRITICAL";
}

const BAND_INDEX: Record<string, number> = { NEGLIGIBLE: 0, LIMITED: 1, SIGNIFICANT: 2, SEVERE: 3, EXTREME: 4 };

// Documented matrix (methodology section 7). Rows: likelihood, cols: impact.
export const RISK_MATRIX: Record<string, number[]> = Object.freeze({
  very_low: [5, 10, 15, 20, 25],
  low: [10, 20, 30, 40, 50],
  moderate: [15, 30, 45, 60, 70],
  high: [20, 40, 60, 75, 85],
  very_high: [25, 50, 70, 85, 95],
});

export function computeConfidence(sources: number, materialContradictions: boolean): ConfidenceLevel {
  if (materialContradictions || sources <= 1) return "low";
  if (sources >= 3) return "high";
  return "medium";
}

export function assessRiskV2(inp: RiskV2Inputs): RiskV2Result {
  const gate_notes: string[] = [];
  const gated = {} as Record<V2Dimension, number>;
  for (const d of V2_DIMENSIONS) {
    const raw = inp.dimensions[d];
    let v = Math.max(0, Math.min(5, Math.round(Number(raw?.proposed ?? 0))));
    if (v >= 3 && !raw?.verified_evidence) {
      gate_notes.push(d + ": proposed " + v + " capped to 2 (no verified_fact evidence, gate G1)");
      v = 2;
    }
    gated[d] = v;
  }
  if (inp.major_economy_affected && gated.geographic < 5) {
    gated.geographic += 1;
    gate_notes.push("geographic: +1 importance modifier (major economy / chokepoint state affected)");
  }
  const wsum = V2_DIMENSIONS.reduce((a, d) => a + V2_WEIGHTS[d], 0);
  const impact_index = Math.round(V2_DIMENSIONS.reduce((a, d) => a + V2_WEIGHTS[d] * gated[d], 0) / (5 * wsum) * 100);
  const impact_band = impactBand(impact_index);

  const confidence = computeConfidence(inp.independent_sources, inp.material_contradictions);

  const likelihood_notes: string[] = [];
  let likelihood: LikelihoodLevel;
  const ongoing = Boolean(inp.ongoing_confirmed) && inp.verified_fact_count > 0;
  if (inp.verified_fact_count === 0) {
    likelihood = "insufficient_evidence";
    likelihood_notes.push("L1: zero verified facts -> insufficient evidence (unrated)");
  } else if (ongoing) {
    likelihood = "very_high";
    likelihood_notes.push("L2: confirmed ongoing disruption -> very_high (ongoing)");
  } else {
    const ai = inp.ai_likelihood?.level;
    likelihood = (["very_low", "low", "moderate", "high", "very_high"].includes(ai) ? ai : "moderate") as LikelihoodLevel;
    if ((likelihood === "high" || likelihood === "very_high") && inp.independent_sources < 2) {
      likelihood = "moderate";
      likelihood_notes.push("L3: fewer than 2 independent sources -> downgraded to moderate");
    }
    if (confidence === "low" && (likelihood === "high" || likelihood === "very_high")) {
      likelihood = "moderate";
      likelihood_notes.push("L4: low confidence -> capped at moderate");
    }
  }

  const horizon_days = Number(inp.ai_likelihood?.horizon_days) > 0 ? Number(inp.ai_likelihood.horizon_days) : 30;
  const risk_index = likelihood === "insufficient_evidence" ? null : RISK_MATRIX[likelihood][BAND_INDEX[impact_band]];
  return {
    gated, gate_notes, impact_index, impact_band,
    likelihood, likelihood_notes, horizon_days, ongoing,
    confidence,
    risk_index,
    risk_band: risk_index === null ? "UNRATED" : riskBand(risk_index),
  };
}
