"use client";

import { useEffect, useState } from "react";
import type { Bookmark } from "@/lib/bookmarks";

/** Create/edit sheet for the bookmark at the current reading location, ported from native's
 *  BookmarkEditSheet.swift. */
export default function BookmarkEditModal({
  existing,
  defaultName,
  subtitle,
  onSave,
  onDelete,
  onClose,
}: {
  existing: Bookmark | null;
  defaultName: string;
  subtitle: string;
  onSave: (name: string, notes: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? defaultName);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          {existing ? "Edit Bookmark" : "New Bookmark"}
        </h2>

        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-60">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-60">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add notes…"
            className="resize-none rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>

        <p className="text-xs opacity-50">{subtitle}</p>

        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <button onClick={onDelete} className="text-sm text-red-500 hover:underline">
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full border border-border px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button
              onClick={() => onSave(name, notes)}
              disabled={!name.trim()}
              className="rounded-full px-3 py-1.5 text-sm disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
