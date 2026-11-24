// PRISM — dashboard.js (Phase 6: live data)
// Overview dashboard driven by real Supabase intelligence.

import { loadIntelligence, weeklyActivity, commodityIndex } from "./data.js";
import { aggregateByRegion } from "./regions.js";
import { initFeed } from "./intelligence.js";
import { statCard, eventListItem, simpleTable, emptyState, riskBadgeFromScore, loadingState } from "./components.js";
import { renderChart, lineConfig, barConfig, doughnutConfig } from "./charts.js";
import { escapeHtml, riskLevelFromScore, formatDateTime, RISK_COLORS } from "./utils.js";

const COMMODITY_PALETTE = ["#4f8cff", "#d9a441", "#3a8f5d", "#c94f4f", "#8aa84f", "#d97b29", "#8b98ab", "#d9a441"];

function renderStats(data) {
  const el = document.getElementById("stat-grid");
  if (!el) return;
  const scored = data.events.filter((e) => e.overall_score !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, e) => a + e.overall_score, 0) / scored.length) : null;
  const elevated = scored.filter((e) => e.overall_score >= 60).length;
  const analyzed = data.events.filter((e) => e.analysis).length;
  el.innerHTML =
    statCard("Tracked events", data.events.length, analyzed + " analyzed") +
    statCard("High / critical", elevated, "score 60 or above") +
    statCard("Average risk score", avg === null ? "\u2014" : avg + "/100", avg === null ? "no scores yet" : riskLevelFromScore(avg)) +
    statCard("Active sources", data.sources.filter((s) => s.active).length, data.sources.length + " registered") +
    statCard("Articles collected", data.articles.length, data.articles.filter((a) => a.processing_status === "analyzed" || a.processing_status === "classified").length + " relevant");
}

function renderTopEvents(data) {
  const el = document.getElementById("critical-events");
  if (!el) return;
  const top = data.events.slice().sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1)).slice(0, 5);
  el.innerHTML = top.length ? top.map(eventListItem).join("") : emptyState("No events yet \u2014 run ingestion.");
}

function renderRiskChanges(data) {
  const el = document.getElementById("risk-changes");
  if (!el) return;
  const changes = data.events
    .filter((e) => e.history.length >= 2)
    .map((e) => ({ event: e, delta: e.overall_score - e.history[e.history.length - 2].overall_score }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  el.innerHTML = changes.length
    ? changes.map(({ event, delta }) =>
        '<div class="change-row">' +
          '<a href="event-detail.html?id=' + encodeURIComponent(event.id) + '">' + escapeHtml(event.title) + "</a>" +
          '<span class="change-delta ' + (delta > 0 ? "up" : delta < 0 ? "down" : "flat") + '">' + (delta > 0 ? "+" : "") + delta + "</span>" +
          riskBadgeFromScore(event.overall_score) +
        "</div>").join("")
    : emptyState("No score changes yet \u2014 history accumulates as events are re-scored.");
}

function renderSourceActivity(data) {
  const el = document.getElementById("source-activity");
  if (!el) return;
  const rows = data.sources.map((s) => [
    s.name, s.source_type,
    data.articles.filter((a) => a.source_id === s.id).length,
    s.active ? "active" : "inactive",
    formatDateTime(s.last_checked_at),
  ]);
  el.innerHTML = simpleTable(["Source", "Type", "Articles", "Status", "Last checked"], rows);
}

function renderSupplyChains(data) {
  const el = document.getElementById("supply-chain-root");
  if (!el) return;
  const exposed = data.events
    .filter((e) => e.dimensions && e.dimensions.supply_chain >= 3 && e.supply_chain_implications)
    .sort((a, b) => b.dimensions.supply_chain - a.dimensions.supply_chain);
  el.innerHTML = '<p><a href="supply-chains.html">Open the Supply Chain Map \u2192</a></p>' + (exposed.length
    ? exposed.map((e) =>
        '<div class="feed-item">' +
          '<div class="feed-item-head"><a class="feed-title" href="event-detail.html?id=' + encodeURIComponent(e.id) + '">' + escapeHtml(e.title) + "</a>" + riskBadgeFromScore(e.overall_score) + "</div>" +
          '<p class="feed-excerpt">' + escapeHtml(e.supply_chain_implications) + "</p>" +
        "</div>").join("")
    : emptyState("No significant supply-chain exposure in the current intelligence."));
}

function renderCharts(data) {
  const regionAgg = aggregateByRegion(data.events.filter((e) => e.overall_score !== null));
  const regionCanvas = document.getElementById("region-chart");
  if (regionCanvas) {
    renderChart(regionCanvas, barConfig(
      regionAgg.map((r) => r.region),
      [{ label: "Average risk score", data: regionAgg.map((r) => r.avgScore), backgroundColor: regionAgg.map((r) => RISK_COLORS[r.level]) }],
      { plugins: { legend: { display: false } }, yScale: { max: 100 } }
    ));
  }
  const activityCanvas = document.getElementById("activity-chart");
  if (activityCanvas) {
    const activity = weeklyActivity(data.articles, data.events);
    renderChart(activityCanvas, lineConfig(activity.labels, [
      { label: "New events", data: activity.new_events, borderColor: "#4f8cff", backgroundColor: "#4f8cff" },
      { label: "Articles collected", data: activity.articles_collected, borderColor: "#8aa84f", backgroundColor: "#8aa84f" },
    ]));
  }
  const commodityCanvas = document.getElementById("commodity-chart");
  if (commodityCanvas) {
    const idx = commodityIndex(data.events).slice(0, 8);
    renderChart(commodityCanvas, doughnutConfig(idx.map((c) => c.name), idx.map((c) => c.events.length), COMMODITY_PALETTE));
  }
}

export async function init() {
  const data = await loadIntelligence();
  renderStats(data);
  renderTopEvents(data);
  renderRiskChanges(data);
  renderSourceActivity(data);
  renderSupplyChains(data);
  const feedRoot = document.getElementById("feed-root");
  if (feedRoot) initFeed(feedRoot, data);
  renderCharts(data);
}
