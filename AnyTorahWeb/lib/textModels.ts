// Ported from AnyTorah/AnyTorah/Models/TextModels.swift — everything except CommentaryType,
// which lives in ./commentaryTypes.ts.

import type { CommentaryType } from "./commentaryTypes";

// MARK: - Category

export type TextCategory =
  | "tanakh"
  | "mishnah"
  | "talmud"
  | "rambam"
  | "shulchanArukh"
  | "tur"
  | "midrash"
  | "teshuvot";

export type SegmentLabelStyle = "verse" | "mishnah" | "halakha" | "sif" | "none";

interface TextCategoryMeta {
  displayName: string;
  hebrewName: string;
  /** Fallback list used when no context-specific override applies. The commentary pool
   *  filtering logic is the authoritative source at runtime. */
  defaultCommentaries: CommentaryType[];
  segmentLabelStyle: SegmentLabelStyle;
}

export const textCategoryMeta: Record<TextCategory, TextCategoryMeta> = {
  tanakh: {
    displayName: "Tanakh",
    hebrewName: "תנ״ך",
    defaultCommentaries: ["onkelos", "rashiTanakh", "ramban"],
    segmentLabelStyle: "verse",
  },
  mishnah: {
    displayName: "Mishnah",
    hebrewName: "משנה",
    defaultCommentaries: ["rambamMishnah", "bartenura", "tosafotYomTov"],
    segmentLabelStyle: "mishnah",
  },
  talmud: {
    displayName: "Talmud",
    hebrewName: "תלמוד",
    defaultCommentaries: ["rashiTalmud", "tosafot"],
    segmentLabelStyle: "none",
  },
  rambam: {
    displayName: "Rambam",
    hebrewName: "רמב״ם",
    defaultCommentaries: ["maggidMishnah", "kesefMishnah"],
    segmentLabelStyle: "halakha",
  },
  shulchanArukh: {
    displayName: "Shulkhan Arukh",
    hebrewName: "שולחן ערוך",
    defaultCommentaries: ["mishnahBerurah", "biurHalakha"],
    segmentLabelStyle: "sif",
  },
  tur: {
    displayName: "Tur",
    hebrewName: "טור",
    defaultCommentaries: ["beitYosef", "bach", "darkheiMoshe"],
    segmentLabelStyle: "sif",
  },
  midrash: {
    displayName: "Midrash",
    hebrewName: "מדרש",
    defaultCommentaries: [],
    segmentLabelStyle: "none",
  },
  teshuvot: {
    displayName: "Teshuvot",
    hebrewName: "שו״ת",
    defaultCommentaries: [],
    segmentLabelStyle: "none",
  },
};

// MARK: - Subcategories

export type MishnahSubcategory = "mishnah" | "tosefta";
export const mishnahSubcategoryMeta: Record<MishnahSubcategory, { displayName: string; hebrewName: string }> = {
  mishnah: { displayName: "Mishnah", hebrewName: "משנה" },
  tosefta: { displayName: "Tosefta", hebrewName: "תוספתא" },
};

export type TalmudSubcategory = "bavli" | "yerushalmi";
export const talmudSubcategoryMeta: Record<TalmudSubcategory, { displayName: string; hebrewName: string }> = {
  bavli: { displayName: "Bavli", hebrewName: "בבלי" },
  yerushalmi: { displayName: "Yerushalmi", hebrewName: "ירושלמי" },
};

export type MidrashSubcategory = "halakha" | "aggada";
export const midrashSubcategoryMeta: Record<MidrashSubcategory, { displayName: string; hebrewName: string }> = {
  halakha: { displayName: "Midrash Halakha", hebrewName: "מדרש הלכה" },
  aggada: { displayName: "Midrash Aggada", hebrewName: "מדרש אגדה" },
};

// MARK: - Midrash

export type MidrashWork =
  | "mekhiltaYishmael" | "mekhiltaShimon" | "sifra" | "sifreiBamidbar" | "sifreiDevarim"
  | "bereishitRabbah" | "shemotRabbah" | "vayikraRabbah" | "bamidbarRabbah" | "devarimRabbah"
  | "tanchumaStandard" | "tanchumaBuber";

export const midrashWorkSubcategory: Record<MidrashWork, MidrashSubcategory> = {
  mekhiltaYishmael: "halakha", mekhiltaShimon: "halakha", sifra: "halakha",
  sifreiBamidbar: "halakha", sifreiDevarim: "halakha",
  bereishitRabbah: "aggada", shemotRabbah: "aggada", vayikraRabbah: "aggada",
  bamidbarRabbah: "aggada", devarimRabbah: "aggada",
  tanchumaStandard: "aggada", tanchumaBuber: "aggada",
};

export const midrashWorkDisplayName: Record<MidrashWork, string> = {
  mekhiltaYishmael: "Mekhilta (R. Yishmael)",
  mekhiltaShimon: "Mekhilta (R. Shimon)",
  sifra: "Sifra",
  sifreiBamidbar: "Sifrei Bamidbar",
  sifreiDevarim: "Sifrei Devarim",
  bereishitRabbah: "Bereishit Rabbah",
  shemotRabbah: "Shemot Rabbah",
  vayikraRabbah: "Vayikra Rabbah",
  bamidbarRabbah: "Bamidbar Rabbah",
  devarimRabbah: "Devarim Rabbah",
  tanchumaStandard: "Midrash Tanchuma",
  tanchumaBuber: "Tanchuma (Buber)",
};

export const midrashWorkHebrewName: Record<MidrashWork, string> = {
  mekhiltaYishmael: "מכילתא דר׳ ישמעאל",
  mekhiltaShimon: "מכילתא דרשב״י",
  sifra: "ספרא",
  sifreiBamidbar: "ספרי במדבר",
  sifreiDevarim: "ספרי דברים",
  bereishitRabbah: "בראשית רבה",
  shemotRabbah: "שמות רבה",
  vayikraRabbah: "ויקרא רבה",
  bamidbarRabbah: "במדבר רבה",
  devarimRabbah: "דברים רבה",
  tanchumaStandard: "מדרש תנחומא",
  tanchumaBuber: "תנחומא (בובר)",
};

/** Torah book indices this work covers (0=Gen, 1=Exod, 2=Lev, 3=Num, 4=Deut). */
export const midrashWorkApplicableBookIndices: Record<MidrashWork, number[]> = {
  mekhiltaYishmael: [1], mekhiltaShimon: [1], shemotRabbah: [1],
  sifra: [2], vayikraRabbah: [2],
  sifreiBamidbar: [3], bamidbarRabbah: [3],
  sifreiDevarim: [4], devarimRabbah: [4],
  bereishitRabbah: [0],
  tanchumaStandard: [0, 1, 2, 3, 4], tanchumaBuber: [0, 1, 2, 3, 4],
};

/** Exact Sefaria index_title for this work — used to match links API results. */
export const midrashWorkSefariaIndexTitle: Record<MidrashWork, string> = {
  mekhiltaYishmael: "Mekhilta DeRabbi Yishmael",
  mekhiltaShimon: "Mekhilta DeRabbi Shimon Ben Yochai",
  sifra: "Sifra",
  sifreiBamidbar: "Sifrei Bamidbar",
  sifreiDevarim: "Sifrei Devarim",
  bereishitRabbah: "Bereshit Rabbah",
  shemotRabbah: "Shemot Rabbah",
  vayikraRabbah: "Vayikra Rabbah",
  bamidbarRabbah: "Bamidbar Rabbah",
  devarimRabbah: "Devarim Rabbah",
  tanchumaStandard: "Midrash Tanchuma",
  tanchumaBuber: "Midrash Tanchuma Buber",
};

export function midrashWorksFor(subcategory: MidrashSubcategory): MidrashWork[] {
  return (Object.keys(midrashWorkSubcategory) as MidrashWork[]).filter(
    (w) => midrashWorkSubcategory[w] === subcategory,
  );
}

export const tanchumaParashas = [
  "Bereshit","Noach","Lech Lecha","Vayera","Chayei Sara","Toldot","Vayetzei",
  "Vayishlach","Vayeshev","Miketz","Vayigash","Vayechi","Shemot","Vaera","Bo",
  "Beshalach","Yitro","Mishpatim","Terumah","Tetzaveh","Ki Tisa","Vayakhel",
  "Pekudei","Vayikra","Tzav","Shmini","Tazria","Metzora","Achrei Mot","Kedoshim",
  "Emor","Behar","Bechukotai","Bamidbar","Nasso","Beha'alotcha","Sh'lach",
  "Korach","Chukat","Balak","Pinchas","Matot","Masei","Devarim","Vaetchanan",
  "Eikev","Re'eh","Shoftim","Ki Teitzei","Ki Tavo","Nitzavim","Vayeilech",
  "Ha'Azinu","V'Zot HaBerachah",
];

