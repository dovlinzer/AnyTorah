"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TextDisplayMode, TextSegment } from "@/lib/textModels";
import type { CommentaryType } from "@/lib/commentaryTypes";
import { getPoolInfo, computeEffectiveSlots, fetchCategoryFor, type ReaderCategory } from "@/lib/commentaryPools";
import {
  getCategoryGroups,
  getCategoryItemName,
  getChapterMin,
  getChapterMax,
  getChapterUnitLabel,
  getCategoryDisplayName,
  getTalmudSefariaName,
  getStartAmud,
} from "@/lib/categoryCatalog";
import CommentaryPanel from "@/components/CommentaryPanel";
import SASimanPicker from "@/components/SASimanPicker";
import NumberPickerModal from "@/components/NumberPickerModal";
import DafImagePanel from "@/components/DafImagePanel";
import DedicationBanner from "@/components/DedicationBanner";
import FontSizeSlider from "@/components/FontSizeSlider";
import DisplayModePill from "@/components/DisplayModePill";
import { formattedMessage, type Dedication } from "@/lib/dedicationService";
import { FONT_SIZE_MIN, FONT_SIZE_MAX, fontSizePx, fontSizeLineHeight, fontSizeSpacingScale } from "@/lib/fontSizeLevels";
import BookmarkEditModal from "@/components/BookmarkEditModal";
import BookmarkListModal from "@/components/BookmarkListModal";
import { loadTalmudPages, hasPages as hasTalmudPages, type TalmudPages } from "@/lib/talmudPages";
import {
  saveBookmarks,
  loadAndReconcileBookmarks,
  findBookmark,
  buildDisplayTitle,
  buildSubtitle,
  type Bookmark,
} from "@/lib/bookmarks";
import type { YomiToday, YomiResult } from "@/lib/yomiService";
import { toHebrewNumeral } from "@/lib/textModels";
import { saveHighlights, loadAndReconcileHighlights, findHighlight, type Highlight } from "@/lib/highlights";
import { anchorKey, stripAnchorHTML, buildSegmentLabel, type TextAnchor } from "@/lib/textAnchor";
import HighlightMark from "@/components/HighlightMark";
import HighlightEditModal from "@/components/HighlightEditModal";
import HighlightsListModal from "@/components/HighlightsListModal";
import NotebookPanel, { type NotebookScopeOption } from "@/components/NotebookPanel";
import NotebookSearchModal from "@/components/NotebookSearchModal";
import { notebookScopeKey, formatNotebookScopeLabel, type NotebookScope } from "@/lib/notebooks";
import AccountButton from "@/components/AccountButton";
import { useAuth } from "@/components/AuthProvider";
import { schedulePreferencesSync, reconcilePreferences } from "@/lib/preferences";

interface ChapterResponse {
  ref: string;
  segments: TextSegment[];
  /** Yerushalmi only — total halakhot in the current chapter, sizes the halakha stepper. */
  halakhaCount?: number;
}

const READER_CATEGORIES: ReaderCategory[] =
  ["tanakh", "mishnah", "tosefta", "talmud", "yerushalmi", "rambam", "tur", "shulchanArukh"];

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Looks up a catalog item's display name (English, or nikkud-stripped Hebrew) by id — used for
 *  the Daf Yomi button, which needs a tractate name outside the currently-selected category's
 *  own `groups`/`index` state. Thin wrapper over the shared getCategoryItemName. */
function findCategoryItemName(category: ReaderCategory, index: number, hebrewMode: boolean): string {
  return getCategoryItemName(category, index, hebrewMode);
}

// Commentary slot assignments are remembered per context (e.g. "talmud", "sa:0") so switching
// categories and back restores the user's chosen commentators, matching native's UserDefaults/
// SharedPreferences-backed "commentarySlots_$contextKey" persistence.
const SLOT_STORAGE_PREFIX = "anytorah:slots:";

function loadStoredSlots(contextKey: string): CommentaryType[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SLOT_STORAGE_PREFIX + contextKey);
    return raw ? (JSON.parse(raw) as CommentaryType[]) : null;
  } catch {
    return null;
  }
}

function storeSlots(contextKey: string, slots: CommentaryType[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLOT_STORAGE_PREFIX + contextKey, JSON.stringify(slots));
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable (private browsing, quota) — slot choice just won't persist.
  }
}

// Font size levels (see lib/fontSizeLevels.ts for the shared px/line-height derivation, also
// used by CommentaryPanel). Text and commentary are sized independently — some users want
// commentary smaller/larger than the main text, not locked together.
const MAIN_FONT_SIZE_KEY = "anytorah:fontSizeLevel";
const COMMENTARY_FONT_SIZE_KEY = "anytorah:commentaryFontSizeLevel";

function loadFontSizeLevel(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? clamp(n, FONT_SIZE_MIN, FONT_SIZE_MAX) : 0;
  } catch {
    return 0;
  }
}

function storeFontSizeLevel(key: string, level: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(level));
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — font size choice just won't persist.
  }
}

// Hebrew/RTL display mode — matches native's saHebrewMode: book/tractate names, category tabs,
// and commentator names switch to nikkud-stripped Hebrew, chapter/siman numbers show as Hebrew
// numerals, and the commentary tab strip flips to RTL (so the default-first commentator lands on
// the right). Toolbar/selector *positions* stay fixed regardless of this setting — only labels
// and the commentary strip change. Independent of the per-panel Hebrew/English/both content
// toggles (textDisplayMode/commentaryDisplayMode) — this only affects UI chrome, not which
// language of the text itself is shown.
const HEBREW_MODE_KEY = "anytorah:hebrewMode";

/** null means the user has never touched the toggle — distinct from an explicit "off" — so the
 *  Israel-geolocation default (see Reader's mount effect) only ever applies once, before any
 *  explicit user choice exists. */
function loadStoredHebrewMode(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HEBREW_MODE_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

function storeHebrewMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HEBREW_MODE_KEY, on ? "1" : "0");
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — toggle just won't persist.
  }
}

// Text/Commentary Hebrew-English-both display mode — each panel persists independently (a user
// may want the main text in "both" but commentary in English-only, or vice versa). Unset (null)
// is distinct from an explicit "both": on first load with nothing stored yet, the caller falls
// back to whatever hebrewMode itself would imply (source when RTL, both otherwise) rather than
// hardcoding "both" — otherwise a returning user whose hebrewMode was on from a *previous*
// session, from before this per-panel persistence existed, would see one stale reload back to
// "both" before ever getting a chance to have it stored.
const TEXT_DISPLAY_MODE_KEY = "anytorah:textDisplayMode";
const COMMENTARY_DISPLAY_MODE_KEY = "anytorah:commentaryDisplayMode";

function loadStoredDisplayMode(key: string): TextDisplayMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === "source" || raw === "both" || raw === "translation" ? raw : null;
  } catch {
    return null;
  }
}

function storeDisplayMode(key: string, mode: TextDisplayMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, mode);
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — display mode choice just won't persist.
  }
}

// Reverse Navigation Direction — a separate, independent setting (native has this too) that
// swaps which physical arrow/chevron moves forward vs. backward. Off by default: right/next
// matches left-to-right reading convention regardless of hebrewMode.
const REVERSE_NAV_KEY = "anytorah:reverseNavigation";

function loadReverseNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REVERSE_NAV_KEY) === "1";
  } catch {
    return false;
  }
}

function storeReverseNavigation(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REVERSE_NAV_KEY, on ? "1" : "0");
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — toggle just won't persist.
  }
}

const SHOW_DAF_IMAGE_KEY = "anytorah:showDafImage";

function loadShowDafImage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SHOW_DAF_IMAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeShowDafImage(show: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOW_DAF_IMAGE_KEY, show ? "1" : "0");
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — toggle just won't persist.
  }
}

// Panel layout: which side the daf-image column sits on (it always gets the flexible/big
// share of space; the digital text always takes the fixed/narrow share when daf image is
// shown), plus drag-resizable widths for the text-vs-daf narrow slot and the commentary panel.
const DAF_POSITION_KEY = "anytorah:dafPosition";
const NARROW_WIDTH_KEY = "anytorah:narrowPanelWidth";
const COMMENTARY_WIDTH_KEY = "anytorah:commentaryWidth";
const NOTEBOOK_WIDTH_KEY = "anytorah:notebookWidth";
const NARROW_WIDTH_DEFAULT = 420;
const COMMENTARY_WIDTH_DEFAULT = 380;
const NOTEBOOK_WIDTH_DEFAULT = 380;
const PANEL_WIDTH_MIN = 260;
const PANEL_WIDTH_MAX = 800;

type DafPosition = "left" | "middle";

function loadDafPosition(): DafPosition {
  if (typeof window === "undefined") return "middle";
  try {
    return window.localStorage.getItem(DAF_POSITION_KEY) === "left" ? "left" : "middle";
  } catch {
    return "middle";
  }
}

function storeDafPosition(pos: DafPosition) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DAF_POSITION_KEY, pos);
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — position choice just won't persist.
  }
}

function loadStoredWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? clamp(n, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX) : fallback;
  } catch {
    return fallback;
  }
}

function storeWidth(key: string, px: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(px));
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — width choice just won't persist.
  }
}

/** Draggable vertical divider between two panels; reports the raw pointer-X delta per move. */
function ResizeHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const delta = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      onDrag(delta);
    }
    function handleUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onDrag]);

  return (
    <div
      onMouseDown={(e) => {
        draggingRef.current = true;
        lastXRef.current = e.clientX;
      }}
      role="separator"
      aria-orientation="vertical"
      className="mx-1 w-1.5 shrink-0 cursor-col-resize self-stretch rounded transition-colors hover:bg-[var(--accent)]"
      style={{ background: "var(--border)" }}
    />
  );
}

