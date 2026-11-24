// PRISM — process-articles Edge Function (Phase 3).
// Claims pending process_article jobs atomically, classifies articles with
// transparent keyword rules, links them to matching events or creates
// clearly-labeled PROVISIONAL events, and queues analyze_event jobs (which
// wait for Phase 4). Bounded retries; idempotent; small batches.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { classifyArticle } from "../_shared/classify.ts";
import type { SupabaseClient } from "../_shared/database.ts";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
const EVENT_MATCH_DAYS = 14;

interface JobRow {
  id: string;
  entity_id: string | null;
  attempts: number;
}

async function processOne(db: SupabaseClient, job: JobRow): Promise<string> {
  if (!job.entity_id) throw new Error("job has no entity_id");
  const { data: article, error } = await db
    .from("articles")
    .select("id, title, content, url, published_at")
    .eq("id", job.entity_id)
    .single();
  if (error || !article) throw new Error("article load failed: " + (error?.message ?? "not found"));

  const cls = classifyArticle(article.title, article.content ?? "");

  if (!cls.relevant || !cls.category) {
    await db.from("articles").update({ processing_status: "irrelevant" }).eq("id", article.id);
    return "irrelevant";
  }

  await db.from("articles").update({ processing_status: "classified" }).eq("id", article.id);

  // Match an existing recent event: same category + primary country.
  let eventId: string | null = null;
  if (cls.primaryCountry) {
    const cutoff = new Date(Date.now() - EVENT_MATCH_DAYS * 86400000).toISOString();
    const { data: matches } = await db
      .from("events")
      .select("id")
      .eq("category", cls.category)
      .eq("primary_country", cls.primaryCountry)
      .gte("last_updated_at", cutoff)
      .order("last_updated_at", { ascending: false })
      .limit(1);
    if (matches && matches.length > 0) eventId = matches[0].id;
  }

  let created = false;
  if (!eventId) {
    const { data: newEvent, error: evErr } = await db
      .from("events")
      .insert({
        title: article.title,
        summary: "PROVISIONAL event created by rule-based classification (Phase 3). AI assessment pending (Phase 4). Excerpt: " + (article.content ?? "").slice(0, 600),
        category: cls.category,
        primary_country: cls.primaryCountry,
        region: cls.region,
        status: "active",
      })
      .select("id")
      .single();
    if (evErr || !newEvent) throw new Error("event create failed: " + (evErr?.message ?? "no row"));
    eventId = newEvent.id;
    created = true;
  } else {
    await db.from("events").update({ last_updated_at: new Date().toISOString() }).eq("id", eventId);
  }

  const { error: linkErr } = await db
    .from("event_articles")
    .upsert({ event_id: eventId, article_id: article.id }, { onConflict: "event_id,article_id", ignoreDuplicates: true });
  if (linkErr) throw new Error("link failed: " + linkErr.message);

  const { error: jobErr } = await db.from("processing_jobs").insert({
    job_type: "analyze_event",
    entity_id: eventId,
  });
  if (jobErr && jobErr.code !== "23505") throw new Error("analysis queue failed: " + jobErr.message);

  return created ? "event_created" : "event_matched";
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const db = createServiceClient();
    const { data: jobs, error } = await db
      .from("processing_jobs")
      .select("id, entity_id, attempts")
      .eq("job_type", "process_article")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error("job query failed: " + error.message);

    const results = { processed: 0, irrelevant: 0, events_created: 0, events_matched: 0, retried: 0, failed: 0, skipped: 0 };

    for (const job of (jobs ?? []) as JobRow[]) {
      // Atomic claim: only one invocation can move pending -> running.
      const { data: claimed } = await db
        .from("processing_jobs")
        .update({ status: "running", attempts: job.attempts + 1 })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("id");
      if (!claimed || claimed.length === 0) { results.skipped++; continue; }

      try {
        const outcome = await processOne(db, job);
        await db.from("processing_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString(), last_error: null })
          .eq("id", job.id);
        results.processed++;
        if (outcome === "irrelevant") results.irrelevant++;
        else if (outcome === "event_created") results.events_created++;
        else results.events_matched++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const exhausted = job.attempts + 1 >= MAX_ATTEMPTS;
        await db.from("processing_jobs")
          .update({ status: exhausted ? "failed" : "pending", last_error: message })
          .eq("id", job.id);
        if (exhausted) results.failed++;
        else results.retried++;
      }
    }

    return jsonResponse({
      status: "ok",
      function: "process-articles",
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] process-articles failed:", message);
    return jsonResponse({ status: "error", function: "process-articles", error: message }, 500);
  }
});
