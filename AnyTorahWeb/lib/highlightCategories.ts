// Fixed-color/user-labeled categories for highlights. Colors are fixed CSS classes
// (.highlight-dot-0 .. .highlight-dot-3, see globals.css) keyed by index; only the label text is
// user-editable and persisted separately, so renaming a category never requires migrating any
// highlight that already references its index.
//
// Four colors, matching a real physical highlighter set (yellow/green/blue/pink) rather than an
// abstract palette — index 0 is yellow, the conventional default highlight color, and is what a
// fresh highlight starts as before the user picks a color. Labels are still freely renamable
// per the mechanism above; these defaults just describe the color itself until relabeled.

export const HIGHLIGHT_CATEGORY_COUNT = 4;

export const DEFAULT_HIGHLIGHT_CATEGORY_LABELS: string[] = ["Yellow", "Green", "Blue", "Pink"];

/** Index of the default color a fresh highlight/note starts with — yellow, the conventional
 *  highlighter default. */
export const DEFAULT_HIGHLIGHT_COLOR_INDEX = 0;

const STORAGE_KEY = "anytorah:highlightCategoryLabels";

export function loadHighlightCategoryLabels(): string[] {
  if (typeof window === "undefined") return DEFAULT_HIGHLIGHT_CATEGORY_LABELS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HIGHLIGHT_CATEGORY_LABELS;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || parsed.length !== HIGHLIGHT_CATEGORY_COUNT) return DEFAULT_HIGHLIGHT_CATEGORY_LABELS;
    return parsed;
  } catch {
    return DEFAULT_HIGHLIGHT_CATEGORY_LABELS;
  }
}

export function saveHighlightCategoryLabels(labels: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  } catch {
    // localStorage unavailable (private browsing, quota) — labels just won't persist.
  }
}
