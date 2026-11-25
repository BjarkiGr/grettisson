// PRISM V2.1 Phase 4 — deterministic event dedup similarity (pure).
// Candidates are pre-filtered by category + primary country + 14-day window
// (hard requirements). Similarity then weighs title overlap and temporal
// proximity. Uncertain matches NEVER auto-merge.

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "after", "over", "into", "amid", "says", "said", "will", "are", "was", "has", "have", "its", "his", "her", "their", "about", "against", "between", "under", "more", "than", "new", "how", "why", "what", "when", "where", "which", "who", "been", "were", "but", "not", "can", "could", "would", "should", "may", "might", "also", "very", "just", "some", "such", "only", "own", "same", "too", "any", "each", "few", "most", "other", "out", "off", "again", "once", "here", "there", "all", "both", "during", "before", "while", "through", "up", "down", "then", "now"]); 

export function titleTokens(s: string): Set<string> {
  return new Set(String(s ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

/** Jaccard similarity of meaningful title tokens (0-1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a), tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export const MERGE_THRESHOLD = 0.6;

/** Weighted similarity: title 0.7, temporal proximity 0.3 (14-day decay). */
export function eventSimilarity(articleTitle: string, cand: { title: string; last_updated_at: string }, nowMs: number): number {
  const t = titleSimilarity(articleTitle, cand.title);
  const ageDays = Math.max(0, (nowMs - Date.parse(cand.last_updated_at)) / 86400000);
  const temporal = Math.max(0, 1 - ageDays / 14);
  return 0.7 * t + 0.3 * temporal;
}
