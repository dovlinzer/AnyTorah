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
type Row = { tractate: string; daf_amud: string; mercava_id: number };

let cache: Record<string, TractateAmudMap> | null = null;
let inflight: Promise<Record<string, TractateAmudMap>> | null = null;

// PostgREST caps an unpaginated select at 1000 rows regardless of table size — a real bug hit
// here, not a theoretical one: with 5,246 rows in (tractate, daf_amud) primary-key order, the
// first unpaginated page ends partway through Bava Metzia, so Berakhot — the very first tractate
// in the app's own list — silently never loaded at all. Same class of bug already documented in
// AnyYCTorah's content-index scripts; the fix there is the fix here too: page with `.range()`
// until a page comes back short.
async function fetchAllRows(): Promise<Row[]> {
  const supabase = createClient();
  const rows: Row[] = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("mercava_daf_ids")
      .select("tractate, daf_amud, mercava_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data as Row[] | null) ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function loadAll(): Promise<Record<string, TractateAmudMap>> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchAllRows()
      .then((rows) => {
        const map: Record<string, TractateAmudMap> = {};
        for (const row of rows) {
          (map[row.tractate] ??= {})[row.daf_amud] = row.mercava_id;
        }
        cache = map;
        return map;
      })
      .catch((error) => {
        // Deliberately does NOT set `cache` here — caching a failed fetch as "loaded, empty"
        // would permanently hide the Mercava button for the rest of that page's JS lifetime (a
        // real bug hit in practice: loading the app before the table existed/was populated
        // poisoned `cache` to {} forever, with no retry, even after the data showed up
        // server-side). Clearing `inflight` lets the next mount's effect try again instead.
        console.error("mercava_daf_ids fetch failed:", error?.message ?? error);
        inflight = null;
        return {};
      });
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
