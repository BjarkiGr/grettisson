// PRISM V2.1 Phase 1 — security regression suite. Zero dependencies.
// Run: node projects/prism/test/security-smoke.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/^\uFEFF/, "");

console.log("[1] import/export consistency (would have caught P0-01)");
const FN = path.join(ROOT, "supabase", "functions");
const exportCache = new Map();
function exportsOf(mod) {
  if (exportCache.has(mod)) return exportCache.get(mod);
  const src = read("supabase/functions/_shared/" + mod);
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) for (const part of m[1].split(",")) {
    const bits = part.trim().split(/\s+as\s+/); const nm = (bits[1] ?? bits[0]).replace(/^type\s+/, "").trim(); if (nm) names.add(nm);
  }
  exportCache.set(mod, names);
  return names;
}
for (const dir of readdirSync(FN, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "_shared")) {
  const src = read("supabase/functions/" + dir.name + "/index.ts");
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"\.\.\/_shared\/([a-z-]+\.ts)"/g)) {
    const names = exportsOf(m[2]);
    for (const part of m[1].split(",")) {
      const original = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (!original) continue;
      check(dir.name + ": " + original + " exists in " + m[2], names.has(original));
    }
  }
}

console.log("[2] pipeline gates");
for (const fn of ["ingest-sources", "process-articles", "analyze-events", "calculate-risk", "health-check"]) {
  const src = read("supabase/functions/" + fn + "/index.ts");
  check(fn + " service-role gate", src.includes('if (!isServiceRole(req)) return jsonResponse({ error: "unauthorized" }, 401);'));
  const gatePos = src.indexOf("isServiceRole(req)");
  const workPos = src.indexOf("createServiceClient()");
  check(fn + " gate before service work", gatePos > -1 && (workPos === -1 || gatePos < workPos));
  const methodPos = src.indexOf("req.method !==");
  const methodLine = methodPos === -1 ? "" : src.slice(methodPos, src.indexOf("\n", methodPos)).trim();
  check(fn + " gate not trapped in method block", gatePos > -1 && (methodPos === -1 || !methodLine.endsWith("{") || gatePos < methodPos));
}
const auth = read("supabase/functions/_shared/auth.ts");
check("strict role equality", auth.includes('payload?.role === "service_role"'));
check("bounded body reader", auth.includes("readJsonLimited") && auth.includes("maxBytes"));

console.log("[3] user-facing hardening");
const mu = read("supabase/functions/manage-users/index.ts");
check("manage-users bounded body", mu.includes("readJsonLimited(req, 4096)"));
check("manage-users input caps", mu.includes("password.length > 128") && mu.includes("email.length > 254"));
check("manage-users generic 500", mu.includes('error: "internal_error"') && !mu.includes("error: message }, 500"));
const rc = read("supabase/functions/reclassify-articles/index.ts");
check("reclassify generic 500", rc.includes('error: "internal_error"'));
const mc = read("supabase/functions/match-company-events/index.ts");
check("match bounded body", mc.includes("readJsonLimited(req, 1024)"));
check("match pinned supabase-js", mc.includes("esm.sh/@supabase/supabase-js@2.45.4") && !mc.includes("npm:@supabase"));
const ae = read("supabase/functions/analyze-events/index.ts");
check("analyze bounded body", ae.includes("readJsonLimited(req, 2048)"));

console.log("[4] migration 0008 + config");
const sql = read("supabase/migrations/20261201000000_security_hardening.sql");
check("viewer RPC revoked", sql.includes("revoke execute on function public.invoke_edge_function(text) from authenticated;"));
const cfg = read("supabase/config.toml");
for (const fn of ["ingest-sources", "process-articles", "analyze-events", "calculate-risk", "health-check", "manage-users", "reclassify-articles", "extract-company-profile", "match-company-events"]) {
  check("config.toml entry " + fn, cfg.includes("[functions." + fn + "]"));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
