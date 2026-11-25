// PRISM — strict AI output validation (Phase 4).
// Rejects malformed/incomplete responses and FABRICATED CITATIONS:
// source_references must be a subset of the provided article URLs, and
// supporting_evidence.article_id must be one of the provided article ids.
// Nothing is stored unless validation passes.

import { EVENT_CATEGORIES } from "./types.ts";
import type { AiAnalysisOutput } from "./types.ts";
import { isRecord, isNonEmptyString } from "./validation.ts";

export type ValidationResult =
  | { ok: true; value: AiAnalysisOutput }
  | { ok: false; errors: string[] };

const EVIDENCE_KINDS = ["verified_fact", "inference", "speculation"];

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function validateAnalysisOutput(
  input: unknown,
  allowedArticleIds: string[],
  allowedUrls: string[],
): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["output is not an object"] };
  const o = input as Record<string, unknown>;

  if (!isNonEmptyString(o.event_title) || (o.event_title as string).length > 300) errors.push("event_title missing/invalid");
  if (!isNonEmptyString(o.executive_summary) || (o.executive_summary as string).length > 4000) errors.push("executive_summary missing/invalid");
  if (!EVENT_CATEGORIES.includes(o.event_category as never)) errors.push("event_category not in enum");
  if (!isStringArray(o.countries_involved) || !(o.countries_involved as string[]).every((c) => /^[A-Z]{2}$/.test(c))) errors.push("countries_involved must be ISO alpha-2 codes");
  if (!isNonEmptyString(o.geographic_region)) errors.push("geographic_region missing");
  if (!isStringArray(o.organizations)) errors.push("organizations must be string array");
  if (!isStringArray(o.commodities_affected)) errors.push("commodities_affected must be string array");
  if (!isStringArray(o.industries_affected)) errors.push("industries_affected must be string array");
  if (!isNonEmptyString(o.supply_chain_implications)) errors.push("supply_chain_implications missing");
  if (!isNonEmptyString(o.economic_consequences)) errors.push("economic_consequences missing");
  if (!isStringArray(o.escalation_scenarios)) errors.push("escalation_scenarios must be string array");
  const sev = o.severity_assessment;
  if (typeof sev !== "number" || !Number.isInteger(sev) || sev < 0 || sev > 5) errors.push("severity_assessment must be integer 0-5");
  const conf = o.confidence_level;
  if (typeof conf !== "number" || !Number.isFinite(conf) || conf < 0 || conf > 1) errors.push("confidence_level must be 0-1");
  if (!isStringArray(o.uncertainties)) errors.push("uncertainties must be string array");

  const idSet = new Set(allowedArticleIds);
  if (!Array.isArray(o.supporting_evidence) || o.supporting_evidence.length === 0) {
    errors.push("supporting_evidence must be a non-empty array");
  } else {
    for (const [i, e] of (o.supporting_evidence as unknown[]).entries()) {
      if (!isRecord(e) || !isNonEmptyString(e.claim) || !isNonEmptyString(e.article_id) || !EVIDENCE_KINDS.includes(e.kind as string)) {
        errors.push("supporting_evidence[" + i + "] malformed");
        continue;
      }
      if (!idSet.has(e.article_id as string)) errors.push("supporting_evidence[" + i + "] cites unknown article_id (fabricated citation)");
    }
  }

  const urlSet = new Set(allowedUrls);
  if (!isStringArray(o.source_references) || (o.source_references as string[]).length === 0) {
    errors.push("source_references must be a non-empty string array");
  } else {
    for (const u of o.source_references as string[]) {
      if (!urlSet.has(u)) errors.push("source_references contains a URL not provided in input (fabricated citation): " + u.slice(0, 100));
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: o as unknown as AiAnalysisOutput };
}

// ===================== V2 output validation =====================
const V2_DIMS = ["escalation", "economic", "supply_chain", "geographic", "strategic", "persistence"];
const LIKELIHOOD_LEVELS = ["insufficient_evidence", "very_low", "low", "moderate", "high", "very_high"];

