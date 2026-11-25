// PRISM — manage-users Edge Function.
// Admin-only user management. Verifies the CALLER's JWT, checks their
// profile role server-side, then uses the service key (never exposed) for
// Supabase Auth admin operations. Created users are always 'viewer'.
// Nobody can delete themselves or an admin. Sign-ups remain disabled.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/database.ts";
import { readJsonLimited } from "../_shared/auth.ts";

const MAX_LIST = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const callerId = userData.user.id;

    const { data: profile } = await db.from("profiles").select("role").eq("id", callerId).single();
    if (profile?.role !== "admin") {
      return jsonResponse({ error: "admin_only", message: "Only administrators can manage users." }, 403);
    }

    const body = await readJsonLimited(req, 4096);
    if (body === null) return jsonResponse({ error: "invalid_body" }, 400);
    const action = body?.action;

    if (action === "list") {
      const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: MAX_LIST });
      if (error) return jsonResponse({ error: error.message }, 400);
      const ids = (data?.users ?? []).map((u) => u.id);
      const { data: profiles } = await db.from("profiles").select("id, role, display_name").in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      const users = (data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        role: byId.get(u.id)?.role ?? "viewer",
        display_name: byId.get(u.id)?.display_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_self: u.id === callerId,
      }));
      return jsonResponse({ status: "ok", users });
    }

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      if (!EMAIL_RE.test(email)) return jsonResponse({ error: "invalid_email" }, 400);
      if (password.length < 8) return jsonResponse({ error: "password_too_short", message: "Minimum 8 characters." }, 400);
      if (password.length > 128 || email.length > 254) return jsonResponse({ error: "invalid_input" }, 400);
      const { data: created, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      // Profile is auto-created by trigger with default role 'viewer'.
      // Role is NEVER taken from the request: admins cannot mint admins.
      return jsonResponse({ status: "ok", user: { id: created.user?.id, email, role: "viewer" } });
    }

    if (action === "delete") {
      const userId = String(body?.user_id ?? "");
      if (!userId) return jsonResponse({ error: "missing_user_id" }, 400);
      if (userId === callerId) return jsonResponse({ error: "cannot_delete_self" }, 400);
      const { data: target } = await db.from("profiles").select("role").eq("id", userId).single();
      if (target?.role === "admin") return jsonResponse({ error: "cannot_delete_admin" }, 400);
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ status: "ok", deleted: userId });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PRISM] manage-users failed:", message);
    return jsonResponse({ status: "error", error: "internal_error" }, 500);
  }
});