/** Number input that only commits (and re-fetches) on blur/Enter, not per keystroke. */
/**
 * Always type="text", never type="number" — a native number input can't render non-numeric text
 * (Rambam's "Header") and, in RTL, also can't be trusted to keep the digits typed left-to-right
 * (see Hebrew/RTL note below). Digits stay Arabic in every mode: typing Hebrew numerals isn't a
 * practical input method, matching NumberPickerModal's quick-jump field.
 *
 * The click/tap stepper is custom-built (▲/▼) rather than relying on a number input's native
 * spin buttons, for the same type="text" reason, and its clicks call onCommit immediately (not
 * just nudging an uncommitted draft) so stepping onto Rambam's chapter 0 shows "Header" right
 * away instead of a raw "0" that only resolves on a later blur/Enter.
 */
function CommitInput({
  value,
  min,
  max,
  onCommit,
  labelFor,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  /** Overrides the displayed value for specific values (e.g. Rambam's chapter 0 → "Header").
   *  Falls back to the plain number when it returns undefined. */
  labelFor?: (n: number) => string | undefined;
}) {
  const display = (n: number) => labelFor?.(n) ?? String(n);
  const [draft, setDraft] = useState(display(value));
  useEffect(() => setDraft(display(value)), [value]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) onCommit(clamp(n, min, max));
    else setDraft(display(value));
  };

  const step = (delta: number) => {
    const n = parseInt(draft, 10);
    const base = Number.isFinite(n) ? n : value;
    onCommit(clamp(base + delta, min, max));
  };

  return (
    <div className="flex shrink-0 items-stretch overflow-hidden rounded border border-border bg-background">
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          else if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
          else if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
        }}
        className="w-14 min-w-0 bg-transparent px-2 py-1 text-center text-sm"
      />
      <div className="flex flex-col border-l border-border">
        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label="Increase"
          tabIndex={-1}
          className="flex-1 px-1 text-[9px] leading-none opacity-60 transition-opacity hover:opacity-100 hover:bg-[var(--border)] disabled:opacity-20 disabled:hover:bg-transparent"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label="Decrease"
          tabIndex={-1}
          className="flex-1 border-t border-border px-1 text-[9px] leading-none opacity-60 transition-opacity hover:opacity-100 hover:bg-[var(--border)] disabled:opacity-20 disabled:hover:bg-transparent"
        >
          ▼
        </button>
      </div>
    </div>
  );
}


/** EN/עב pill toggling saHebrewMode — Hebrew names, Hebrew numerals, and RTL toolbar layout.
 *  Sized one step larger (px-4 py-2 text-base vs. px-3 py-1.5 text-sm) when `on` — Hebrew glyphs
 *  render visibly smaller than Latin ones at the same font size, and Hebrew mode never actually
 *  needed the compact English-mode sizing. Bumped a second time (2026-07-26, same session) along
 *  with every other header control after the user realized their 110% browser zoom had been
 *  making both sizes look bigger than they actually render. */
function HebrewModeToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className={
        on
          ? "flex shrink-0 overflow-hidden rounded-full border border-border text-base"
          : "flex shrink-0 overflow-hidden rounded-full border border-border text-sm"
      }
    >
      {[false, true].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          aria-label={v ? "Switch to Hebrew names" : "Switch to English names"}
          className={on ? "px-4 py-2 transition-colors" : "px-3 py-1.5 transition-colors"}
          style={on === v ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
        >
          {v ? "עב" : "EN"}
        </button>
      ))}
    </div>
  );
}

/** Toggles Reverse Navigation Direction — swaps which physical arrow/chevron moves forward vs.
 *  backward, independent of hebrewMode (native has this as its own separate setting). `hebrewMode`
 *  here only drives sizing (same one-step-larger treatment as the rest of the header's Hebrew-mode
 *  buttons) — the toggle's own on/off state is unrelated. */
function ReverseNavToggle({
  on,
  onChange,
  hebrewMode,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  hebrewMode: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label="Reverse navigation direction"
      title="Reverse navigation direction"
      className={
        hebrewMode
          ? "shrink-0 rounded-full border border-border px-4 py-2 text-base transition-colors hover:border-[var(--accent)]"
          : "shrink-0 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]"
      }
      style={on ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
    >
      ⇄
    </button>
  );
}

/** Thin vertical rule separating the Text and Commentary control groups. */
function VerticalDivider() {
  return <div className="h-8 w-px shrink-0 self-center bg-border" />;
}

/** Star-with-list badge for the "view bookmarks" button — reads as "a list of starred items",
 *  distinct from the plain ★/☆ toggle next to it (which bookmarks/unbookmarks the current spot). */
function BookmarkListIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      <path d="M12 2.5 15 8.8 22 9.8 17 14.6 18.2 21.5 12 18.2 5.8 21.5 7 14.6 2 9.8 9 8.8Z" />
      <circle cx="17.5" cy="17.5" r="5.3" fill="var(--background)" stroke="currentColor" />
      <path d="M15.4 15.8h4.2M15.4 17.5h4.2M15.4 19.2h4.2" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Notebook (page + ruled lines) with a magnifying glass over its corner — the "search all
 *  notebooks" button, replacing the plain 🔎 emoji so it reads as "search notebooks" specifically
 *  rather than a generic search action, per explicit user request. The magnifying glass reuses
 *  BookmarkListIcon's knockout-circle trick (a `var(--background)` fill behind it) so it stays
 *  legible over the ruled lines it overlaps. */
function NotebookSearchIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      <rect x="2.2" y="2.5" width="13" height="18" rx="1.5" />
      <path d="M5.4 2.5v18" strokeWidth="1.2" />
      <path d="M8.2 7h4.6M8.2 10.3h4.6M8.2 13.6h2.8" strokeWidth="1.1" />
      <circle cx="16.9" cy="16.9" r="4.3" fill="var(--background)" />
      <path d="M20 20 22.5 22.5" strokeWidth="1.8" />
    </svg>
  );
}

/** A yellow highlighter mark with a magnifying glass over it — the "view/search highlights"
 *  button, replacing the plain marker-pen HighlighterIcon so the icon itself shows both halves of
 *  what the button does (highlights + search), per explicit user request. Swatch color reuses
 *  `--highlight-color-0`, the same default yellow every other highlight-color swatch in the app
 *  draws from, so it stays correct in both themes automatically. */
function HighlightSearchIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      <rect x="1.8" y="4.5" width="13.5" height="6.2" rx="1.4" fill="var(--highlight-color-0)" />
      <path d="M3 7.6h11.1M3 10h7.5" stroke="#5b4a00" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
      <circle cx="16.9" cy="16.9" r="4.3" fill="var(--background)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20 22.5 22.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Jumps to today's Daf/Mishnah/Rambam Yomi, 929 chapter, or weekly Parsha — one per relevant
 *  category tab, matching native's TextSelectorView (see AnyTorah/CLAUDE.md's "Yomi" section). */
function YomiButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm opacity-85 transition-colors hover:border-[var(--accent)] hover:opacity-100"
    >
      {label}
    </button>
  );
}

/** Prev/next chevrons overlaid on whichever box sits next to the Commentary panel (see
 *  chevronsOnDaf in Reader). Hidden at the start/end of a book/tractate/section. */
function NavChevrons({
  hideLeft,
  hideRight,
  onStep,
}: {
  hideLeft: boolean;
  hideRight: boolean;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <>
      {!hideLeft && (
        <button
          onClick={() => onStep(-1)}
          aria-label="Previous"
          className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-card/80 px-2 py-3 text-lg opacity-40 backdrop-blur transition-opacity hover:opacity-100"
        >
          ‹
        </button>
      )}
      {!hideRight && (
        <button
          onClick={() => onStep(1)}
          aria-label="Next"
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-card/80 px-2 py-3 text-lg opacity-40 backdrop-blur transition-opacity hover:opacity-100"
        >
          ›
        </button>
      )}
    </>
  );
}

type Selection = Record<ReaderCategory, { index: number; chapter: number; halakha?: number }>;

const INITIAL_SELECTION: Selection = {
  tanakh: { index: 0, chapter: 1 },
  mishnah: { index: 0, chapter: 1 },
  tosefta: { index: 0, chapter: 1 },
  talmud: { index: 0, chapter: getChapterMin("talmud", 0) },
  yerushalmi: { index: 0, chapter: 1, halakha: 1 },
  rambam: { index: 0, chapter: getChapterMin("rambam", 0) },
  tur: { index: 0, chapter: 1 },
  shulchanArukh: { index: 0, chapter: 1 },
};

