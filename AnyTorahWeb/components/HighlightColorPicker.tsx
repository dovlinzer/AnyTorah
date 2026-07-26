"use client";

import { useState } from "react";
import {
  HIGHLIGHT_CATEGORY_COUNT,
  loadHighlightCategoryLabels,
  saveHighlightCategoryLabels,
} from "@/lib/highlightCategories";

/** Shared color swatch row: fixed colors (.highlight-dot-N, globals.css), user-editable labels.
 *  Used both to pick a highlight's color (value/onChange, a concrete index) and to filter the
 *  highlights list (allowClear, value can be null = "all"). Renaming a label here updates
 *  localStorage directly — every highlight references colorIndex, never the label text, so a
 *  rename never touches existing highlights. Ported from the reverted v1's
 *  NoteCategoryPicker.tsx (backup/anchored-notes-v1 branch). */
export default function HighlightColorPicker({
  value,
  onChange,
  allowClear = false,
}: {
  value: number | null;
  onChange: (index: number | null) => void;
  allowClear?: boolean;
}) {
  const [labels, setLabels] = useState<string[]>(() => loadHighlightCategoryLabels());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditText(labels[i]);
  };

  const commitEdit = () => {
    if (editingIndex === null) return;
    const next = labels.slice();
    next[editingIndex] = editText.trim() || labels[editingIndex];
    setLabels(next);
    saveHighlightCategoryLabels(next);
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowClear && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-full border px-2 py-1 text-xs"
          style={{
            borderColor: value === null ? "var(--accent)" : "var(--border)",
            opacity: value === null ? 1 : 0.6,
          }}
        >
          All
        </button>
      )}
      {Array.from({ length: HIGHLIGHT_CATEGORY_COUNT }, (_, i) => i).map((i) => (
        <div key={i} className="flex items-center gap-1">
          {editingIndex === i ? (
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingIndex(null);
              }}
              className="w-24 rounded border border-border bg-background px-1 py-0.5 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => onChange(i)}
              className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
              style={{
                borderColor: value === i ? "var(--accent)" : "var(--border)",
                opacity: value === i ? 1 : 0.6,
              }}
            >
              <span className={`highlight-dot highlight-dot-${i}`} />
              {labels[i]}
            </button>
          )}
          <button
            type="button"
            onClick={() => startEdit(i)}
            className="text-xs opacity-55 hover:opacity-100"
            aria-label={`Rename ${labels[i]}`}
            title={`Rename ${labels[i]}`}
          >
            ✎
          </button>
        </div>
      ))}
    </div>
  );
}
