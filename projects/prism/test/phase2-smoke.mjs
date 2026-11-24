// PRISM — Phase 2 smoke test. Zero dependencies.
// Run: node projects/prism/test/phase2-smoke.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS = path.join(ROOT, "frontend", "js");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const imp = (f) => import(pathToFileURL(path.join(JS, f)).href);

console.log("[1] migration schema");
const migPath = path.join(ROOT, "supabase", "migrations", "20261124000000_initial_schema.sql");
check("migration file exists", existsSync(migPath));
const sql = read(migPath);
const TABLES = ["profiles","sources","articles","events","event_articles","analyses","risk_scores","watchlists","event_watchlists","processing_jobs"];
for (const t of TABLES) {
  check("table " + t, sql.includes("create table if not exists public." + t + " (") || sql.includes("create table if not exists public." + t + "("));
  check("RLS enabled on " + t, sql.includes("alter table public." + t + " enable row level security"));
}
check("12-value event_category enum", sql.includes("create type public.event_category as enum") && sql.includes("cybersecurity_incidents"));
check("content_hash unique", /content_hash text not null unique/.test(sql));
check("feed_url partial unique", sql.includes("sources_feed_url_key"));
check("watchlist target unique", sql.includes("unique (user_id, kind, target)"));
check("active-job dedup index", sql.includes("processing_jobs_active_entity_key"));
check("risk score range checks", sql.includes("overall_score smallint not null check (overall_score between 0 and 100)"));
check("dimension range checks", (sql.match(/between 0 and 5/g) ?? []).length >= 7);
check("profile auto-create trigger", sql.includes("on_auth_user_created") && sql.includes("handle_new_user"));
check("updated_at triggers", sql.includes("profiles_set_updated_at") && sql.includes("processing_jobs_set_updated_at"));

console.log("[2] RLS policies");
for (const t of ["sources","articles","events","event_articles","analyses","risk_scores"]) {
  check(t + " authenticated read policy", sql.includes("create policy " + t + "_read_authenticated"));
}
check("profiles owner-only", sql.includes("profiles_select_own") && sql.includes("using (id = auth.uid())"));
check("watchlists owner CRUD", ["select","insert","update","delete"].every((op) => sql.includes("watchlists_" + op + "_own")));
check("event_watchlists via ownership", sql.includes("w.user_id = auth.uid()"));
check("no write policies on intelligence", !/create policy \w+ on public\.(sources|articles|events|analyses|risk_scores)\s+for (insert|update|delete)/.test(sql));
check("no policies on processing_jobs", !/create policy \w+ on public\.processing_jobs/.test(sql));
check("no risk_scores update/delete", !/create policy \w+ on public\.risk_scores for (update|delete)/.test(sql));
const creates = (sql.match(/create policy /g) ?? []).length;
const drops = (sql.match(/drop policy if exists /g) ?? []).length;
check("idempotent policies (drop >= create)", drops >= creates && creates > 0);
check("no credentials in SQL", !/sb_secret_|service_role\s*=|password\s*=\s*'/i.test(sql));
check("authenticated SELECT grants", /grant select on public\.sources, public\.articles, public\.events,/.test(sql));
check("watchlist CRUD grants", /grant select, insert, update, delete on public\.watchlists, public\.event_watchlists/.test(sql));
check("service_role full grants", /grant all on public\.profiles/.test(sql) && sql.includes("to service_role"));
check("no anon table grants", !/grant (select|all|insert)[^;]*to anon/.test(sql));
check("live test exists", existsSync(path.join(ROOT, "test", "phase2-live.mjs")));

console.log("[3] auth + settings modules");
const auth = await imp("auth.js");
const settings = await imp("settings.js");
const cfg = await imp("config.js");
for (const fn of ["getSession","signIn","signOut","onAuthChange","init"]) {
  check("auth exports " + fn, typeof auth[fn] === "function");
}
check("settings exports init", typeof settings.init === "function");
if (!cfg.isConfigured()) {
  check("getSession null when unconfigured", (await auth.getSession()) === null);
  check("onAuthChange returns unsubscribe", typeof auth.onAuthChange(() => {}) === "function");
} else {
  // Node cannot import the https CDN client (browsers can); skip client
  // calls here. Live behavior is covered by test/phase2-live.mjs.
  console.log("note  configured — client calls skipped in Node; see phase2-live.mjs");
}
if (cfg.config.supabaseUrl) {
  check("configured URL format", /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(cfg.config.supabaseUrl));
  check("configured key present", cfg.config.supabaseAnonKey.length > 20);
} else {
  console.log("note  config.js still unconfigured — awaiting project URL + anon key");
}

console.log("[4] page wiring");
const login = read(path.join(ROOT, "frontend", "login.html"));
check("login form", login.includes('id="login-form"'));
check("login email input", login.includes('id="login-email"') && login.includes('type="email"'));
check("login password input", login.includes('id="login-password"') && login.includes('type="password"'));
check("login error region", login.includes('id="login-error"') && login.includes('role="alert"'));
check("login signed-in state", login.includes('id="auth-signed-in"') && login.includes('id="logout-btn"'));
check("login data-page", login.includes('data-page="login"'));
const settingsHtml = read(path.join(ROOT, "frontend", "settings.html"));
check("settings connection root", settingsHtml.includes('id="connection-root"'));
check("settings data-page", settingsHtml.includes('data-page="settings"'));
const app = read(path.join(JS, "app.js"));
check("app routes login", app.includes('login: "./auth.js"'));
check("app routes settings", app.includes('settings: "./settings.js"'));
check("app auth status indicator", app.includes("renderAuthStatus"));

console.log("[5] no privileged secrets in frontend");
const files = ["auth.js","settings.js","app.js","supabase.js","config.js"];
for (const f of files) {
  const src = read(path.join(JS, f));
  check("no secrets in " + f, !/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|AI_API_KEY/.test(src));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
