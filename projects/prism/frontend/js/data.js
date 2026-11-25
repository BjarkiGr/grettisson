// PRISM — data.js (Phase 6)
// Live intelligence access layer. Fetches from Supabase under the signed-in
// administrator's session (RLS enforced) and composes view models for the
// pages. Composition helpers are pure and unit-tested. No demo data here.

import { getClient } from "./supabase.js";

/** Persisted region focus: "global" (default) or "iceland". */
export function getStoredRegion() {
  try {
    return globalThis.localStorage?.getItem("prism-region") === "iceland" ? "iceland" : "global";
  } catch {
    return "global";
  }
}

/**
 * Pure region filter. Iceland focus = events involving IS (primary or
 * listed country) + articles linked to those events or published by
 * Icelandic sources. Global returns the data unchanged.
 */
export function applyRegion(data, region) {
  if (region !== "iceland") return data;
  const events = data.events.filter((e) => e.primary_country === "IS" || (e.countries ?? []).includes("IS"));
  const ids = new Set(events.map((e) => e.id));
  const isSources = new Set(data.sources.filter((s) => s.country === "IS").map((s) => s.id));
  const articles = data.articles.filter((a) => (a.event_id && ids.has(a.event_id)) || isSources.has(a.source_id));
  return { ...data, events, articles, eventById: new Map(events.map((e) => [e.id, e])) };
}
/** Fetches all intelligence tables in parallel and composes view models. */
export async function loadIntelligence(region = getStoredRegion()) {
  const sb = await getClient();
  const [ev, rs, an, art, ea, src] = await Promise.all([
    sb.from("events").select("*").order("last_updated_at", { ascending: false }).limit(300),
    sb.from("risk_scores").select("*").order("created_at", { ascending: true }).limit(1000),
    sb.from("analyses").select("event_id, analysis_json, confidence, provider, model, prompt_version, created_at").order("created_at", { ascending: true }).limit(300),
    sb.from("articles").select("id, source_id, title, url, author, published_at, collected_at, content, processing_status").order("published_at", { ascending: false }).limit(300),
    sb.from("event_articles").select("event_id, article_id").limit(2000),
    sb.from("sources").select("*").order("name").limit(100),
  ]);
  for (const [name, res] of [["events", ev], ["risk_scores", rs], ["analyses", an], ["articles", art], ["event_articles", ea], ["sources", src]]) {
    if (res.error) throw new Error(name + " query failed: " + res.error.message);
  }
  return applyRegion(composeIntelligence({
    events: ev.data ?? [], riskScores: rs.data ?? [], analyses: an.data ?? [],
    articles: art.data ?? [], eventArticles: ea.data ?? [], sources: src.data ?? [],
  }), region);
}

/** Pure composition: joins scores/analyses/articles onto events. */
export function composeIntelligence({ events, riskScores, analyses, articles, eventArticles, sources }) {
  const risksByEvent = new Map();
  for (const r of riskScores) {
    if (!risksByEvent.has(r.event_id)) risksByEvent.set(r.event_id, []);
    risksByEvent.get(r.event_id).push(r);
  }
  const analysisByEvent = new Map();
  for (const a of analyses) analysisByEvent.set(a.event_id, a); // asc order: last wins
  const articleIdsByEvent = new Map();
  const eventByArticle = new Map();
  for (const l of eventArticles) {
    if (!articleIdsByEvent.has(l.event_id)) articleIdsByEvent.set(l.event_id, []);
    articleIdsByEvent.get(l.event_id).push(l.article_id);
    eventByArticle.set(l.article_id, l.event_id);
  }
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const viewEvents = events.map((e) => {
    const risks = risksByEvent.get(e.id) ?? [];
    const latest = risks.length ? risks[risks.length - 1] : null;
    const an = analysisByEvent.get(e.id) ?? null;
    const aj = an?.analysis_json ?? {};
    return {
      ...e,
      demo: false,
      overall_score: latest ? (latest.scoring_version === "2.0.0" && latest.likelihood_level === "insufficient_evidence" ? null : latest.overall_score) : null,
      unrated: Boolean(latest && latest.scoring_version === "2.0.0" && latest.likelihood_level === "insufficient_evidence"),
      scoring_version: latest?.scoring_version ?? null,
      likelihood_level: latest?.likelihood_level ?? null,
      confidence_level: latest?.confidence_level ?? null,
      impact_index: latest?.impact_index ?? null,
      ongoing: Boolean(latest?.ongoing),
      horizon_days: latest?.likelihood_horizon_days ?? null,
      dimensions: latest ? (latest.scoring_version === "2.0.0" ? {
        escalation: latest.escalation_score, economic: latest.economic_impact_score,
        supply_chain: latest.supply_chain_disruption_score, geographic: latest.geographic_reach_score,
        strategic: latest.strategic_importance_score, persistence: latest.persistence_score,
      } : {
        severity: latest.severity_score, probability: latest.probability_score,
        geographic: latest.geographic_score, duration: latest.duration_score,
        supply_chain: latest.supply_chain_score, economic: latest.economic_score,
      }) : null,
      explanation: latest ? latest.explanation : null,
      confidence: latest?.confidence ?? an?.confidence ?? null,
      history: risks.map((r) => ({ date: r.created_at, overall_score: r.scoring_version === "2.0.0" && r.likelihood_level === "insufficient_evidence" ? null : r.overall_score })),
      analysis: an,
      countries: Array.isArray(aj.countries_involved) && aj.countries_involved.length ? aj.countries_involved : (e.primary_country ? [e.primary_country] : []),
      commodities: aj.commodities_affected ?? [],
      industries: aj.industries_affected ?? [],
      organizations: aj.organizations ?? [],
      supply_chain_implications: aj.supply_chain_implications ?? "",
      economic_consequences: aj.economic_consequences ?? "",
      escalation_scenarios: aj.escalation_scenarios ?? [],
      uncertainties: aj.uncertainties ?? [],
      article_ids: articleIdsByEvent.get(e.id) ?? [],
    };
  });
  const eventById = new Map(viewEvents.map((e) => [e.id, e]));

  const viewArticles = articles.map((a) => {
    const eventId = eventByArticle.get(a.id) ?? null;
    const linked = eventId ? eventById.get(eventId) : null;
    return {
      ...a,
      demo: false,
      source_name: sourceById.get(a.source_id)?.name ?? "Unknown source",
      event_id: eventId,
      category: linked?.category ?? null,
      countries: linked?.countries ?? [],
    };
  });

  return { events: viewEvents, articles: viewArticles, sources, eventById };
}

