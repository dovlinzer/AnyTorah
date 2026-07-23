// Scanned-daf image lookup — ported from native's TalmudPageManager.swift.
// `public/pages.json` maps tractate -> zero-based page number -> Google Drive file ID:
//   { "Berakhot": { "2": "DRIVE_FILE_ID", "3": "DRIVE_FILE_ID", ... }, ... }
// Page number <-> daf/amud:
//   page = (daf - 1) * 2       for amud aleph (side a)
//   page = (daf - 1) * 2 + 1   for amud bet   (side b)

export type TalmudPages = Record<string, Record<string, string>>;

// pages.json's keys match the Google Drive directory names, which use older/alternate
// transliterations that differ from Sefaria's spelling for these three tractates.
const SEFARIA_TO_PAGE_KEY: Record<string, string> = {
  Eruvin: "Eiruvin",
  Chullin: "Hullin",
  Taanit: "Ta'anit",
};

function pageKey(sefariaTractateName: string): string {
  return SEFARIA_TO_PAGE_KEY[sefariaTractateName] ?? sefariaTractateName;
}

export function hasPages(pages: TalmudPages, sefariaTractateName: string): boolean {
  const entries = pages[pageKey(sefariaTractateName)];
  return !!entries && Object.keys(entries).length > 0;
}

/** Google Drive file ID for the given daf amud, or null if not covered. */
export function dafImageFileId(
  pages: TalmudPages,
  sefariaTractateName: string,
  daf: number,
  sideA: boolean,
): string | null {
  const pageNumber = (daf - 1) * 2 + (sideA ? 0 : 1);
  return pages[pageKey(sefariaTractateName)]?.[String(pageNumber)] ?? null;
}

/** Direct Google Drive thumbnail URL — used for the "open full size" link, not the <img> src
 *  itself (see dafImageProxyUrl for why the embedded image goes through our own API route). */
export function dafImageUrl(
  pages: TalmudPages,
  sefariaTractateName: string,
  daf: number,
  sideA: boolean,
): string | null {
  const fileId = dafImageFileId(pages, sefariaTractateName, daf, sideA);
  // sz=w1600 requests a ~1600px-wide rendition from Drive's public thumbnail endpoint.
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600` : null;
}

/** Our own proxy for the given Drive file ID — see app/api/dafImage/route.ts. */
export function dafImageProxyUrl(fileId: string): string {
  return `/api/dafImage?id=${encodeURIComponent(fileId)}`;
}

let cached: TalmudPages | null = null;
let inflight: Promise<TalmudPages> | null = null;

/** Fetches and caches public/pages.json (~230KB) — only loaded once, on first Talmud visit. */
export function loadTalmudPages(): Promise<TalmudPages> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/pages.json")
      .then((res) => res.json())
      .then((json: TalmudPages) => {
        cached = json;
        return json;
      })
      .catch(() => {
        inflight = null;
        return {} as TalmudPages;
      });
  }
  return inflight;
}
