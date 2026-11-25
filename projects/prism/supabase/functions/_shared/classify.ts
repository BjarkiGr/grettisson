// PRISM — shared rule-based classifier (Phase 3).
// Transparent keyword rules: no AI, no hidden weights. Title hits count
// double. An article is relevant when at least one category rule matches.
// Country detection uses word-boundary matching over a documented map.
// AI refinement happens in Phase 4; these rules are the cheap first pass.

import type { EventCategory } from "./types.ts";

export interface Classification {
  relevant: boolean;
  category: EventCategory | null;
  score: number;
  countries: string[];
  primaryCountry: string | null;
  region: string | null;
  matchedKeywords: string[];
}

const CATEGORY_RULES: Array<{ category: EventCategory; keywords: string[] }> = [
  { category: "military_conflict", keywords: ["military strike", "missile", "airstrike", "air strike", "invasion", "shelling", "troops", "armed conflict", "at war", "war in", "war with", "war crimes", "military offensive", "ground offensive", "drone attack"] },
  { category: "political_instability", keywords: ["coup", "protest", "unrest", "riot", "political crisis", "government collapse", "demonstration", "martial law", "impeachment"] },
  { category: "trade_restrictions", keywords: ["export ban", "export restriction", "import ban", "trade restriction", "embargo", "export curbs", "trade halt", "export controls", "trade barrier"] },
  { category: "sanctions", keywords: ["sanction", "blacklist", "asset freeze"] },
  { category: "tariffs", keywords: ["tariff", "customs duty", "import duty", "import duties", "customs duties", "levy", "levies", "import tax", "trade war"] },
  { category: "natural_disasters", keywords: ["earthquake", "hurricane", "typhoon", "flood", "drought", "wildfire", "cyclone", "tsunami", "volcano", "landslide"] },
  { category: "energy_disruptions", keywords: ["pipeline", "power outage", "blackout", "gas supply", "electricity crisis", "refinery", "lng terminal", "oil supply", "energy crisis"] },
  { category: "shipping_disruptions", keywords: ["port closure", "shipping", "strait", "canal", "suez", "red sea", "container", "freight", "vessel", "maritime", "cargo ship"] },
  { category: "economic_instability", keywords: ["inflation", "currency crisis", "default", "recession", "devaluation", "debt crisis", "bailout", "cost of living"] },
  { category: "infrastructure_disruptions", keywords: ["bridge collapse", "rail disruption", "airport closure", "road closure", "dam failure", "derailment", "power grid"] },
  { category: "diplomatic_developments", keywords: ["summit", "treaty", "diplomatic", "ambassador", "peace talks", "negotiation", "ceasefire", "bilateral"] },
  { category: "cybersecurity_incidents", keywords: ["cyberattack", "cyber attack", "ransomware", "hacker", "data breach", "malware", "hack"] },
];


