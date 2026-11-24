// PRISM — demo-data.js (TEST FIXTURE ONLY since Phase 6 — not imported by any production page)
// ============================================================================
// DEMONSTRATION DATA ONLY. Every scenario, source, article and assessment in
// this file is FICTIONAL, written to exercise the interface in Phase 1.
// Nothing here is real intelligence. Real data arrives in Phases 3-6 and this
// module is then removed from production rendering. Sources are invented
// names; article URLs use the reserved example.com domain; no market prices
// are shown anywhere. The UI marks all of it with DEMO badges and a banner.
// ============================================================================

import { computeOverallScore } from "./utils.js";

export const IS_DEMO = true;

export const DEMO_SOURCES = [
  { id: "demo-src-01", name: "Demo Wire", url: "https://example.com/demo-wire", source_type: "news_rss", country: "GB", reliability_rating: 4, active: true, last_checked_at: "2026-11-23T06:00:00Z" },
  { id: "demo-src-02", name: "Harbor Bulletin (demo)", url: "https://example.com/harbor-bulletin", source_type: "shipping", country: "SG", reliability_rating: 4, active: true, last_checked_at: "2026-11-23T06:00:00Z" },
  { id: "demo-src-03", name: "Meridian Press (demo)", url: "https://example.com/meridian-press", source_type: "news_rss", country: "US", reliability_rating: 3, active: true, last_checked_at: "2026-11-23T05:30:00Z" },
  { id: "demo-src-04", name: "Atlas Economic Review (demo)", url: "https://example.com/atlas-economic", source_type: "economic", country: "DE", reliability_rating: 4, active: true, last_checked_at: "2026-11-23T04:00:00Z" },
  { id: "demo-src-05", name: "Frontier Energy Watch (demo)", url: "https://example.com/frontier-energy", source_type: "energy", country: "NO", reliability_rating: 3, active: true, last_checked_at: "2026-11-22T22:00:00Z" },
  { id: "demo-src-06", name: "Civic Signal (demo)", url: "https://example.com/civic-signal", source_type: "government", country: "KE", reliability_rating: 3, active: false, last_checked_at: "2026-11-20T12:00:00Z" },
];

export const DEMO_COMMODITIES = [
  { id: "crude-oil", name: "Crude oil", note: "Seaborne chokepoint exposure dominates the demo scenarios." },
  { id: "natural-gas", name: "Natural gas", note: "Pipeline and LNG routing exposure in the demo scenarios." },
  { id: "wheat", name: "Wheat", note: "Harvest and export-corridor exposure in the demo scenarios." },
  { id: "semiconductors", name: "Semiconductors", note: "Concentrated manufacturing and port exposure in the demo scenarios." },
  { id: "copper", name: "Copper", note: "Tariff and logistics exposure in the demo scenarios." },
  { id: "fertilizer", name: "Fertilizer", note: "Sanctions and agricultural input exposure in the demo scenarios." },
];

// Real geography is used ONLY so the map demo is meaningful; the events
// plotted on it are fictional.
export const COUNTRY_COORDS = {
  EG: [26.8, 30.8], RU: [55.7, 37.6], JP: [36.2, 138.2], US: [39.8, -98.6],
  NO: [60.5, 8.5], SG: [1.35, 103.8], KE: [0.02, 37.9], IN: [20.6, 79.0], CH: [46.8, 8.2],
};

