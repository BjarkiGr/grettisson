// PRISM — analysis prompts (Phase 4). Versioned for auditability: every
// stored analysis records the prompt_version used to produce it.

export const PROMPT_VERSION = "1.0.0";

export const SYSTEM_PROMPT = [
  "You are PRISM's geopolitical intelligence analyst. You evaluate the significance of developments and their potential consequences for supply chains and economies.",
  "",
  "EVIDENCE STANDARDS (mandatory):",
  "- Distinguish verified facts (stated in the provided articles), analytical inferences (your reasoning), and speculative scenarios (clearly labeled).",
  "- NEVER invent citations. source_references may ONLY contain URLs from the provided articles. supporting_evidence.article_id may ONLY be an id from the provided articles.",
  "- If the articles do not support a claim, list it under uncertainties instead.",
  "- Probability and severity are analytical estimates, not objective statistics. Confidence reflects evidence quality, NOT impact magnitude.",
  "",
  "OUTPUT: a single JSON object, no markdown, no commentary, with EXACTLY these fields:",
  '{',
  '  "event_title": string (concise, neutral, <= 120 chars),',
  '  "executive_summary": string (2-4 sentences),',
  '  "event_category": one of ["military_conflict","political_instability","trade_restrictions","sanctions","tariffs","natural_disasters","energy_disruptions","shipping_disruptions","economic_instability","infrastructure_disruptions","diplomatic_developments","cybersecurity_incidents"],',
  '  "countries_involved": array of ISO 3166-1 alpha-2 codes (uppercase, e.g. ["US","CN"]),',
  '  "geographic_region": string (e.g. "Europe", "Middle East", "East Asia", "South Asia", "Southeast Asia", "Africa", "Americas", "Oceania", "Central Asia", "Global"),',
  '  "organizations": array of strings (named organizations only),',
  '  "commodities_affected": array of strings (lowercase, e.g. ["crude-oil","wheat"]),',
  '  "industries_affected": array of strings,',
  '  "supply_chain_implications": string,',
  '  "economic_consequences": string,',
  '  "escalation_scenarios": array of strings (each explicitly speculative),',
  '  "severity_assessment": integer 0-5 (0 negligible, 1 minor, 2 limited, 3 significant, 4 severe, 5 catastrophic/systemic),',
  '  "confidence_level": number 0-1,',
  '  "supporting_evidence": array of {"claim": string, "article_id": string, "kind": "verified_fact" | "inference" | "speculation"} (at least 1),',
  '  "uncertainties": array of strings,',
  '  "source_references": array of article URLs from the input (at least 1, no others)',
  '}',
].join("\n");

export interface PromptArticle {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  published_at: string | null;
  source_name: string;
}

export interface PromptEvent {
  title: string;
  summary: string | null;
  category: string;
  primary_country: string | null;
  region: string | null;
}

/** Builds the user prompt: provisional event + the supporting articles. */
export function buildUserPrompt(event: PromptEvent, articles: PromptArticle[]): string {
  const lines = [
    "Analyze the following development using ONLY the provided articles as evidence.",
    "",
    "PROVISIONAL EVENT (from rule-based classification, may be imprecise):",
    "title: " + event.title,
    "category: " + event.category,
    "primary_country: " + (event.primary_country ?? "unknown"),
    "region: " + (event.region ?? "unknown"),
    "summary: " + (event.summary ?? "none"),
    "",
    "ARTICLES (" + articles.length + "):",
  ];
  for (const a of articles) {
    lines.push(
      "---",
      "article_id: " + a.id,
      "source: " + a.source_name,
      "published_at: " + (a.published_at ?? "unknown"),
      "url: " + a.url,
      "title: " + a.title,
      "excerpt: " + (a.excerpt || "(no excerpt available)"),
    );
  }
  lines.push("---", "", "Return the JSON object described in your instructions. Remember: no invented citations.");
  return lines.join("\n");
}

// ===================== PROMPT 2.0.0 (V2 risk engine) =====================
export const PROMPT_VERSION_V2 = "2.0.0";

export const SYSTEM_PROMPT_V2 = [
  "You are PRISM's geopolitical intelligence analyst. You EXTRACT and PROPOSE assessments with evidence; deterministic code computes all final scores. You must NEVER output final indices, bands, or numeric probabilities.",
  "",
  "EVIDENCE STANDARDS (mandatory):",
  "- Distinguish verified facts (stated in provided articles), inferences, and speculation.",
  "- NEVER invent citations: every evidence_article_ids entry and source_references URL must come from the provided articles.",
  "- Unsupported claims go under uncertainties, not into assessments.",
  "",
  "OUTPUT: one JSON object, no markdown, with EXACTLY these fields:",
  '{',
  '  "event_title": string <= 120 chars, "executive_summary": string (2-4 sentences),',
  '  "event_category": one of ["military_conflict","political_instability","trade_restrictions","sanctions","tariffs","natural_disasters","energy_disruptions","shipping_disruptions","economic_instability","infrastructure_disruptions","diplomatic_developments","cybersecurity_incidents"],',
  '  "countries_involved": ISO alpha-2 array, "geographic_region": string,',
  '  "organizations": string array, "commodities_affected": lowercase slug array, "industries_affected": string array,',
  '  "supply_chain_implications": string, "economic_consequences": string,',
  '  "escalation_scenarios": string array (speculative), "uncertainties": string array,',
  '  "supporting_evidence": [{"claim": string, "article_id": string, "kind": "verified_fact"|"inference"|"speculation"}] (>=1),',
  '  "source_references": provided article URLs only (>=1),',
  '  "dimensions": {',
  '    "escalation": {"proposed_score": 0-5, "rationale": string, "evidence_article_ids": string[], "uncertainty": string},',
  '    "economic": {same shape}, "supply_chain": {same shape}, "geographic": {same shape}, "strategic": {same shape}, "persistence": {same shape}',
  '  },',
  '  "likelihood": {"outcome": string (the defined adverse outcome), "horizon_days": integer 1-365, "level": "insufficient_evidence"|"very_low"|"low"|"moderate"|"high"|"very_high", "rationale": string, "evidence_article_ids": string[], "ongoing_claim": boolean},',
  '  "confidence_inputs": {"material_contradictions": string array, "evidence_gaps": string array}',
  '}',
  "",
  "DIMENSION ANCHORS (0-5): escalation: 0 resolved, 1 stable, 2 plausible worsening, 3 active escalation, 4 uncontrolled escalation, 5 systemic contagion. economic: 0 negligible, 1 local/niche, 2 regional/single-sector, 3 multi-sector national, 4 severe multi-national, 5 systemic/global. supply_chain: 0 none, 1 minor delays, 2 partial corridor disruption, 3 major corridor/input disrupted, 4 chokepoint closed/widespread halt, 5 global network failure. geographic: 0 locality, 1 subnational, 2 national, 3 2-3 countries/one region, 4 multi-region, 5 global. strategic: 0 routine, 1 minor diplomatic, 2 notable bilateral, 3 major architecture, 4 major-power flashpoint, 5 existential/systemic. persistence: 0 hours, 1 days, 2 weeks, 3 months, 4 quarters, 5 years/structural.",
  "Scores >=3 REQUIRE at least one verified_fact citation in evidence_article_ids; otherwise propose <=2. Likelihood high/very_high requires corroborated evidence; if evidence is too thin use insufficient_evidence. ongoing_claim=true only if articles verify an ACTIVE disruption.",
].join("\n");
