// Generic book/tractate/work navigation for the reader's selectors — one place that knows how
// to turn each category's TextCatalog shape into a uniform {group, items} list, so Reader.tsx
// doesn't need a bespoke selector per category.
import { TextCatalog } from "./textCatalog";
import type { ReaderCategory } from "./commentaryPools";
import { rambamIntroductions } from "./rambamIntroductions";
import { stripNikud } from "./hebrewUtils";
import { textCategoryMeta } from "./textModels";

export interface CategoryItem {
  id: number;
  name: string;
  /** Chapters/dapim/simanim — the upper bound for the chapter stepper (Talmud's real max is endDaf). */
  count: number;
}

export interface CategoryGroup {
  name: string;
  items: CategoryItem[];
}

/** Picks the display name for a catalog entry — nikkud-stripped Hebrew when saHebrewMode is on. */
function displayName(name: string, hebrewName: string, hebrewMode: boolean): string {
  return hebrewMode ? stripNikud(hebrewName) : name;
}

export function getCategoryGroups(category: ReaderCategory, hebrewMode = false): CategoryGroup[] {
  switch (category) {
    case "tanakh":
      return TextCatalog.tanakhSections.map((s) => ({
        name: displayName(s.name, s.hebrewName, hebrewMode),
        items: s.books.map((b) => ({ id: b.id, name: displayName(b.name, b.hebrewName, hebrewMode), count: b.chapters })),
      }));
    case "mishnah":
      return TextCatalog.mishnahSedarim.map((s) => ({
        name: displayName(s.name, s.hebrewName, hebrewMode),
        items: s.tractates.map((t) => ({ id: t.id, name: displayName(t.name, t.hebrewName, hebrewMode), count: t.chapters })),
      }));
    case "talmud":
      return TextCatalog.talmudSedarim.map((s) => ({
        name: displayName(s.name, s.hebrewName, hebrewMode),
        items: s.tractates.map((t) => ({ id: t.id, name: displayName(t.name, t.hebrewName, hebrewMode), count: t.endDaf })),
      }));
    case "rambam":
      return TextCatalog.rambamSefarim.map((s) => ({
        name: displayName(s.name, s.hebrewName, hebrewMode),
        items: s.works.map((w) => ({ id: w.id, name: displayName(w.name, w.hebrewName, hebrewMode), count: w.chapters })),
      }));
    case "shulchanArukh":
      return [
        {
          name: "",
          items: TextCatalog.shulchanArukhSections.map((s) => ({
            id: s.id,
            name: displayName(s.name, s.hebrewName, hebrewMode),
            count: s.simanim,
          })),
        },
      ];
  }
}

export function getChapterMin(category: ReaderCategory, index: number): number {
  if (category === "talmud") {
    return TextCatalog.allTalmudTractates.find((t) => t.id === index)?.startDaf ?? 2;
  }
  // Rambam works with a bundled mitzvot-list header (Chabad.org) expose a synthetic
  // "chapter 0" — the introduction — before chapter 1, matching the native app.
  if (category === "rambam" && rambamIntroductions[index]) {
    return 0;
  }
  return 1;
}

export function getChapterMax(category: ReaderCategory, index: number): number {
  for (const group of getCategoryGroups(category)) {
    const item = group.items.find((i) => i.id === index);
    if (item) return item.count;
  }
  return 1;
}

export function getChapterUnitLabel(category: ReaderCategory, hebrewMode = false): string {
  if (hebrewMode) {
    switch (category) {
      case "talmud": return "דף";
      case "shulchanArukh": return "סימן";
      default: return "פרק";
    }
  }
  switch (category) {
    case "talmud": return "daf";
    case "shulchanArukh": return "siman";
    default: return "ch.";
  }
}

/** Exact Sefaria title for a Talmud tractate — needed to key the daf-image lookup. */
export function getTalmudSefariaName(index: number): string | undefined {
  return TextCatalog.allTalmudTractates.find((t) => t.id === index)?.sefariaName;
}

export function getCategoryDisplayName(category: ReaderCategory, hebrewMode = false): string {
  if (hebrewMode) return stripNikud(textCategoryMeta[category].hebrewName);
  switch (category) {
    case "tanakh": return "Tanakh";
    case "mishnah": return "Mishnah";
    case "talmud": return "Talmud";
    case "rambam": return "Rambam";
    case "shulchanArukh": return "Shulchan Arukh";
  }
}
