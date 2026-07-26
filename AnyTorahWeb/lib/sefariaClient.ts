// Ported from AnyTorah/AnyTorah/API/SefariaTextClient.swift. Intended to run server-side
// (Server Components / Route Handlers) — uses Next.js `fetch` caching instead of the iOS
// app's URLCache disk cache. See /Users/dovlinzer/claudecode/AnyTorah/CLAUDE.md for the
// full Sefaria ref-quirks and SA-inline-marker documentation this file implements.

import {
  type CommentaryType,
  sefariaRef as commentarySefariaRef,
  sefariaRefVersions,
  saCommentatorDataName,
  usesBookDivider,
} from "./commentaryTypes";
import {
  type TextCategory,
  type SegmentLabelStyle,
  type TextSegment,
  type CommentaryEntry,
  contentSegment,
  amudBMarkerSegment,
  saHebrewLetter,
  SA_SLOT_STYLES,
} from "./textModels";
import {
  TextCatalog,
  type MishnahTractate,
} from "./textCatalog";

// MARK: - Errors

export class SefariaInvalidURLError extends Error {
  constructor() {
    super("Invalid Sefaria URL");
    this.name = "SefariaInvalidURLError";
  }
}

export class SefariaNetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`Network error: ${message}`);
    this.name = "SefariaNetworkError";
  }
}

export class SefariaNoTextError extends Error {
  constructor() {
    super("No text found");
    this.name = "SefariaNoTextError";
  }
}

export class SefariaDecodingError extends Error {
  constructor(public readonly status?: number) {
    super(status ? `Could not parse response (HTTP ${status})` : "Could not parse response");
    this.name = "SefariaDecodingError";
  }
}

function isNoText(error: unknown): boolean {
  return error instanceof SefariaNoTextError;
}

// MARK: - Retry

const REVALIDATE_SECONDS = 60 * 60; // 1h — Sefaria text content is effectively static

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(code: number): boolean {
  return code === 429 || (code >= 500 && code <= 599);
}

/** fetch()'s network-failure surface differs from URLError codes; timeouts (AbortError) and
 *  generic network TypeErrors (DNS/connection failures under undici) are treated as retryable. */
function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  return false;
}

function backoffMs(attempt: number): number {
  return 300 * (attempt + 1); // 0.3s, 0.6s, ...
}

/**
 * Fetches `url` with up to `attempts` tries, retrying only transient failures — timeouts,
 * connection failures, and 429/5xx responses — with short backoff between tries.
 */
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown = new Error("unknown");
  for (let attempt = 0; attempt < attempts; attempt++) {
    const isLastAttempt = attempt === attempts - 1;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (isRetryableStatus(res.status)) {
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error)) throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    if (isLastAttempt) throw lastError;
    await sleep(backoffMs(attempt));
  }
  throw lastError;
}

// MARK: - Ref building

// Kinnim and Middot have no Gemara — Sefaria doesn't index them by daf/amud at all, only as
// Mishnah chapters (confirmed live: "Kinnim 23a"/"Middot 34a" both 404). Shekalim has no Bavli
// text at all — only Jerusalem Talmud (confirmed live: "Shekalim 2a" 404, but it's printed and
// navigable in the Bavli volume/Daf Yomi cycle under Bavli-style daf pagination regardless). All
// three tractates are still printed (and navigable in this app) with their own daf/amud pages, so
// each daf+amud is mapped to the real ref that actually appears on that printed page. This is the
// same mapping already shipped in production in AnyDaf's SefariaClient.swift/.kt — reused here
// rather than re-derived, including a user-verified correction for Kinnim/Middot's exact
// chapter/mishnah boundaries (Kinnim has content only on amud alef of each daf — 22a/23a/24a/25a;
// there is no amud bet content for any Kinnim daf).
const NO_STANDARD_BAVLI_REF_TALMUD_REFS: Record<string, Record<string, string>> = {
  Shekalim: {
    "2a": "Jerusalem Talmud Shekalim 1:1:1-5",
    "2b": "Jerusalem Talmud Shekalim 1:1:5-10",
    "3a": "Jerusalem Talmud Shekalim 1:1:10-2:5",
    "3b": "Jerusalem Talmud Shekalim 1:2:5-4:1",
    "4a": "Jerusalem Talmud Shekalim 1:4:1-5",
    "4b": "Jerusalem Talmud Shekalim 1:4:5-9",
    "5a": "Jerusalem Talmud Shekalim 1:4:9-2:1:4",
    "5b": "Jerusalem Talmud Shekalim 2:1:4-3:1",
    "6a": "Jerusalem Talmud Shekalim 2:3:1-4:1",
    "6b": "Jerusalem Talmud Shekalim 2:4:1-5",
    "7a": "Jerusalem Talmud Shekalim 2:4:5-5:4",
    "7b": "Jerusalem Talmud Shekalim 2:5:4-3:1:3",
    "8a": "Jerusalem Talmud Shekalim 3:1:3-2:2",
    "8b": "Jerusalem Talmud Shekalim 3:2:2-8",
    "9a": "Jerusalem Talmud Shekalim 3:2:8-3:1",
    "9b": "Jerusalem Talmud Shekalim 3:3:1-4:1:1",
    "10a": "Jerusalem Talmud Shekalim 4:1:1-2:1",
    "10b": "Jerusalem Talmud Shekalim 4:2:1-4",
    "11a": "Jerusalem Talmud Shekalim 4:2:4-3:2",
    "11b": "Jerusalem Talmud Shekalim 4:3:2-4:1",
    "12a": "Jerusalem Talmud Shekalim 4:4:1-5",
    "12b": "Jerusalem Talmud Shekalim 4:4:5-9",
    "13a": "Jerusalem Talmud Shekalim 4:4:9-5:1:3",
    "13b": "Jerusalem Talmud Shekalim 5:1:3-12",
    "14a": "Jerusalem Talmud Shekalim 5:1:12-21",
    "14b": "Jerusalem Talmud Shekalim 5:1:21-3:2",
    "15a": "Jerusalem Talmud Shekalim 5:3:2-4:10",
    "15b": "Jerusalem Talmud Shekalim 5:4:10-6:1:5",
    "16a": "Jerusalem Talmud Shekalim 6:1:5-11",
    "16b": "Jerusalem Talmud Shekalim 6:1:11-2:1",
    "17a": "Jerusalem Talmud Shekalim 6:2:1-7",
    "17b": "Jerusalem Talmud Shekalim 6:2:7-3:3",
    "18a": "Jerusalem Talmud Shekalim 6:3:3-4:2",
    "18b": "Jerusalem Talmud Shekalim 6:4:2-7",
    "19a": "Jerusalem Talmud Shekalim 6:4:7-7:2:1",
    "19b": "Jerusalem Talmud Shekalim 7:2:1-7",
    "20a": "Jerusalem Talmud Shekalim 7:2:7-3:2",
    "20b": "Jerusalem Talmud Shekalim 7:3:2-7",
    "21a": "Jerusalem Talmud Shekalim 7:3:7-8:1:1",
    "21b": "Jerusalem Talmud Shekalim 8:1:1-3:1",
    "22a": "Jerusalem Talmud Shekalim 8:3:1-4:4",
    "22b": "Jerusalem Talmud Shekalim 8:4:4",
  },
  // Only amud alef of each daf has content; amud bet is absent (no text) for every Kinnim daf.
  Kinnim: {
    "22a": "Mishnah Kinnim 1",
    "23a": "Mishnah Kinnim 2",
    "24a": "Mishnah Kinnim 3:1-5",
    "25a": "Mishnah Kinnim 3:6",
  },
  Middot: {
    "34a": "Mishnah Middot 1:1-4",
    "34b": "Mishnah Middot 1:5-9",
    "35a": "Mishnah Middot 2:1-3",
    "35b": "Mishnah Middot 2:4-6",
    "36a": "Mishnah Middot 3",
    "36b": "Mishnah Middot 4:1-2",
    "37a": "Mishnah Middot 4:3-7",
    "37b": "Mishnah Middot 5",
  },
};

