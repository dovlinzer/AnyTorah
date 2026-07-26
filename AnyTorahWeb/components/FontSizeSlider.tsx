"use client";

import { FONT_SIZE_LEVELS, FONT_SIZE_LABELS } from "@/lib/fontSizeLevels";

/**
 * Font-size slider — replaces the old tappable-dots control (FontSizeControl). One instance sits
 * at the bottom of the main text panel, one at the bottom of the commentary panel, each driving
 * that panel's own independent fontSizeLevel. Levels are non-contiguous (see
 * lib/fontSizeLevels.ts), so the slider's own value is just an index into FONT_SIZE_LEVELS, never
 * the raw level number — a native range input can't have discontiguous steps, so it always feels
 * like it's snapping between the 6 defined sizes rather than moving continuously; that's expected
 * (font sizes, not a magnification %), not a bug. Deliberately compact — a fixed small width
 * rather than spanning the panel, so it reads as a small corner control, not a prominent bar.
 * Bare (no border/padding of its own) — sits inside each panel's shared bottom-bar footer
 * alongside DisplayModePill (see Reader.tsx's text panel and CommentaryPanel.tsx).
 */
export default function FontSizeSlider({
  label,
  level,
  onChange,
  hebrewMode = false,
}: {
  label: string;
  level: number;
  onChange: (n: number) => void;
  hebrewMode?: boolean;
}) {
  const letter = hebrewMode ? "א" : "A";
  const currentIndex = FONT_SIZE_LEVELS.indexOf(level as (typeof FONT_SIZE_LEVELS)[number]);
  const clampedIndex = currentIndex === -1 ? 0 : currentIndex;
  return (
    <div dir={hebrewMode ? "rtl" : "ltr"} className="flex shrink-0 items-center gap-1.5">
      <span className="text-[10px] opacity-50">{letter}</span>
      <div className="flex items-center gap-1">
        <input
          type="range"
          min={0}
          max={FONT_SIZE_LEVELS.length - 1}
          step={1}
          value={clampedIndex}
          onChange={(e) => onChange(FONT_SIZE_LEVELS[Number(e.target.value)])}
          aria-label={`${label} font size: ${FONT_SIZE_LABELS[level] ?? ""}`}
          title={FONT_SIZE_LABELS[level] ?? ""}
          className="h-1 w-20"
          style={{ accentColor: "var(--accent)" }}
        />
        <span className="w-14 shrink-0 text-[10px] opacity-40">{FONT_SIZE_LABELS[level] ?? ""}</span>
      </div>
      <span className="text-xs opacity-50">{letter}</span>
    </div>
  );
}