const RAW_EVENTS = [
  {
    id: "demo-evt-001", demo: true,
    title: "Demo: Strait shipping disruption scenario",
    summary: "Fictional scenario: a major strait is partially closed to commercial traffic after a security incident, forcing rerouting of container and energy shipping.",
    category: "shipping_disruptions", primary_country: "EG", countries: ["EG", "SA", "YE"], region: "Middle East",
    severity: 5, status: "active", first_detected_at: "2026-11-10T04:20:00Z", last_updated_at: "2026-11-23T05:00:00Z",
    dimensions: { severity: 5, probability: 4, geographic: 4, duration: 3, supply_chain: 5, economic: 4 },
    confidence: 0.7,
    explanation: "Demo assessment: severe chokepoint disruption with wide geographic reach and multi-week expected duration.",
    commodities: ["crude-oil", "natural-gas"], industries: ["shipping", "energy", "retail"], organizations: ["Demo Maritime Authority"],
    supply_chain_implications: "Demo: rerouting adds 10-14 days on Asia-Europe lanes; freight and insurance costs rise; just-in-time inventories draw down.",
    economic_consequences: "Demo: upward pressure on energy and freight prices; delayed manufactured goods; port congestion downstream.",
    escalation_scenarios: ["Demo: full closure lasting over a month", "Demo: regional spillover affecting adjacent corridors"],
    uncertainties: ["Demo: duration of the security operation is unknown"],
    timeline: [
      { date: "2026-11-10", label: "Demo: incident reported; partial closure announced" },
      { date: "2026-11-14", label: "Demo: major carriers announce rerouting" },
      { date: "2026-11-21", label: "Demo: naval escort corridor proposed" },
    ],
    history: [ { date: "2026-11-10", overall_score: 62 }, { date: "2026-11-14", overall_score: 74 }, { date: "2026-11-18", overall_score: 80 } ],
    related: ["demo-evt-005"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.7, executive_summary: "Simulated assessment — no AI was called. A fictional chokepoint closure with severe supply-chain exposure." },
  },
  {
    id: "demo-evt-002", demo: true,
    title: "Demo: Sanctions package announcement scenario",
    summary: "Fictional scenario: a coordinated sanctions package targets energy and fertilizer exports, with phased implementation over six months.",
    category: "sanctions", primary_country: "RU", countries: ["RU", "DE", "FR"], region: "Europe",
    severity: 3, status: "active", first_detected_at: "2026-11-05T09:00:00Z", last_updated_at: "2026-11-20T10:00:00Z",
    dimensions: { severity: 3, probability: 3, geographic: 2, duration: 3, supply_chain: 2, economic: 2 },
    confidence: 0.6,
    explanation: "Demo assessment: moderate, phased measures; market adjustment expected over months rather than days.",
    commodities: ["natural-gas", "fertilizer"], industries: ["energy", "finance", "agriculture"], organizations: ["Demo Sanctions Council"],
    supply_chain_implications: "Demo: fertilizer buyers seek alternative suppliers; compliance overhead rises for traders.",
    economic_consequences: "Demo: regional price premia; rerouted trade flows; limited global effect in the base case.",
    escalation_scenarios: ["Demo: secondary sanctions widen the affected set"],
    uncertainties: ["Demo: enforcement intensity is unclear"],
    timeline: [
      { date: "2026-11-05", label: "Demo: package announced" },
      { date: "2026-11-12", label: "Demo: implementation guidance published" },
    ],
    history: [ { date: "2026-11-05", overall_score: 44 }, { date: "2026-11-12", overall_score: 47 } ],
    related: ["demo-evt-005"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.6, executive_summary: "Simulated assessment — no AI was called. Fictional phased sanctions with moderate exposure." },
  },
  {
    id: "demo-evt-003", demo: true,
    title: "Demo: Typhoon port closure scenario",
    summary: "Fictional scenario: a severe typhoon closes two major container ports for several days, delaying electronics and automotive shipments.",
    category: "natural_disasters", primary_country: "JP", countries: ["JP", "KR"], region: "East Asia",
    severity: 3, status: "monitoring", first_detected_at: "2026-11-16T22:00:00Z", last_updated_at: "2026-11-22T08:00:00Z",
    dimensions: { severity: 3, probability: 4, geographic: 2, duration: 1, supply_chain: 3, economic: 2 },
    confidence: 0.8,
    explanation: "Demo assessment: high-confidence short-duration disruption; backlog clearance expected within two weeks.",
    commodities: ["semiconductors", "copper"], industries: ["manufacturing", "shipping"], organizations: ["Demo Port Authority"],
    supply_chain_implications: "Demo: short-term component delays; air-freight substitution for urgent orders.",
    economic_consequences: "Demo: localized output dip; limited macro effect.",
    escalation_scenarios: ["Demo: repeat storm extends the closure"],
    uncertainties: ["Demo: exact reopening date"],
    timeline: [
      { date: "2026-11-16", label: "Demo: ports close ahead of landfall" },
      { date: "2026-11-19", label: "Demo: partial reopening begins" },
    ],
    history: [ { date: "2026-11-16", overall_score: 58 }, { date: "2026-11-19", overall_score: 55 } ],
    related: ["demo-evt-006"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.8, executive_summary: "Simulated assessment — no AI was called. Fictional weather disruption, short duration." },
  },
  {
    id: "demo-evt-004", demo: true,
    title: "Demo: Export tariff escalation scenario",
    summary: "Fictional scenario: announced tariff increases on industrial metals and agricultural goods trigger front-loading of shipments and contract renegotiation.",
    category: "tariffs", primary_country: "US", countries: ["US", "CA", "MX"], region: "Americas",
    severity: 3, status: "active", first_detected_at: "2026-10-28T14:00:00Z", last_updated_at: "2026-11-19T16:00:00Z",
    dimensions: { severity: 3, probability: 4, geographic: 3, duration: 4, supply_chain: 3, economic: 4 },
    confidence: 0.65,
    explanation: "Demo assessment: sustained cost pressure across North American supply chains; implementation date drives timing.",
    commodities: ["copper", "wheat"], industries: ["agriculture", "manufacturing", "construction"], organizations: ["Demo Trade Commission"],
    supply_chain_implications: "Demo: front-loaded orders strain logistics; buyers re-source; inventory carrying costs rise.",
    economic_consequences: "Demo: input-cost inflation for downstream manufacturers; margin compression.",
    escalation_scenarios: ["Demo: retaliatory measures widen the tariff scope"],
    uncertainties: ["Demo: final product exclusions are unpublished"],
    timeline: [
      { date: "2026-10-28", label: "Demo: tariff proposal announced" },
      { date: "2026-11-08", label: "Demo: consultation period opens" },
      { date: "2026-11-19", label: "Demo: implementation date confirmed" },
    ],
    history: [ { date: "2026-10-28", overall_score: 55 }, { date: "2026-11-08", overall_score: 60 }, { date: "2026-11-19", overall_score: 66 } ],
    related: ["demo-evt-008"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.65, executive_summary: "Simulated assessment — no AI was called. Fictional tariff escalation with sustained duration." },
  },
  {
    id: "demo-evt-005", demo: true,
    title: "Demo: Pipeline outage scenario",
    summary: "Fictional scenario: an unplanned offshore pipeline outage reduces gas deliveries to several European markets during early winter.",
    category: "energy_disruptions", primary_country: "NO", countries: ["NO", "DE", "PL"], region: "Europe",
    severity: 4, status: "active", first_detected_at: "2026-11-12T03:00:00Z", last_updated_at: "2026-11-22T18:00:00Z",
    dimensions: { severity: 4, probability: 3, geographic: 3, duration: 3, supply_chain: 4, economic: 4 },
    confidence: 0.6,
    explanation: "Demo assessment: significant regional energy exposure; LNG substitution partially offsets the shortfall.",
    commodities: ["natural-gas", "crude-oil"], industries: ["energy", "chemicals", "utilities"], organizations: ["Demo Grid Operator"],
    supply_chain_implications: "Demo: gas-intensive industries curtail output; LNG spot demand rises.",
    economic_consequences: "Demo: regional price spike; industrial cost pressure; mild demand destruction.",
    escalation_scenarios: ["Demo: outage extends into deep winter"],
    uncertainties: ["Demo: repair timeline"],
    timeline: [
      { date: "2026-11-12", label: "Demo: outage detected; flows reduced" },
      { date: "2026-11-17", label: "Demo: repair vessel mobilized" },
    ],
    history: [ { date: "2026-11-12", overall_score: 63 }, { date: "2026-11-17", overall_score: 68 } ],
    related: ["demo-evt-001", "demo-evt-002"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.6, executive_summary: "Simulated assessment — no AI was called. Fictional pipeline outage with regional energy impact." },
  },
];

