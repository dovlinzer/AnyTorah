"use client";

import { useEffect, useRef } from "react";
import { NISHMAT_HABAYIT_SIMANIM } from "@/lib/textModels";

/** Nishmat HaBayit has no numeric Siman address on Sefaria — each responsum is an individually
 *  titled node grouped into 5 real Parts (Pregnancy/Birth/Pregnancy Loss/Nursing/Contraception).
 *  This mirrors SASimanPicker's grouped-list shape, but groups by consecutive `partEnglish`/
 *  `partHebrew` runs (the data is already declared in Part order) instead of a separate topic
 *  lookup, and shows each responsum's real title instead of a bare siman number. */
export default function NishmatHaBayitSimanPicker({
  currentSiman,
  onSelect,
  onClose,
  hebrewMode = false,
}: {
  currentSiman: number;
  onSelect: (siman: number) => void;
  onClose: () => void;
  hebrewMode?: boolean;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

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

  const groups: { part: string; entries: typeof NISHMAT_HABAYIT_SIMANIM }[] = [];
  for (const entry of NISHMAT_HABAYIT_SIMANIM) {
    const part = hebrewMode ? entry.partHebrew : entry.partEnglish;
    const last = groups[groups.length - 1];
    if (last && last.part === part) last.entries.push(entry);
    else groups.push({ part, entries: [entry] });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        dir={hebrewMode ? "rtl" : "ltr"}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            {hebrewMode ? "בחר תשובה" : "Select Responsum"}
          </h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.part} className="mb-3">
              <div className="sticky top-0 bg-card px-2 py-1 text-xs font-medium opacity-50">
                {group.part}
              </div>
              <div>
                {group.entries.map((entry) => {
                  const isActive = entry.number === currentSiman;
                  return (
                    <button
                      key={entry.number}
                      ref={isActive ? activeRef : undefined}
                      onClick={() => onSelect(entry.number)}
                      className="flex w-full items-start gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--border)]"
                      style={isActive ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
                    >
                      <span className="mt-0.5 w-6 shrink-0 text-right tabular-nums opacity-70">{entry.number}</span>
                      <span>{hebrewMode ? entry.titleHebrew : entry.titleEnglish}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
