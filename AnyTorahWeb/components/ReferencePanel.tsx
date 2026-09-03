"use client";

import { useEffect, useState } from "react";
import type { TextSegment, TextDisplayMode } from "@/lib/textModels";
import {
  getCategoryGroups,
  getChapterMin,
  getChapterMax,
  getChapterUnitLabel,
  getCategoryDisplayName,
} from "@/lib/categoryCatalog";
import { fetchCategoryFor, type ReaderCategory } from "@/lib/commentaryPools";
import { fontSizePx, fontSizeLineHeight } from "@/lib/fontSizeLevels";
import DisplayModePill from "@/components/DisplayModePill";
import FontSizeSlider from "@/components/FontSizeSlider";
import SASimanPicker from "@/components/SASimanPicker";

// Teshuvot (Rishonim/Acharonim) is deliberately excluded — this panel sits alongside the
// Teshuvah reader for looking up sources *other than* Teshuvot (a pasuk, an SA siman, etc.),
// not for cross-referencing one teshuvah from another.
const REFERENCE_CATEGORIES: ReaderCategory[] =
  ["tanakh", "mishnah", "tosefta", "talmud", "yerushalmi", "rambam", "tur", "shulchanArukh"];

interface ReferenceResponse {
  ref: string;
  segments: TextSegment[];
}

/** What Reader.tsx needs to render a *sibling* Commentators panel for whatever this panel is
 *  currently showing — see ReferenceSelection's own doc comment at the Reader.tsx call site. */
export interface ReferenceSelection {
  category: ReaderCategory;
  index: number;
  chapter: number;
  halakha: number;
  /** Rambam only — needed for CommentaryPanel's depth-3 fix. */
  segmentCount: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * A second, self-contained text reader — pulled up in a side panel (see Reader.tsx's
 * refPanelOpen) so a Teshuvah citing a pasuk or a Shulchan Arukh siman can be looked up without
 * losing your place in the main text. Its own category tabs (everything except Teshuvot itself —
 * see REFERENCE_CATEGORIES above) and book/work + chapter pickers (a named siman picker for
 * Shulchan Arukh/Tur, matching the main reader). Text-only —
 * the Commentators panel for whatever this shows is a separate sibling panel Reader.tsx renders
 * itself (see onSelectionChange below), not nested in here, so it looks and resizes exactly like
 * the main reader's own Text/Commentary pair. No highlights/bookmarks/notebook integration and
 * no persistence of its own position/font size/display mode — it always opens back on Tanakh/
 * Bereishit. Accepted v1 gaps, not oversights; this is scoped to "look something up alongside
 * the teshuvah," not a full peer of the main reader.
 */
export default function ReferencePanel({
  hebrewMode,
  onSelectionChange,
}: {
  hebrewMode: boolean;
  onSelectionChange: (selection: ReferenceSelection) => void;
}) {
  const [category, setCategoryState] = useState<ReaderCategory>("tanakh");
  const [index, setIndex] = useState(0);
  const [chapter, setChapter] = useState(1);
  const [halakha, setHalakha] = useState(1);
  // Text language defaults to Hebrew-only on every fresh open — matches the app-wide "assume
  // Hebrew" default for any newly-opened panel, independent of the interface language toggle.
  const [displayMode, setDisplayMode] = useState<TextDisplayMode>("source");
  const [fontSizeLevel, setFontSizeLevel] = useState(0);
  const [simanPickerOpen, setSimanPickerOpen] = useState(false);
  const [data, setData] = useState<ReferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = getCategoryGroups(category, hebrewMode);
  const { fetchCategory, subcategory } = fetchCategoryFor(category);
  const isYerushalmi = category === "yerushalmi";
  const usesNamedSimanPicker = category === "shulchanArukh" || category === "tur";
  const chapterMin = getChapterMin(category, index);
  const chapterMax = getChapterMax(category, index);
  const chapterUnit = getChapterUnitLabel(category, hebrewMode);
  const useMarkersHtml = category === "shulchanArukh" || category === "tur";
  const useBoldHtml = fetchCategory === "talmud" || fetchCategory === "mishnah";

  const setCategory = (c: ReaderCategory) => {
    setCategoryState(c);
    setIndex(0);
  };

  // A category or work change resets chapter/halakha — mirrors the main reader's own
  // handleIndexChange, just without the persisted-selection machinery that isn't needed here.
  useEffect(() => {
    setChapter(getChapterMin(category, index));
    setHalakha(1);
  }, [category, index]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const subcategoryQuery = subcategory ? `&subcategory=${subcategory}` : "";
    const halakhaQuery = subcategory === "yerushalmi" ? `&halakha=${halakha}` : "";
    fetch(
      `/api/chapter?category=${fetchCategory}&index=${index}&chapter=${chapter}${subcategoryQuery}${halakhaQuery}`,
      { signal: controller.signal },
    )
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
  }, [fetchCategory, index, chapter, subcategory, halakha, category]);

