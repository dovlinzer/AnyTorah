"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HIGHLIGHT_CATEGORY_COUNT } from "@/lib/highlightCategories";

const POPOVER_EST_WIDTH = 150;
const POPOVER_EST_HEIGHT = 56;
const VIEWPORT_MARGIN = 8;

/** Wraps a paragraph/segment so clicking it opens either a color-swatch popover (unhighlighted —
 *  creates the highlight) or the full note editor directly (already highlighted — onOpenEditor,
 *  which also has delete). The actual highlight color is *not* painted here: callers wrap just
 *  the anchored text itself in `.highlight-text-N` (globals.css) so the color hugs the text
 *  rather than stretching across this wrapper's full width. */
export default function HighlightMark({
  colorIndex,
  onQuickPick,
  onOpenEditor,
  className = "",
  children,
}: {
  colorIndex: number | null;
  onQuickPick: (colorIndex: number) => void;
  onOpenEditor: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fixed positioning (computed from the trigger's viewport rect, flipping above when there's
  // no room below) rather than the usual absolute-under-the-trigger approach — the reading
  // panels are `overflow-y-auto` columns, and an absolutely-positioned popover gets clipped by
  // that ancestor's overflow whenever the clicked paragraph sits near the bottom of the visible
  // scroll area. `position: fixed` isn't clipped by ancestor overflow, so this stays visible
  // regardless of where in the panel the paragraph is.
  useLayoutEffect(() => {
    if (!pickerOpen) {
      // Resetting on close, synchronous by design so the popover unmounts immediately rather
      // than lagging a frame behind pickerOpen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPopoverPos(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const opensUp = rect.bottom + POPOVER_EST_HEIGHT + VIEWPORT_MARGIN > window.innerHeight;
    const top = opensUp ? rect.top - POPOVER_EST_HEIGHT - 4 : rect.bottom + 4;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left + rect.width / 2 - POPOVER_EST_WIDTH / 2, window.innerWidth - POPOVER_EST_WIDTH - VIEWPORT_MARGIN),
    );
    // Measuring the trigger's DOM rect and deriving position from it is exactly the case
    // react.dev calls out as a legitimate synchronous setState-in-effect (measure, then adjust
    // layout before paint) — not this codebase's other, tolerated instances of this rule (those
    // are all "load a persisted value from localStorage on mount").
    setPopoverPos({ top, left });

    const close = () => setPickerOpen(false);
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pickerOpen]);

  return (
    <div
      ref={containerRef}
      className={`highlight-mark ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        if (colorIndex === null) setPickerOpen((o) => !o);
        else onOpenEditor();
      }}
    >
      {children}
      {pickerOpen && popoverPos && (
        <div
          className="fixed z-50 flex flex-wrap gap-1.5 rounded-lg border border-border bg-card p-2 shadow-xl"
          style={{ top: popoverPos.top, left: popoverPos.left, minWidth: POPOVER_EST_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          {Array.from({ length: HIGHLIGHT_CATEGORY_COUNT }, (_, i) => i).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onQuickPick(i);
                setPickerOpen(false);
              }}
              className={`highlight-dot highlight-dot-${i}`}
              aria-label={`Highlight, color ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
