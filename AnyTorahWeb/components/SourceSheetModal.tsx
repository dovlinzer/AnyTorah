"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReaderCategory } from "@/lib/commentaryPools";
import { formatAnchorLabel, type TextAnchor } from "@/lib/textAnchor";
import type { Highlight } from "@/lib/highlights";
import {
  extractAnchors,
  extractTags,
  getAnchorColor,
  getAnchorNotes,
  loadNotebooks,
  type Notebook,
} from "@/lib/notebooks";
import { HIGHLIGHT_CATEGORY_COUNT, loadHighlightCategoryLabels } from "@/lib/highlightCategories";

interface SourceSheetEntry {
  key: string;
  kind: "highlight" | "notebook-anchor";
  anchor: TextAnchor;
  colorIndex: number | null;
  tags: string[];
  quoteHe: string;
  quoteEn: string;
  note: string;
  highlight?: Highlight;
  /** Set only for kind === "notebook-anchor" — which notebook this anchor actually lives in, so
   *  navigating to it can pin the right one (a scope no longer identifies a single notebook). */
  notebookId?: string;
}

// Matches the app's real top-level tab order (see AnyTorahWeb/CLAUDE.md's Tosefta/Yerushalmi and
// Tur sections) — used only to order a sheet spanning multiple categories sensibly; a sheet is far
// more likely to stay within one category, so this rarely matters in practice.
const CATEGORY_ORDER: ReaderCategory[] = [
  "tanakh",
  "mishnah",
  "tosefta",
  "talmud",
  "yerushalmi",
  "rambam",
  "tur",
  "shulchanArukh",
];

/** Textual order, not creation timestamp — highlights and notebook anchors have no shared natural
 *  sort key, so a source sheet reads like the book it came from rather than the order things were
 *  collected in. */
function compareAnchors(a: TextAnchor, b: TextAnchor): number {
  const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (catDiff !== 0) return catDiff;
  if (a.index !== b.index) return a.index - b.index;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  const halakhaDiff = (a.halakha ?? 0) - (b.halakha ?? 0);
  if (halakhaDiff !== 0) return halakhaDiff;
  if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
  return (a.paragraphIndex ?? 0) - (b.paragraphIndex ?? 0);
}

/** Whether `filters` constrain the query at all — `null` means "no tag filter active," distinct
 *  from `false` ("a tag filter is active and this entry doesn't satisfy it"), so the caller can
 *  tell "no constraint" apart from "constraint not met" when combining with the color result. */
function matchesTagFilter(entry: SourceSheetEntry, filters: Set<string>, mode: "any" | "all"): boolean | null {
  if (filters.size === 0) return null;
  const list = Array.from(filters);
  return mode === "all" ? list.every((t) => entry.tags.includes(t)) : list.some((t) => entry.tags.includes(t));
}

/** Colors are always OR-matched (any of the selected tiers) — an entry only ever carries one
 *  color, so "must match every selected color" could never be satisfied and isn't offered as an
 *  option, unlike tags (which an entry can carry several of at once). */
function matchesColorFilter(entry: SourceSheetEntry, filters: Set<number>): boolean | null {
  if (filters.size === 0) return null;
  return entry.colorIndex !== null && filters.has(entry.colorIndex);
}

function EntryBody({ entry, colorLabels, includeNotes }: { entry: SourceSheetEntry; colorLabels: string[]; includeNotes: boolean }) {
  const hasQuote = Boolean(entry.quoteHe || entry.quoteEn);
  return (
    <div className="source-sheet-entry">
      <div className="source-sheet-entry-header">
        <span className="source-sheet-entry-label">{formatAnchorLabel(entry.anchor)}</span>
        {entry.colorIndex !== null && (
          <span className={`highlight-dot highlight-dot-${entry.colorIndex} source-sheet-entry-dot`} title={colorLabels[entry.colorIndex]} />
        )}
        {entry.tags.map((t) => (
          <span key={t} className="source-sheet-tag">
            🏷 {t}
          </span>
        ))}
      </div>
      {hasQuote ? (
        <div className="source-sheet-quote">
          <span className="source-sheet-quote-caption">Source:</span>
          {entry.quoteHe && (
            <div dir="rtl" lang="he" className="source-sheet-quote-line">
              {entry.quoteHe}
            </div>
          )}
          {entry.quoteEn && (
            <div dir="ltr" lang="en" className="source-sheet-quote-line">
              {entry.quoteEn}
            </div>
          )}
        </div>
      ) : (
        <div className="source-sheet-quote source-sheet-quote-empty">No preview captured for this source.</div>
      )}
      {includeNotes && entry.note && (
        <div className="source-sheet-notes">
          <span className="source-sheet-quote-caption">Notes:</span>
          <div className="source-sheet-notes-text">{entry.note}</div>
        </div>
      )}
    </div>
  );
}