/**
 * Builds a Talmud-category ref for one amud, substituting the real ref for tractates that have
 * no standard Bavli daf ref on Sefaria (see NO_STANDARD_BAVLI_REF_TALMUD_REFS above). Falls back
 * to the standard "{tractate} {daf}{amud}" form for every other tractate, including Tamid
 * (mishnahOnly but has real Gemara from 25b on — only Shekalim/Kinnim/Middot need substitution).
 */
export function talmudAmudRef(sefariaTractateName: string, daf: number, amud: string): string {
  const override = NO_STANDARD_BAVLI_REF_TALMUD_REFS[sefariaTractateName]?.[`${daf}${amud}`];
  return override ?? `${sefariaTractateName} ${daf}${amud}`;
}

/** Builds the canonical Sefaria ref string for the given category + selection indices. */
export function ref(
  category: TextCategory,
  bookOrTractateIndex: number,
  chapterOrDaf: number,
  amud?: string,
): string {
  switch (category) {
    case "tanakh": {
      const book = TextCatalog.allTanakhBooks.find((b) => b.id === bookOrTractateIndex)
        ?? TextCatalog.allTanakhBooks[0];
      return `${book.sefariaName} ${chapterOrDaf}`;
    }
    case "mishnah": {
      const tractate = TextCatalog.allMishnahTractates.find((t) => t.id === bookOrTractateIndex)
        ?? TextCatalog.allMishnahTractates[0];
      return `${tractate.sefariaName} ${chapterOrDaf}`;
    }
    case "talmud": {
      const tractate = TextCatalog.allTalmudTractates.find((t) => t.id === bookOrTractateIndex)
        ?? TextCatalog.allTalmudTractates[0];
      return talmudAmudRef(tractate.sefariaName, chapterOrDaf, amud ?? "a");
    }
    case "rambam": {
      const work = TextCatalog.allRambamWorks.find((w) => w.id === bookOrTractateIndex)
        ?? TextCatalog.allRambamWorks[0];
      return `${work.sefariaName} ${chapterOrDaf}`;
    }
    case "shulchanArukh": {
      const section = TextCatalog.shulchanArukhSections.find((s) => s.id === bookOrTractateIndex)
        ?? TextCatalog.shulchanArukhSections[0];
      return `${section.sefariaName} ${chapterOrDaf}`;
    }
    case "tur": {
      const section = TextCatalog.turSections.find((s) => s.id === bookOrTractateIndex)
        ?? TextCatalog.turSections[0];
      return `${section.sefariaName} ${chapterOrDaf}`;
    }
    case "midrash":
      // Midrash uses verse-based navigation; this fallback shouldn't be called.
      return "";
  }
}

function buildURL(refStr: string, lang: string = "he"): string {
  const params = new URLSearchParams({ context: "0", lang });
  return `https://www.sefaria.org/api/texts/${encodeURIComponent(refStr)}?${params.toString()}`;
}

function flattenTextValue(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenTextValue);
  return [];
}

function segmentLabel(style: SegmentLabelStyle, number: number): string | null {
  switch (style) {
    case "verse": case "mishnah": case "halakha": case "sif":
      return `${number}`;
    case "none":
      return null;
  }
}

// MARK: - Low-level fetch

async function fetchSingleLang(refStr: string, lang: string): Promise<string[]> {
  const url = buildURL(refStr, lang);
  let res: Response;
  try {
    res = await fetchWithRetry(url);
  } catch (error) {
    throw new SefariaNetworkError(String(error), error);
  }
  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw new SefariaDecodingError(res.status);
  }
  if (typeof json.error === "string") {
    throw new SefariaNetworkError(json.error);
  }
  // v2 API: "he" key is always Hebrew; "text" key carries the requested translation
  const key = lang === "he" ? "he" : "text";
  const val = json[key];
  if (val === undefined) throw new SefariaNoTextError();
  const segs = flattenTextValue(val).filter((s) => s.trim() !== "");
  if (segs.length === 0) throw new SefariaNoTextError();
  return segs;
}

/** Fetches a single language's text segments. */
export async function fetchRaw(refStr: string, language: string): Promise<string[]> {
  return fetchSingleLang(refStr, language);
}

