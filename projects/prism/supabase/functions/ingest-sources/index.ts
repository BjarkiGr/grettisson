// PRISM — ingest-sources Edge Function (Phase 3).
// Fetches active RSS sources in small batches, parses items, normalizes,
// deduplicates via content_hash, stores new articles and queues processing.
// Stateless, idempotent, per-source error isolation. Never processes an
// entire archive: MAX_SOURCES and MAX_ITEMS_PER_FEED bound every run.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { parseFeed } from "../_shared/rss.ts";
import { normalizeUrl, contentHash } from "../_shared/normalize.ts";

const MAX_SOURCES = 8;
const MAX_ITEMS_PER_FEED = 25;
const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = "PRISM/1.0 (geopolitical intelligence research; +https://github.com/BjarkiGr/grettisson)";

interface SourceStats {
  source_id: string;
  name: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  skipped: number;
  error: string | null;
}

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const db = createServiceClient();
    const { data: sources, error } = await db
      .from("sources")
      .select("id, name, feed_url")
      .eq("active", true)
      .not("feed_url", "is", null)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(MAX_SOURCES);
    if (error) throw new Error("source query failed: " + error.message);

    const details: SourceStats[] = [];
    let totalInserted = 0;
    let totalDuplicates = 0;

    for (const source of sources ?? []) {
      const stats: SourceStats = {
        source_id: source.id, name: source.name,
        fetched: 0, inserted: 0, duplicates: 0, skipped: 0, error: null,
      };
      try {
        const xml = await fetchFeed(source.feed_url);
        const items = parseFeed(xml).slice(0, MAX_ITEMS_PER_FEED);
        stats.fetched = items.length;
        for (const item of items) {
          const url = normalizeUrl(item.link);
          if (!url) { stats.skipped++; continue; }
          const hash = await contentHash(item.title, url);
          const { data: inserted, error: insErr } = await db
            .from("articles")
            .upsert({
              source_id: source.id,
              title: item.title,
              url,
              author: item.author,
              published_at: item.publishedAt,
              content: item.description || null,
              content_hash: hash,
              language: "en",
              processing_status: "pending",
            }, { onConflict: "content_hash", ignoreDuplicates: true })
            .select("id");
          if (insErr) { stats.skipped++; stats.error = "insert: " + insErr.message; continue; }
          if (inserted && inserted.length > 0) {
            stats.inserted++;
            const { error: jobErr } = await db.from("processing_jobs").insert({
              job_type: "process_article",
              entity_id: inserted[0].id,
            });
            // 23505 = an active job already exists (partial unique index): fine.
            if (jobErr && jobErr.code !== "23505") {
              stats.error = "queue: " + jobErr.message;
            }
          } else {
            stats.duplicates++;
          }
        }
      } catch (err) {
        stats.error = err instanceof Error ? err.message : String(err);
      }
      await db.from("sources").update({ last_checked_at: new Date().toISOString() }).eq("id", source.id);
      totalInserted += stats.inserted;
      totalDuplicates += stats.duplicates;
      details.push(stats);
    }

    return jsonResponse({
      status: "ok",
      function: "ingest-sources",
      timestamp: new Date().toISOString(),
      sources_checked: details.length,
      articles_inserted: totalInserted,
      duplicates_skipped: totalDuplicates,
      details,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] ingest-sources failed:", message);
    return jsonResponse({ status: "error", function: "ingest-sources", error: message }, 500);
  }
});
