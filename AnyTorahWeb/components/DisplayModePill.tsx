"use client";

import type { TextDisplayMode } from "@/lib/textModels";

const DISPLAY_MODES: { mode: TextDisplayMode; label: string }[] = [
  { mode: "source", label: "א" },
  { mode: "both", label: "אA" },
  { mode: "translation", label: "A" },
];

/** Hebrew/English/both toggle — one instance in each panel's bottom-bar footer (see Reader.tsx's
 *  text panel and CommentaryPanel.tsx), sitting right next to that panel's FontSizeSlider.
 *  Sized to match the slider's compact footer height (text-xs, tight padding) rather than the
 *  larger pill this used to be back when it lived alone in the toolbar. */
export default function DisplayModePill({
  mode,
  onChange,
}: {
  mode: TextDisplayMode;
  onChange: (m: TextDisplayMode) => void;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-full border border-border text-xs">
      {DISPLAY_MODES.map(({ mode: m, label }) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="px-2 py-0.5 transition-colors"
          style={mode === m ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
