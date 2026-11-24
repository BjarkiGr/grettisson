// PRISM — map.js
// Leaflet wrapper. Leaflet 1.9.4 (UMD) + CSS load lazily from pinned unpkg
// URLs; tiles come from OpenStreetMap with required attribution. If the
// library cannot load, an honest fallback message is shown.

import { errorState } from "./components.js";
import { escapeHtml, RISK_COLORS } from "./utils.js";

const LEAFLET_BASE = "https://unpkg.com/leaflet@1.9.4/dist";
let leafletPromise = null;

export function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (globalThis.L) return resolve(globalThis.L);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_BASE + "/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = LEAFLET_BASE + "/leaflet.js";
      const timer = setTimeout(() => reject(new Error("Leaflet load timeout")), 15000);
      script.onload = () => { clearTimeout(timer); resolve(globalThis.L); };
      script.onerror = () => { clearTimeout(timer); reject(new Error("Leaflet load failed")); };
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

/**
 * Renders the world risk map. points: [{ lat, lng, level, title, score, count }].
 * Popup content is escaped — points may carry untrusted titles in production.
 */
export async function renderRiskMap(container, points) {
  try {
    const L = await loadLeaflet();
    const map = L.map(container, { scrollWheelZoom: false, worldCopyJump: true }).setView([22, 15], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 6,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    for (const p of points) {
      const color = RISK_COLORS[p.level] ?? "#8b98ab";
      L.circleMarker([p.lat, p.lng], {
        radius: 7, color, weight: 2, fillColor: color, fillOpacity: 0.55,
      }).addTo(map).bindPopup(
        '<strong>' + escapeHtml(p.title) + '</strong><br>' +
        escapeHtml(p.level ?? "") + ' \u00b7 score ' + escapeHtml(p.score) +
        (p.count != null ? '<br>Events: ' + escapeHtml(p.count) : '')
      );
    }
    return map;
  } catch (err) {
    console.error("[PRISM] map load failed:", err);
    container.innerHTML = errorState("Map unavailable (Leaflet CDN unreachable). Regional summaries below remain usable.");
    return null;
  }
}