/** Fetches Hebrew and English segments in parallel with explicit lang parameters. */
export async function fetchBoth(
  refStr: string,
): Promise<{ hebrew: string[]; english: string[] }> {
  const [heRes, enRes] = await Promise.allSettled([
    fetchSingleLang(refStr, "he"),
    fetchSingleLang(refStr, "en"),
  ]);
  const heSegs = heRes.status === "fulfilled" ? heRes.value : [];
  const enSegs = enRes.status === "fulfilled" ? enRes.value : [];
  if (heSegs.length > 0 || enSegs.length > 0) {
    return { hebrew: heSegs, english: enSegs };
  }
  // Both sides came back empty. Surface whichever underlying failure isn't itself a genuine
  // "no text" — a network timeout / bad response looks identical to "no text" once swallowed.
  for (const r of [heRes, enRes]) {
    if (r.status === "rejected" && !isNoText(r.reason)) throw r.reason;
  }
  throw new SefariaNoTextError();
}

/**
 * Appends aligned (he, en) pairs to the output arrays.
 * When inner paragraph counts match, pairs directly. When one side has more paragraphs,
 * joins it into a single string paired with the minority. When both sides have multiple
 * paragraphs but different counts, pairs up to min then appends extras with an empty partner.
 */
function alignedAppend(
  hInner: string[],
  eInner: string[],
  heSegs: string[],
  enSegs: string[],
): void {
  if (hInner.length === 0 && eInner.length === 0) return;
  if (hInner.length === eInner.length) {
    for (let j = 0; j < hInner.length; j++) { heSegs.push(hInner[j]); enSegs.push(eInner[j]); }
  } else if (eInner.length === 0) {
    for (const h of hInner) { heSegs.push(h); enSegs.push(""); }
  } else if (hInner.length === 0) {
    for (const e of eInner) { heSegs.push(""); enSegs.push(e); }
  } else if (hInner.length === 1) {
    heSegs.push(hInner[0]);
    enSegs.push(eInner.join(" "));
  } else if (eInner.length === 1) {
    heSegs.push(hInner.join(" "));
    enSegs.push(eInner[0]);
  } else {
    const minCount = Math.min(hInner.length, eInner.length);
    for (let j = 0; j < minCount; j++) { heSegs.push(hInner[j]); enSegs.push(eInner[j]); }
    for (let j = minCount; j < hInner.length; j++) { heSegs.push(hInner[j]); enSegs.push(""); }
    for (let j = minCount; j < eInner.length; j++) { heSegs.push(""); enSegs.push(eInner[j]); }
  }
}

function nonEmpty(s: string): boolean {
  return s.trim() !== "";
}

/**
 * Fetches Hebrew and English from a single request, preserving structural alignment.
 *
 * Sefaria commentary texts are depth-3: outer array = one entry per mishnah/verse/halakha,
 * inner array = paragraphs within that entry. Hebrew typically has 1 inner paragraph per
 * entry while the English translation may have several. Naively flattening both and then
 * pairing positionally produces misalignment whenever inner counts differ.
 *
 * This pairs at the *outer* level first. Returns outerIndices[i] = the 0-based outer-array
 * position (e.g. mishnah number) that paragraph i belongs to, so callers can display a
 * per-mishnah label instead of a sequential paragraph counter.
 */
export async function fetchBothAligned(
  refStr: string,
): Promise<{ he: string[]; en: string[]; outerIndices: number[] }> {
  const url = buildURL(refStr, "en");
  let res: Response;
  try {
    res = await fetchWithRetry(url);
  } catch (error) {
    throw new SefariaNetworkError(String(error), error);
  }
  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw new SefariaDecodingError(res.status);
  }
  if (typeof json.error === "string") {
    throw new SefariaNetworkError(json.error);
  }
  const heVal = json.he;
  const enVal = json.text;
  if (heVal === undefined || enVal === undefined) throw new SefariaNoTextError();

  let heSegs: string[] = [];
  let enSegs: string[] = [];
  let outerIndices: number[] = [];

  const heArr = Array.isArray(heVal) ? heVal : null;
  const enArr = Array.isArray(enVal) ? enVal : null;

  if (heArr && enArr) {
    if (heArr.length === enArr.length) {
      for (let i = 0; i < heArr.length; i++) {
        const hInner = flattenTextValue(heArr[i]).filter(nonEmpty);
        const eInner = flattenTextValue(enArr[i]).filter(nonEmpty);
        const before = heSegs.length;
        alignedAppend(hInner, eInner, heSegs, enSegs);
        const added = heSegs.length - before;
        outerIndices.push(...Array(added).fill(i));
      }
    } else if (enArr.length === 0) {
      for (let i = 0; i < heArr.length; i++) {
        const hInner = flattenTextValue(heArr[i]).filter(nonEmpty);
        const before = heSegs.length;
        alignedAppend(hInner, [], heSegs, enSegs);
        const added = heSegs.length - before;
        outerIndices.push(...Array(added).fill(i));
      }
    } else if (heArr.length === 0) {
      for (let i = 0; i < enArr.length; i++) {
        const eInner = flattenTextValue(enArr[i]).filter(nonEmpty);
        const before = heSegs.length;
        alignedAppend([], eInner, heSegs, enSegs);
        const added = heSegs.length - before;
        outerIndices.push(...Array(added).fill(i));
      }
    } else {
      // Outer counts differ and both non-zero (e.g. intro: 1 he vs 7 en at top level).
      const hInner = flattenTextValue(heArr).filter(nonEmpty);
      const eInner = flattenTextValue(enArr).filter(nonEmpty);
      const before = heSegs.length;
      alignedAppend(hInner, eInner, heSegs, enSegs);
      const added = heSegs.length - before;
      outerIndices.push(...Array(added).fill(0));
    }
  } else {
    // Scalar values — fall back to flat lists.
    heSegs = flattenTextValue(heVal).filter(nonEmpty);
    enSegs = flattenTextValue(enVal).filter(nonEmpty);
    outerIndices = heSegs.map((_, i) => i);
  }

  if (heSegs.length === 0 && enSegs.length === 0) throw new SefariaNoTextError();
  return { he: heSegs, en: enSegs, outerIndices };
}

// MARK: - Full-daf fetch (Talmud)

