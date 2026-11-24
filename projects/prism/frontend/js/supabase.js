// PRISM — supabase.js
// Lazy loader for the Supabase JavaScript client. No build step, no install:
// the client is imported as an ES module from a pinned CDN version, and only
// when a configured connection is actually requested.

import { config, isConfigured } from "./config.js";

const SUPABASE_JS_CDN = "https://esm.sh/@supabase/supabase-js@2.45.4";

let clientPromise = null;

/**
 * Returns a promise for the shared Supabase client.
 * Rejects with a clear error when configuration is missing (Phase 0 state).
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient>}
 */
export function getClient() {
  if (!isConfigured()) {
    return Promise.reject(new Error(
      "Supabase is not configured. Set supabaseUrl and supabaseAnonKey in js/config.js (Phase 2)."
    ));
  }
  if (!clientPromise) {
    clientPromise = import(SUPABASE_JS_CDN).then((mod) =>
      mod.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    );
  }
  return clientPromise;
}
