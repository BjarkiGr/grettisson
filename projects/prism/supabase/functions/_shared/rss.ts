// PRISM — shared RSS/Atom parser (Phase 3).
// Lightweight, dependency-free parsing for RSS 2.0, RSS 1.0 (RDF) and Atom.
// Pure functions only (no Deno APIs) so Node can unit-test them via
// --experimental-strip-types. Handles CDATA and common XML entities.
// Excerpts are NOT assumed to be full article text (spec section 7).

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  author: string | null;
  publishedAt: string | null;
  guid: string | null;
}

const MAX_TITLE = 500;
const MAX_EXCERPT = 2000;

export function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function stripHtml(input: string): string {
  return decodeEntities(input).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : null;
}

function atomLink(block: string): string | null {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  let fallback: string | null = null;
  for (const l of links) {
    const href = l.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!href) continue;
    const rel = l.match(/rel\s*=\s*["']([^"']+)["']/i);
    if (!rel || rel[1].toLowerCase() === "alternate") return decodeEntities(href[1]);
    if (!fallback) fallback = decodeEntities(href[1]);
  }
  return fallback;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function makeItem(title: string | null, link: string | null, desc: string | null, author: string | null, date: string | null, guid: string | null): FeedItem | null {
  if (!title || !link) return null;
  return {
    title: stripHtml(title).slice(0, MAX_TITLE),
    link: link.trim(),
    description: stripHtml(desc ?? "").slice(0, MAX_EXCERPT),
    author: author ? stripHtml(author).slice(0, 200) : null,
    publishedAt: parseDate(date),
    guid,
  };
}

/** Parses a feed document into items; returns [] for unrecognized input. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const rssBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssBlocks) {
    const item = makeItem(
      tag(block, "title"),
      tag(block, "link"),
      tag(block, "description") ?? tag(block, "content:encoded"),
      tag(block, "author") ?? tag(block, "dc:creator"),
      tag(block, "pubDate") ?? tag(block, "dc:date"),
      tag(block, "guid"),
    );
    if (item) items.push(item);
  }
  if (items.length > 0) return items;
  const atomBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomBlocks) {
    const authorBlock = block.match(/<author\b[\s\S]*?<\/author>/i);
    const item = makeItem(
      tag(block, "title"),
      atomLink(block),
      tag(block, "summary") ?? tag(block, "content"),
      authorBlock ? tag(authorBlock[0], "name") : null,
      tag(block, "published") ?? tag(block, "updated"),
      tag(block, "id"),
    );
    if (item) items.push(item);
  }
  return items;
}
