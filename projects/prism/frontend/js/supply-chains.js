// PRISM — supply-chains.js
// Supply Chain Map: reference trade corridors with animated flow lines,
// destination selection, and disruption overlays from REAL PRISM events.
// Corridors are illustrative reference geography, not live tracking.

import { loadIntelligence, getStoredRegion } from "./data.js";
import { loadLeaflet } from "./map.js";
import { CORRIDORS, CHOKEPOINTS, COUNTRY_NAMES, corridorsForDestination, disruptionsForCorridor, corridorRisk, destinationCountries } from "./routes.js";
import { eventListItem, emptyState, riskBadge, riskBadgeFromScore } from "./components.js";
import { escapeHtml, riskLevelFromScore, RISK_COLORS } from "./utils.js";

const NEUTRAL = "#4f8cff";
let map = null;
let layerGroup = null;

function corridorColor(risk) {
  if (risk.max === null) return NEUTRAL;
  return RISK_COLORS[riskLevelFromScore(risk.max)] ?? NEUTRAL;
}

async function drawCorridors(events, destination) {
  const L = await loadLeaflet();
  if (!map) {
    map = L.map("supply-map", { scrollWheelZoom: false, worldCopyJump: true }).setView([25, 10], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 6,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  }
  if (layerGroup) layerGroup.remove();
  layerGroup = L.layerGroup().addTo(map);

  const active = new Set(corridorsForDestination(destination).map((c) => c.id));
  for (const c of CORRIDORS) {
    const risk = corridorRisk(c, events);
    const isActive = active.has(c.id);
    const color = corridorColor(risk);
    const line = L.polyline(c.waypoints, {
      color,
      weight: isActive ? 3 : 1.5,
      opacity: isActive ? 0.9 : 0.15,
      className: isActive ? "flow-line" : "",
      dashArray: c.mode === "pipeline" ? "2 6" : c.mode === "air" ? "8 8" : null,
    }).addTo(layerGroup);
    line.bindPopup(
      '<strong>' + escapeHtml(c.name) + '</strong><br>' +
      escapeHtml(c.mode) + ' \u00b7 ' + escapeHtml(COUNTRY_NAMES[c.from] ?? c.from) + ' \u2192 ' + escapeHtml(COUNTRY_NAMES[c.to] ?? c.to) + '<br>' +
      (risk.max !== null ? 'Risk: ' + escapeHtml(risk.max) + '/100 (' + escapeHtml(riskLevelFromScore(risk.max)) + ') from ' + risk.events.length + ' development(s)' : 'No current developments affecting this corridor') +
      '<br><em>Illustrative reference route</em>'
    );
  }

  // Chokepoint markers, colored by the worst risk among corridors using them.
  for (const [id, cp] of Object.entries(CHOKEPOINTS)) {
    const using = CORRIDORS.filter((c) => c.chokepoints.includes(id) && active.has(c.id));
    const risks = using.map((c) => corridorRisk(c, events).max).filter((m) => m !== null);
    const max = risks.length ? Math.max(...risks) : null;
    const color = max !== null ? RISK_COLORS[riskLevelFromScore(max)] : "#8b98ab";
    L.circleMarker(cp.coords, { radius: 6, color, weight: 2, fillColor: color, fillOpacity: 0.6 })
      .addTo(layerGroup)
      .bindPopup('<strong>' + escapeHtml(cp.name) + '</strong><br>' + (max !== null ? 'Risk: ' + escapeHtml(max) + '/100' : 'No current risk signals') + '<br><em>Chokepoint (reference)</em>');
  }
}

function renderPanel(events, destination) {
  const panel = document.getElementById("corridor-panel");
  if (!panel) return;
  const corridors = corridorsForDestination(destination);
  if (!corridors.length) {
    panel.innerHTML = emptyState("No reference corridors to that destination yet.");
    return;
  }
  const seen = new Set();
  const allEvents = [];
  const rows = corridors.map((c) => {
    const risk = corridorRisk(c, events);
    for (const e of risk.events) if (!seen.has(e.id)) { seen.add(e.id); allEvents.push(e); }
    return '<div class="region-row">' +
      '<span class="region-name">' + escapeHtml(c.name) + "</span>" +
      '<span class="muted">' + escapeHtml(c.mode) + " \u00b7 " + risk.events.length + " development(s)</span>" +
      (risk.max !== null ? riskBadge(riskLevelFromScore(risk.max)) : '<span class="chip">no signals</span>') +
      "</div>";
  }).join("");
  allEvents.sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
  panel.innerHTML =
    '<h2>' + (destination ? "Corridors to " + escapeHtml(COUNTRY_NAMES[destination] ?? destination) : "All reference corridors") + "</h2>" + rows +
    '<h2>Possible disruptions (' + allEvents.length + ")</h2>" +
    (allEvents.length ? allEvents.slice(0, 12).map(eventListItem).join("") : emptyState("No current developments affect these corridors.")) +
    '<p class="muted">Corridors are illustrative reference routes, not live vessel tracking. Disruptions are real PRISM events whose countries intersect the route (including chokepoints).</p>';
}

export async function init() {
  const controls = document.getElementById("supply-controls");
  const mapBox = document.getElementById("supply-map");
  if (!controls || !mapBox) return;
  const data = await loadIntelligence("global");

  const dests = destinationCountries();
  const initial = getStoredRegion() === "iceland" && dests.includes("IS") ? "IS" : "";
  controls.innerHTML =
    '<label class="filter-field"><span class="muted">Destination country</span>' +
    '<select id="dest-select"><option value="">All destinations</option>' +
    dests.map((c) => '<option value="' + c + '">' + escapeHtml(COUNTRY_NAMES[c] ?? c) + "</option>").join("") +
    "</select></label>" +
    '<span class="muted">Flow direction: origin \u2192 destination. Line color = highest risk among affecting developments.</span>';
  const sel = controls.querySelector("#dest-select");
  sel.value = initial;

  const update = async () => {
    const dest = sel.value;
    try {
      await drawCorridors(data.events, dest);
    } catch (err) {
      console.error("[PRISM] supply map failed:", err);
      mapBox.innerHTML = '<p class="state error">Map unavailable (Leaflet CDN unreachable). The corridor panel remains usable.</p>';
    }
    renderPanel(data.events, dest);
  };
  sel.addEventListener("change", update);
  await update();
}