RAW_EVENTS.push(
  {
    id: "demo-evt-006", demo: true,
    title: "Demo: Port cyber incident scenario",
    summary: "Fictional scenario: a ransomware incident disables terminal operating systems at a transshipment hub, causing multi-day processing delays.",
    category: "cybersecurity_incidents", primary_country: "SG", countries: ["SG", "MY"], region: "East Asia",
    severity: 2, status: "monitoring", first_detected_at: "2026-11-18T01:00:00Z", last_updated_at: "2026-11-21T09:00:00Z",
    dimensions: { severity: 2, probability: 3, geographic: 1, duration: 1, supply_chain: 2, economic: 1 },
    confidence: 0.75,
    explanation: "Demo assessment: contained incident with manual fallback procedures limiting impact.",
    commodities: ["semiconductors"], industries: ["shipping", "logistics"], organizations: ["Demo Terminal Operator"],
    supply_chain_implications: "Demo: berth queues lengthen; feeder schedules slip regionally.",
    economic_consequences: "Demo: minor cost increases; no macro effect expected.",
    escalation_scenarios: ["Demo: incident spreads to adjacent terminals"],
    uncertainties: ["Demo: full system restoration date"],
    timeline: [
      { date: "2026-11-18", label: "Demo: incident detected; systems isolated" },
      { date: "2026-11-20", label: "Demo: manual operations partially restored" },
    ],
    history: [ { date: "2026-11-18", overall_score: 38 }, { date: "2026-11-20", overall_score: 36 } ],
    related: ["demo-evt-003"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.75, executive_summary: "Simulated assessment — no AI was called. Fictional contained cyber incident." },
  },
  {
    id: "demo-evt-007", demo: true,
    title: "Demo: Election unrest scenario",
    summary: "Fictional scenario: post-election demonstrations disrupt road freight corridors for several days; rail and air links remain operational.",
    category: "political_instability", primary_country: "KE", countries: ["KE"], region: "Africa",
    severity: 2, status: "monitoring", first_detected_at: "2026-11-08T12:00:00Z", last_updated_at: "2026-11-15T12:00:00Z",
    dimensions: { severity: 2, probability: 2, geographic: 1, duration: 2, supply_chain: 1, economic: 2 },
    confidence: 0.55,
    explanation: "Demo assessment: localized disruption; alternative modes absorb most freight.",
    commodities: ["fertilizer"], industries: ["agriculture", "transport"], organizations: ["Demo Electoral Commission"],
    supply_chain_implications: "Demo: inland fertilizer deliveries delayed ahead of planting season.",
    economic_consequences: "Demo: temporary local price increases for perishables.",
    escalation_scenarios: ["Demo: prolonged nationwide strikes"],
    uncertainties: ["Demo: political resolution timeline"],
    timeline: [
      { date: "2026-11-08", label: "Demo: demonstrations begin" },
      { date: "2026-11-13", label: "Demo: main corridor reopens" },
    ],
    history: [ { date: "2026-11-08", overall_score: 36 }, { date: "2026-11-13", overall_score: 34 } ],
    related: [],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.55, executive_summary: "Simulated assessment — no AI was called. Fictional localized unrest." },
  },
  {
    id: "demo-evt-008", demo: true,
    title: "Demo: Drought harvest shortfall scenario",
    summary: "Fictional scenario: a failed monsoon reduces regional grain output, prompting export restrictions and higher import demand elsewhere.",
    category: "economic_instability", primary_country: "IN", countries: ["IN", "PK"], region: "South Asia",
    severity: 3, status: "active", first_detected_at: "2026-10-20T08:00:00Z", last_updated_at: "2026-11-18T08:00:00Z",
    dimensions: { severity: 3, probability: 3, geographic: 2, duration: 3, supply_chain: 2, economic: 3 },
    confidence: 0.6,
    explanation: "Demo assessment: seasonal supply squeeze with policy response amplifying trade effects.",
    commodities: ["wheat", "fertilizer"], industries: ["agriculture", "food-processing"], organizations: ["Demo Food Authority"],
    supply_chain_implications: "Demo: importers diversify origins; shipping demand shifts to alternative corridors.",
    economic_consequences: "Demo: food-price inflation regionally; subsidy pressure on budgets.",
    escalation_scenarios: ["Demo: export ban extends to additional staples"],
    uncertainties: ["Demo: next-season rainfall outlook"],
    timeline: [
      { date: "2026-10-20", label: "Demo: harvest shortfall confirmed" },
      { date: "2026-11-02", label: "Demo: export restrictions announced" },
    ],
    history: [ { date: "2026-10-20", overall_score: 45 }, { date: "2026-11-02", overall_score: 50 } ],
    related: ["demo-evt-004"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.6, executive_summary: "Simulated assessment — no AI was called. Fictional harvest shortfall with trade response." },
  },
  {
    id: "demo-evt-009", demo: true,
    title: "Demo: Diplomatic summit scenario",
    summary: "Fictional scenario: a regional summit produces a framework agreement de-escalating a trade dispute; markets react mildly positively.",
    category: "diplomatic_developments", primary_country: "CH", countries: ["CH", "FR", "DE"], region: "Europe",
    severity: 1, status: "resolved", first_detected_at: "2026-11-02T10:00:00Z", last_updated_at: "2026-11-06T10:00:00Z",
    dimensions: { severity: 1, probability: 2, geographic: 1, duration: 1, supply_chain: 0, economic: 1 },
    confidence: 0.8,
    explanation: "Demo assessment: de-escalatory development; residual risk is implementation follow-through.",
    commodities: [], industries: ["finance", "manufacturing"], organizations: ["Demo Summit Secretariat"],
    supply_chain_implications: "Demo: expected easing of disputed customs procedures.",
    economic_consequences: "Demo: modest confidence improvement; no direct supply effect.",
    escalation_scenarios: ["Demo: talks collapse during implementation"],
    uncertainties: ["Demo: ratification timeline"],
    timeline: [
      { date: "2026-11-02", label: "Demo: summit opens" },
      { date: "2026-11-05", label: "Demo: framework agreement signed" },
    ],
    history: [ { date: "2026-11-02", overall_score: 24 }, { date: "2026-11-05", overall_score: 20 } ],
    related: ["demo-evt-002"],
    analysis: { provider: "demonstration", model: "demo-model", prompt_version: "demo-1", confidence: 0.8, executive_summary: "Simulated assessment — no AI was called. Fictional de-escalation agreement." },
  }
);

