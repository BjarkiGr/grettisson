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
