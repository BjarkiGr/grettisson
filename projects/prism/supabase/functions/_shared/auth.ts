// PRISM V2.1 Phase 1 — request authentication helpers (backend only).
// The hosted gateway (verify_jwt = true) verifies JWT signatures BEFORE
// the handler runs; payload role claims are therefore trustworthy here.
// Pipeline functions accept ONLY the service-role key (cron sends it from
// Vault). The public anon/publishable key is NOT a service credential.

export function bearerToken(req: Request): string | null {
  const m = (req.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** True only for a gateway-verified service_role JWT. */
export function isServiceRole(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

/** Bounded JSON body reader. Returns null when oversized or malformed. */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(len) && len > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
