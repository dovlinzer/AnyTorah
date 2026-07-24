// Ports native's YomiService.swift: parses Sefaria's daily-calendar refs into this catalog's
// flat {category, index, chapter} selection shape. The web catalog (lib/textCatalog.ts) uses
// global ids per category rather than native's seder/tractateIndexInSeder pairs, so lookups here
// are simple `allXTractates.find(sefariaName === ...)` calls instead of nested seder loops.
//
// Name-map entries below are verified directly against Sefaria's live index/calendar output
// (see project memory / feedback_verify_against_source_not_spotchecks) rather than assumed from
// native's own maps — this catalog's sefariaName spellings don't always match native's, so a
// map entry that's needed in one codebase can be redundant or wrong in the other.
import { TextCatalog } from "./textCatalog";

export type YomiCategory = "talmud" | "mishnah" | "rambam" | "tanakh";

export interface YomiResult {
  category: YomiCategory;
  index: number;
  chapter: number;
  displayLabel: string;
}

export interface ParshaResult extends YomiResult {
  verse: number | null;
  name: string;
  /** Sefaria's own Hebrew parasha name (e.g. "ואתחנן") — there's no catalog equivalent for
   *  parasha names (unlike tractates/works/books), so this is passed through directly rather
   *  than derived. */
  hebrewName: string;
}

export interface YomiToday {
  daf: YomiResult | null;
  mishnah: YomiResult | null;
  rambam: YomiResult | null;
  tanakh929: YomiResult | null;
  parsha: ParshaResult | null;
}

interface CalendarItem {
  title?: { en?: string };
  displayValue?: { en?: string; he?: string };
  ref?: string;
}

// Talmud: verified against Sefaria's live Bavli tractate index — every calendar Daf Yomi ref
// spells tractate names identically to this catalog's sefariaName (e.g. "Taanit", no apostrophe),
// unlike native's catalog which needed a "Taanit" -> "Ta'anit" entry. No map needed here.
const TALMUD_NAME_MAP: Record<string, string> = {};

// Mishnah: 3 tractates where this catalog's sefariaName differs from Sefaria's actual calendar
// spelling (confirmed by diffing this catalog against Sefaria's live Mishnah index).
const MISHNAH_NAME_MAP: Record<string, string> = {
  "Ta'anit": "Mishnah Taanit",
  Oholot: "Mishnah Ohalot",
  Tahorot: "Mishnah Taharot",
};

// Rambam: calendar work name (after stripping "Mishneh Torah, ") -> this catalog's sefariaName.
// Only entries where the calendar spells a work differently than "Mishneh Torah, <name>". Ported
// from native's YomiService.swift, which reverse-engineered these from real production calendar
// data over time — confirmed "The Order of Prayer" is a genuine distinct Sefaria title (not a
// guess) by direct API lookup, so the rest of this table is trusted as equally real.
const RAMBAM_NAME_MAP: Record<string, string> = {
  "The Order of Prayer": "Mishneh Torah, Prayer and the Priestly Blessing",
  Oaths: "Mishneh Torah, Oaths",
  Sabbath: "Mishneh Torah, Sabbath",
  "Foundations of the Torah": "Mishneh Torah, Foundations of the Torah",
  "Human Dispositions": "Mishneh Torah, Human Dispositions",
  "Torah Study": "Mishneh Torah, Torah Study",
  "Foreign Worship and Customs of the Nations": "Mishneh Torah, Foreign Worship and Customs of the Nations",
  Repentance: "Mishneh Torah, Repentance",
  "Reading the Shema": "Mishneh Torah, Reading the Shema",
  "Prayer and the Priestly Blessing": "Mishneh Torah, Prayer and the Priestly Blessing",
  "Tefillin, Mezuzah and the Torah Scroll": "Mishneh Torah, Tefillin, Mezuzah and the Torah Scroll",
  Fringes: "Mishneh Torah, Fringes",
  Blessings: "Mishneh Torah, Blessings",
  Circumcision: "Mishneh Torah, Circumcision",
  Eruvin: "Mishneh Torah, Eruvin",
  "Leavened and Unleavened Bread": "Mishneh Torah, Leavened and Unleavened Bread",
  "Shofar, Sukkah and Lulav": "Mishneh Torah, Shofar, Sukkah and Lulav",
  Fasts: "Mishneh Torah, Fasts",
  "Scroll of Esther and Hanukkah": "Mishneh Torah, Scroll of Esther and Hanukkah",
};

function parseDafYomi(ref: string): YomiResult | null {
  const parts = ref.split(" ");
  if (parts.length < 2) return null;
  const daf = parseInt(parts[parts.length - 1], 10);
  if (!Number.isFinite(daf)) return null;
  const rawTractate = parts.slice(0, -1).join(" ");
  const tractateName = TALMUD_NAME_MAP[rawTractate] ?? rawTractate;
  const t = TextCatalog.allTalmudTractates.find((t) => t.sefariaName === tractateName);
  if (!t) return null;
  return { category: "talmud", index: t.id, chapter: daf, displayLabel: `${t.sefariaName} ${daf}` };
}