export const tanchumaBuberParashas = [
  "Bereshit","Noach","Lech Lecha","Vayera","Chayei Sara","Toldot","Vayetzei",
  "Vayishlach","Vayeshev","Miketz","Vayigash","Vayechi","Shemot","Vaera","Bo",
  "Beshalach","Yitro","Mishpatim","Terumah","Tetzaveh","Ki Tisa","Vayakhel",
  "Pekudei","Vayikra","Tzav","Shmini","Tazria","Metzora","Achrei Mot","Kedoshim",
  "Emor","Behar","Bechukotai","Bamidbar","Nasso","Beha'alotcha","Sh'lach",
  "Appendix to Sh'lach","Korach","Appendix to Korach","Chukat","Appendix to Chukat",
  "Balak","Pinchas","Matot","Masei","Devarim","Appendix to Devarim","Vaetchanan",
  "Appendix to Vaetchanan","Eikev","Re'eh","Appendix to Re'eh","Shoftim",
  "Ki Teitzei","Ki Tavo","Nitzavim","Ha'Azinu","V'Zot HaBerachah",
];

export const mekhiltaYishmaelTractates = [
  "Pischa","Vayehi Beshalach","Shirah","Vayassa","Amalek",
  "Bachodesh","Nezikin","Kaspa","Shabbata",
];

export const sifraParashas = [
  "Baraita DeRabbi Yishmael","Vayikra Dibbura DeNedavah","Vayikra Dibbura DeChovah",
  "Tzav","Shemini","Tazria Parashat Yoledet","Tazria Parashat Negaim","Metzora",
  "Metzora Parashat Zavim","Acharei Mot","Kedoshim","Emor","Behar","Bechukotai",
];

export type MidrashNativeStyle =
  | { kind: "numericTwo"; maxChapters: number }
  | { kind: "numericOne"; maxSections: number }
  | { kind: "namedTwo"; names: string[] }
  | { kind: "namedTractate"; names: string[] }
  | { kind: "namedSection"; names: string[] };

export function midrashNativeStyle(work: MidrashWork): MidrashNativeStyle {
  switch (work) {
    case "bereishitRabbah": return { kind: "numericTwo", maxChapters: 100 };
    case "shemotRabbah": return { kind: "numericTwo", maxChapters: 52 };
    case "vayikraRabbah": return { kind: "numericTwo", maxChapters: 37 };
    case "bamidbarRabbah": return { kind: "numericTwo", maxChapters: 23 };
    case "devarimRabbah": return { kind: "numericTwo", maxChapters: 11 };
    case "sifreiBamidbar": return { kind: "numericOne", maxSections: 161 };
    case "sifreiDevarim": return { kind: "numericOne", maxSections: 357 };
    case "tanchumaStandard": return { kind: "namedTwo", names: tanchumaParashas };
    case "tanchumaBuber": return { kind: "namedTwo", names: tanchumaBuberParashas };
    case "mekhiltaYishmael": return { kind: "namedTractate", names: mekhiltaYishmaelTractates };
    case "mekhiltaShimon": return { kind: "numericTwo", maxChapters: 50 };
    case "sifra": return { kind: "namedSection", names: sifraParashas };
  }
}

export function midrashNativeIsOneLevel(work: MidrashWork): boolean {
  return midrashNativeStyle(work).kind === "numericOne";
}

export function midrashNativeMaxChapters(work: MidrashWork): number {
  const style = midrashNativeStyle(work);
  switch (style.kind) {
    case "numericTwo": return style.maxChapters;
    case "numericOne": return style.maxSections;
    case "namedTwo": case "namedTractate": case "namedSection": return style.names.length;
  }
}

export function midrashNativeChapterLabel(work: MidrashWork): string {
  switch (midrashNativeStyle(work).kind) {
    case "numericTwo": case "numericOne": return "Chapter";
    case "namedTwo": return "Parasha";
    case "namedTractate": return "Tractate";
    case "namedSection": return "Section";
  }
}

export function midrashNativeChapterLabels(work: MidrashWork): string[] {
  const style = midrashNativeStyle(work);
  switch (style.kind) {
    case "numericTwo": return Array.from({ length: style.maxChapters }, (_, i) => `${i + 1}`);
    case "numericOne": return Array.from({ length: style.maxSections }, (_, i) => `${i + 1}`);
    case "namedTwo": case "namedTractate": case "namedSection": return style.names;
  }
}

export function midrashNativeRef(work: MidrashWork, chapter: number, section: number): string {
  const base = midrashWorkSefariaIndexTitle[work];
  const style = midrashNativeStyle(work);
  switch (style.kind) {
    case "numericTwo": return `${base} ${chapter}:${section}`;
    case "numericOne": return `${base} ${chapter}`;
    case "namedTwo": {
      if (chapter < 1 || chapter > style.names.length) return "";
      return `${base}, ${style.names[chapter - 1]} ${section}`;
    }
    case "namedTractate": {
      if (chapter < 1 || chapter > style.names.length) return "";
      return `${base}, Tractate ${style.names[chapter - 1]} ${section}`;
    }
    case "namedSection": {
      if (chapter < 1 || chapter > style.names.length) return "";
      return `${base}, ${style.names[chapter - 1]} ${section}`;
    }
  }
}

export type MidrashNavigationMode = "byVerse" | "native";

// MARK: - Display Mode

export type TextDisplayMode = "source" | "translation" | "both";

/**
 * Shulchan Arukh main-text edition. Sefaria has no single edition carrying both nikud and the
 * inline commentary-marker tags (`data-commentator`) our bracket system depends on — confirmed
 * directly against the API, not assumed — so this is a user choice between two different
 * complete digitizations, not a rendering option on one shared text:
 * - "commentary": the current default edition — carries every inline marker (Mishnah Berurah
 *   labels, Shakh/Taz/etc. sequential letters) but no nikud.
 * - "nikud": the vocalized Torat Emet edition — no inline markers at all (splitSimanHeader's
 *   leading-<b> siman-title block is also absent from it), but full nikud.
 * Rema's `<small>`-tagged glosses exist in both editions independently of this choice, so the
 * Rema-font distinction (processRemaGlosses) applies either way.
 * A future phase may blend the two (splicing marker positions into the vocalized text via word
 * alignment, run as a durable, correctable batch job) — this is the interim, simpler either/or.
 */
export type SATextMode = "commentary" | "nikud";

// MARK: - Text Segment

/** One displayable unit of text — a verse, mishnah, Gemara sentence, or a divider marker. */
export interface TextSegment {
  id: string;
  index: number; // position in the source array (0-based); -1 for the amud-B marker
  hebrewHTML: string;
  englishHTML: string;
  label: string | null; // verse/mishnah number to show in margin
  isAmudBMarker: boolean;
  markerDaf: number; // meaningful only when isAmudBMarker is true
  raavadHe?: string | null; // plain-text Ra'avad Hasagot (Hebrew), undefined/null = no comment
  raavadEn?: string | null;
}

let segmentIdCounter = 0;
function nextSegmentId(): string {
  segmentIdCounter += 1;
  return `seg-${segmentIdCounter}`;
}

export function contentSegment(
  index: number,
  he: string,
  en: string,
  label: string | null = null,
  raavadHe: string | null = null,
  raavadEn: string | null = null,
): TextSegment {
  return {
    id: nextSegmentId(),
    index,
    hebrewHTML: he,
    englishHTML: en,
    label,
    isAmudBMarker: false,
    markerDaf: 0,
    raavadHe,
    raavadEn,
  };
}

export function amudBMarkerSegment(daf: number): TextSegment {
  return {
    id: nextSegmentId(),
    index: -1,
    hebrewHTML: "",
    englishHTML: "",
    label: null,
    isAmudBMarker: true,
    markerDaf: daf,
    raavadHe: null,
    raavadEn: null,
  };
}

// MARK: - Commentary Entry

/** A single item in the displayed commentary list. */
export type CommentaryEntry =
  | { kind: "text"; index: number; label: number | null; he: string; en: string }
  /** Subtle recension separator — used only for Tosafot Rid multi-recension dividers. */
  | { kind: "recensionHeader"; text: string }
  /** Prominent book-section separator — used when a commentator combines two distinct works. */
  | { kind: "bookDivider"; text: string }
  /** Talmud only — divider between a commentary's amud-A and amud-B entries, mirroring the
   *  main text's amud-B marker. */
  | { kind: "amudBMarker"; daf: number };

export function textEntry(
  index: number,
  he: string,
  en: string,
  label: number | null = null,
): CommentaryEntry {
  return { kind: "text", index, label, he, en };
}

// MARK: - Fetched content

export interface FetchedText {
  segments: TextSegment[];
  ref: string;
}

// MARK: - Hebrew numeral helper

