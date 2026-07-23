"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TextDisplayMode, TextSegment } from "@/lib/textModels";
import type { CommentaryType } from "@/lib/commentaryTypes";
import { getPoolInfo, computeEffectiveSlots, type ReaderCategory } from "@/lib/commentaryPools";
import {
  getCategoryGroups,
  getChapterMin,
  getChapterMax,
  getChapterUnitLabel,
  getCategoryDisplayName,
  getTalmudSefariaName,
} from "@/lib/categoryCatalog";
import CommentaryPanel from "@/components/CommentaryPanel";
import SASimanPicker from "@/components/SASimanPicker";
import DafImagePanel from "@/components/DafImagePanel";
import { loadTalmudPages, hasPages as hasTalmudPages, type TalmudPages } from "@/lib/talmudPages";

interface ChapterResponse {
  ref: string;
  segments: TextSegment[];
}

const READER_CATEGORIES: ReaderCategory[] = ["tanakh", "mishnah", "talmud", "rambam", "shulchanArukh"];

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
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
  } catch {
    // localStorage unavailable (private browsing, quota) — slot choice just won't persist.
  }
}

// Font size: -1..+4, each step ±2px from base. Text and commentary are sized independently
// (some users want commentary smaller/larger than the main text, not locked together).
// Range is intentionally asymmetric vs. native's -2..+2: user feedback was that native's
// smallest was too small (floor raised from -2 to -1) and the largest wasn't big enough
// (ceiling raised from +2 to +4).
const MAIN_FONT_SIZE_KEY = "anytorah:fontSizeLevel";
const COMMENTARY_FONT_SIZE_KEY = "anytorah:commentaryFontSizeLevel";
const FONT_SIZE_MIN = -1;
const FONT_SIZE_MAX = 4;
const FONT_SIZE_LEVELS = [-1, 0, 1, 2, 3, 4];
const FONT_SIZE_LABELS: Record<number, string> = {
  [-1]: "Small",
  0: "Default",
  1: "Large",
  2: "Larger",
  3: "Largest",
  4: "Max",
};

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
  } catch {
    // localStorage unavailable — font size choice just won't persist.
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
const NARROW_WIDTH_DEFAULT = 420;
const COMMENTARY_WIDTH_DEFAULT = 380;
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

/**
 * Small-A…large-A control with tappable dots. `label` is used for aria-labels/tooltips only —
 * the visible caption lives above the group (see ControlGroup) so Text and Commentary read as
 * two clearly separate sections rather than repeating the word on every pill.
 */
function FontSizeControl({
  label,
  level,
  onChange,
}: {
  label: string;
  level: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
      <button
        onClick={() => onChange(clamp(level - 1, FONT_SIZE_MIN, FONT_SIZE_MAX))}
        disabled={level <= FONT_SIZE_MIN}
        aria-label={`Decrease ${label} font size`}
        className="text-xs opacity-70 transition-opacity hover:opacity-100 disabled:opacity-25"
      >
        A
      </button>
      <div className="flex items-center gap-1">
        {FONT_SIZE_LEVELS.map((d) => {
          const size = 5 + (d - FONT_SIZE_MIN) * 2;
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              aria-label={`${label} font size: ${FONT_SIZE_LABELS[d]}`}
              title={FONT_SIZE_LABELS[d]}
              className="rounded-full"
              style={{
                width: size,
                height: size,
                background: "var(--foreground)",
                opacity: d === level ? 1 : 0.25,
              }}
            />
          );
        })}
      </div>
      <button
        onClick={() => onChange(clamp(level + 1, FONT_SIZE_MIN, FONT_SIZE_MAX))}
        disabled={level >= FONT_SIZE_MAX}
        aria-label={`Increase ${label} font size`}
        className="text-base opacity-70 transition-opacity hover:opacity-100 disabled:opacity-25"
      >
        A
      </button>
    </div>
  );
}

