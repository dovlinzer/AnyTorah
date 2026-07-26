"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractPlainText,
  extractTags,
  formatNotebookScopeLabel,
  loadNotebooks,
  type Notebook,
} from "@/lib/notebooks";

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
 *  covers "search within" one already-open notebook. Chrome mirrors HighlightsListModal.tsx. */
export default function NotebookSearchModal({
  onNavigate,
  onClose,
}: {
  /** Navigates the reader to this notebook's scope, opens the panel, and seeds its in-doc find
   *  bar with the query that matched (so the user lands on the hit, not just the doc's top). */
  onNavigate: (notebook: Notebook, seedSearchTerm: string) => void;
  onClose: () => void;
}) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

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
      })),
    [notebooks],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const entry of indexed) for (const t of entry.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [indexed]);

  const q = query.trim().toLowerCase();
  const results = indexed.filter((entry) => {
    if (tagFilter && !entry.tags.includes(tagFilter)) return false;
    if (!q) return tagFilter !== null;
    return entry.text.toLowerCase().includes(q);
  });

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
                onClick={() => setTagFilter(null)}
                className="rounded-full border px-2 py-1 text-xs"
                style={{
                  borderColor: tagFilter === null ? "var(--accent)" : "var(--border)",
                  opacity: tagFilter === null ? 1 : 0.6,
                }}
              >
                All tags
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagFilter(t === tagFilter ? null : t)}
                  className="rounded-full border px-2 py-1 text-xs"
                  style={{
                    borderColor: tagFilter === t ? "var(--accent)" : "var(--border)",
                    opacity: tagFilter === t ? 1 : 0.6,
                  }}
                >
                  🏷 {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {notebooks.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">
              Open the notebook panel (📓) and start writing to create your first notebook.
            </p>
          ) : !q && tagFilter === null ? (
            <p className="p-6 text-center text-sm opacity-60">Type to search, or pick a tag above.</p>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">No matches.</p>
          ) : (
            results.map(({ notebook, text, tags }) => (
              <button
                key={notebook.scopeKey}
                onClick={() => onNavigate(notebook, query)}
                className="flex w-full flex-col items-start gap-1 rounded px-2 py-2 text-left hover:bg-[var(--border)]"
              >
                <div className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                  {formatNotebookScopeLabel(notebook.scope)}
                </div>
                {text.trim() && <div className="text-sm">{buildSnippet(text, query)}</div>}
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
