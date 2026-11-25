// PRISM — company.js (V2 Phase 2)
// Company Profile: natural-language onboarding -> AI suggestions ->
// editable confirmation -> origin-tagged save. Owner-only via RLS.
// Nothing AI-suggested is persisted without explicit user confirmation.

import { getClient } from "./supabase.js";
import { getSession } from "./auth.js";
import { escapeHtml } from "./utils.js";
import { emptyState, loadingState, errorState } from "./components.js";

export const normalizeSlug = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
export const isIsoCode = (s) => /^[A-Z]{2}$/.test(String(s ?? "").trim().toUpperCase());

/** Pure: AI suggestions -> editable entry state, all origin ai_confirmed. */
export function suggestionsToEntries(s) {
  const countries = [];
  const seen = new Set();
  for (const [role, list] of [["operating", s.operating_countries], ["supplier", s.supplier_countries], ["customer", s.customer_countries], ["transport", s.transport_countries]]) {
    for (const c of list ?? []) {
      const code = String(c).toUpperCase();
      const key = code + ":" + role;
      if (isIsoCode(code) && !seen.has(key)) { seen.add(key); countries.push({ country_code: code, role, origin: "ai_confirmed" }); }
    }
  }
  return {
    name: s.name ?? "", industry: s.industry ?? "", business_type: s.business_type ?? "",
    industries: (s.industries ?? []).map((i) => ({ industry: String(i), origin: "ai_confirmed" })),
    commodities: (s.commodities ?? []).map((c) => ({ commodity_slug: normalizeSlug(c), origin: "ai_confirmed" })).filter((c) => c.commodity_slug),
    products: (s.products ?? []).map((p) => ({ name: String(p.name ?? ""), category: p.category ?? "", origin: "ai_confirmed" })).filter((p) => p.name),
    countries,
    dependencies: (s.dependencies ?? []).map((d) => ({ kind: ["route", "chokepoint", "infrastructure", "other"].includes(d.kind) ? d.kind : "other", ref: String(d.ref ?? ""), confirmed: false, origin: "ai_confirmed" })).filter((d) => d.ref),
    uncertainties: s.uncertainties ?? [],
  };
}

const ORIGIN_LABEL = { user_supplied: "you", ai_confirmed: "AI suggested", imported_verified: "verified import" };
const originChip = (o) => '<span class="chip">' + escapeHtml(ORIGIN_LABEL[o] ?? o) + "</span>";

let state = null;
let profileId = null;
let description = "";
let consented = false;

function listSection(title, key, rows, renderRow, addPlaceholder) {
  return '<h3>' + escapeHtml(title) + "</h3>" +
    (rows.length ? rows.map((r, i) => '<div class="region-row">' + renderRow(r) + " " + originChip(r.origin) +
      ' <button class="nav-toggle rm" data-key="' + key + '" data-i="' + i + '" style="display:inline-block">Remove</button></div>').join("") : emptyState("None yet.")) +
    '<div class="filter-bar"><input id="add-' + key + '" type="text" placeholder="' + escapeHtml(addPlaceholder) + '">' +
    '<button class="nav-toggle add" data-key="' + key + '" style="display:inline-block">Add</button></div>';
}

