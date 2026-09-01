"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TextDisplayMode, TextSegment, SATextMode } from "@/lib/textModels";
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
import ReferencePanel from "@/components/ReferencePanel";
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
import { useMercavaUrl } from "@/lib/mercava";
import {
  saveBookmarks,
  loadAndReconcileBookmarks,
  findBookmark,
  buildDisplayTitle,
  buildSubtitle,
  type Bookmark,
} from "@/lib/bookmarks";
import type { YomiToday, YomiResult } from "@/lib/yomiService";
import { toHebrewNumeral, teshuvotWork, teshuvotMaxSiman } from "@/lib/textModels";
import { saveHighlights, loadAndReconcileHighlights, findHighlight, type Highlight } from "@/lib/highlights";
import { anchorKey, stripAnchorHTML, buildSegmentLabel, type TextAnchor } from "@/lib/textAnchor";
import HighlightMark from "@/components/HighlightMark";
import HighlightEditModal from "@/components/HighlightEditModal";
import HighlightsListModal from "@/components/HighlightsListModal";
import NotebookPanel from "@/components/NotebookPanel";
import NotebookPickerModal from "@/components/NotebookPickerModal";
import NotebookSearchModal from "@/components/NotebookSearchModal";
import SourceSheetModal from "@/components/SourceSheetModal";
import { createNotebook, loadAndReconcileNotebooks, type Notebook, type NotebookScope } from "@/lib/notebooks";
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
  ["tanakh", "mishnah", "tosefta", "talmud", "yerushalmi", "rambam", "tur", "shulchanArukh", "teshuvot"];

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

// Shared by the Mercava popup and the "Side by side" pop-out button so the two windows they open
// tile exactly against each other with no gap or overlap — capped at 560px so the popup stays a
// sane width on very wide/ultrawide screens rather than ballooning to 42% of it.
function mercavaPopupWidth(): number {
  return Math.min(560, Math.round(window.screen.availWidth * 0.42));
}

// Full window-features list for both the Mercava popup and the "side by side" pop-out, not just
// width/height/left/top. Chrome recognizes the explicit `popup=1` flag (and otherwise infers
// "real window, not a tab" reasonably well from size/position alone); Safari has no equivalent
// flag, and whether it opens a genuinely separate positioned window rather than a new tab is
// ultimately governed by the user's own Safari > Settings > Tabs > "Open pages in tabs instead
// of in new windows" preference — a page can't force this if that's set to "Always" — but the
// full "no browser chrome" feature list here is still the strongest signal a page can give it.
function popupFeatures(opts: { width: number; height: number; left: number; top: number }): string {
  return `width=${opts.width},height=${opts.height},left=${opts.left},top=${opts.top},popup=1,toolbar=no,location=no,menubar=no,status=no,resizable=yes,scrollbars=yes`;
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

// Shulchan Arukh main-text edition — see SATextMode in lib/textModels.ts for why this is an
// either/or choice rather than a rendering option: Sefaria has no edition with both nikud and
// the inline commentary-marker tags, so "nikud" trades away the main-text brackets.
const SA_TEXT_MODE_KEY = "anytorah:saTextMode";

function loadSATextMode(): SATextMode {
  if (typeof window === "undefined") return "commentary";
  try {
    return window.localStorage.getItem(SA_TEXT_MODE_KEY) === "nikud" ? "nikud" : "commentary";
  } catch {
    return "commentary";
  }
}

function storeSATextMode(mode: SATextMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SA_TEXT_MODE_KEY, mode);
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

// Reference/text panel (Teshuvot only) — a second, independent mini-reader for pulling up a
// text being cited (a pasuk, a Shulchan Arukh siman, etc.) alongside the teshuvah, without
// leaving it. Only exists for Teshuvot because that's the one category with no commentary panel
// occupying the freed-up width; see ReferencePanel.tsx for the panel itself. Always docks on the
// left (no position choice — kept deliberately simple per explicit user request).
const REF_PANEL_OPEN_KEY = "anytorah:refPanelOpen";
const REF_PANEL_WIDTH_KEY = "anytorah:refPanelWidth";
const REF_PANEL_WIDTH_DEFAULT = 420;

function loadRefPanelOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REF_PANEL_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function storeRefPanelOpen(open: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REF_PANEL_OPEN_KEY, open ? "1" : "0");
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — toggle just won't persist.
  }
}

// Notebook "pop out" — floats the panel in a draggable/resizable window instead of docking it
// in-flow. Position/size are independent of notebookWidth (the docked width), since a floated
// window also has a height and screen coordinates the docked layout has no concept of.
const NOTEBOOK_FLOATING_KEY = "anytorah:notebookFloating";
const NOTEBOOK_FLOAT_RECT_KEY = "anytorah:notebookFloatRect";
const NOTEBOOK_FLOAT_HEIGHT_DEFAULT = 560;
const NOTEBOOK_FLOAT_HEIGHT_MIN = 240;
const NOTEBOOK_FLOAT_HEIGHT_MAX = 1000;

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

type NotebookFloatRect = { x: number; y: number; width: number; height: number };

function loadNotebookFloating(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NOTEBOOK_FLOATING_KEY) === "1";
  } catch {
    return false;
  }
}

function storeNotebookFloating(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTEBOOK_FLOATING_KEY, on ? "1" : "0");
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — toggle just won't persist.
  }
}