/** Fetches both amudim of a Talmud daf and inserts an amud-B marker between them. */
export async function fetchFullDaf(tractateIndex: number, daf: number): Promise<TextSegment[]> {
  const tractate = TextCatalog.allTalmudTractates.find((t) => t.id === tractateIndex)
    ?? TextCatalog.allTalmudTractates[0];
  const refA = talmudAmudRef(tractate.sefariaName, daf, "a");
  const refB = talmudAmudRef(tractate.sefariaName, daf, "b");

  const [resultA, resultB] = await Promise.allSettled([fetchBoth(refA), fetchBoth(refB)]);
  const segsA = resultA.status === "fulfilled" ? resultA.value : null;
  const segsB = resultB.status === "fulfilled" ? resultB.value : null;

  const segments: TextSegment[] = [];

  if (segsA) {
    const count = Math.min(segsA.hebrew.length, segsA.english.length);
    for (let i = 0; i < count; i++) {
      segments.push(contentSegment(i, segsA.hebrew[i], segsA.english[i]));
    }
  }

  segments.push(amudBMarkerSegment(daf));

  if (segsB) {
    const startIdx = segsA ? Math.min(segsA.hebrew.length, segsA.english.length) : 0;
    const count = Math.min(segsB.hebrew.length, segsB.english.length);
    for (let i = 0; i < count; i++) {
      segments.push(contentSegment(startIdx + i, segsB.hebrew[i], segsB.english[i]));
    }
  }

  const valid = segments.filter((s) => s.isAmudBMarker || s.hebrewHTML !== "" || s.englishHTML !== "");
  if (valid.length > 0) return valid;

  for (const r of [resultA, resultB]) {
    if (r.status === "rejected" && !isNoText(r.reason)) throw r.reason;
  }
  throw new SefariaNoTextError();
}

// MARK: - Tosefta fetch

export async function fetchTosefta(tractate: MishnahTractate, chapter: number): Promise<TextSegment[]> {
  const r = `Tosefta ${tractate.name} ${chapter}`;
  const { hebrew: he, english: en } = await fetchBoth(r);
  const count = Math.max(he.length, en.length);
  const segments: TextSegment[] = [];
  for (let i = 0; i < count; i++) {
    const label = segmentLabel("mishnah", i + 1);
    segments.push(contentSegment(i, he[i] ?? "", en[i] ?? "", label));
  }
  const valid = segments.filter((s) => s.hebrewHTML !== "" || s.englishHTML !== "");
  if (valid.length === 0) throw new SefariaNoTextError();
  return valid;
}

// MARK: - Yerushalmi fetch

/** Removes Yerushalmi footnote markers and footnote text from raw HTML. Hebrew has none. */
export function stripYerushalmiFootnotes(html: string): string {
  // Pass 1: strip footnote markers — simple, no nesting issues.
  const s = html.replace(/<sup[^>]*class="footnote-marker"[^>]*>[\s\S]*?<\/sup>/gi, "");

  // Pass 2: strip <i class="footnote">…</i> blocks depth-first so nested <i> tags inside
  // the footnote body don't confuse the scan.
  let result = "";
  let remaining = s;
  const open = '<i class="footnote"';
  for (;;) {
    const openIdx = remaining.toLowerCase().indexOf(open.toLowerCase());
    if (openIdx === -1) { result += remaining; break; }
    result += remaining.slice(0, openIdx);
    remaining = remaining.slice(openIdx);
    const gtIdx = remaining.indexOf(">");
    if (gtIdx === -1) { result += remaining; break; }
    remaining = remaining.slice(gtIdx + 1);
    let depth = 1;
    while (depth > 0 && remaining.length > 0) {
      const lower = remaining.toLowerCase();
      const ni = lower.indexOf("<i");
      const nc = lower.indexOf("</i>");
      if (nc === -1) { remaining = ""; break; }
      if (ni !== -1 && ni < nc) {
        depth += 1;
        remaining = remaining.slice(ni + 2);
      } else {
        depth -= 1;
        remaining = remaining.slice(nc + 4);
      }
    }
  }
  return result;
}

export async function fetchYerushalmi(
  tractate: MishnahTractate,
  chapter: number,
  halakha: number = 1,
): Promise<TextSegment[]> {
  // Specify chapter:halakha so the API returns only that halakha's segments,
  // not the whole (flattened) chapter. halakha 1 == "Peah 1:1" == "Peah 1".
  const r = `Jerusalem Talmud ${tractate.name} ${chapter}:${halakha}`;
  const { hebrew: he, english: en } = await fetchBoth(r);
  const count = Math.max(he.length, en.length);
  const segments: TextSegment[] = [];
  for (let i = 0; i < count; i++) {
    const label = segmentLabel("halakha", i + 1);
    const rawEn = en[i] ?? "";
    segments.push(contentSegment(i, he[i] ?? "", stripYerushalmiFootnotes(rawEn), label));
  }
  const valid = segments.filter((s) => s.hebrewHTML !== "" || s.englishHTML !== "");
  if (valid.length === 0) throw new SefariaNoTextError();
  return valid;
}

/**
 * Returns the number of halakhot in `chapter` (1-based) for the given Yerushalmi tractate.
 * Uses Sefaria's /api/shape endpoint. Falls back to `defaultCount` on failure/out-of-range.
 */
export async function fetchYerushalmiHalakhaCount(
  tractate: MishnahTractate,
  chapter: number,
  defaultCount: number = 7,
): Promise<number> {
  try {
    const url = `https://www.sefaria.org/api/shape/${encodeURIComponent(`Jerusalem Talmud ${tractate.name}`)}`;
    const res = await fetchWithRetry(url);
    const json = await res.json();
    const first = Array.isArray(json) ? json[0] : undefined;
    const chapters = first?.chapters;
    if (!Array.isArray(chapters)) return defaultCount;
    const idx = chapter - 1;
    if (idx < 0 || idx >= chapters.length) return defaultCount;
    const count = Array.isArray(chapters[idx]) ? chapters[idx].length : 0;
    return Math.max(1, count);
  } catch {
    return defaultCount;
  }
}

// MARK: - Midrash fetch (verse-based via links API)

/**
 * Looks up which passage in `work` primarily treats `bookSefariaName chapter:verse` using
 * Sefaria's /api/links endpoint, then fetches and returns that passage.
 */
