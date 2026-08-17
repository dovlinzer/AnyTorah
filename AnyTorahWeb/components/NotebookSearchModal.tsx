"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractColoredRuns,
  extractPlainText,
  extractTags,
  loadNotebooks,
  notebookSubtitle,
  type Notebook,
} from "@/lib/notebooks";
import { HIGHLIGHT_CATEGORY_COUNT, loadHighlightCategoryLabels } from "@/lib/highlightCategories";
import { matchesQuery, type Highlight } from "@/lib/highlights";
import { buildSubtitle } from "@/lib/bookmarks";

const SNIPPET_RADIUS = 60;

/** Case-insensitive substring window around the first match, for a legible result preview
 *  without re-navigating to the notebook — same rationale as Highlights' anchorQuote snapshot. */
function buildSnippet(text: string, query: string): string {
  if (!query.trim()) return text.slice(0, SNIPPET_RADIUS * 2).trim();
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_RADIUS * 2).trim();
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + query.trim().length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Searches across every notebook's flattened text (prose + anchor labels + tag labels, see
 *  lib/notebooks.ts's extractPlainText) rather than just one open document — this is the "search
 *  between notebooks" half of Notebook search; NotebookPanel's own find bar (SearchExtension)
 *  covers "search within" one already-open notebook. Filterable by which notebooks to include
 *  and by highlighted-section color, on top of the tag filter. Chrome mirrors
 *  HighlightsListModal.tsx. */
