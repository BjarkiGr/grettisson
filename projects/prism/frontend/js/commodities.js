// PRISM — commodities.js (Phase 6: live data)
// Commodity intelligence derived from real AI analyses. NO market prices
// are shown or fabricated (spec section 14).

import { loadIntelligence, commodityIndex } from "./data.js";
import { eventListItem, emptyState, riskBadgeFromScore } from "./components.js";
import { escapeHtml } from "./utils.js";

function commodityCard(entry) {
  const worst = entry.events[0] ?? null;
  return '<section class="panel commodity-card">' +
    '<div class="feed-item-head"><h2>' + escapeHtml(entry.name) + "</h2>" + (worst ? riskBadgeFromScore(worst.overall_score) : "") + "</div>" +
    '<p class="muted">' + entry.events.length + " linked development(s) from current intelligence. No market prices are displayed \u2014 PRISM does not fabricate prices.</p>" +
    '<h3>Related developments</h3>' +
    (entry.events.length ? entry.events.map(eventListItem).join("") : emptyState("No linked developments.")) +
    (worst && worst.supply_chain_implications ? '<h3>Potential disruption</h3><p class="feed-excerpt">' + escapeHtml(worst.supply_chain_implications) + "</p>" : "") +
    "</section>";
}

export async function init() {
  const root = document.getElementById("commodities-root");
  if (!root) return;
  const data = await loadIntelligence();
  const idx = commodityIndex(data.events);
  root.innerHTML = idx.length
    ? '<div class="commodity-grid">' + idx.map(commodityCard).join("") + "</div>"
    : emptyState("No commodities referenced in current analyses yet.");
}
