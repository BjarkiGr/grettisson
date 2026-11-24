// PRISM — routes.js
// REFERENCE DATA: illustrative major trade corridors and chokepoints.
// Factual geography (like geo.js), NOT live vessel/trade tracking and NOT
// intelligence. Disruption overlays come from real PRISM events.

export const CHOKEPOINTS = {
  suez: { name: "Suez Canal", coords: [30.0, 32.5], countries: ["EG"] },
  panama: { name: "Panama Canal", coords: [9.1, -79.7], countries: ["PA"] },
  malacca: { name: "Strait of Malacca", coords: [1.4, 103.0], countries: ["SG", "MY"] },
  hormuz: { name: "Strait of Hormuz", coords: [26.6, 56.3], countries: ["IR", "OM"] },
  bab: { name: "Bab-el-Mandeb", coords: [12.6, 43.3], countries: ["YE", "DJ"] },
};

export const COUNTRY_NAMES = {
  CN: "China", NL: "Netherlands", US: "United States", DE: "Germany",
  JP: "Japan", SA: "Saudi Arabia", NO: "Norway", BR: "Brazil",
  AU: "Australia", SG: "Singapore", IS: "Iceland", GB: "United Kingdom",
  EG: "Egypt", YE: "Yemen", PA: "Panama", ZA: "South Africa",
  MY: "Malaysia", IR: "Iran", OM: "Oman", DJ: "Djibouti", ID: "Indonesia",
};

