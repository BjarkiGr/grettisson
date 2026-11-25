# PRISM — Risk Methodology V2 (PROPOSAL — awaiting approval)

Status: Phase 1 deliverable. NOT implemented. Supersedes V1 derivation
(scoring_version 1.0.0) upon approval. V1 assessments remain readable.

## 0. Why V1 is replaced

V1 conflated concepts and used count-based heuristics: probability from a
verified-fact ratio, geographic/economic/supply-chain scores from item
counts, static duration priors, likelihood folded into a weighted average,
no evidence gates, no reproducibility chain. See V2 Phase 0 audit.

## 1. Four separate concepts (never conflated)

- LIKELIHOOD: ordinal assessment of a DEFINED outcome within a DEFINED
  horizon (default 30 days). May be "insufficient_evidence".
- SEVERITY/IMPACT: magnitude of consequences if the outcome occurs
  (six dimensions below -> Impact Index).
- EXPOSURE: per-company relevance (Feature C, separate engine, not here).
- CONFIDENCE: strength/completeness of evidence. Never folded into the
  risk number; displayed alongside it.

## 2. Dimensions (0-5, fully anchored)

Each dimension is PROPOSED by the AI with rationale + evidence article ids;
deterministic code validates and gates it (section 5).

### 2.1 Escalation potential (weight 1.0)
0 resolved/de-escalating; 1 stable, low tension; 2 plausible worsening under
specific triggers; 3 active escalation dynamics; 4 rapid uncontrolled
escalation underway; 5 systemic contagion (cross-border spread, market panic).

### 2.2 Economic impact (weight 1.2)
0 negligible; 1 local/niche sector; 2 measurable regional or single-sector;
3 significant multi-sector national; 4 severe multi-national; 5 systemic/global.

### 2.3 Supply-chain disruption (weight 1.3)
0 none; 1 minor delays single lane; 2 partial disruption of one corridor/mode;
3 major corridor or critical input disrupted; 4 critical chokepoint closed or
widespread production halt; 5 global network failure.

### 2.4 Geographic reach (weight 0.9)
0 single locality; 1 subnational; 2 one country nationally; 3 two-three
countries or one region; 4 multiple regions; 5 global.
Importance modifier (deterministic): +1 (cap 5) if a major economy (G7, CN,
IN, BR, KR, AU) or a global chokepoint state is affected. Documented list in
code; replaces V1 country-count heuristic.

### 2.5 Strategic importance (weight 0.8)
0 routine; 1 minor diplomatic; 2 notable bilateral; 3 major trade/security
architecture affected; 4 major-power or security flashpoint; 5 existential/
systemic (nuclear, reserve-currency, critical alliances).

### 2.6 Persistence (weight 0.8)
0 hours; 1 days; 2 weeks; 3 months; 4 quarters; 5 years/structural.
Event-specific from evidence — NOT a category prior (V1 defect removed).

Weights sum to 6.0. Justification: PRISM's mission weights supply-chain and
economic consequences highest; escalation drives future impact; reach,
strategic importance and persistence contextualize. Weights are versioned
constants, identical in backend and frontend (parity-tested).

## 3. Impact Index (heuristic, 0-100)

    impact = round( sum(w_i * d_i) / (5 * sum(w_i)) * 100 )

Impact bands: 0-19 NEGLIGIBLE, 20-39 LIMITED, 40-59 SIGNIFICANT,
60-79 SEVERE, 80-100 EXTREME. Always labeled "heuristic impact index".

## 4. Likelihood (ordinal, never a fabricated probability)

Levels: insufficient_evidence | very_low | low | moderate | high | very_high.
The AI must state: the defined outcome, horizon_days (default 30), rationale,
and supporting evidence ids. "Ongoing" confirmed disruption is represented
as very_high with an ongoing=true flag.

Deterministic validation rules (applied in order, each recorded):
L1. Zero verified_fact evidence anywhere -> insufficient_evidence (unrated).
L2. Confirmed ongoing disruption (verified evidence of active interruption)
    -> very_high, ongoing=true.
L3. AI level high/very_high but <2 independent sources -> downgrade to
    moderate (reason recorded).
L4. Confidence LOW (section 5) -> cap at moderate unless L2 applied.
No numeric probabilities are ever produced or displayed.

## 5. Confidence (computed by code, not AI)

Inputs: independent_source_count (distinct source_id of linked articles),
material_contradictions (AI-flagged, validated), evidence_gaps.
Table:
- HIGH: >=3 independent sources AND no material contradictions.
- MEDIUM: 2 independent sources, OR >=3 with minor contradictions.
- LOW: 1 source, OR material contradictions, OR major gaps.
Confidence is displayed with every assessment and gates likelihood (L4).
It NEVER changes the risk index arithmetic.

## 6. Evidence gates on dimensions

