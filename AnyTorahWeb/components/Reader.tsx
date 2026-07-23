"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TextDisplayMode, TextSegment } from "@/lib/textModels";
import type { CommentaryType } from "@/lib/commentaryTypes";
import { getPoolInfo, computeEffectiveSlots, type ReaderCategory } from "@/lib/commentaryPools";
import {
  getCategoryGroups,
  getChapterMin,
  getChapterMax,
  getChapterUnitLabel,
  getCategoryDisplayName,
} from "@/lib/categoryCatalog";
import CommentaryPanel from "@/components/CommentaryPanel";
import SASimanPicker from "@/components/SASimanPicker";

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
  const [displayMode, setDisplayMode] = useState<TextDisplayMode>("both");

  const { index, chapter } = selection[category];
  const groups = useMemo(() => getCategoryGroups(category), [category]);
  const chapterMin = getChapterMin(category, index);
  const chapterMax = getChapterMax(category, index);
  const chapterUnit = getChapterUnitLabel(category);

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
    <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-4 py-6">
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

        <div className="ml-auto flex overflow-hidden rounded-full border border-border text-sm">
          {DISPLAY_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              className="px-3 py-1.5 transition-colors"
              style={displayMode === mode ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div ref={textContainerRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
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
                    <div key={seg.id} className={`flex gap-3 ${displayMode !== "translation" ? "flex-row-reverse" : ""}`}>
                      {seg.label && (
                        <span className="mt-1.5 w-5 shrink-0 text-right text-xs tabular-nums opacity-50">
                          {seg.label}
                        </span>
                      )}
                      <div className="flex-1 space-y-1.5">
                        {(displayMode === "source" || displayMode === "both") && seg.hebrewHTML && (
                          category === "shulchanArukh" ? (
                            // SA Hebrew carries <span class="sa-mark sa-mark-N"> spans for its
                            // inline commentary-marker brackets (see processedHebrewWithMarkers)
                            // — everything else in this string is plain-texted server-side, so
                            // this is safe despite the raw HTML.
                            <p
                              dir="rtl"
                              lang="he"
                              className="text-xl leading-relaxed"
                              style={{ fontFamily: "var(--font-hebrew)" }}
                              dangerouslySetInnerHTML={{ __html: seg.hebrewHTML }}
                            />
                          ) : (
                            <p
                              dir="rtl"
                              lang="he"
                              className="text-xl leading-relaxed"
                              style={{ fontFamily: "var(--font-hebrew)", whiteSpace: "pre-line" }}
                            >
                              {seg.hebrewHTML}
                            </p>
                          )
                        )}
                        {(displayMode === "translation" || displayMode === "both") && seg.englishHTML && (
                          <p className="text-base leading-relaxed opacity-90" style={{ whiteSpace: "pre-line" }}>
                            {seg.englishHTML}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </div>

        <div className="min-h-0 w-[380px] shrink-0 overflow-hidden rounded-lg border border-border bg-card">
          <CommentaryPanel
            category={category}
            index={index}
            chapter={chapter}
            displayMode={displayMode}
            poolInfo={poolInfo}
            slots={slots}
            effectiveSlots={effectiveSlots}
            onSlotsChange={setSlots}
            talmudAmud={category === "talmud" ? talmudAmud : undefined}
            mainSegmentCount={category === "rambam" ? data?.segments.length : undefined}
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
