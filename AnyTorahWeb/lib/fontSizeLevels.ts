// Shared font-size level scheme for the main text and commentary panel (each has its own
// independent level, but both derive px/line-height from this one table so the two never drift
// out of sync). Levels are non-contiguous integers, not a plain range: user feedback was that the
// old smallest (-1) was still too big and there were more middle steps than needed, so this drops
// two old middle steps (1, 3) and adds a new smallest (-2, 2px below the old -1) while leaving the
// largest (4) untouched.
export const FONT_SIZE_LEVELS = [-2, -1, 0, 2, 4] as const;
export const FONT_SIZE_MIN = FONT_SIZE_LEVELS[0];
export const FONT_SIZE_MAX = FONT_SIZE_LEVELS[FONT_SIZE_LEVELS.length - 1];
export const FONT_SIZE_LABELS: Record<number, string> = {
  [-2]: "Smallest",
  [-1]: "Small",
  0: "Default",
  2: "Large",
  4: "Largest",
};

export function fontSizePx(base: number, level: number): number {
  return base + level * 2;
}

// Tighter leading at smaller sizes, looser at larger — 0.05 per level-step above the floor,
// clamped to roughly match the old fixed "leading-relaxed" (1.625) at the top end.
export function fontSizeLineHeight(level: number): number {
  return 1.35 + (level - FONT_SIZE_MIN) * 0.05;
}