export function toHebrewNumeral(n: number): string {
  if (n <= 0) return "";
  let remaining = n;
  let letters = "";
  for (const [v, l] of [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"]] as const) {
    while (remaining >= v) { letters += l; remaining -= v; }
  }
  if (remaining === 15) { letters += "טו"; remaining = 0; }
  else if (remaining === 16) { letters += "טז"; remaining = 0; }
  else {
    for (const [v, l] of [[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"]] as const) {
      while (remaining >= v) { letters += l; remaining -= v; }
    }
    for (const [v, l] of [[9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"]] as const) {
      while (remaining >= v) { letters += l; remaining -= v; }
    }
  }
  if (letters.length === 1) return letters + "׳";
  return letters.slice(0, -1) + "״" + letters.slice(-1);
}

// MARK: - Torah verse counts (for Midrash verse picker)

const torahVerseCounts: number[][] = [
  // Genesis (50 chapters)
  [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,33,20,31,22,43,36,38,23,23,57,38,34,34,28,34,31,22,33,26],
  // Exodus (40 chapters)
  [22,25,22,31,23,30,25,28,35,29,10,51,22,31,27,36,16,27,25,26,36,30,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
  // Leviticus (27 chapters)
  [17,16,17,35,26,23,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
  // Numbers (36 chapters)
  [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],
  // Deuteronomy (34 chapters)
  [46,37,29,49,30,25,26,20,29,22,32,32,19,29,23,22,20,22,21,20,23,30,26,22,19,19,26,68,29,20,30,52,29,12],
];

/**
 * Returns the number of verses in the given Torah chapter.
 * bookIndex: 0=Genesis 1=Exodus 2=Leviticus 3=Numbers 4=Deuteronomy
 */
export function torahVerseCount(bookIndex: number, chapter: number): number {
  const book = torahVerseCounts[bookIndex];
  if (!book) return 50;
  if (chapter < 1 || chapter > book.length) return 50;
  return book[chapter - 1];
}

// MARK: - SA inline commentary-marker letters and bracket styles
//
// Shared between lib/sefariaClient.ts (server — builds the main text's inline markers) and
// components/CommentaryPanel.tsx (client — needs the same letter/bracket-shape logic to label
// its own entries so the panel visually matches the main text). Kept here rather than in
// sefariaClient.ts specifically so the client component doesn't need to import that module's
// server-oriented fetch code.

/**
 * Returns the Hebrew numeral representation of n for sequential marker labelling, without
 * geresh marks: 1=א … 10=י, 11=יא, 12=יב … 20=כ, 21=כא, etc. Uses the standard additive
 * system (15→טו, 16→טז to avoid divine-name combinations).
 */
export function saHebrewLetter(n: number): string {
  if (n < 1) return `${n}`;
  const hundreds: [number, string][] = [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"]];
  const tens: [number, string][] = [[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"]];
  const units: [number, string][] = [[9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"]];
  let result = "";
  let rem = n;
  for (const [val, letter] of hundreds) { while (rem >= val) { result += letter; rem -= val; } }
  if (rem === 15) { result += "טו"; rem = 0; }
  else if (rem === 16) { result += "טז"; rem = 0; }
  for (const [val, letter] of tens) { if (rem >= val) { result += letter; rem -= val; } }
  for (const [val, letter] of units) { if (rem >= val) { result += letter; rem -= val; } }
  return result === "" ? `${n}` : result;
}

export interface SASlotStyle { open: string; close: string; }

/**
 * Bracket shape per slot — three visually distinct shapes, matched with distinct font/size via
 * the sa-mark-N CSS classes (globals.css). The web panel always shows exactly 3 slots.
 */
export const SA_SLOT_STYLES: SASlotStyle[] = [
  { open: "(", close: ")" },
  { open: "{", close: "}" },
  { open: "[", close: "]" },
];

// MARK: - Commentary Layout

/** Where the commentary panel(s) appear relative to the main text. */
export type CommentaryLayout = "bottom" | "left" | "right" | "both";

export const commentaryLayoutDisplayName: Record<CommentaryLayout, string> = {
  bottom: "Panel below text",
  left: "Left-side panel",
  right: "Right-side panel",
  both: "Left and right panels",
};

// MARK: - Teshuvot Rishonim
//
// Ported from AnyTorah/AnyTorah/Models/TextModels.swift's TeshuvotWork/TeshuvotVolume —
// Rishonim subcategory only. Native also has Acharonim and Contemporary (Nishmat HaBayit,
// Iggros Moshe scanned pages + podcast citations, YCT related-articles) — not ported here yet,
// staged for a later pass. No commentary panel for this category, matching native exactly.
//
// Ref data verified against live Sefaria content 2026-08-24/25 (see AnyTorah/CLAUDE.md's
// Teshuvot section) — several titles differ from a naive guess (e.g. Rashba is 5 separately
// titled top-level Sefaria indices, not one title with a numeric volume; Maharik has no
// separate "Shoresh" volume level — Sefaria's own Siman numbering already is the Shoresh
// numbering). `maxSiman` is the Sefaria-confirmed ceiling where known, or
// PLACEHOLDER_MAX_SIMAN (a generous bound — an overshoot just surfaces the ordinary "no text
// found" error, not a crash) elsewhere.

export interface TeshuvotVolume {
  label: string;
  hebrewLabel: string;
  /** Sefaria ref with a literal "{siman}" placeholder — see teshuvotSefariaRef. */
  refTemplate: string;
  maxSiman: number;
  /** Un-abbreviated Hebrew label for the volume-picker select only — falls back to hebrewLabel
   *  when absent. Only Mishpetei Uziel populates this so far (its hebrewLabel abbreviates
   *  Tur-order sections, e.g. "או״ח") — see native's own doc comment on this same field. */
  pickerHebrewLabel?: string;
}

export interface TeshuvotWorkDef {
  id: number;
  displayName: string;
  hebrewName: string;
  century: string;
  /** Label for the volume picker ("Part"/"Klal"/"Chelek"); null hides the volume picker. */
  volumeLabel: string | null;
  volumeLabelHebrew: string | null;
  /** Never empty — a flat work (volumeLabel === null) is still exactly one entry. */
  volumes: TeshuvotVolume[];
}

const PLACEHOLDER_MAX_SIMAN = 400;

function flatVolume(refTemplate: string, maxSiman: number): TeshuvotVolume[] {
  return [{ label: "1", hebrewLabel: "1", refTemplate, maxSiman }];
}

export const TESHUVOT_RISHONIM: TeshuvotWorkDef[] = [
  {
    id: 0, displayName: "Rashi", hebrewName: "רש״י", century: "11th–12th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot Rashi {siman}", 382),
  },
  {
    id: 1, displayName: "Ri Migash", hebrewName: "ר״י מיגאש", century: "11th–12th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot HaRi Migash {siman}", 214),
  },
  {
    id: 2, displayName: "Rambam", hebrewName: "רמב״ם", century: "11th–12th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot HaRambam {siman}", 293),
  },
  {
    id: 3, displayName: "Rashba", hebrewName: "רשב״א", century: "13th Century",
    volumeLabel: "Part", volumeLabelHebrew: "חלק",
    // Wheel positions 1-4 map to Sefaria's separately-titled parts IV-VII (I-III excluded —
    // part I is real for only 5 of 413 simanim, parts II/III were never digitized).
    volumes: ["IV", "V", "VI", "VII"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 4),
      refTemplate: `Teshuvot haRashba part ${numeral} {siman}`,
      maxSiman: [330, 293, 286, 540][i],
    })),
  },
  {
    id: 4, displayName: "Maharam", hebrewName: "מהר״ם מרוטנבורג", century: "13th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    // Sefaria carries 4 separately-paginated printed editions with no shared siman numbering;
    // this defaults to the earliest (Cremona), a simple flat siman list.
    volumes: flatVolume("Teshuvot Maharam, Cremona Edition {siman}", PLACEHOLDER_MAX_SIMAN),
  },
  {
    id: 5, displayName: "Maharach Or Zarua", hebrewName: "מהר״ח אור זרוע", century: "13th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Maharach Or Zarua Responsa {siman}", 261),
  },
  {
    id: 6, displayName: "Rosh", hebrewName: "רא״ש", century: "14th Century",
    volumeLabel: "Klal", volumeLabelHebrew: "כלל",
    volumes: Array.from({ length: 108 }, (_, i) => ({
      label: `${i + 1}`,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Teshuvot HaRosh ${i + 1}:{siman}`,
      maxSiman: PLACEHOLDER_MAX_SIMAN,
    })),
  },
  {
    id: 7, displayName: "Ran", hebrewName: "ר״ן", century: "14th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot HaRan {siman}", 77),
  },
  {
    id: 8, displayName: "Rivash", hebrewName: "ריב״ש", century: "14th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot HaRivash {siman}", 518),
  },
  {
    id: 9, displayName: "Maharil", hebrewName: "מהרי״ל", century: "15th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot Maharil {siman}", PLACEHOLDER_MAX_SIMAN),
  },
  {
    id: 10, displayName: "Terumat HaDeshen", hebrewName: "תרומת הדשן", century: "15th Century",
    volumeLabel: "Part", volumeLabelHebrew: "חלק",
    volumes: ["I", "II"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Terumat HaDeshen, Part ${numeral} {siman}`,
      maxSiman: [354, PLACEHOLDER_MAX_SIMAN][i],
    })),
  },
  {
    id: 11, displayName: "Maharik", hebrewName: "מהרי״ק", century: "15th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot Maharik {siman}", 197),
  },
  {
    id: 12, displayName: "Sefer HaTashbetz", hebrewName: "תשב״ץ", century: "15th Century",
    volumeLabel: "Chelek", volumeLabelHebrew: "חלק",
    volumes: ["I", "II", "III", "IV"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Sefer HaTashbetz, Part ${numeral} {siman}`,
      maxSiman: PLACEHOLDER_MAX_SIMAN,
    })),
  },
];

// MARK: - Teshuvot Acharonim
//
// Ported from AnyTorah/AnyTorah/Models/TextModels.swift's TeshuvotWork — Acharonim subcategory
// (16th–19th century, 31 works). Global ids continue from Rishonim's 0-12 so teshuvotWork/
// teshuvotSefariaRef/teshuvotMaxSiman work unchanged regardless of which UI tab (Rishonim vs.
// Acharonim) is showing — see ALL_TESHUVOT_WORKS below. Ref data verified against live Sefaria
// content 2026-08-28 (see AnyTorah/CLAUDE.md's "Teshuvot Acharonim" section) — several titles
// differ from a naive guess (e.g. Maharam miPadua vs. the unrelated Rishon Meir of Rothenburg,
// Noda BiYehudah's Orach Chaim section spelled without a 'y'). Four sparse works/volumes
// (Mateh Levi, Bach's Kuntres Acharon, Meshiv Davar's Volumes III-IV, Maharit's Part II Even
// HaEzer) were dropped entirely on the native side and are correspondingly absent here.

export const TESHUVOT_ACHARONIM: TeshuvotWorkDef[] = [
  {
    id: 13, displayName: "Avkat Rokhel", hebrewName: "אבקת רוכל", century: "16th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Avkat Rokhel {siman}", 217),
  },
  {
    id: 14, displayName: "Divrei Rivot", hebrewName: "דברי ריבות", century: "16th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Divrei Rivot {siman}", 430),
  },
  {
    id: 15, displayName: "Radbaz", hebrewName: "רדב״ז", century: "16th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    volumes: [588, 842, 1571, 1372, 1700, 2341].map((maxSiman, i) => ({
      label: `${i + 1}`,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Teshuvot HaRadbaz Volume ${i + 1} {siman}`,
      maxSiman,
    })),
  },
  {
    id: 16, displayName: "Maharam miPadua", hebrewName: "מהר״ם מפדובה", century: "16th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    // NOT "Teshuvot Maharam" — that title is the unrelated Rishon Meir of Rothenburg.
    volumes: flatVolume("Responsa Maharam of Padua {siman}", 90),
  },
  {
    id: 17, displayName: "Maharshal", hebrewName: "מהרש״ל", century: "16th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Teshuvot Maharshal {siman}", 101),
  },
  {
    id: 18, displayName: "Maharshdam", hebrewName: "מהרשד״ם", century: "16th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "Responsa Maharashdam, Orach Chayim {siman}", maxSiman: 37 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "Responsa Maharashdam, Yoreh Deah {siman}", maxSiman: 255 },
      { label: "EH", hebrewLabel: "אה״ע", refTemplate: "Responsa Maharashdam, Even HaEzer {siman}", maxSiman: 244 },
      { label: "CM", hebrewLabel: "חו״מ", refTemplate: "Responsa Maharashdam, Choshen Mishpat {siman}", maxSiman: 385 },
    ],
  },
  {
    id: 19, displayName: "Rema", hebrewName: "רמ״א", century: "16th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Responsa of Rema {siman}", 133),
  },
  {
    id: 20, displayName: "Bach", hebrewName: "ב״ח", century: "17th Century",
    volumeLabel: "Part", volumeLabelHebrew: "חלק",
    // Third Sefaria part, "Kuntres Acharon", dropped — sparse content, see doc comment above.
    volumes: [
      { label: "HaYeshanot", hebrewLabel: "הישנות", refTemplate: "Teshuvot Bayit Chadash, HaYeshanot {siman}", maxSiman: 158 },
      { label: "HaChadashot", hebrewLabel: "החדשות", refTemplate: "Teshuvot Bayit Chadash, HaChadashot {siman}", maxSiman: 96 },
    ],
  },
  {
    id: 21, displayName: "Be'er Sheva", hebrewName: "באר שבע", century: "17th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Be'er Sheva {siman}", 75),
  },
  {
    id: 22, displayName: "Chakham Tzvi", hebrewName: "חכם צבי", century: "17th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Chakham Tzvi {siman}", 169),
  },
  {
    id: 23, displayName: "Halakhot Ketanot", hebrewName: "הלכות קטנות", century: "17th Century",
    volumeLabel: "Part", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "I", hebrewLabel: "א", refTemplate: "Halakhot Ketanot, Part I {siman}", maxSiman: 295 },
      { label: "II", hebrewLabel: "ב", refTemplate: "Halakhot Ketanot, Part II {siman}", maxSiman: 318 },
    ],
  },
  {
    id: 24, displayName: "Havot Yair", hebrewName: "חוות יאיר", century: "17th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Havot Yair {siman}", 238),
  },
  {
    id: 25, displayName: "Maharit", hebrewName: "מהרי״ט", century: "17th Century",
    volumeLabel: "Part", volumeLabelHebrew: "חלק",
    // Part II's Even HaEzer sub-section dropped — sparse content, see doc comment above.
    volumes: [
      { label: "I", hebrewLabel: "א", refTemplate: "Teshuvot Maharit, I {siman}", maxSiman: 152 },
      { label: "II, OC", hebrewLabel: "ב, או״ח", refTemplate: "Teshuvot Maharit, II, Orach Chayim {siman}", maxSiman: 8 },
      { label: "II, YD", hebrewLabel: "ב, יו״ד", refTemplate: "Teshuvot Maharit, II, Yoreh Deah {siman}", maxSiman: 55 },
      { label: "II, CM", hebrewLabel: "ב, חו״מ", refTemplate: "Teshuvot Maharit, II, Choshen Mishpat {siman}", maxSiman: 125 },
    ],
  },
  {
    id: 26, displayName: "Admat Kodesh", hebrewName: "אדמת קודש", century: "18th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "Admat Kodesh, Orach Chayim {siman}", maxSiman: 15 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "Admat Kodesh, Yoreh Deah {siman}", maxSiman: 23 },
      { label: "EH", hebrewLabel: "אה״ע", refTemplate: "Admat Kodesh, Even HaEzer {siman}", maxSiman: 54 },
      { label: "CM", hebrewLabel: "חו״מ", refTemplate: "Admat Kodesh, Choshen Mishpat {siman}", maxSiman: 76 },
    ],
  },
  {
    id: 27, displayName: "Noda BiYehudah", hebrewName: "נודע ביהודה", century: "18th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    // User-requested display labels "Kamma"/"Tinyana" — Sefaria's own titles are the bare
    // "Noda BiYehudah I"/"II"; that real title still drives the ref. "Orach Chaim" (no 'y') is
    // Sefaria's own indexed section title specifically for this work — see doc comment above.
    volumes: (
      [["Kamma", "קמא", "Noda BiYehudah I"], ["Tinyana", "תניינא", "Noda BiYehudah II"]] as const
    ).flatMap(([disp, dispHe, title], vi) =>
      (
        [
          ["OC", "או״ח", "Orach Chaim", [42, 141]],
          ["YD", "יו״ד", "Yoreh Deah", [100, 215]],
          ["EH", "אה״ע", "Even HaEzer", [95, 161]],
          ["CM", "חו״מ", "Choshen Mishpat", [39, 62]],
        ] as const
      ).map(([sDisp, sDispHe, sName, counts]) => ({
        label: `${disp}, ${sDisp}`,
        hebrewLabel: `${dispHe}, ${sDispHe}`,
        refTemplate: `${title}, ${sName} {siman}`,
        maxSiman: counts[vi],
      })),
    ),
  },
  {
    id: 28, displayName: "Rabbi Akiva Eiger", hebrewName: "רבי עקיבא איגר", century: "18th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "Kamma", hebrewLabel: "קמא", refTemplate: "Teshuvot Rabbi Akiva Eiger {siman}", maxSiman: 222 },
      { label: "Tinyana", hebrewLabel: "תניינא", refTemplate: "Teshuvot Rabbi Akiva Eiger Tinyana {siman}", maxSiman: 153 },
      { label: "Chadashot", hebrewLabel: "חדשות", refTemplate: "Teshuvot Rabbi Akiva Eiger HaChadashot {siman}", maxSiman: 95 },
    ],
  },
  {
    id: 29, displayName: "Sheilat Yaavetz", hebrewName: "שאילת יעב״ץ", century: "18th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "I", hebrewLabel: "א", refTemplate: "Sheilat Yaavetz, Volume I {siman}", maxSiman: 172 },
      { label: "II", hebrewLabel: "ב", refTemplate: "Sheilat Yaavetz, Volume II {siman}", maxSiman: 200 },
    ],
  },
  {
    id: 30, displayName: "Torat Netanel", hebrewName: "תורת נתנאל", century: "18th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Torat Netanel {siman}", 39),
  },
  {
    id: 31, displayName: "Be'er Yitzchak", hebrewName: "באר יצחק", century: "19th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "Be'er Yitzchak, Orach Chayim {siman}", maxSiman: 30 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "Be'er Yitzchak, Yoreh Deah {siman}", maxSiman: 32 },
      { label: "EH", hebrewLabel: "אה״ע", refTemplate: "Be'er Yitzchak, Even HaEzer {siman}", maxSiman: 18 },
      { label: "CM", hebrewLabel: "חו״מ", refTemplate: "Be'er Yitzchak, Choshen Mishpat {siman}", maxSiman: 6 },
    ],
  },
  {
    id: 32, displayName: "Binyan Olam", hebrewName: "בנין עולם", century: "19th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "Binyan Olam, Orach Chayim {siman}", maxSiman: 36 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "Binyan Olam, Yoreh Deah {siman}", maxSiman: 66 },
    ],
  },
  {
    id: 33, displayName: "Binyan Tziyon", hebrewName: "בנין ציון", century: "19th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Binyan Tziyon {siman}", 182),
  },
  {
    id: 34, displayName: "Chatam Sofer", hebrewName: "חתם סופר", century: "19th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "Responsa Chatam Sofer, Orach Chayim {siman}", maxSiman: 208 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "Responsa Chatam Sofer, Yoreh Deah {siman}", maxSiman: 356 },
      { label: "EH I", hebrewLabel: "אה״ע א", refTemplate: "Responsa Chatam Sofer, Even HaEzer 1:{siman}", maxSiman: 152 },
      { label: "EH II", hebrewLabel: "אה״ע ב", refTemplate: "Responsa Chatam Sofer, Even HaEzer 2:{siman}", maxSiman: 175 },
      { label: "CM", hebrewLabel: "חו״מ", refTemplate: "Responsa Chatam Sofer, Choshen Mishpat {siman}", maxSiman: 207 },
      { label: "Collected", hebrewLabel: "קובץ תשובות", refTemplate: "Responsa Chatam Sofer, Collected Responsa {siman}", maxSiman: 104 },
    ],
  },
  {
    id: 35, displayName: "Chidushei HaRim", hebrewName: "חידושי הרי״ם", century: "19th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "Chiddushei HaRim Responsa, Orach Chayim {siman}", maxSiman: 7 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "Chiddushei HaRim Responsa, Yoreh Deah {siman}", maxSiman: 20 },
      { label: "EH", hebrewLabel: "אה״ע", refTemplate: "Chiddushei HaRim Responsa, Even HaEzer {siman}", maxSiman: 43 },
      { label: "CM", hebrewLabel: "חו״מ", refTemplate: "Chiddushei HaRim Responsa, Choshen Mishpat {siman}", maxSiman: 7 },
    ],
  },
  {
    id: 36, displayName: "HaElef Lekha Shlomo", hebrewName: "האלף לך שלמה", century: "19th Century",
    volumeLabel: "Section", volumeLabelHebrew: "חלק",
    volumes: [
      { label: "OC", hebrewLabel: "או״ח", refTemplate: "HaElef Lekha Shlomo, Orach Chayim {siman}", maxSiman: 400 },
      { label: "YD", hebrewLabel: "יו״ד", refTemplate: "HaElef Lekha Shlomo, Yoreh Deah {siman}", maxSiman: 342 },
      { label: "EH", hebrewLabel: "אה״ע", refTemplate: "HaElef Lekha Shlomo, Even HaEzer {siman}", maxSiman: 226 },
      { label: "CM", hebrewLabel: "חו״מ", refTemplate: "HaElef Lekha Shlomo, Choshen Mishpat {siman}", maxSiman: 23 },
    ],
  },
  {
    id: 37, displayName: "Kerakh shel Romi", hebrewName: "כרך של רומי", century: "19th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("Kerakh shel Romi {siman}", 26),
  },
  {
    id: 38, displayName: "Maharsham", hebrewName: "מהרש״ם", century: "19th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    volumes: ["I", "II", "III"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Teshuvot Maharsham Volume ${numeral} {siman}`,
      maxSiman: [230, 270, 378][i],
    })),
  },
  {
    id: 39, displayName: "Meshiv Davar", hebrewName: "משיב דבר", century: "19th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    // Volumes III and IV dropped — empty on Sefaria, see doc comment above.
    volumes: ["I", "II"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Teshuvot Meshiv Davar, Volume ${numeral} {siman}`,
      maxSiman: [47, 108][i],
    })),
  },
  {
    id: 40, displayName: "Melammed Lehoil", hebrewName: "מלמד להועיל", century: "19th Century",
    volumeLabel: "Part", volumeLabelHebrew: "חלק",
    volumes: ["I", "II", "III"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Melammed Lehoil Part ${numeral} {siman}`,
      maxSiman: [122, 148, 103][i],
    })),
  },
  {
    id: 41, displayName: "Rav Pealim", hebrewName: "רב פעלים", century: "19th Century",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    // 4 volumes × Tur order + a kabbalistic "Sod Yesharim" section, flattened — Volume I has no
    // Choshen Mishpat on Sefaria, so that combo is simply omitted below.
    volumes: (() => {
      const volumeNames = ["I", "II", "III", "IV"];
      const volumeNamesHe = ["א", "ב", "ג", "ד"];
      const sections = [
        { disp: "OC", dispHe: "או״ח", name: "Orach Chayim" },
        { disp: "YD", dispHe: "יו״ד", name: "Yoreh Deah" },
        { disp: "EH", dispHe: "אה״ע", name: "Even HaEzer" },
        { disp: "CM", dispHe: "חו״מ", name: "Choshen Mishpat" },
        { disp: "Sod Yesharim", dispHe: "סוד ישרים", name: "Sod Yesharim" },
      ];
      const counts: Record<string, number> = {
        "I-OC": 35, "I-YD": 57, "I-EH": 13, "I-Sod Yesharim": 17,
        "II-OC": 65, "II-YD": 41, "II-EH": 34, "II-CM": 15, "II-Sod Yesharim": 14,
        "III-OC": 45, "III-YD": 32, "III-EH": 12, "III-CM": 8, "III-Sod Yesharim": 13,
        "IV-OC": 43, "IV-YD": 39, "IV-EH": 13, "IV-CM": 8, "IV-Sod Yesharim": 20,
      };
      const vols: TeshuvotVolume[] = [];
      volumeNames.forEach((vName, vi) => {
        for (const s of sections) {
          const maxSiman = counts[`${vName}-${s.disp}`];
          if (maxSiman === undefined) continue;
          vols.push({
            label: `${vName}, ${s.disp}`,
            hebrewLabel: `${volumeNamesHe[vi]}, ${s.dispHe}`,
            refTemplate: `Responsa Rav Pealim, Volume ${vName}, ${s.name} {siman}`,
            maxSiman,
          });
        }
      });
      return vols;
    })(),
  },
  {
    id: 42, displayName: "Shoel uMeshiv", hebrewName: "שואל ומשיב", century: "19th Century",
    volumeLabel: "Mahadura", volumeLabelHebrew: "מהדורא",
    // 6 Mahadura (printed-edition) volumes; I-IV are further subdivided into 3-4 sub-volumes
    // each on Sefaria — flattened here into one combined-label list.
    volumes: (() => {
      const subCounts = [[313, 194, 223], [97, 86, 137, 190], [473, 203, 165], [61, 226, 153]];
      const mahaduraNumerals = ["I", "II", "III", "IV"];
      const mahaduraHe = ["א", "ב", "ג", "ד"];
      const vols: TeshuvotVolume[] = [];
      for (let m = 0; m < 4; m++) {
        subCounts[m].forEach((maxSiman, si) => {
          const sub = si + 1;
          vols.push({
            label: `${mahaduraNumerals[m]}.${sub}`,
            hebrewLabel: `${mahaduraHe[m]}.${sub}`,
            refTemplate: `Shoel uMeshiv Mahadura ${mahaduraNumerals[m]} ${sub}:{siman}`,
            maxSiman,
          });
        });
      }
      vols.push({ label: "V", hebrewLabel: "ה", refTemplate: "Shoel uMeshiv Mahadura V {siman}", maxSiman: 92 });
      vols.push({ label: "VI", hebrewLabel: "ו", refTemplate: "Shoel uMeshiv Mahadura VI {siman}", maxSiman: 63 });
      return vols;
    })(),
  },
  {
    id: 43, displayName: "Teshuva MeAhava", hebrewName: "תשובה מאהבה", century: "19th Century",
    volumeLabel: null, volumeLabelHebrew: null,
    // Only Part I exists on Sefaria — Parts II/III were never digitized.
    volumes: flatVolume("Teshuva MeAhava Part I {siman}", 211),
  },
];

