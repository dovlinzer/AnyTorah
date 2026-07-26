"use client";

import { useEffect, useRef, useState } from "react";
import { type CommentaryType, displayName, hebrewDisplayName, hasInlineSAMarkers } from "@/lib/commentaryTypes";
import { fetchCategoryFor, type ReaderCategory, type PoolInfo } from "@/lib/commentaryPools";
import { saHebrewLetter, SA_SLOT_STYLES, type TextDisplayMode, type CommentaryEntry } from "@/lib/textModels";
import { fontSizePx, fontSizeLineHeight, fontSizeSpacingScale } from "@/lib/fontSizeLevels";
import { splitParagraphs } from "@/lib/textAnchor";
import type { Highlight } from "@/lib/highlights";
import FontSizeSlider from "@/components/FontSizeSlider";
import DisplayModePill from "@/components/DisplayModePill";
import HighlightMark from "@/components/HighlightMark";

export default function CommentaryPanel({
  category,
  index,
  chapter,
  displayMode,
  onDisplayModeChange,
  poolInfo,
  slots,
  effectiveSlots,
  onSlotsChange,
  talmudAmud,
  mainSegmentCount,
  fontSizeLevel,
  onFontSizeLevelChange,
  hebrewMode = false,
  halakha,
  getHighlight,
  onHighlightQuickPick,
  onHighlightOpenEditor,
  onInsertToNotebook,
  onActiveTypeChange,
}: {
  category: ReaderCategory;
  index: number;
  chapter: number;
  displayMode: TextDisplayMode;
  onDisplayModeChange: (m: TextDisplayMode) => void;
  poolInfo: PoolInfo;
  /** Yerushalmi only — halakha within the chapter. */
  halakha?: number;
  /** Looks up an existing highlight for a given entry/paragraph of the active commentary —
   *  Reader.tsx owns the actual Highlight[] state and localStorage, this panel is purely
   *  presentational; commentaryType is threaded through since it's part of the anchor and only
   *  this panel knows which commentary tab is currently active. */
  getHighlight: (segmentIndex: number, paragraphIndex: number, commentaryType: CommentaryType) => Highlight | undefined;
  onHighlightQuickPick: (
    segmentIndex: number,
    paragraphIndex: number,
    commentaryType: CommentaryType,
    colorIndex: number,
    anchorQuoteHe: string,
    anchorQuoteEn: string,
  ) => void;
  onHighlightOpenEditor: (
    segmentIndex: number,
    paragraphIndex: number,
    commentaryType: CommentaryType,
    anchorQuoteHe: string,
    anchorQuoteEn: string,
  ) => void;
  /** Set only while the Notebook side panel is open — inserts this paragraph as an anchor at the
   *  notebook's cursor. See HighlightMark's onInsertToNotebook for the click affordance. */
  onInsertToNotebook?: (segmentIndex: number, paragraphIndex: number, commentaryType: CommentaryType) => void;
  /** Fired whenever the active commentary tab changes — Reader.tsx uses this to auto-follow the
   *  Notebook's scope to whichever commentary the reader is currently viewing (see notebook
   *  reverse-sync). Only this panel knows which tab is active, so the signal has to be lifted. */
  onActiveTypeChange?: (type: CommentaryType) => void;
  /** The user's raw slot assignments — what the swap picker writes to and persists. */
  slots: CommentaryType[];
  /** slots with any context-unavailable entry substituted for a fallback — what's shown/fetched. */
  effectiveSlots: CommentaryType[];
  onSlotsChange: (slots: CommentaryType[]) => void;
  /** Talmud only — which amud to scroll this panel's content to. */
  talmudAmud?: "a" | "b";
  /** Rambam only — real halakha count of the current chapter, needed for its depth-3 fix. */
  mainSegmentCount?: number;
  /**
   * Same level scheme (lib/fontSizeLevels.ts) as the main text's font-size control. Hebrew and
   * English get different
   * base sizes (20px / 16px, matching the main text) rather than one shared size — at equal
   * pixel size, the Hebrew font (Frank Ruhl Libre) reads visually smaller than the English one,
   * so a single shared base made Hebrew commentary look mismatched against English commentary,
   * and made "max" here look smaller than the main text's "max" even at the same level.
   */
  fontSizeLevel: number;
  onFontSizeLevelChange: (n: number) => void;
  /** saHebrewMode — commentator tab names/picker options switch to Hebrew, and the tab strip
   *  flips to RTL so the default-first commentator (e.g. Rashi) visually lands on the right,
   *  matching native. */
  hebrewMode?: boolean;
}) {
  const hebrewFontPx = fontSizePx(20, fontSizeLevel);
  const englishFontPx = fontSizePx(16, fontSizeLevel);
  const lineHeight = fontSizeLineHeight(fontSizeLevel);
  // Same rationale as Reader.tsx's mainSegmentGap/mainLineGap — the fixed gap between entries
  // (and between an entry's Hebrew/English lines) dominated the visual rhythm more than
  // in-paragraph line-height for typical short entries, so it needs to scale too.
  const entryGap = 12 * fontSizeSpacingScale(fontSizeLevel);
  const entryLineGap = 4 * fontSizeSpacingScale(fontSizeLevel);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openSlotIndex, setOpenSlotIndex] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const amudBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
    setOpenSlotIndex(null);
    // Slot *assignments* reset in Reader (which owns them); this just resets which tab is
    // being viewed whenever the commentary context changes.
  }, [poolInfo.contextKey]);

  const activeType = effectiveSlots[activeIndex] ?? slots[activeIndex];

  useEffect(() => {
    if (activeType) onActiveTypeChange?.(activeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onActiveTypeChange ref intentionally excluded, fire only when the tab itself changes
  }, [activeType]);

  const [entries, setEntries] = useState<CommentaryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeType) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const { fetchCategory, subcategory } = fetchCategoryFor(category);
    const mainCountQuery =
      category === "rambam" && mainSegmentCount ? `&mainCount=${mainSegmentCount}` : "";
    const subcategoryQuery = subcategory ? `&subcategory=${subcategory}` : "";
    const halakhaQuery = subcategory === "yerushalmi" && halakha ? `&halakha=${halakha}` : "";
    fetch(
      `/api/commentary?category=${fetchCategory}&index=${index}&chapter=${chapter}&type=${activeType}${mainCountQuery}${subcategoryQuery}${halakhaQuery}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load commentary");
        setEntries(json.entries);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load commentary");
        setEntries(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // mainSegmentCount arrives asynchronously (after Reader's own chapter fetch resolves) —
    // include it so Rambam re-fetches once the real halakha count is known, rather than
    // fetching once with a stale/undefined count and never correcting.
  }, [category, index, chapter, activeType, mainSegmentCount, halakha]);

  useEffect(() => {
    if (category !== "talmud") return;
    if (talmudAmud === "b") {
      amudBRef.current?.scrollIntoView({ block: "start" });
    } else {
      contentRef.current?.scrollTo({ top: 0 });
    }
  }, [category, talmudAmud, entries]);

  return (
    <div className="flex h-full flex-col">
      <div dir={hebrewMode ? "rtl" : "ltr"} className="flex border-b border-border">
        {slots.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (i === activeIndex) {
                setOpenSlotIndex(openSlotIndex === i ? null : i);
              } else {
                setActiveIndex(i);
                setOpenSlotIndex(null);
              }
            }}
            className="-mb-px flex-1 truncate border-b-2 px-2 py-2 text-sm transition-colors"
            style={
              i === activeIndex
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : { borderColor: "transparent" }
            }
          >
            {(hebrewMode ? hebrewDisplayName : displayName)[effectiveSlots[i] ?? slots[i]]}
            {i === activeIndex ? " ▾" : ""}
          </button>
        ))}
      </div>

      {openSlotIndex !== null && (
        <div dir={hebrewMode ? "rtl" : "ltr"} className="max-h-56 overflow-y-auto border-b border-border bg-card p-2 text-sm">
          {poolInfo.groups.map((group, gi) => {
            const options = group.filter(
              (t) => poolInfo.isAvailable(t) && !slots.some((s, si) => s === t && si !== openSlotIndex),
            );
            if (options.length === 0) return null;
            return (
              <div key={gi} className="mb-2 last:mb-0">
                {poolInfo.groupLabels[gi] && (
                  <div className="mb-1 text-xs font-medium opacity-50">{poolInfo.groupLabels[gi]}</div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {options.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        const slotIdx = openSlotIndex;
                        onSlotsChange(slots.map((s, i) => (i === slotIdx ? t : s)));
                        setActiveIndex(slotIdx);
                        setOpenSlotIndex(null);
                      }}
                      className="rounded-full border border-border px-2.5 py-1 transition-colors hover:border-[var(--accent)]"
                    >
                      {(hebrewMode ? hebrewDisplayName : displayName)[t]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto p-3 text-sm"
        style={{ display: "flex", flexDirection: "column", gap: entryGap }}
      >
        {loading && <p className="py-6 text-center opacity-60">Loading…</p>}
        {error && <p className="py-6 text-center text-red-500">{error}</p>}
        {!loading && !error && entries && entries.length === 0 && (
          <p className="py-6 text-center opacity-60">No commentary found for this selection.</p>
        )}
        {!loading &&
          !error &&
          entries?.map((entry, i) => {
            if (entry.kind === "amudBMarker") {
              return (
                <div key={i} ref={amudBRef} className="flex items-center gap-3 py-2 text-xs opacity-60">
                  <div className="h-px flex-1 bg-border" />
                  עמוד ב · Amud B ({entry.daf}b)
                  <div className="h-px flex-1 bg-border" />
                </div>
              );
            }
            if (entry.kind === "recensionHeader") {
              return (
                <div
                  key={i}
                  dir="rtl"
                  className="py-1 text-center text-xs opacity-60"
                  style={{ fontFamily: "var(--font-hebrew)" }}
                >
                  {entry.text}
                </div>
              );
            }
            if (entry.kind === "bookDivider") {
              return (
                <div
                  key={i}
                  dir="rtl"
                  className="my-2 border-y border-border py-1.5 text-center font-semibold"
                  style={{ fontFamily: "var(--font-hebrew)", color: "var(--accent)" }}
                >
                  {entry.text}
                </div>
              );
            }
            const num = (entry.label ?? entry.index) + 1;
            // Number sits on the right (Hebrew reading order) whenever Hebrew is visible;
            // only pure English display reads left-to-right, so the number moves to the left.
            const numberOnRight = displayMode !== "translation";
            // For SA commentaries with inline main-text markers, show the same bracket-wrapped
            // Hebrew letter (same slot, same shape) instead of a plain sequential number, so
            // the panel entry visually pairs with its "(א)"/"{א}"/"[א]" marker in the main text.
            const showsSABracket = category === "shulchanArukh" && hasInlineSAMarkers(activeType, index);
            const slotStyle = SA_SLOT_STYLES[activeIndex] ?? SA_SLOT_STYLES[0];
            const labelNode = showsSABracket ? (
              <span dir="rtl" className={`sa-mark sa-mark-${activeIndex} mt-1 shrink-0`}>
                {slotStyle.open}{saHebrewLetter(num)}{slotStyle.close}
              </span>
            ) : (
              <span className="mt-1 w-5 shrink-0 text-right text-xs tabular-nums opacity-50">{num}</span>
            );
            // A single entry (e.g. one long Ramban comment) can contain multiple logical
            // paragraphs — split so each gets its own highlight affordance, rather than treating
            // the whole entry as one anchor point. Hebrew/English are split independently since
            // they come from different Sefaria fields, and the Hebrew original frequently has no
            // internal paragraph breaks at all even when the English translation does (confirmed:
            // Ramban on Genesis 1:1, English splits into several paragraphs, Hebrew is one
            // unbroken block) — pairing them by index unconditionally used to produce one giant
            // mark for the unsplit language plus several empty phantom rows for the extra
            // paragraphs on the other side. Only split whichever language(s) the current
            // displayMode actually shows, and size paragraphCount off of those — a hidden
            // language's split count should never manufacture empty rows.
            const showHe = displayMode === "source" || displayMode === "both";
            const showEn = displayMode === "translation" || displayMode === "both";
            const heParagraphs = showHe ? splitParagraphs(entry.he) : [];
            const enParagraphs = showEn ? splitParagraphs(entry.en) : [];
            // A hidden language's paragraph count never contributes rows — it's [] above — so
            // this is naturally driven only by whichever language(s) are actually visible.
            const paragraphCount = Math.max(heParagraphs.length, enParagraphs.length, 1);
            return (
              <div key={i} className={`flex gap-2 ${numberOnRight ? "flex-row-reverse" : ""}`}>
                {labelNode}
                <div className="flex-1" style={{ display: "flex", flexDirection: "column", gap: entryLineGap }}>
                  {Array.from({ length: paragraphCount }, (_, pIdx) => {
                    const he = heParagraphs[pIdx];
                    const en = enParagraphs[pIdx];
                    const highlight = getHighlight(entry.index, pIdx, activeType);
                    const markClass = highlight ? `highlight-text highlight-text-${highlight.colorIndex}` : undefined;
                    // Anchor-quote snapshot only captures whichever language(s) are actually
                    // visible under the current display mode, matching Reader.tsx's main-text
                    // segments — not both languages unconditionally.
                    const quoteHe = displayMode === "source" || displayMode === "both" ? he ?? "" : "";
                    const quoteEn = displayMode === "translation" || displayMode === "both" ? en ?? "" : "";
                    return (
                      <HighlightMark
                        key={pIdx}
                        colorIndex={highlight?.colorIndex ?? null}
                        onQuickPick={(c) => onHighlightQuickPick(entry.index, pIdx, activeType, c, quoteHe, quoteEn)}
                        onOpenEditor={() => onHighlightOpenEditor(entry.index, pIdx, activeType, quoteHe, quoteEn)}
                        onInsertToNotebook={
                          onInsertToNotebook ? () => onInsertToNotebook(entry.index, pIdx, activeType) : undefined
                        }
                      >
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap: entryLineGap }}>
                            {(displayMode === "source" || displayMode === "both") && he && (
                              <p
                                dir="rtl"
                                lang="he"
                                style={{ fontFamily: "var(--font-hebrew)", fontSize: hebrewFontPx, lineHeight }}
                              >
                                <span className={markClass}>{he}</span>
                              </p>
                            )}
                            {(displayMode === "translation" || displayMode === "both") && en && (
                              <p className="opacity-90" style={{ fontSize: englishFontPx, lineHeight }}>
                                <span className={markClass}>{en}</span>
                              </p>
                            )}
                          </div>
                          {highlight?.note && (
                            <span className="highlight-note-indicator shrink-0" aria-label="Has note">
                              📝
                            </span>
                          )}
                        </div>
                      </HighlightMark>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
      <div
        dir={hebrewMode ? "rtl" : "ltr"}
        className="flex shrink-0 items-center gap-3 border-t border-border px-3 py-1"
      >
        <FontSizeSlider label="Commentary" level={fontSizeLevel} onChange={onFontSizeLevelChange} hebrewMode={hebrewMode} />
        <DisplayModePill mode={displayMode} onChange={onDisplayModeChange} />
      </div>
    </div>
  );
}
