// PRISM — shared domain types (spec sections 8, 10, 11).
// These mirror the planned database schema; SQL migrations arrive in Phase 2.

export const EVENT_CATEGORIES = [
  "military_conflict",
  "political_instability",
  "trade_restrictions",
  "sanctions",
  "tariffs",
  "natural_disasters",
  "energy_disruptions",
  "shipping_disruptions",
  "economic_instability",
  "infrastructure_disruptions",
  "diplomatic_developments",
  "cybersecurity_incidents",
] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];

export const RISK_LEVELS = ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

export type ArticleProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "classified"
  | "analyzed"
  | "irrelevant"
  | "failed";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "paused";

export type JobType = "ingest" | "process_article" | "analyze_event" | "calculate_risk";

export interface Source {
  id: string;
  name: string;
  url: string;
  feed_url: string | null;
  source_type: string;
  country: string | null; // ISO 3166-1 alpha-2 where possible
  reliability_rating: number | null;
  active: boolean;
  last_checked_at: string | null;
  created_at: string;
}

export interface Article {
  id: string;
  source_id: string;
  title: string;
  url: string;
  author: string | null;
  published_at: string | null;
  collected_at: string;
  content: string | null; // RSS description is NOT assumed to be the full article
  content_hash: string;
  language: string | null;
  processing_status: ArticleProcessingStatus;
  created_at: string;
}

export interface PrismEvent {
  id: string;
  title: string;
  summary: string | null;
  category: EventCategory;
  primary_country: string | null;
  region: string | null;
  severity: number | null;
  status: string;
  first_detected_at: string;
  last_updated_at: string;
}

export interface Analysis {
  id: string;
  event_id: string | null;
  article_id: string | null;
  provider: string;
  model: string;
  prompt_version: string;
  analysis_json: AiAnalysisOutput;
  confidence: number | null;
  created_at: string;
}

export interface RiskScore {
  id: string;
  event_id: string;
  severity_score: number;
  probability_score: number;
  geographic_score: number;
  duration_score: number;
  supply_chain_score: number;
  economic_score: number;
  overall_score: number; // normalized 0-100
  explanation: string;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  job_type: JobType;
  entity_id: string | null;
  status: JobStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Structured AI output required by spec section 9 (validated in Phase 4). */
export interface AiAnalysisOutput {
  event_title: string;
  executive_summary: string;
  event_category: EventCategory;
  countries_involved: string[]; // ISO codes where possible
  geographic_region: string;
  organizations: string[];
  commodities_affected: string[];
  industries_affected: string[];
  supply_chain_implications: string;
  economic_consequences: string;
  escalation_scenarios: string[];
  severity_assessment: number; // scale documented in RISK-METHODOLOGY.md
  confidence_level: number; // 0-1, distinct from severity
  supporting_evidence: Array<{ claim: string; article_id: string; kind: "verified_fact" | "inference" | "speculation" }>;
  uncertainties: string[];
  source_references: string[]; // original article URLs only — never invented
}
