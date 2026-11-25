// PRISM — reclassify-articles Edge Function (admin-only maintenance).
// Re-runs the CURRENT classifier over all stored articles to repair legacy
// misclassification: marks newly-irrelevant articles, requeues newly-relevant
// ones, and deletes events whose entire article set became irrelevant
// (cascading their analyses/scores). Reports every change. Idempotent.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { classifyArticle } from "../_shared/classify.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "missing_token" }, 401);
    const db = createServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(jwt);
    if (userErr || !userData?.user) return jsonResponse({ error: "invalid_token" }, 401);
    const { data: profile } = await db.from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "admin") return jsonResponse({ error: "admin_only" }, 403);

    const { data: articles, error } = await db.from("articles")
      .select("id, title, content, processing_status").limit(2000);
    if (error) throw new Error("article load failed: " + error.message);

    const report = { scanned: 0, marked_irrelevant: 0, requeued: 0, events_deleted: [] as string[] };
    const affectedEventIds = new Set<string>();

    for (const a of articles ?? []) {
      report.scanned++;
      const cls = classifyArticle(a.title, a.content ?? "");
      if (!cls.relevant && ["pending", "queued", "processing", "classified", "analyzed"].includes(a.processing_status)) {
        await db.from("articles").update({ processing_status: "irrelevant" }).eq("id", a.id);
        report.marked_irrelevant++;
        const { data: links } = await db.from("event_articles").select("event_id").eq("article_id", a.id);
        for (const l of links ?? []) affectedEventIds.add(l.event_id);
      } else if (cls.relevant && a.processing_status === "irrelevant") {
        await db.from("articles").update({ processing_status: "pending" }).eq("id", a.id);
        const { error: jobErr } = await db.from("processing_jobs").insert({ job_type: "process_article", entity_id: a.id });
        if (jobErr && jobErr.code !== "23505") console.error("requeue failed", a.id, jobErr.message);
        report.requeued++;
      }
    }

    // Delete events whose ENTIRE article set is now irrelevant.
    for (const eventId of affectedEventIds) {
      const { data: links } = await db.from("event_articles").select("article_id").eq("event_id", eventId);
      const ids = (links ?? []).map((l) => l.article_id);
      if (ids.length === 0) continue;
      const { data: arts } = await db.from("articles").select("processing_status").in("id", ids);
      const allIrrelevant = (arts ?? []).length > 0 && (arts ?? []).every((x) => x.processing_status === "irrelevant");
      if (!allIrrelevant) continue;
      const { data: ev } = await db.from("events").select("title").eq("id", eventId).single();
      await db.from("processing_jobs").delete().eq("entity_id", eventId);
      await db.from("events").delete().eq("id", eventId); // cascades links/analyses/scores
      report.events_deleted.push(ev?.title ?? eventId);
    }

    return jsonResponse({ status: "ok", function: "reclassify-articles", ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] reclassify failed:", message);
    return jsonResponse({ status: "error", error: "internal_error" }, 500);
  }
});
