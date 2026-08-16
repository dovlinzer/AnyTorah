// Looks up the internal page id themercava.com/app uses for a given Talmud daf/amud, backed by
// the `mercava_daf_ids` Supabase table (supabase/migrations/005_mercava_daf_ids.sql) rather than
// a build-time-baked file — see that migration's own comment for why: these ids are collected by
// a scraper (scripts/mercava/, see that directory's own comments for how — walking the site's own
// metanav/frameless API's nextPageId links, not a guessed formula) that's meant to be re-run
// periodically (.github/workflows/refresh-mercava-ids.yml) in case Mercava's ids ever change, and
// reading live from Supabase means a refreshed id reaches users immediately, no redeploy needed.
//
// Coverage: the 36-ish real-Gemara Bavli tractates Mercava itself lists under Talmud > Talmud
// Bavli (see scripts/mercava/tractates.mjs) — the same set textCatalog.ts's talmudSedarim exposes
// minus the three mishnahOnly tractates (Kinnim, Tamid, Middot), which have no Gemara and aren't
// on Mercava's own site either. A tractate the scraper hasn't successfully covered yet (seed-click
// flakiness — see scrape.mjs) just has no rows, so useMercavaUrl returns null for it, same as any
// other "not covered" case.
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TractateAmudMap = Record<string, number>;

let cache: Record<string, TractateAmudMap> | null = null;
let inflight: Promise<Record<string, TractateAmudMap>> | null = null;

function loadAll(): Promise<Record<string, TractateAmudMap>> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await createClient()
        .from("mercava_daf_ids")
        .select("tractate, daf_amud, mercava_id");
      const map: Record<string, TractateAmudMap> = {};
      if (error) {
        console.error("mercava_daf_ids fetch failed:", error.message);
      } else {
        for (const row of data ?? []) {
          (map[row.tractate] ??= {})[row.daf_amud] = row.mercava_id;
        }
      }
      cache = map;
      return map;
    })();
  }
  return inflight;
}

/**
 * React hook returning the themercava.com/app URL for a given tractate/daf/amud, or null while
 * the table is still loading or this specific daf isn't covered. The whole table is small
 * (thousands of rows, not millions) and fetched once per page load and cached module-wide, so
 * every Talmud page after the first pays no extra cost.
 */
export function useMercavaUrl(
  tractateSefariaName: string | null,
  daf: number,
  amud: "a" | "b",
): string | null {
  const [table, setTable] = useState(cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadAll().then((m) => {
      if (!cancelled) setTable(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tractateSefariaName || !table) return null;
  const id = table[tractateSefariaName]?.[`${daf}${amud}`];
  return id == null ? null : `https://www.themercava.com/app/books/metanav/${id}`;
}