export default function Reader() {
  const [category, setCategory] = useState<ReaderCategory>("tanakh");
  const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION);
  // Tosefta and Yerushalmi are their own top-level tabs (peers of Mishnah/Talmud, not toggles
  // within them), each with independent selection state in `selection` above — Yerushalmi's
  // tractate list is filtered from Mishnah's (see getCategoryGroups), not Talmud's Bavli list.
  const isYerushalmi = category === "yerushalmi";

  // Halakha count for the current Yerushalmi chapter — comes back from /api/chapter alongside
  // the content (folds native's separate fetchYerushalmiHalakhaCount shape lookup into one
  // request). Defaults to 1 so the stepper never shows an empty range before the first fetch.
  const [halakhaCount, setHalakhaCount] = useState(1);

  const [hebrewMode, setHebrewModeState] = useState(false);
  // Persistent dedication line above the header — independent of DedicationBanner's once-a-day
  // popup, which only ever shows the message once; this stays visible for as long as a
  // dedication is active.
  const [dedication, setDedication] = useState<Dedication | null>(null);
  useEffect(() => {
    fetch("/api/dedication")
      .then((res) => res.json())
      .then((json: { dedication: Dedication | null }) => setDedication(json.dedication))
      .catch(() => {});
  }, []);
  // Today's Daf/Mishnah/Rambam Yomi + 929 + Parsha — fetched once on mount (the calendar doesn't
  // depend on the current category; native re-fetches per category tab, but that's only because
  // it uses the fetch as a lazy per-tab trigger, not because the data itself is category-scoped).
  const [yomi, setYomi] = useState<YomiToday | null>(null);
  useEffect(() => {
    fetch("/api/yomi")
      .then((res) => res.json())
      .then((json: YomiToday) => setYomi(json))
      .catch(() => {});
  }, []);
  const jumpToYomi = (r: YomiResult) => {
    setCategory(r.category);
    setSelection((s) => ({ ...s, [r.category]: { ...s[r.category], index: r.index, chapter: r.chapter } }));
  };
  const [reverseNavigation, setReverseNavigationState] = useState(false);
  useEffect(() => setReverseNavigationState(loadReverseNavigation()), []);
  const setReverseNavigation = (on: boolean) => {
    setReverseNavigationState(on);
    storeReverseNavigation(on);
  };
  // Text and commentary each get their own Hebrew/English/both toggle — some users want to
  // read the main text in "both" but skim commentary in English-only, or vice versa. Each
  // persists under its own key (see loadStoredDisplayMode/storeDisplayMode above) — previously
  // these weren't persisted at all, so a stored hebrewMode="on" would silently revert the
  // display mode to "both" on every reload even though the toggle itself "stuck".
  const [textDisplayMode, setTextDisplayModeState] = useState<TextDisplayMode>("both");
  const [commentaryDisplayMode, setCommentaryDisplayModeState] = useState<TextDisplayMode>("both");
  const setTextDisplayMode = (mode: TextDisplayMode) => {
    setTextDisplayModeState(mode);
    storeDisplayMode(TEXT_DISPLAY_MODE_KEY, mode);
  };
  const setCommentaryDisplayMode = (mode: TextDisplayMode) => {
    setCommentaryDisplayModeState(mode);
    storeDisplayMode(COMMENTARY_DISPLAY_MODE_KEY, mode);
  };
  // Toggling RTL/Hebrew mode also resets reverse navigation and both display modes to that
  // direction's default — ON: reverse nav + Hebrew-only text/commentary; OFF: standard nav +
  // both-language text/commentary. These stay just defaults: each can still be changed
  // independently afterward without Hebrew mode fighting the user's choice on the next toggle.
  const setHebrewMode = (on: boolean) => {
    setHebrewModeState(on);
    storeHebrewMode(on);
    setReverseNavigation(on);
    setTextDisplayMode(on ? "source" : "both");
    setCommentaryDisplayMode(on ? "source" : "both");
  };
  // On first load: restore any explicit stored preference as-is. If the user has never touched
  // the toggle, ask /api/geo (Vercel's edge IP-country header — see app/api/geo/route.ts) and
  // default to Hebrew/RTL for visitors in Israel, via the same setHebrewMode used by the toggle
  // itself so reverse-nav/display-mode defaults come along with it. Runs once; a fetch failure or
  // non-Vercel host (no geo header, e.g. local dev) just leaves the existing English/LTR default.
  useEffect(() => {
    const stored = loadStoredHebrewMode();
    if (stored !== null) {
      setHebrewModeState(stored);
      return;
    }
    fetch("/api/geo")
      .then((res) => res.json())
      .then((json: { country: string | null }) => {
        if (json.country === "IL") setHebrewMode(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Restores each panel's own stored display mode. Falls back to whatever hebrewMode's *stored*
  // value already implies (source when RTL, both otherwise) rather than hardcoding "both", so a
  // returning user whose hebrewMode was already on before this per-panel key existed doesn't see
  // one extra stale reload — see the comment on loadStoredDisplayMode above.
  useEffect(() => {
    const hebrewFallback: TextDisplayMode = loadStoredHebrewMode() === true ? "source" : "both";
    setTextDisplayModeState(loadStoredDisplayMode(TEXT_DISPLAY_MODE_KEY) ?? hebrewFallback);
    setCommentaryDisplayModeState(loadStoredDisplayMode(COMMENTARY_DISPLAY_MODE_KEY) ?? hebrewFallback);
  }, []);
  const [mainFontSizeLevel, setMainFontSizeLevelState] = useState(0);
  const [commentaryFontSizeLevel, setCommentaryFontSizeLevelState] = useState(0);
  useEffect(() => {
    setMainFontSizeLevelState(loadFontSizeLevel(MAIN_FONT_SIZE_KEY));
    setCommentaryFontSizeLevelState(loadFontSizeLevel(COMMENTARY_FONT_SIZE_KEY));
  }, []);
  const setMainFontSizeLevel = (level: number) => {
    setMainFontSizeLevelState(level);
    storeFontSizeLevel(MAIN_FONT_SIZE_KEY, level);
  };
  const setCommentaryFontSizeLevel = (level: number) => {
    setCommentaryFontSizeLevelState(level);
    storeFontSizeLevel(COMMENTARY_FONT_SIZE_KEY, level);
  };
  // The underlying Sefaria-fetch mechanics for Tosefta/Yerushalmi piggyback on Mishnah's/
  // Talmud's (see fetchCategoryFor) — several rendering decisions below key off that shared
  // fetch category rather than the literal UI tab, matching what the API actually returns.
  const { fetchCategory, subcategory } = fetchCategoryFor(category);
  const isBoldEnglishCategory = fetchCategory === "talmud" || fetchCategory === "mishnah";

  const mainHebrewFontPx = fontSizePx(20, mainFontSizeLevel);
  // Gemara English reads as too large relative to the Hebrew at the shared base size — one
  // step (2px) smaller specifically for Talmud/Yerushalmi, not the other categories.
  const mainEnglishFontPx = fontSizePx(16, mainFontSizeLevel) - (fetchCategory === "talmud" ? 2 : 0);
  const mainLineHeight = fontSizeLineHeight(mainFontSizeLevel);
  // Base gaps (16px between verses, 6px between a verse's Hebrew/English lines) scaled by the
  // same font-size level so the *inter-segment* rhythm tightens/loosens alongside the text
  // itself — see fontSizeSpacingScale's comment for why this matters more than in-paragraph
  // line-height for most (short, unwrapped) segments.
  const mainSegmentGap = 16 * fontSizeSpacingScale(mainFontSizeLevel);
  const mainLineGap = 6 * fontSizeSpacingScale(mainFontSizeLevel);

  const { index, chapter, halakha } = selection[category];
  const groups = useMemo(() => getCategoryGroups(category, hebrewMode), [category, hebrewMode]);
  const chapterMin = getChapterMin(category, index);
  const chapterMax = getChapterMax(category, index);
  const chapterUnit = getChapterUnitLabel(category, hebrewMode);

  // Scanned daf image — shown as its own column alongside the digital text (Talmud only).
  const [talmudPages, setTalmudPages] = useState<TalmudPages | null>(null);
  const [showDafImage, setShowDafImageState] = useState(false);
  useEffect(() => setShowDafImageState(loadShowDafImage()), []);
  const setShowDafImage = (show: boolean) => {
    setShowDafImageState(show);
    storeShowDafImage(show);
  };
  useEffect(() => {
    if (category === "talmud" && !talmudPages) {
      loadTalmudPages().then(setTalmudPages);
    }
  }, [category, talmudPages]);
  // Scanned Vilna Shas images are Bavli-only — "talmud" no longer covers Yerushalmi, which is
  // its own category now, so this is already excluded automatically.
  const talmudTractateName = category === "talmud" ? getTalmudSefariaName(index) : undefined;
  const dafImageAvailable =
    !!talmudTractateName && !!talmudPages && hasTalmudPages(talmudPages, talmudTractateName);
  const showDaf = category === "talmud" && showDafImage && dafImageAvailable && !!talmudTractateName;

  const [dafPosition, setDafPositionState] = useState<DafPosition>("middle");
  const [narrowWidth, setNarrowWidthState] = useState(NARROW_WIDTH_DEFAULT);
  const [commentaryWidth, setCommentaryWidthState] = useState(COMMENTARY_WIDTH_DEFAULT);
  const [notebookWidth, setNotebookWidthState] = useState(NOTEBOOK_WIDTH_DEFAULT);
  useEffect(() => {
    setDafPositionState(loadDafPosition());
    setNarrowWidthState(loadStoredWidth(NARROW_WIDTH_KEY, NARROW_WIDTH_DEFAULT));
    setCommentaryWidthState(loadStoredWidth(COMMENTARY_WIDTH_KEY, COMMENTARY_WIDTH_DEFAULT));
    setNotebookWidthState(loadStoredWidth(NOTEBOOK_WIDTH_KEY, NOTEBOOK_WIDTH_DEFAULT));
  }, []);
  const setDafPosition = (pos: DafPosition) => {
    setDafPositionState(pos);
    storeDafPosition(pos);
  };
  const adjustNarrowWidth = (deltaX: number) => {
    setNarrowWidthState((w) => {
      const next = clamp(w + deltaX, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX);
      storeWidth(NARROW_WIDTH_KEY, next);
      return next;
    });
  };
  const adjustCommentaryWidth = (deltaX: number) => {
    setCommentaryWidthState((w) => {
      const next = clamp(w - deltaX, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX);
      storeWidth(COMMENTARY_WIDTH_KEY, next);
      return next;
    });
  };
  const adjustNotebookWidth = (deltaX: number) => {
    setNotebookWidthState((w) => {
      const next = clamp(w - deltaX, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX);
      storeWidth(NOTEBOOK_WIDTH_KEY, next);
      return next;
    });
  };

  const handleIndexChange = (id: number) => {
    setSelection((s) => ({
      ...s,
      [category]: { index: id, chapter: getChapterMin(category, id), halakha: category === "yerushalmi" ? 1 : undefined },
    }));
  };
  const handleChapterChange = useCallback(
    (c: number) => {
      setSelection((s) => ({
        ...s,
        [category]: { ...s[category], chapter: c, halakha: category === "yerushalmi" ? 1 : s[category].halakha },
      }));
    },
    [category],
  );
  const handleYerushalmiHalakhaChange = useCallback((h: number) => {
    setSelection((s) => ({ ...s, yerushalmi: { ...s.yerushalmi, halakha: h } }));
  }, []);

  // Commentary slots live here (not inside CommentaryPanel) because Shulchan Arukh's main text
  // needs to know the current selection to render matching inline commentary-marker brackets.
  const poolInfo = useMemo(() => getPoolInfo(category, index), [category, index]);
  const [slots, setSlotsState] = useState<CommentaryType[]>(
    () => loadStoredSlots(poolInfo.contextKey) ?? poolInfo.defaultSlots,
  );
  useEffect(() => {
    setSlotsState(loadStoredSlots(poolInfo.contextKey) ?? poolInfo.defaultSlots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolInfo.contextKey]);

  const setSlots = (next: CommentaryType[]) => {
    setSlotsState(next);
    storeSlots(poolInfo.contextKey, next);
  };

  // What's actually shown/fetched — slots with any unavailable-for-this-context entry swapped
  // for the next available fallback candidate (e.g. Migdal Oz outside its covered sefarim).
  // `slots` itself is left untouched so the user's real preference persists and is re-tried
  // when they land somewhere it's available again.
  const effectiveSlots = useMemo(
    () => computeEffectiveSlots(slots, poolInfo.isAvailable, poolInfo.fallbackCandidates),
    [slots, poolInfo],
  );

  const [data, setData] = useState<ChapterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commentariesKey = category === "shulchanArukh" ? slots.join(",") : "";
  const halakhaValue = halakha ?? 1;
  const subcategoryQuery = subcategory ? `&subcategory=${subcategory}` : "";
  const halakhaQuery = subcategory === "yerushalmi" ? `&halakha=${halakhaValue}` : "";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const commentariesQuery = commentariesKey ? `&commentaries=${commentariesKey}` : "";
    fetch(
      `/api/chapter?category=${fetchCategory}&index=${index}&chapter=${chapter}${commentariesQuery}${subcategoryQuery}${halakhaQuery}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load text");
        setData(json);
        if (isYerushalmi) {
          const count = typeof json.halakhaCount === "number" && json.halakhaCount > 0 ? json.halakhaCount : 1;
          setHalakhaCount(count);
          if (halakhaValue > count) handleYerushalmiHalakhaChange(count);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load text");
        setData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCategory, index, chapter, commentariesKey, subcategoryQuery, halakhaQuery]);

  // Talmud amud a/b jump — scroll-only (both amudim are always loaded together). Resets to
  // "a" on every new daf/tractate/category, matching the expectation that a daf opens at 2a —
  // except when stepBackward() below crosses a daf boundary, where it should land on the
  // *previous* daf's amud b instead; skipAmudResetRef lets that one case suppress this reset.
  const [talmudAmud, setTalmudAmud] = useState<"a" | "b">(() => getStartAmud(category, index, chapter));
  const textContainerRef = useRef<HTMLDivElement>(null);
  const amudBRef = useRef<HTMLDivElement>(null);
  const skipAmudResetRef = useRef(false);

  useEffect(() => {
    if (skipAmudResetRef.current) {
      skipAmudResetRef.current = false;
      return;
    }
    setTalmudAmud(getStartAmud(category, index, chapter));
  }, [category, index, chapter]);

  const [simanPickerOpen, setSimanPickerOpen] = useState(false);
  const [numberPickerOpen, setNumberPickerOpen] = useState(false);
  const [halakhaPickerOpen, setHalakhaPickerOpen] = useState(false);

  // SA and Tur share the same named-siman picker (SASimanPicker) — Tur's simanim carry the same
  // topic names/numbering as SA's (SA closely follows Tur's own siman structure), so the same
  // lib/saSimanNames.ts data is reused as-is rather than transcribing a second copy. Every other
  // category uses the generic bare-number NumberPickerModal.
  const openChapterPicker = () =>
    category === "shulchanArukh" || category === "tur" ? setSimanPickerOpen(true) : setNumberPickerOpen(true);

  // Rambam's synthetic chapter 0 is the work's bundled mitzvot-list header, not a real chapter —
  // show a text label instead of "0" (which also renders as an empty string in Hebrew numeral
  // form, since toHebrewNumeral(0) === "").
  const rambamChapterLabelFor =
    category === "rambam" ? (n: number) => (n === 0 ? (hebrewMode ? "כותרת" : "Header") : undefined) : undefined;

  // Signed-in users' bookmarks/highlights reconcile against Supabase on load and on every
  // sign-in — see lib/supabase/sync.ts for the merge rule. Depending on user.id (not just
  // mounting once) is what makes a mid-session sign-in (no page reload) also trigger the pull.
  const { user } = useAuth();

  // Bookmarks (+ phase-1 notes, stored as a field on the bookmark — see lib/bookmarks.ts).
  const [bookmarks, setBookmarksState] = useState<Bookmark[]>([]);
  useEffect(() => {
    loadAndReconcileBookmarks().then(setBookmarksState);
  }, [user?.id]);
  const [bookmarkEditOpen, setBookmarkEditOpen] = useState(false);
  const [bookmarkListOpen, setBookmarkListOpen] = useState(false);
  const currentBookmark = useMemo(
    () => findBookmark(bookmarks, category, index, chapter, halakha),
    [bookmarks, category, index, chapter, halakha],
  );

  const handleSaveBookmark = (name: string, notes: string) => {
    setBookmarksState((list) => {
      const next = currentBookmark
        ? list.map((b) => (b.id === currentBookmark.id ? { ...b, name, notes } : b))
        : [
            {
              id: crypto.randomUUID(),
              name,
              notes,
              createdAt: new Date().toISOString(),
              subtitle: buildSubtitle(category, index, chapter, halakha),
              category,
              index,
              chapter,
              halakha,
            },
            ...list,
          ];
      saveBookmarks(next);
      return next;
    });
    setBookmarkEditOpen(false);
  };

  const handleDeleteBookmark = (b: Bookmark) => {
    setBookmarksState((list) => {
      const next = list.filter((x) => x.id !== b.id);
      saveBookmarks(next);
      return next;
    });
    setBookmarkEditOpen(false);
  };

  const handleNavigateBookmark = (b: Bookmark) => {
    setCategory(b.category);
    setSelection((s) => ({ ...s, [b.category]: { index: b.index, chapter: b.chapter, halakha: b.halakha } }));
    setBookmarkListOpen(false);
  };

  // Highlights — a color (+ optional short plain-text note) anchored to a specific paragraph of
  // main text or commentary (see lib/highlights.ts, lib/textAnchor.ts). Distinct from bookmarks
  // (a saved chapter-level *place*) and from the Notebook (a long-form rich-text document with
  // embedded navigation anchors, built separately).
  const [highlights, setHighlightsState] = useState<Highlight[]>([]);
  useEffect(() => {
    loadAndReconcileHighlights().then(setHighlightsState);
  }, [user?.id]);

  // Preferences (font sizes, hebrew mode, display modes, panel widths, commentary slots — see
  // lib/preferences.ts) reconcile the same way, but since those values are already read into ~12
  // separate pieces of component state at mount, reconcilePreferences reloads the page once if
  // the remote copy actually differs, rather than trying to hot-swap every piece of state here.
  useEffect(() => {
    void reconcilePreferences();
  }, [user?.id]);
  const [highlightEditorAnchor, setHighlightEditorAnchor] = useState<TextAnchor | null>(null);
  const [highlightEditorQuote, setHighlightEditorQuote] = useState({ he: "", en: "" });
  const [highlightsListOpen, setHighlightsListOpen] = useState(false);

  // Scoped to the current chapter/halakha selection, same pattern v1 used for its notesLookup —
  // anchorKey alone is only unique within one chapter, so entries outside the current selection
  // are filtered out here rather than baked into the key itself.
  const highlightsLookup = useMemo(() => {
    const map = new Map<string, Highlight>();
    for (const h of highlights) {
      if (
        h.anchor.category === category &&
        h.anchor.index === index &&
        h.anchor.chapter === chapter &&
        (h.anchor.halakha ?? undefined) === (halakha ?? undefined)
      ) {
        map.set(anchorKey(h.anchor), h);
      }
    }
    return map;
  }, [highlights, category, index, chapter, halakha]);

  const buildAnchor = useCallback(
    (
      source: "main" | "commentary",
      segmentIndex: number,
      paragraphIndex: number,
      commentaryType?: CommentaryType,
      amud?: "a" | "b",
      segmentLabel?: string,
    ): TextAnchor => ({
      category,
      index,
      chapter,
      halakha,
      source,
      commentaryType,
      segmentIndex,
      paragraphIndex: paragraphIndex || undefined,
      amud,
      segmentLabel,
    }),
    [category, index, chapter, halakha],
  );

  // Notebook — a long-form rich-text document per book/commentary (not per-chapter, unlike
  // Highlights), with embedded anchor pills that jump the reader here. Side panel, not a modal,
  // so the user can click a paragraph in the reader while the notebook stays open (see
  // HighlightMark's onInsertToNotebook / CommentaryPanel's mirror of it).
  const [notebookOpen, setNotebookOpen] = useState(false);
  // Reverse sync — the panel's scope auto-follows wherever the reader currently is (main text vs.
  // whichever commentary tab is active), rather than a browsing-session-long manual pin. Set
  // directly by three things: CommentaryPanel's onActiveTypeChange (an explicit tab switch), the
  // panel's own scope dropdown, and cross-notebook search navigation. Reset to "main" only on a
  // book/tractate change — a commentary focus from a previous book isn't meaningful once
  // category/index moves on, but switching *chapters* within the same book deliberately does NOT
  // reset it, so stepping through chapters while reading a specific commentary's notes keeps
  // following that same commentary instead of snapping back on every step.
  type NotebookFocus = { source: "main" } | { source: "commentary"; commentaryType: CommentaryType };
  const [notebookFocusSource, setNotebookFocusSource] = useState<NotebookFocus>({ source: "main" });
  // Cross-notebook search navigation (navigateToNotebookScope below) changes category/index and
  // wants a specific focus (possibly "commentary") to survive the reset this effect would
  // otherwise apply — it stashes the desired value here just before triggering the change, and
  // this effect consumes (and clears) it instead of defaulting to "main" when present.
  const pendingNotebookFocusRef = useRef<NotebookFocus | null>(null);
  useEffect(() => {
    setNotebookFocusSource(pendingNotebookFocusRef.current ?? { source: "main" });
    pendingNotebookFocusRef.current = null;
  }, [category, index]);

  const notebookScope: NotebookScope = useMemo(
    () =>
      notebookFocusSource.source === "commentary"
        ? { category, index, source: "commentary", commentaryType: notebookFocusSource.commentaryType }
        : { category, index, source: "main" },
    [category, index, notebookFocusSource],
  );

  const notebookScopeOptions: NotebookScopeOption[] = useMemo(() => {
    // Labels reuse formatNotebookScopeLabel (lib/notebooks.ts) so the dropdown, the panel's own
    // header line, and the cross-notebook search modal all describe the same scope identically —
    // book/tractate name for main text (e.g. "Bavli, Gittin"), "Commentary on Book" for a
    // commentary slot, both fully localized to Hebrew when hebrewMode is on.
    return [
      { source: "main", label: formatNotebookScopeLabel({ category, index, source: "main" }, hebrewMode) },
      ...effectiveSlots.map((c) => ({
        source: "commentary" as const,
        commentaryType: c,
        label: formatNotebookScopeLabel({ category, index, source: "commentary", commentaryType: c }, hebrewMode),
      })),
    ];
  }, [category, index, hebrewMode, effectiveSlots]);

  const notebookInsertRef = useRef<((anchor: TextAnchor) => void) | null>(null);
  const [notebookSearchOpen, setNotebookSearchOpen] = useState(false);
  // Set only when arriving from a cross-notebook search result — seeds NotebookPanel's in-doc
  // find bar so the user lands on the hit that matched, not just the top of the document.
  const [notebookSearchSeed, setNotebookSearchSeed] = useState("");

  const navigateToAnchor = useCallback(
    (anchor: TextAnchor) => {
      setCategory(anchor.category);
      setSelection((s) => ({
        ...s,
        [anchor.category]: { index: anchor.index, chapter: anchor.chapter, halakha: anchor.halakha },
      }));
    },
    [],
  );

  // Cross-notebook search result → open the panel on that exact scope. Chapter/halakha reset to
  // the book's first section (same as picking a new book from any of the book pickers) since a
  // Notebook is scoped to a whole book/commentary, not a chapter — there's no single "right"
  // chapter to land on for a hit that might reference several.
  const navigateToNotebookScope = useCallback((scope: NotebookScope, seedSearchTerm: string) => {
    const desiredFocus: NotebookFocus =
      scope.source === "commentary" && scope.commentaryType
        ? { source: "commentary", commentaryType: scope.commentaryType }
        : { source: "main" };
    // Stash for the [category, index] reset effect above, and also apply directly — the effect
    // only fires when category/index actually change (e.g. searching within the already-open
    // book's own notebook wouldn't change either).
    pendingNotebookFocusRef.current = desiredFocus;
    setNotebookFocusSource(desiredFocus);
    setCategory(scope.category);
    setSelection((s) => ({
      ...s,
      [scope.category]: {
        index: scope.index,
        chapter: getChapterMin(scope.category, scope.index),
        halakha: scope.category === "yerushalmi" ? 1 : undefined,
      },
    }));
    setNotebookSearchSeed(seedSearchTerm);
    setNotebookOpen(true);
    setNotebookSearchOpen(false);
  }, [setCategory, setSelection, setNotebookFocusSource, setNotebookSearchSeed, setNotebookOpen, setNotebookSearchOpen]);

  const upsertHighlight = (
    anchor: TextAnchor,
    colorIndex: number,
    note: string | null,
    tags: string[],
    anchorQuoteHe: string,
    anchorQuoteEn: string,
  ) => {
    setHighlightsState((list) => {
      const existing = findHighlight(list, anchor);
      const now = new Date().toISOString();
      const next = existing
        ? list.map((h) => (h.id === existing.id ? { ...h, colorIndex, note, tags, updatedAt: now } : h))
        : [
            { id: crypto.randomUUID(), createdAt: now, updatedAt: now, anchor, colorIndex, note, tags, anchorQuoteHe, anchorQuoteEn },
            ...list,
          ];
      saveHighlights(next);
      return next;
    });
  };

  const handleQuickPickHighlight = (anchor: TextAnchor, colorIndex: number, anchorQuoteHe: string, anchorQuoteEn: string) => {
    const existing = findHighlight(highlights, anchor);
    upsertHighlight(anchor, colorIndex, existing?.note ?? null, existing?.tags ?? [], existing?.anchorQuoteHe ?? anchorQuoteHe, existing?.anchorQuoteEn ?? anchorQuoteEn);
  };

  const handleDeleteHighlightAt = (anchor: TextAnchor) => {
    setHighlightsState((list) => {
      const existing = findHighlight(list, anchor);
      if (!existing) return list;
      const next = list.filter((h) => h.id !== existing.id);
      saveHighlights(next);
      return next;
    });
  };

  const handleOpenHighlightEditor = (anchor: TextAnchor, anchorQuoteHe: string, anchorQuoteEn: string) => {
    setHighlightEditorAnchor(anchor);
    setHighlightEditorQuote({ he: anchorQuoteHe, en: anchorQuoteEn });
  };

  const handleSaveHighlightFromEditor = (colorIndex: number, note: string | null, tags: string[]) => {
    if (!highlightEditorAnchor) return;
    const existing = findHighlight(highlights, highlightEditorAnchor);
    upsertHighlight(
      highlightEditorAnchor,
      colorIndex,
      note,
      tags,
      existing?.anchorQuoteHe ?? highlightEditorQuote.he,
      existing?.anchorQuoteEn ?? highlightEditorQuote.en,
    );
    setHighlightEditorAnchor(null);
  };

  const handleDeleteHighlightFromEditor = () => {
    if (!highlightEditorAnchor) return;
    handleDeleteHighlightAt(highlightEditorAnchor);
    setHighlightEditorAnchor(null);
  };

  const handleNavigateHighlight = (h: Highlight) => {
    setCategory(h.anchor.category);
    setSelection((s) => ({
      ...s,
      [h.anchor.category]: { index: h.anchor.index, chapter: h.anchor.chapter, halakha: h.anchor.halakha },
    }));
    setHighlightsListOpen(false);
  };

  // Shared "advance/retreat one reading step" used by both arrow keys and the chevron buttons.
  // For Talmud, a step moves one amud at a time (a→b within a daf, then b→a of the next/previous
  // daf) rather than jumping a whole daf, matching how the text actually scrolls.
  const stepReading = useCallback(
    (rawDirection: 1 | -1) => {
      // Reverse Navigation Direction inverts the physical→logical mapping here, once, so every
      // caller (arrow keys, both chevron positions) stays agnostic of the setting — they always
      // pass -1 for "the control on the left" and +1 for "the control on the right".
      const direction: 1 | -1 = reverseNavigation ? ((rawDirection * -1) as 1 | -1) : rawDirection;
      if (category === "talmud") {
        if (direction === 1) {
          if (talmudAmud === "a") {
            setTalmudAmud("b");
          } else {
            const next = clamp(chapter + 1, chapterMin, chapterMax);
            if (next !== chapter) handleChapterChange(next); // lands on amud "a" via the reset effect
          }
        } else {
          // Only step back to this same daf's amud "a" if that amud actually exists — Tamid's
          // startDaf (25) has no real 25a, so from 25b this must fall through to the prev-daf
          // branch below instead, which correctly no-ops at chapterMin.
          if (talmudAmud === "b" && getStartAmud(category, index, chapter) !== "b") {
            setTalmudAmud("a");
          } else {
            const prev = clamp(chapter - 1, chapterMin, chapterMax);
            if (prev !== chapter) {
              skipAmudResetRef.current = true;
              handleChapterChange(prev);
              setTalmudAmud("b");
            }
          }
        }
        return;
      }
      const next = clamp(chapter + direction, chapterMin, chapterMax);
      if (next !== chapter) handleChapterChange(next);
    },
    [category, index, chapter, chapterMin, chapterMax, talmudAmud, handleChapterChange, reverseNavigation],
  );

  const atReadingStart =
    category === "talmud"
      ? chapter === chapterMin && talmudAmud === getStartAmud(category, index, chapterMin)
      : chapter === chapterMin;
  const atReadingEnd = category === "talmud" ? chapter === chapterMax && talmudAmud === "b" : chapter === chapterMax;
  // The left chevron always passes -1 and the right always passes +1 (see stepReading), so which
  // one is a no-op at a boundary swaps along with reverseNavigation.
  const hideLeftChevron = reverseNavigation ? atReadingEnd : atReadingStart;
  const hideRightChevron = reverseNavigation ? atReadingStart : atReadingEnd;

  // The chevrons always sit on whichever box is adjacent to the Commentary panel: normally that's
  // the text (dafPosition "left", or no daf shown at all), but when the daf image takes the
  // middle slot, the text gets pushed to the outer/left slot and the daf box becomes the one
  // next to Commentary — so the chevrons move there instead.
  const chevronsOnDaf = showDaf && dafPosition === "middle";

  // Arrow-key chapter/daf/siman navigation. Ignored while typing in a field (so ← → still work
  // for cursor movement in the chapter input/select) or while the siman/number picker modal is
  // open (they have their own keyboard handling). Right = next, Left = previous, regardless of
  // hebrewMode — a fixed UI convention rather than a text-direction-dependent one.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (simanPickerOpen || numberPickerOpen || halakhaPickerOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      stepReading(e.key === "ArrowRight" ? 1 : -1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [category, chapter, chapterMin, chapterMax, talmudAmud, simanPickerOpen, numberPickerOpen, halakhaPickerOpen, stepReading]);

  useEffect(() => {
    if (category !== "talmud") return;
    if (talmudAmud === "b") {
      amudBRef.current?.scrollIntoView({ block: "start" });
    } else {
      textContainerRef.current?.scrollTo({ top: 0 });
    }
  }, [category, talmudAmud, data]);

  // One Yomi button per relevant tab — Daf Yomi (talmud), Mishnah Yomi (mishnah), Rambam Yomi
  // (rambam), and two for tanakh (weekly Parsha + 929), matching exactly which jump buttons
  // native shows (no Yomi concept exists for tosefta/yerushalmi/shulchanArukh). Only Daf Yomi and
  // Parsha show what they actually jump to (tractate+daf / parsha name) — Mishnah Yomi, Rambam
  // Yomi, and 929 are just the plain title, per explicit user feedback that showing the chapter/
  // section reference on those three was unwanted. Names (tractate, parsha) switch to Hebrew
  // under hebrewMode, matching how every other selector in this toolbar does.
  const yomiButtons: { label: string; onClick: () => void }[] = [];
  if (yomi) {
    if (category === "talmud" && yomi.daf) {
      const r = yomi.daf;
      const tractateName = findCategoryItemName("talmud", r.index, hebrewMode);
      const dafLabel = hebrewMode ? toHebrewNumeral(r.chapter) : String(r.chapter);
      yomiButtons.push({
        label: (hebrewMode ? "דף היומי: " : "Daf Yomi: ") + `${tractateName} ${dafLabel}`,
        onClick: () => jumpToYomi(r),
      });
    } else if (category === "mishnah" && yomi.mishnah) {
      const r = yomi.mishnah;
      yomiButtons.push({ label: hebrewMode ? "משנה יומית" : "Mishnah Yomi", onClick: () => jumpToYomi(r) });
    } else if (category === "rambam" && yomi.rambam) {
      const r = yomi.rambam;
      yomiButtons.push({ label: hebrewMode ? "הרמב״ם היומי" : "Rambam Yomi", onClick: () => jumpToYomi(r) });
    } else if (category === "tanakh") {
      // Parsha before 929 (source order) — combined with dir=rtl on this cluster (and now the
      // whole toolbar, see below), this reads correctly in both directions: left-to-right
      // "Parsha, 929" in English, right-to-left "Parsha, 929" (Parsha closer to the selector
      // boxes) in Hebrew — per explicit user request.
      if (yomi.parsha) {
        const r = yomi.parsha;
        yomiButtons.push({
          label: (hebrewMode ? "פרשה: " : "Parsha: ") + (hebrewMode ? r.hebrewName : r.name),
          onClick: () => jumpToYomi(r),
        });
      }
      if (yomi.tanakh929) {
        const r = yomi.tanakh929;
        yomiButtons.push({ label: hebrewMode ? "929 היום" : "Today's 929", onClick: () => jumpToYomi(r) });
      }
    }
  }

  // Header pill sizing: Hebrew labels/glyphs run visibly smaller than their English counterparts
  // at the same font size, and Hebrew mode was never actually short on toolbar width the way
  // English mode is — so Hebrew mode gets one Tailwind step larger than English. Bumped a second
  // time (2026-07-26, same session) after the user realized their browser was at 110% zoom, which
  // had made both sizes look bigger than they actually render at 100% — English now sits where
  // Hebrew used to (px-3 py-1.5 text-sm) and Hebrew moved another step up (px-4 py-2 text-base).
  // Both full class strings must appear literally (not built via template interpolation) for
  // Tailwind's JIT scanner to pick them up.
  const tabsContainerClass = hebrewMode
    ? "flex shrink-0 overflow-hidden rounded-full border border-border text-base"
    : "flex shrink-0 overflow-hidden rounded-full border border-border text-sm";
  const tabButtonClass = hebrewMode ? "px-4 py-2 transition-colors" : "px-3 py-1.5 transition-colors";
  const pillButtonClass = hebrewMode
    ? "shrink-0 rounded-full border border-border px-4 py-2 text-base transition-colors hover:border-[var(--accent)]"
    : "shrink-0 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]";

  return (
    <div className="flex h-screen w-full">
      {/* Logo/title sidebar — a permanently reserved column (explicit user choice, 2026-07-26)
          rather than floating in the page's outer margin only on wide screens. This used to sit
          inside the header row itself; pulling it out means the header/toolbar below never has
          to share its row with the logo's width, so the category tabs and buttons consistently
          get the reading column's *full* width on one line, in both languages, at any viewport
          wide enough for the reading column alone. mx-auto on the reading column (below) still
          centers it within whatever space remains next to this column — flexbox respects auto
          margins on a flex-grow item for exactly this "capped-width content, centered in the
          leftover space" pattern. */}
      <div className="flex shrink-0 flex-col items-start gap-4 px-6 py-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no need for next/image */}
          <img src="/yct-logo-color.png" alt="YCT" className="yct-logo yct-logo-light" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no need for next/image */}
          <img src="/yct-logo-white.png" alt="YCT" className="yct-logo yct-logo-dark" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--accent)" }}>
            AnyTorah
          </h1>
          {/* Matches the YCT logo's own tagline color. */}
          <p className="-mt-1 text-sm italic" style={{ color: "#007cea" }}>
            Powered by YCT and Sefaria
          </p>
        </div>
      </div>

      <div
        className={`mx-auto flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-6 ${showDaf ? "max-w-[100rem]" : "max-w-7xl"}`}
      >
        {dedication && (
          <p className="mb-2 shrink-0 text-center text-sm italic" style={{ opacity: 0.55 }}>
            {formattedMessage(dedication)}
          </p>
        )}

        {/* Category tabs and the rest of the buttons are two separate flex children (not one
            cluster) in this dir-flipped, justify-between header, per explicit user request: the
            main text picker sits at the row's start edge and every other button at its end edge
            — "start"/"end" tracking dir, so English mode reads tabs-left/buttons-right and
            Hebrew mode mirrors to tabs-right/buttons-left. flex-wrap is a narrow-viewport
            fallback only — now that the logo lives in its own sidebar column (see above) instead
            of competing in this same row, tabs+buttons have the whole reading column's width to
            themselves and shouldn't need it at any reasonable desktop width. */}
        <header
          dir={hebrewMode ? "rtl" : "ltr"}
          className="mb-6 flex flex-wrap shrink-0 items-center justify-between gap-3"
        >
          <div className={tabsContainerClass}>
            {READER_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={tabButtonClass}
                style={category === c ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
              >
                {getCategoryDisplayName(c, hebrewMode)}
              </button>
            ))}
          </div>
          {/* overflow-x-auto: on a narrow viewport this group (toggles + bookmark + notebook
              buttons) can still be wider than the space left after the tabs above take their
              share of the row — scroll it internally rather than letting it overflow the page,
              same pattern the chapter-selector toolbar below already uses. */}
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
            <HebrewModeToggle on={hebrewMode} onChange={setHebrewMode} />
            <ReverseNavToggle on={reverseNavigation} onChange={setReverseNavigation} hebrewMode={hebrewMode} />
            <VerticalDivider />
            <button
              onClick={() => setBookmarkEditOpen(true)}
              aria-pressed={!!currentBookmark}
              aria-label={currentBookmark ? "Edit bookmark" : "Bookmark this location"}
              title={currentBookmark ? "Edit bookmark" : "Bookmark this location"}
              className={pillButtonClass}
              style={currentBookmark ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
            >
              {currentBookmark ? "★" : "☆"}
            </button>
            <button
              onClick={() => setBookmarkListOpen(true)}
              aria-label="View bookmarks"
              title="View bookmarks"
              className={pillButtonClass}
            >
              <BookmarkListIcon size={hebrewMode ? 19 : 16} />
            </button>
            <VerticalDivider />
            <button
              onClick={() => setNotebookOpen((o) => !o)}
              aria-pressed={notebookOpen}
              aria-label={notebookOpen ? "Close notebook" : "Open notebook"}
              title={notebookOpen ? "Close notebook" : "Open notebook"}
              className={pillButtonClass}
              style={notebookOpen ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
            >
              📓
            </button>
            <button
              onClick={() => setNotebookSearchOpen(true)}
              aria-label="Search all notebooks"
              title="Search all notebooks"
              className={pillButtonClass}
            >
              <NotebookSearchIcon size={hebrewMode ? 20 : 17} />
            </button>
            <button
              onClick={() => setHighlightsListOpen(true)}
              aria-label="View / search highlights"
              title="View / search highlights"
              className={pillButtonClass}
            >
              <HighlightSearchIcon size={hebrewMode ? 20 : 17} />
            </button>
            <VerticalDivider />
            <AccountButton pillButtonClass={pillButtonClass} hebrewMode={hebrewMode} />
          </div>
        </header>

      {/* dir on the outer toolbar itself makes the whole row a true mirror image in Hebrew mode
          (user-requested 2026-07-24, superseding the earlier "fixed macro order" design): source
          order is Tractate/chapter/amud cluster, Yomi buttons, daf-image controls, spacer, Text
          controls, Commentary controls — under dir=rtl that reads right-to-left in exactly that
          order. Each cluster below also carries its own (now redundant but harmless) matching
          dir, which still correctly mirrors that cluster's *internal* item order. */}
      <div
        dir={hebrewMode ? "rtl" : "ltr"}
        className="mb-4 flex shrink-0 flex-nowrap items-center gap-3 overflow-x-auto rounded-lg border border-border bg-card p-3"
      >
        <div dir={hebrewMode ? "rtl" : "ltr"} className="flex shrink-0 items-center gap-3">
          <select
            value={index}
            onChange={(e) => handleIndexChange(Number(e.target.value))}
            className="shrink-0 rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {groups.map((group) =>
              group.name ? (
                <optgroup key={group.name} label={group.name}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              ) : (
                group.items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))
              ),
            )}
          </select>

          <span className="shrink-0 text-sm opacity-60">{chapterUnit}</span>
          <CommitInput
            value={chapter}
            min={chapterMin}
            max={chapterMax}
            onCommit={handleChapterChange}
            labelFor={rambamChapterLabelFor}
          />
          <button
            onClick={openChapterPicker}
            aria-label={category === "shulchanArukh" || category === "tur" ? "Browse simanim" : "Browse chapters"}
            title={category === "shulchanArukh" || category === "tur" ? "Browse simanim" : "Browse chapters"}
            className="shrink-0 rounded-full border border-border px-2 py-1 text-xs opacity-70 transition-opacity hover:opacity-100"
          >
            ▾
          </button>

          {isYerushalmi && (
            <>
              <span className="shrink-0 text-sm opacity-60">:</span>
              <CommitInput
                value={halakhaValue}
                min={1}
                max={halakhaCount}
                onCommit={handleYerushalmiHalakhaChange}
              />
              <button
                onClick={() => setHalakhaPickerOpen(true)}
                aria-label="Browse halakhot"
                title="Browse halakhot"
                className="shrink-0 rounded-full border border-border px-2 py-1 text-xs opacity-70 transition-opacity hover:opacity-100"
              >
                ▾
              </button>
            </>
          )}

          {category === "talmud" && (
            <div className="flex shrink-0 overflow-hidden rounded-full border border-border text-sm">
              {(["a", "b"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setTalmudAmud(a)}
                  className="px-3 py-1.5 transition-colors"
                  style={talmudAmud === a ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
                >
                  {hebrewMode ? (a === "a" ? "א" : "ב") : a}
                </button>
              ))}
            </div>
          )}
        </div>

        {yomiButtons.length > 0 && <VerticalDivider />}
        {yomiButtons.length > 0 && (
          <div dir={hebrewMode ? "rtl" : "ltr"} className="flex shrink-0 items-center gap-2">
            {yomiButtons.map((b) => (
              <YomiButton key={b.label} label={b.label} onClick={b.onClick} />
            ))}
          </div>
        )}

        {/* Separates the Yomi buttons from the daf-image controls, in both directions — only
            when Yomi actually rendered something to separate from (yomiButtons.length > 0),
            e.g. Talmud with a Daf Yomi result loaded. */}
        {yomiButtons.length > 0 && category === "talmud" && dafImageAvailable && <VerticalDivider />}

        {category === "talmud" && dafImageAvailable && (
          <div dir={hebrewMode ? "rtl" : "ltr"} className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setShowDafImage(!showDafImage)}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]"
              style={showDafImage ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
            >
              {hebrewMode ? (showDafImage ? "הסתר דף" : "הצג דף") : showDafImage ? "Hide daf" : "Show daf"}
            </button>

            {showDaf && (
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1 py-1 text-sm">
                <span className="pl-2 text-xs opacity-60">{hebrewMode ? "דף" : "Daf"}</span>
                {(["left", "middle"] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setDafPosition(pos)}
                    className="rounded-full px-2.5 py-1 transition-colors"
                    style={
                      dafPosition === pos ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined
                    }
                  >
                    {hebrewMode ? (pos === "left" ? "שמאל" : "אמצע") : pos === "left" ? "Left" : "Middle"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />
      </div>

      <div className="flex min-h-0 flex-1">
        {showDaf && dafPosition === "left" && (
          <>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
              <DafImagePanel tractateSefariaName={talmudTractateName!} daf={chapter} side={talmudAmud} />
            </div>
            {/* Text sits to the right of this handle, so dragging right shrinks it. */}
            <ResizeHandle onDrag={(delta) => adjustNarrowWidth(-delta)} />
          </>
        )}

        <div
          className={`flex min-h-0 min-w-0 flex-col ${showDaf ? "flex-none" : "flex-1"}`}
          style={showDaf ? { width: narrowWidth } : undefined}
        >
        <div className="relative min-h-0 flex-1">
          {!chevronsOnDaf && <NavChevrons hideLeft={hideLeftChevron} hideRight={hideRightChevron} onStep={stepReading} />}
          <div ref={textContainerRef} className="h-full overflow-y-auto px-6">
          {loading && <p className="py-8 text-center text-sm opacity-60">Loading…</p>}
          {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
          {!loading && !error && data && (
            <>
              <p className="mb-4 text-xs opacity-50">{data.ref}</p>
              <div className="pb-8" style={{ display: "flex", flexDirection: "column", gap: mainSegmentGap }}>
                {data.segments.map((seg) =>
                  seg.isAmudBMarker ? (
                    <div key={seg.id} ref={amudBRef} className="flex items-center gap-3 py-2 text-xs opacity-60">
                      <div className="h-px flex-1 bg-border" />
                      עמוד ב · Amud B ({seg.markerDaf}b)
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  ) : (
                    (() => {
                      const highlight = highlightsLookup.get(anchorKey(buildAnchor("main", seg.index, 0)));
                      const markClass = highlight ? `highlight-text highlight-text-${highlight.colorIndex}` : undefined;
                      // Anchor-quote snapshot only captures whichever language(s) are actually
                      // visible under the current display mode — not both languages
                      // unconditionally — so the note editor reflects what was actually being
                      // read, not a language the reader had toggled off.
                      const quoteHe =
                        textDisplayMode === "source" || textDisplayMode === "both" ? stripAnchorHTML(seg.hebrewHTML) : "";
                      const quoteEn =
                        textDisplayMode === "translation" || textDisplayMode === "both"
                          ? stripAnchorHTML(seg.englishHTML)
                          : "";
                      return (
                        <div key={seg.id} className={`flex gap-3 ${textDisplayMode !== "translation" ? "flex-row-reverse" : ""}`}>
                          {seg.label && (
                            <span className="mt-1.5 w-5 shrink-0 text-right text-xs tabular-nums opacity-50">
                              {seg.label}
                            </span>
                          )}
                          <HighlightMark
                            className="flex-1"
                            colorIndex={highlight?.colorIndex ?? null}
                            onQuickPick={(c) => handleQuickPickHighlight(buildAnchor("main", seg.index, 0), c, quoteHe, quoteEn)}
                            onOpenEditor={() => handleOpenHighlightEditor(buildAnchor("main", seg.index, 0), quoteHe, quoteEn)}
                            onInsertToNotebook={
                              notebookOpen
                                ? () => {
                                    const isGemara = category === "talmud" || category === "yerushalmi";
                                    const segmentLabel = buildSegmentLabel(
                                      isGemara ? null : seg.label,
                                      isGemara ? seg.hebrewHTML : "",
                                      isGemara ? seg.englishHTML : "",
                                    );
                                    notebookInsertRef.current?.(
                                      buildAnchor("main", seg.index, 0, undefined, category === "talmud" ? talmudAmud : undefined, segmentLabel),
                                    );
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-start gap-1">
                              <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap: mainLineGap }}>
                                {(textDisplayMode === "source" || textDisplayMode === "both") && seg.hebrewHTML && (
                                  category === "shulchanArukh" || category === "tur" ? (
                                    // SA Hebrew carries <span class="sa-mark sa-mark-N"> spans for
                                    // its inline commentary-marker brackets (see
                                    // processedHebrewWithMarkers); Tur Hebrew carries
                                    // <sup class="dm-mark"> spans for Darkhei Moshe's reference
                                    // numbers (see processedHebrewWithTurMarkers) — everything else
                                    // in either string is plain-texted server-side, so this is safe
                                    // despite the raw HTML.
                                    <p
                                      dir="rtl"
                                      lang="he"
                                      style={{
                                        fontFamily: "var(--font-hebrew)",
                                        fontSize: mainHebrewFontPx,
                                        lineHeight: mainLineHeight,
                                      }}
                                    >
                                      <span className={markClass} dangerouslySetInnerHTML={{ __html: seg.hebrewHTML }} />
                                    </p>
                                  ) : (
                                    <p
                                      dir="rtl"
                                      lang="he"
                                      style={{
                                        fontFamily: "var(--font-hebrew)",
                                        fontSize: mainHebrewFontPx,
                                        lineHeight: mainLineHeight,
                                        whiteSpace: "pre-line",
                                      }}
                                    >
                                      <span className={markClass}>{seg.hebrewHTML}</span>
                                    </p>
                                  )
                                )}
                                {(textDisplayMode === "translation" || textDisplayMode === "both") && seg.englishHTML && (
                                  isBoldEnglishCategory ? (
                                    // Carries <span class="en-editorial"> for Sefaria's bolded
                                    // "glue" words (see processedEnglishWithBold) — everything else
                                    // in this string is plain-texted server-side, so this is safe
                                    // despite the raw HTML, matching the SA-Hebrew case above.
                                    <p
                                      className="opacity-90"
                                      style={{ fontSize: mainEnglishFontPx, lineHeight: mainLineHeight, whiteSpace: "pre-line" }}
                                    >
                                      <span className={markClass} dangerouslySetInnerHTML={{ __html: seg.englishHTML }} />
                                    </p>
                                  ) : (
                                    <p
                                      className="opacity-90"
                                      style={{ fontSize: mainEnglishFontPx, lineHeight: mainLineHeight, whiteSpace: "pre-line" }}
                                    >
                                      <span className={markClass}>{seg.englishHTML}</span>
                                    </p>
                                  )
                                )}
                              </div>
                              {highlight?.note && (
                                <span className="highlight-note-indicator shrink-0" aria-label="Has note">
                                  📝
                                </span>
                              )}
                            </div>
                          </HighlightMark>
                        </div>
                      );
                    })()
                  ),
                )}
              </div>
            </>
          )}
          </div>
        </div>
          <div
            dir={hebrewMode ? "rtl" : "ltr"}
            className="flex shrink-0 items-center gap-3 border-t border-border px-3 py-1"
          >
            <FontSizeSlider label="Text" level={mainFontSizeLevel} onChange={setMainFontSizeLevel} hebrewMode={hebrewMode} />
            <DisplayModePill mode={textDisplayMode} onChange={setTextDisplayMode} />
          </div>
        </div>

        {showDaf && dafPosition === "middle" && (
          <>
            {/* Text sits to the left of this handle, so dragging right grows it. */}
            <ResizeHandle onDrag={(delta) => adjustNarrowWidth(delta)} />
            <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
              <NavChevrons hideLeft={hideLeftChevron} hideRight={hideRightChevron} onStep={stepReading} />
              <DafImagePanel tractateSefariaName={talmudTractateName!} daf={chapter} side={talmudAmud} />
            </div>
          </>
        )}

        {/* Commentary sits to the right of this handle, so dragging right shrinks it. */}
        <ResizeHandle onDrag={(delta) => adjustCommentaryWidth(delta)} />

        <div
          className="min-h-0 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
          style={{ width: commentaryWidth }}
        >
          <CommentaryPanel
            category={category}
            index={index}
            chapter={chapter}
            displayMode={commentaryDisplayMode}
            onDisplayModeChange={setCommentaryDisplayMode}
            poolInfo={poolInfo}
            slots={slots}
            effectiveSlots={effectiveSlots}
            onSlotsChange={setSlots}
            talmudAmud={category === "talmud" ? talmudAmud : undefined}
            mainSegmentCount={category === "rambam" ? data?.segments.length : undefined}
            fontSizeLevel={commentaryFontSizeLevel}
            onFontSizeLevelChange={setCommentaryFontSizeLevel}
            hebrewMode={hebrewMode}
            halakha={isYerushalmi ? halakha : undefined}
            getHighlight={(segmentIndex, paragraphIndex, commentaryType) =>
              highlightsLookup.get(anchorKey(buildAnchor("commentary", segmentIndex, paragraphIndex, commentaryType)))
            }
            onHighlightQuickPick={(segmentIndex, paragraphIndex, commentaryType, colorIndex, heQuote, enQuote) =>
              handleQuickPickHighlight(
                buildAnchor("commentary", segmentIndex, paragraphIndex, commentaryType),
                colorIndex,
                heQuote,
                enQuote,
              )
            }
            onHighlightOpenEditor={(segmentIndex, paragraphIndex, commentaryType, heQuote, enQuote) =>
              handleOpenHighlightEditor(
                buildAnchor("commentary", segmentIndex, paragraphIndex, commentaryType),
                heQuote,
                enQuote,
              )
            }
            onInsertToNotebook={
              notebookOpen
                ? (segmentIndex, paragraphIndex, commentaryType, amud, segmentLabel) =>
                    notebookInsertRef.current?.(
                      buildAnchor("commentary", segmentIndex, paragraphIndex, commentaryType, amud, segmentLabel),
                    )
                : undefined
            }
            onActiveTypeChange={(type) => setNotebookFocusSource({ source: "commentary", commentaryType: type })}
          />
        </div>

        {notebookOpen && (
          <>
            {/* Notebook sits to the right of this handle, so dragging right shrinks it. */}
            <ResizeHandle onDrag={(delta) => adjustNotebookWidth(delta)} />
            <div
              className="min-h-0 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
              style={{ width: notebookWidth }}
            >
              <NotebookPanel
                key={notebookScopeKey(notebookScope)}
                scope={notebookScope}
                readerChapter={chapter}
                readerHalakha={isYerushalmi ? halakha : undefined}
                readerAmud={category === "talmud" ? talmudAmud : undefined}
                hebrewMode={hebrewMode}
                scopeOptions={notebookScopeOptions}
                onScopeChange={(option) =>
                  setNotebookFocusSource(
                    option.source === "commentary" && option.commentaryType
                      ? { source: "commentary", commentaryType: option.commentaryType }
                      : { source: "main" },
                  )
                }
                onNavigateToOtherScope={(otherScope) => navigateToNotebookScope(otherScope, "")}
                onNavigateAnchor={navigateToAnchor}
                onEditorReady={(insertFn) => {
                  notebookInsertRef.current = insertFn;
                }}
                onClose={() => setNotebookOpen(false)}
                initialSearchTerm={notebookSearchSeed || undefined}
                onInitialSearchConsumed={() => setNotebookSearchSeed("")}
              />
            </div>
          </>
        )}
      </div>

      {simanPickerOpen && (category === "shulchanArukh" || category === "tur") && (
        <SASimanPicker
          section={index}
          currentSiman={chapter}
          onSelect={(siman) => {
            handleChapterChange(siman);
            setSimanPickerOpen(false);
          }}
          onClose={() => setSimanPickerOpen(false)}
          hebrewMode={hebrewMode}
        />
      )}

      {numberPickerOpen && (
        <NumberPickerModal
          min={chapterMin}
          max={chapterMax}
          current={chapter}
          label={hebrewMode ? `בחר ${chapterUnit}` : `Select ${chapterUnit}`}
          onSelect={(n) => {
            handleChapterChange(n);
            setNumberPickerOpen(false);
          }}
          onClose={() => setNumberPickerOpen(false)}
          hebrewMode={hebrewMode}
          labelFor={rambamChapterLabelFor}
        />
      )}

      {halakhaPickerOpen && (
        <NumberPickerModal
          min={1}
          max={halakhaCount}
          current={halakhaValue}
          label={hebrewMode ? "בחר הלכה" : "Select halakha"}
          onSelect={(n) => {
            handleYerushalmiHalakhaChange(n);
            setHalakhaPickerOpen(false);
          }}
          onClose={() => setHalakhaPickerOpen(false)}
          hebrewMode={hebrewMode}
        />
      )}

      {bookmarkEditOpen && (
        <BookmarkEditModal
          existing={currentBookmark ?? null}
          defaultName={buildDisplayTitle(category, index, chapter, halakha)}
          subtitle={buildSubtitle(category, index, chapter, halakha)}
          onSave={handleSaveBookmark}
          onDelete={() => currentBookmark && handleDeleteBookmark(currentBookmark)}
          onClose={() => setBookmarkEditOpen(false)}
        />
      )}

      {bookmarkListOpen && (
        <BookmarkListModal
          bookmarks={bookmarks}
          onNavigate={handleNavigateBookmark}
          onDelete={handleDeleteBookmark}
          onClose={() => setBookmarkListOpen(false)}
        />
      )}

      {highlightEditorAnchor && (
        <HighlightEditModal
          existing={findHighlight(highlights, highlightEditorAnchor) ?? null}
          anchorQuoteHe={highlightEditorQuote.he}
          anchorQuoteEn={highlightEditorQuote.en}
          onSave={handleSaveHighlightFromEditor}
          onDelete={handleDeleteHighlightFromEditor}
          onClose={() => setHighlightEditorAnchor(null)}
        />
      )}

      {highlightsListOpen && (
        <HighlightsListModal
          highlights={highlights}
          onNavigate={handleNavigateHighlight}
          onDelete={(h) => handleDeleteHighlightAt(h.anchor)}
          onClose={() => setHighlightsListOpen(false)}
        />
      )}

      {notebookSearchOpen && (
        <NotebookSearchModal
          highlights={highlights}
          onNavigate={(notebook, seedQuery) => navigateToNotebookScope(notebook.scope, seedQuery)}
          onNavigateHighlight={(h) => {
            handleNavigateHighlight(h);
            setNotebookSearchOpen(false);
          }}
          onClose={() => setNotebookSearchOpen(false)}
        />
      )}

      <DedicationBanner />
      </div>
    </div>
  );
}