function renderForm(root) {
  const s = state;
  root.innerHTML =
    '<section class="panel"><h2>Company details</h2>' +
    '<div class="filter-bar">' +
      '<label class="filter-field"><span class="muted">Company name</span><input id="cp-name" type="text" value="' + escapeHtml(s.name) + '"></label>' +
      '<label class="filter-field"><span class="muted">Industry</span><input id="cp-industry" type="text" value="' + escapeHtml(s.industry) + '"></label>' +
      '<label class="filter-field"><span class="muted">Business type</span><input id="cp-btype" type="text" value="' + escapeHtml(s.business_type) + '"></label>' +
    "</div>" +
    (s.uncertainties?.length ? '<p class="muted">AI uncertainties (not saved as facts): ' + escapeHtml(s.uncertainties.join("; ")) + "</p>" : "") +
    '<p class="muted">Entries marked "AI suggested" become facts only when you save. Edit or remove anything wrong; additions are marked "you".</p>' +
    "</section>" +
    '<section class="panel">' +
    listSection("Commodities & materials", "commodities", s.commodities, (r) => '<span class="region-name">' + escapeHtml(r.commodity_slug) + "</span>", "e.g. steel, timber, insulation") +
    listSection("Countries (suppliers / operations / customers / transport)", "countries", s.countries, (r) => '<span class="region-name">' + escapeHtml(r.country_code) + "</span><span class=\"chip\">" + escapeHtml(r.role) + "</span>", "e.g. DE supplier (code + role)") +
    listSection("Industries", "industries", s.industries, (r) => '<span class="region-name">' + escapeHtml(r.industry) + "</span>", "e.g. construction") +
    listSection("Products", "products", s.products, (r) => '<span class="region-name">' + escapeHtml(r.name) + "</span>" + (r.category ? '<span class="chip">' + escapeHtml(r.category) + "</span>" : ""), "e.g. rebar") +
    listSection("Other dependencies (routes / chokepoints / infrastructure)", "dependencies", s.dependencies, (r) => '<span class="region-name">' + escapeHtml(r.ref) + "</span><span class=\"chip\">" + escapeHtml(r.kind) + "</span>", "e.g. Suez Canal") +
    '<div class="filter-bar"><button id="cp-save" class="nav-toggle" style="display:inline-block">Save profile</button>' +
    '<span id="cp-status" class="muted" role="status"></span></div>' +
    '<p class="muted">Private to your account. Never public. Sent to the AI provider only when you explicitly run extraction.</p>' +
    "</section>";

  root.querySelector("#cp-name").addEventListener("input", (e) => { state.name = e.target.value; });
  root.querySelector("#cp-industry").addEventListener("input", (e) => { state.industry = e.target.value; });
  root.querySelector("#cp-btype").addEventListener("input", (e) => { state.business_type = e.target.value; });

  for (const btn of root.querySelectorAll(".rm")) {
    btn.addEventListener("click", () => { state[btn.dataset.key].splice(Number(btn.dataset.i), 1); renderForm(root); });
  }
  for (const btn of root.querySelectorAll(".add")) {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const raw = root.querySelector("#add-" + key).value.trim();
      if (!raw) return;
      if (key === "commodities") { const slug = normalizeSlug(raw); if (slug) state.commodities.push({ commodity_slug: slug, origin: "user_supplied" }); }
      else if (key === "countries") {
        const parts = raw.split(/\s+/);
        const code = parts[0].toUpperCase();
        const role = ["supplier", "operating", "customer", "transport"].includes(parts[1]) ? parts[1] : "supplier";
        if (isIsoCode(code)) state.countries.push({ country_code: code, role, origin: "user_supplied" });
      }
      else if (key === "industries") state.industries.push({ industry: raw.toLowerCase(), origin: "user_supplied" });
      else if (key === "products") state.products.push({ name: raw, category: "", origin: "user_supplied" });
      else if (key === "dependencies") state.dependencies.push({ kind: "other", ref: raw, confirmed: true, origin: "user_supplied" });
      renderForm(root);
    });
  }
  root.querySelector("#cp-save").addEventListener("click", () => save(root));
}

