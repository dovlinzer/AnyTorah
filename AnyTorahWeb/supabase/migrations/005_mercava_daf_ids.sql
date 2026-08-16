-- Maps a Talmud daf/amud to themercava.com/app's own internal page id, so the Reader's
-- "Mercava" button (components/Reader.tsx) can deep-link straight to the matching page instead
-- of just the site root. There's no public API or predictable formula for these ids (confirmed
-- live — they're plain incrementing primary keys, not derived from tractate/daf); they're
-- collected by walking the site's own metanav/frameless "next page" links (scripts/mercava/, see
-- that directory's own comments for the scraper itself).
--
-- Deliberately a real table, not a build-time-baked JSON file the app imports: Mercava's ids are
-- believed stable (plain DB primary keys, not something derived from daf number), but "believed
-- stable" isn't "guaranteed", and re-baking + redeploying a static file for what is genuinely
-- just a cache of someone else's data was judged not worth it — see scripts/mercava's own README
-- section for the periodic refresh job (.github/workflows/refresh-mercava-ids.yml) that keeps
-- this table current without a deploy.
create table if not exists mercava_daf_ids (
  tractate text not null,
  daf_amud text not null, -- e.g. "3a", "104b" — matches lib/textCatalog.ts's sefariaName + amud shape
  mercava_id integer not null,
  updated_at timestamptz not null default now(),
  primary key (tractate, daf_amud)
);

alter table mercava_daf_ids enable row level security;

-- Public read — this is non-sensitive reference data (a lookup table, not user content), read by
-- every visitor's browser via the anon key. Writes only ever happen from the scraper/upload
-- script using the service-role key, which bypasses RLS entirely, so no write policy is needed.
create policy "mercava_daf_ids_public_read" on mercava_daf_ids
  for select
  using (true);
