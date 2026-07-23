// Per-category commentary pool + default-slot logic, shared between Reader.tsx (which needs
// the current slots to build Shulchan Arukh's inline-marker main text) and CommentaryPanel.tsx
// (which owns the tab UI). Default slots for Talmud/Rambam/SA use the 3-slot design documented
// in project memory rather than the 2-slot fallback in TextCategory.defaultCommentaries —
// confirmed preferred over the 2-slot default for Talmud; applied consistently here.
import {
  type CommentaryType,
  torahPool,
  neviimPool,
  ketuvimPool,
  talmudGrouped,
  mishnahPool,
  rambamGrouped,
  saPool,
  isAvailableForTanakhBook,
  isAvailableForTalmud,
  isAvailableForMishnah,
  isAvailableForRambam,
} from "./commentaryTypes";
import { TextCatalog } from "./textCatalog";
import type { TextCategory } from "./textModels";

export type ReaderCategory = Exclude<TextCategory, "midrash">;

export interface PoolInfo {
  /** Identifies the commentary "context" (e.g. tanakh:torah, sa:1) — slots reset when this changes. */
  contextKey: string;
  defaultSlots: CommentaryType[];
  groups: CommentaryType[][];
  groupLabels: (string | null)[];
  isAvailable: (type: CommentaryType) => boolean;
  /**
   * Ordered candidates used to substitute a slot whose assigned commentator has no content for
   * the current book/tractate/work (e.g. Migdal Oz outside its covered sefarim) — mirrors
   * native's `fallbackCommentaries`. The first candidate that's available and not already used
   * in another slot replaces the unavailable one; see computeEffectiveSlots.
   */
  fallbackCandidates: CommentaryType[];
}

/**
 * Like `slots`, but with any entry unavailable for the current context swapped for the first
 * available, not-already-used candidate from `fallbackCandidates` — mirrors native's
 * `effectiveCommentaries`. This is what should actually be displayed/fetched; `slots` itself
 * stays untouched so the user's real preference is preserved and re-tried elsewhere.
 */
export function computeEffectiveSlots(
  slots: CommentaryType[],
  isAvailable: (type: CommentaryType) => boolean,
  fallbackCandidates: CommentaryType[],
): CommentaryType[] {
  const effective: CommentaryType[] = [];
  for (const type of slots) {
    if (isAvailable(type)) {
      effective.push(type);
      continue;
    }
    const used = new Set(effective);
    const sub = fallbackCandidates.find((c) => isAvailable(c) && !used.has(c));
    effective.push(sub ?? type); // no substitute found — leave as-is; content will be empty
  }
  return effective;
}

const TALMUD_GROUP_LABELS: (string | null)[] = [
  "Rishonim — Rashi-style",
  "Rishonim — Chiddushim",
  "Rishonim — Tosafot-style",
  "Acharonim",
  "Acharonim — Additional",
];

const RAMBAM_GROUP_LABELS: (string | null)[] = ["Classic Commentaries", "Later Acharonim"];

// Talmud's 3rd slot prefers Ramban, falling back through Rashba/Ritva/Meiri when Ramban has no
// content for the tractate (per computeEffectiveSlots, using this same list as fallback pool).
const TALMUD_FALLBACK_CANDIDATES: CommentaryType[] = [
  "rashiTalmud", "tosafot", "chiddusheiRamban", "rashba", "ritva", "meiri",
];
const RAMBAM_FALLBACK_CANDIDATES: CommentaryType[] = [
  "maggidMishnah", "kesefMishnah", "lochemMishnah", "mishnahLaMelech", "kiryatSefer", "maasehRokeach", "orSameach",
];

const SA_DEFAULT_SLOTS: Record<number, CommentaryType[]> = {
  0: ["mishnahBerurah", "biurHalakha", "magenAvraham"], // Orach Chayim
  1: ["taz", "shakh", "nekudatHaKesef"], // Yoreh De'ah
  2: ["chelkatMechokek", "beitShmuel", "taz"], // Even HaEzer
  3: ["meiratEinayim", "shakh", "ktzotHaChoshen"], // Choshen Mishpat
};

function tanakhSection(bookIndex: number): "torah" | "neviim" | "ketuvim" {
  if (bookIndex <= 4) return "torah";
  if (bookIndex <= 25) return "neviim";
  return "ketuvim";
}

export function getPoolInfo(category: ReaderCategory, index: number): PoolInfo {
  switch (category) {
    case "talmud": {
      const isAvailable = (t: CommentaryType) => isAvailableForTalmud(t, index);
      return {
        contextKey: "talmud",
        defaultSlots: ["rashiTalmud", "tosafot", "chiddusheiRamban"],
        groups: talmudGrouped,
        groupLabels: TALMUD_GROUP_LABELS,
        isAvailable,
        fallbackCandidates: TALMUD_FALLBACK_CANDIDATES,
      };
    }
    case "mishnah": {
      const sederIndex = TextCatalog.mishnahSedarim.findIndex((s) => s.tractates.some((t) => t.id === index));
      const defaultSlots: CommentaryType[] = ["rambamMishnah", "bartenura", "tosafotYomTov"];
      return {
        contextKey: "mishnah",
        defaultSlots,
        groups: [mishnahPool],
        groupLabels: [null],
        isAvailable: (t) => isAvailableForMishnah(t, sederIndex, index),
        fallbackCandidates: defaultSlots,
      };
    }
    case "rambam": {
      const isAvailable = (t: CommentaryType) => isAvailableForRambam(t, index);
      return {
        contextKey: "rambam",
        defaultSlots: ["maggidMishnah", "kesefMishnah", "lochemMishnah"],
        groups: rambamGrouped,
        groupLabels: RAMBAM_GROUP_LABELS,
        isAvailable,
        fallbackCandidates: RAMBAM_FALLBACK_CANDIDATES,
      };
    }
    case "shulchanArukh":
      return {
        contextKey: `sa:${index}`,
        defaultSlots: SA_DEFAULT_SLOTS[index] ?? SA_DEFAULT_SLOTS[0],
        groups: [saPool(index)],
        groupLabels: [null],
        // saPool(section) is already the curated per-section list — no further filtering needed.
        isAvailable: () => true,
        fallbackCandidates: [],
      };
    case "tanakh":
    default: {
      const section = tanakhSection(index);
      const bySection: Record<typeof section, { pool: CommentaryType[]; defaults: CommentaryType[] }> = {
        torah: { pool: torahPool, defaults: ["onkelos", "rashiTanakh", "ramban"] },
        neviim: { pool: neviimPool, defaults: ["targumYonatan", "rashiTanakh", "metzudatDavid"] },
        ketuvim: { pool: ketuvimPool, defaults: ["targumKetuvim", "rashiTanakh", "metzudatDavid"] },
      };
      const { pool, defaults } = bySection[section];
      return {
        contextKey: `tanakh:${section}`,
        defaultSlots: defaults,
        groups: [pool],
        groupLabels: [null],
        isAvailable: (t) => isAvailableForTanakhBook(t, index),
        fallbackCandidates: defaults,
      };
    }
  }
}