// Icelandic keyword stems (RÚV and other Icelandic feeds). Prefix matching
// handles inflections. Documented MVP coverage; AI analysis refines later.
const IS_KEYWORDS: Partial<Record<EventCategory, string[]>> = {
  military_conflict: ["árás", "sprengja", "hernaður"],
  political_instability: ["verkfall", "mótmæl", "kosningar", "þingkosningar", "forsetakosningar", "þingrofi", "stjórnarkreppa"],
  trade_restrictions: ["útflutningsbann", "innflutningsbann"],
  sanctions: ["viðskiptabann"],
  tariffs: ["toll"],
  natural_disasters: ["jarðskjálft", "eldgos", "snjóflóð", "flóð", "óveður", "eldfjall"],
  energy_disruptions: ["rafmagnsleysi", "hitaveita", "orkuskortur"],
  shipping_disruptions: ["höfn", "siglingar", "flutningaskip", "vöruflutningar"],
  economic_instability: ["verðbólg", "vextir", "gjaldþrot", "efnahagskreppa"],
  infrastructure_disruptions: ["samgöngurof", "vegbilun"],
  diplomatic_developments: ["samningur", "viðræður", "sendiherra", "utanríkisráðherra"],
  cybersecurity_incidents: ["netárás", "tölvuárás", "hakkari", "gagnaleki"],
};
for (const rule of CATEGORY_RULES) {
  rule.keywords.push(...(IS_KEYWORDS[rule.category] ?? []));
}
const IS_STEMS = new Set(Object.values(IS_KEYWORDS).flat());
const COUNTRY_NAMES: Record<string, string> = {
  "united states": "US", "usa": "US", "u.s.": "US", "american": "US",
  "china": "CN", "chinese": "CN", "beijing": "CN",
  "russia": "RU", "russian": "RU", "moscow": "RU", "kremlin": "RU",
  "ukraine": "UA", "ukrainian": "UA", "kyiv": "UA",
  "germany": "DE", "german": "DE", "france": "FR", "french": "FR",
  "united kingdom": "GB", "britain": "GB", "british": "GB", "uk": "GB",
  "iran": "IR", "iranian": "IR", "israel": "IL", "israeli": "IL", "gaza": "IL",
  "saudi arabia": "SA", "saudi": "SA", "egypt": "EG", "egyptian": "EG",
  "japan": "JP", "japanese": "JP", "south korea": "KR", "north korea": "KP",
  "india": "IN", "indian": "IN", "pakistan": "PK", "pakistani": "PK",
  "turkey": "TR", "turkish": "TR", "taiwan": "TW", "brazil": "BR",
  "mexico": "MX", "canada": "CA", "canadian": "CA", "australia": "AU",
  "south africa": "ZA", "nigeria": "NG", "kenya": "KE", "ethiopia": "ET",
  "sudan": "SD", "syria": "SY", "syrian": "SY", "yemen": "YE", "houthi": "YE",
  "lebanon": "LB", "hezbollah": "LB", "iraq": "IQ", "afghanistan": "AF",
  "taliban": "AF", "indonesia": "ID", "philippines": "PH", "vietnam": "VN",
  "venezuela": "VE", "argentina": "AR", "chile": "CL", "peru": "PE",
  "colombia": "CO", "norway": "NO", "sweden": "SE", "poland": "PL",
  "italy": "IT", "spain": "ES", "netherlands": "NL", "belgium": "BE",
  "switzerland": "CH", "greece": "GR", "hungary": "HU", "romania": "RO",
  "singapore": "SG", "malaysia": "MY", "thailand": "TH", "bangladesh": "BD",
  "sri lanka": "LK", "myanmar": "MM", "somalia": "SO", "libya": "LY",
  "algeria": "DZ", "morocco": "MA", "qatar": "QA", "uae": "AE",
  "united arab emirates": "AE", "kuwait": "KW", "jordan": "JO",
  "georgia": "GE", "armenia": "AM", "azerbaijan": "AZ", "kazakhstan": "KZ",
  "belarus": "BY", "moldova": "MD", "serbia": "RS", "croatia": "HR",
  "denmark": "DK", "finland": "FI", "ireland": "IE", "portugal": "PT",
  "new zealand": "NZ", "cuba": "CU", "haiti": "HT", "ecuador": "EC",
  "bolivia": "BO", "panama": "PA", "ghana": "GH", "senegal": "SN",
  "mali": "ML", "niger": "NE", "chad": "TD", "cameroon": "CM", "congo": "CD",
  "angola": "AO", "mozambique": "MZ", "zimbabwe": "ZW", "zambia": "ZM",
  "uganda": "UG", "rwanda": "RW", "tanzania": "TZ", "nepal": "NP",
  "mongolia": "MN", "cambodia": "KH", "laos": "LA", "brunei": "BN",
  "iceland": "IS", "icelandic": "IS", "ísland": "IS", "íslensk": "IS", "reykjavík": "IS", "reykjavik": "IS", "reykjanes": "IS", "reykjanesi": "IS", "reykjanesskaga": "IS", "reykjanesskagi": "IS",
};

