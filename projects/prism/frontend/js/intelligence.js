// PRISM — intelligence.js (Phase 6: live data)
// Intelligence feed with search and filters. filterArticles stays pure.

import { articleItem, emptyState } from "./components.js";
import { debounce, escapeHtml, riskLevelFromScore } from "./utils.js";

/** Pure filter: query (title/content), category, processing status, risk level. */
export function filterArticles(articles, filters = {}, events = []) {
  const q = (filters.query ?? "").trim().toLowerCase();
  const byId = new Map(events.map((e) => [e.id, e]));
  return articles.filter((a) => {
    if (q && !(a.title + " " + (a.content ?? "")).toLowerCase().includes(q)) return false;
    if (filters.category && a.category !== filters.category) return false;
    if (filters.status && a.processing_status !== filters.status) return false;
    if (filters.level) {
      const ev = byId.get(a.event_id);
      if (!ev || riskLevelFromScore(ev.overall_score) !== filters.level) return false;
    }
    return true;
  });
}

function selectHtml(id, label, options) {
  const opts = ['<option value="">' + escapeHtml(label) + ": all</option>"]
    .concat(options.map((o) => '<option value="' + escapeHtml(o) + '">' + escapeHtml(String(o).replaceAll("_", " ")) + "</option>"));
  return '<label class="filter-field"><span class="muted">' + escapeHtml(label) + '</span>' +
    '<select id="' + id + '">' + opts.join("") + "</select></label>";
}

/** Renders the feed into root using live data from data.js. */
export function initFeed(root, data) {
  const categories = [...new Set(data.articles.map((a) => a.category).filter(Boolean))].sort();
  const statuses = [...new Set(data.articles.map((a) => a.processing_status))].sort();
  const levels = ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"];
  root.innerHTML =
    '<div class="filter-bar">' +
      '<label class="filter-field grow"><span class="muted">Search</span>' +
        '<input id="feed-search" type="search" placeholder="Search titles and excerpts\u2026" autocomplete="off"></label>' +
      selectHtml("feed-category", "Classification", categories) +
      selectHtml("feed-status", "Analysis status", statuses) +
      selectHtml("feed-level", "Risk level", levels) +
    "</div>" +
    '<p id="feed-count" class="muted" role="status"></p>' +
    '<div id="feed-list"></div>';

  const list = root.querySelector("#feed-list");
  const count = root.querySelector("#feed-count");
  const render = () => {
    const filters = {
      query: root.querySelector("#feed-search").value,
      category: root.querySelector("#feed-category").value,
      status: root.querySelector("#feed-status").value,
      level: root.querySelector("#feed-level").value,
    };
    const rows = filterArticles(data.articles, filters, data.events)
      .slice()
      .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
    count.textContent = rows.length + " of " + data.articles.length + " articles";
    list.innerHTML = rows.length
      ? rows.map((a) => articleItem(a, a.source_name, data.eventById.get(a.event_id))).join("")
      : emptyState("No articles match the current filters.");
  };
  root.querySelector("#feed-search").addEventListener("input", debounce(render, 150));
  for (const id of ["feed-category", "feed-status", "feed-level"]) {
    root.querySelector("#" + id).addEventListener("change", render);
  }
  render();
}
