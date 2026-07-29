"use client";

import { useEffect, useMemo, useState } from "react";
import type { Highlight } from "@/lib/highlights";
import { matchesQuery } from "@/lib/highlights";
import { buildSubtitle } from "@/lib/bookmarks";
import HighlightColorPicker from "./HighlightColorPicker";

/** Searchable/filterable highlights list, mirroring BookmarkListModal.tsx / the reverted v1's
 *  NotesListModal.tsx chrome. Tapping a row navigates to its location and closes; editing
 *  happens via the highlight's indicator dot once you're back at that location (same "no
 *  dedicated edit-from-list" pattern as bookmarks). */
export default function HighlightsListModal({
  highlights,
  onNavigate,
  onDelete,
  onClose,
}: {
  highlights: Highlight[];
  onNavigate: (h: Highlight) => void;
  onDelete: (h: Highlight) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<number | null>(null);
  // A Set, not a single value — plain click selects just that one tag; Ctrl/Cmd-click toggles it
  // into/out of the current selection, so several tags can be active at once (OR: a highlight
  // matches if it carries *any* selected tag). See toggleTagFilter below.
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());

  const toggleTagFilter = (t: string, additive: boolean) => {
    setTagFilters((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(t)) next.delete(t);
        else next.add(t);
        return next;
      }
      // Plain click on the only currently-selected tag clears the filter; otherwise it replaces
      // the whole selection with just this tag (dropping any multi-select from Ctrl/Cmd-clicks).
      return prev.size === 1 && prev.has(t) ? new Set() : new Set([t]);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const h of highlights) for (const t of h.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [highlights]);

  const filtered = highlights
    .filter((h) => colorFilter === null || h.colorIndex === colorFilter)
    .filter((h) => tagFilters.size === 0 || h.tags.some((t) => tagFilters.has(t)))
    .filter((h) => !query.trim() || matchesQuery(h, query));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Highlights
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search highlights"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <HighlightColorPicker value={colorFilter} onChange={setColorFilter} allowClear />
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
                  {t}
                </button>
              ))}
              {tagFilters.size > 1 && <span className="text-[10px] opacity-50">any of {tagFilters.size} tags</span>}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {highlights.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">
              Click the dot next to a verse or commentary line while reading to add a highlight.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">No matches.</p>
          ) : (
            filtered.map((h) => (
              <div key={h.id} className="group flex items-start gap-2 rounded px-2 py-2 hover:bg-[var(--border)]">
                <span className={`highlight-dot highlight-dot-${h.colorIndex} mt-1 shrink-0`} />
                <button onClick={() => onNavigate(h)} className="flex-1 text-left">
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
                </button>
                <button
                  onClick={() => onDelete(h)}
                  aria-label="Delete highlight"
                  className="shrink-0 rounded px-2 py-1 text-xs opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-60"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