export async function fetchMidrashByVerse(
  workSefariaIndexTitle: string,
  bookSefariaName: string,
  chapter: number,
  verse: number,
): Promise<{ segments: TextSegment[]; scrollToIndex: number }> {
  const verseKey = `${bookSefariaName}.${chapter}.${verse}`;
  const url = `https://www.sefaria.org/api/links/${encodeURIComponent(verseKey)}`;
  const res = await fetchWithRetry(url);
  let links: unknown;
  try {
    links = await res.json();
  } catch {
    throw new SefariaDecodingError(res.status);
  }
  if (!Array.isArray(links)) throw new SefariaDecodingError(res.status);
  // Filter by index_title; "ref" is the Midrash passage ref (not "anchor_ref", the Torah back-ref)
  const matching = links.filter(
    (l): l is Record<string, unknown> =>
      typeof l === "object" && l !== null && (l as Record<string, unknown>).index_title === workSefariaIndexTitle,
  );
  const first = matching[0];
  const midrashRef = typeof first?.ref === "string" ? first.ref : "";
  if (!midrashRef) throw new SefariaNoTextError();

  // Strip the last ":N" to get the parent section; parse N as 1-based scroll target.
  let parentRef: string;
  let scrollToIndex: number;
  const colonIdx = midrashRef.lastIndexOf(":");
  const lastNum = colonIdx !== -1 ? Number(midrashRef.slice(colonIdx + 1)) : NaN;
  if (colonIdx !== -1 && Number.isFinite(lastNum)) {
    parentRef = midrashRef.slice(0, colonIdx);
    scrollToIndex = Math.max(0, lastNum - 1);
  } else {
    parentRef = midrashRef;
    scrollToIndex = 0;
  }

  const { hebrew: he, english: en } = await fetchBoth(parentRef);
  const count = Math.max(he.length, en.length);
  const segs: TextSegment[] = [];
  for (let i = 0; i < count; i++) {
    segs.push(contentSegment(i, he[i] ?? "", en[i] ?? ""));
  }
  const valid = segs.filter((s) => s.hebrewHTML !== "" || s.englishHTML !== "");
  if (valid.length === 0) throw new SefariaNoTextError();
  return { segments: valid, scrollToIndex };
}

// MARK: - Chapter fetch (Tanakh, Mishnah, Rambam, SA)

/**
 * Splits a Shulchan Arukh siman's leading bold title (e.g. "הלכות ציצית ועטיפתו. ובו יז
 * סעיפים:") out of seif 1's Hebrew HTML into its own header line. Sefaria bakes the printed
 * siman title into the very start of seif 1's Hebrew as a `<b>...</b>` block for every siman —
 * confirmed directly against the API — with no parallel sentence in the English translation, so
 * this only ever applies to the Hebrew side. Returns null (leaving seif 1 untouched) when the
 * text doesn't start with a bold block, rather than assuming the pattern always holds.
 */
function splitSimanHeader(rawHeHtml: string): { header: string; rest: string } | null {
  const m = rawHeHtml.match(/^\s*<b>([\s\S]*?)<\/b>\s*/);
  if (!m) return null;
  return { header: m[1], rest: rawHeHtml.slice(m[0].length) };
}

export async function fetchChapter(
  category: TextCategory,
  bookOrTractateIndex: number,
  chapter: number,
  selectedCommentaries: CommentaryType[] = [],
): Promise<TextSegment[]> {
  const r = ref(category, bookOrTractateIndex, chapter);
  const { hebrew: he, english: en } = await fetchBoth(r);
  const count = Math.max(he.length, en.length);
  const labelStyle: SegmentLabelStyle =
    category === "tanakh" ? "verse"
    : category === "mishnah" ? "mishnah"
    : category === "rambam" ? "halakha"
    : category === "shulchanArukh" ? "sif"
    : category === "tur" ? "sif"
    : "none";
  const isSA = category === "shulchanArukh";
  // Tur bakes the same leading-<b>siman-title</b> block into seif 1's Hebrew as SA does
  // (confirmed live, e.g. Tur Orach Chayim 8 -> "<b>הלכות ציצית </b><br>...") — reuse
  // splitSimanHeader for the title, but Tur's own inline commentator markers (empty
  // <i data-commentator="Bach" data-order="1.1"></i> position tags, structurally unlike SA's
  // text-wrapping spans) are deliberately left alone here and just fall out via the generic
  // stripHTML tag-stripping pass in the API route's plainText() — no bracket-matching feature,
  // per explicit user decision.
  const isTur = category === "tur";

  if (isSA || isTur) {
    // Use a loop so shared counters thread across seifim, ensuring sequential markers
    // number continuously throughout the siman (SA only — harmless unused object for Tur).
    const sharedCounters: Record<string, number> = {};
    const segments: TextSegment[] = [];
    for (let i = 0; i < count; i++) {
      const label = segmentLabel(labelStyle, i + 1);
      let heText = he[i] ?? "";
      const enText = en[i] ?? "";
      if (i === 0) {
        const split = splitSimanHeader(heText);
        if (split) {
          // Sefaria bakes the printed siman title into the start of seif 1's Hebrew as a
          // <b>...</b> block, with no parallel sentence in the English translation — give it
          // its own header line (no seif number — it isn't one) rather than running it together
          // with seif 1's actual text.
          segments.push(contentSegment(i, split.header, "", null));
          heText = split.rest;
        }
      }
      if (isSA) {
        heText = processCommentaryMarkers(heText, bookOrTractateIndex, selectedCommentaries, sharedCounters);
      }
      segments.push(contentSegment(i, heText, enText, label));
    }
    return segments;
  }

  return Array.from({ length: count }, (_, i) => {
    const label = segmentLabel(labelStyle, i + 1);
    return contentSegment(i, he[i] ?? "", en[i] ?? "", label);
  });
}

// MARK: - Ra'avad Hasagot fetch

/**
 * Fetches Ra'avad's Hasagot for a Rambam chapter in both languages, in parallel.
 * Returns (he, en) arrays parallel to halakhot; empty inner array = no comment on that halakha.
 */
export async function fetchRaavad(
  rambamRef: string,
  count: number,
): Promise<{ he: string[][]; en: string[][] }> {
  if (count <= 0) return { he: [], en: [] };
  const raavadRef = `Hasagot HaRa'avad on ${rambamRef}:1-${count}`;
  const [he, en] = await Promise.all([
    fetchRaavadLang(raavadRef, "he"),
    fetchRaavadLang(raavadRef, "en"),
  ]);
  return { he, en };
}

async function fetchRaavadLang(raavadRef: string, langKey: "he" | "en"): Promise<string[][]> {
  try {
    const url = buildURL(raavadRef, langKey === "he" ? "he" : "en");
    const res = await fetchWithRetry(url);
    const json = await res.json();
    if (json?.error) return [];
    const arr = json?.[langKey === "he" ? "he" : "text"];
    if (!Array.isArray(arr)) return [];
    return arr.map((item: unknown): string[] => {
      if (Array.isArray(item)) {
        return item.filter((s): s is string => typeof s === "string" && s.trim() !== "");
      }
      if (typeof item === "string" && item.trim() !== "") return [item];
      return [];
    });
  } catch {
    return [];
  }
}

