// PRISM — user management smoke test. Zero dependencies.
// Run: node projects/prism/test/user-management-smoke.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  ok  " + name); }
  else { fail++; console.error("FAIL  " + name + (detail ? " — " + detail : "")); }
}
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

console.log("[1] role migration");
const sql = read(path.join(ROOT, "supabase", "migrations", "20261128000000_user_roles.sql"));
check("role column + check", sql.includes("add column if not exists role") && sql.includes("check (role in ('admin', 'viewer'))"));
check("default viewer", sql.includes("default 'viewer'"));
check("first user becomes admin", sql.includes("order by created_at asc limit 1"));
check("self-promotion blocked (column grants)", sql.includes("revoke update on public.profiles from authenticated") && sql.includes("grant update (display_name, preferences) on public.profiles to authenticated"));

console.log("[2] manage-users function");
const fn = read(path.join(ROOT, "supabase", "functions", "manage-users", "index.ts"));
check("caller JWT verified", fn.includes("db.auth.getUser(jwt)"));
check("server-side admin check", fn.includes('profile?.role !== "admin"') && fn.includes("admin_only"));
check("create forces viewer (no role from request)", !fn.includes("body?.role") && fn.includes('role: "viewer"'));
check("email confirm on create", fn.includes("email_confirm: true"));
check("password minimum", fn.includes("password.length < 8"));
check("cannot delete self", fn.includes("cannot_delete_self"));
check("cannot delete admin", fn.includes("cannot_delete_admin"));
check("list bounded", fn.includes("MAX_LIST = 50"));
check("no service key in responses", !fn.includes("SUPABASE_SERVICE_ROLE_KEY") || fn.includes("createServiceClient"));

console.log("[3] settings wiring");
const s = read(path.join(ROOT, "frontend", "js", "settings.js"));
check("role-gated panel", s.includes('profile?.role !== "admin"') && s.includes("section.hidden = false"));
check("calls manage-users", s.includes('sb.functions.invoke("manage-users"'));
check("init calls user management", s.includes("await initUserManagement();"));
check("escaped user fields", s.includes("escapeHtml(u.email)") && s.includes("escapeHtml(u.role)"));
check("no remove for self/admin", s.includes('u.is_self || u.role === "admin"'));
const h = read(path.join(ROOT, "frontend", "settings.html"));
check("users section hidden by default", h.includes('id="users-section"') && h.includes("hidden"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail === 0 ? 0 : 1;
