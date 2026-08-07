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
  type SATextMode,
  contentSegment,
  amudBMarkerSegment,
  saHebrewLetter,
  SA_SLOT_STYLES,
} from "./textModels";
import {
  TextCatalog,
  type MishnahTractate,
} from "./textCatalog";
import { stripNikud } from "./hebrewUtils";

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

function buildURL(refStr: string, lang: string = "he", version?: string): string {
  const params = new URLSearchParams({ context: "0", lang });
  if (version) params.set(lang === "he" ? "vhe" : "ven", version);
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

async function fetchSingleLang(refStr: string, lang: string, version?: string): Promise<string[]> {
  const url = buildURL(refStr, lang, version);
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

/** Fetches a single language's text segments, optionally from a specific named Sefaria version. */
export async function fetchRaw(refStr: string, language: string, version?: string): Promise<string[]> {
  return fetchSingleLang(refStr, language, version);
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
    } else if (heArr.length > enArr.length) {
      // Hebrew has more (real, granular) outer paragraphs than English — e.g. Beit Yosef, Orach
      // Chayim 1 has 17 Hebrew comments but Sefaria's English translation only covers the first
      // one (confirmed live: the lone English entry is verbatim just paragraph 1's translation).
      // Hebrew's own paragraph count is the ground truth here and must not be collapsed just
      // because the translation is sparse — pair by outer index, leaving English empty wherever
      // there's no corresponding entry, instead of joining every Hebrew paragraph into one blob.
      for (let i = 0; i < heArr.length; i++) {
        const hInner = flattenTextValue(heArr[i]).filter(nonEmpty);
        const eInner = flattenTextValue(enArr[i]).filter(nonEmpty); // [] once i exceeds enArr
        const before = heSegs.length;
        alignedAppend(hInner, eInner, heSegs, enSegs);
        const added = heSegs.length - before;
        outerIndices.push(...Array(added).fill(i));
      }
    } else {
      // Opposite direction (e.g. intro: 1 he vs 7 en at top level) — Hebrew's single outer entry
      // is the real paragraph unit and English's extra granularity is just translation-side
      // formatting, so merge everything into one combined entry, as before.
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

/**
 * Per-section Sefaria version title for Shulchan Arukh's vocalized (Torat Emet) edition — split
 * across two physical volumes, confirmed directly against the API at multiple simanim spanning
 * each section's full range (not assumed from one spot-check): Orach Chayim and Choshen Mishpat
 * share one volume, Yoreh De'ah and Even HaEzer the other. Section index matches SA_SLOT_STYLES'
 * own 0=OC/1=YD/2=EH/3=CM convention used throughout this file.
 */
const SA_VOCALIZED_VERSION: Record<number, string> = {
  0: "Torat Emet 363", // Orach Chayim
  1: "Torat Emet 357", // Yoreh De'ah
  2: "Torat Emet 357", // Even HaEzer
  3: "Torat Emet 363", // Choshen Mishpat
};

export async function fetchChapter(
  category: TextCategory,
  bookOrTractateIndex: number,
  chapter: number,
  selectedCommentaries: CommentaryType[] = [],
  saTextMode: SATextMode = "commentary",
): Promise<TextSegment[]> {
  const r = ref(category, bookOrTractateIndex, chapter);
  const isSA = category === "shulchanArukh";
  const useVocalizedSA = isSA && saTextMode === "nikud";
  const { hebrew: he, english: en } = useVocalizedSA
    ? await (async () => {
        const [heSegs, enSegs] = await Promise.all([
          fetchRaw(r, "he", SA_VOCALIZED_VERSION[bookOrTractateIndex]),
          fetchRaw(r, "en"),
        ]);
        return { hebrew: heSegs, english: enSegs };
      })()
    : await fetchBoth(r);
  const count = Math.max(he.length, en.length);
  const labelStyle: SegmentLabelStyle =
    category === "tanakh" ? "verse"
    : category === "mishnah" ? "mishnah"
    : category === "rambam" ? "halakha"
    : category === "shulchanArukh" ? "sif"
    : "none";

  if (isSA) {
    // Use a loop so shared counters thread across seifim, ensuring sequential markers
    // number continuously throughout the siman.
    const sharedCounters: Record<string, number> = {};
    const segments: TextSegment[] = [];
    for (let i = 0; i < count; i++) {
      const label = segmentLabel(labelStyle, i + 1);
      let heText = he[i] ?? "";
      const enText = en[i] ?? "";
      // The vocalized edition has no leading <b>...</b> siman-title block — splitSimanHeader
      // simply finds no match and no-ops, so seif 1 just starts without a separate header line.
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
      // Rema first — its opening-word test needs Sefaria's own contentless <i> markers still in
      // place, not processCommentaryMarkers' visible <mk> brackets. See processRemaGlosses. Runs
      // in both text modes — Rema's glosses exist independently of which SA edition is fetched.
      heText = processRemaGlosses(heText);
      // The vocalized edition carries no <i data-commentator> tags at all (confirmed against the
      // API) — processCommentaryMarkers would simply find nothing to replace, so it's skipped
      // outright rather than run for no effect.
      if (!useVocalizedSA) {
        heText = processCommentaryMarkers(heText, bookOrTractateIndex, selectedCommentaries, sharedCounters);
      }
      segments.push(contentSegment(i, heText, enText, label));
    }
    return segments;
  }

  if (category === "tur") {
    return buildTurSegments(he, en, r);
  }

  return Array.from({ length: count }, (_, i) => {
    const label = segmentLabel(labelStyle, i + 1);
    return contentSegment(i, he[i] ?? "", en[i] ?? "", label);
  });
}

// MARK: - Tur main text

const TUR_DM_MARKER_RE = /<i\b[^>]*\bdata-commentator="Darkhei Moshe"[^>]*\bdata-order="(\d+)\.\d+"[^>]*>\s*<\/i>/g;

/**
 * Converts Tur's Darkhei Moshe position markers into a `<dm>N</dm>` placeholder — printed Tur
 * editions anchor Darkhei Moshe's marginal notes with a reference number at this exact spot, and
 * Sefaria's own `data-order="N.M"` already carries that same 1-based sequential number (confirmed
 * live: it lines up with Darkhei Moshe's own commentary entries in fetch order, so no separate
 * counter is needed the way SA's per-slot lettering requires). Every other commentator's markers
 * in the same text (Beit Yosef, Bach, Prisha, Drisha, and Sefaria's own unlinked "Hagahot" tags —
 * confirmed via Sefaria's links API to not resolve to any real fetchable work) are deliberately
 * left alone here; they fall out via the generic stripHTML tag-stripping pass in
 * processedHebrewWithTurMarkers, same as before.
 */
function processTurMarkers(html: string): string {
  return html.replace(TUR_DM_MARKER_RE, (_m, n: string) => `<dm>${n}</dm>`);
}

/**
 * Strips HTML tags only — keeps all text content, punctuation, and nikud intact — while
 * recording, for each kept character, its original index in `html`. Lets Beit-Yosef-quote
 * matching (findTurBreakpoints) search a tag-free string while still being able to cut the
 * *original* (tag-and-all) string at the exact right spot afterward, so a Darkhei Moshe
 * <dm>N</dm> marker embedded mid-paragraph still lands in the paragraph it belongs to.
 */
function stripTagsWithIndexMap(html: string): { text: string; rawIndex: number[] } {
  let text = "";
  const rawIndex: number[] = [];
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === "<") { inTag = true; continue; }
    if (ch === ">") { inTag = false; continue; }
    if (inTag) continue;
    text += ch;
    rawIndex.push(i);
  }
  return { text, rawIndex };
}

/** Matches a multi-letter Hebrew abbreviation: a gershayim (either the ASCII `"` or the proper
 *  Hebrew ״ character digitizations use interchangeably) between two Hebrew letters, e.g. "בה"כ"
 *  (= "בית הכסא"), "ת"ח" (= "תלמידי חכמים"). */
const HEBREW_ABBREVIATION_RE = /[א-ת]["״][א-ת]/;

/**
 * Builds a regex matching `words` (Hebrew letters only, in order) tolerating any amount of
 * intervening punctuation/nikud/whitespace between them — lets a Beit Yosef quote match Tur's
 * own text even where independent digitization introduced minor punctuation differences. Also
 * tolerates a definite-article "ה" mismatch on each word (real bug found live: Tur OC 3 has "בפי
 * טבעת" where Beit Yosef's quote of the same words is "בפי הטבעת" — an exact-word match on
 * "הטבעת" silently failed to find it, merging two real paragraphs into one).
 *
 * A word that's itself a multi-letter abbreviation (HEBREW_ABBREVIATION_RE) is treated as a short
 * unconstrained gap instead of requiring its own letters to match literally — its expansion in
 * the *other* independently-digitized source routinely spells out completely different letters
 * (real bug found live: Tur OC 43 spells out "לבית הכסא"; Beit Yosef's quote of the same words
 * abbreviates it "לבה"כ" — a literal match on "לבהכ" never finds "לבית הכסא", so the match silently
 * slid forward to the next word that did line up, "קבוע," breaking the paragraph one word later
 * than the real start). The words immediately before/after the abbreviation still have to match
 * literally, which keeps this from matching too loosely.
 *
 * Refuses to build a pattern (returns null) when more than half its words are these gap
 * placeholders — real bug found live: Tur OC 3 entry 12 tried a 3-word window that was itself two
 * citation abbreviations plus one generic word ("ג"ז בס"פ המוציא"), so with 2 of 3 tokens
 * wildcarded the pattern matched wherever "המוציא" next recurred, many paragraphs later, skipping
 * several real breaks in between. Citation-heavy commentary text clusters abbreviations like this
 * constantly, so a single stray one (the OC 43 case) is fine to bridge, but a window that's mostly
 * gaps has too little real anchor text left to trust — better to let the caller fall through to a
 * different word count/skip, or fail outright, than risk a wild, far-away match.
 */
function buildHebrewWordPattern(words: string[]): RegExp | null {
  const parts: string[] = [];
  let literalCount = 0;
  for (const raw of words) {
    if (HEBREW_ABBREVIATION_RE.test(raw)) {
      parts.push("[\\s\\S]{0,20}");
      continue;
    }
    const cleaned = raw.replace(/[^א-ת]/g, "");
    if (!cleaned) continue;
    const stripped = cleaned.startsWith("ה") && cleaned.length > 1 ? cleaned.slice(1) : cleaned;
    parts.push(`ה?${stripped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    literalCount++;
  }
  if (parts.length === 0) return null;
  if (literalCount < Math.ceil(parts.length / 2)) return null;
  return new RegExp(parts.join("[^א-ת]*"));
}

/**
 * Finds, for each Beit Yosef entry (in siman order), the raw-string offset in `combinedHe`
 * (Tur's own post-header Hebrew, tags intact, all seifim concatenated — see combineTurSeifim)
 * where that entry's opening words begin. These offsets become the paragraph break points (see
 * buildTurSegments/computeTurParagraphChunks): a Tur paragraph is *defined* as "from one Beit
 * Yosef comment to the next," not by punctuation.
 *
 * This replaced an earlier colon-based split, per explicit product decision, after two real
 * problems surfaced: a colon inside a citation like Tur OC 132's "(צא:)" (amud bet of daf צא, not
 * a paragraph break) needed excluding as a special case, and Tur OC 133's seven verse-ending
 * colons over-fragment what both Beit Yosef and any reader would treat as one topical unit (the
 * daily Psalm list). Deriving breaks from Beit Yosef's own commentary boundaries sidesteps both,
 * and still works for simanim with no colons at all — Beit Yosef opens each entry with a direct
 * quote of the Tur words under discussion (confirmed live, e.g. Beit Yosef on Tur OC 25 entry 0
 * opens with Tur's own paragraph 0's exact opening words).
 *
 * Same forward-only heuristic as assignTurParagraphLabels: search only ever moves forward from
 * the last match (never back to an earlier position, even if the same short phrase recurs
 * later — the first hit scanning forward is taken as genuine), tried at decreasing word counts
 * (a long quote is a more confident match), and an entry with no match simply contributes no
 * break point — it merges into whichever paragraph precedes it — rather than leaving a gap.
 *
 * Also tries skipping the entry's first 1-3 words before matching (real cases confirmed live on
 * Tur OC 3): Beit Yosef often opens a comment with a standard rhetorical connector — "ומ"ש" (=
 * "ומה שכתב", "and what [Tur] wrote...") or "ודע ד..." ("know that...") — that isn't part of
 * Tur's own text at all; the literal quote only starts a word or two later ("ומ"ש אם לא מעטרה
 * ולמטה..." doesn't match anywhere, but "מעטרה ולמטה..." does). Skipping is tried only after the
 * unskipped attempt fails, and only recovers a match if one of these short preambles was the sole
 * obstacle — an entry with no literal quote anywhere (a free-standing aside not tied to a specific
 * new Tur phrase) still correctly contributes no break.
 */
function findTurBreakpoints(combinedHe: string, beitYosefHe: string[]): number[] {
  const { text: plain, rawIndex } = stripTagsWithIndexMap(combinedHe);
  const breakpoints: number[] = [];
  let cursor = 0;
  for (const entryHe of beitYosefHe) {
    const words = stripHTML(entryHe).split(/\s+/).filter(Boolean);
    let found: number | null = null;
    outer: for (const skip of [0, 1, 2, 3]) {
      const rest = words.slice(skip);
      for (const wordCount of [8, 6, 4, 3]) {
        if (rest.length < wordCount) continue;
        const pattern = buildHebrewWordPattern(rest.slice(0, wordCount));
        if (!pattern) continue;
        const m = plain.slice(cursor).match(pattern);
        if (m && m.index !== undefined) {
          found = cursor + m.index;
          break outer;
        }
      }
    }
    if (found !== null) {
      breakpoints.push(rawIndex[found] ?? 0);
      cursor = found;
    }
  }
  return breakpoints;
}

/**
 * Splits `html` at each raw-string offset in `breakpoints` (from findTurBreakpoints) into
 * paragraphs — offsets always fall on a real-text character, never inside a tag (see
 * stripTagsWithIndexMap), so every cut is safe. Any resulting chunk with no real text of its own
 * (e.g. a lone commentator marker sitting right at a break) is merged forward into the next real
 * paragraph rather than becoming an empty entry.
 */
function splitByBreakpoints(html: string, breakpoints: number[]): string[] {
  const sorted = Array.from(new Set(breakpoints)).sort((a, b) => a - b);
  const rawParts: string[] = [];
  let start = 0;
  for (const bp of sorted) {
    if (bp <= start) continue;
    rawParts.push(html.slice(start, bp));
    start = bp;
  }
  rawParts.push(html.slice(start));

  const result: string[] = [];
  let buffer = "";
  for (const part of rawParts) {
    buffer += part;
    if (stripHTML(buffer).trim() !== "") {
      result.push(buffer);
      buffer = "";
    }
  }
  if (buffer !== "") {
    if (result.length > 0) result[result.length - 1] += buffer;
    else result.push(buffer);
  }
  return result.length > 0 ? result : [html];
}

/**
 * Extracts the siman-title header (splitSimanHeader, seif 0 only — Tur bakes the same leading
 * <b>...</b> block into seif 1's Hebrew as SA does, confirmed live, e.g. Tur Orach Chayim 8 ->
 * "<b>הלכות ציצית </b><br>...") and concatenates every seif's remaining Hebrew into one
 * continuous string. Tur's own (rare) seif divisions don't align with anything Beit Yosef's own
 * commentary respects either (Beit Yosef's ref structure is Siman -> Seif Katan, entirely
 * independent of Tur's own Siman -> Seif), so paragraph structure is computed flat across the
 * whole siman. Also returns each seif's start offset in the combined string, so English (fetched
 * per-seif, unlike Hebrew's flat treatment here) can be attached to whichever output paragraph a
 * seif actually begins in.
 */
function combineTurSeifim(he: string[]): { header: string | null; combinedHe: string; seifStarts: number[] } {
  let header: string | null = null;
  const parts = he.map((text, i) => {
    if (i !== 0) return text;
    const split = splitSimanHeader(text);
    if (!split) return text;
    header = split.header;
    return split.rest;
  });
  let combinedHe = "";
  const seifStarts: number[] = [];
  parts.forEach((text) => {
    seifStarts.push(combinedHe.length);
    combinedHe += (combinedHe ? " " : "") + text;
  });
  return { header, combinedHe, seifStarts };
}

/**
 * Fetches Beit Yosef for `mainRef` and uses its entries to split `combinedHe` into paragraphs
 * (findTurBreakpoints/splitByBreakpoints) — shared by buildTurSegments (the main text) and
 * fetchTurParagraphPlainList (the matching corpus for Bach/Prisha+Drisha), so both always agree
 * on where a Tur paragraph begins. A siman with no usable Beit Yosef data (fetch failure, or a
 * siman Beit Yosef simply doesn't cover) falls back to a single paragraph for the whole siman —
 * never a crash, never a gap.
 */
async function computeTurParagraphChunks(mainRef: string, combinedHe: string): Promise<string[]> {
  let beitYosefHe: string[] = [];
  try {
    const entries = await loadCommentaryEntries("beitYosef", mainRef, "tur");
    beitYosefHe = entries
      .filter((e): e is Extract<CommentaryEntry, { kind: "text" }> => e.kind === "text")
      .map((e) => e.he);
  } catch {
    // No Beit Yosef available for this siman — falls back to a single paragraph below.
  }
  const breakpoints = findTurBreakpoints(combinedHe, beitYosefHe);
  return splitByBreakpoints(combinedHe, breakpoints);
}

/**
 * Builds Tur's main-text segments: the siman-title header (if any) as its own unnumbered
 * segment, then one segment per Beit-Yosef-derived paragraph (see computeTurParagraphChunks),
 * each processed for Darkhei Moshe's inline reference markers (processTurMarkers). Numbering
 * runs flat across the whole siman rather than resetting per seif — see combineTurSeifim.
 * English is attached to whichever paragraph the corresponding seif's Hebrew actually starts in;
 * most simanim are a single seif, so this is exact, and a siman with several seifim whose
 * paragraph boundaries don't line up with seif boundaries is a known, accepted imprecision.
 */
async function buildTurSegments(he: string[], en: string[], mainRef: string): Promise<TextSegment[]> {
  const { header, combinedHe, seifStarts } = combineTurSeifim(he);
  const rawParagraphs = await computeTurParagraphChunks(mainRef, combinedHe);

  const segments: TextSegment[] = [];
  let segIndex = 0;
  if (header !== null) segments.push(contentSegment(segIndex++, header, "", null));

  let offset = 0;
  let paraNum = 0;
  for (const rawPara of rawParagraphs) {
    const start = offset;
    const end = start + rawPara.length;
    offset = end;
    paraNum++;
    const heText = processTurMarkers(rawPara);
    const enParts = seifStarts
      .map((seifStart, seifIdx) => (seifStart >= start && seifStart < end ? en[seifIdx] ?? "" : ""))
      .filter(Boolean);
    segments.push(contentSegment(segIndex++, heText, enParts.join(" "), String(paraNum)));
  }
  return segments;
}

/**
 * Plain (fully HTML/nikud-stripped), paragraph-split Hebrew text of a Tur siman, used only as
 * the matching corpus for assignTurParagraphLabels — a fresh, independent fetch/split rather than
 * reusing buildTurSegments' output, so no <dm> marker digits ever end up inline in the matching
 * text. Uses the same Beit-Yosef-derived paragraph boundaries as the main text
 * (computeTurParagraphChunks) so Bach/Prisha+Drisha's paragraph numbers always agree with what's
 * actually shown.
 */
export async function fetchTurParagraphPlainList(mainRef: string): Promise<string[]> {
  const { hebrew: he } = await fetchBoth(mainRef);
  const { combinedHe } = combineTurSeifim(he);
  const rawParagraphs = await computeTurParagraphChunks(mainRef, combinedHe);
  return rawParagraphs.map((p) => processedHebrew(p));
}

function findParagraphMatch(paragraphs: string[], cursor: number, pattern: RegExp): number | null {
  for (let pi = cursor; pi < paragraphs.length; pi++) {
    if (pattern.test(paragraphs[pi])) return pi;
  }
  return null;
}

/**
 * Assigns each Beit Yosef/Bach/Prisha+Drisha entry a `label` matching the Tur paragraph
 * (0-based, from paragraphs — see fetchTurParagraphPlainList) it comments on, instead of a
 * generic sequential number. These commentaries each open their comment with a direct quote of
 * the Tur words being discussed (confirmed live, e.g. Beit Yosef on Tur OC 25's entry 0 opens
 * with the exact words that start Tur's own paragraph 0) — so a paragraph is found by searching
 * for the entry's own opening words, tried at decreasing word counts (a long quote is a more
 * confident match; a short one is tried only if the longer ones fail, e.g. the real printed quote
 * is itself short).
 *
 * Per explicit product decision, this is a best-effort heuristic, not exact: search only ever
 * moves forward from the last match (never back to an earlier paragraph, even if the same short
 * phrase also happens to recur later — the first hit found scanning forward is taken as genuine)
 * and a miss just carries the previous entry's label forward rather than leaving a gap. `entries`
 * may contain a `bookDivider` between Prisha's and Drisha's own entries (see the "prishaDrisha"
 * CommentaryType) — each is a separate work independently commenting on the Tur from its own
 * start, so the search cursor and carried-forward label both reset there.
 *
 * Also tries skipping the entry's first 1-3 words before matching, and shares buildHebrewWordPattern
 * (the "ה" article tolerance and the Hebrew-abbreviation gap, e.g. "בה"כ" vs. "לבית הכסא") with
 * findTurBreakpoints — this function used to have its own separate, cruder matcher (a plain
 * normalize-and-`.includes()` substring check) that duplicated the same heuristic without any of
 * findTurBreakpoints' later fixes, which the two functions' own docs already flagged as a
 * consistency risk; consolidated onto one shared implementation so both corpora (Tur's raw text
 * here, the already-split `paragraphs` there) always benefit from the same match improvements.
 */
export function assignTurParagraphLabels(entries: CommentaryEntry[], paragraphs: string[]): CommentaryEntry[] {
  let cursor = 0;
  let lastLabel: number | null = null;
  return entries.map((entry) => {
    if (entry.kind !== "text") {
      cursor = 0;
      lastLabel = null;
      return entry;
    }
    const words = stripHTML(entry.he).split(/\s+/).filter(Boolean);
    let matchIdx: number | null = null;
    outer: for (const skip of [0, 1, 2, 3]) {
      const rest = words.slice(skip);
      for (const wordCount of [8, 6, 4, 3]) {
        if (rest.length < wordCount) continue;
        const pattern = buildHebrewWordPattern(rest.slice(0, wordCount));
        if (!pattern) continue;
        const found = findParagraphMatch(paragraphs, cursor, pattern);
        if (found !== null) {
          matchIdx = found;
          break outer;
        }
      }
    }
    if (matchIdx !== null) {
      lastLabel = matchIdx;
      cursor = matchIdx;
    } else if (lastLabel === null) {
      lastLabel = 0; // no match yet at all — default to the siman's first paragraph
    }
    return { ...entry, label: lastLabel };
  });
}

// MARK: - Darkhei Moshe anchored in Beit Yosef, not Tur

/** Matches (and, via `.replace`, removes the *first* occurrence of) a Beit Yosef position tag
 *  for Darkhei Moshe — spelled "Darchei Moshe" (with a c) in Beit Yosef's data, vs Tur's own
 *  "Darkhei Moshe" (with a kh). No `g` flag: `.test()` checks presence, `.replace()` touches only
 *  the first match in a given entry, matching the "one marker per entry" assumption below. */
const BY_DM_MARKER_RE = /<i\b[^>]*\bdata-commentator="Darchei Moshe"[^>]*>\s*<\/i>/;

/**
 * Determines which Beit Yosef entries should carry a Darkhei Moshe reference letter, and which
 * number to show, for comments Darkhei Moshe anchors in Beit Yosef's own words rather than
 * Tur's. Confirmed live by direct comparison against a printed edition (user cross-checked 5
 * positions across 2 simanim, all correct): Beit Yosef's raw text carries the same kind of
 * position tag Tur does, but its `data-order` attribute is **not** a reliable entry number the
 * way Tur's is (Sefaria labels every single one `data-order="1"` regardless of which comment it
 * anchors) — and Sefaria's other `"Hagahot"` tag (present in both documents) is confirmed noise,
 * never resolving to a real work and never matching a real comment's position or content.
 *
 * Method: Tur's own `data-order` values ARE trusted as the true entry number for whichever
 * comments they cover (processTurMarkers already renders those). The remaining ("missing")
 * entry numbers are filled, in ascending order, by Beit Yosef's own Darchei-Moshe-tagged entries,
 * taken in the order they appear in Beit Yosef's text — this lined up exactly on all 5 confirmed
 * positions. Any entry number left over once Beit Yosef's own tags run out gets no marker
 * anywhere — an honest, accepted gap in Sefaria's source data, not a guess.
 *
 * Returns a map from Beit Yosef entry index (0-based, matching `beitYosefEntries`'s own order) to
 * the Darkhei Moshe entry number that belongs there.
 */
export async function computeBeitYosefDarkheiMosheMarks(
  mainRef: string,
  turRawHe: string[],
  beitYosefEntries: CommentaryEntry[],
): Promise<Map<number, number>> {
  let total = 0;
  try {
    const dmEntries = await loadCommentaryEntries("darkheiMoshe", mainRef, "tur");
    total = dmEntries.filter((e) => e.kind === "text").length;
  } catch {
    return new Map();
  }
  if (total === 0) return new Map();

  const turAnchored = new Set<number>();
  for (const seifText of turRawHe) {
    for (const m of seifText.matchAll(TUR_DM_MARKER_RE)) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) turAnchored.add(n);
    }
  }

  const missing: number[] = [];
  for (let n = 1; n <= total; n++) {
    if (!turAnchored.has(n)) missing.push(n);
  }
  if (missing.length === 0) return new Map();

  const byTaggedIndices: number[] = [];
  beitYosefEntries.forEach((entry, i) => {
    if (entry.kind === "text" && BY_DM_MARKER_RE.test(entry.he)) byTaggedIndices.push(i);
  });

  const assignment = new Map<number, number>();
  for (let i = 0; i < Math.min(missing.length, byTaggedIndices.length); i++) {
    assignment.set(byTaggedIndices[i], missing[i]);
  }
  return assignment;
}

/** Replaces the first Darchei-Moshe position tag in a Beit Yosef entry's raw Hebrew with a
 *  `<dm>N</dm>` placeholder — same tag `processedHebrewWithTurMarkers` already knows how to turn
 *  into a styled `(letter)` span, reused as-is so Beit Yosef's markers render identically to
 *  Tur's own. */
export function insertBeitYosefDarkheiMosheMark(he: string, n: number): string {
  return he.replace(BY_DM_MARKER_RE, `<dm>${n}</dm>`);
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

// MARK: - Rema (the Mapah) glosses

/**
 * Matches a Rema gloss's opening word "הגה" — optionally behind a bracket/paren, and tolerating
 * either gershayim spelling ("הג״ה"/"הג\"ה") alongside the far more common unpunctuated "הגה".
 * Tested against nikud-stripped text (see processRemaGlosses) — a vocalized edition interleaves
 * vowel points between the consonants ("הַגָּה"), which would otherwise break the literal match.
 *
 * The trailing `(?![א-ת])` is load-bearing, not decorative: without it this also matches
 * "הגהות" ("Hagahot", e.g. the citation title "Hagahot Maimoniyot") as if it were the word
 * "הגה" — a real bug found live (OC 2:6's own citation "(הגהות מיימוני...)" was wrongly styled
 * as Rema). Requiring that "הגה" not continue into another Hebrew letter makes it a whole word.
 */
const REMA_OPENING_RE = /^[\s[(]*הג["'׳״]?ה(?![א-ת])/;

/**
 * Punctuation Sefaria's vocalized (Torat Emet) edition leaves between two sibling `<small>` tags
 * that are really one continuous gloss (see absorbGlossRun below) — confirmed by scanning ~100
 * simanim across all four sections: plain space (the overwhelming majority), period+space,
 * comma+space, and (found by direct inspection, rarer) semicolon+space.
 */
const REMA_GAP_RE = /^[\s.,;:]*/;

const SMALL_OPEN = "<small>";
const SMALL_CLOSE = "</small>";

/** Index of the `</small>` closing `html`'s `<small>` at `openIndex`, accounting for nesting. */
function matchingSmallEnd(html: string, openIndex: number): number | null {
  let depth = 1;
  let i = openIndex + SMALL_OPEN.length;
  while (i < html.length) {
    const nextClose = html.indexOf(SMALL_CLOSE, i);
    if (nextClose === -1) return null;
    const nextOpen = html.indexOf(SMALL_OPEN, i);
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + SMALL_OPEN.length;
      continue;
    }
    depth--;
    if (depth === 0) return nextClose;
    i = nextClose + SMALL_CLOSE.length;
  }
  return null;
}

/**
 * Wraps Rema's glosses — the Mapah — in `<rm>…</rm>` so they can be rendered in their own
 * typeface, matching printed Shulchan Arukh volumes, where the Mechaber's text is set in square
 * letters and Rema's glosses in Rashi script.
 *
 * Sefaria marks each gloss as its own `<small>…</small>` block opening with the word "הגה", and
 * uses that same `<small>` tag for unrelated parenthetical matter (word explanations, bare source
 * citations) that must *not* be restyled — hence the opening-word test rather than treating every
 * `<small>` as Rema. Verified against the live API over 60 simanim spanning all four sections:
 * 114 of 235 `<small>` blocks opened with "הגה", and "הגה" never appeared outside a `<small>` even
 * once, so this catches every gloss with no false positives.
 *
 * The `<small>` boundary — not the first colon — is where a gloss actually ends: glosses routinely
 * contain internal colons ahead of their closing source citation (YD 1:1's "…שאין הנשים שוחטות:
 * (ב"י בשם האגור):"), and many end on the citation rather than a colon at all, so cutting at the
 * first colon would truncate Rema mid-gloss.
 *
 * **Must run before processCommentaryMarkers.** The opening-word test strips tags to read the
 * gloss's first word, which only works while any leading tags are still Sefaria's contentless
 * `<i data-commentator …></i>` markers — once those become `<mk s="N">(א)</mk>` they carry visible
 * text of their own and would mask the "הגה".
 *
 * Works on both the default (unvocalized) SA edition and the vocalized Torat Emet edition (see
 * SATextMode in textModels.ts) — the `<small>`-tagged glosses exist independently of which
 * edition is fetched, confirmed directly against the API for both.
 *
 * **The vocalized edition fragments one printed gloss across many sibling `<small>` tags**,
 * unlike the default edition's single contiguous block per gloss — confirmed directly against
 * the API (e.g. OC 1:1, 2:6, 3:11): only the *first* sibling opens with "הגה"; the rest are the
 * same gloss's own continuation sentences and source citations, which don't themselves start
 * with "הגה" and would otherwise be left unstyled. `absorbGlossRun` extends a confirmed opening
 * forward across any immediately-following sibling `<small>` tags — real (non-whitespace,
 * non-punctuation) Mechaber text between two `<small>` tags always signals the gloss has ended
 * (confirmed in every case checked, e.g. OC 2's "וְיִבְדֹּק נְקָבָיו:" sits plainly between two
 * small runs and is correctly excluded from the run it sits inside).
 */
function absorbGlossRun(html: string, firstEnd: number): number {
  let runEnd = firstEnd;
  for (;;) {
    const gapStart = runEnd + SMALL_CLOSE.length;
    const gapMatch = REMA_GAP_RE.exec(html.slice(gapStart));
    const nextStart = gapStart + (gapMatch?.[0].length ?? 0);
    if (!html.startsWith(SMALL_OPEN, nextStart)) return runEnd;
    const nextEnd = matchingSmallEnd(html, nextStart);
    if (nextEnd === null) return runEnd;
    runEnd = nextEnd;
  }
}

export function processRemaGlosses(html: string): string {
  if (!html.includes(SMALL_OPEN)) return html;
  let out = "";
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf(SMALL_OPEN, i);
    if (start === -1) break;
    const end = matchingSmallEnd(html, start);
    if (end === null) break;
    const body = html.slice(start + SMALL_OPEN.length, end);
    out += html.slice(i, start);
    if (REMA_OPENING_RE.test(stripNikud(stripHTML(body)).trim())) {
      const runEnd = absorbGlossRun(html, end);
      out += `<rm>${html.slice(start, runEnd + SMALL_CLOSE.length)}</rm>`;
      i = runEnd + SMALL_CLOSE.length;
    } else {
      // Not Rema, but a gloss nested inside it still might be — recurse rather than skip.
      out += `${SMALL_OPEN}${processRemaGlosses(body)}${SMALL_CLOSE}`;
      i = end + SMALL_CLOSE.length;
    }
  }
  return out + html.slice(i);
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
 * Like processedHebrew, but preserves two kinds of Shulchan Arukh markup instead of stripping
 * them along with the rest of Sefaria's HTML:
 * - processCommentaryMarkers' `<mk s="N">…</mk>` tags → `<span class="sa-mark sa-mark-N">`, so the
 *   inline commentary-marker brackets keep their per-slot identity for client-side styling
 *   (distinct font/size per commentator — see globals.css).
 * - processRemaGlosses' `<rm>…</rm>` tags → `<span class="sa-rema">`, so Rema's glosses render in
 *   their own typeface, the way printed volumes set them in Rashi script.
 *
 * Everything else is plain-texted exactly as processedHebrew does. Both kinds are pulled out
 * before stripping (via placeholders that survive both the tag-stripping regex and the
 * cantillation-mark filter) and spliced back in afterward as real markup, so callers must render
 * the result with dangerouslySetInnerHTML rather than as plain text. `<rm>`'s open and close are
 * placeheld separately rather than as one unit, since a gloss's own text routinely carries `<mk>`
 * markers that still need their own substitution.
 */
export function processedHebrewWithMarkers(html: string, showTrop: boolean = false): string {
  const markers: string[] = [];
  const withPlaceholders = html
    .replace(MARKER_TAG_RE, (_m, slot: string, text: string) => {
      const i = markers.length;
      markers.push(`<span class="sa-mark sa-mark-${slot}">${text}</span>`);
      return `\uE000MK${i}\uE000`;
    })
    .replace(/<rm>/g, "\uE000RMO\uE000")
    .replace(/<\/rm>/g, "\uE000RMC\uE000");
  const stripped = processedHebrew(withPlaceholders, showTrop);
  return stripped
    .replace(/\uE000MK(\d+)\uE000/g, (_m, i: string) => markers[Number(i)] ?? "")
    .replace(/\uE000RMO\uE000/g, '<span class="sa-rema">')
    .replace(/\uE000RMC\uE000/g, "</span>");
}

const TUR_MARKER_TAG_RE = /<dm>(\d+)<\/dm>/g;

/**
 * Like processedHebrew, but preserves buildTurSegments'/processTurMarkers' `<dm>N</dm>` tags \u2014
 * converting them into `<span class="dm-mark">(letter)</span>`, a parenthesized Hebrew numeral
 * (saHebrewLetter, standard gematria \u2014 \u05D9=10, \u05DB=20, etc.) matching how printed Tur volumes mark
 * Darkhei Moshe's reference points, rather than a plain digit \u2014 instead of stripping them along
 * with the rest of Sefaria's HTML. Used only for Tur's Hebrew main text, mirroring
 * processedHebrewWithMarkers' placeholder-splice approach exactly (same reasoning: the marker
 * text has to survive both the tag-stripping regex and the cantillation-mark filter). Callers
 * must render the result with dangerouslySetInnerHTML.
 */
export function processedHebrewWithTurMarkers(html: string, showTrop: boolean = false): string {
  const markers: string[] = [];
  const withPlaceholders = html.replace(TUR_MARKER_TAG_RE, (_m, n: string) => {
    const i = markers.length;
    markers.push(`<span class="dm-mark">(${saHebrewLetter(Number(n))})</span>`);
    return `\uE000DM${i}\uE000`;
  });
  const stripped = processedHebrew(withPlaceholders, showTrop);
  return stripped.replace(/\uE000DM(\d+)\uE000/g, (_m, i: string) => markers[Number(i)] ?? "");
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