/** Number input that only commits (and re-fetches) on blur/Enter, not per keystroke. */
function CommitInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) onCommit(clamp(n, min, max));
    else setDraft(String(value));
  };

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm"
    />
  );
}

const DISPLAY_MODES: { mode: TextDisplayMode; label: string }[] = [
  { mode: "source", label: "א" },
  { mode: "both", label: "אA" },
  { mode: "translation", label: "A" },
];

/** Hebrew/English/both toggle — one instance for the main text, one for commentary. */
function DisplayModePill({
  mode,
  onChange,
}: {
  mode: TextDisplayMode;
  onChange: (m: TextDisplayMode) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-full border border-border text-sm">
      {DISPLAY_MODES.map(({ mode: m, label }) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="px-3 py-1.5 transition-colors"
          style={mode === m ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * A labeled cluster of controls — "Text" or "Commentary" sits inline before its pills (not
 * above them) so the whole group stays a single line and lines up with the rest of the toolbar.
 */
function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs opacity-60">{label}</span>
      {children}
    </div>
  );
}

type Selection = Record<ReaderCategory, { index: number; chapter: number }>;

const INITIAL_SELECTION: Selection = {
  tanakh: { index: 0, chapter: 1 },
  mishnah: { index: 0, chapter: 1 },
  talmud: { index: 0, chapter: getChapterMin("talmud", 0) },
  rambam: { index: 0, chapter: getChapterMin("rambam", 0) },
  shulchanArukh: { index: 0, chapter: 1 },
};

export default function Reader() {
  const [category, setCategory] = useState<ReaderCategory>("tanakh");
  const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION);
  // Text and commentary each get their own Hebrew/English/both toggle — some users want to
  // read the main text in "both" but skim commentary in English-only, or vice versa.
  const [textDisplayMode, setTextDisplayMode] = useState<TextDisplayMode>("both");
  const [commentaryDisplayMode, setCommentaryDisplayMode] = useState<TextDisplayMode>("both");
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
  const mainHebrewFontPx = 20 + mainFontSizeLevel * 2;
  // Gemara English reads as too large relative to the Hebrew at the shared base size — one
  // step (2px) smaller specifically for Talmud, not the other categories.
  const mainEnglishFontPx = 16 + mainFontSizeLevel * 2 - (category === "talmud" ? 2 : 0);

  const { index, chapter } = selection[category];
  const groups = useMemo(() => getCategoryGroups(category), [category]);
  const chapterMin = getChapterMin(category, index);
  const chapterMax = getChapterMax(category, index);
  const chapterUnit = getChapterUnitLabel(category);

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
  const talmudTractateName = category === "talmud" ? getTalmudSefariaName(index) : undefined;
  const dafImageAvailable =
    !!talmudTractateName && !!talmudPages && hasTalmudPages(talmudPages, talmudTractateName);
  const showDaf = category === "talmud" && showDafImage && dafImageAvailable && !!talmudTractateName;

  const [dafPosition, setDafPositionState] = useState<DafPosition>("middle");
  const [narrowWidth, setNarrowWidthState] = useState(NARROW_WIDTH_DEFAULT);
  const [commentaryWidth, setCommentaryWidthState] = useState(COMMENTARY_WIDTH_DEFAULT);
  useEffect(() => {
    setDafPositionState(loadDafPosition());
    setNarrowWidthState(loadStoredWidth(NARROW_WIDTH_KEY, NARROW_WIDTH_DEFAULT));
    setCommentaryWidthState(loadStoredWidth(COMMENTARY_WIDTH_KEY, COMMENTARY_WIDTH_DEFAULT));
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

  const handleIndexChange = (id: number) => {
    setSelection((s) => ({ ...s, [category]: { index: id, chapter: getChapterMin(category, id) } }));
  };
  const handleChapterChange = (c: number) => {
    setSelection((s) => ({ ...s, [category]: { ...s[category], chapter: c } }));
  };

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

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const commentariesQuery = commentariesKey ? `&commentaries=${commentariesKey}` : "";
    fetch(`/api/chapter?category=${category}&index=${index}&chapter=${chapter}${commentariesQuery}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load text");
        setData(json);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load text");
        setData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [category, index, chapter, commentariesKey]);

  // Talmud amud a/b jump — scroll-only (both amudim are always loaded together). Resets to
  // "a" on every new daf/tractate/category, matching the expectation that a daf opens at 2a.
  const [talmudAmud, setTalmudAmud] = useState<"a" | "b">("a");
  const textContainerRef = useRef<HTMLDivElement>(null);
  const amudBRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTalmudAmud("a"), [category, index, chapter]);

  const [simanPickerOpen, setSimanPickerOpen] = useState(false);

  useEffect(() => {
    if (category !== "talmud") return;
    if (talmudAmud === "b") {
      amudBRef.current?.scrollIntoView({ block: "start" });
    } else {
      textContainerRef.current?.scrollTo({ top: 0 });
    }
  }, [category, talmudAmud, data]);

  return (
    <div
      className={`mx-auto flex h-screen w-full flex-col px-4 py-6 ${showDaf ? "max-w-[100rem]" : "max-w-6xl"}`}
    >
      <header className="mb-6 flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--accent)" }}>
          AnyTorah
        </h1>
        <div className="flex overflow-hidden rounded-full border border-border text-sm">
          {READER_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-3 py-1.5 transition-colors"
              style={category === c ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
            >
              {getCategoryDisplayName(c)}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <select
          value={index}
          onChange={(e) => handleIndexChange(Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
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
        <span className="text-sm opacity-60">{chapterUnit}</span>
        <CommitInput value={chapter} min={chapterMin} max={chapterMax} onCommit={handleChapterChange} />
        <span className="text-xs opacity-50">
          {chapterMin === 1 ? `of ${chapterMax}` : `${chapterMin}–${chapterMax}`}
        </span>

        {category === "shulchanArukh" && (
          <button
            onClick={() => setSimanPickerOpen(true)}
            className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]"
          >
            Browse simanim…
          </button>
        )}

        {category === "talmud" && (
          <div className="flex overflow-hidden rounded-full border border-border text-sm">
            {(["a", "b"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setTalmudAmud(a)}
                className="px-3 py-1.5 transition-colors"
                style={talmudAmud === a ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {category === "talmud" && dafImageAvailable && (
          <button
            onClick={() => setShowDafImage(!showDafImage)}
            className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]"
            style={showDafImage ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
          >
            {showDafImage ? "Hide daf image" : "Show daf image"}
          </button>
        )}

        {showDaf && (
          <div className="flex items-center gap-1 rounded-full border border-border px-1 py-1 text-sm">
            <span className="pl-2 text-xs opacity-60">Daf</span>
            {(["left", "middle"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setDafPosition(pos)}
                className="rounded-full px-2.5 py-1 transition-colors"
                style={
                  dafPosition === pos ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined
                }
              >
                {pos === "left" ? "Left" : "Middle"}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        <ControlGroup label="Text">
          <DisplayModePill mode={textDisplayMode} onChange={setTextDisplayMode} />
          <FontSizeControl label="Text" level={mainFontSizeLevel} onChange={setMainFontSizeLevel} />
        </ControlGroup>

        <div className="flex-1" />

        <ControlGroup label="Commentary">
          <DisplayModePill mode={commentaryDisplayMode} onChange={setCommentaryDisplayMode} />
          <FontSizeControl label="Commentary" level={commentaryFontSizeLevel} onChange={setCommentaryFontSizeLevel} />
        </ControlGroup>
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
          ref={textContainerRef}
          className={`min-h-0 min-w-0 overflow-y-auto pr-1 ${showDaf ? "flex-none" : "flex-1"}`}
          style={showDaf ? { width: narrowWidth } : undefined}
        >
          {loading && <p className="py-8 text-center text-sm opacity-60">Loading…</p>}
          {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
          {!loading && !error && data && (
            <>
              <p className="mb-4 text-xs opacity-50">{data.ref}</p>
              <div className="space-y-4 pb-8">
                {data.segments.map((seg) =>
                  seg.isAmudBMarker ? (
                    <div key={seg.id} ref={amudBRef} className="flex items-center gap-3 py-2 text-xs opacity-60">
                      <div className="h-px flex-1 bg-border" />
                      עמוד ב · Amud B ({seg.markerDaf}b)
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  ) : (
                    <div key={seg.id} className={`flex gap-3 ${textDisplayMode !== "translation" ? "flex-row-reverse" : ""}`}>
                      {seg.label && (
                        <span className="mt-1.5 w-5 shrink-0 text-right text-xs tabular-nums opacity-50">
                          {seg.label}
                        </span>
                      )}
                      <div className="flex-1 space-y-1.5">
                        {(textDisplayMode === "source" || textDisplayMode === "both") && seg.hebrewHTML && (
                          category === "shulchanArukh" ? (
                            // SA Hebrew carries <span class="sa-mark sa-mark-N"> spans for its
                            // inline commentary-marker brackets (see processedHebrewWithMarkers)
                            // — everything else in this string is plain-texted server-side, so
                            // this is safe despite the raw HTML.
                            <p
                              dir="rtl"
                              lang="he"
                              className="leading-relaxed"
                              style={{ fontFamily: "var(--font-hebrew)", fontSize: mainHebrewFontPx }}
                              dangerouslySetInnerHTML={{ __html: seg.hebrewHTML }}
                            />
                          ) : (
                            <p
                              dir="rtl"
                              lang="he"
                              className="leading-relaxed"
                              style={{
                                fontFamily: "var(--font-hebrew)",
                                fontSize: mainHebrewFontPx,
                                whiteSpace: "pre-line",
                              }}
                            >
                              {seg.hebrewHTML}
                            </p>
                          )
                        )}
                        {(textDisplayMode === "translation" || textDisplayMode === "both") && seg.englishHTML && (
                          category === "talmud" || category === "mishnah" ? (
                            // Carries <span class="en-editorial"> for Sefaria's bolded "glue"
                            // words (see processedEnglishWithBold) — everything else in this
                            // string is plain-texted server-side, so this is safe despite the
                            // raw HTML, matching the SA-Hebrew case above.
                            <p
                              className="leading-relaxed opacity-90"
                              style={{ fontSize: mainEnglishFontPx, whiteSpace: "pre-line" }}
                              dangerouslySetInnerHTML={{ __html: seg.englishHTML }}
                            />
                          ) : (
                            <p
                              className="leading-relaxed opacity-90"
                              style={{ fontSize: mainEnglishFontPx, whiteSpace: "pre-line" }}
                            >
                              {seg.englishHTML}
                            </p>
                          )
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </div>

        {showDaf && dafPosition === "middle" && (
          <>
            {/* Text sits to the left of this handle, so dragging right grows it. */}
            <ResizeHandle onDrag={(delta) => adjustNarrowWidth(delta)} />
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
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
            poolInfo={poolInfo}
            slots={slots}
            effectiveSlots={effectiveSlots}
            onSlotsChange={setSlots}
            talmudAmud={category === "talmud" ? talmudAmud : undefined}
            mainSegmentCount={category === "rambam" ? data?.segments.length : undefined}
            fontSizeLevel={commentaryFontSizeLevel}
          />
        </div>
      </div>

      {simanPickerOpen && category === "shulchanArukh" && (
        <SASimanPicker
          section={index}
          currentSiman={chapter}
          onSelect={(siman) => {
            handleChapterChange(siman);
            setSimanPickerOpen(false);
          }}
          onClose={() => setSimanPickerOpen(false)}
        />
      )}
    </div>
  );
}
