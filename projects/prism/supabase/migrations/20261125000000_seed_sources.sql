-- ============================================================================
-- PRISM — 0002 source registry seed (Phase 3)
-- Real, public RSS feeds intended for syndication. Only titles, excerpts and
-- links are stored; full article text is never scraped. Idempotent.
-- Apply via SQL Editor or supabase db push AFTER 0001.
-- ============================================================================

insert into public.sources (name, url, feed_url, source_type, country, reliability_rating) values
  ('BBC News - World', 'https://www.bbc.co.uk/news/world', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'news_rss', 'GB', 4),
  ('Al Jazeera - All', 'https://www.aljazeera.com', 'https://www.aljazeera.com/xml/rss/all.xml', 'news_rss', 'QA', 3),
  ('DW - World', 'https://www.dw.com', 'https://rss.dw.com/rdf/rss-en-world', 'news_rss', 'DE', 4),
  ('The Guardian - World', 'https://www.theguardian.com/world', 'https://www.theguardian.com/world/rss', 'news_rss', 'GB', 4),
  ('NPR - World', 'https://www.npr.org/sections/world/', 'https://feeds.npr.org/1004/rss.xml', 'news_rss', 'US', 4),
  ('UN News - Global', 'https://news.un.org', 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', 'government', 'US', 5)
on conflict (url) do nothing;