/** Source Sheet Builder (Phase C) — queries both Highlights (colorIndex/tags already on the
 *  record) and every Notebook anchor (colorIndex via getAnchorColor, tags via any "tag this
 *  source" chip pointing at it — lib/notebooks.ts, Phase B) by tag and/or color-tier. Tag and
 *  color are each independently optional; with neither active, nothing renders — same "type or
 *  pick a filter first" convention as NotebookSearchModal. Match semantics, made explicit in the
 *  UI rather than assumed: multiple selected tags combine via `tagMatchMode` ("any" = OR, the
 *  default, or "all" = AND); multiple selected colors are always OR'd (an entry only ever carries
 *  one color, so "all" could never match); the tag-criterion and color-criterion combine via
 *  `criteriaMatchMode` ("and", the default, or "or") whenever both are active at once. A
 *  notebook picker (mirrors NotebookSearchModal's own) lets specific notebooks be excluded from
 *  the query. Renders a printable view via window.print() and a global `@media print` rule (see
 *  globals.css) that isolates `.source-sheet-print-content` — no PDF library, nothing
 *  print-related exists elsewhere in the app. */
export default function SourceSheetModal({
  highlights,
  onNavigateHighlight,
  onNavigateNotebookAnchor,
  onClose,
}: {
  highlights: Highlight[];
  onNavigateHighlight: (h: Highlight) => void;
  /** Notebook-anchor entries have no highlight record to navigate via — this jumps the reader to
   *  the anchor's own location and pins the specific notebook it came from (Reader.tsx wires this
   *  to navigateToNotebookAnchor, which reuses the same reverse-sync flash Notebook Phase 2 already
   *  built for "the reader moved, does the pinned notebook have a matching anchor"). */
  onNavigateNotebookAnchor: (anchor: TextAnchor, notebookId: string) => void;
  onClose: () => void;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  // "any" (OR, the original default) vs. "all" (AND) — only meaningful with 2+ tags selected;
  // color has no equivalent toggle since an entry only ever carries one color (see
  // matchesColorFilter above).
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [colorFilters, setColorFilters] = useState<Set<number>>(new Set());
  // How the tag-criterion and color-criterion combine when *both* are active — "and" matches the
  // original (only) behavior; "or" is the new explicit alternative. Meaningless, and hidden, when
  // only one of the two criteria is active — that criterion alone decides matches either way.
  const [criteriaMatchMode, setCriteriaMatchMode] = useState<"and" | "or">("and");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [colorLabels] = useState<string[]>(() => loadHighlightCategoryLabels());
  // Empty = every notebook included — tracking exclusions (rather than a positive selection set)
  // means newly-created notebooks default to "included" without needing to pre-populate anything,
  // same convention as NotebookSearchModal's own notebook picker.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [notebookPickerOpen, setNotebookPickerOpen] = useState(true);

  useEffect(() => setNotebooks(loadNotebooks()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleTagFilter = (t: string, additive: boolean) => {
    setTagFilters((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(t)) next.delete(t);
        else next.add(t);
        return next;
      }
      return prev.size === 1 && prev.has(t) ? new Set() : new Set([t]);
    });
  };

  const toggleColorFilter = (i: number) => {
    setColorFilters((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const highlightEntries: SourceSheetEntry[] = useMemo(
    () =>
      highlights.map((h) => ({
        key: `highlight:${h.id}`,
        kind: "highlight" as const,
        anchor: h.anchor,
        colorIndex: h.colorIndex,
        tags: h.tags,
        quoteHe: h.anchorQuoteHe,
        quoteEn: h.anchorQuoteEn,
        note: h.note ?? "",
        highlight: h,
      })),
    [highlights],
  );

  // Every anchor is a candidate entry, not just explicitly-tagged ones — a color-only query
  // ("everything yellow") must also surface an anchor that sits in a colored block but was never
  // tagged at all (a real gap found live: a yellow-highlighted paragraph with an untagged anchor
  // didn't show up under a yellow-only filter). Tags are joined in separately via each tag's
  // sourceNodeIds — an anchor with none just gets an empty tags array, which a tag filter (when
  // active) naturally excludes on its own; no separate "has at least one tag or color" gate is
  // needed since the per-entry filters below already require an active match to show anything.
  const notebookEntries: SourceSheetEntry[] = useMemo(() => {
    const list: SourceSheetEntry[] = [];
    for (const nb of notebooks) {
      if (excludedIds.has(nb.id)) continue;
      const tagsByNodeId = new Map<string, string[]>();
      for (const tag of extractTags(nb.bodyJSON)) {
        for (const nodeId of tag.sourceNodeIds ?? []) {
          const existing = tagsByNodeId.get(nodeId);
          if (existing) existing.push(tag.label);
          else tagsByNodeId.set(nodeId, [tag.label]);
        }
      }
      for (const a of extractAnchors(nb.bodyJSON)) {
        list.push({
          key: `notebook:${nb.id}:${a.nodeId}`,
          kind: "notebook-anchor",
          anchor: a.anchor,
          colorIndex: getAnchorColor(nb.bodyJSON, a.nodeId),
          tags: tagsByNodeId.get(a.nodeId) ?? [],
          quoteHe: a.quoteHe ?? "",
          quoteEn: a.quoteEn ?? "",
          note: getAnchorNotes(nb.bodyJSON, a.nodeId),
          notebookId: nb.id,
        });
      }
    }
    return list;
  }, [notebooks, excludedIds]);

  const allEntries = useMemo(
    () => [...highlightEntries, ...notebookEntries].sort((a, b) => compareAnchors(a.anchor, b.anchor)),
    [highlightEntries, notebookEntries],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) for (const t of e.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allEntries]);

  const hasActiveFilter = tagFilters.size > 0 || colorFilters.size > 0;
  const results = hasActiveFilter
    ? allEntries.filter((e) => {
        const tagResult = matchesTagFilter(e, tagFilters, tagMatchMode);
        const colorResult = matchesColorFilter(e, colorFilters);
        if (tagResult === null) return colorResult ?? false;
        if (colorResult === null) return tagResult;
        return criteriaMatchMode === "and" ? tagResult && colorResult : tagResult || colorResult;
      })
    : [];

  const tagSummary =
    tagFilters.size > 0
      ? `Tags (${tagMatchMode === "all" ? "all of" : "any of"}): ${Array.from(tagFilters).join(", ")}`
      : undefined;
  const colorSummary =
    colorFilters.size > 0
      ? `Colors (any of): ${Array.from(colorFilters)
          .map((i) => colorLabels[i])
          .join(", ")}`
      : undefined;
  const filterSummary = [tagSummary, colorSummary].filter(Boolean).join(
    tagSummary && colorSummary ? ` ${criteriaMatchMode.toUpperCase()} ` : "",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Source Sheet
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
          {allTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] opacity-50">Tags:</span>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  title="Click to select; Ctrl/Cmd-click to select multiple tags"
                  onClick={(e) => toggleTagFilter(t, e.metaKey || e.ctrlKey)}
                  className="rounded-full border px-2 py-1 text-xs"
                  style={{
                    borderColor: tagFilters.has(t) ? "var(--accent)" : "var(--border)",
                    opacity: tagFilters.has(t) ? 1 : 0.6,
                  }}
                >
                  🏷 {t}
                </button>
              ))}
              {tagFilters.size > 1 && (
                <span className="flex items-center gap-1 text-[10px] opacity-70">
                  Match:
                  <button
                    type="button"
                    onClick={() => setTagMatchMode("any")}
                    className="rounded-full border px-1.5 py-0.5"
                    style={{ borderColor: tagMatchMode === "any" ? "var(--accent)" : "var(--border)", opacity: tagMatchMode === "any" ? 1 : 0.6 }}
                  >
                    any selected tag
                  </button>
                  <button
                    type="button"
                    onClick={() => setTagMatchMode("all")}
                    className="rounded-full border px-1.5 py-0.5"
                    style={{ borderColor: tagMatchMode === "all" ? "var(--accent)" : "var(--border)", opacity: tagMatchMode === "all" ? 1 : 0.6 }}
                  >
                    all selected tags
                  </button>
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs opacity-50">
              No tagged sources yet — tag a highlight, or use an anchor pill&apos;s 🏷 &quot;tag this source&quot;
              control in a notebook, to build a sheet.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] opacity-50">Color tier (any of):</span>
            {Array.from({ length: HIGHLIGHT_CATEGORY_COUNT }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleColorFilter(i)}
                title={colorLabels[i]}
                aria-label={`Filter to ${colorLabels[i]}`}
                aria-pressed={colorFilters.has(i)}
                className={`highlight-dot highlight-dot-${i}`}
                style={colorFilters.has(i) ? { transform: "scale(1.25)", opacity: 1 } : undefined}
              />
            ))}
          </div>
          {tagFilters.size > 0 && colorFilters.size > 0 && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="opacity-50">Combine tags + colors:</span>
              <button
                type="button"
                onClick={() => setCriteriaMatchMode("and")}
                className="rounded-full border px-1.5 py-0.5"
                style={{ borderColor: criteriaMatchMode === "and" ? "var(--accent)" : "var(--border)", opacity: criteriaMatchMode === "and" ? 1 : 0.6 }}
              >
                tags AND colors
              </button>
              <button
                type="button"
                onClick={() => setCriteriaMatchMode("or")}
                className="rounded-full border px-1.5 py-0.5"
                style={{ borderColor: criteriaMatchMode === "or" ? "var(--accent)" : "var(--border)", opacity: criteriaMatchMode === "or" ? 1 : 0.6 }}
              >
                tags OR colors
              </button>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
            Include notes
          </label>
          {notebooks.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setNotebookPickerOpen((o) => !o)}
                className="flex items-center gap-1 self-start text-xs font-medium hover:opacity-80"
                style={{ color: "var(--accent)" }}
              >
                {notebookPickerOpen ? "▾" : "▸"} Including {notebooks.length - excludedIds.size} of {notebooks.length} notebook
                {notebooks.length === 1 ? "" : "s"} — click to choose
              </button>
              {notebookPickerOpen && (
                <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-border p-1.5">
                  <div className="flex gap-2 border-b border-border pb-1 text-[10px]">
                    <button type="button" onClick={() => setExcludedIds(new Set())} className="opacity-60 hover:opacity-100">
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcludedIds(new Set(notebooks.map((n) => n.id)))}
                      className="opacity-60 hover:opacity-100"
                    >
                      None
                    </button>
                  </div>
                  {notebooks.map((n) => (
                    <label key={n.id} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={!excludedIds.has(n.id)}
                        onChange={(e) =>
                          setExcludedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.delete(n.id);
                            else next.add(n.id);
                            return next;
                          })
                        }
                      />
                      {n.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!hasActiveFilter ? (
            <p className="p-6 text-center text-sm opacity-60">Pick a tag and/or a color tier above to build a sheet.</p>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">No matches.</p>
          ) : (
            results.map((entry) => (
              <button
                key={entry.key}
                onClick={() =>
                  entry.kind === "highlight"
                    ? onNavigateHighlight(entry.highlight!)
                    : onNavigateNotebookAnchor(entry.anchor, entry.notebookId!)
                }
                className="block w-full rounded px-2 py-2 text-left hover:bg-[var(--border)]"
              >
                <EntryBody entry={entry} colorLabels={colorLabels} includeNotes={includeNotes} />
              </button>
            ))
          )}
        </div>
        {hasActiveFilter && results.length > 0 && (
          <div className="flex shrink-0 justify-end border-t border-border p-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-[var(--border)]"
            >
              🖨 Print / Save as PDF
            </button>
          </div>
        )}
      </div>

      {/* Isolated by the global `@media print` rule in globals.css — hidden on screen, the only
          thing visible when window.print() fires above. */}
      <div className="source-sheet-print-content">
        <h1>Source Sheet</h1>
        {filterSummary && <p className="source-sheet-print-summary">{filterSummary}</p>}
        {results.map((entry) => (
          <EntryBody key={entry.key} entry={entry} colorLabels={colorLabels} includeNotes={includeNotes} />
        ))}
      </div>
    </div>
  );
}