// MARK: - Teshuvot Contemporary
//
// Ported from AnyTorah/AnyTorah/Models/TextModels.swift's TeshuvotWork Contemporary cases —
// Sefaria-digitized modern responsa only (Iggros Moshe is page-image-based, not a Sefaria ref,
// and isn't ported here; the Lindenbaum Center is a Sefaria *Collection* of source sheets, not a
// text index, and is deliberately deferred to a future "YCT halakha pieces" pass). Global ids
// continue from Acharonim's 13-43. Declaration order is the Contemporary book-picker's own order
// (see getCategoryGroups's "teshuvotContemporary" case, a flat list with no century grouping —
// Contemporary was never century-grouped in native either). Ref data verified against live
// Sefaria content 2026-08-30 (see AnyTorah/CLAUDE.md's "Contemporary — 5 Sefaria-digitized
// works" section).
export const TESHUVOT_CONTEMPORARY: TeshuvotWorkDef[] = [
  {
    id: 44, displayName: "Mishpetei Uziel", hebrewName: "משפטי עוזיאל", century: "Contemporary",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    // Volume x Tur-order section, flattened — Sefaria splits each of Rav Uziel's 9 printed
    // volumes into 1-5 named sections rather than one continuous siman count per volume.
    volumes: (() => {
      const entries: { vol: string; volHe: string; disp: string; dispHe: string; name: string; count: number }[] = [
        { vol: "I", volHe: "א", disp: "OC", dispHe: "או״ח", name: "Orach Chayim", count: 26 },
        { vol: "I", volHe: "א", disp: "YD", dispHe: "יו״ד", name: "Yoreh De'ah", count: 30 },
        { vol: "I", volHe: "א", disp: "Omissions", dispHe: "השמטות", name: "Omissions", count: 5 },
        { vol: "II", volHe: "ב", disp: "YD", dispHe: "יו״ד", name: "Yoreh De'ah", count: 66 },
        { vol: "III", volHe: "ג", disp: "OC", dispHe: "או״ח", name: "Orach Chayim", count: 81 },
        { vol: "III", volHe: "ג", disp: "Addenda", dispHe: "מלואים", name: "Addenda", count: 8 },
        { vol: "IV", volHe: "ד", disp: "CM", dispHe: "חו״מ", name: "Choshen Mishpat", count: 47 },
        { vol: "IV", volHe: "ד", disp: "General Topics", dispHe: "ענינים כלליים", name: "General Topics", count: 19 },
        { vol: "V", volHe: "ה", disp: "EH", dispHe: "אה״ע", name: "Even HaEzer", count: 89 },
        { vol: "VI", volHe: "ו", disp: "YD", dispHe: "יו״ד", name: "Yoreh De'ah", count: 131 },
        { vol: "VI", volHe: "ו", disp: "Addenda", dispHe: "מלואים", name: "Addenda", count: 6 },
        { vol: "VII", volHe: "ז", disp: "EH", dispHe: "אה״ע", name: "Even HaEzer", count: 49 },
        { vol: "VIII", volHe: "ח", disp: "OC", dispHe: "או״ח", name: "Orach Chayim", count: 62 },
        { vol: "IX", volHe: "ט", disp: "OC", dispHe: "או״ח", name: "Orach Chayim", count: 9 },
        { vol: "IX", volHe: "ט", disp: "YD", dispHe: "יו״ד", name: "Yoreh De'ah", count: 49 },
        { vol: "IX", volHe: "ט", disp: "EH", dispHe: "אה״ע", name: "Even HaEzer", count: 2 },
        { vol: "IX", volHe: "ט", disp: "CM", dispHe: "חו״מ", name: "Choshen Mishpat", count: 3 },
        { vol: "IX", volHe: "ט", disp: "General Topics", dispHe: "ענינים כלליים", name: "General Topics", count: 3 },
      ];
      // Un-abbreviated Hebrew for the volume-picker select only (pickerHebrewLabel) — the nav
      // pill-equivalent parts of the UI keep the standard Tur-order abbreviation (hebrewLabel).
      const fullSectionHe: Record<string, string> = {
        "או״ח": "אורח חיים", "יו״ד": "יורה דעה", "אה״ע": "אבן העזר", "חו״מ": "חושן משפט",
      };
      return entries.map((e) => ({
        label: `${e.vol}, ${e.disp}`,
        hebrewLabel: `${e.volHe}, ${e.dispHe}`,
        refTemplate: `Mishpetei Uziel, Volume ${e.vol}, ${e.name} {siman}`,
        maxSiman: e.count,
        pickerHebrewLabel: fullSectionHe[e.dispHe] ? `${e.volHe}, ${fullSectionHe[e.dispHe]}` : undefined,
      }));
    })(),
  },
  {
    id: 45, displayName: "Benei Banim", hebrewName: "בני בנים", century: "Contemporary",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    volumes: ["I", "II", "III", "IV"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `Responsa Benei Banim, Volume ${numeral} {siman}`,
      maxSiman: [44, 52, 45, 28][i],
    })),
  },
  {
    id: 46, displayName: "B'mareh HaBazak", hebrewName: "במראה הבזק", century: "Contemporary",
    volumeLabel: "Volume", volumeLabelHebrew: "חלק",
    // 10 flat volumes (Siman/Seif, no further sub-sections) from Kollel Eretz Chemda.
    volumes: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"].map((numeral, i) => ({
      label: numeral,
      hebrewLabel: toHebrewNumeral(i + 1),
      refTemplate: `B'Mareh HaBazak Volume ${numeral} {siman}`,
      maxSiman: [100, 120, 156, 140, 53, 102, 114, 41, 48, 100][i],
    })),
  },
  {
    // Flat — no real volume level (volumeLabel is null, like every other flat work above), so
    // this is the one dummy entry every TeshuvotWorkDef needs. refTemplate is never actually
    // used for this work — teshuvotSefariaRef below special-cases this id to look up the real
    // ref from NISHMAT_HABAYIT_SIMANIM instead, since the ref embeds each responsum's full title
    // and isn't "{siman}"-formulaic. maxSiman is the synthetic 1-63 siman count.
    id: 47, displayName: "Nishmat HaBayit", hebrewName: "נשמת הבית", century: "Contemporary",
    volumeLabel: null, volumeLabelHebrew: null,
    volumes: flatVolume("", 63),
  },
];

