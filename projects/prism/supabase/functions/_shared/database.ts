// PRISM — shared database client factory (backend only).
// Uses the service-role key, which is auto-injected by the Supabase hosted
// Edge runtime. This module must NEVER be imported by frontend code.
// Table access patterns are added in Phase 2+ once migrations exist.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing. In production these " +
        "are injected automatically; for local dev use --env-file.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