/** Default float position hugs the top-right of the viewport, clear of the header toolbar. */
function defaultNotebookFloatRect(): NotebookFloatRect {
  const width = NOTEBOOK_WIDTH_DEFAULT;
  const height = NOTEBOOK_FLOAT_HEIGHT_DEFAULT;
  if (typeof window === "undefined") return { x: 80, y: 80, width, height };
  return { x: clamp(window.innerWidth - width - 32, 16, window.innerWidth - width - 16), y: 88, width, height };
}

function loadNotebookFloatRect(): NotebookFloatRect {
  const fallback = defaultNotebookFloatRect();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(NOTEBOOK_FLOAT_RECT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<NotebookFloatRect>;
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      return {
        x: parsed.x,
        y: parsed.y,
        width: clamp(parsed.width, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX),
        height: clamp(parsed.height, NOTEBOOK_FLOAT_HEIGHT_MIN, NOTEBOOK_FLOAT_HEIGHT_MAX),
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function storeNotebookFloatRect(rect: NotebookFloatRect) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTEBOOK_FLOAT_RECT_KEY, JSON.stringify(rect));
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — position/size just won't persist.
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

/** Floating, draggable, resizable wrapper used when the notebook is popped out of the docked
 *  layout. Position/size are lifted to the caller (same controlled pattern as notebookWidth)
 *  rather than owned locally, so Reader.tsx can persist them the same way it persists panel
 *  widths — one localStorage write per drag tick, matching adjustNotebookWidth's own convention.
 *  Drag/resize math is computed from the pointer's total delta since mousedown against a
 *  snapshotted starting rect, not accumulated per-move like ResizeHandle — safer for 2D dragging,
 *  where small per-tick rounding could otherwise drift the window off the cursor over time. */
function FloatingNotebookWindow({
  rect,
  onRectChange,
  children,
}: {
  rect: NotebookFloatRect;
  onRectChange: (rect: NotebookFloatRect) => void;
  children: React.ReactNode;
}) {
  const dragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startRect: NotebookFloatRect } | null>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.mode === "move") {
        // Keep at least a corner's worth of the title bar reachable on every edge, so a window
        // dragged mostly off-screen can always be dragged back.
        onRectChange({
          ...drag.startRect,
          x: clamp(drag.startRect.x + dx, 80 - drag.startRect.width, window.innerWidth - 80),
          y: clamp(drag.startRect.y + dy, 0, window.innerHeight - 40),
        });
      } else {
        onRectChange({
          ...drag.startRect,
          width: clamp(drag.startRect.width + dx, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX),
          height: clamp(drag.startRect.height + dy, NOTEBOOK_FLOAT_HEIGHT_MIN, NOTEBOOK_FLOAT_HEIGHT_MAX),
        });
      }
    }
    function handleUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onRectChange]);

  return (
    <div
      style={{ position: "fixed", left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: 40 }}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, startRect: rect };
        }}
        role="separator"
        aria-label="Drag to move notebook window"
        className="flex shrink-0 cursor-move items-center justify-center gap-1 border-b border-border bg-[var(--muted)] py-1 text-muted-foreground select-none"
      >
        <span aria-hidden className="text-[10px] tracking-[0.2em]">
          ⋮⋮⋮⋮⋮⋮
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragRef.current = { mode: "resize", startX: e.clientX, startY: e.clientY, startRect: rect };
        }}
        role="separator"
        aria-label="Drag to resize notebook window"
        className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 cursor-nwse-resize opacity-50 hover:opacity-100"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--border) 0px, var(--border) 1.5px, transparent 1.5px, transparent 4px)",
        }}
      />
    </div>
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

/** Classic "opens in a new window" glyph (box + escaping arrow) — the Mercava popup button. */
function PopoutWindowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
    </svg>
  );
}

/** Two side-by-side rounded columns — the "position windows side by side" button. */
function SideBySideIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="8" height="16" rx="1.3" />
      <rect x="13.5" y="4" width="8" height="16" rx="1.3" />
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

type Selection = Record<
  ReaderCategory,
  { index: number; chapter: number; halakha?: number; /** Teshuvot only — 1-based volume/part/klal position. */ volume?: number }
>;

const INITIAL_SELECTION: Selection = {
  tanakh: { index: 0, chapter: 1 },
  mishnah: { index: 0, chapter: 1 },
  tosefta: { index: 0, chapter: 1 },
  talmud: { index: 0, chapter: getChapterMin("talmud", 0) },
  yerushalmi: { index: 0, chapter: 1, halakha: 1 },
  rambam: { index: 0, chapter: getChapterMin("rambam", 0) },
  tur: { index: 0, chapter: 1 },
  shulchanArukh: { index: 0, chapter: 1 },
  teshuvot: { index: 0, chapter: 1, volume: 1 },
};

// Reads a position (category/index/chapter/halakha/amud) encoded in the URL's query string by
// openSideBySide (Reader body, near the Mercava buttons) — this app has no URL-based routing for
// ordinary browsing (position lives in plain React state, never the address bar), so this query
// string exists solely to hand a position from one window to a newly popped-out one, not as a
// general permalink feature. Returns null for a normal load (no query string, or anything
// malformed), which falls through to the usual Tanakh/Bereishit default.
function readInitialPositionFromURL(): {
  category: ReaderCategory;
  index: number;
  chapter: number;
  halakha?: number;
  amud: "a" | "b";
} | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  if (!category || !(category in INITIAL_SELECTION)) return null;
  const index = Number(params.get("index"));
  const chapter = Number(params.get("chapter"));
  if (!Number.isFinite(index) || !Number.isFinite(chapter)) return null;
  const halakhaRaw = params.get("halakha") != null ? Number(params.get("halakha")) : undefined;
  return {
    category: category as ReaderCategory,
    index,
    chapter,
    halakha: halakhaRaw != null && Number.isFinite(halakhaRaw) ? halakhaRaw : undefined,
    amud: params.get("amud") === "b" ? "b" : "a",
  };
}

