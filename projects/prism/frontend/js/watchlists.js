// PRISM — watchlists.js (Phase 6)
// Real user watchlists: CRUD against the watchlists table (owner-only RLS),
// matched events per entry, and events linked via event_watchlists.

import { loadIntelligence, matchWatchlist } from "./data.js";
import { getClient } from "./supabase.js";
import { getSession } from "./auth.js";
import { eventListItem, emptyState, categoryChip } from "./components.js";
import { escapeHtml } from "./utils.js";
import { suggestWatchlists } from "./personalize.js";

const KINDS = ["country", "region", "commodity", "industry", "category"];

export async function init() {
  const root = document.getElementById("watchlists-root");
  if (!root) return;
  const session = await getSession();
  if (!session) return; // app.js gate handles redirect
  const sb = await getClient();
  const data = await loadIntelligence();

  const render = async () => {
    const { data: lists, error } = await sb.from("watchlists").select("*").order("created_at");
    if (error) { root.innerHTML = '<p class="state error">' + escapeHtml(error.message) + "</p>"; return; }
    const { data: links } = await sb.from("event_watchlists").select("watchlist_id, event_id");
    const linksByList = new Map();
    for (const l of links ?? []) {
      if (!linksByList.has(l.watchlist_id)) linksByList.set(l.watchlist_id, []);
      linksByList.get(l.watchlist_id).push(l.event_id);
    }


    // V2 Phase 5: watchlist suggestions from the company profile (owner RLS).
    let suggestions = [];
    const { data: prof } = await sb.from("company_profiles").select("id").eq("user_id", session.user.id).maybeSingle();
    if (prof) {
      const facts = {
        commodities: (await sb.from("company_commodities").select("commodity_slug, origin").eq("profile_id", prof.id)).data ?? [],
        countries: (await sb.from("company_countries").select("country_code, role, origin").eq("profile_id", prof.id)).data ?? [],
        industries: (await sb.from("company_industries").select("industry, origin").eq("profile_id", prof.id)).data ?? [],
      };
      suggestions = suggestWatchlists(facts, lists ?? []);
    }
    const ORIGIN_LABEL = { user_supplied: "you", ai_confirmed: "AI suggested", imported_verified: "verified import" };
    const suggestPanel = suggestions.length
      ? '<section class="panel"><h2>Suggested from your company profile</h2>' +
        '<p class="muted">Based on facts in your private profile. Adding one creates a normal private watchlist; nothing is created automatically.</p>' +
        suggestions.map((s, i) => '<div class="region-row"><span class="region-name">' + escapeHtml(s.name) + '</span><span class="chip">' + escapeHtml(s.kind + ": " + s.target) + '</span><span class="chip">' + escapeHtml(ORIGIN_LABEL[s.origin] ?? s.origin) + '</span><button class="nav-toggle wl-suggest" data-i="' + i + '" style="display:inline-block">Add</button></div>').join("") + '</section>'
      : "";

    const form =
      '<section class="panel"><h2>New watchlist</h2>' +
      '<div class="filter-bar">' +
        '<label class="filter-field"><span class="muted">Name</span><input id="wl-name" type="text" placeholder="e.g. Energy exposure" maxlength="80"></label>' +
        '<label class="filter-field"><span class="muted">Kind</span><select id="wl-kind">' + KINDS.map((k) => '<option value="' + k + '">' + k + "</option>").join("") + "</select></label>" +
        '<label class="filter-field grow"><span class="muted">Target (ISO country, region, commodity, industry or category)</span><input id="wl-target" type="text" placeholder="e.g. NO / Europe / crude-oil / shipping / sanctions" maxlength="80"></label>' +
        '<button id="wl-add" class="nav-toggle" style="display:inline-block">Add</button>' +
      "</div>" +
      '<p id="wl-status" class="muted" role="status"></p></section>';

    const cards = (lists ?? []).map((w) => {
      const matched = matchWatchlist(data.events, w);
      const linkedIds = linksByList.get(w.id) ?? [];
      const linked = data.events.filter((e) => linkedIds.includes(e.id));
      return '<section class="panel commodity-card">' +
        '<div class="feed-item-head"><h2>' + escapeHtml(w.name) + "</h2>" + categoryChip(w.kind) +
          '<span class="chip">' + escapeHtml(w.target) + "</span>" +
          '<button class="nav-toggle wl-delete" data-id="' + escapeHtml(w.id) + '" style="display:inline-block;margin-left:auto">Delete</button></div>' +
        '<h3>Matching events (' + matched.length + ")</h3>" +
        (matched.length ? matched.map(eventListItem).join("") : emptyState("No current events match this watchlist.")) +
        '<h3>Explicitly linked events (' + linked.length + ")</h3>" +
        (linked.length ? linked.map(eventListItem).join("") : emptyState("Link events from their detail pages.")) +
        "</section>";
    }).join("");

    root.innerHTML = form + suggestPanel + ((lists ?? []).length ? '<div class="commodity-grid">' + cards + "</div>" : emptyState("No watchlists yet \u2014 create one above."));

    const status = root.querySelector("#wl-status");
    root.querySelector("#wl-add").addEventListener("click", async () => {
      const name = root.querySelector("#wl-name").value.trim();
      const kind = root.querySelector("#wl-kind").value;
      const target = root.querySelector("#wl-target").value.trim();
      if (!name || !target) { status.textContent = "Name and target are required."; return; }
      const { error: insErr } = await sb.from("watchlists").insert({ user_id: session.user.id, name, kind, target });
      if (insErr) { status.textContent = insErr.code === "23505" ? "That watchlist already exists." : "Error: " + insErr.message; return; }
      await render();
    });

    for (const btn of root.querySelectorAll(".wl-suggest")) {
      btn.addEventListener("click", async () => {
        const s = suggestions[Number(btn.dataset.i)];
        const { error: insErr } = await sb.from("watchlists").insert({ user_id: session.user.id, name: s.name, kind: s.kind, target: s.target });
        if (insErr) { status.textContent = insErr.code === "23505" ? "That watchlist already exists." : "Error: " + insErr.message; return; }
        await render();
      });
    }
    for (const btn of root.querySelectorAll(".wl-delete")) {
      btn.addEventListener("click", async () => {
        const { error: delErr } = await sb.from("watchlists").delete().eq("id", btn.dataset.id);
        if (delErr) { status.textContent = "Error: " + delErr.message; return; }
        await render();
      });
    }
  };

  await render();
}
