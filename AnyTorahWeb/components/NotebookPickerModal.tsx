"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatNotebookScopeLabel,
  notebookProminenceTier,
  notebookSubtitle,
  rankNotebooksByProminence,
  type Notebook,
  type NotebookScope,
} from "@/lib/notebooks";

type CreateOption = { key: string; label: string; scope?: NotebookScope };

/** "Which notebook do you want open" — the 📓 header button's picker (Reader.tsx always opens
 *  this, whether or not a notebook is already pinned open) and also what the cross-notebook
 *  search/source-sheet "choose a notebook" affordances could reuse in the future. Replaces the
 *  old behavior of silently auto-opening (or auto-creating) a notebook scoped to wherever the
 *  reader happened to be — see lib/notebooks.ts's module comment and AnyTorahWeb/CLAUDE.md's
 *  "Notebook identity redesign" for why: a notebook's scope is no longer its identity, so there's
 *  no longer one single "right" notebook for a given reading location to jump to automatically.
 *
 *  English-only, like every other modal in this app (HighlightsListModal, NotebookSearchModal,
 *  SourceSheetModal, BookmarkEditModal, ...) — Hebrew mode only affects the reader's own text and
 *  the persistent NotebookPanel side panel, never pop-up chrome like this. */
export default function NotebookPickerModal({
  currentScope,
  notebooks,
  onSelect,
  onCreate,
  onClose,
}: {
  /** Wherever the reader currently is — drives the quick-create options' default scopes/names and
   *  the existing-notebooks list's prominence ordering. Never itself opened automatically; purely
   *  a hint for what this modal offers/ranks. */
  currentScope: NotebookScope;
  notebooks: Notebook[];
  /** Pin an existing notebook open and close the picker. */
  onSelect: (id: string) => void;
  /** Create a brand-new notebook with this name/scope, pin it open, and close the picker. */
  onCreate: (name: string, scope: NotebookScope | undefined) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Quick-create options, in order: general (no scope) always first, then the current book's main
  // text, then — only when the reader is actually inside a commentary right now, since otherwise
  // it would just duplicate the book-level option — that exact commentary-on-book scope.
  const bookScope: NotebookScope = { category: currentScope.category, index: currentScope.index, source: "main" };
  const createOptions: CreateOption[] = [
    { key: "general", label: "New general notebook" },
    { key: "book", label: `New notebook on ${formatNotebookScopeLabel(bookScope)}`, scope: bookScope },
  ];
  if (currentScope.source === "commentary" && currentScope.commentaryType) {
    createOptions.push({
      key: "exact",
      label: `New notebook on ${formatNotebookScopeLabel(currentScope)}`,
      scope: currentScope,
    });
  }

  // null = showing the create-option buttons + existing list; set = showing the name-entry form
  // for whichever option was clicked.
  const [creating, setCreating] = useState<CreateOption | null>(null);
  const [name, setName] = useState("");

  const startCreating = (option: CreateOption) => {
    setCreating(option);
    setName(option.scope ? formatNotebookScopeLabel(option.scope) : "General Notebook");
  };

  const sortedNotebooks = useMemo(() => rankNotebooksByProminence(notebooks, currentScope), [notebooks, currentScope]);
  // Tiers 0/1 (this exact scope, or same book) render as a visually distinct "related" group above
  // a subtle divider from tier 2 (everything else) — per explicit request, so prominence reads as
  // more than just list order. rankNotebooksByProminence already sorted both groups internally.
  const relatedNotebooks = sortedNotebooks.filter((n) => notebookProminenceTier(n, currentScope) < 2);
  const otherNotebooks = sortedNotebooks.filter((n) => notebookProminenceTier(n, currentScope) === 2);

  const notebookRow = (n: Notebook, related: boolean) => (
    <button
      key={n.id}
      onClick={() => onSelect(n.id)}
      className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-2 text-left hover:bg-[var(--border)]"
    >
      <span className="text-sm font-medium" style={related ? { color: "var(--accent)" } : undefined}>
        {n.name}
      </span>
      <span className="text-xs opacity-50">{notebookSubtitle(n.scope)}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Notebooks
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>

        {creating ? (
          <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-60">Notebook name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) onCreate(name.trim(), creating.scope);
                }}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
              <p className="text-[10px] opacity-50">{notebookSubtitle(creating.scope)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(null)} className="rounded-full border border-border px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                onClick={() => name.trim() && onCreate(name.trim(), creating.scope)}
                disabled={!name.trim()}
                className="rounded-full px-3 py-1.5 text-sm disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Create
              </button>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-1 border-b border-border p-2">
            {createOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => startCreating(o)}
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--border)]"
              >
                + {o.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {sortedNotebooks.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">
              You don&apos;t have any notebooks yet — create one above.
            </p>
          ) : (
            <>
              {relatedNotebooks.map((n) => notebookRow(n, true))}
              {relatedNotebooks.length > 0 && otherNotebooks.length > 0 && (
                <div className="my-1.5 border-t border-border" />
              )}
              {otherNotebooks.map((n) => notebookRow(n, false))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
