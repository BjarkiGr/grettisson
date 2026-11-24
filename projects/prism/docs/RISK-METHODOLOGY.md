# PRISM — Risk Methodology (FINALIZED in Phase 5)

Transparent, explainable, reproducible. The AI supplies a validated,
structured assessment; dimensions are derived by documented deterministic
rules; the final score is explicit arithmetic in `_shared/risk.ts` /
`calculate-risk`. The AI never produces the final score.

## Dimensions (each 0-5)

1. **Severity** — the AI's `severity_assessment` against the anchored scale
   in prompt 1.0.0: 0 negligible, 1 minor, 2 limited, 3 significant,
   4 severe, 5 catastrophic/systemic. Clamped to 0-5.
2. **Probability** — `1 + round(4 * verified_fact_ratio)` where the ratio is
   verified-fact evidence / total evidence. More verified reporting means
   consequences are more likely already materializing. ALWAYS presented as
   an analytical estimate, never an objective statistic.
3. **Geographic reach** — country count: 0->1, 1->2, 2-3->3, 4-6->4, 7+->5;
   region "Global" -> 5.
4. **Expected duration** — category prior: military 4, political 3,
   trade-restrictions 3, sanctions 4, tariffs 4, natural-disasters 1,
   energy 3, shipping 3, economic 4, infrastructure 2, diplomatic 1,
   cyber 1. (Typical persistence; refined by future re-analysis.)
5. **Supply-chain exposure** — commodity count: 0->1, 1->2, 2->3, 3->4,
   4+->5; +1 (cap 5) for trade-related categories (shipping, energy,
   trade-restrictions, sanctions, tariffs).
6. **Economic impact** — industry count: 0->1, 1->2, 2->3, 3->4, 4+->5.

These derivation rules are deliberately simple and auditable for the MVP.
Every stored score includes an explanation listing each dimension, its
weight, and the exact inputs used.

## Weights and formula

| Dimension | Weight |
|---|---|
| severity | 1.2 |
| probability | 1.0 |
| geographic | 0.8 |
| duration | 0.8 |
| supply_chain | 1.2 |
| economic | 1.0 |

    overall = round( sum(weight_i * score_i) / (5 * sum(weight_i)) * 100 )

Weights are identical in backend `_shared/risk.ts` and frontend
`js/utils.js`; a parity test enforces this (90 vectors + all 101 bands).

## Risk levels (fixed by spec)

0-19 MINIMAL · 20-39 LOW · 40-59 MODERATE · 60-79 HIGH · 80-100 CRITICAL

## Stored per assessment (append-only)

All six dimension scores, overall score, generated explanation, confidence
(from the analysis — DISTINCT from impact: high-impact scenarios can be
low-confidence), timestamp. `risk_scores` has no update/delete policies or
grants; history is preserved and score changes are trackable.

## Verification

- test/phase5-smoke.mjs: 49 checks (derivation rules, formula vectors,
  bands, explanations, frontend/backend parity, function structure).
- Live: all 25 events scored (range 42-77, median 55), 0 failures.
