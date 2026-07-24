// Local-storage bookmarks with an optional free-text note per bookmark, ported from native's
// Bookmark struct + BookmarkManager (Models/Bookmark.swift, Models/BookmarkManager.swift).
// Native stores a full set of per-category selection indices because its ViewModel keeps them
// separate; the web Reader already unifies each category's selection to a single
// {index, chapter} pair, so a bookmark here only needs category+index+chapter to restore a
// location. This is also phase 1 of notes (see AnyTorahWeb/CLAUDE.md "Planned: Bookmarks +
// Notes") — the staged plan was to start with notes as a field on the bookmark object, same as
// native today, before building anchored inline notes later.
import { getCategoryGroups, getCategoryDisplayName, getChapterUnitLabel } from "./categoryCatalog";
import type { ReaderCategory } from "./commentaryPools";

export interface Bookmark {
  id: string;
  name: string;
  notes: string;
  createdAt: string; // ISO 8601
  subtitle: string;
  category: ReaderCategory;
  index: number;
  chapter: number;
}

const STORAGE_KEY = "anytorah:bookmarks";

export function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // localStorage unavailable (private browsing, quota) — bookmarks just won't persist.
  }
}

function getItemName(category: ReaderCategory, index: number): string {
  for (const group of getCategoryGroups(category)) {
    const item = group.items.find((i) => i.id === index);
    if (item) return item.name;
  }
  return "";
}

/** Short label for the passage itself, e.g. "Berakhot daf 2" — used as the default bookmark name. */
export function buildDisplayTitle(category: ReaderCategory, index: number, chapter: number): string {
  return `${getItemName(category, index)} ${getChapterUnitLabel(category)} ${chapter}`;
}

/** Full label shown in bookmark lists, e.g. "Talmud · Berakhot daf 2". */
export function buildSubtitle(category: ReaderCategory, index: number, chapter: number): string {
  return `${getCategoryDisplayName(category)} · ${buildDisplayTitle(category, index, chapter)}`;
}

export function findBookmark(
  bookmarks: Bookmark[],
  category: ReaderCategory,
  index: number,
  chapter: number,
): Bookmark | undefined {
  return bookmarks.find((b) => b.category === category && b.index === index && b.chapter === chapter);
}

export function matchesQuery(b: Bookmark, query: string): boolean {
  const q = query.toLowerCase();
  return b.name.toLowerCase().includes(q) || b.notes.toLowerCase().includes(q) || b.subtitle.toLowerCase().includes(q);
}
