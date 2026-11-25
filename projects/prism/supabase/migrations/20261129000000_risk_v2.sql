-- ============================================================================
-- PRISM V2 — 0006 risk engine v2 (versioning + reproducibility)
-- Legacy rows keep scoring_version 1.0.0. New rows: 2.0.0 with full inputs
-- snapshot. Append-only preserved. Idempotent.
-- ============================================================================

alter table public.risk_scores
  add column if not exists scoring_version text not null default '1.0.0',
  add column if not exists analysis_id uuid references public.analyses(id) on delete set null,
  add column if not exists inputs jsonb,
  add column if not exists likelihood_level text,
  add column if not exists likelihood_horizon_days integer,
  add column if not exists confidence_level text,
  add column if not exists ongoing boolean not null default false;

comment on column public.risk_scores.scoring_version is '1.0.0 = legacy V1 derivation; 2.0.0 = V2 matrix methodology (docs/RISK-METHODOLOGY-V2.md).';
comment on column public.risk_scores.inputs is 'Full deterministic inputs snapshot; the score is reproducible from this alone.';

-- Change detection for quota-safe re-analysis (V2 section 10).
alter table public.analyses
  add column if not exists inputs_hash text;
create index if not exists analyses_event_hash_idx on public.analyses (event_id, inputs_hash);

-- V2 dimension columns (legacy columns become nullable history fields).
alter table public.risk_scores
  alter column severity_score drop not null,
  alter column probability_score drop not null,
  alter column geographic_score drop not null,
  alter column duration_score drop not null,
  alter column supply_chain_score drop not null,
  alter column economic_score drop not null,
  add column if not exists escalation_score smallint check (escalation_score between 0 and 5),
  add column if not exists economic_impact_score smallint check (economic_impact_score between 0 and 5),
  add column if not exists supply_chain_disruption_score smallint check (supply_chain_disruption_score between 0 and 5),
  add column if not exists geographic_reach_score smallint check (geographic_reach_score between 0 and 5),
  add column if not exists strategic_importance_score smallint check (strategic_importance_score between 0 and 5),
  add column if not exists persistence_score smallint check (persistence_score between 0 and 5),
  add column if not exists impact_index smallint check (impact_index between 0 and 100);
-- overall_score stores the V2 risk index; UNRATED rows store 0 and are
-- flagged by likelihood_level = 'insufficient_evidence' (rendered UNRATED).
