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

export function teshuvotWork(id: number): TeshuvotWorkDef {
  return TESHUVOT_RISHONIM.find((w) => w.id === id) ?? TESHUVOT_RISHONIM[0];
}

function teshuvotVolumeAt(work: TeshuvotWorkDef, volume: number): TeshuvotVolume {
  const idx = Math.min(Math.max(0, volume - 1), work.volumes.length - 1);
  return work.volumes[idx];
}

export function teshuvotSefariaRef(workId: number, volume: number, siman: number): string {
  const work = teshuvotWork(workId);
  return teshuvotVolumeAt(work, volume).refTemplate.replace("{siman}", String(siman));
}

export function teshuvotMaxSiman(workId: number, volume: number): number {
  return teshuvotVolumeAt(teshuvotWork(workId), volume).maxSiman;
}