  // Reports the current selection up to Reader.tsx, which owns the sibling Commentators panel
  // (its pool/slots/width/etc.) — this component only knows the selection, not what Reader.tsx
  // does with it.
  useEffect(() => {
    onSelectionChange({ category, index, chapter, halakha, segmentCount: data?.segments.length ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, index, chapter, halakha, data]);

  const hebrewFontPx = fontSizePx(18, fontSizeLevel);
  const englishFontPx = fontSizePx(14, fontSizeLevel);
  const lineHeight = fontSizeLineHeight(fontSizeLevel);

  return (
    // No `dir` here — this wrapper (and the content area below) must stay direction-neutral so
    // the segment rows' own flex-row-reverse (driven by which *content* language is shown, not
    // the interface language) isn't fought by an inherited ancestor `dir`. Only the toolbar rows
    // (top nav, bottom footer) — which should flip with the interface language, same as every
    // other toolbar in this app — get their own explicit `dir` below. A real bug, found live:
    // wrapping the whole panel in `dir={hebrewMode ...}` put paragraph numbers on the wrong side
    // whenever the interface language was Hebrew, regardless of which text language was shown.
    <div className="flex h-full flex-col">
      <div dir={hebrewMode ? "rtl" : "ltr"} className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ReaderCategory)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {REFERENCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{getCategoryDisplayName(c, hebrewMode)}</option>
          ))}
        </select>
        <select
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
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
        <span className="text-xs opacity-60">{chapterUnit}</span>
        <input
          type="number"
          value={chapter}
          onChange={(e) => setChapter(clamp(Number(e.target.value) || chapterMin, chapterMin, chapterMax))}
          className="w-14 rounded border border-border bg-background px-1 py-1 text-xs"
        />
        {usesNamedSimanPicker && (
          <button
            onClick={() => setSimanPickerOpen(true)}
            aria-label={hebrewMode ? "עיין בסימנים" : "Browse simanim"}
            title={hebrewMode ? "עיין בסימנים" : "Browse simanim"}
            className="shrink-0 rounded-full border border-border px-2 py-1 text-xs opacity-70 transition-opacity hover:opacity-100"
          >
            ▾
          </button>
        )}
        {isYerushalmi && (
          <>
            <span className="text-xs opacity-60">:</span>
            <input
              type="number"
              value={halakha}
              onChange={(e) => setHalakha(Math.max(1, Number(e.target.value) || 1))}
              className="w-12 rounded border border-border bg-background px-1 py-1 text-xs"
            />
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && <p className="py-8 text-center text-sm opacity-60">Loading…</p>}
        {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
        {!loading && !error && data && (
          <>
            <div className="flex flex-col gap-4">
              {data.segments.map((seg) =>
                seg.isAmudBMarker ? (
                  <div key={seg.id} className="flex items-center gap-2 py-1 text-xs opacity-60">
                    <div className="h-px flex-1 bg-border" />
                    Amud B ({seg.markerDaf}b)
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : (
                  <div key={seg.id} className={`flex gap-2 ${displayMode !== "translation" ? "flex-row-reverse" : ""}`}>
                    {seg.label && (
                      <span className="mt-1 w-5 shrink-0 text-right text-xs tabular-nums opacity-50">{seg.label}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      {(displayMode === "source" || displayMode === "both") && seg.hebrewHTML && (
                        useMarkersHtml ? (
                          <p
                            dir="rtl"
                            lang="he"
                            style={{ fontFamily: "var(--font-hebrew)", fontSize: hebrewFontPx, lineHeight }}
                            dangerouslySetInnerHTML={{ __html: seg.hebrewHTML }}
                          />
                        ) : (
                          <p dir="rtl" lang="he" style={{ fontFamily: "var(--font-hebrew)", fontSize: hebrewFontPx, lineHeight, whiteSpace: "pre-line" }}>
                            {seg.hebrewHTML}
                          </p>
                        )
                      )}
                      {(displayMode === "translation" || displayMode === "both") && seg.englishHTML && (
                        useBoldHtml ? (
                          <p
                            className="opacity-90"
                            style={{ fontSize: englishFontPx, lineHeight, whiteSpace: "pre-line" }}
                            dangerouslySetInnerHTML={{ __html: seg.englishHTML }}
                          />
                        ) : (
                          <p className="opacity-90" style={{ fontSize: englishFontPx, lineHeight, whiteSpace: "pre-line" }}>
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
      <div
        dir={hebrewMode ? "rtl" : "ltr"}
        className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-1"
      >
        <DisplayModePill mode={displayMode} onChange={setDisplayMode} />
        <FontSizeSlider label="Text" level={fontSizeLevel} onChange={setFontSizeLevel} hebrewMode={hebrewMode} />
      </div>
      {simanPickerOpen && usesNamedSimanPicker && (
        <SASimanPicker
          section={index}
          currentSiman={chapter}
          onSelect={(s) => {
            setChapter(s);
            setSimanPickerOpen(false);
          }}
          onClose={() => setSimanPickerOpen(false)}
          hebrewMode={hebrewMode}
        />
      )}
    </div>
  );
}