export const CORRIDORS = [
  { id: "asia-europe-suez", name: "Asia - Europe (Suez)", mode: "sea", from: "CN", to: "NL",
    countries: ["CN", "SG", "MY", "YE", "DJ", "EG", "NL"], chokepoints: ["malacca", "bab", "suez"],
    waypoints: [[31.2, 121.5], [1.3, 103.8], [6.0, 80.0], [12.6, 43.3], [30.0, 32.5], [36.0, 15.0], [51.9, 4.1]] },
  { id: "transpacific", name: "Transpacific (Asia - US West)", mode: "sea", from: "CN", to: "US",
    countries: ["CN", "US"], chokepoints: [],
    waypoints: [[31.2, 121.5], [35.0, 160.0], [40.0, -160.0], [33.7, -118.2]] },
  { id: "asia-us-panama", name: "Asia - US East (Panama)", mode: "sea", from: "CN", to: "US",
    countries: ["CN", "PA", "US"], chokepoints: ["panama"],
    waypoints: [[31.2, 121.5], [20.0, -130.0], [9.1, -79.7], [25.0, -80.0], [40.7, -74.0]] },
  { id: "transatlantic", name: "Transatlantic (US - Europe)", mode: "sea", from: "US", to: "NL",
    countries: ["US", "NL"], chokepoints: [],
    waypoints: [[40.7, -74.0], [45.0, -40.0], [51.9, 4.1]] },
  { id: "gulf-japan-oil", name: "Gulf - Japan (oil)", mode: "sea", from: "SA", to: "JP",
    countries: ["SA", "IR", "OM", "SG", "MY", "JP"], chokepoints: ["hormuz", "malacca"],
    waypoints: [[26.7, 50.0], [26.6, 56.3], [1.4, 103.0], [35.4, 139.7]] },
  { id: "gulf-europe-oil", name: "Gulf - Europe (oil, Suez)", mode: "sea", from: "SA", to: "NL",
    countries: ["SA", "IR", "OM", "YE", "DJ", "EG", "NL"], chokepoints: ["hormuz", "bab", "suez"],
    waypoints: [[26.7, 50.0], [26.6, 56.3], [12.6, 43.3], [30.0, 32.5], [51.9, 4.1]] },
  { id: "norway-gas", name: "Norway - Germany (gas pipeline)", mode: "pipeline", from: "NO", to: "DE",
    countries: ["NO", "DE"], chokepoints: [],
    waypoints: [[60.5, 5.0], [54.0, 7.0], [51.0, 10.0]] },
  { id: "brazil-china-bulk", name: "Brazil - China (bulk, Cape)", mode: "sea", from: "BR", to: "CN",
    countries: ["BR", "ZA", "SG", "MY", "CN"], chokepoints: ["malacca"],
    waypoints: [[-23.9, -46.3], [-34.0, 18.0], [-6.0, 60.0], [1.4, 103.0], [31.2, 121.5]] },
  { id: "australia-china-ore", name: "Australia - China (ore)", mode: "sea", from: "AU", to: "CN",
    countries: ["AU", "ID", "CN"], chokepoints: [],
    waypoints: [[-20.3, 118.6], [-8.5, 116.0], [0.0, 119.0], [31.2, 121.5]] },
  { id: "us-lng-europe", name: "US Gulf - Europe (LNG)", mode: "sea", from: "US", to: "NL",
    countries: ["US", "NL"], chokepoints: [],
    waypoints: [[29.0, -90.0], [40.0, -50.0], [51.9, 4.1]] },
  { id: "iceland-europe", name: "Iceland - Netherlands (freight)", mode: "sea", from: "IS", to: "NL",
    countries: ["IS", "NL"], chokepoints: [],
    waypoints: [[64.1, -21.9], [58.0, -10.0], [51.9, 4.1]] },
  { id: "iceland-uk", name: "Iceland - United Kingdom (freight)", mode: "sea", from: "IS", to: "GB",
    countries: ["IS", "GB"], chokepoints: [],
    waypoints: [[64.1, -21.9], [58.0, -10.0], [51.5, -0.1]] },
  { id: "intra-asia", name: "Singapore - China (intra-Asia)", mode: "sea", from: "SG", to: "CN",
    countries: ["SG", "MY", "CN"], chokepoints: ["malacca"],
    waypoints: [[1.35, 103.8], [10.0, 110.0], [31.2, 121.5]] },
  { id: "europe-iceland", name: "Netherlands - Iceland (imports)", mode: "sea", from: "NL", to: "IS",
    countries: ["NL", "IS"], chokepoints: [],
    waypoints: [[51.9, 4.1], [58.0, -10.0], [64.1, -21.9]] },
  { id: "uk-iceland", name: "United Kingdom - Iceland (imports)", mode: "sea", from: "GB", to: "IS",
    countries: ["GB", "IS"], chokepoints: [],
    waypoints: [[51.5, -0.1], [58.0, -10.0], [64.1, -21.9]] },  { id: "europe-us-air", name: "Frankfurt - New York (air cargo)", mode: "air", from: "DE", to: "US",
    countries: ["DE", "US"], chokepoints: [],
    waypoints: [[50.1, 8.7], [45.0, -30.0], [40.7, -74.0]] },
];

/** Pure: corridors delivering TO a destination country ("" = all). */
export function corridorsForDestination(country) {
  if (!country) return CORRIDORS;
  return CORRIDORS.filter((c) => c.to === country);
}

/** Pure: real events affecting a corridor (country intersection). */
export function disruptionsForCorridor(corridor, events) {
  return events.filter((e) => {
    const cs = e.countries && e.countries.length ? e.countries : (e.primary_country ? [e.primary_country] : []);
    return cs.some((c) => corridor.countries.includes(c));
  }).sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
}

/** Pure: corridor risk = highest score among affecting events. */
export function corridorRisk(corridor, events) {
  const affecting = disruptionsForCorridor(corridor, events);
  const scored = affecting.filter((e) => e.overall_score !== null && e.overall_score !== undefined);
  const max = scored.length ? Math.max(...scored.map((e) => e.overall_score)) : null;
  return { max, events: affecting };
}

/** Pure: destination countries available in the corridor set. */
export function destinationCountries() {
  return [...new Set(CORRIDORS.map((c) => c.to))].sort();
}
