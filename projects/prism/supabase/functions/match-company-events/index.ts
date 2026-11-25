// match-company-events — V2 Phase 3: personalized relevance (on demand).
// Auth: caller JWT. The profile is loaded THROUGH THE CALLER'S JWT client
// so owner RLS is enforced by Postgres itself; the service client is used
// ONLY for shared event data. Nothing is persisted; no AI is involved;
// the profile never leaves this function except as match results.
import { corsPreflight, json } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createServiceClient } from "../_shared/database.ts";
import { matchProfileToEvent, type ProfileFacts, type EventFacts } from "../_shared/relevance.ts";

const MAX_EVENTS = 100;
const MAX_RESULTS = 20;

Deno.serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const jwt = authHeader.slice(7);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: "Bearer " + jwt } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    // Profile via the caller's own client: RLS guarantees owner-only.
    const { data: prof } = await userClient.from("company_profiles").select("id").eq("user_id", userData.user.id).maybeSingle();
    if (!prof) return json({ has_profile: false, items: [] });
    const get = async (table: string) => (await userClient.from(table).select("*").eq("profile_id", prof.id)).data ?? [];
    const profile: ProfileFacts = {
      industries: await get("company_industries"),
      commodities: await get("company_commodities"),
      countries: await get("company_countries"),
      dependencies: await get("company_dependencies"),
    };

    // Optional single-event mode: relevance for one specific event page.
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body = list mode */ }
    const singleId = typeof body?.event_id === "string" && /^[0-9a-f-]{36}$/i.test(body.event_id) ? body.event_id : null;

    // Shared event data via service client (read-only here).
    const svc = createServiceClient();
    let evQuery = svc.from("events").select("id, title, event_type, occurred_at, status");
    evQuery = singleId ? evQuery.eq("id", singleId) : evQuery.eq("status", "active");
    const { data: events, error: evErr } = await evQuery.order("occurred_at", { ascending: false }).limit(MAX_EVENTS);
    if (evErr) return json({ error: "events_failed" }, 500);
    const ids = (events ?? []).map((e) => e.id);
    if (!ids.length) return json({ has_profile: true, items: [] });

    const [ec, ecty, ei, imp, ra, commodities, countries, routes] = await Promise.all([
      svc.from("event_commodities").select("event_id, commodity_id").in("event_id", ids),
      svc.from("event_countries").select("event_id, country_id").in("event_id", ids),
      svc.from("event_industries").select("event_id, industry").in("event_id", ids),
      svc.from("event_supply_chain_impacts").select("event_id, chokepoint, route_id").in("event_id", ids),
      svc.from("risk_assessments").select("event_id, overall_score, risk_level, scoring_version").in("event_id", ids),
      svc.from("commodities").select("id, slug"),
      svc.from("countries").select("id, iso_code"),
      svc.from("supply_chain_routes").select("id, name"),
    ]);
    const comSlug = new Map((commodities.data ?? []).map((c) => [c.id, c.slug]));
    const ctyCode = new Map((countries.data ?? []).map((c) => [c.id, c.iso_code]));
    const routeName = new Map((routes.data ?? []).map((r) => [r.id, r.name]));
    const latestRisk = new Map<string, Record<string, unknown>>();
    for (const r of ra.data ?? []) if (!latestRisk.has(r.event_id)) latestRisk.set(r.event_id, r);

    const factsFor = (id: string): EventFacts => ({
      commodity_slugs: (ec.data ?? []).filter((x) => x.event_id === id).map((x) => comSlug.get(x.commodity_id) ?? "").filter(Boolean),
      country_codes: (ecty.data ?? []).filter((x) => x.event_id === id).map((x) => ctyCode.get(x.country_id) ?? "").filter(Boolean),
      industries: (ei.data ?? []).filter((x) => x.event_id === id).map((x) => x.industry),
      chokepoints: (imp.data ?? []).filter((x) => x.event_id === id)
        .flatMap((x) => [x.chokepoint ?? "", x.route_id ? routeName.get(x.route_id) ?? "" : ""]).filter(Boolean),
    });

    const items = [];
    for (const ev of events ?? []) {
      const rel = matchProfileToEvent(profile, factsFor(ev.id));
      if (rel.exposure === "none" && !singleId) continue;
      const risk = latestRisk.get(ev.id) ?? null;
      items.push({
        event_id: ev.id, title: ev.title, event_type: ev.event_type, occurred_at: ev.occurred_at,
        exposure: rel.exposure, relevance_score: rel.relevance_score,
        explanation: rel.explanation, matches: rel.matches,
        global_risk: risk ? {
          overall_score: risk.scoring_version === "2.0.0" && risk.risk_level === "insufficient_evidence" ? null : risk.overall_score,
          risk_level: risk.risk_level, scoring_version: risk.scoring_version,
        } : null,
      });
    }
    if (singleId) return json({ has_profile: true, item: items[0] ?? null });
    items.sort((a, b) => b.relevance_score - a.relevance_score || String(b.occurred_at).localeCompare(String(a.occurred_at)));
    return json({ has_profile: true, items: items.slice(0, MAX_RESULTS) });
  } catch (_e) {
    return json({ error: "matching_error" }, 500);
  }
});