// MARK: - Iggros Moshe (page-image based, not a Sefaria ref)
//
// Ported from AnyTorah/AnyTorah/Models/TextModels.swift's ContemporaryTeshuvotWork/Volume —
// Iggros Moshe has no Sefaria digitization at all, so navigation resolves a siman to a scanned
// page image (see lib/teshuvotPageManager.ts) instead of a Sefaria ref, the same way Talmud's
// daf-image mode resolves a daf to a scanned page. Shown first in the Contemporary work picker
// (see categoryCatalog.ts's "teshuvotContemporary" case), ahead of the four Sefaria-digitized
// works above, matching native's own picker order. `id` matches teshuvotPages.json's/
// teshuvotSimanIndex.json's own volume keys — note these use "OH"/"HM" prefixes, an old internal
// asset-naming choice that predates the OC/CM abbreviations used for `label`/`hebrewLabel` (the
// same Tur-order abbreviation convention already used throughout Acharonim above, e.g. Chatam
// Sofer's "EH II"/"אה״ע ב").
export interface IggrosMosheVolume {
  id: string;
  label: string;
  hebrewLabel: string;
}

export const IGGROS_MOSHE_VOLUMES: IggrosMosheVolume[] = [
  { id: "IggrotMosheOH1", label: "OC I", hebrewLabel: "או״ח א" },
  { id: "IggrotMosheOH2", label: "OC II", hebrewLabel: "או״ח ב" },
  { id: "IggrotMosheOH3", label: "OC III", hebrewLabel: "או״ח ג" },
  { id: "IggrotMosheOH4", label: "OC IV", hebrewLabel: "או״ח ד" },
  { id: "IggrotMosheOH5", label: "OC V", hebrewLabel: "או״ח ה" },
  { id: "IggrotMosheYD1", label: "YD I", hebrewLabel: "יו״ד א" },
  { id: "IggrotMosheYD2", label: "YD II", hebrewLabel: "יו״ד ב" },
  { id: "IggrotMosheYD3", label: "YD III", hebrewLabel: "יו״ד ג" },
  { id: "IggrotMosheYD4", label: "YD IV", hebrewLabel: "יו״ד ד" },
  { id: "IggrotMosheEH1", label: "EH I", hebrewLabel: "אה״ע א" },
  { id: "IggrotMosheEH2", label: "EH II", hebrewLabel: "אה״ע ב" },
  { id: "IggrotMosheEH3", label: "EH III", hebrewLabel: "אה״ע ג" },
  { id: "IggrotMosheEH4", label: "EH IV", hebrewLabel: "אה״ע ד" },
  { id: "IggrotMosheHM1", label: "CM I", hebrewLabel: "חו״מ א" },
  { id: "IggrotMosheHM2", label: "CM II", hebrewLabel: "חו״מ ב" },
];

