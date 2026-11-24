// PRISM — components.js
// Reusable render components. Every function returns an HTML string with
// ALL dynamic values escaped. Added in Phase 1 (justified structure addition:
// the spec requires reusable components but names no file for them).

import { escapeHtml, formatDate, formatDateTime, riskClass, riskLevelFromScore } from "./utils.js";

/** Persistent demonstration-data marker shown next to every demo item. */
export function demoBadge() {
  return '<span class="demo-badge" title="Fictional demonstration data">DEMO</span>';
}

/** Colored risk-level badge. Unknown levels render as a muted dash. */
export function riskBadge(level) {
  const cls = riskClass(level);
  if (!cls) return '<span class="muted">\u2014</span>';
  return '<span class="risk-badge ' + cls + '">' + escapeHtml(level) + "</span>";
}

/** Risk badge derived from a numeric 0-100 score. */
export function riskBadgeFromScore(score) {
  return riskBadge(riskLevelFromScore(score));
}

/** Small category chip. */
export function categoryChip(category) {
  const label = String(category ?? "").replaceAll("_", " ");
  return '<span class="chip">' + escapeHtml(label) + "</span>";
}

/** Dashboard statistic card. */
export function statCard(label, value, sub) {
  return '<div class="stat-card panel">' +
    '<div class="stat-label">' + escapeHtml(label) + "</div>" +
    '<div class="stat-value">' + escapeHtml(value) + "</div>" +
    (sub ? '<div class="stat-sub muted">' + escapeHtml(sub) + "</div>" : "") +
    "</div>";
}

export function loadingState(message = "Loading\u2026") {
  return '<p class="muted state" role="status">' + escapeHtml(message) + "</p>";
}

export function emptyState(message = "Nothing to display.") {
  return '<p class="muted state">' + escapeHtml(message) + "</p>";
}

export function errorState(message) {
  return '<p class="state error" role="alert">' + escapeHtml(message) + "</p>";
}

/** Compact event row used on the overview, events list and related lists. */
export function eventListItem(event) {
  const level = riskLevelFromScore(event.overall_score);
  return '<a class="event-row" href="event-detail.html?id=' + encodeURIComponent(event.id) + '">' +
    '<span class="event-row-main">' +
      '<span class="event-title">' + escapeHtml(event.title) + "</span>" +
      '<span class="event-meta muted">' + categoryChip(event.category) + " " +
        escapeHtml(event.region ?? "") + " \u00b7 " + escapeHtml(event.primary_country ?? "") +
        " \u00b7 updated " + formatDate(event.last_updated_at) + "</span>" +
    "</span>" +
    '<span class="event-row-side">' + (event.demo ? demoBadge() : "") + riskBadge(level) +
      '<span class="score">' + escapeHtml(event.overall_score ?? "\u2014") + "</span></span>" +
    "</a>";
}

/** Intelligence-feed article item. Source/event names are looked up by caller. */
export function articleItem(article, sourceName, linkedEvent) {
  const level = linkedEvent ? riskLevelFromScore(linkedEvent.overall_score) : null;
  const countries = (article.countries ?? []).join(", ");
  return '<article class="feed-item">' +
    '<div class="feed-item-head">' +
      '<span class="feed-title">' + escapeHtml(article.title) + "</span>" + (article.demo ? demoBadge() : "") +
    "</div>" +
    '<div class="feed-meta muted">' +
      '<span>' + escapeHtml(sourceName ?? "Unknown source") + "</span>" +
      '<span>' + formatDateTime(article.published_at) + "</span>" +
      (article.category ? categoryChip(article.category) : "") +
      (countries ? '<span>' + escapeHtml(countries) + "</span>" : "") +
      riskBadge(level) +
      '<span class="chip">' + escapeHtml(article.processing_status) + "</span>" +
    "</div>" +
    (article.content ? '<p class="feed-excerpt">' + escapeHtml(article.content) + "</p>" : "") +
    '<div class="feed-links">' +
      (linkedEvent
        ? '<a href="event-detail.html?id=' + encodeURIComponent(linkedEvent.id) + '">View event assessment</a>'
        : '<span class="muted">No linked event</span>') +
      '<a href="' + escapeHtml(article.url) + '" rel="noopener noreferrer" target="_blank">Original source</a>' +
    "</div>" +
    "</article>";
}

/** Labeled horizontal 0-5 dimension bar for the risk breakdown. */
export function dimensionBar(label, value) {
  const v = Number(value);
  const pct = Number.isFinite(v) ? Math.max(0, Math.min(100, (v / 5) * 100)) : 0;
  return '<div class="dim-row">' +
    '<span class="dim-label">' + escapeHtml(label) + "</span>" +
    '<span class="dim-track"><span class="dim-fill" style="width:' + pct + '%"></span></span>' +
    '<span class="dim-value">' + escapeHtml(value) + "/5</span>" +
    "</div>";
}

/** Simple two-column table with escaped cells. rows: array of arrays. */
export function simpleTable(headers, rows) {
  if (!rows.length) return emptyState("No rows.");
  const head = headers.map((h) => "<th>" + escapeHtml(h) + "</th>").join("");
  const body = rows.map((r) =>
    "<tr>" + r.map((c) => "<td>" + escapeHtml(c) + "</td>").join("") + "</tr>"
  ).join("");
  return '<table class="data-table"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
}
