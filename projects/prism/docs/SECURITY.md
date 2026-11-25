# PRISM — Security Model (V2.1 Phase 1)

## Roles and access
- anon / publishable key: ZERO table privileges; privileged RPCs denied;
  ALL Edge Functions reject it at handler level (live-verified).
- authenticated (viewer): read intelligence; owner-only watchlists/company
  rows; cannot manage users, reclassify, or invoke pipeline RPCs (0008).
- authenticated (admin): manage-users, reclassify-articles (server-side
  role check; self-promotion blocked by column grants).
- service_role: pipeline functions (ingest/process/analyze/calculate-risk)
  and health-check accept ONLY a gateway-verified service_role JWT
  (_shared/auth.ts isServiceRole). Cron sends the Vault-held service key.

## Edge Function defenses
- Gateway verify_jwt=true for all 9 functions (config.toml explicit).
- Handler gates: service-role (pipeline/health), caller JWT + role
  (admin tools), caller JWT + consent (extraction), caller JWT + owner
  RLS (matching, profile read through the caller's own client).
- Bounded JSON bodies: manage-users 4KB, analyze-events 2KB,
  match-company-events 1KB, extraction description 20-4000 chars.
- Generic 500 bodies (internal_error); details only in server logs.
- Forged service-role JWTs rejected by gateway signature verification
  (live-verified with a bad-signature token).

## Credential rotation procedure
1. Groq: console.groq.com -> API Keys -> revoke old -> create new ->
   `npx supabase secrets set AI_API_KEY=<new> --project-ref yztwbnmaujcnpytewffz --yes`
   (from projects/prism). Verify: next analyze-events cron run succeeds.
2. Supabase service key: Dashboard -> Settings -> API -> regenerate ->
   update Vault: `select vault.update_secret((select id from vault.secrets
   where name = 'prism_service_key'), '<new key>');` -> verify cron_runs.
3. Never paste keys into chat, Git, frontend or SQL files. Secret scan
   before every push: gsk_ / sb_secret_ / eyJ patterns.

## Verification
- test/security-smoke.mjs: 102 static checks (import/export consistency,
  gate placement, bounds, generic errors, grants, config).
- test/phase1-live-probes.mjs: 13 live checks (anon/bad/forged JWTs, RPCs).
- Two-user isolation: owner RLS on all company tables + watchlists;
  live two-account test pending a viewer test account (user action).
