-- PRISM V2.1 Phase 1 — migration 0008: security hardening.
-- P0-04: viewers must not be able to trigger pipeline invocations via RPC.
-- Cron executes as the function owner (postgres); service_role keeps access.
revoke execute on function public.invoke_edge_function(text) from authenticated;
-- service_role grant from 0003 remains in force; anon remains revoked.
