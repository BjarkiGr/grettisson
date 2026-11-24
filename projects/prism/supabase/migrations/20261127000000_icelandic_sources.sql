-- ============================================================================
-- PRISM — 0004 Icelandic sources (post-Phase 7 addition)
-- RÚV: Icelandic national broadcaster (Icelandic language).
-- Grapevine: English-language Iceland coverage.
-- Both verified live and parseable. Idempotent.
-- ============================================================================

insert into public.sources (name, url, feed_url, source_type, country, reliability_rating) values
  ('RUV - Frettir', 'https://www.ruv.is/frettir', 'https://www.ruv.is/rss/frettir', 'news_rss', 'IS', 4),
  ('Grapevine - Iceland', 'https://grapevine.is', 'https://grapevine.is/feed/', 'news_rss', 'IS', 3)
on conflict (url) do nothing;
