// PRISM V2 Phase 5 — pure personalization helpers.
// Deterministic, no AI. Suggestions become real data only on user action.

/** Pure: watchlist suggestions from confirmed company profile facts.
 *  Deduped against existing watchlists (kind+target, case-insensitive).
 *  Dependencies have no watchlist kind and are deliberately not suggested. */
export function suggestWatchlists(facts, existing) {
  const have = new Set((existing ?? []).map((w) => w.kind + ":" + String(w.target ?? "").trim().toLowerCase()));
  const out = [];
  const push = (kind, target, name, origin) => {
    const t = String(target ?? "").trim();
    const key = kind + ":" + t.toLowerCase();
    if (!t || have.has(key)) return;
    have.add(key);
    out.push({ name, kind, target: t, origin });
  };
  for (const c of facts.commodities ?? []) push("commodity", c.commodity_slug, "Commodity: " + c.commodity_slug, c.origin);
  for (const c of facts.countries ?? []) push("country", c.country_code, c.role + " country: " + c.country_code, c.origin);
  for (const i of facts.industries ?? []) push("industry", i.industry, "Industry: " + i.industry, i.origin);
  // V2.1: derived input commodities (deterministic map) + disruption categories.
  const RELATED_INPUTS = {
    "electrical-equipment": ["copper", "aluminium"], electronics: ["copper", "semiconductors"],
    construction: ["cement", "steel", "timber"], "building-materials": ["cement", "steel"],
    vehicles: ["steel", "aluminium"], machinery: ["steel", "copper"],
  };
  for (const c of facts.commodities ?? []) {
    for (const rel of RELATED_INPUTS[c.commodity_slug] ?? []) push("commodity", rel, "Related input: " + rel, c.origin);
  }
  if ((facts.countries ?? []).length) {
    push("category", "sanctions", "Disruption watch: sanctions", "user_supplied");
    push("category", "tariffs", "Disruption watch: tariffs", "user_supplied");
    push("category", "shipping_disruptions", "Disruption watch: shipping", "user_supplied");
  }
  return out.slice(0, 12);
}

/** Pure: which relevance items are new since the given seen ids. */
export function freshAlerts(items, seenIds) {
  const seen = new Set(seenIds ?? []);
  return (items ?? []).filter((it) => !seen.has(it.event_id));
}