/**
 * Attaches Ra'avad Hasagot to matching Rambam text segments as plain text fields.
 * he[i]/en[i] holds the comments for segments[i]; empty inner array = skip.
 */
export function applyRaavad(
  heRaavad: string[][],
  enRaavad: string[][],
  segments: TextSegment[],
): TextSegment[] {
  if (heRaavad.length === 0 && enRaavad.length === 0) return segments;
  return segments.map((seg, i) => {
    const heComments = heRaavad[i] ?? [];
    const enComments = enRaavad[i] ?? [];
    if (heComments.length === 0 && enComments.length === 0) return seg;
    const heText = heComments.length === 0 ? undefined : stripHTML(heComments.join(" "));
    const enText = enComments.length === 0 ? undefined : stripHTML(enComments.join(" "));
    return contentSegment(seg.index, seg.hebrewHTML, seg.englishHTML, seg.label, heText ?? null, enText ?? null);
  });
}

// MARK: - Commentary fetch

export async function fetchCommentary(type: CommentaryType, mainRef: string): Promise<string[]> {
  return fetchRaw(commentarySefariaRef(type, mainRef), "en");
}

export async function fetchCommentaryHebrew(type: CommentaryType, mainRef: string): Promise<string[]> {
  return fetchRaw(commentarySefariaRef(type, mainRef), "he");
}

/**
 * Ported directly from TextReaderViewModel.swift's loadCommentary() (the file wasn't read
 * during the initial port — this list was reconstructed from a doc summary and my own
 * spot-checks, both of which turned out wrong: e.g. Bartenura on Mishnah *looked* complete
 * bare (10 entries) but was actually only mishnah-1's comments; the ranged fetch's 5 outer
 * entries are the correct 5-mishnayot structure, each with nested comments totaling the real
 * 30 — confirmed against Sefaria's related-links API, not just eyeballing entry counts.
 *
 * Sefaria's depth-3 commentaries (Chapter/Daf → Verse/Line/Halakha → Comment) collapse a bare
 * ref with no range down to just the first Verse/Line/Halakha's comments. This is NOT
 * universal (e.g. Mishnah Berurah is already complete bare, and ranging it would break it),
 * so the fix applies only where the native app applies it:
 * - Tanakh: all commentaries, `:1-200` (verse count varies; 200 is a safe generous bound)
 * - Talmud: all commentaries, `:1-200` per amud (see loadCommentaryEntries)
 * - Rambam: ALL commentaries, `:1-{mainSegmentCount}` — needs the real halakha count of the
 *   current chapter, not a guessed constant (passed in from the main chapter fetch)
 * - Shulchan Arukh: only Shakh, `:1-100`
 * - Mishnah: only this specific 11-commentary list, `:1-20`
 */
const MISHNAH_DEPTH3_TYPES = new Set<CommentaryType>([
  "rambamMishnah", "bartenura", "tosafotYomTov", "melekhetShlomo",
  "tosafotRabbiAkivaEiger", "englishExplanation", "rashMiShantz",
  "yeshSederLaMishnah", "gra", "rashash", "yachin",
]);

function depthFixedRef(
  ref: string,
  category: TextCategory,
  type: CommentaryType,
  mainSegmentCount?: number,
  isTosefta = false,
  isYerushalmi = false,
): string {
  if (category === "tanakh") return `${ref}:1-200`;
  // Yerushalmi refs already target one specific halakha (chapter:halakha) — no range needed,
  // and appending one would produce an invalid ref. Only Bavli gets the amud-level range.
  if (category === "talmud" && !isYerushalmi) return `${ref}:1-200`;
  if (category === "rambam") {
    const n = mainSegmentCount && mainSegmentCount > 0 ? mainSegmentCount : 40;
    return `${ref}:1-${n}`;
  }
  if (category === "shulchanArukh" && type === "shakh") return `${ref}:1-100`;
  // All 5 Tur commentaries (Beit Yosef, Bach, Darkhei Moshe, Prisha, Drisha) are depth-3
  // (Siman -> Seif Katan -> Paragraph, or for Choshen Mishpat, Siman -> Seif -> Seif Katan) —
  // confirmed live against Sefaria's API: a bare "Beit Yosef, Orach Chayim 1" returns only 1
  // entry vs. 17 for "...1:1-50"/"...1:1-500" (the generous range doesn't error even when it
  // exceeds the siman's real count, same pattern as Tanakh's blanket :1-200 fix below).
  if (category === "tur") return `${ref}:1-500`;
  // Tosefta Kifshutah / Brief Commentary are depth-3 (Chapter → Mishnah → Comment) — same fix
  // as the Mishnah depth-3 list below, but keyed on subcategory rather than commentary type.
  if (category === "mishnah" && isTosefta) return `${ref}:1-200`;
  if (category === "mishnah" && MISHNAH_DEPTH3_TYPES.has(type)) return `${ref}:1-20`;
  return ref;
}

/**
 * Sefaria's Mishnah Berurah text bakes its own reference letter into the start of every
 * paragraph as plain content — e.g. "(א) לעבודת בוראו..." — confirmed directly against the
 * API (not wrapped in a `<b>` tag, unlike what AnyTorah/CLAUDE.md's stripLeadingBoldLabel
 * describes; Sefaria's data format for this apparently changed since that was written). Since
 * the panel already generates its own matching bracket-letter label for MB, leaving this in
 * would show the letter twice. Strip only a genuine leading "(<hebrew letters>)" — MB is the
 * only commentary this is applied to; other SA commentaries' text doesn't self-label this way.
 */
function stripLeadingSelfLabel(text: string): string {
  return text.replace(/^\([֐-׿]{1,4}\)\s*/, "");
}