export default function NotebookSearchModal({
  highlights,
  onNavigate,
  onNavigateHighlight,
  onClose,
}: {
  /** All of the user's highlights — passed down rather than loaded here, since Reader.tsx already
   *  owns/loads this array for HighlightsListModal and keeps it in sync with edits made elsewhere. */
  highlights: Highlight[];
  /** Navigates the reader to this notebook's scope, opens the panel, and seeds its in-doc find
   *  bar with the query that matched (so the user lands on the hit, not just the doc's top). */
  onNavigate: (notebook: Notebook, seedSearchTerm: string) => void;
  /** Navigates the reader straight to a highlight's anchor location (no notebook panel involved)
   *  — mirrors HighlightsListModal's own onNavigate. */
  onNavigateHighlight: (h: Highlight) => void;
  onClose: () => void;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [query, setQuery] = useState("");
  // A Set, not a single value — plain click selects just that one tag; Ctrl/Cmd-click toggles it
  // into/out of the current selection (OR: a result matches if it carries *any* selected tag).
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [colorFilter, setColorFilter] = useState<number | null>(null);
  const [colorLabels] = useState<string[]>(() => loadHighlightCategoryLabels());
  // Opt-in — cross-notebook search predates Highlights integration, so this stays off by default
  // rather than silently widening every existing search's results.
  const [includeHighlights, setIncludeHighlights] = useState(false);

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
  // Empty = every notebook included — tracking exclusions (rather than a positive selection set)
  // means newly-loaded notebooks default to "included" without needing to pre-populate anything.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  // Open by default — a collapsed-by-default picker turned out to be easy to miss entirely
  // during live testing; collapsing is still available to save space once someone has many
  // notebooks, but discoverability wins by default.
  const [notebookPickerOpen, setNotebookPickerOpen] = useState(true);

  useEffect(() => setNotebooks(loadNotebooks()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const indexed = useMemo(
    () =>
      notebooks.map((n) => ({
        notebook: n,
        text: extractPlainText(n.bodyJSON),
        tags: extractTags(n.bodyJSON).map((t) => t.label),
        coloredRuns: extractColoredRuns(n.bodyJSON),
      })),
    [notebooks],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const entry of indexed) for (const t of entry.tags) set.add(t);
    if (includeHighlights) for (const h of highlights) for (const t of h.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [indexed, includeHighlights, highlights]);

  const q = query.trim().toLowerCase();
  const hasActiveFilter = !!q || tagFilters.size > 0 || colorFilter !== null;
  const results = indexed
    .filter((entry) => !excludedIds.has(entry.notebook.id))
    .filter((entry) => tagFilters.size === 0 || entry.tags.some((t) => tagFilters.has(t)))
    .filter((entry) => colorFilter === null || entry.coloredRuns.some((r) => r.colorIndex === colorFilter))
    .filter((entry) => {
      if (!q) return tagFilters.size > 0 || colorFilter !== null;
      return entry.text.toLowerCase().includes(q);
    });

  // Same three filters (text/tag/color) reused against highlights, so "yellow" or a tag name
  // turns up matches from both surfaces at once — the whole point of this toggle. matchesQuery
  // (lib/highlights.ts) already covers text/tag/note substring matching the same way
  // HighlightsListModal's own search does.
  const highlightResults = useMemo(() => {
    if (!includeHighlights) return [];
    const trimmed = query.trim();
    return highlights
      .filter((h) => colorFilter === null || h.colorIndex === colorFilter)
      .filter((h) => tagFilters.size === 0 || h.tags.some((t) => tagFilters.has(t)))
      .filter((h) => {
        if (!trimmed) return tagFilters.size > 0 || colorFilter !== null;
        return matchesQuery(h, trimmed);
      });
  }, [includeHighlights, highlights, colorFilter, tagFilters, query]);

  const includedCount = notebooks.length - excludedIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Search Notebooks
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all notebooks"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTagFilters(new Set())}
                className="rounded-full border px-2 py-1 text-xs"
                style={{
                  borderColor: tagFilters.size === 0 ? "var(--accent)" : "var(--border)",
                  opacity: tagFilters.size === 0 ? 1 : 0.6,
                }}
              >
                All tags
              </button>
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
              {tagFilters.size > 1 && <span className="text-[10px] opacity-50">any of {tagFilters.size} tags</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] opacity-50">Highlighted:</span>
            {Array.from({ length: HIGHLIGHT_CATEGORY_COUNT }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setColorFilter(colorFilter === i ? null : i)}
                title={`Notebooks with a ${colorLabels[i]} highlighted section`}
                aria-label={`Filter to ${colorLabels[i]} highlighted sections`}
                aria-pressed={colorFilter === i}
                className={`highlight-dot highlight-dot-${i}`}
                style={colorFilter === i ? { transform: "scale(1.25)", opacity: 1 } : undefined}
              />
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={includeHighlights} onChange={(e) => setIncludeHighlights(e.target.checked)} />
            Also search highlights
          </label>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setNotebookPickerOpen((o) => !o)}
              className="flex items-center gap-1 self-start text-xs font-medium hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              {notebookPickerOpen ? "▾" : "▸"} Searching {includedCount} of {notebooks.length} notebook
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
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {notebooks.length === 0 && !includeHighlights ? (
            <p className="p-6 text-center text-sm opacity-60">
              Open the notebook panel (📓) and start writing to create your first notebook.
            </p>
          ) : !hasActiveFilter ? (
            <p className="p-6 text-center text-sm opacity-60">Type to search, or pick a tag/color above.</p>
          ) : results.length === 0 && highlightResults.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">No matches.</p>
          ) : (
            <>
              {includeHighlights && highlightResults.length > 0 && results.length > 0 && (
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide opacity-50">Notebooks</div>
              )}
              {results.map(({ notebook, text, tags, coloredRuns }) => {
                const colorSnippet = colorFilter !== null ? coloredRuns.find((r) => r.colorIndex === colorFilter)?.text : undefined;
                const snippet = q ? buildSnippet(text, query) : (colorSnippet ?? text.slice(0, SNIPPET_RADIUS * 2)).trim();
                return (
                  <button
                    key={notebook.id}
                    onClick={() => onNavigate(notebook, query)}
                    className="flex w-full flex-col items-start gap-1 rounded px-2 py-2 text-left hover:bg-[var(--border)]"
                  >
                    <div className="flex w-full items-baseline gap-1.5">
                      <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                        {notebook.name}
                      </span>
                      <span className="text-[10px] opacity-50">{notebookSubtitle(notebook.scope)}</span>
                    </div>
                    {snippet && (
                      <div className={colorSnippet && !q ? `highlight-text highlight-text-${colorFilter}` : "text-sm"}>
                        {snippet}
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t, i) => (
                          <span
                            key={`${t}-${i}`}
                            className="rounded-full px-1.5 py-0.5 text-[10px]"
                            style={{ background: "var(--border)" }}
                          >
                            🏷 {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
              {includeHighlights && highlightResults.length > 0 && (
                <>
                  {results.length > 0 && (
                    <div className="mt-2 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide opacity-50">Highlights</div>
                  )}
                  {highlightResults.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => onNavigateHighlight(h)}
                      className="flex w-full items-start gap-2 rounded px-2 py-2 text-left hover:bg-[var(--border)]"
                    >
                      <span className={`highlight-dot highlight-dot-${h.colorIndex} mt-1 shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs opacity-60">
                          {buildSubtitle(h.anchor.category, h.anchor.index, h.anchor.chapter, h.anchor.halakha)}
                        </div>
                        <div className="text-sm font-medium">{h.anchorQuoteEn || h.anchorQuoteHe}</div>
                        {h.note && <div className="mt-0.5 line-clamp-2 text-xs opacity-50">{h.note}</div>}
                        {h.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {h.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full px-1.5 py-0.5 text-[10px]"
                                style={{ background: "var(--border)" }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