/** Sentinel work id for Iggros Moshe within the "teshuvotContemporary" id space (44-47 are the
 *  four real TeshuvotWorkDef ids above) — Reader.tsx branches its entire content-rendering path
 *  on `index === IGGROS_MOSHE_WORK_ID` to a scanned-page viewer instead of a Sefaria-ref fetch.
 *  Picked well clear of any real id range so it can never collide with a future addition. */
export const IGGROS_MOSHE_WORK_ID = 9999;

/** Global id of the one Teshuvot work with a bespoke titled-list siman picker instead of the
 *  ordinary numeric wheel — see NISHMAT_HABAYIT_SIMANIM and teshuvotSefariaRef's special case. */
export const NISHMAT_HABAYIT_WORK_ID = 47;

/** One responsum entry in Nishmat HaBayit's picker — this work has no numeric Siman address type
 *  on Sefaria (each responsum is an individually-titled node, grouped into 5 real Parts), so it
 *  needs its own titled-list picker (NishmatHaBayitSimanPicker.tsx) instead of the generic
 *  numeric chapter stepper. `number` is a synthetic 1-63 sequential index (not part of Sefaria's
 *  own data) reused as this work's ordinary `chapter`/siman value, so the existing
 *  selection-state plumbing needs no new type. `ref` is the complete literal Sefaria ref string
 *  (embeds the full node title) — there's no "{siman}"-template substitution here, unlike
 *  TeshuvotVolume, since the ref isn't formulaic. Ported verbatim from native's
 *  NishmatHaBayitSiman.all, generated there from a live Sefaria raw-index fetch. */
