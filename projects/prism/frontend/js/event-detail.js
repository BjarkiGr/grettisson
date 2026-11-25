// PRISM — event-detail.js (Phase 6: live data)
// Real event summary, AI assessment with provenance, transparent risk
// breakdown, score history, supporting articles, related events and
// watchlist linking. Unscored/unanalyzed events render honest empty states.

import { loadIntelligence, relatedEvents } from "./data.js";
import { getClient } from "./supabase.js";
import { articleItem, categoryChip, dimensionBar, emptyState, eventListItem, riskBadgeFromScore } from "./components.js";
import { renderChart, lineConfig } from "./charts.js";
import { escapeHtml, formatDate, formatDateTime, getQueryParam, riskLevelFromScore } from "./utils.js";

const DIMENSION_LABELS = {
  severity: "Severity", probability: "Probability (estimate)", geographic: "Geographic reach",
  duration: "Expected duration", supply_chain: "Supply-chain exposure", economic: "Economic impact",
};
const DIMENSION_LABELS_V2 = {
  escalation: "Escalation potential", economic: "Economic impact", supply_chain: "Supply-chain disruption",
  geographic: "Geographic reach", strategic: "Strategic importance", persistence: "Persistence",
};

function listHtml(items) {
  return items && items.length
    ? "<ul>" + items.map((i) => "<li>" + escapeHtml(i) + "</li>").join("") + "</ul>"
    : emptyState("None recorded.");
}