export default function Reader() {
  // Captured once, synchronously, during this component's very first render call — a plain
  // `useRef` initializer, not `useState`, specifically because a ref's value is never compared
  // during hydration (only rendered DOM/JSX output is), so it's safe for this to differ between
  // the server's render (no `window`, always null) and the client's (the real URL). See the
  // position-restore layout effect below for why the actual category/selection/talmudAmud state
  // deliberately does NOT read this at initializer time anymore.
  const initialPositionRef = useRef(readInitialPositionFromURL());
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

  const { index, chapter, halakha, volume } = selection[category];
  const groups = useMemo(() => getCategoryGroups(category, hebrewMode), [category, hebrewMode]);
  const chapterMin = getChapterMin(category, index);
  // Teshuvot's siman ceiling depends on which volume/part/klal is selected, not just the work —
  // getChapterMax (shared across every category) has no volume dimension, so this overrides it
  // for just this one category rather than widening that generic function's signature.
  const volumeValue = volume ?? 1;
  const chapterMax = category === "teshuvot" ? teshuvotMaxSiman(index, volumeValue) : getChapterMax(category, index);
  const chapterUnit = getChapterUnitLabel(category, hebrewMode);
  const currentTeshuvotWork = category === "teshuvot" ? teshuvotWork(index) : null;

  // Scanned daf image — shown as its own column alongside the digital text (Talmud only).
  const [talmudPages, setTalmudPages] = useState<TalmudPages | null>(null);
  const [showDafImage, setShowDafImageState] = useState(false);
  useEffect(() => setShowDafImageState(loadShowDafImage()), []);

  const [saTextMode, setSaTextModeState] = useState<SATextMode>("commentary");
  useEffect(() => setSaTextModeState(loadSATextMode()), []);
  const setSaTextMode = (mode: SATextMode) => {
    setSaTextModeState(mode);
    storeSATextMode(mode);
  };
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
  const [notebookFloating, setNotebookFloatingState] = useState(false);
  const [notebookFloatRect, setNotebookFloatRectState] = useState<NotebookFloatRect>(defaultNotebookFloatRect);
  const [refPanelOpen, setRefPanelOpenState] = useState(false);
  const [refPanelWidth, setRefPanelWidthState] = useState(REF_PANEL_WIDTH_DEFAULT);
  useEffect(() => {
    setDafPositionState(loadDafPosition());
    setNarrowWidthState(loadStoredWidth(NARROW_WIDTH_KEY, NARROW_WIDTH_DEFAULT));
    setCommentaryWidthState(loadStoredWidth(COMMENTARY_WIDTH_KEY, COMMENTARY_WIDTH_DEFAULT));
    setNotebookWidthState(loadStoredWidth(NOTEBOOK_WIDTH_KEY, NOTEBOOK_WIDTH_DEFAULT));
    setNotebookFloatingState(loadNotebookFloating());
    setNotebookFloatRectState(loadNotebookFloatRect());
    setRefPanelOpenState(loadRefPanelOpen());
    setRefPanelWidthState(loadStoredWidth(REF_PANEL_WIDTH_KEY, REF_PANEL_WIDTH_DEFAULT));
  }, []);
  const setDafPosition = (pos: DafPosition) => {
    setDafPositionState(pos);
    storeDafPosition(pos);
  };
  const toggleRefPanelOpen = () => {
    setRefPanelOpenState((prev) => {
      const next = !prev;
      storeRefPanelOpen(next);
      return next;
    });
  };
  // Panel always docks on the left, so dragging the handle right (positive delta, moving into
  // the text column) always grows it — no position-dependent sign needed, unlike the commentary/
  // notebook panels on the right, which shrink when dragged in the same direction.
  const adjustRefPanelWidth = (deltaX: number) => {
    setRefPanelWidthState((w) => {
      const next = clamp(w + deltaX, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX);
      storeWidth(REF_PANEL_WIDTH_KEY, next);
      return next;
    });
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
  const toggleNotebookFloating = () => {
    setNotebookFloatingState((prev) => {
      const next = !prev;
      storeNotebookFloating(next);
      // Re-clamp into the current viewport on pop-out — the stored rect may date from a wider
      // browser window and could otherwise open mostly or entirely off-screen.
      if (next) {
        setNotebookFloatRectState((rect) => {
          const clamped: NotebookFloatRect = {
            ...rect,
            x: clamp(rect.x, 0, Math.max(0, window.innerWidth - rect.width)),
            y: clamp(rect.y, 0, Math.max(0, window.innerHeight - 40)),
          };
          storeNotebookFloatRect(clamped);
          return clamped;
        });
      }
      return next;
    });
  };
  const handleNotebookFloatRectChange = (rect: NotebookFloatRect) => {
    setNotebookFloatRectState(rect);
    storeNotebookFloatRect(rect);
  };

  const handleIndexChange = (id: number) => {
    setSelection((s) => ({
      ...s,
      [category]: {
        index: id,
        chapter: getChapterMin(category, id),
        halakha: category === "yerushalmi" ? 1 : undefined,
        volume: category === "teshuvot" ? 1 : undefined,
      },
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
  // Teshuvot only — changing volume/part/klal resets siman to 1, since each volume has its own
  // siman range (mirrors handleIndexChange's chapter reset on a work change).
  const handleTeshuvotVolumeChange = useCallback((v: number) => {
    setSelection((s) => ({ ...s, teshuvot: { ...s.teshuvot, volume: v, chapter: 1 } }));
  }, []);
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
  const saTextModeQuery = category === "shulchanArukh" && saTextMode === "nikud" ? "&saTextMode=nikud" : "";
  const volumeQuery = category === "teshuvot" ? `&volume=${volumeValue}` : "";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const commentariesQuery = commentariesKey ? `&commentaries=${commentariesKey}` : "";
    fetch(
      `/api/chapter?category=${fetchCategory}&index=${index}&chapter=${chapter}${commentariesQuery}${subcategoryQuery}${halakhaQuery}${saTextModeQuery}${volumeQuery}`,
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
  }, [fetchCategory, index, chapter, commentariesKey, subcategoryQuery, halakhaQuery, saTextModeQuery, volumeQuery]);

  // Talmud amud a/b jump — scroll-only (both amudim are always loaded together). Resets to
  // "a" on every new daf/tractate/category, matching the expectation that a daf opens at 2a —
  // except when stepBackward() below crosses a daf boundary, where it should land on the
  // *previous* daf's amud b instead; skipAmudResetRef lets that one case suppress this reset.
  const [talmudAmud, setTalmudAmud] = useState<"a" | "b">(() => getStartAmud(category, index, chapter));
  const mercavaUrl = useMercavaUrl(category === "talmud" ? talmudTractateName ?? null : null, chapter, talmudAmud);
  // Popup window (not a plain new-tab link) so it can be parked side by side with this reader,
  // and — the actual point of keeping this reference around — so subsequent daf navigation can
  // silently retarget it to the new daf via `.location.href` instead of requiring the user to
  // click "Mercava" again every time. A window you already opened can be navigated without a
  // fresh user gesture, even cross-origin, so this doesn't hit popup-blocker restrictions the way
  // a bare `window.open()` on every navigation would.
  const mercavaWindowRef = useRef<Window | null>(null);
  // Opens the Mercava popup if it isn't already open (or retargets it to the current daf if it
  // is), returning the window so a caller can focus it. Shared by openOrFocusMercava and
  // openSideBySide below — factored out after a real bug: openSideBySide used to only ever
  // *refocus* an existing mercavaWindowRef, so if the user hit "side by side" without having
  // opened Mercava first, no Mercava window existed at all and only the AnyTorah window opened.
  const openOrRetargetMercava = useCallback((): Window | null => {
    if (!mercavaUrl) return null;
    if (mercavaWindowRef.current && !mercavaWindowRef.current.closed) {
      mercavaWindowRef.current.location.href = mercavaUrl;
      return mercavaWindowRef.current;
    }
    // Dock the popup to the right edge of the screen (full height) rather than centering it, so
    // it lands somewhere that doesn't sit directly on top of a full-width main window. There's no
    // web API for a real "always on top" window, and a page can't resize/move the browser window
    // it's running in (only a window it opened itself) — so true side-by-side still needs the main
    // window to occupy roughly the left `mercavaPopupWidth()`-complement of the screen, which the
    // "Side by side" button below sets up in one click. Because navigation after the first open
    // only ever reassigns `.location.href` (never re-opens/re-positions), the popup keeps whatever
    // spot it's given here across every subsequent daf change.
    const popupWidth = mercavaPopupWidth();
    const left = window.screen.availWidth - popupWidth;
    mercavaWindowRef.current = window.open(
      mercavaUrl,
      "anytorah-mercava",
      popupFeatures({ width: popupWidth, height: window.screen.availHeight, left, top: 0 }),
    );
    return mercavaWindowRef.current;
  }, [mercavaUrl]);
  const openOrFocusMercava = useCallback(() => {
    openOrRetargetMercava()?.focus();
  }, [openOrRetargetMercava]);
  useEffect(() => {
    if (mercavaUrl && mercavaWindowRef.current && !mercavaWindowRef.current.closed) {
      mercavaWindowRef.current.location.href = mercavaUrl;
    }
  }, [mercavaUrl]);
  // Re-opens *this* page in a new window sized/positioned to exactly fill the screen's left
  // complement of the Mercava popup's own right-docked width — so a user who wants true
  // side-by-side viewing doesn't have to eyeball a manual drag/resize first. This intentionally
  // doesn't also auto-open Mercava from here: the new window runs its own separate React instance
  // (a real `window.open` navigation, not a DOM move), so `mercavaWindowRef` above would belong to
  // the wrong instance if popped from here — clicking "Mercava" from inside the new window instead
  // keeps the popup's auto-sync tied to whichever window the user actually keeps navigating in.
  //
  // Four real bugs fixed here, all reported directly after trying this on real devices/browsers,
  // not just in dev-time testing: (1) the target URL used to be plain `window.location.href` —
  // since this app has no URL-based routing at all (position lives in React state, never the
  // address bar), that always opened the bare root URL, landing the new window on the
  // Tanakh/Bereishit default instead of wherever the user actually was. Now the current position
  // (category/index/chapter/halakha/amud) is encoded into the new window's URL as a query string,
  // read back out by readInitialPositionFromURL above — a one-off hand-off mechanism, not a
  // general permalink feature. (2) This used to only ever *refocus* an already-open Mercava
  // popup, never open one — so clicking "side by side" before ever clicking "Mercava" opened only
  // the AnyTorah window, with no Mercava window at all. (3) Real Chrome and Safari both allow only
  // ONE brand-new popup per click — a second `window.open()` call in the same handler is silently
  // blocked, returning null. Fixing (2) by unconditionally calling openOrRetargetMercava() *before*
  // opening the AnyTorah window ran straight into this: Mercava (called first) opened, and the
  // AnyTorah window (called second) silently didn't — the exact opposite of what a user actually
  // needs from this button, since the AnyTorah window is the one only this button can produce.
  // Opening AnyTorah *first* fixes that: it's now the guaranteed-successful popup, and Mercava
  // becomes best-effort second. This isn't a regression for the case that matters most in
  // practice, either — if Mercava is *already* open, openOrRetargetMercava never calls
  // `window.open()` at all (see its own comment above); it just reassigns `.location.href` on a
  // window reference this code already holds, which is a plain navigation, not a new popup, so
  // it's completely unaffected by the one-popup-per-click limit and always succeeds. Only the
  // genuinely-cold-start case (neither window open yet) can still lose Mercava to this limit, and
  // even then the user can just click "Mercava" once more (in either window) to get it. (4)
  // Opening (and thus focusing) the AnyTorah window pushes any already-open Mercava popup behind
  // it, defeating the whole point of "side by side" — a plain synchronous `.focus()` call right
  // after `window.open()` reliably lost that race (the browser processes the just-opened window's
  // own focus after this function returns, so the synchronous focus() ran first and was then
  // overridden). Deferring the refocus with a `setTimeout` lets it run after that, so Mercava
  // reliably ends up on top.
  const openSideBySide = useCallback(() => {
    const params = new URLSearchParams({ category, index: String(index), chapter: String(chapter) });
    if (halakha != null) params.set("halakha", String(halakha));
    if (category === "talmud") params.set("amud", talmudAmud);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const leftWidth = window.screen.availWidth - mercavaPopupWidth();
    window.open(
      url,
      "anytorah-main",
      popupFeatures({ width: leftWidth, height: window.screen.availHeight, left: 0, top: 0 }),
    );

    const mercavaWin = openOrRetargetMercava();
    if (mercavaWin && !mercavaWin.closed) {
      setTimeout(() => {
        if (!mercavaWin.closed) mercavaWin.focus();
      }, 150);
    }
  }, [openOrRetargetMercava, category, index, chapter, halakha, talmudAmud]);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const amudBRef = useRef<HTMLDivElement>(null);
  // One-shot escape hatch for stepReading's daf-boundary-crossing case just below: it needs the
  // *next* run of the reset effect (only that one) suppressed so a step back across a daf boundary
  // can land on the previous daf's amud "b" instead of the effect immediately resetting it to "a".
  const skipAmudResetRef = useRef(false);
  // Applies a URL-encoded position hand-off (see readInitialPositionFromURL/initialPositionRef
  // above) once, after mount, instead of in the state initializers directly. It used to live in
  // the initializers, which made the very first *client* render differ from the server-rendered
  // one — the server has no `window` to read a query string from, so it always rendered the
  // Tanakh/Bereishit default, while a real position hand-off produced a completely different tree
  // (different category tab, different commentary set, etc.) on the client, tripping a hard React
  // hydration-mismatch error (and a full client-side remount to recover) on every "Side by side"
  // pop-out — a real bug found while testing this. Restoring the position here instead means the
  // server and the client's first render/hydration always agree (the plain default), and this
  // effect's state updates are then just an ordinary post-hydration update, no mismatch.
  // `useLayoutEffect` (not `useEffect`) so the restored position is in place before the browser
  // paints, avoiding a visible flash of the wrong daf in the newly-opened window.
  useLayoutEffect(() => {
    const pos = initialPositionRef.current;
    if (!pos) return;
    skipAmudResetRef.current = true;
    setCategory(pos.category);
    setSelection((s) => ({
      ...s,
      [pos.category]: { index: pos.index, chapter: pos.chapter, ...(pos.halakha != null ? { halakha: pos.halakha } : {}) },
    }));
    setTalmudAmud(pos.amud);
  }, []);
  // Below: resets talmudAmud to "a" on every new daf/tractate/category, matching the expectation
  // that a daf opens at 2a — except when (a) stepBackward() crosses a daf boundary, where it
  // should land on the *previous* daf's amud b instead (skipAmudResetRef above suppresses that one
  // case), or (b) the position-restore effect above just set category/index/chapter to match a URL
  // hand-off, where the explicit amud it also just set must not be immediately stomped back to "a"
  // (skipAmudResetRef covers this too; the `initial` comparison below is a second, redundant guard
  // for the same case — a real bug hit here before while this same logic lived directly in
  // talmudAmud's initializer: a one-shot *consumable* flag alone doesn't survive React StrictMode's
  // dev-only double-invoke of a fresh effect, mount → cleanup → mount again, since the first
  // invocation consumes the flag and the second sees it already cleared. Comparing against the
  // captured initial position is idempotent across repeated invocations with the same deps, so it
  // survives that double-invoke naturally, while a genuine later navigation — deps actually change
  // to something that doesn't match the initial hand-off — still resets normally).
  useEffect(() => {
    if (skipAmudResetRef.current) {
      skipAmudResetRef.current = false;
      return;
    }
    const initial = initialPositionRef.current;
    if (initial && initial.category === category && initial.index === index && initial.chapter === chapter) {
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

  // Notebooks — user-named, long-form rich-text documents (any number, at most loosely tied to a
  // book/commentary), with embedded anchor pills that jump the reader here. Side panel, not a
  // modal, so the user can click a paragraph in the reader while the notebook stays open (see
  // HighlightMark's onInsertToNotebook / CommentaryPanel's mirror of it). See lib/notebooks.ts's
  // module comment for the full "identity vs. scope" story — pinnedNotebookId is the single source
  // of truth for which notebook (if any) is open, and it never changes on its own as the reader
  // navigates elsewhere; only an explicit switch (the 📓 header button's picker below, or the
  // panel's own switch dropdown) changes it.
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  useEffect(() => {
    loadAndReconcileNotebooks().then(setNotebooks);
  }, [user?.id]);
  const [pinnedNotebookId, setPinnedNotebookId] = useState<string | null>(null);
  const notebookOpen = pinnedNotebookId !== null;
  const [notebookPickerOpen, setNotebookPickerOpen] = useState(false);

  // "Reading focus" — purely a hint for NotebookPickerModal's quick-create options and both
  // pickers' prominence ranking (rankNotebooksByProminence): which scope to default a *new*
  // notebook to, and which existing notebooks to rank first. Never triggers opening or switching a
  // notebook on its own. Set by CommentaryPanel's onActiveTypeChange, which fires on mount and
  // whenever its own activeType value actually changes — but NOT on a book/tractate change where
  // the same commentary type remains active (e.g. Rashi stays Rashi across a Bereshit→Bamidbar
  // switch): React bails out of re-running an effect whose dependency's value didn't change, so no
  // fresh notification arrives in that case even though the book did change under it.
  //
  // Real bug fixed here (reported live): this used to unconditionally reset to "main" on every
  // [category, index] change, on the theory that "a commentary focus from a previous book isn't
  // meaningful once category/index moves on." That's true when the commentary genuinely isn't
  // available in the new book, but false — and was firing anyway — when it stayed the same
  // commentary across the switch, since CommentaryPanel had no reason to re-notify. Net effect: a
  // book/chapter switch while reading a specific commentary silently dropped back to "main" and the
  // picker only ever offered the book-level option, not the commentary one, unless the user
  // happened to re-click a commentary tab immediately beforehand. Fixed by only resetting when the
  // current focus's commentaryType is no longer among the new book's effectiveSlots at all —
  // otherwise the existing focus (however it got set) is left alone. React runs a child's effects
  // before its parent's in the same commit, so if CommentaryPanel's own effect *does* fire this
  // render (a genuine fallback to a different commentary), this effect's functional updater sees
  // that fresher value first and correctly finds it already valid.
  type ReadingFocus = { source: "main" } | { source: "commentary"; commentaryType: CommentaryType };
  const [readingFocus, setReadingFocus] = useState<ReadingFocus>({ source: "main" });
  useEffect(() => {
    setReadingFocus((prev) =>
      prev.source === "commentary" && !effectiveSlots.includes(prev.commentaryType) ? { source: "main" } : prev,
    );
  }, [category, index, effectiveSlots]);

  const currentReaderScope: NotebookScope = useMemo(
    () =>
      readingFocus.source === "commentary"
        ? { category, index, source: "commentary", commentaryType: readingFocus.commentaryType }
        : { category, index, source: "main" },
    [category, index, readingFocus],
  );

  const notebookInsertRef = useRef<((anchor: TextAnchor, quoteHe?: string, quoteEn?: string) => void) | null>(null);
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

  // NotebookPickerModal's two actions — pin an existing notebook open, or create a brand-new one
  // (fixed scope from here on — see Notebook.scope's own doc comment) and pin that instead.
  const handleSelectNotebook = useCallback((id: string) => {
    setPinnedNotebookId(id);
    setNotebookPickerOpen(false);
  }, [setPinnedNotebookId, setNotebookPickerOpen]);
  const handleCreateNotebook = useCallback((name: string, scope: NotebookScope | undefined) => {
    const notebook = createNotebook(name, scope);
    setNotebooks((list) => [...list, notebook]);
    setPinnedNotebookId(notebook.id);
    setNotebookPickerOpen(false);
  }, [setNotebooks, setPinnedNotebookId, setNotebookPickerOpen]);

  // Cross-notebook search result → just pin that notebook open and seed its find bar. No reader
  // navigation — unlike the old scope-based model, a notebook isn't tied to one place in the
  // reader, so there's no single "right" book/chapter to jump to just because a search hit lives
  // in this notebook.
  const openNotebookFromSearch = useCallback((id: string, seedSearchTerm: string) => {
    setPinnedNotebookId(id);
    setNotebookSearchSeed(seedSearchTerm);
    setNotebookSearchOpen(false);
  }, [setPinnedNotebookId, setNotebookSearchSeed, setNotebookSearchOpen]);

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);

  // Source Sheet entry → jump the reader to the anchor's own exact chapter/halakha and pin
  // whichever notebook that anchor actually lives in — the panel's reverse-sync effect then
  // scroll+flashes the specific anchor for free once it's open at that chapter.
  const navigateToNotebookAnchor = useCallback((anchor: TextAnchor, notebookId: string) => {
    setCategory(anchor.category);
    setSelection((s) => ({
      ...s,
      [anchor.category]: { index: anchor.index, chapter: anchor.chapter, halakha: anchor.halakha },
    }));
    setPinnedNotebookId(notebookId);
    setSourceSheetOpen(false);
  }, [setCategory, setSelection, setPinnedNotebookId, setSourceSheetOpen]);

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

  // Shared JSX between the docked (in-flow) and floating (popped-out) notebook renderings below,
  // so the two branches don't duplicate this whole prop list. Toggling notebookFloating still
  // remounts NotebookPanel (its wrapper's position in the tree changes), but that's harmless —
  // it reloads its own content on mount and autosaves on every edit, same as switching notebooks
  // does. null whenever nothing's pinned open — both render branches below are already gated on
  // notebookOpen, so this is only ever read once pinnedNotebookId is a real id.
  const notebookPanelElement = pinnedNotebookId ? (
    <NotebookPanel
      key={pinnedNotebookId}
      notebookId={pinnedNotebookId}
      allNotebooks={notebooks}
      currentScope={currentReaderScope}
      readerChapter={chapter}
      readerHalakha={isYerushalmi ? halakha : undefined}
      readerAmud={category === "talmud" ? talmudAmud : undefined}
      hebrewMode={hebrewMode}
      onSwitchNotebook={setPinnedNotebookId}
      onNavigateAnchor={navigateToAnchor}
      onEditorReady={(insertFn) => {
        notebookInsertRef.current = insertFn;
      }}
      onClose={() => setPinnedNotebookId(null)}
      initialSearchTerm={notebookSearchSeed || undefined}
      onInitialSearchConsumed={() => setNotebookSearchSeed("")}
      isFloating={notebookFloating}
      onToggleFloating={toggleNotebookFloating}
    />
  ) : null;

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
          <div className="flex flex-wrap items-center gap-3">
            <div className={tabsContainerClass}>
              {READER_CATEGORIES.filter((c) => c !== "teshuvot").map((c) => (
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
            {/* Teshuvot gets its own labeled group, separate from the main category capsule — it's
                conceptually a sibling tier (Rishonim/Acharonim/Contemporary), not just another book
                category. Only Rishonim is wired up so far; the other two render disabled, matching
                native's own "future era, not built yet" placeholder pattern for this exact feature. */}
            <VerticalDivider />
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold">{hebrewMode ? "שו״ת" : "Teshuvot"}</span>
              <div className={tabsContainerClass}>
                <button
                  onClick={() => setCategory("teshuvot")}
                  className={tabButtonClass}
                  style={category === "teshuvot" ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
                >
                  {hebrewMode ? "ראשונים" : "Rishonim"}
                </button>
                <button disabled title="Coming soon" className={`${tabButtonClass} cursor-not-allowed opacity-40`}>
                  {hebrewMode ? "אחרונים" : "Acharonim"}
                </button>
                <button disabled title="Coming soon" className={`${tabButtonClass} cursor-not-allowed opacity-40`}>
                  {hebrewMode ? "בני זמננו" : "Contemporary"}
                </button>
              </div>
            </div>
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
              onClick={() => setNotebookPickerOpen(true)}
              aria-pressed={notebookOpen}
              aria-label="Choose a notebook"
              title="Choose a notebook"
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
            <button
              onClick={() => setSourceSheetOpen(true)}
              aria-label="Build a source sheet"
              title="Build a source sheet"
              className={pillButtonClass}
            >
              📄
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

          {currentTeshuvotWork?.volumeLabel && (
            <select
              value={volumeValue}
              onChange={(e) => handleTeshuvotVolumeChange(Number(e.target.value))}
              className="shrink-0 rounded border border-border bg-background px-2 py-1 text-sm"
            >
              {currentTeshuvotWork.volumes.map((v, i) => (
                <option key={v.label} value={i + 1}>
                  {hebrewMode ? currentTeshuvotWork.volumeLabelHebrew : currentTeshuvotWork.volumeLabel} {hebrewMode ? v.hebrewLabel : v.label}
                </option>
              ))}
            </select>
          )}

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

        {category === "teshuvot" && <VerticalDivider />}
        {category === "teshuvot" && (
          <div dir={hebrewMode ? "rtl" : "ltr"} className="flex shrink-0 items-center gap-3">
            <button
              onClick={toggleRefPanelOpen}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]"
              style={refPanelOpen ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
            >
              {hebrewMode
                ? refPanelOpen ? "הסתר טקסט" : "הצג טקסט"
                : refPanelOpen ? "Hide text panel" : "Show text panel"}
            </button>
          </div>
        )}

        {/* Opens this exact daf/amud on Mercava (themercava.com/app) in a real popup window
            (not a plain new-tab link) — Mercava has no public reverse-lookup for its own internal
            page ids, so the id table this reads (lib/mercava.ts, the `mercava_daf_ids` Supabase
            table) was collected by scripts/mercava, walking Mercava's own metanav API rather than
            guessing a formula. A popup window (mercavaWindowRef above) is docked to the right edge
            of the screen, and — the actual reason it's a tracked popup rather than target="_blank"
            — the effect above silently retargets it to whatever daf you navigate to here, so it
            stays in sync without needing to click this again. The second button (openSideBySide)
            pops this reader itself into a new window sized/positioned to exactly fill the screen's
            left complement of the Mercava popup's own width, so the two tile together without the
            user having to eyeball a manual drag first. Considered an in-app iframe panel instead;
            rejected per explicit user direction, since Mercava's own header/sign-in/menu chrome
            would render inside this app's UI and it would compete for space with the existing
            text/commentary/daf-image/notebook columns.

            Both actions share one labeled pill (icon-only buttons, "Mercava" as a plain prefix
            rather than a third button) rather than two separate text buttons — per explicit
            follow-up feedback that "Side by side" alone read as unclear about what it was relative
            to. `dir` on the pill keeps the popup-icon button adjacent to the label in both
            directions (immediately after it in the DOM, which visually lands to the label's *right*
            in LTR and *left* in RTL — i.e. "after Mercava" in both reading directions, not just
            English's), with the side-by-side icon one step further out in both. */}
        {category === "talmud" &&
          (yomiButtons.length > 0 || dafImageAvailable) &&
          mercavaUrl && <VerticalDivider />}
        {category === "talmud" && mercavaUrl && (
          <div
            dir={hebrewMode ? "rtl" : "ltr"}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1 py-1 text-sm"
          >
            <span className="pl-2 pr-1 text-xs opacity-60">{hebrewMode ? "מרכבה" : "Mercava"}</span>
            <button
              onClick={openOrFocusMercava}
              aria-label={hebrewMode ? "פתח את מרכבה בחלון נפרד" : "Open Mercava in a separate window"}
              className="rounded-full p-1.5 transition-colors hover:bg-[var(--accent)]/15"
              title={
                hebrewMode
                  ? "פתח דף זה באתר מרכבה בחלון נפרד — יישאר מסונכרן בזמן שאתה מנווט כאן"
                  : "Open this daf on Mercava in a separate window — stays in sync as you navigate here"
              }
            >
              <PopoutWindowIcon />
            </button>
            <button
              onClick={openSideBySide}
              aria-label={hebrewMode ? "סדר את החלונות זה לצד זה" : "Position windows side by side"}
              className="rounded-full p-1.5 transition-colors hover:bg-[var(--accent)]/15"
              title={
                hebrewMode
                  ? "פותח את הדף הזה בחלון חדש בגודל ומיקום מתאימים לצפייה זה לצד זה עם מרכבה"
                  : "Reopens this reader in a new window sized and positioned so Mercava can sit alongside it"
              }
            >
              <SideBySideIcon />
            </button>
          </div>
        )}

        {category === "shulchanArukh" && <VerticalDivider />}
        {category === "shulchanArukh" && (
          <div
            dir={hebrewMode ? "rtl" : "ltr"}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1 py-1 text-sm"
            title={
              hebrewMode
                ? "לספריא אין מהדורה אחת עם גם ניקוד וגם סימוני מפרשים — יש לבחור"
                : "Sefaria has no single edition with both nikud and commentary markers — pick one"
            }
          >
            {(["commentary", "nikud"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSaTextMode(mode)}
                className="rounded-full px-2.5 py-1 transition-colors"
                style={saTextMode === mode ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
              >
                {hebrewMode
                  ? mode === "commentary" ? "סימוני מפרשים" : "ניקוד"
                  : mode === "commentary" ? "Markers" : "Nikud"}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />
      </div>

      <div className="flex min-h-0 flex-1">
        {category === "teshuvot" && refPanelOpen && (
          <>
            <div
              className="min-h-0 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
              style={{ width: refPanelWidth }}
            >
              <ReferencePanel hebrewMode={hebrewMode} />
            </div>
            {/* Text sits to the right of this handle, so dragging right grows the panel. */}
            <ResizeHandle onDrag={(delta) => adjustRefPanelWidth(delta)} />
          </>
        )}

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
                                      quoteHe,
                                      quoteEn,
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

        {/* Teshuvot has no commentary at all, matching native — the panel and its resize handle
            are omitted entirely rather than shown empty; the text panel's own flex-1 (see
            `showDaf ? "flex-none" : "flex-1"` above) fills the space automatically. */}
        {category !== "teshuvot" && (
          <>
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
                    ? (segmentIndex, paragraphIndex, commentaryType, amud, segmentLabel, quoteHe, quoteEn) =>
                        notebookInsertRef.current?.(
                          buildAnchor("commentary", segmentIndex, paragraphIndex, commentaryType, amud, segmentLabel),
                          quoteHe,
                          quoteEn,
                        )
                    : undefined
                }
                onActiveTypeChange={(type) => setReadingFocus({ source: "commentary", commentaryType: type })}
              />
            </div>
          </>
        )}

        {notebookOpen && !notebookFloating && (
          <>
            {/* Notebook sits to the right of this handle, so dragging right shrinks it. */}
            <ResizeHandle onDrag={(delta) => adjustNotebookWidth(delta)} />
            <div
              className="min-h-0 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
              style={{ width: notebookWidth }}
            >
              {notebookPanelElement}
            </div>
          </>
        )}
      </div>

      {notebookOpen && notebookFloating && (
        <FloatingNotebookWindow rect={notebookFloatRect} onRectChange={handleNotebookFloatRectChange}>
          {notebookPanelElement}
        </FloatingNotebookWindow>
      )}

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

      {notebookPickerOpen && (
        <NotebookPickerModal
          currentScope={currentReaderScope}
          notebooks={notebooks}
          onSelect={handleSelectNotebook}
          onCreate={handleCreateNotebook}
          onClose={() => setNotebookPickerOpen(false)}
        />
      )}

      {notebookSearchOpen && (
        <NotebookSearchModal
          highlights={highlights}
          onNavigate={(notebook, seedQuery) => openNotebookFromSearch(notebook.id, seedQuery)}
          onNavigateHighlight={(h) => {
            handleNavigateHighlight(h);
            setNotebookSearchOpen(false);
          }}
          onClose={() => setNotebookSearchOpen(false)}
        />
      )}

      {sourceSheetOpen && (
        <SourceSheetModal
          highlights={highlights}
          onNavigateHighlight={(h) => {
            handleNavigateHighlight(h);
            setSourceSheetOpen(false);
          }}
          onNavigateNotebookAnchor={navigateToNotebookAnchor}
          onClose={() => setSourceSheetOpen(false)}
        />
      )}

      <DedicationBanner />
      </div>
    </div>
  );
}
