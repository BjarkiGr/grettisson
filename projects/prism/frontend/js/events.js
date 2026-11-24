// PRISM — events.js (Phase 6: live data)
// Geopolitical events list with search and filters. filterEvents stays pure.

import { loadIntelligence } from "./data.js";
import { eventListItem, emptyState } from "./components.js";
import { debounce, escapeHtml, riskLevelFromScore } from "./utils.js";

/** Pure filter: query (title/summary), category, region, risk level. */
export function filterEvents(events, filters = {}) {
  const q = (filters.query ?? "").trim().toLowerCase();
  return events.filter((e) => {
    if (q && !(e.title + " " + (e.summary ?? "")).toLowerCase().includes(q)) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.region && e.region !== filters.region) return false;
    if (filters.level && riskLevelFromScore(e.overall_score) !== filters.level) return false;
    return true;
  });
}

function selectHtml(id, label, options) {
  const opts = ['<option value="">' + escapeHtml(label) + ": all</option>"]
    .concat(options.map((o) => '<option value="' + escapeHtml(o) + '">' + escapeHtml(String(o).replaceAll("_", " ")) + "</option>"));
  return '<label class="filter-field"><span class="muted">' + escapeHtml(label) + '</span>' +
    '<select id="' + id + '">' + opts.join("") + "</select></label>";
}

export async function init() {
  const controls = document.getElementById("events-controls");
  const list = document.getElementById("events-list");
  if (!controls || !list) return;
  const data = await loadIntelligence();

  const categories = [...new Set(data.events.map((e) => e.category))].sort();
  const regions = [...new Set(data.events.map((e) => e.region).filter(Boolean))].sort();
  const levels = ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"];
  controls.innerHTML =
    '<div class="filter-bar">' +
      '<label class="filter-field grow"><span class="muted">Search</span>' +
        '<input id="events-search" type="search" placeholder="Search events\u2026" autocomplete="off"></label>' +
      selectHtml("events-category", "Category", categories) +
      selectHtml("events-region", "Region", regions) +
      selectHtml("events-level", "Risk level", levels) +
    "</div>" +
    '<p id="events-count" class="muted" role="status"></p>';

  const count = controls.querySelector("#events-count");
  const render = () => {
    const filters = {
      query: controls.querySelector("#events-search").value,
      category: controls.querySelector("#events-category").value,
      region: controls.querySelector("#events-region").value,
      level: controls.querySelector("#events-level").value,
    };
    const rows = filterEvents(data.events, filters)
      .slice()
      .sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
    count.textContent = rows.length + " of " + data.events.length + " events";
    list.innerHTML = rows.length ? rows.map(eventListItem).join("") : emptyState("No events match the current filters.");
  };
  controls.querySelector("#events-search").addEventListener("input", debounce(render, 150));
  for (const id of ["events-category", "events-region", "events-level"]) {
    controls.querySelector("#" + id).addEventListener("change", render);
  }
  render();
}