G1. A dimension proposed >=3 requires >=1 verified_fact citation attached
    to that dimension; otherwise capped at 2, flag evidence_gate_capped.
G2. All citations must reference provided articles (V1 whitelist retained).
G3. Gates and caps are stored in the inputs snapshot and shown in the
    explanation. This defeats verbose-output gaming and prompt injection
    attempts to inflate scores.

## 7. Risk Index = documented matrix (NOT multiplication)

Likelihood band x Impact band -> heuristic risk index:

| likelihood \ impact | NEGLIGIBLE | LIMITED | SIGNIFICANT | SEVERE | EXTREME |
|---|---|---|---|---|---|
| very_low  | 5  | 10 | 15 | 20 | 25 |
| low       | 10 | 20 | 30 | 40 | 50 |
| moderate  | 15 | 30 | 45 | 60 | 70 |
| high      | 20 | 40 | 60 | 75 | 85 |
| very_high | 25 | 50 | 70 | 85 | 95 |

Properties: monotonic in both axes; an unlikely catastrophe never equals a
certain moderate event; ceiling 95 (heuristic humility); insufficient
_evidence -> UNRATED (impact index still shown, clearly labeled).
Risk bands (unchanged from V1): 0-19 MINIMAL, 20-39 LOW, 40-59 MODERATE,
60-79 HIGH, 80-100 CRITICAL. Always labeled "heuristic risk index".

## 8. Reproducibility and versioning

risk_scores gains: scoring_version ('2.0.0'), analysis_id FK, inputs jsonb
{ai_dimension_proposals, gate_outcomes, likelihood_inputs, confidence_inputs,
weights_version, matrix_cell}, likelihood_level, likelihood_horizon_days,
confidence_level, ongoing flag. Append-only preserved. The score is a pure
function of the snapshot; a replay test recomputes every stored row.
scoring_version 1.0.0 rows remain valid history, labeled as legacy.

## 9. Explanations (deterministic composition)

Every assessment stores: per-dimension rationale + evidence links + gate
notes; computed DELTA vs the previous assessment (which dimensions moved and
why, citing new evidence); uncertainties (AI + gates); explicit change
triggers ("would rise if a verified closure is reported"; "would fall if
resolution is confirmed"). No generic AI prose as the explanation.

## 10. Re-scoring policy (quota-safe)

Re-analyze only when the linked-article set changes (input hash) or the
assessment is older than 7 days (staleness cap, configurable). Identical
inputs never re-consume AI quota. Each new analysis queues one risk job.

## 11. AI schema v2 outline (prompt_version 2.0.0)

Keeps V1 fields (title, summary, category, countries, commodities normalized
to taxonomy slugs, industries, evidence with kinds, uncertainties, citation
whitelist) and ADDS: dimensions{six x {proposed_score, rationale,
evidence_article_ids, uncertainty}}, likelihood{outcome, horizon_days, level,
rationale, evidence_article_ids, ongoing_claim}, confidence_inputs{
independent_source_count_claim, material_contradictions[], evidence_gaps[]}.
The AI never outputs final indices, bands, or numeric probabilities.
Validation rejects malformed output exactly as V1 (fail-closed).

## 12. Test dataset

test/risk-v2-cases.json: 12 fictional, clearly-labeled design fixtures with
inputs and expected outcomes (bands, gates, unrated paths, anti-gaming).
Used to validate the methodology NOW (arithmetic checked) and as acceptance
tests for the engine implementation AFTER approval.

## 13. Design validation (performed at Phase 1)

The proposed rules were applied arithmetically to all 12 fixtures in
test/risk-v2-cases.json: 12/12 expected outcomes matched. Highlights:
- v2-01 canal blockage: impact 76 SEVERE, very_high/high -> 85 CRITICAL.
- v2-02 thin rumor: all dimensions gated, zero verified facts -> UNRATED
  (impact 40 still shown, labeled).
- v2-10 contradictory panic reports: impact 80 EXTREME but confidence LOW
  caps likelihood -> 70 HIGH, not CRITICAL.
- v2-12 inflated verbose output: gates + likelihood rules reduce a would-be
  95 CRITICAL to 45 MODERATE (anti-gaming verified).
- v2-03 certain-but-minor tariff: 40 MODERATE (not high) — likelihood and
  impact stay separate.
This validation used a throwaway script (not committed); no engine code was
implemented. The fixtures become acceptance tests upon approval.

## Errata (V2.1 Phase 3, 2026-12-01)

L1b: when the AI reports insufficient_evidence and no ongoing disruption
is confirmed, the result is UNRATED regardless of verified-fact count.
An implementation fallback previously defaulted such cases to moderate;
fixed in risk-v2.ts. Methodology intent unchanged. See
docs/RISK-VALIDATION-REPORT.md.
