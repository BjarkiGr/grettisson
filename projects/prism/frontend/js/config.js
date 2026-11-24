// PRISM — config.js
// Centralized frontend configuration. PUBLIC values only.
// The Supabase anon key is public by design and safe to expose ONLY with
// Row Level Security enabled (Phase 2). NEVER put a service-role key or an
// AI API key here — those live exclusively in Supabase Edge Function secrets.
//
// Configured in Phase 2 for the PRISM Supabase project.
// See projects/prism/.env.example for where to find the values.

export const config = Object.freeze({
  appName: "PRISM",
  appVersion: "1.0.0",
  developmentPhase: 2,
  supabaseUrl: "https://yztwbnmaujcnpytewffz.supabase.co",
  supabaseAnonKey: "sb_publishable_84MdDT6CBV8u11kDXdb0qQ_LTLMeNnG", // publishable key (public, RLS-protected)
});

/** True when the public Supabase connection values have been configured. */
export function isConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
