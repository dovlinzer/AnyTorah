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
import { displayName as commentaryDisplayName, hebrewDisplayName as hebrewCommentaryDisplayName } from "./commentaryTypes";
import { buildDisplayTitle } from "./bookmarks";
import { getCategoryItemName } from "./categoryCatalog";

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
  /** Talmud only — which amud the anchor was created on. Captured at creation time (see
   *  buildSegmentLabel's caller in Reader.tsx); anchors created before this field existed omit
   *  it, and callers should treat a missing amud as "matches either" rather than "matches
   *  nothing" (see NotebookPanel.tsx's reverse-sync filter). */
  amud?: "a" | "b";
  /** Precomputed sub-chapter position, captured once at anchor-creation time (same snapshot
   *  pattern as Highlight.anchorQuoteHe/En) rather than re-derived later — by the time an anchor
   *  pill is displayed, the segment data it came from may no longer be loaded. For Tanakh/
   *  Mishnah/Tosefta/Rambam/Shulchan Arukh this is the verse/mishnah/halakha/seif number (from
   *  TextSegment.label or CommentaryEntry's outer index, colon-stripped). For Talmud/Yerushalmi
   *  (no per-segment numbering) this is a short "opening words" excerpt of the paragraph instead
   *  — the dibbur-hamatchil convention for a commentator, or just the gemara's own opening words
   *  for the main text. Omitted on anchors created before this field existed. */
  segmentLabel?: string;
}

/** Captures the granular sub-chapter label at anchor-creation time (see TextAnchor.segmentLabel).
 *  `marginLabel` is TextSegment.label (main text) or a plain sequential number (commentary
 *  entries) — pass `null` for Talmud/Yerushalmi, whose paragraphs carry no such per-segment
 *  number, to fall through to the opening-words excerpt built from `hebrewText`/`englishText`
 *  instead (Hebrew preferred, matching the dibbur-hamatchil convention; English is the fallback
 *  when no Hebrew is available). Callers should pass the *raw* segment/paragraph text here, not
 *  a display-mode-gated snapshot — opening words should be capturable regardless of which
 *  language is currently toggled on screen, since both are already fetched either way. */
export function buildSegmentLabel(
  marginLabel: string | null,
  hebrewText: string,
  englishText: string,
): string | undefined {
  if (marginLabel) {
    const cleaned = marginLabel.replace(/:/g, "").trim();
    return cleaned || undefined;
  }
  const source = stripAnchorHTML(hebrewText) || stripAnchorHTML(englishText);
  const words = source.trim().split(/\s+/).slice(0, 3).join(" ");
  return words || undefined;
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

/** Strips HTML tags and collapses whitespace — used when snapshotting a main-text segment's
 *  hebrewHTML/englishHTML into a highlight's anchorQuoteHe/En, since those fields can carry raw
 *  markup (SA inline-marker spans, bold-editorial spans) that shouldn't show up in a quote
 *  preview. CommentaryEntry paragraphs never carry HTML, so callers only need this for
 *  main-text segments. */
export function stripAnchorHTML(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Human-readable label for an anchor — used for the Notebook's anchor pills and for highlight/
 *  anchor list rows. Granular when the anchor carries a captured amud/segmentLabel (see
 *  TextAnchor): "Bereshit 2:3" (Tanakh), "Berakhot 1:א" (Mishnah/Tosefta), a Rambam chapter:
 *  halakha or SA siman:seif in the same "chapter:label" shape, or "Gittin 2b — [opening words]"
 *  for Talmud/Yerushalmi (no per-segment numbering, so amud + a short excerpt stand in for it).
 *  Falls back to buildDisplayTitle's plain book+chapter format (lib/bookmarks.ts) for anchors
 *  created before these fields existed, or wherever the browser couldn't capture a label. */
export function formatAnchorLabel(anchor: TextAnchor, hebrewMode = false): string {
  const isTalmud = anchor.category === "talmud";
  const isYerushalmi = anchor.category === "yerushalmi";
  const bookName = getCategoryItemName(anchor.category, anchor.index, hebrewMode);

  let location: string;
  if (isTalmud && anchor.amud) {
    location = `${bookName} ${anchor.chapter}${anchor.amud}`;
    if (anchor.segmentLabel) location += ` — ${anchor.segmentLabel}`;
  } else if (isYerushalmi) {
    const halakhaStr = anchor.halakha && anchor.halakha > 1 ? `:${anchor.halakha}` : "";
    location = `${bookName} ${anchor.chapter}${halakhaStr}`;
    if (anchor.segmentLabel) location += ` — ${anchor.segmentLabel}`;
  } else if (anchor.segmentLabel && !isTalmud) {
    location = `${bookName} ${anchor.chapter}:${anchor.segmentLabel}`;
  } else {
    location = buildDisplayTitle(anchor.category, anchor.index, anchor.chapter, anchor.halakha);
  }

  if (anchor.source === "commentary" && anchor.commentaryType) {
    const commentaryName = hebrewMode
      ? hebrewCommentaryDisplayName[anchor.commentaryType]
      : commentaryDisplayName[anchor.commentaryType];
    return hebrewMode ? `${commentaryName} על ${location}` : `${commentaryName} on ${location}`;
  }
  return location;
}
