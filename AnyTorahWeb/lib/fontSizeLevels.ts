// Shared font-size level scheme for the main text and commentary panel (each has its own
// independent level, but both derive px/line-height from this one table so the two never drift
// out of sync). Levels are non-contiguous integers, not a plain range: user feedback was that the
// old smallest (-1) was still too big and there were more middle steps than needed, so this drops
// two old middle steps (1, 3) and adds a new smallest (-2, 2px below the old -1). A new largest
// (6, 2px above the old largest 4) was added later — the old top level 4 became "Larger" rather
// than staying "Largest". fontSizeLineHeight/fontSizeSpacingScale below derive their range from
// FONT_SIZE_MIN/MAX automatically, so extending either end doesn't need any other changes there.
export const FONT_SIZE_LEVELS = [-2, -1, 0, 2, 4, 6] as const;
export const FONT_SIZE_MIN = FONT_SIZE_LEVELS[0];
export const FONT_SIZE_MAX = FONT_SIZE_LEVELS[FONT_SIZE_LEVELS.length - 1];
export const FONT_SIZE_LABELS: Record<number, string> = {
  [-2]: "Smallest",
  [-1]: "Small",
  0: "Default",
  2: "Large",
  4: "Larger",
  6: "Largest",
};

export function fontSizePx(base: number, level: number): number {
  return base + level * 2;
}

// Tighter leading at smaller sizes, looser at larger. Range widened from an earlier 1.35-1.65
// attempt — that version was measurably correct (confirmed via getComputedStyle) but the
// per-click delta between adjacent levels was only ~1-2px, easily lost against the much larger,
// already-obvious font-size change happening at the same time. 1.2-1.8 makes each step register
// on its own. 1.2 is still within the safe range for Frank Ruhl Libre with niqqud (doesn't clip).
export function fontSizeLineHeight(level: number): number {
  return 1.2 + ((level - FONT_SIZE_MIN) * 0.6) / (FONT_SIZE_MAX - FONT_SIZE_MIN);
}

// Multiplier for vertical gaps *between* segments/entries — e.g. the space between verses, or
// between a segment's Hebrew and English lines. Without this, those gaps stayed fixed regardless
// of font-size level, which dominated the visual rhythm at small sizes and made the tighter
// line-height (within a wrapped paragraph) unnoticeable — most segments are only 1-3 lines, so
// inter-segment spacing is what a reader actually perceives as "line spacing" while scrolling.
// Range widened for the same reason as fontSizeLineHeight above (0.7-1.15 wasn't perceptible
// step-to-step); 0.55-1.35 makes the smallest level roughly half the largest level's gap.
export function fontSizeSpacingScale(level: number): number {
  return 0.55 + ((level - FONT_SIZE_MIN) * 0.8) / (FONT_SIZE_MAX - FONT_SIZE_MIN);
}
