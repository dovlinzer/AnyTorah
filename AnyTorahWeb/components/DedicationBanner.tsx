"use client";

import { useEffect, useState } from "react";
import { periodTitle, formattedMessage, type Dedication } from "@/lib/dedicationService";

// Shown once per browser/day, matching native's "check once per day" behavior — except native
// only marks the day as checked when a dedication was actually found (empty days re-check on
// next launch), which this mirrors: the localStorage date is only written when we have something
// to show.
const LAST_SHOWN_KEY = "anytorah:lastDedicationShown";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DedicationBanner() {
  const [dedication, setDedication] = useState<Dedication | null>(null);

  useEffect(() => {
    const today = todayStr();
    let lastShown: string | null = null;
    try {
      lastShown = window.localStorage.getItem(LAST_SHOWN_KEY);
    } catch {
      // localStorage unavailable — just re-check every load.
    }
    if (lastShown === today) return;

    fetch("/api/dedication")
      .then((res) => res.json())
      .then((json: { dedication: Dedication | null }) => {
        if (json.dedication) {
          setDedication(json.dedication);
          try {
            window.localStorage.setItem(LAST_SHOWN_KEY, today);
          } catch {
            // localStorage unavailable — will just show again next load.
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!dedication) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDedication(null)}>
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {dedication.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- proxied remote image, next/image adds no value here
          <img
            src={`/api/dedicationPhoto?path=${encodeURIComponent(dedication.photoUrl)}`}
            alt=""
            className="h-40 w-40 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="text-5xl" style={{ color: "var(--accent)" }}>
            📖
          </div>
        )}
        <h2 className="text-lg font-semibold">{periodTitle(dedication.period)}</h2>
        <p className="text-sm opacity-90">{formattedMessage(dedication)}</p>
        <button
          onClick={() => setDedication(null)}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          Continue Learning
        </button>
      </div>
    </div>
  );
}
