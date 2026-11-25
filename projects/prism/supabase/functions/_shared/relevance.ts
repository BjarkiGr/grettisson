// PRISM V2 Phase 3 — deterministic company relevance engine.
// Pure functions only. Relevance is SEPARATE from global risk: it measures
// how related an event is to this company, not how dangerous it is.
// Every match carries evidence + the profile entry origin; explanations
// are deterministic templates (no AI, no profile egress).

export type Exposure = "direct" | "inferred" | "indirect" | "none";

export interface ProfileFacts {
  industries: { industry: string; origin: string }[];
  commodities: { commodity_slug: string; origin: string }[];
  countries: { country_code: string; role: string; origin: string }[];
  dependencies: { kind: string; ref: string; confirmed: boolean; origin: string }[];
}

export interface EventFacts {
  commodity_slugs: string[];
  country_codes: string[];
  industries: string[];
  chokepoints: string[]; // chokepoint names + route names from impacts
}

export interface Match {
  kind: "commodity" | "country" | "industry" | "dependency";
  value: string;
  role?: string;
  origin: string;
  reason: string;
}

const ORIGIN_PHRASE: Record<string, string> = {
  user_supplied: "you listed",
  ai_confirmed: "you confirmed (AI-suggested)",
  imported_verified: "verified import of",
};
const phrase = (o: string) => ORIGIN_PHRASE[o] ?? "your profile lists";
const norm = (s: string) => String(s ?? "").trim().toLowerCase();

/** Pure: all transparent matches between profile facts and event facts. */
export function findMatches(p: ProfileFacts, e: EventFacts): Match[] {
  const matches: Match[] = [];
  const eCom = new Set(e.commodity_slugs.map(norm));
  const eCty = new Set(e.country_codes.map((c) => c.toUpperCase()));
  const eInd = new Set(e.industries.map(norm));
  const eChk = e.chokepoints.map(norm).filter(Boolean);

  for (const c of p.commodities) {
    if (eCom.has(norm(c.commodity_slug))) {
      matches.push({ kind: "commodity", value: c.commodity_slug, origin: c.origin,
        reason: "This event affects " + c.commodity_slug + ", which " + phrase(c.origin) + " as a company commodity." });
    }
  }
  for (const c of p.countries) {
    if (eCty.has(c.country_code.toUpperCase())) {
      matches.push({ kind: "country", value: c.country_code, role: c.role, origin: c.origin,
        reason: "The event involves " + c.country_code + ", one of your " + c.role + " countries (" + phrase(c.origin) + ")." });
    }
  }
  for (const i of p.industries) {
    if (eInd.has(norm(i.industry))) {
      matches.push({ kind: "industry", value: i.industry, origin: i.origin,
        reason: "The event affects the " + i.industry + " industry (" + phrase(i.origin) + ")." });
    }
  }
  for (const d of p.dependencies) {
    if (!d.confirmed) continue; // unconfirmed AI guesses never drive relevance
    const ref = norm(d.ref);
    if (ref && eChk.some((c) => c.includes(ref) || ref.includes(c))) {
      matches.push({ kind: "dependency", value: d.ref, origin: d.origin,
        reason: "The event touches " + d.ref + ", a dependency " + phrase(d.origin) + "." });
    }
  }
  return matches;
}

/** Pure: exposure class from match structure (documented rules). */
export function classifyExposure(matches: Match[]): Exposure {
  const has = (k: string, role?: string) => matches.some((m) => m.kind === k && (!role || m.role === role));
  const commodity = has("commodity");
  const supplierOrOperating = has("country", "supplier") || has("country", "operating");
  const operating = has("country", "operating");
  const industry = has("industry");
  if ((commodity && supplierOrOperating) || (operating && industry)) return "direct";
  if (commodity || has("country", "supplier")) return "inferred";
  if (industry || has("country", "customer") || has("country", "transport") || has("dependency")) return "indirect";
  return "none";
}

/** Pure: relevance 0-100, separate from global risk. */
export function relevanceScore(matches: Match[], exposure: Exposure): number {
  if (exposure === "none") return 0;
  const base = exposure === "direct" ? 70 : exposure === "inferred" ? 45 : 25;
  const extra = Math.min(20, Math.max(0, matches.length - 1) * 5);
  const trusted = matches.some((m) => m.origin === "user_supplied" || m.origin === "imported_verified") ? 5 : 0;
  return Math.min(100, base + extra + trusted);
}

