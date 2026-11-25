// PRISM V2.1 Phase 6 — integration smoke test (deterministic chain).
// RSS -> classify -> dedup -> AI validation -> risk -> company relevance.
// Run: node --experimental-strip-types projects/prism/test/integration-smoke.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const imp = (p) => import(pathToFileURL(path.join(ROOT, "supabase", "functions", "_shared", p)).href);
const rss = await imp("rss.ts");
const classify = await imp("classify.ts");
const normalize = await imp("normalize.ts");
const dedup = await imp("dedup.ts");
const prompts = await imp("prompts.ts");
const validation = await imp("analysis-validation.ts");
const risk = await imp("risk-v2.ts");
const rel = await imp("relevance.ts");
const ai = await imp("ai-provider.ts");

console.log("[1] normal operation: full chain");
const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title><item><title>China announces new steel export tariffs</title><link>https://example.com/steel-tariffs?utm_source=rss</link><description>China will impose export tariffs on steel products from next month, officials said.</description><pubDate>Mon, 01 Dec 2026 08:00:00 GMT</pubDate></item></channel></rss>';
const items = rss.parseFeed(xml);
check("RSS parsed", items.length === 1);
const it = items[0];
const cls = classify.classifyArticle(it.title, it.description ?? "");
check("classified relevant trade item", cls.relevant === true && ["tariffs", "trade_restrictions"].includes(cls.category));
const url = normalize.normalizeUrl(it.link);
check("URL normalized (tracking stripped)", url === "https://example.com/steel-tariffs");
const h1 = await normalize.contentHash(it.title + " " + (it.description ?? ""));
const h2 = await normalize.contentHash(it.title + " " + (it.description ?? ""));
check("duplicate content -> identical hash", h1 === h2);
const sim = dedup.eventSimilarity(it.title, { title: "China announces steel export tariffs", last_updated_at: new Date().toISOString() }, Date.now());
check("same story merges (>= threshold)", sim >= dedup.MERGE_THRESHOLD);
const article = { id: "art-1", title: it.title, url, excerpt: it.description ?? "", published_at: null, source_name: "Test", source_type: "rss" };
const up = prompts.buildUserPromptV21({ title: it.title, summary: null, category: cls.category, primary_country: cls.primaryCountry, region: cls.region }, [article]);
check("prompt built with delimiters", up.includes("<<<ARTICLE art-1>>>"));
const dim = { proposed_score: 3, rationale: "tariffs verified", evidence_article_ids: ["art-1"], uncertainty: "scope unclear" };
const aiOut = {
  event_title: "China steel export tariffs", executive_summary: "China announced export tariffs on steel.", event_category: "tariffs",
  countries_involved: ["CN"], geographic_region: "East Asia", organizations: [], commodities_affected: ["steel"], industries_affected: ["construction"],
  supply_chain_implications: "Higher input costs for importers.", economic_consequences: "Price pressure downstream.",
  escalation_scenarios: [], severity_assessment: 3, confidence_level: 0.5, uncertainties: ["Final scope unclear"],
  supporting_evidence: [{ claim: "Tariffs announced", article_id: "art-1", kind: "verified_fact" }],
  source_references: [url],
  dimensions: { escalation: { ...dim, proposed_score: 2 }, economic: dim, supply_chain: dim, geographic: { ...dim, proposed_score: 2 }, strategic: { ...dim, proposed_score: 2 }, persistence: { ...dim, proposed_score: 2 } },
  likelihood: { outcome: "higher steel import costs", horizon_days: 60, level: "high", rationale: "announced policy", ongoing_claim: false, evidence_article_ids: ["art-1"] },
  confidence_inputs: { material_contradictions: [], evidence_gaps: ["scope"] },
  assessment_limitations: ["Only one source available."],
};
const v = validation.validateAnalysisOutputV21(aiOut, ["art-1"], [url]);
check("AI output validates", v.ok === true, v.ok ? "" : v.errors.join("; "));
const inputs = {
  dimensions: Object.fromEntries(Object.entries(aiOut.dimensions).map(([k, d]) => [k, { proposed: d.proposed_score, verified_evidence: d.evidence_article_ids.length > 0 }])),
  major_economy_affected: true, independent_sources: 1, material_contradictions: false, verified_fact_count: 1,
  ai_likelihood: { level: aiOut.likelihood.level, horizon_days: 60, outcome: aiOut.likelihood.outcome }, ongoing_confirmed: false,
};
const r = risk.assessRiskV2(inputs);
check("single source caps likelihood (L3)", r.likelihood === "moderate");
check("risk computed from validated inputs only", typeof r.risk_index === "number");
const profile = { industries: [{ industry: "construction", origin: "user_supplied" }], commodities: [{ commodity_slug: "steel", origin: "user_supplied" }], countries: [{ country_code: "CN", role: "supplier", origin: "user_supplied" }], dependencies: [] };
const m = rel.matchProfileToEvent(profile, { event_type: "tariffs", commodity_slugs: ["steel"], country_codes: ["CN"], industries: ["construction"], chokepoints: [] });
check("company relevance: direct + purchasing implications", m.exposure === "direct" && m.purchasing.potential_business_implications.length > 0);
check("relevance separate from risk", m.relevance_score !== r.risk_index);

