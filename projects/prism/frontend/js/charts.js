// PRISM — charts.js
// Chart.js wrapper. Loaded lazily from a pinned CDN ESM build — no install,
// no build step. If the CDN is unreachable the chart area shows an honest
// fallback message instead of failing silently.

import { errorState } from "./components.js";

const CHART_JS_CDN = "https://esm.sh/chart.js@4.4.4/auto";
let chartPromise = null;

export function loadChartJs() {
  if (!chartPromise) {
    chartPromise = import(CHART_JS_CDN).then((mod) => {
      const Chart = mod.default ?? mod.Chart;
      Chart.defaults.color = "#8b98ab";
      Chart.defaults.borderColor = "#243147";
      Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
      Chart.defaults.plugins.legend.labels.boxWidth = 12;
      return Chart;
    });
  }
  return chartPromise;
}

/** Renders a chart into a canvas; on failure shows a fallback in its box. */
export async function renderChart(canvas, config) {
  try {
    const Chart = await loadChartJs();
    return new Chart(canvas, config);
  } catch (err) {
    console.error("[PRISM] chart load failed:", err);
    const box = canvas.closest(".chart-box") ?? canvas.parentElement;
    if (box) box.innerHTML = errorState("Charts unavailable (Chart.js CDN unreachable). Data tables elsewhere on the page remain usable.");
    return null;
  }
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true } },
};

export function lineConfig(labels, datasets, opts = {}) {
  return {
    type: "line",
    data: { labels, datasets: datasets.map((d) => ({ tension: 0.25, pointRadius: 2, borderWidth: 2, ...d })) },
    options: { ...baseOptions, ...opts, scales: { y: { beginAtZero: true, ...(opts.yScale ?? {}) }, x: {} } },
  };
}

export function barConfig(labels, datasets, opts = {}) {
  return {
    type: "bar",
    data: { labels, datasets },
    options: { ...baseOptions, ...opts, scales: { y: { beginAtZero: true, ...(opts.yScale ?? {}) }, x: {} } },
  };
}

export function doughnutConfig(labels, data, colors) {
  return {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: "#151f31", borderWidth: 2 }] },
    options: { ...baseOptions, cutout: "60%" },
  };
}
