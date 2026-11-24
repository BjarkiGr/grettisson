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
