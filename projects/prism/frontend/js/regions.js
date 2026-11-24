// PRISM — regions.js (Phase 6: live data)
// Leaflet world map, regional summaries and score-history trends from real
// intelligence. aggregateByRegion stays pure and skips unscored events.

import { loadIntelligence, regionTrends } from "./data.js";
import { COUNTRY_COORDS } from "./geo.js";
import { renderRiskMap } from "./map.js";
import { renderChart, lineConfig } from "./charts.js";
import { riskBadge, emptyState } from "./components.js";
import { escapeHtml, riskLevelFromScore } from "./utils.js";

/** Pure aggregation: count, average/max score, level per region. */
export function aggregateByRegion(events) {
  const groups = new Map();
  for (const e of events) {
    if (e.overall_score === null || e.overall_score === undefined) continue;
    const key = e.region ?? "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()].map(([region, list]) => {
    const scores = list.map((e) => e.overall_score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const maxScore = Math.max(...scores);
    return { region, count: list.length, avgScore, maxScore, level: riskLevelFromScore(maxScore) };
  }).sort((a, b) => b.maxScore - a.maxScore);
}

export async function init() {
  const data = await loadIntelligence();
  const scored = data.events.filter((e) => e.overall_score !== null);

  const summaries = document.getElementById("region-summaries");
  if (summaries) {
    const agg = aggregateByRegion(scored);
    summaries.innerHTML = agg.length
      ? agg.map((r) =>
          '<div class="region-row">' +
            '<span class="region-name">' + escapeHtml(r.region) + "</span>" +
            '<span class="muted">' + r.count + " event" + (r.count === 1 ? "" : "s") + " \u00b7 avg " + r.avgScore + " \u00b7 max " + r.maxScore + "</span>" +
            riskBadge(r.level) +
          "</div>").join("")
      : emptyState("No scored events yet.");
  }

  const container = document.getElementById("risk-map");
  if (container) {
    const points = scored
      .filter((e) => COUNTRY_COORDS[e.primary_country])
      .map((e) => {
        const [lat, lng] = COUNTRY_COORDS[e.primary_country];
        return { lat, lng, title: e.title, level: riskLevelFromScore(e.overall_score), score: e.overall_score, count: scored.filter((x) => x.primary_country === e.primary_country).length };
      });
    if (points.length) renderRiskMap(container, points);
    else container.innerHTML = emptyState("No scored events to plot yet.");
  }

  const canvas = document.getElementById("region-trend-chart");
  if (canvas) {
    const topRegions = aggregateByRegion(scored).slice(0, 3).map((r) => r.region);
    const trends = regionTrends(scored, topRegions);
    if (trends.labels.length) {
      const colors = ["#c94f4f", "#4f8cff", "#d9a441"];
      renderChart(canvas, lineConfig(trends.labels, trends.series.map((s, i) => ({
        label: s.region, data: s.values, borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length], spanGaps: true,
      })), { yScale: { max: 100 } }));
    } else {
      canvas.closest(".chart-box").innerHTML = emptyState("Trends appear as score history accumulates.");
    }
  }
}