/**
 * Ported from TextReaderViewModel.loadCommentary()'s multi-recension path. Walks every
 * (ref, label) pair from sefariaRefVersions, fetching each in sequence and inserting a
 * divider entry before any version that carries a label — recensionHeader for same-work
 * recensions (Tosafot Rid), bookDivider for commentators that combine two distinct works
 * (Haamek Davar, Maharsha, etc.). The running `index` stays continuous across versions so
 * scroll/identity logic downstream doesn't need to know about the split.
 *
 * For Tanakh/Mishnah/Rambam, `label` is set to the outer-array index (verse/mishnah/halakha
 * number) instead of null, so sparse commentaries display the correct number instead of a
 * sequential paragraph count — see CommentaryEntry docs in textModels.ts.
 *
 * `secondMainRef` is Talmud-only: a bare daf ref like "Rashi on Berakhot 2" resolves on
 * Sefaria to "Rashi on Berakhot 2a:1-2b:1" — effectively all of 2a plus only the *first*
 * comment of 2b, not the whole daf (confirmed directly against the Sefaria API; not a
 * ref-building bug). Fetching amud A and amud B as two separate refs and inserting an
 * amudBMarker between them — mirroring fetchFullDaf's main-text handling — gets the full
 * content of both amudim (each amud ref still needs the depthFixedRef range on top of that).
 */
export async function loadCommentaryEntries(
  type: CommentaryType,
  mainRef: string,
  category: TextCategory,
  secondMainRef?: string,
  mainSegmentCount?: number,
  isTosefta = false,
  isYerushalmi = false,
): Promise<CommentaryEntry[]> {
  const useOuterLabel = category === "tanakh" || category === "mishnah" || category === "rambam";
  const entries: CommentaryEntry[] = [];
  let seqIndex = 0;

  async function appendVersions(ref: string): Promise<void> {
    for (const version of sefariaRefVersions(type, ref)) {
      if (!version.ref) continue; // e.g. einAyah — bundled commentary, not fetchable from Sefaria

      // Commentary coverage is genuinely spotty per work/chapter beyond what the coarse
      // isAvailableFor* filters capture (e.g. Maggid Mishneh has no content at all for some
      // Rambam sefarim). Any failure fetching a specific version — "no text", an invalid/
      // nonexistent ref from Sefaria, a network hiccup — just means this version contributes
      // nothing; skip it rather than failing the whole panel. (Contrast with fetchChapter/
      // fetchFullDaf for the main text, where a fetch failure is still a real error.)
      let aligned: { he: string[]; en: string[]; outerIndices: number[] };
      try {
        aligned = await fetchBothAligned(
          depthFixedRef(version.ref, category, type, mainSegmentCount, isTosefta, isYerushalmi),
        );
      } catch {
        continue;
      }

      if (version.label) {
        entries.push(
          usesBookDivider(type)
            ? { kind: "bookDivider", text: version.label }
            : { kind: "recensionHeader", text: version.label },
        );
      }

      for (let i = 0; i < aligned.he.length; i++) {
        let he = aligned.he[i] ?? "";
        if (type === "mishnahBerurah") he = stripLeadingSelfLabel(he);
        entries.push({
          kind: "text",
          index: seqIndex++,
          label: useOuterLabel ? aligned.outerIndices[i] : null,
          he,
          en: aligned.en[i] ?? "",
        });
      }
    }
  }

  await appendVersions(mainRef);
  if (secondMainRef) {
    const daf = parseInt(secondMainRef.match(/(\d+)[ab]?$/)?.[1] ?? "0", 10);
    entries.push({ kind: "amudBMarker", daf });
    await appendVersions(secondMainRef);
  }

  return entries;
}

// MARK: - SA Commentary Marker Processing
//
// saHebrewLetter and SA_SLOT_STYLES live in textModels.ts (not here) so the client-side
// CommentaryPanel can import the same letter/bracket-shape logic without pulling in this
// module's server-oriented fetch code.

/**
 * Converts inline Shulchan Arukh commentary markers to tagged inline indicators.
 * - Mishnah Berurah (OC): `<i data-commentator="Mishnah Berurah" data-label="X">` → `<mk s="N">(X)</mk>`
 * - Key commentators by section: replaced with sequential Hebrew letters in the slot's bracket
 *   shape, based on document order.
 *
 * Output uses a `<mk s="N">…</mk>` tag (N = slot index) rather than plain bracket text, so the
 * slot is still identifiable after HTML stripping — see processedHebrewWithMarkers, which
 * converts these into styled `<span>`s while stripping everything else.
 *
 * `counters` is a shared, mutable map threaded across all seifim of the same siman — it must
 * be initialized once per siman by the caller and passed in on every call, never reset inside
 * this function, so sequential labels (א, ב, ג…) stay continuous across the whole siman.
 *
 * @param section 0=OC, 1=YD, 2=EH, 3=CM (matches SA section index).
 */
export function processCommentaryMarkers(
  html: string,
  section: number = 0,
  selectedCommentaries: CommentaryType[] = [],
  counters: Record<string, number>,
): string {
  let s = html;

  // ── Mishnah Berurah (OC) — uses data-label attribute ──
  if (s.includes("Mishnah Berurah")) {
    const mbSlotIdx = selectedCommentaries.indexOf("mishnahBerurah");
    const slotIdx = mbSlotIdx >= 0 && mbSlotIdx < SA_SLOT_STYLES.length ? mbSlotIdx : 0;
    const mbStyle = SA_SLOT_STYLES[slotIdx];
    s = s.replace(/data-commentator=Mishnah Berurah"/g, 'data-commentator="Mishnah Berurah"');
    const mbRegex = /<i\b[^>]*Mishnah Berurah[^>]*\bdata-label="([^"]*)"[^>]*>\s*<\/i>/g;
    s = s.replace(mbRegex, (_match, label: string) => {
      if (!label) return "";
      return `<mk s="${slotIdx}">${mbStyle.open}${label}${mbStyle.close}</mk>`;
    });
  }

  // ── Sequential Hebrew-letter markers — dynamic by user's selected commentary slots ──
  // Commentaries without inline markers in this section are skipped (no entry emitted).
  const sectionMarkers = selectedCommentaries
    .map((commentary, slotIdx) => {
      if (slotIdx >= SA_SLOT_STYLES.length) return null;
      const dataName = saCommentatorDataName(commentary, section);
      if (dataName === null) return null;
      const style = SA_SLOT_STYLES[slotIdx];
      return { name: dataName, slotIdx, open: style.open, close: style.close };
    })
    .filter((x): x is { name: string; slotIdx: number; open: string; close: string } => x !== null);

  if (sectionMarkers.length > 0) {
    const tagRegex = /<i\b[^>]*\bdata-commentator="([^"]*)"[^>]*>\s*<\/i>/g;
    s = s.replace(tagRegex, (_match, name: string) => {
      const cfg = sectionMarkers.find((m) => m.name === name);
      if (!cfg) return _match;
      counters[name] = (counters[name] ?? 0) + 1;
      const letter = saHebrewLetter(counters[name]);
      return `<mk s="${cfg.slotIdx}">${cfg.open}${letter}${cfg.close}</mk> `;
    });
  }

  return s;
}