function renderDetail(root, event, data) {
  const level = riskLevelFromScore(event.overall_score);
  const articles = data.articles.filter((a) => event.article_ids.includes(a.id));
  const related = relatedEvents(event, data.events);
  const labels = event.scoring_version === "2.0.0" ? DIMENSION_LABELS_V2 : DIMENSION_LABELS;
  const dims = event.dimensions
    ? Object.entries(labels).map(([key, label]) => dimensionBar(label, event.dimensions[key])).join("")
    : emptyState("Not yet scored \u2014 the risk pipeline will score this event.");
  const an = event.analysis;
  const aj = an?.analysis_json;
  const timeline = [
    { date: event.first_detected_at, label: "Event first detected" },
    ...articles.map((a) => ({ date: a.published_at, label: "Report: " + a.title })),
    { date: event.last_updated_at, label: "Last updated" },
  ].filter((t) => t.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  root.innerHTML =
    '<div class="page-head">' +
      '<p><a href="events.html">\u2190 All events</a></p>' +
      '<h1>' + escapeHtml(event.title) + "</h1>" +
      '<div class="detail-meta">' + riskBadgeFromScore(event.overall_score) + categoryChip(event.category) +
        '<span class="chip">' + escapeHtml(event.status) + "</span>" +
        '<span class="muted">' + escapeHtml(event.region ?? "") + " \u00b7 " + escapeHtml((event.countries ?? []).join(", ")) + "</span>" +
      "</div>" +
      '<p class="muted">First detected ' + formatDateTime(event.first_detected_at) + " \u00b7 last updated " + formatDateTime(event.last_updated_at) + "</p>" +
      '<div id="watch-link" class="filter-bar"></div>' +
    "</div>" +
    '<div class="detail-grid">' +
      '<section class="panel"><h2>Summary</h2><p>' + escapeHtml(event.summary ?? "No summary yet.") + "</p>" +
        '<h3>Organizations</h3>' + listHtml(event.organizations) +
        '<h3>Industries affected</h3>' + listHtml(event.industries) +
        '<h3>Commodities affected</h3>' + listHtml(event.commodities) + "</section>" +
      '<section class="panel"><h2>Risk assessment' + (event.scoring_version ? ' <span class="chip">v' + escapeHtml(event.scoring_version) + '</span>' : '') + '</h2>' +
        (event.unrated
          ? '<div class="overall-score">UNRATED<span class="muted">insufficient evidence</span></div>' +
            '<p class="muted">Heuristic impact index: ' + escapeHtml(event.impact_index ?? "\u2014") + '/100. No likelihood estimate is possible from the available evidence.</p>' + dims
          : event.overall_score !== null
          ? '<div class="overall-score">' + escapeHtml(event.overall_score) + '<span class="muted">/100 \u00b7 ' + escapeHtml(level) + ' \u00b7 heuristic index</span></div>' +
            (event.scoring_version === "2.0.0"
              ? '<p>' + (event.likelihood_level ? '<span class="chip">Likelihood: ' + escapeHtml(event.likelihood_level.replaceAll("_", " ")) + (event.ongoing ? " (ongoing)" : "") + '</span> ' : '') +
                (event.confidence_level ? '<span class="chip">Confidence: ' + escapeHtml(event.confidence_level) + '</span> ' : '') +
                (event.horizon_days ? '<span class="chip">Horizon: ' + escapeHtml(event.horizon_days) + ' days</span>' : '') + '</p>' +
                '<p class="muted">Impact index: ' + escapeHtml(event.impact_index ?? "\u2014") + '/100. Likelihood and confidence are separate from impact.</p>'
              : '<p class="muted">Confidence: ' + (event.confidence != null ? Math.round(event.confidence * 100) + "%" : "\u2014") + " \u2014 legacy V1 assessment.</p>") +
            dims + '<p class="muted">' + escapeHtml(event.explanation ?? "") + "</p>"
          : dims) +
        '<p class="muted">Methodology: docs/RISK-METHODOLOGY' + (event.scoring_version === "2.0.0" ? "-V2" : "") + '.md.</p></section>' +
      '<section class="panel"><h2>AI assessment</h2>' +
        (aj
          ? '<p class="muted">Provider: ' + escapeHtml(an.provider) + " \u00b7 model: " + escapeHtml(an.model) + " \u00b7 prompt: " + escapeHtml(an.prompt_version) + " \u00b7 " + formatDateTime(an.created_at) + "</p>" +
            '<p>' + escapeHtml(aj.executive_summary) + "</p>" +
            '<h3>Supply-chain implications</h3><p>' + escapeHtml(aj.supply_chain_implications) + "</p>" +
            '<h3>Economic consequences</h3><p>' + escapeHtml(aj.economic_consequences) + "</p>" +
            '<h3>Escalation scenarios (speculative)</h3>' + listHtml(aj.escalation_scenarios) +
            '<h3>Uncertainties</h3>' + listHtml(aj.uncertainties) +
            '<h3>Evidence</h3>' + listHtml((aj.supporting_evidence ?? []).map((e) => "[" + e.kind + "] " + e.claim))
          : emptyState("Not yet analyzed \u2014 the AI pipeline will assess this event.")) + "</section>" +
      '<section class="panel"><h2>Timeline</h2><ol class="timeline">' +
        timeline.map((t) => '<li><span class="timeline-date">' + formatDate(t.date) + "</span><span>" + escapeHtml(t.label) + "</span></li>").join("") +
        "</ol>" +
        '<h2>Score history</h2>' +
        (event.history.length ? '<div class="chart-box"><canvas id="history-chart"></canvas></div>' : emptyState("No score history yet.")) + "</section>" +
      '<section class="panel"><h2>Supporting articles (' + articles.length + ")</h2>" +
        (articles.length ? articles.map((a) => articleItem(a, a.source_name, event)).join("") : emptyState("No supporting articles.")) + "</section>" +
      '<section class="panel"><h2>Related events</h2>' +
        (related.length ? related.map(eventListItem).join("") : emptyState("No related events.")) + "</section>" +
    "</div>";

  const canvas = document.getElementById("history-chart");
  if (canvas && event.history.length) {
    renderChart(canvas, lineConfig(
      event.history.map((h) => formatDate(h.date)),
      [{ label: "Overall score", data: event.history.map((h) => h.overall_score), borderColor: "#4f8cff", backgroundColor: "#4f8cff" }],
      { yScale: { max: 100 } }
    ));
  }
}

async function initWatchLink(event) {
  const slot = document.getElementById("watch-link");
  if (!slot) return;
  try {
    const sb = await getClient();
    const { data: lists, error } = await sb.from("watchlists").select("id, name, kind, target").order("created_at");
    if (error) throw error;
    if (!lists || !lists.length) {
      slot.innerHTML = '<span class="muted">No watchlists yet \u2014 <a href="watchlists.html">create one</a> to monitor this event.</span>';
      return;
    }
    slot.innerHTML =
      '<label class="filter-field"><span class="muted">Add to watchlist</span>' +
      '<select id="watch-select">' + lists.map((w) => '<option value="' + escapeHtml(w.id) + '">' + escapeHtml(w.name + " (" + w.kind + ": " + w.target + ")") + "</option>").join("") + "</select></label>" +
      '<button id="watch-link-btn" class="nav-toggle" style="display:inline-block">Link event</button>' +
      '<span id="watch-link-status" class="muted" role="status"></span>';
    slot.querySelector("#watch-link-btn").addEventListener("click", async () => {
      const status = slot.querySelector("#watch-link-status");
      const { error: insErr } = await sb.from("event_watchlists").insert({ watchlist_id: slot.querySelector("#watch-select").value, event_id: event.id });
      status.textContent = insErr ? (insErr.code === "23505" ? "Already linked." : "Error: " + insErr.message) : "Linked.";
    });
  } catch (err) {
    slot.innerHTML = '<span class="muted">Watchlist linking unavailable: ' + escapeHtml(err?.message ?? "error") + "</span>";
  }
}

export async function init() {
  const root = document.getElementById("event-detail-root");
  if (!root) return;
  const id = getQueryParam("id");
  if (!id) {
    root.innerHTML = emptyState("No event selected.") + '<p><a href="events.html">Browse all events</a></p>';
    return;
  }
  const data = await loadIntelligence("global"); // direct links work regardless of region focus
  const event = data.eventById.get(id);
  if (!event) {
    root.innerHTML = emptyState("Event not found.") + '<p><a href="events.html">Browse all events</a></p>';
    return;
  }
  renderDetail(root, event, data);
  await initWatchLink(event);
}