const REGION_BY_COUNTRY: Record<string, string> = {
  US: "Americas", CA: "Americas", MX: "Americas", BR: "Americas", AR: "Americas",
  CL: "Americas", PE: "Americas", CO: "Americas", VE: "Americas", EC: "Americas",
  BO: "Americas", PA: "Americas", CU: "Americas", HT: "Americas",
  GB: "Europe", FR: "Europe", DE: "Europe", IT: "Europe", ES: "Europe",
  NL: "Europe", BE: "Europe", CH: "Europe", GR: "Europe", HU: "Europe",
  RO: "Europe", PL: "Europe", NO: "Europe", SE: "Europe", DK: "Europe",
  FI: "Europe", IE: "Europe", PT: "Europe", UA: "Europe", RU: "Europe",
  BY: "Europe", MD: "Europe", RS: "Europe", HR: "Europe", GE: "Europe",
  AM: "Europe", AZ: "Europe",
  EG: "Middle East", SA: "Middle East", IR: "Middle East", IL: "Middle East",
  YE: "Middle East", LB: "Middle East", IQ: "Middle East", SY: "Middle East",
  JO: "Middle East", QA: "Middle East", AE: "Middle East", KW: "Middle East",
  TR: "Middle East",
  CN: "East Asia", JP: "East Asia", KR: "East Asia", KP: "East Asia",
  TW: "East Asia", MN: "East Asia",
  IN: "South Asia", PK: "South Asia", BD: "South Asia", LK: "South Asia",
  NP: "South Asia", AF: "South Asia",
  SG: "Southeast Asia", MY: "Southeast Asia", TH: "Southeast Asia",
  ID: "Southeast Asia", PH: "Southeast Asia", VN: "Southeast Asia",
  MM: "Southeast Asia", KH: "Southeast Asia", LA: "Southeast Asia", BN: "Southeast Asia",
  NG: "Africa", KE: "Africa", ET: "Africa", SD: "Africa", SO: "Africa",
  LY: "Africa", DZ: "Africa", MA: "Africa", GH: "Africa", SN: "Africa",
  ML: "Africa", NE: "Africa", TD: "Africa", CM: "Africa", CD: "Africa",
  AO: "Africa", MZ: "Africa", ZW: "Africa", ZM: "Africa", UG: "Africa",
  RW: "Africa", TZ: "Africa", ZA: "Africa",
  AU: "Oceania", NZ: "Oceania", KZ: "Central Asia", IS: "Europe",
};

function countHits(text: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Non-ASCII (e.g. Icelandic) keywords use Unicode-aware boundaries and
  // prefix matching so inflected forms (jarðskjálfta vs jarðskjálfti) hit.
  const re = (/[^\x00-\x7F]/.test(keyword) || IS_STEMS.has(keyword))
    ? new RegExp("(?:^|[^\\p{L}\\p{N}])" + escaped + "[\\p{L}\\p{N}]*", "giu")
    : new RegExp("\\b" + escaped + "(?:e?s)?\\b", "gi");
  return (text.match(re) ?? []).length;
}

/** Detects Icelandic vs English from characteristic characters. */
export function detectLanguage(title: string, content: string): string {
  return /[ðþæöáéíóúý]/i.test((title ?? "") + " " + (content ?? "")) ? "is" : "en";
}


// Sports/entertainment exclusion: title-level blocklist. A matching title is
// excluded UNLESS the category score is >= 4 (strong geopolitical signal).
// Fixes real false positives (e.g. "Africa Cup title ..." -> political via a
// description-word "protest"). Documented, transparent, testable.
const SPORTS_ENTERTAINMENT_TERMS = [
  "football", "soccer", "basketball", "handball", "volleyball", "tennis", "golf",
  "cricket", "rugby", "premier league", "champions league", "europa league",
  "africa cup", "world cup", "nba", "nfl", "nhl", "mlb", "transfer window",
  "impersonator", "comedian", "comedy special", "award show", "grammy", "oscar",
  "eurovision", "christmas tree", "royal baby",
  "fótbolti", "körfubolti", "handknattleikur", "íþrótt", "íþrótta", "landslið",
  "liði vikunnar", "meistaradeild", "enska boltinn", "keppni", "leikur",
];

function titleHasSportsEntertainment(title: string): boolean {
  const t = (title ?? "").toLowerCase();
  return SPORTS_ENTERTAINMENT_TERMS.some((term) => countHits(t, term) > 0);
}
/** Classifies an article with transparent keyword rules. */
export function classifyArticle(title: string, content: string): Classification {
  const t = (title ?? "").toLowerCase();
  const c = (content ?? "").toLowerCase();
  let best: { category: EventCategory; score: number; keywords: string[] } | null = null;
  for (const rule of CATEGORY_RULES) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of rule.keywords) {
      const hits = countHits(t, kw) * 2 + countHits(c, kw);
      if (hits > 0) { score += hits; matched.push(kw); }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category: rule.category, score, keywords: matched };
    }
  }
  const countries: string[] = [];
  const combined = t + " " + c;
  for (const [name, iso] of Object.entries(COUNTRY_NAMES)) {
    if (countHits(combined, name) > 0 && !countries.includes(iso)) countries.push(iso);
  }
  const primaryCountry = countries[0] ?? null;
  const excluded = best !== null && best.score < 4 && titleHasSportsEntertainment(t);
  return {
    relevant: best !== null && !excluded,
    category: best && !excluded ? best.category : null,
    score: best && !excluded ? best.score : 0,
    countries,
    primaryCountry,
    region: primaryCountry ? (REGION_BY_COUNTRY[primaryCountry] ?? null) : null,
    matchedKeywords: best && !excluded ? best.keywords : [],
  };
}