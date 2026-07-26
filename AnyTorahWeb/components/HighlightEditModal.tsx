"use client";

import { useEffect, useState } from "react";
import type { Highlight } from "@/lib/highlights";
import { DEFAULT_HIGHLIGHT_COLOR_INDEX } from "@/lib/highlightCategories";
import HighlightColorPicker from "./HighlightColorPicker";

/** Create/edit modal for a highlight anchored to a specific paragraph of main text or
 *  commentary. Chrome mirrors BookmarkEditModal.tsx / the reverted v1's NoteEditModal.tsx; the
 *  note body is a plain `<textarea>`, not a rich editor — this is the fast Kindle-style margin
 *  note, deliberately lighter-weight than the Notebook's rich-text document. */
export default function HighlightEditModal({
  existing,
  anchorQuoteHe,
  anchorQuoteEn,
  onSave,
  onDelete,
  onClose,
}: {
  existing: Highlight | null;
  anchorQuoteHe: string;
  anchorQuoteEn: string;
  onSave: (colorIndex: number, note: string | null, tags: string[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [colorIndex, setColorIndex] = useState(existing?.colorIndex ?? DEFAULT_HIGHLIGHT_COLOR_INDEX);
  const [note, setNote] = useState(existing?.note ?? "");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commitTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          {existing ? "Edit Highlight" : "New Highlight"}
        </h2>

        {(anchorQuoteHe || anchorQuoteEn) && (
          <div className="rounded border border-border bg-background px-2 py-1.5 text-xs opacity-60">
            {anchorQuoteHe && <p dir="rtl">{anchorQuoteHe}</p>}
            {anchorQuoteEn && <p>{anchorQuoteEn}</p>}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-60">Color — tap ✎ to assign a label or category name to the color</label>
          <HighlightColorPicker value={colorIndex} onChange={(i) => setColorIndex(i ?? colorIndex)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-60">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="A short margin note…"
            className="w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-60">Tags</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ background: "var(--border)" }}
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitTag();
                }
              }}
              onBlur={commitTag}
              placeholder="Add tag…"
              className="min-w-[80px] flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
        </div>

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
              onClick={() => onSave(colorIndex, note.trim() ? note.trim() : null, tags)}
              className="rounded-full px-3 py-1.5 text-sm"
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