function parseMishnahYomi(ref: string): YomiResult | null {
  const r = ref.startsWith("Mishnah ") ? ref.slice("Mishnah ".length) : ref;
  const parts = r.split(" ");
  if (parts.length < 2) return null;
  const chapterStr = (parts[parts.length - 1] ?? "").split(":")[0];
  const chapter = parseInt(chapterStr, 10);
  if (!Number.isFinite(chapter)) return null;
  const tractate = parts.slice(0, -1).join(" ");
  const sefariaName = MISHNAH_NAME_MAP[tractate] ?? `Mishnah ${tractate}`;
  const t = TextCatalog.allMishnahTractates.find((t) => t.sefariaName === sefariaName);
  if (!t) return null;
  return { category: "mishnah", index: t.id, chapter, displayLabel: `${t.name} ch. ${chapter}` };
}

function parseRambamYomi(ref: string): YomiResult | null {
  const prefix = "Mishneh Torah, ";
  const r = ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
  const parts = r.split(" ");
  if (parts.length < 2) return null;
  const chapter = parseInt(parts[parts.length - 1], 10);
  if (!Number.isFinite(chapter)) return null;
  const calendarWorkName = parts.slice(0, -1).join(" ");

  const candidates = [`Mishneh Torah, ${calendarWorkName}`, RAMBAM_NAME_MAP[calendarWorkName]].filter(
    (s): s is string => !!s,
  );
  for (const sefariaName of candidates) {
    const w = TextCatalog.allRambamWorks.find((w) => w.sefariaName === sefariaName);
    if (w) return { category: "rambam", index: w.id, chapter, displayLabel: `${w.name} ch. ${chapter}` };
  }
  return null;
}

function parseTanakhRef(ref: string): { bookIndex: number; chapter: number; verse: number | null } | null {
  const parts = ref.split(" ");
  if (parts.length < 2) return null;
  const chapterVerse = parts[parts.length - 1];
  const colonParts = chapterVerse.split(":");
  const chapter = parseInt(colonParts[0], 10);
  if (!Number.isFinite(chapter)) return null;
  const verseRaw = colonParts.length > 1 ? parseInt(colonParts[1].split("-")[0], 10) : NaN;
  const bookName = parts.slice(0, -1).join(" ");
  const book = TextCatalog.allTanakhBooks.find((b) => b.sefariaName === bookName);
  if (!book) return null;
  return { bookIndex: book.id, chapter, verse: Number.isFinite(verseRaw) ? verseRaw : null };
}

function parseTanakhYomi(ref: string): YomiResult | null {
  const parsed = parseTanakhRef(ref);
  if (!parsed) return null;
  const book = TextCatalog.allTanakhBooks[parsed.bookIndex];
  return {
    category: "tanakh",
    index: parsed.bookIndex,
    chapter: parsed.chapter,
    displayLabel: `${book.name} ${parsed.chapter}`,
  };
}

function parseParshaYomi(ref: string, name: string, hebrewName: string): ParshaResult | null {
  const parsed = parseTanakhRef(ref);
  if (!parsed) return null;
  const book = TextCatalog.allTanakhBooks[parsed.bookIndex];
  return {
    category: "tanakh",
    index: parsed.bookIndex,
    chapter: parsed.chapter,
    verse: parsed.verse,
    name,
    hebrewName,
    displayLabel: `${name} (${book.name} ${parsed.chapter})`,
  };
}

/** Parses Sefaria's `calendar_items` array (raw `/api/calendars` response) into today's results. */
export function parseCalendarItems(items: CalendarItem[]): YomiToday {
  let daf: YomiResult | null = null;
  let mishnah: YomiResult | null = null;
  let rambam: YomiResult | null = null;
  let tanakh929: YomiResult | null = null;
  let parsha: ParshaResult | null = null;

  for (const item of items) {
    const titleEn = item.title?.en;
    const ref = item.ref ?? "";
    if (!titleEn || !ref) continue;
    switch (titleEn) {
      case "Daf Yomi":
        daf = parseDafYomi(ref);
        break;
      case "Daily Mishnah":
        mishnah = parseMishnahYomi(ref);
        break;
      case "Daily Rambam":
        rambam = parseRambamYomi(ref);
        break;
      case "929":
        tanakh929 = parseTanakhYomi(ref);
        break;
      case "Parashat Hashavua":
        parsha = parseParshaYomi(ref, item.displayValue?.en ?? "", item.displayValue?.he ?? "");
        break;
      default:
        break;
    }
  }

  return { daf, mishnah, rambam, tanakh929, parsha };
}