export const DEMO_ARTICLES = [
  { id: "demo-art-001", demo: true, source_id: "demo-src-02", event_id: "demo-evt-001", title: "Demo: Strait traffic halted after security incident", url: "https://example.com/demo/strait-halt", author: "Demo Reporter", published_at: "2026-11-10T05:10:00Z", collected_at: "2026-11-10T05:30:00Z", content: "Fictional report: commercial transits suspended pending a security operation; carriers await guidance.", language: "en", processing_status: "analyzed", category: "shipping_disruptions", countries: ["EG", "SA", "YE"] },
  { id: "demo-art-002", demo: true, source_id: "demo-src-01", event_id: "demo-evt-001", title: "Demo: Carriers reroute around closed strait", url: "https://example.com/demo/reroute", author: "Demo Reporter", published_at: "2026-11-14T09:00:00Z", collected_at: "2026-11-14T09:20:00Z", content: "Fictional report: major lines announce longer routings; transit times rise by up to two weeks.", language: "en", processing_status: "analyzed", category: "shipping_disruptions", countries: ["EG"] },
  { id: "demo-art-003", demo: true, source_id: "demo-src-02", event_id: "demo-evt-001", title: "Demo: Escort corridor proposed for strait", url: "https://example.com/demo/escort-corridor", author: null, published_at: "2026-11-21T07:45:00Z", collected_at: "2026-11-21T08:00:00Z", content: "Fictional report: a escorted-convoy proposal is under discussion; insurers remain cautious.", language: "en", processing_status: "classified", category: "shipping_disruptions", countries: ["EG", "YE"] },
  { id: "demo-art-004", demo: true, source_id: "demo-src-04", event_id: "demo-evt-002", title: "Demo: Sanctions package targets energy and fertilizer", url: "https://example.com/demo/sanctions-package", author: "Demo Analyst", published_at: "2026-11-05T10:00:00Z", collected_at: "2026-11-05T10:15:00Z", content: "Fictional report: phased measures announced with a six-month implementation window.", language: "en", processing_status: "analyzed", category: "sanctions", countries: ["RU", "DE", "FR"] },
  { id: "demo-art-005", demo: true, source_id: "demo-src-04", event_id: "demo-evt-002", title: "Demo: Guidance published for sanctions compliance", url: "https://example.com/demo/sanctions-guidance", author: null, published_at: "2026-11-12T13:30:00Z", collected_at: "2026-11-12T14:00:00Z", content: "Fictional report: compliance guidance clarifies scope; traders seek alternative suppliers.", language: "en", processing_status: "analyzed", category: "sanctions", countries: ["RU", "DE"] },
  { id: "demo-art-006", demo: true, source_id: "demo-src-03", event_id: "demo-evt-003", title: "Demo: Typhoon closes two major container ports", url: "https://example.com/demo/typhoon-closure", author: "Demo Reporter", published_at: "2026-11-16T23:00:00Z", collected_at: "2026-11-16T23:20:00Z", content: "Fictional report: ports suspend operations ahead of landfall; backlog expected.", language: "en", processing_status: "analyzed", category: "natural_disasters", countries: ["JP", "KR"] },
  { id: "demo-art-007", demo: true, source_id: "demo-src-02", event_id: "demo-evt-003", title: "Demo: Partial reopening after typhoon", url: "https://example.com/demo/typhoon-reopen", author: null, published_at: "2026-11-19T06:00:00Z", collected_at: "2026-11-19T06:30:00Z", content: "Fictional report: limited berths resume service; full clearance estimated at two weeks.", language: "en", processing_status: "classified", category: "natural_disasters", countries: ["JP"] },
  { id: "demo-art-008", demo: true, source_id: "demo-src-03", event_id: "demo-evt-004", title: "Demo: Tariff proposal covers metals and farm goods", url: "https://example.com/demo/tariff-proposal", author: "Demo Analyst", published_at: "2026-10-28T15:00:00Z", collected_at: "2026-10-28T15:30:00Z", content: "Fictional report: proposed increases trigger front-loading of shipments.", language: "en", processing_status: "analyzed", category: "tariffs", countries: ["US", "CA", "MX"] },
  { id: "demo-art-009", demo: true, source_id: "demo-src-04", event_id: "demo-evt-004", title: "Demo: Implementation date confirmed for tariffs", url: "https://example.com/demo/tariff-date", author: null, published_at: "2026-11-19T17:00:00Z", collected_at: "2026-11-19T17:10:00Z", content: "Fictional report: date confirmed; exclusions list still unpublished.", language: "en", processing_status: "analyzed", category: "tariffs", countries: ["US"] },
  { id: "demo-art-010", demo: true, source_id: "demo-src-05", event_id: "demo-evt-005", title: "Demo: Offshore pipeline flows reduced", url: "https://example.com/demo/pipeline-outage", author: "Demo Reporter", published_at: "2026-11-12T04:00:00Z", collected_at: "2026-11-12T04:30:00Z", content: "Fictional report: unplanned outage cuts deliveries; repair vessel mobilized.", language: "en", processing_status: "analyzed", category: "energy_disruptions", countries: ["NO", "DE", "PL"] },
  { id: "demo-art-011", demo: true, source_id: "demo-src-02", event_id: "demo-evt-006", title: "Demo: Cyber incident hits terminal systems", url: "https://example.com/demo/port-cyber", author: null, published_at: "2026-11-18T02:00:00Z", collected_at: "2026-11-18T02:30:00Z", content: "Fictional report: terminal operating systems isolated; manual fallback in place.", language: "en", processing_status: "analyzed", category: "cybersecurity_incidents", countries: ["SG", "MY"] },
  { id: "demo-art-012", demo: true, source_id: "demo-src-06", event_id: "demo-evt-007", title: "Demo: Demonstrations disrupt freight corridor", url: "https://example.com/demo/corridor-unrest", author: "Demo Reporter", published_at: "2026-11-08T13:00:00Z", collected_at: "2026-11-08T14:00:00Z", content: "Fictional report: road freight delayed; rail and air unaffected.", language: "en", processing_status: "analyzed", category: "political_instability", countries: ["KE"] },
  { id: "demo-art-013", demo: true, source_id: "demo-src-04", event_id: "demo-evt-008", title: "Demo: Export restrictions follow harvest shortfall", url: "https://example.com/demo/harvest-restrictions", author: "Demo Analyst", published_at: "2026-11-02T09:00:00Z", collected_at: "2026-11-02T09:30:00Z", content: "Fictional report: restrictions announced after failed monsoon; importers diversify.", language: "en", processing_status: "analyzed", category: "economic_instability", countries: ["IN", "PK"] },
  { id: "demo-art-014", demo: true, source_id: "demo-src-01", event_id: "demo-evt-009", title: "Demo: Summit produces framework agreement", url: "https://example.com/demo/summit-agreement", author: null, published_at: "2026-11-05T18:00:00Z", collected_at: "2026-11-05T18:20:00Z", content: "Fictional report: framework signed; ratification timeline unclear.", language: "en", processing_status: "analyzed", category: "diplomatic_developments", countries: ["CH", "FR", "DE"] },
  { id: "demo-art-015", demo: true, source_id: "demo-src-03", event_id: null, title: "Demo: Sports league announces schedule", url: "https://example.com/demo/sports-schedule", author: null, published_at: "2026-11-22T12:00:00Z", collected_at: "2026-11-22T12:10:00Z", content: "Fictional irrelevant item retained to demonstrate classification filtering.", language: "en", processing_status: "irrelevant", category: null, countries: [] },
  { id: "demo-art-016", demo: true, source_id: "demo-src-01", event_id: null, title: "Demo: Unverified rumor awaits classification", url: "https://example.com/demo/pending-item", author: null, published_at: "2026-11-23T05:00:00Z", collected_at: "2026-11-23T05:05:00Z", content: "Fictional pending item demonstrating the queued processing state.", language: "en", processing_status: "pending", category: null, countries: [] },
];