/** ISO-week key (UTC) for activity bucketing. */
export function weekKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** Derives the last-8-weeks activity series from real timestamps. */
export function weeklyActivity(articles, events, now = new Date()) {
  const labels = [];
  const base = new Date(now);
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  for (let i = 7; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i * 7);
    labels.push(d.toISOString().slice(0, 10));
  }
  const idx = new Map(labels.map((l, i) => [l, i]));
  const newEvents = new Array(labels.length).fill(0);
  const collected = new Array(labels.length).fill(0);
  for (const e of events) {
    const k = weekKey(e.first_detected_at);
    if (k !== null && idx.has(k)) newEvents[idx.get(k)]++;
  }
  for (const a of articles) {
    const k = weekKey(a.collected_at ?? a.published_at);
    if (k !== null && idx.has(k)) collected[idx.get(k)]++;
  }
  return { labels, new_events: newEvents, articles_collected: collected };
}

/** Pure watchlist matcher: which events does a watchlist entry monitor? */
export function matchWatchlist(events, entry) {
  const t = String(entry.target ?? "").trim();
  if (!t) return [];
  switch (entry.kind) {
    case "country": return events.filter((e) => e.primary_country === t.toUpperCase() || (e.countries ?? []).includes(t.toUpperCase()));
    case "region": return events.filter((e) => e.region === t);
    case "commodity": return events.filter((e) => (e.commodities ?? []).includes(t.toLowerCase()));
    case "industry": return events.filter((e) => (e.industries ?? []).includes(t.toLowerCase()));
    case "category": return events.filter((e) => e.category === t.toLowerCase().replaceAll(" ", "_"));
    default: return [];
  }
}

/** Related events: shared category or country, excluding self, top 4. */
export function relatedEvents(event, all) {
  return all
    .filter((e) => e.id !== event.id && (e.category === event.category || (e.countries ?? []).some((c) => (event.countries ?? []).includes(c))))
    .sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1))
    .slice(0, 4);
}

/** Commodity index derived from real analyses: id -> linked events. */
export function commodityIndex(events) {
  const map = new Map();
  for (const e of events) {
    for (const c of e.commodities ?? []) {
      const key = String(c).toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
  }
  return [...map.entries()]
    .map(([id, evts]) => ({ id, name: id.replaceAll("-", " "), events: evts.sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1)) }))
    .sort((a, b) => b.events.length - a.events.length);
}

/** Regional trend series from real score history (per-region averages). */
export function regionTrends(events, regions) {
  const points = new Map();
  for (const e of events) {
    if (!regions.includes(e.region)) continue;
    for (const h of e.history ?? []) {
      const k = weekKey(h.date);
      if (!k) continue;
      if (!points.has(k)) points.set(k, new Map());
      const byRegion = points.get(k);
      if (!byRegion.has(e.region)) byRegion.set(e.region, []);
      byRegion.get(e.region).push(h.overall_score);
    }
  }
  const labels = [...points.keys()].sort();
  const series = regions.map((region) => ({
    region,
    values: labels.map((l) => {
      const vals = points.get(l)?.get(region);
      return vals && vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    }),
  }));
  return { labels, series };
}