async function save(root) {
  const status = root.querySelector("#cp-status");
  status.textContent = "Saving\u2026";
  try {
    const sb = await getClient();
    const session = await getSession();
    const { data: prof, error } = await sb.from("company_profiles").upsert({
      user_id: session.user.id, name: state.name || null, industry: state.industry || null,
      business_type: state.business_type || null, description: description || null,
      ai_consent_at: consented ? new Date().toISOString() : null,
    }, { onConflict: "user_id" }).select("id").single();
    if (error) throw error;
    profileId = prof.id;
    const tables = [
      ["company_industries", state.industries.map((x) => ({ industry: x.industry, origin: x.origin }))],
      ["company_commodities", state.commodities.map((x) => ({ commodity_slug: x.commodity_slug, origin: x.origin }))],
      ["company_products", state.products.map((x) => ({ name: x.name, category: x.category || null, origin: x.origin }))],
      ["company_countries", state.countries.map((x) => ({ country_code: x.country_code, role: x.role, origin: x.origin }))],
      ["company_dependencies", state.dependencies.map((x) => ({ kind: x.kind, ref: x.ref, confirmed: x.confirmed, origin: x.origin }))],
    ];
    for (const [table, rows] of tables) {
      const del = await sb.from(table).delete().eq("profile_id", profileId);
      if (del.error) throw del.error;
      if (rows.length) {
        const ins = await sb.from(table).insert(rows.map((r) => ({ ...r, profile_id: profileId, user_id: session.user.id })));
        if (ins.error) throw ins.error;
      }
    }
    status.textContent = "Saved. Your profile is private and will power personalized intelligence (next phases).";
  } catch (e) {
    status.textContent = "Error: " + (e?.message ?? "save failed");
  }
}

async function loadExisting(sb, userId) {
  const { data: prof } = await sb.from("company_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!prof) return null;
  profileId = prof.id;
  description = prof.description ?? "";
  const get = async (table) => (await sb.from(table).select("*").eq("profile_id", prof.id)).data ?? [];
  return {
    name: prof.name ?? "", industry: prof.industry ?? "", business_type: prof.business_type ?? "",
    industries: await get("company_industries"),
    commodities: await get("company_commodities"),
    products: await get("company_products"),
    countries: await get("company_countries"),
    dependencies: await get("company_dependencies"),
    uncertainties: [],
  };
}

export async function init() {
  const root = document.getElementById("company-root");
  if (!root) return;
  const session = await getSession();
  if (!session) return;
  const sb = await getClient();
  root.innerHTML = loadingState("Loading profile\u2026");
  const existing = await loadExisting(sb, session.user.id);
  if (existing) { state = existing; renderForm(root); return; }

  root.innerHTML =
    '<section class="panel"><h2>Tell PRISM about your company</h2>' +
    '<p class="muted">Describe your business in ordinary language. Example: "I work for a construction supply company in Iceland. We import steel, timber, electrical equipment, insulation and plumbing products. Our suppliers are mainly in Germany, Denmark, Sweden, China and Poland."</p>' +
    '<label class="filter-field"><span class="muted">Your description</span><textarea id="cp-desc" rows="6" maxlength="4000" style="width:100%;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius);color:var(--color-text);padding:8px;font:inherit"></textarea></label>' +
    '<p><label><input id="cp-consent" type="checkbox"> I understand this description will be sent to the AI provider (Groq) to extract suggestions. Nothing is saved until I confirm.</label></p>' +
    '<div class="filter-bar"><button id="cp-extract" class="nav-toggle" style="display:inline-block">Extract suggestions</button>' +
    '<span id="cp-status" class="muted" role="status"></span></div>' +
    '<p class="muted"><a href="index.html">Skip \u2014 use PRISM without a company profile</a>. You can create one any time.</p>' +
    "</section>";

  root.querySelector("#cp-extract").addEventListener("click", async () => {
    const status = root.querySelector("#cp-status");
    const desc = root.querySelector("#cp-desc").value.trim();
    const consent = root.querySelector("#cp-consent").checked;
    if (desc.length < 20) { status.textContent = "Please write at least a sentence or two."; return; }
    if (!consent) { status.textContent = "Please tick the consent box first."; return; }
    status.textContent = "Extracting\u2026";
    try {
      const { data, error } = await sb.functions.invoke("extract-company-profile", { body: { consent: true, description: desc } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      description = desc; consented = true;
      state = suggestionsToEntries(data.suggestions);
      renderForm(root);
    } catch (e) {
      status.textContent = "Error: " + (e?.message ?? "extraction failed");
    }
  });
}
