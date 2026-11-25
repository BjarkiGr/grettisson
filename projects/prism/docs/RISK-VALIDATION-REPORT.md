# PRISM — Risk Validation Report (V2.1 Phase 3)

Date: 2026-12-01. Engine: scoring_version 2.0.0 (with L1b errata, below).

## Reproducibility
All 12 design fixtures reproduce EXACTLY from stored-shape inputs,
including JSON round-trip (storage-safe). calculate-risk stores the full
inputs snapshot + scoring_version; risk_scores is append-only. Any stored
score can be recomputed with assessRiskV2(inputs).

## Bug found and fixed (L1b errata)
When the AI reported insufficient_evidence but >=1 verified fact existed
and no ongoing disruption was confirmed, the engine fell through to a
"moderate" default instead of staying UNRATED. This contradicted the
documented methodology. Fixed in risk-v2.ts (L1b branch); all 12 design
fixtures still pass; the historical thin-evidence case now correctly
returns UNRATED. Scores produced before the fix remain in history
(append-only); new scores use the corrected rule under the same
methodology version (implementation bug, not a methodology change).

## Retrospective historical evaluation (n=6, NOT calibration)
Cases are reconstructed approximations, clearly labeled retrospective in
test/historical-cases.json. They are not predictions made at the time.

| Case | Band (index) | Likelihood | Confidence | Materialized |
|------|--------------|-----------|------------|--------------|
| Suez 2021 | CRITICAL (85) | very_high | high | yes |
| Red Sea 2023 | CRITICAL (85) | very_high | high | yes |
| Black Sea grain 2022 | CRITICAL (85) | very_high | low | yes |
| Baltimore bridge 2024 | MODERATE (50) | very_high | high | yes |
| Panama drought 2023 | HIGH (70) | very_high | low | yes |
| Tariff review 2023 | UNRATED | insufficient_evidence | low | no |

- False negatives in sample: 0/5 materialized disruptions missed.
- False positives in sample: 0/1 non-materialized case over-flagged
  (correctly UNRATED due to thin evidence).
- Contradictory-source cases correctly yield LOW confidence.
- Consistency: identical inputs -> identical outputs; minor source-count
  changes keep bands stable.
- Evidence coverage: 82% of fixture dimensions carry verified evidence.

**No statistical calibration is claimed.** n=6 retrospective cases cannot
calibrate probabilities; likelihood bands remain judgment frameworks.

## UNRATED audit (fixed)
- Latest score: null + unrated flag (existing).
- Score history: UNRATED points now map to null, not stored 0 (FIXED).
- Risk-change deltas: exclude unrated on both sides (FIXED).
- Averages, region aggregation: exclude nulls (verified).
- Rankings: unrated sorts last; events remain fully viewable.

## Methodology comparison (internal tool)
test/risk-validation-smoke.mjs section 5 runs V1 legacy derivation and
V2 side-by-side on synthesized equivalent inputs (test-only, no writes):
Suez V1=57 vs V2=85; Red Sea V1=61 vs V2=85; Grain V1=65 vs V2=85.
V2 rates verified ongoing global disruptions higher than V1 heuristics —
consistent with the methodology intent.
