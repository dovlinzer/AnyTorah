"use client";

import { useEffect, useRef } from "react";
import { getSATopicSections, getSASimanTitle } from "@/lib/saSimanHelpers";
import { toHebrewNumeral } from "@/lib/textModels";

export default function SASimanPicker({
  section,
  currentSiman,
  onSelect,
  onClose,
  hebrewMode = false,
}: {
  section: number;
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

  const topicSections = getSATopicSections(section, hebrewMode);
  const simanLabel = (n: number) => (hebrewMode ? toHebrewNumeral(n) : String(n));

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
            {hebrewMode ? "בחר סימן" : "Select Siman"}
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
          {topicSections.map((topic, i) => (
            <div key={`${topic.name}-${i}`} className="mb-3">
              <div className="sticky top-0 bg-card px-2 py-1 text-xs font-medium opacity-50">
                {topic.name} ({simanLabel(topic.start)}
                {topic.end !== topic.start ? `–${simanLabel(topic.end)}` : ""})
              </div>
              <div>
                {Array.from({ length: topic.end - topic.start + 1 }, (_, i) => topic.start + i).map(
                  (siman) => {
                    const title = getSASimanTitle(section, siman, hebrewMode);
                    const isActive = siman === currentSiman;
                    return (
                      <button
                        key={siman}
                        ref={isActive ? activeRef : undefined}
                        onClick={() => onSelect(siman)}
                        className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--border)]"
                        style={isActive ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
                      >
                        <span className="w-8 shrink-0 text-right tabular-nums opacity-70">{simanLabel(siman)}</span>
                        <span className="truncate">{title ?? <span className="opacity-50">—</span>}</span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