export interface NishmatHaBayitSiman {
  number: number;
  partEnglish: string;
  partHebrew: string;
  titleEnglish: string;
  titleHebrew: string;
  ref: string;
}

export const NISHMAT_HABAYIT_SIMANIM: NishmatHaBayitSiman[] = [
  { number: 1, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Panty Liners during the Seven Neki'im When Trying to Conceive", titleHebrew: "תחתונית בז' נקיים באישה המנסה להרות", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 1; Panty Liners during the Seven Neki'im When Trying to Conceive" },
  { number: 2, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Onot Perishah at the Beginning of Pregnancy", titleHebrew: "עונות פרישה בהתחלת היריון", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 2; Onot Perishah at the Beginning of Pregnancy" },
  { number: 3, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Blood in Urine during Pregnancy", titleHebrew: "דם בשתן בזמן ההיריון", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 3; Blood in Urine during Pregnancy" },
  { number: 4, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Spotting and Bleeding during Pregnancy", titleHebrew: "כתמים ודימומים בזמן היריון", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 4; Spotting and Bleeding during Pregnancy" },
  { number: 5, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Blood on an Ultrasound Transducer", titleHebrew: "דם במכשיר אולטרסאונד", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 5; Blood on an Ultrasound Transducer" },
  { number: 6, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Bleeding from Placenta Previa", titleHebrew: "דימומים בהיריון בסיכון בעקבות שליית פתח", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 6; Bleeding from Placenta Previa" },
  { number: 7, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Bleeding after Cervical Cerclage", titleHebrew: "ראיית דם לאחר תפירת צוואר הרחם", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 7; Bleeding after Cervical Cerclage" },
  { number: 8, partEnglish: "Pregnancy", partHebrew: "היריון", titleEnglish: "Mikveh Immersion during Pregnancy", titleHebrew: "טבילה בהיריון", ref: "Nishmat HaBayit, Part I; Pregnancy, Siman 8; Mikveh Immersion during Pregnancy" },
  { number: 9, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Cervical Dilation and the Onset of Labor", titleHebrew: "דין פתיחת צוואר הרחם כהתחלת לידה", ref: "Nishmat HaBayit, Part II; Birth, Siman 9; Cervical Dilation and the Onset of Labor" },
  { number: 10, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Does Expulsion of the Mucus Plug Render a Woman Niddah?", titleHebrew: "האם יציאת הפקק הרירי אוסרת?", ref: "Nishmat HaBayit, Part II; Birth, Siman 10; Does Expulsion of the Mucus Plug Render a Woman Niddah?" },
  { number: 11, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Does Membrane Stripping Render a Woman Niddah?", titleHebrew: "האם פעולת הפרדת קרומים ('סטריפינג') אוסרת?", ref: "Nishmat HaBayit, Part II; Birth, Siman 11; Does Membrane Stripping Render a Woman Niddah?" },
  { number: 12, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Does the Rupture of Membranes Render a Woman Niddah?", titleHebrew: "האם ירידת מים אוסרת?", ref: "Nishmat HaBayit, Part II; Birth, Siman 12; Does the Rupture of Membranes Render a Woman Niddah?" },
  { number: 13, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Assistance of the Husband in the Delivery Room", titleHebrew: "סיוע הבעל בחדר לידה", ref: "Nishmat HaBayit, Part II; Birth, Siman 13; Assistance of the Husband in the Delivery Room" },
  { number: 14, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Mokh Dahuk and Bedikot following Birth", titleHebrew: "מוך דחוק ובדיקות ז' נקיים לאחר לידה", ref: "Nishmat HaBayit, Part II; Birth, Siman 14; Mokh Dahuk and Bedikot following Birth" },
  { number: 15, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Counting Seven Neki'im following a Caesarean Section", titleHebrew: "ספירת ז' נקיים לאחר ניתוח קיסרי", ref: "Nishmat HaBayit, Part II; Birth, Siman 15; Counting Seven Neki'im following a Caesarean Section" },
  { number: 16, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Observation of Blood by a Physician during the Postpartum Examination", titleHebrew: "ראיית דם על ידי רופא בבדיקה לאחר הלידה", ref: "Nishmat HaBayit, Part II; Birth, Siman 16; Observation of Blood by a Physician during the Postpartum Examination" },
  { number: 17, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Attributing Bleeding to Hemorrhoids, Postpartum", titleHebrew: "תלייה בטחורים בז' נקיים לאחר לידה", ref: "Nishmat HaBayit, Part II; Birth, Siman 17; Attributing Bleeding to Hemorrhoids, Postpartum" },
  { number: 18, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Hefsek Taharah after Sunset, Postpartum", titleHebrew: "הפסק טהרה ביולדת לאחר שקיעה", ref: "Nishmat HaBayit, Part II; Birth, Siman 18; Hefsek Taharah after Sunset, Postpartum" },
  { number: 19, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Onot Perishah and Establishing a Veset, Postpartum", titleHebrew: "עונות פרישה וקביעת וסת בכ\"ד חודש לאחר לידה", ref: "Nishmat HaBayit, Part II; Birth, Siman 19; Onot Perishah and Establishing a Veset, Postpartum" },
  { number: 20, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Bedikot with Uterine Prolapse", titleHebrew: "בדיקות ז' נקיים במצב צניחת רחם", ref: "Nishmat HaBayit, Part II; Birth, Siman 20; Bedikot with Uterine Prolapse" },
  { number: 21, partEnglish: "Birth", partHebrew: "לידה", titleEnglish: "Attributing Blood to a Petza during the Seven Neki'im", titleHebrew: "תלייה בפצע בז' נקיים", ref: "Nishmat HaBayit, Part II; Birth, Siman 21; Attributing Blood to a Petza during the Seven Neki'im" },
  { number: 22, partEnglish: "Pregnancy Loss", partHebrew: "אובדן היריון", titleEnglish: "Counting Seven Neki'im following D&C", titleHebrew: "ספירת ז' נקיים לאחר גרידה", ref: "Nishmat HaBayit, Part III; Pregnancy Loss, Siman 22; Counting Seven Neki'im following D&C" },
  { number: 23, partEnglish: "Pregnancy Loss", partHebrew: "אובדן היריון", titleEnglish: "Onot Perishah following a Miscarriage", titleHebrew: "עונות פרישה לאחר הפלה", ref: "Nishmat HaBayit, Part III; Pregnancy Loss, Siman 23; Onot Perishah following a Miscarriage" },
  { number: 24, partEnglish: "Pregnancy Loss", partHebrew: "אובדן היריון", titleEnglish: "Reducing Bedikot following a Miscarriage", titleHebrew: "הפחתת בדיקות באישה שעברה הפלה", ref: "Nishmat HaBayit, Part III; Pregnancy Loss, Siman 24; Reducing Bedikot following a Miscarriage" },
  { number: 25, partEnglish: "Nursing", partHebrew: "הנקה", titleEnglish: "The Law of Hargashah (Sensation of Menses)", titleHebrew: "בדין הרגשה", ref: "Nishmat HaBayit, Part IV; Nursing, Siman 25; The Law of Hargashah (Sensation of Menses)" },
  { number: 26, partEnglish: "Nursing", partHebrew: "הנקה", titleEnglish: "Pain and Reduced Libido", titleHebrew: "כאב וחוסר עניין ביחסים", ref: "Nishmat HaBayit, Part IV; Nursing, Siman 26; Pain and Reduced Libido" },
  { number: 27, partEnglish: "Nursing", partHebrew: "הנקה", titleEnglish: "Blood on Toilet Paper", titleHebrew: "דם על נייר קינוח", ref: "Nishmat HaBayit, Part IV; Nursing, Siman 27; Blood on Toilet Paper" },
  { number: 28, partEnglish: "Nursing", partHebrew: "הנקה", titleEnglish: "Breastfeeding a Toddler after an Interruption", titleHebrew: "המשך הנקה לאחר הפסקה בפעוט", ref: "Nishmat HaBayit, Part IV; Nursing, Siman 28; Breastfeeding a Toddler after an Interruption" },
  { number: 29, partEnglish: "Nursing", partHebrew: "הנקה", titleEnglish: "Passing a Baby between Parents during Niddut", titleHebrew: "העברת תינוק בין ההורים בימי הנידות", ref: "Nishmat HaBayit, Part IV; Nursing, Siman 29; Passing a Baby between Parents during Niddut" },
  { number: 30, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Family Planning following Childbirth", titleHebrew: "בדין דחיית היריון אחר לידה", ref: "Nishmat HaBayit, Part V; Contraception, Siman 30; Family Planning following Childbirth" },
  { number: 31, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Contraception after Several Births", titleHebrew: "מניעת היריון לאחר כמה לידות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 31; Contraception after Several Births" },
  { number: 32, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "IUD Use and the Ranking of Contraceptive Options", titleHebrew: "שימוש בהתקן תוך רחמי ודירוג אמצעי מניעה", ref: "Nishmat HaBayit, Part V; Contraception, Siman 32; IUD Use and the Ranking of Contraceptive Options" },
  { number: 33, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Condom Use When Pregnancy Is Contra Indicated", titleHebrew: "שימוש בקונדום במקרה של סכנה להרות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 33; Condom Use When Pregnancy Is Contra Indicated" },
  { number: 34, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Spermicide Use", titleHebrew: "שימוש בקוטל זרע", ref: "Nishmat HaBayit, Part V; Contraception, Siman 34; Spermicide Use" },
  { number: 35, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Diaphragm Use", titleHebrew: "שימוש בדיאפרגמה", ref: "Nishmat HaBayit, Part V; Contraception, Siman 35; Diaphragm Use" },
  { number: 36, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Emergency Contraception; The \"Morning After\" Pill", titleHebrew: "בדין גלולת 'היום שאחרי'", ref: "Nishmat HaBayit, Part V; Contraception, Siman 36; Emergency Contraception; The \"Morning After\" Pill" },
  { number: 37, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Depo Provera (Progesterone Injection)", titleHebrew: "שימוש בזריקת פרוגסטרון", ref: "Nishmat HaBayit, Part V; Contraception, Siman 37; Depo Provera (Progesterone Injection)" },
  { number: 38, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Onot Perishah with Hormonal Contraception", titleHebrew: "עונת פרישה וסילוק דמים בעת נטילת גלולות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 38; Onot Perishah with Hormonal Contraception" },
  { number: 39, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Establishing a Veset with Hormonal Contraception", titleHebrew: "קביעת וסת לגלולות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 39; Establishing a Veset with Hormonal Contraception" },
  { number: 40, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Onot Perishah When Stopping Hormonal Contraception", titleHebrew: "עונת פרישה בתום השימוש בגלולות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 40; Onot Perishah When Stopping Hormonal Contraception" },
  { number: 41, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Extending the Cycle via Hormonal Contraception", titleHebrew: "נטילת גלולות ברצף", ref: "Nishmat HaBayit, Part V; Contraception, Siman 41; Extending the Cycle via Hormonal Contraception" },
  { number: 42, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "When Staining Renders a Woman Niddah", titleHebrew: "מתי הופכים כתמים למחזור?", ref: "Nishmat HaBayit, Part V; Contraception, Siman 42; When Staining Renders a Woman Niddah" },
  { number: 43, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Post Coital Bleeding with Hormonal Contraception", titleHebrew: "דם לאחר תשמיש בנוטלת גלולות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 43; Post Coital Bleeding with Hormonal Contraception" },
  { number: 44, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Staining on a Panty Liner or Synthetic Clothing", titleHebrew: "כתמים על תחתונית ובגד סינתטי", ref: "Nishmat HaBayit, Part V; Contraception, Siman 44; Staining on a Panty Liner or Synthetic Clothing" },
  { number: 45, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "A Suspected Lesion and Stain Location on a Bedikah Cloth", titleHebrew: "חשש לפצע ומיקום הדם על העד", ref: "Nishmat HaBayit, Part V; Contraception, Siman 45; A Suspected Lesion and Stain Location on a Bedikah Cloth" },
  { number: 46, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "When a Contraceptive Pill Is Not Absorbed, Recommendations", titleHebrew: "המלצה בעקבות אי ספיגת גלולה", ref: "Nishmat HaBayit, Part V; Contraception, Siman 46; When a Contraceptive Pill Is Not Absorbed, Recommendations" },
  { number: 47, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Mikveh Immersion with a Hormonal Patch", titleHebrew: "טבילה עם מדבקה הורמונלית", ref: "Nishmat HaBayit, Part V; Contraception, Siman 47; Mikveh Immersion with a Hormonal Patch" },
  { number: 48, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Bedikot with a Contraceptive Ring", titleHebrew: "בדיקות ז' נקיים עם נובה רינג", ref: "Nishmat HaBayit, Part V; Contraception, Siman 48; Bedikot with a Contraceptive Ring" },
  { number: 49, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Immersion with a Contraceptive Ring", titleHebrew: "טבילה עם נובה רינג", ref: "Nishmat HaBayit, Part V; Contraception, Siman 49; Immersion with a Contraceptive Ring" },
  { number: 50, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Insertion of an IUD during the Seven Neki'im", titleHebrew: "הכנסת התקן תוך רחמי בז' נקיים", ref: "Nishmat HaBayit, Part V; Contraception, Siman 50; Insertion of an IUD during the Seven Neki'im" },
  { number: 51, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Does Removal of an IUD Render a Woman Niddah?", titleHebrew: "האם הוצאת התקן תוך רחמי מטמאת?", ref: "Nishmat HaBayit, Part V; Contraception, Siman 51; Does Removal of an IUD Render a Woman Niddah?" },
  { number: 52, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Bleeding from an Abrasion Caused by an IUD", titleHebrew: "דימום מפצע הנגרם ע\"י התקן תוך רחמי", ref: "Nishmat HaBayit, Part V; Contraception, Siman 52; Bleeding from an Abrasion Caused by an IUD" },
  { number: 53, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Premenstrual Staining", titleHebrew: "בדין כתמים המקדימים את המחזור", ref: "Nishmat HaBayit, Part V; Contraception, Siman 53; Premenstrual Staining" },
  { number: 54, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Colors on Bedikah Cloths", titleHebrew: "צבעים בעדי בדיקה", ref: "Nishmat HaBayit, Part V; Contraception, Siman 54; Colors on Bedikah Cloths" },
  { number: 55, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Bedikot of Onot Perishah When a Woman Experiences Spotting", titleHebrew: "בדיקות בעונת פרישה באישה המרבה להכתים", ref: "Nishmat HaBayit, Part V; Contraception, Siman 55; Bedikot of Onot Perishah When a Woman Experiences Spotting" },
  { number: 56, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Minor Monthly Spotting", titleHebrew: "כתמים מזעריים פעם בחודש", ref: "Nishmat HaBayit, Part V; Contraception, Siman 56; Minor Monthly Spotting" },
  { number: 57, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Waiting before the Seven Neki'im", titleHebrew: "המתנה לפני ספירת ז' נקיים בכתם המטמא", ref: "Nishmat HaBayit, Part V; Contraception, Siman 57; Waiting before the Seven Neki'im" },
  { number: 58, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Douching before Internal Bedikot", titleHebrew: "שטיפה לפני בדיקת ז' נקיים", ref: "Nishmat HaBayit, Part V; Contraception, Siman 58; Douching before Internal Bedikot" },
  { number: 59, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "A Spot on a Tampon", titleHebrew: "נקודה על טמפון", ref: "Nishmat HaBayit, Part V; Contraception, Siman 59; A Spot on a Tampon" },
  { number: 60, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Finding Blood on a Diaphragm", titleHebrew: "מציאת דם בדיאפרגמה", ref: "Nishmat HaBayit, Part V; Contraception, Siman 60; Finding Blood on a Diaphragm" },
  { number: 61, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Onot Perishah with Fertility Awareness Method (FAM)", titleHebrew: "עונת פרישה בשיטת המודעות לפוריות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 61; Onot Perishah with Fertility Awareness Method (FAM)" },
  { number: 62, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "Checking for Secretions with Fertility Awareness Method (FAM)", titleHebrew: "בדיקת הפרשות בשיטת המודעות לפוריות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 62; Checking for Secretions with Fertility Awareness Method (FAM)" },
  { number: 63, partEnglish: "Contraception", partHebrew: "אמצעי מניעה", titleEnglish: "The Mitzvah of Onah on Mikveh Night with Fertility Awareness Method (FAM)", titleHebrew: "מצוות עונה בליל טבילה בשיטת מודעות הפוריות", ref: "Nishmat HaBayit, Part V; Contraception, Siman 63; The Mitzvah of Onah on Mikveh Night with Fertility Awareness Method (FAM)" },
];

// Combined lookup so teshuvotWork/teshuvotSefariaRef/teshuvotMaxSiman work by global id
// regardless of which UI tab (Rishonim, Acharonim, or Contemporary) is currently showing.
const ALL_TESHUVOT_WORKS: TeshuvotWorkDef[] = [...TESHUVOT_RISHONIM, ...TESHUVOT_ACHARONIM, ...TESHUVOT_CONTEMPORARY];

export function teshuvotWork(id: number): TeshuvotWorkDef {
  return ALL_TESHUVOT_WORKS.find((w) => w.id === id) ?? ALL_TESHUVOT_WORKS[0];
}

function teshuvotVolumeAt(work: TeshuvotWorkDef, volume: number): TeshuvotVolume {
  const idx = Math.min(Math.max(0, volume - 1), work.volumes.length - 1);
  return work.volumes[idx];
}

export function teshuvotSefariaRef(workId: number, volume: number, siman: number): string {
  // Nishmat HaBayit's ref isn't "{siman}"-formulaic (see NishmatHaBayitSiman's doc comment) —
  // `siman` here is really the synthetic 1-63 NISHMAT_HABAYIT_SIMANIM number.
  if (workId === NISHMAT_HABAYIT_WORK_ID) {
    return NISHMAT_HABAYIT_SIMANIM.find((s) => s.number === siman)?.ref ?? NISHMAT_HABAYIT_SIMANIM[0].ref;
  }
  const work = teshuvotWork(workId);
  return teshuvotVolumeAt(work, volume).refTemplate.replace("{siman}", String(siman));
}

export function teshuvotMaxSiman(workId: number, volume: number): number {
  return teshuvotVolumeAt(teshuvotWork(workId), volume).maxSiman;
}
