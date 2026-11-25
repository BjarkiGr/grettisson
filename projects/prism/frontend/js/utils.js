// PRISM — utils.js
// Small shared helpers. Articles and AI output are UNTRUSTED data: always
// render them with escapeHtml (or textContent), never as raw innerHTML.

/** Escapes untrusted text for safe interpolation into HTML. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(String.fromCharCode(34), "&quot;")
    .replaceAll("'", "&#39;");
}

/** Formats an ISO timestamp for display; returns an em dash when invalid. */
export function formatDateTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Formats an ISO timestamp as a date only; em dash when invalid. */
export function formatDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toISOString().slice(0, 10);
}

/**
 * Maps a normalized 0-100 score to the PRISM risk level bands (spec section 10).
 * The production scoring pipeline is implemented in Phase 5 (calculate-risk).
 */
export function riskLevelFromScore(score) {
  if (score === null || score === undefined || score === "") return null;
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0 || s > 100) return null;
  if (s < 20) return "MINIMAL";
  if (s < 40) return "LOW";
  if (s < 60) return "MODERATE";
  if (s < 80) return "HIGH";
  return "CRITICAL";
}

/** CSS class suffix for a risk level (minimal/low/moderate/high/critical). */
export function riskClass(level) {
  const valid = ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"];
  return valid.includes(level) ? level.toLowerCase() : "";
}

/** Hex colors per risk level — mirrors the CSS tokens in main.css. */
export const RISK_COLORS = Object.freeze({
  MINIMAL: "#3a8f5d",
  LOW: "#8aa84f",
  MODERATE: "#d9a441",
  HIGH: "#d97b29",
  CRITICAL: "#c94f4f",
});

/** Dimension weights (proposed methodology; finalized in Phase 5). */
export const RISK_WEIGHTS = Object.freeze({
  severity: 1.2,
  probability: 1.0,
  geographic: 0.8,
  duration: 0.8,
  supply_chain: 1.2,
  economic: 1.0,
});

/**
 * Transparent overall-score calculation (docs/RISK-METHODOLOGY.md):
 * weighted mean of six 0-5 dimension scores, normalized to 0-100.
 * Returns null when any dimension is missing or out of range.
 */
export function computeOverallScore(dimensions) {
  if (!dimensions || typeof dimensions !== "object") return null;
  let weighted = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(RISK_WEIGHTS)) {
    const value = Number(dimensions[key]);
    if (!Number.isFinite(value) || value < 0 || value > 5) return null;
    weighted += weight * value;
    weightSum += weight;
  }
  return Math.round((weighted / (5 * weightSum)) * 100);
}

/** Reads a query parameter; pass an explicit search string in tests. */
export function getQueryParam(name, search) {
  const s = search ?? (globalThis.location ? globalThis.location.search : "");
  return new URLSearchParams(s).get(name);
}

/** Trailing-edge debounce for search inputs. */
export function debounce(fn, ms = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ===== V2 risk methodology parity (must match backend _shared/risk-v2.ts) =====
export const V2_WEIGHTS = Object.freeze({
  escalation: 1.0, economic: 1.2, supply_chain: 1.3,
  geographic: 0.9, strategic: 0.8, persistence: 0.8,
});
export const V2_DIMENSIONS = ["escalation", "economic", "supply_chain", "geographic", "strategic", "persistence"];
export const RISK_MATRIX_V2 = Object.freeze({
  very_low: [5, 10, 15, 20, 25],
  low: [10, 20, 30, 40, 50],
  moderate: [15, 30, 45, 60, 70],
  high: [20, 40, 60, 75, 85],
  very_high: [25, 50, 70, 85, 95],
});
export function impactBandV2(i) {
  return i < 20 ? "NEGLIGIBLE" : i < 40 ? "LIMITED" : i < 60 ? "SIGNIFICANT" : i < 80 ? "SEVERE" : "EXTREME";
}
export function computeImpactIndexV2(gated) {
  const wsum = V2_DIMENSIONS.reduce((a, d) => a + V2_WEIGHTS[d], 0);
  return Math.round(V2_DIMENSIONS.reduce((a, d) => a + V2_WEIGHTS[d] * Number(gated[d]), 0) / (5 * wsum) * 100);
}
