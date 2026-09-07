// Scanned Iggros Moshe page lookup — ported from native's TeshuvotPageManager.swift. Mirrors
// lib/talmudPages.ts's shape (bundled JSON + Google Drive thumbnail URL), but keyed by volume id
// + a siman->page index instead of Talmud's formulaic (daf,amud)->page arithmetic — Iggros Moshe's
// pagination has no such formula, hence the separate hand-maintained teshuvotSimanIndex.json (see
// AnyTorah/CLAUDE.md's "Teshuvot Contemporary" section for how that index was built/verified).

export type TeshuvotPages = Record<string, Record<string, string>>;
export type TeshuvotSimanIndex = Record<string, Record<string, number>>;

let pagesCache: TeshuvotPages | null = null;
let pagesInflight: Promise<TeshuvotPages> | null = null;

/** Fetches and caches public/teshuvotPages.json — only loaded once, on first Iggros Moshe visit. */
export function loadTeshuvotPages(): Promise<TeshuvotPages> {
  if (pagesCache) return Promise.resolve(pagesCache);
  if (!pagesInflight) {
    pagesInflight = fetch("/teshuvotPages.json")
      .then((res) => res.json())
      .then((json: TeshuvotPages) => {
        pagesCache = json;
        return json;
      })
      .catch(() => {
        pagesInflight = null;
        return {} as TeshuvotPages;
      });
  }
  return pagesInflight;
}

let simanIndexCache: TeshuvotSimanIndex | null = null;
let simanIndexInflight: Promise<TeshuvotSimanIndex> | null = null;

/** Fetches and caches public/teshuvotSimanIndex.json. */
export function loadTeshuvotSimanIndex(): Promise<TeshuvotSimanIndex> {
  if (simanIndexCache) return Promise.resolve(simanIndexCache);
  if (!simanIndexInflight) {
    simanIndexInflight = fetch("/teshuvotSimanIndex.json")
      .then((res) => res.json())
      .then((json: TeshuvotSimanIndex) => {
        simanIndexCache = json;
        return json;
      })
      .catch(() => {
        simanIndexInflight = null;
        return {} as TeshuvotSimanIndex;
      });
  }
  return simanIndexInflight;
}

/** Highest indexed siman for a volume — computed from the loaded index rather than a hardcoded
 *  count, so it can't drift out of sync with the data as it's corrected over time. Falls back to
 *  a generous placeholder before the index has loaded, same "generous range + graceful overshoot"
 *  pattern native uses elsewhere (e.g. Rosh's per-klal siman counts) for an as-yet-unknown ceiling. */
export function teshuvotSimanCount(index: TeshuvotSimanIndex | null, volumeId: string): number {
  const entries = index?.[volumeId];
  if (!entries) return 300;
  const keys = Object.keys(entries).map(Number).filter((n) => Number.isFinite(n));
  return keys.length > 0 ? Math.max(...keys) : 300;
}

/** Page a given siman starts on — a floor lookup, not an exact-key requirement: the index only
 *  records where each teshuvah *begins*, so a siman falling mid-teshuvah (or a genuine numbering
 *  gap) resolves to the nearest lower siman's page rather than nothing, mirroring how the printed
 *  volume itself has no separate page per siman. Returns null only when nothing at or below the
 *  target is indexed yet (e.g. before the index has loaded). */
export function pageForSiman(index: TeshuvotSimanIndex | null, volumeId: string, siman: number): number | null {
  const entries = index?.[volumeId];
  if (!entries) return null;
  const exact = entries[String(siman)];
  if (exact != null) return exact;
  let bestSiman = -1;
  let bestPage: number | null = null;
  for (const [key, page] of Object.entries(entries)) {
    const k = Number(key);
    if (Number.isFinite(k) && k < siman && k > bestSiman) {
      bestSiman = k;
      bestPage = page;
    }
  }
  return bestPage;
}

/** Google Drive file ID for a given volume + page number, or null if not covered. */
export function teshuvotImageFileId(pages: TeshuvotPages | null, volumeId: string, page: number): string | null {
  return pages?.[volumeId]?.[String(page)] ?? null;
}
