// PRISM — shared URL normalization + content hashing (Phase 3).
// Pure functions (Web Crypto works in both Deno and Node 22).

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref_src$|ref_url$|cmpid$|ito$|ns_)/i;

/**
 * Normalizes a URL for deduplication: lowercase host, no fragment, no
 * tracking params, no default port, no trailing slash, sorted params.
 * The article path/query identity is preserved (original source URL is
 * retained apart from tracking noise). Returns null for invalid URLs.
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) u.port = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return null;
  }
}

/** Stable SHA-256 hex hash over normalized title + URL (dedup key). */
export async function contentHash(title: string, normalizedUrl: string): Promise<string> {
  const data = new TextEncoder().encode(title.trim().toLowerCase() + "\n" + normalizedUrl);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
