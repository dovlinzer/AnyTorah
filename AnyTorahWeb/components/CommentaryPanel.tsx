"use client";

import { useEffect, useRef, useState } from "react";
import { type CommentaryType, displayName, hebrewDisplayName, hasInlineSAMarkers } from "@/lib/commentaryTypes";
import type { ReaderCategory, PoolInfo } from "@/lib/commentaryPools";
import { saHebrewLetter, SA_SLOT_STYLES, type TextDisplayMode, type CommentaryEntry } from "@/lib/textModels";

export default function CommentaryPanel({
  category,
  index,
  chapter,
  displayMode,
  poolInfo,
  slots,
  effectiveSlots,
  onSlotsChange,
  talmudAmud,
  mainSegmentCount,
  fontSizeLevel,
  hebrewMode = false,
}: {
  category: ReaderCategory;
  index: number;
  chapter: number;
  displayMode: TextDisplayMode;
  poolInfo: PoolInfo;
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
   * Same -1..+4 range as the main text's font-size control. Hebrew and English get different
   * base sizes (20px / 16px, matching the main text) rather than one shared size — at equal
   * pixel size, the Hebrew font (Frank Ruhl Libre) reads visually smaller than the English one,
   * so a single shared base made Hebrew commentary look mismatched against English commentary,
   * and made "max" here look smaller than the main text's "max" even at the same level.
   */
  fontSizeLevel: number;
  /** saHebrewMode — commentator tab names/picker options switch to Hebrew, and the tab strip
   *  flips to RTL so the default-first commentator (e.g. Rashi) visually lands on the right,
   *  matching native. */
  hebrewMode?: boolean;
}) {
  const hebrewFontPx = 20 + fontSizeLevel * 2;
  const englishFontPx = 16 + fontSizeLevel * 2;
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

  const [entries, setEntries] = useState<CommentaryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeType) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const mainCountQuery =
      category === "rambam" && mainSegmentCount ? `&mainCount=${mainSegmentCount}` : "";
    fetch(
      `/api/commentary?category=${category}&index=${index}&chapter=${chapter}&type=${activeType}${mainCountQuery}`,
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
  }, [category, index, chapter, activeType, mainSegmentCount]);

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

      <div ref={contentRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
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
            return (
              <div key={i} className={`flex gap-2 ${numberOnRight ? "flex-row-reverse" : ""}`}>
                {labelNode}
                <div className="flex-1 space-y-1">
                  {(displayMode === "source" || displayMode === "both") && entry.he && (
                    <p
                      dir="rtl"
                      lang="he"
                      className="leading-relaxed"
                      style={{ fontFamily: "var(--font-hebrew)", fontSize: hebrewFontPx }}
                    >
                      {entry.he}
                    </p>
                  )}
                  {(displayMode === "translation" || displayMode === "both") && entry.en && (
                    <p className="leading-relaxed opacity-90" style={{ fontSize: englishFontPx }}>
                      {entry.en}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