// MARK: - HTML stripping

/**
 * Removes `<b>…</b>` / `<strong>…</strong>` blocks including content, then strips remaining
 * HTML. Used for Tanakh main text where bold marks unwanted lemmas or footnote anchors.
 */
export function stripBoldContent(html: string): string {
  const s = html.replace(/<(?:b|strong)[^>]*>[\s\S]*?<\/(?:b|strong)>/gi, "");
  return stripHTML(s);
}

/**
 * Removes a leading bold label such as `<b>א</b>` from Sefaria HTML. Used when the
 * commentary panel manages its own sequential prefix so labels don't double up.
 */
export function stripLeadingBoldLabel(html: string): string {
  return html.replace(/^\s*<b>[^<]{0,15}<\/b>\s*/, "");
}

export function stripHTML(html: string): string {
  const s = stripYerushalmiFootnotes(html);
  return s
    // <br> must become a real line break, not just vanish — Sefaria sometimes joins two
    // structurally distinct paragraphs (e.g. a tractate's introductory note and its opening
    // MISHNA) into one segment string separated only by <br><br>. Rendered with
    // `white-space: pre-line` (see Reader.tsx), a literal \n produces a real line break.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&thinsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');
}

/**
 * Returns Hebrew text with HTML stripped and cantillation marks (U+0591-U+05AF) optionally
 * removed, based on the caller's "show trop" preference. Use for all Hebrew main-text
 * rendering; use stripHTML directly for English text.
 */
export function processedHebrew(html: string, showTrop: boolean = false): string {
  const text = stripHTML(html);
  if (showTrop) return text;
  return Array.from(text)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0591 || code > 0x05af;
    })
    .join("");
}

const MARKER_TAG_RE = /<mk s="(\d)">(.*?)<\/mk>/g;

/**
 * Like processedHebrew, but preserves processCommentaryMarkers' `<mk s="N">…</mk>` tags —
 * converting them into `<span class="sa-mark sa-mark-N">` — instead of stripping them along
 * with the rest of Sefaria's HTML. Used only for Shulchan Arukh's Hebrew main text, so the
 * inline commentary-marker brackets keep their per-slot identity for client-side styling
 * (distinct font/size per commentator — see globals.css). Everything else is plain-texted
 * exactly as processedHebrew does; the marker text is pulled out before stripping (via a
 * placeholder that survives both the tag-stripping regex and the cantillation-mark filter)
 * and spliced back in afterward as real markup, so callers must render the result with
 * dangerouslySetInnerHTML rather than as plain text.
 */
export function processedHebrewWithMarkers(html: string, showTrop: boolean = false): string {
  const markers: string[] = [];
  const withPlaceholders = html.replace(MARKER_TAG_RE, (_m, slot: string, text: string) => {
    const i = markers.length;
    markers.push(`<span class="sa-mark sa-mark-${slot}">${text}</span>`);
    return `\uE000MK${i}\uE000`;
  });
  const stripped = processedHebrew(withPlaceholders, showTrop);
  return stripped.replace(/\uE000MK(\d+)\uE000/g, (_m, i: string) => markers[Number(i)] ?? "");
}

const BOLD_TAG_RE = /<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/g;

// Sefaria marks Talmud's structural section breaks as `<strong>MISHNA:</strong>` /
// `<strong>GEMARA:</strong>`. These must always start a new line \u2014 most of the time they already
// do (either as the first thing in their own segment, or after a `<br><br>` mid-segment), but
// that's an incidental property of Sefaria's source data, not something to rely on for every
// tractate. Confirmed broken on Berakhot 2a and Yevamot 2a: both open with an introductory note
// and "MISHNA:" bundled into one segment string, run together on one line.
const STRUCTURAL_MARKER_RE = /<strong>(?:MISHNA|GEMARA):<\/strong>/g;

/** Forces a line break immediately before MISHNA:/GEMARA: markers, unless one is already there
 *  (start of string, or already preceded by `<br>`/a newline) \u2014 see STRUCTURAL_MARKER_RE. */
function forceNewLineBeforeStructuralMarkers(html: string): string {
  return html.replace(STRUCTURAL_MARKER_RE, (match, offset: number, full: string) => {
    const before = full.slice(0, offset);
    if (before === "" || /(?:<br\s*\/?>\s*|\n\s*)$/i.test(before)) return match;
    return "\n" + match;
  });
}

/**
 * Like stripHTML, but converts `<b>`/`<strong>` spans into `<span class="en-editorial">\u2026</span>`
 * instead of discarding the tags. Ported from native's styledEnglish (TextContentView.swift):
 * Sefaria's Talmud/Mishnah English translations bold the "glue" words a translator added that
 * aren't direct translations of the source (Steinsaltz-style), and native renders those in an
 * editorial color (amber on dark bg / indigo on light bg via `--accent`, see globals.css)
 * instead of literal bold weight \u2014 bold weight alone reads as emphasis, not as "this word isn't
 * really in the source," which is what the color is for. Must be rendered with
 * dangerouslySetInnerHTML; everything else in the returned string is plain-texted exactly as
 * stripHTML would produce. Also ensures MISHNA:/GEMARA: markers always start a new line \u2014 see
 * forceNewLineBeforeStructuralMarkers.
 */
export function processedEnglishWithBold(html: string): string {
  const spans: string[] = [];
  const withPlaceholders = forceNewLineBeforeStructuralMarkers(html).replace(BOLD_TAG_RE, (_m, inner: string) => {
    const i = spans.length;
    spans.push(`<span class="en-editorial">${stripHTML(inner)}</span>`);
    return `\uE000B${i}\uE000`;
  });
  const stripped = stripHTML(withPlaceholders);
  return stripped.replace(/\uE000B(\d+)\uE000/g, (_m, i: string) => spans[Number(i)] ?? "");
}
