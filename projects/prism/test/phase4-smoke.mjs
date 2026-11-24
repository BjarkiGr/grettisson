// PRISM — Phase 4 smoke test. Zero dependencies.
// Run: node --experimental-strip-types projects/prism/test/phase4-smoke.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = path.join(ROOT, "supabase", "functions", "_shared");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const imp = (f) => import(pathToFileURL(path.join(SHARED, f)).href);
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

const { validateAnalysisOutput } = await imp("analysis-validation.ts");
const { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt } = await imp("prompts.ts");
const { createOpenAiCompatibleProvider } = await imp("ai-provider.ts");

const IDS = ["art-1", "art-2"];
const URLS = ["https://example.com/a", "https://example.com/b"];
const valid = {
  event_title: "Test event", executive_summary: "A summary of the test event.",
  event_category: "sanctions", countries_involved: ["RU", "DE"], geographic_region: "Europe",
  organizations: ["Test Org"], commodities_affected: ["natural-gas"], industries_affected: ["energy"],
  supply_chain_implications: "Implications.", economic_consequences: "Consequences.",
  escalation_scenarios: ["Speculative scenario."], severity_assessment: 3, confidence_level: 0.6,
  supporting_evidence: [{ claim: "A claim", article_id: "art-1", kind: "verified_fact" }],
  uncertainties: ["Unknown duration"], source_references: ["https://example.com/a"],
};

console.log("[1] strict output validation");
check("valid output accepted", validateAnalysisOutput(valid, IDS, URLS).ok === true);
const mutate = (fn) => { const c = JSON.parse(JSON.stringify(valid)); fn(c); return validateAnalysisOutput(c, IDS, URLS); };
check("missing summary rejected", mutate((c) => { delete c.executive_summary; }).ok === false);
check("bad category rejected", mutate((c) => { c.event_category = "bogus"; }).ok === false);
check("severity 6 rejected", mutate((c) => { c.severity_assessment = 6; }).ok === false);
check("fractional severity rejected", mutate((c) => { c.severity_assessment = 2.5; }).ok === false);
check("confidence 1.2 rejected", mutate((c) => { c.confidence_level = 1.2; }).ok === false);
check("non-ISO countries rejected", mutate((c) => { c.countries_involved = ["russia"]; }).ok === false);
check("fabricated evidence article_id rejected", mutate((c) => { c.supporting_evidence[0].article_id = "art-99"; }).ok === false);
check("fabricated source URL rejected", mutate((c) => { c.source_references = ["https://evil.example/x"]; }).ok === false);
check("empty evidence rejected", mutate((c) => { c.supporting_evidence = []; }).ok === false);
check("bad evidence kind rejected", mutate((c) => { c.supporting_evidence[0].kind = "guess"; }).ok === false);
check("non-object rejected", validateAnalysisOutput("nope", IDS, URLS).ok === false);
check("null rejected", validateAnalysisOutput(null, IDS, URLS).ok === false);

console.log("[2] prompts");
check("prompt version", PROMPT_VERSION === "1.0.0");
const fields = ["event_title","executive_summary","event_category","countries_involved","geographic_region","organizations","commodities_affected","industries_affected","supply_chain_implications","economic_consequences","escalation_scenarios","severity_assessment","confidence_level","supporting_evidence","uncertainties","source_references"];
check("system prompt covers all 16 fields", fields.every((f) => SYSTEM_PROMPT.includes(f)));
check("system prompt forbids invented citations", SYSTEM_PROMPT.includes("NEVER invent citations"));
const up = buildUserPrompt({ title: "Ev", summary: "S", category: "sanctions", primary_country: "RU", region: "Europe" }, [{ id: "art-1", title: "T", url: "https://example.com/a", excerpt: "E", published_at: null, source_name: "Src" }]);
check("user prompt includes article id/url/title", up.includes("art-1") && up.includes("https://example.com/a") && up.includes("T"));
check("user prompt includes event context", up.includes("Ev") && up.includes("sanctions"));

console.log("[3] provider error mapping (stubbed fetch)");
const cfg = { provider: "test", apiBaseUrl: "https://api.test/v1", model: "m", apiKey: "k", timeoutMs: 1000, maxTokens: 100 };
const req = { systemPrompt: "s", userPrompt: "u", promptVersion: "1.0.0", expectJson: true };
const resp = (status, body, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const withFetch = (fn) => createOpenAiCompatibleProvider(cfg, fn);
let r;
r = await withFetch(async () => resp(429, {}, { "retry-after": "30" })).analyze(req);
check("429 -> rate_limited + retryAfter", !r.ok && r.kind === "rate_limited" && r.retryAfterSeconds === 30);
r = await withFetch(async () => resp(401, {})).analyze(req);
check("401 -> auth", !r.ok && r.kind === "auth");
r = await withFetch(async () => resp(402, {})).analyze(req);
check("402 -> quota_exhausted", !r.ok && r.kind === "quota_exhausted");
r = await withFetch(async () => resp(503, {})).analyze(req);
check("503 -> unavailable", !r.ok && r.kind === "unavailable");
r = await withFetch(async () => resp(200, { choices: [{ message: { content: '{"a":1}' } }] })).analyze(req);
check("200 JSON -> ok", r.ok && r.json.a === 1 && r.provider === "test" && r.model === "m");
r = await withFetch(async () => resp(200, { choices: [{ message: { content: "not json" } }] })).analyze(req);
check("malformed -> invalid_response", !r.ok && r.kind === "invalid_response");
r = await withFetch(async () => resp(200, { choices: [{ message: { content: "```json\n{\"a\":1}\n```" } }] })).analyze(req);
check("fenced JSON extracted", r.ok && r.json.a === 1);
let calls = 0;
r = await withFetch(async () => { calls++; return calls === 1 ? resp(400, "response_format is not supported") : resp(200, { choices: [{ message: { content: '{"a":2}' } }] }); }).analyze(req);
check("json-mode rejection falls back", r.ok && r.json.a === 2 && calls === 2);
r = await withFetch(async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }).analyze(req);
check("abort -> timeout", !r.ok && r.kind === "timeout");
r = await withFetch(async () => { throw new Error("ECONNRESET"); }).analyze(req);
check("network error -> unavailable", !r.ok && r.kind === "unavailable");

console.log("[4] analyze-events structure");
const an = read(path.join(ROOT, "supabase", "functions", "analyze-events", "index.ts"));
check("small batch", an.includes("BATCH_SIZE = 3"));
check("pause on quota/rate/auth", an.includes('"rate_limited" || result.kind === "quota_exhausted" || result.kind === "auth"'));
check("auto-resume windows", an.includes("RATE_LIMIT_RESUME_MINUTES = 10") && an.includes("QUOTA_RESUME_MINUTES = 60"));
check("manual resume", an.includes("body.resume === true"));
check("provenance stored", an.includes("prompt_version: PROMPT_VERSION") && an.includes("provider: result.provider"));
check("validation before storage", an.indexOf("validateAnalysisOutput") < an.indexOf('from("analyses").insert'));
check("risk queued for Phase 5", an.includes('job_type: "calculate_risk"'));
check("honest 503 when unconfigured", an.includes("ai_provider_not_configured"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
