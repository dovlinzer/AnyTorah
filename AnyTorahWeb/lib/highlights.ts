// Local-storage highlights — a color (+ optional short plain-text note) anchored to a specific
// paragraph of main text or commentary. Mirrors lib/bookmarks.ts's storage/CRUD shape (flat
// array, one localStorage key) and the reverted v1's lib/notes.ts one-per-anchor lookup pattern,
// but anchors via the shared TextAnchor (lib/textAnchor.ts) instead of a bare segment index, and
// keeps the note body plain text — this is the fast Kindle-style margin note, deliberately
// lighter-weight than the Notebook's rich-text document (lib/notebooks.ts).
import { anchorKey, type TextAnchor } from "./textAnchor";

export interface Highlight {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  anchor: TextAnchor;
  /** 0-5, into the fixed color palette — see lib/highlightCategories.ts. */
  colorIndex: number;
  /** Plain text, or null for a quick color-only highlight with no written note. */
  note: string | null;
  tags: string[];
  /** Snapshot of the anchored paragraph's text at creation time, so the highlight is legible in
   *  a list without re-navigating to the source. Not kept in sync if the source text changes. */
  anchorQuoteHe: string;
  anchorQuoteEn: string;
}

const STORAGE_KEY = "anytorah:highlights";

export function loadHighlights(): Highlight[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Highlight[]) : [];
  } catch {
    return [];
  }
}

export function saveHighlights(highlights: Highlight[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(highlights));
  } catch {
    // localStorage unavailable (private browsing, quota) — highlights just won't persist.
  }
}

/** One highlight per anchor point — a quick color-only highlight and a full written note are
 *  the same record (a highlight is a note with note: null until upgraded), matching v1's
 *  simplification. */
export function findHighlight(highlights: Highlight[], anchor: TextAnchor): Highlight | undefined {
  return highlights.find(
    (h) =>
      h.anchor.category === anchor.category &&
      h.anchor.index === anchor.index &&
      h.anchor.chapter === anchor.chapter &&
      (h.anchor.halakha ?? undefined) === (anchor.halakha ?? undefined) &&
      anchorKey(h.anchor) === anchorKey(anchor),
  );
}

export function matchesQuery(h: Highlight, query: string): boolean {
  const q = query.toLowerCase();
  if (h.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (h.anchorQuoteHe.toLowerCase().includes(q) || h.anchorQuoteEn.toLowerCase().includes(q)) return true;
  if (h.note && h.note.toLowerCase().includes(q)) return true;
  return false;
}
