"use client";

import { useEffect, useState } from "react";
import type { Bookmark } from "@/lib/bookmarks";
import { matchesQuery } from "@/lib/bookmarks";

/** Searchable bookmark list, ported from native's BookmarkListView.swift. Tapping a row navigates
 *  and closes; editing a bookmark's notes happens via the bookmark toggle once you're back at
 *  that location, matching native (no dedicated edit-from-list affordance there either). */
export default function BookmarkListModal({
  bookmarks,
  onNavigate,
  onDelete,
  onClose,
}: {
  bookmarks: Bookmark[];
  onNavigate: (b: Bookmark) => void;
  onDelete: (b: Bookmark) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = query.trim() ? bookmarks.filter((b) => matchesQuery(b, query)) : bookmarks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Bookmarks
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="shrink-0 border-b border-border p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookmarks"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {bookmarks.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">
              Tap the bookmark icon while reading to save your place.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm opacity-60">No matches.</p>
          ) : (
            filtered.map((b) => (
              <div key={b.id} className="group flex items-start gap-2 rounded px-2 py-2 hover:bg-[var(--border)]">
                <button onClick={() => onNavigate(b)} className="flex-1 text-left">
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs opacity-60">{b.subtitle}</div>
                  {b.notes && <div className="mt-0.5 line-clamp-2 text-xs opacity-50">{b.notes}</div>}
                </button>
                <button
                  onClick={() => onDelete(b)}
                  aria-label="Delete bookmark"
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