export function validateAnalysisOutputV2(input: unknown, allowedArticleIds: string[], allowedUrls: string[]): ValidationResult {
  const base = validateAnalysisOutput(input, allowedArticleIds, allowedUrls);
  if (!base.ok) return base;
  const errors: string[] = [];
  const o = input as Record<string, unknown>;
  const idSet = new Set(allowedArticleIds);
  const dims = o.dimensions;
  if (!isRecord(dims)) {
    errors.push("dimensions missing");
  } else {
    for (const d of V2_DIMS) {
      const p = (dims as Record<string, unknown>)[d];
      if (!isRecord(p) || typeof p.proposed_score !== "number" || !Number.isInteger(p.proposed_score) || p.proposed_score < 0 || p.proposed_score > 5 || !isNonEmptyString(p.rationale) || !Array.isArray(p.evidence_article_ids)) {
        errors.push("dimensions." + d + " malformed");
        continue;
      }
      for (const id of p.evidence_article_ids as unknown[]) {
        if (!idSet.has(id as string)) errors.push("dimensions." + d + " cites unknown article (fabricated)");
      }
    }
  }
  const lik = o.likelihood;
  if (!isRecord(lik) || !isNonEmptyString(lik.outcome) || typeof lik.horizon_days !== "number" || !Number.isInteger(lik.horizon_days) || lik.horizon_days < 1 || lik.horizon_days > 365 || !LIKELIHOOD_LEVELS.includes(lik.level as string) || !isNonEmptyString(lik.rationale) || typeof lik.ongoing_claim !== "boolean" || !Array.isArray(lik.evidence_article_ids)) {
    errors.push("likelihood malformed");
  } else {
    for (const id of lik.evidence_article_ids as unknown[]) {
      if (!idSet.has(id as string)) errors.push("likelihood cites unknown article (fabricated)");
    }
  }
  const ci = o.confidence_inputs;
  if (!isRecord(ci) || !Array.isArray(ci.material_contradictions) || !Array.isArray(ci.evidence_gaps)) {
    errors.push("confidence_inputs malformed");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: o as unknown as AiAnalysisOutput };
}

// ===================== V2.1 output validation =====================
// Wraps V2 (all prior guarantees) + assessment_limitations + size caps.
export function validateAnalysisOutputV21(input: unknown, allowedArticleIds: string[], allowedUrls: string[]): ValidationResult {
  const base = validateAnalysisOutputV2(input, allowedArticleIds, allowedUrls);
  if (!base.ok) return base;
  const o = input as Record<string, unknown>;
  const errors: string[] = [];
  const lim = o.assessment_limitations;
  if (!Array.isArray(lim) || lim.length < 1 || lim.length > 6 || !lim.every((x) => typeof x === "string" && x.trim().length > 0 && x.length <= 300)) {
    errors.push("assessment_limitations must be 1-6 non-empty strings <=300 chars");
  }
  for (const f of ["supply_chain_implications", "economic_consequences"]) {
    if (typeof o[f] !== "string" || (o[f] as string).length > 4000) errors.push(f + " exceeds 4000 chars");
  }
  const bounded = (v: unknown, maxItems: number, maxLen: number) => Array.isArray(v) && v.length <= maxItems && v.every((x) => typeof x === "string" && x.length <= maxLen);
  if (!bounded(o.escalation_scenarios, 10, 500)) errors.push("escalation_scenarios exceeds bounds (10 x 500)");
  if (!bounded(o.uncertainties, 20, 500)) errors.push("uncertainties exceeds bounds (20 x 500)");
  if (!bounded(o.organizations, 50, 200) || !bounded(o.commodities_affected, 50, 100) || !bounded(o.industries_affected, 50, 100)) errors.push("entity arrays exceed bounds");
  if (errors.length > 0) return { ok: false, errors };
  return base;
}
