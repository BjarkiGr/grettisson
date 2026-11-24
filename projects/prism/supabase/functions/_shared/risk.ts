// PRISM — risk scoring (Phase 5). Pure functions, Node-testable.
// The AI NEVER produces the final score. Dimensions are derived from the
// validated AI analysis by the documented deterministic rules below, and
// the overall score is explicit weighted arithmetic (RISK-METHODOLOGY.md).
// Weights and bands MUST stay identical to frontend/js/utils.js.

import type { AiAnalysisOutput, EventCategory } from "./types.ts";

export const RISK_WEIGHTS: Record<string, number> = Object.freeze({
  severity: 1.2,
  probability: 1.0,
  geographic: 0.8,
  duration: 0.8,
  supply_chain: 1.2,
  economic: 1.0,
});

export interface RiskDimensions {
  severity: number;
  probability: number;
  geographic: number;
  duration: number;
  supply_chain: number;
  economic: number;
}

// Documented duration priors by category (typical expected persistence).
export const DURATION_PRIOR: Record<EventCategory, number> = {
  military_conflict: 4,
  political_instability: 3,
  trade_restrictions: 3,
  sanctions: 4,
  tariffs: 4,
  natural_disasters: 1,
  energy_disruptions: 3,
  shipping_disruptions: 3,
  economic_instability: 4,
  infrastructure_disruptions: 2,
  diplomatic_developments: 1,
  cybersecurity_incidents: 1,
};

const TRADE_CATEGORIES: EventCategory[] = [
  "shipping_disruptions", "energy_disruptions", "trade_restrictions", "sanctions", "tariffs",
];

function clampInt(v: unknown, lo: number, hi: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Derives the six 0-5 dimensions from a validated analysis:
 * - severity: the AI's anchored severity_assessment (0-5 scale in prompt).
 * - probability: 1 + round(4 * verified-fact evidence ratio). More verified
 *   reporting => consequences more likely already materializing. An
 *   analytical estimate, NOT an objective statistic.
 * - geographic: country count (0->1, 1->2, 2-3->3, 4-6->4, 7+->5); Global -> 5.
 * - duration: category prior (table above).
 * - supply_chain: commodity count (0->1 ... 4+->5), +1 for trade-related
 *   categories, capped at 5.
 * - economic: industry count (0->1, 1->2, 2->3, 3->4, 4+->5).
 */
export function deriveDimensions(a: AiAnalysisOutput): RiskDimensions {
  const evidence = Array.isArray(a.supporting_evidence) ? a.supporting_evidence : [];
  const verified = evidence.filter((e) => e.kind === "verified_fact").length;
  const ratio = evidence.length > 0 ? verified / evidence.length : 0;
  const countries = Array.isArray(a.countries_involved) ? a.countries_involved.length : 0;
  let geographic = countries === 0 ? 1 : countries === 1 ? 2 : countries <= 3 ? 3 : countries <= 6 ? 4 : 5;
  if (a.geographic_region === "Global") geographic = 5;
  const commodities = Array.isArray(a.commodities_affected) ? a.commodities_affected.length : 0;
  let supplyChain = commodities >= 4 ? 5 : commodities + 1;
  if (TRADE_CATEGORIES.includes(a.event_category)) supplyChain = Math.min(5, supplyChain + 1);
  const industries = Array.isArray(a.industries_affected) ? a.industries_affected.length : 0;
  const economic = industries >= 4 ? 5 : industries + 1;
  return {
    severity: clampInt(a.severity_assessment, 0, 5),
    probability: 1 + Math.round(4 * ratio),
    geographic,
    duration: DURATION_PRIOR[a.event_category] ?? 2,
    supply_chain: supplyChain,
    economic,
  };
}

/** Weighted mean of six 0-5 scores normalized to 0-100; null if invalid. */
export function computeOverallScore(d: RiskDimensions): number | null {
  if (!d || typeof d !== "object") return null;
  let weighted = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(RISK_WEIGHTS)) {
    const value = Number((d as Record<string, unknown>)[key]);
    if (!Number.isFinite(value) || value < 0 || value > 5) return null;
    weighted += weight * value;
    weightSum += weight;
  }
  return Math.round((weighted / (5 * weightSum)) * 100);
}

export function riskLevelFromScore(score: number): string | null {
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0 || s > 100) return null;
  if (s < 20) return "MINIMAL";
  if (s < 40) return "LOW";
  if (s < 60) return "MODERATE";
  if (s < 80) return "HIGH";
  return "CRITICAL";
}

/** Human-readable, reproducible explanation of the calculation. */
export function buildExplanation(d: RiskDimensions, overall: number, a: AiAnalysisOutput): string {
  const parts = Object.entries(RISK_WEIGHTS).map(([key, weight]) => {
    const value = (d as Record<string, number>)[key];
    return key + "=" + value + "/5 (weight " + weight + ")";
  });
  const evidence = Array.isArray(a.supporting_evidence) ? a.supporting_evidence : [];
  const verified = evidence.filter((e) => e.kind === "verified_fact").length;
  return [
    "Overall " + overall + "/100 (" + riskLevelFromScore(overall) + ").",
    "Dimensions: " + parts.join(", ") + ".",
    "Formula: round(sum(weight*score) / (5 * sum(weights)) * 100).",
    "Inputs: severity from anchored AI assessment; probability from verified-fact evidence ratio (" + verified + "/" + evidence.length + "); geographic from " + (a.countries_involved?.length ?? 0) + " countries; duration from category prior (" + a.event_category + "); supply-chain from " + (a.commodities_affected?.length ?? 0) + " commodities; economic from " + (a.industries_affected?.length ?? 0) + " industries.",
    "Probability is an analytical estimate, not an objective statistic. Confidence is reported separately from impact.",
  ].join(" ");
}
