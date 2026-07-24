"use client";

import { useEffect, useRef, useState } from "react";
import { toHebrewNumeral } from "@/lib/textModels";

/**
 * Generic scrollable number picker (chapter/daf/perek/siman), modeled on SASimanPicker.tsx's
 * modal chrome but without SA's title lookups — just an integer range. Lets mouse users jump to
 * a value by clicking rather than typing or repeatedly clicking a number input's spinner, and
 * (in hebrewMode) is the only on-screen place the value appears as a Hebrew numeral, since the
 * quick-jump field below stays Arabic-numeral (typing Hebrew letters into a text field isn't a
 * practical input method).
 */
export default function NumberPickerModal({
  min,
  max,
  current,
  onSelect,
  onClose,
  hebrewMode = false,
  label,
  labelFor,
}: {
  min: number;
  max: number;
  current: number;
  onSelect: (n: number) => void;
  onClose: () => void;
  hebrewMode?: boolean;
  label: string;
  /** Overrides the displayed label for specific values (e.g. Rambam's chapter 0 → "Header").
   *  Falls back to the normal numeral when it returns undefined. */
  labelFor?: (n: number) => string | undefined;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [jumpValue, setJumpValue] = useState(String(current));

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const numeral = (n: number) => labelFor?.(n) ?? (hebrewMode ? toHebrewNumeral(n) : String(n));

  // No "Go" button — typing a value and pressing Enter commits it immediately; clicking a row
  // below (the more common path) already navigates on click with no extra step either.
  const commitJump = () => {
    const n = parseInt(jumpValue, 10);
    if (Number.isFinite(n) && n >= min && n <= max) onSelect(n);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        dir={hebrewMode ? "rtl" : "ltr"}
        className="flex max-h-[80vh] w-full max-w-xs flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            {label}
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <input
            type="number"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitJump();
            }}
            min={min}
            max={max}
            className="w-16 shrink-0 rounded border border-border bg-background px-2 py-1 text-center text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => {
            const isActive = n === current;
            return (
              <button
                key={n}
                ref={isActive ? activeRef : undefined}
                onClick={() => onSelect(n)}
                className="flex w-full items-center rounded px-3 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-[var(--border)]"
                style={isActive ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
              >
                {numeral(n)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