export interface RelevanceResult {
  exposure: Exposure;
  relevance_score: number;
  matches: Match[];
  explanation: string;
}

/** Pure: full result with a deterministic plain-language explanation. */
export function matchProfileToEvent(p: ProfileFacts, e: EventFacts): RelevanceResult {
  const matches = findMatches(p, e);
  const exposure = classifyExposure(matches);
  const score = relevanceScore(matches, exposure);
  if (exposure === "none") {
    return { exposure, relevance_score: 0, matches: [], explanation: "No connection found between this event and your company profile.", assumptions: [], missing_information: ["No matching profile attributes found."], purchasing: { dimensions: [], disruption_type: disruptionType(e.event_type), potential_business_implications: [] } };
  }
  const lead = exposure === "direct"
    ? "Direct exposure: this event touches both what you trade and where you trade."
    : exposure === "inferred"
    ? "Possible exposure: one strong link connects this event to your company."
    : "Indirect exposure: a secondary link connects this event to your company.";
  const am = exposureAssumptions(exposure, matches);
  const dtype = disruptionType(e.event_type);
  return { exposure, relevance_score: score, matches, explanation: lead + " " + matches.map((m) => m.reason).join(" "),
    assumptions: am.assumptions, missing_information: am.missing,
    purchasing: { dimensions: purchasingDimensions(matches), disruption_type: dtype, potential_business_implications: potentialImplications(exposure, dtype) } };
}

// ===================== V2.1 Phase 5: purchasing framework =====================
// Deterministic templates only. "Potential" implications, never confirmed
// financial impacts. AI never influences these values.

const DISRUPTION_TYPE: Record<string, string> = {
  sanctions: "trade_restriction", tariffs: "trade_restriction", trade_restrictions: "trade_restriction",
  shipping_disruptions: "logistics", energy_disruptions: "energy",
  natural_disasters: "physical_disruption", infrastructure_disruptions: "physical_disruption",
  military_conflict: "conflict", political_instability: "political", cybersecurity_incidents: "cyber",
};

export function disruptionType(eventType?: string): string | null {
  return eventType ? DISRUPTION_TYPE[eventType] ?? "other" : null;
}

export function purchasingDimensions(matches: Match[]): string[] {
  const dims = new Set<string>();
  for (const m of matches) {
    if (m.kind === "commodity") dims.add("commodity_exposure");
    if (m.kind === "country") dims.add("geographic_exposure");
    if (m.kind === "industry") dims.add("industry_exposure");
    if (m.kind === "dependency") dims.add("logistics_exposure");
  }
  return [...dims];
}

export function potentialImplications(exposure: Exposure, dtype: string | null): string[] {
  if (exposure === "none") return [];
  const out = new Set<string>();
  if (exposure === "direct" || exposure === "inferred") {
    if (dtype === "trade_restriction") { out.add("Possible commodity price pressure"); out.add("Regulatory uncertainty for procurement"); out.add("Supplier availability concerns"); }
    if (dtype === "logistics" || dtype === "physical_disruption" || dtype === "conflict") { out.add("Potential procurement delays"); out.add("Increased transportation costs"); out.add("Supplier availability concerns"); }
    if (dtype === "energy") { out.add("Possible input-cost pressure"); out.add("Potential production delays"); }
    if (!dtype || dtype === "other" || dtype === "political" || dtype === "cyber") { out.add("Possible cost or availability effects worth investigating"); }
  } else {
    out.add("Monitor for knock-on cost or availability effects");
  }
  return [...out];
}

export function exposureAssumptions(exposure: Exposure, matches: Match[]): { assumptions: string[]; missing: string[] } {
  const assumptions: string[] = [];
  const missing: string[] = [];
  const has = (k: string) => matches.some((m) => m.kind === k);
  if (exposure === "inferred") assumptions.push("Assumes the single matched link (commodity or supplier country) affects your supply; the other link is unconfirmed.");
  if (exposure === "indirect") assumptions.push("Assumes secondary links (industry, customer/transport country or route dependency) can transmit impact to your business.");
  if (!has("commodity")) missing.push("No direct commodity overlap between this event and your profile.");
  if (!has("country")) missing.push("No country overlap between this event and your profile.");
  if (!matches.some((m) => m.kind === "country" && (m.role === "supplier" || m.role === "operating"))) missing.push("No supplier/operating-country confirmation for this event.");
  return { assumptions, missing };
}
