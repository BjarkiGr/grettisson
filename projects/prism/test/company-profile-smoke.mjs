// PRISM V2 Phase 2 — company profile smoke test. Zero dependencies.
// Run: node projects/prism/test/company-profile-smoke.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/^\uFEFF/, "");

console.log("[1] migration: tables, owner RLS, origins");
const sql = read("supabase/migrations/20261130000000_company_profiles.sql");
const TABLES = ["company_profiles", "company_industries", "company_commodities", "company_products", "company_countries", "company_dependencies"];
for (const t of TABLES) {
  check("table " + t, sql.includes("create table if not exists public." + t));
  check("RLS " + t, sql.includes("alter table public." + t + " enable row level security"));
}
check("owner policies use auth.uid()", (sql.match(/user_id = auth\.uid\(\)/g) ?? []).length >= 4);
check("origin constraint everywhere", (sql.match(/origin in \('user_supplied', 'ai_confirmed', 'imported_verified'\)/g) ?? []).length >= 5);
check("one profile per user", sql.includes("user_id uuid not null unique references auth.users"));
check("country roles constrained", sql.includes("role in ('supplier', 'operating', 'customer', 'transport')"));
check("no anon grants on company tables", !/grant[^;]*company[^;]*to anon/.test(sql));
check("authenticated CRUD grants", sql.includes("grant select, insert, update, delete on public.company_profiles"));

console.log("[2] extraction function: consent, privacy, suggestions-only");
const fn = read("supabase/functions/extract-company-profile/index.ts");
check("JWT verified", fn.includes("db.auth.getUser(jwt)"));
check("consent required", fn.includes('body?.consent !== true') && fn.includes("consent_required"));
check("description bounds", fn.includes("MAX_DESCRIPTION = 4000") && fn.includes("description.length < 20"));
check("no company-table writes", !fn.includes('from("company_'));
check("description never logged", !/console\.(log|error)\([^)]*description/.test(fn));
check("strict validation present", fn.includes("validateSuggestions") && fn.includes("ISO_RE") && fn.includes("SLUG_RE"));
check("generic errors only", fn.includes('error: "extraction_failed"') && fn.includes('error: "extraction_error"'));

console.log("[3] frontend pure helpers");
const company = await import(pathToFileURL(path.join(ROOT, "frontend", "js", "company.js")).href);
check("slug normalization", company.normalizeSlug("  Electrical Equipment!! ") === "electrical-equipment");
check("ISO validation", company.isIsoCode("de") === true && company.isIsoCode("DEU") === false);
const entries = company.suggestionsToEntries({
  name: "Test Co", industry: "construction", business_type: "importer",
  operating_countries: ["IS"], supplier_countries: ["DE", "CN", "de"], customer_countries: [], transport_countries: ["IS"],
  commodities: ["Steel", "timber", "bad slug!"], industries: ["Construction"],
  products: [{ name: "rebar", category: "steel" }],
  dependencies: [{ kind: "chokepoint", ref: "Suez Canal" }, { kind: "bogus", ref: "x" }],
  uncertainties: ["maybe"],
});
check("countries deduped with roles", entries.countries.length === 4);
check("all suggestions origin ai_confirmed", entries.commodities.every((c) => c.origin === "ai_confirmed") && entries.countries.every((c) => c.origin === "ai_confirmed"));
check("slugs normalized + invalid dropped", entries.commodities.map((c) => c.commodity_slug).join() === "steel,timber,bad-slug");
check("dependency kinds constrained", entries.dependencies.every((d) => ["route", "chokepoint", "infrastructure", "other"].includes(d.kind)));
check("dependencies unconfirmed by default", entries.dependencies.every((d) => d.confirmed === false));

console.log("[4] wiring");
const app = read("frontend/js/app.js");
check("company routed", app.includes('company: "./company.js"'));
const page = read("frontend/company.html");
check("page data-page + root", page.includes('data-page="company"') && page.includes('id="company-root"'));
for (const f of readdirSync(path.join(ROOT, "frontend")).filter((f) => f.endsWith(".html"))) {
  check(f + " nav has Company Profile", read("frontend/" + f).includes('href="company.html"'));
}
const cj = read("frontend/js/company.js");
check("consent checkbox in UI", cj.includes('id="cp-consent"'));
check("origin chips rendered", cj.includes("originChip"));
check("save sets origins", cj.includes("origin: x.origin"));
check("skip option exists", cj.includes("Skip"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