// Overall scores are COMPUTED from the dimensions with the documented,
// transparent formula — never hand-written (spec section 10).
export const DEMO_EVENTS = RAW_EVENTS.map((e) => ({
  ...e,
  overall_score: computeOverallScore(e.dimensions),
}));

// Fictional weekly activity series for the overview chart (demo only).
export const DEMO_ACTIVITY = {
  labels: ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"],
  new_events: [1, 0, 2, 1, 3, 2, 3, 0],
  articles_collected: [4, 3, 6, 5, 9, 8, 10, 4],
};

// Fictional regional trend series for the regions page (demo only).
export const DEMO_REGION_TRENDS = {
  labels: ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"],
  series: [
    { region: "Middle East", values: [40, 44, 58, 74, 85] },
    { region: "Europe", values: [35, 38, 42, 50, 52] },
    { region: "East Asia", values: [30, 30, 32, 48, 44] },
  ],
};

export function findEvent(id) {
  return DEMO_EVENTS.find((e) => e.id === id) ?? null;
}

export function findSource(id) {
  return DEMO_SOURCES.find((s) => s.id === id) ?? null;
}

export function articlesForEvent(eventId) {
  return DEMO_ARTICLES.filter((a) => a.event_id === eventId);
}

export function eventsForCommodity(commodityId) {
  return DEMO_EVENTS.filter((e) => e.commodities.includes(commodityId));
}