console.log("[2] failure scenarios");
check("malformed RSS -> empty, no throw", rss.parseFeed("<rss><channel>").length === 0 && rss.parseFeed("not xml at all").length === 0);
check("irrelevant article filtered", classify.classifyArticle("Local football match results", "The team won the league cup final.").relevant === false);
const mk = (status, body = "", headers = {}) => ai.createOpenAiCompatibleProvider({ provider: "t", apiBaseUrl: "https://x", model: "m", apiKey: "k", timeoutMs: 1000, maxTokens: 100 }, async () => new Response(body, { status, headers }));
check("429 -> rate_limited", (await mk(429, "", { "retry-after": "30" }).analyze({ systemPrompt: "s", userPrompt: "u", promptVersion: "2.1.0", expectJson: true })).kind === "rate_limited");
check("402 -> quota_exhausted", (await mk(402).analyze({ systemPrompt: "s", userPrompt: "u", promptVersion: "2.1.0", expectJson: true })).kind === "quota_exhausted");
check("500 -> unavailable", (await mk(500).analyze({ systemPrompt: "s", userPrompt: "u", promptVersion: "2.1.0", expectJson: true })).kind === "unavailable");
check("non-JSON completion -> invalid_response", (await mk(200, JSON.stringify({ choices: [{ message: { content: "sorry, no json" } }] })).analyze({ systemPrompt: "s", userPrompt: "u", promptVersion: "2.1.0", expectJson: true })).kind === "invalid_response");
const thin = risk.assessRiskV2({ ...inputs, verified_fact_count: 0, ai_likelihood: { level: "insufficient_evidence", horizon_days: 30, outcome: "x" } });
check("insufficient evidence -> UNRATED, relevance unaffected", thin.risk_index === null && rel.matchProfileToEvent(profile, { event_type: "tariffs", commodity_slugs: ["steel"], country_codes: ["CN"], industries: [], chokepoints: [] }).exposure === "direct");
check("fabricated citation rejected in chain", validation.validateAnalysisOutputV21({ ...aiOut, source_references: ["https://evil.example.com"] }, ["art-1"], [url]).ok === false);
const adv = JSON.parse(readFileSync(path.join(ROOT, "test", "adversarial-articles.json"), "utf8").replace(/^\uFEFF/, ""));
const advUp = prompts.buildUserPromptV21({ title: "t", summary: null, category: "tariffs", primary_country: null, region: null }, adv.map((a) => ({ id: a.id, title: a.title, url: "https://e.com/" + a.id, excerpt: a.excerpt, published_at: null, source_name: "S" })));
check("adversarial chain: spoof neutralized end-to-end", !advUp.includes("<<<ARTICLE fake>>>"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
