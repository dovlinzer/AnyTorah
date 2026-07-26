// Shared anchor shape for both Highlights (lib/highlights.ts) and the Notebook's embedded
// navigation anchors (lib/notebooks.ts) — a single location descriptor pointing at either a
// main-text segment (TextSegment.index) or a commentary entry (CommentaryEntry.index), plus an
// optional sub-index for a paragraph within a multi-paragraph commentary entry.
//
// Deliberately leaves room for a later, unbuilt extension: optional rangeStart/rangeEnd
// character offsets within the paragraph, for true arbitrary-range highlighting (v2 of
// highlighting — see AnyTorahWeb/CLAUDE.md). Not added now; paragraph-level is the current floor.
import type { ReaderCategory } from "./commentaryPools";
import type { CommentaryType } from "./commentaryTypes";
import { displayName as commentaryDisplayName } from "./commentaryTypes";
import { buildDisplayTitle } from "./bookmarks";

export type AnchorSource = "main" | "commentary";

export interface TextAnchor {
  category: ReaderCategory;
  index: number;
  chapter: number;
  /** Yerushalmi only — halakha within the chapter. */
  halakha?: number;
  source: AnchorSource;
  /** Set only when source === "commentary". */
  commentaryType?: CommentaryType;
  /** TextSegment.index (main) or CommentaryEntry.index (commentary) — stable per-chapter
   *  position. Never the segment/entry's .id, which is a per-render counter. */
  segmentIndex: number;
  /** Sub-index within a multi-paragraph commentary entry (see splitParagraphs below).
   *  Omitted/0 for main-text segments and single-paragraph commentary entries. */
  paragraphIndex?: number;
}

/** Lookup key for an anchor point *within* a given chapter/halakha scope — matches v1's
 *  noteAnchorKey format, extended with the paragraph dimension. Callers that need to
 *  disambiguate across chapters (e.g. Highlight/Notebook records themselves) also compare
 *  category/index/chapter/halakha directly; this key alone is only unique within one already-
 *  selected chapter, mirroring how Reader.tsx's notesLookup-equivalent maps are already scoped
 *  to the current selection. */
export function anchorKey(anchor: TextAnchor): string {
  return `${anchor.source}:${anchor.segmentIndex}:${anchor.paragraphIndex ?? 0}:${anchor.commentaryType ?? ""}`;
}

/** Splits a CommentaryEntry's `he`/`en` string into paragraphs. CommentaryEntry text has no
 *  paragraph substructure today (confirmed: CommentaryPanel.tsx renders it as one <p>, and
 *  embedded newlines don't even break visually) even though a single entry — e.g. one long
 *  Ramban comment — can contain multiple logical paragraphs. Splits on a blank line first
 *  (the more reliable "real paragraph break" signal); falls back to single newlines only when
 *  there's no blank-line break at all, so entries using single \n as their only separator still
 *  split reasonably. */
export function splitParagraphs(text: string): string[] {
  if (!text) return [];
  const byBlankLine = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;
  const bySingleNewline = text
    .split(/\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return bySingleNewline.length > 0 ? bySingleNewline : [text.trim()];
}

/** Human-readable label for an anchor — used for the Notebook's anchor pills and for highlight/
 *  anchor list rows. Reuses buildDisplayTitle (lib/bookmarks.ts) rather than reimplementing
 *  book/tractate-name + chapter-unit formatting; matches how bookmarks already label a location,
 *  including not distinguishing Talmud amud a/b (bookmarks have the same limitation today — not
 *  a new gap introduced here). */
/** Strips HTML tags and collapses whitespace — used when snapshotting a main-text segment's
 *  hebrewHTML/englishHTML into a highlight's anchorQuoteHe/En, since those fields can carry raw
 *  markup (SA inline-marker spans, bold-editorial spans) that shouldn't show up in a quote
 *  preview. CommentaryEntry paragraphs never carry HTML, so callers only need this for
 *  main-text segments. */
export function stripAnchorHTML(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function formatAnchorLabel(anchor: TextAnchor): string {
  const base = buildDisplayTitle(anchor.category, anchor.index, anchor.chapter, anchor.halakha);
  if (anchor.source === "commentary" && anchor.commentaryType) {
    return `${commentaryDisplayName[anchor.commentaryType]} on ${base}`;
  }
  return base;
}
