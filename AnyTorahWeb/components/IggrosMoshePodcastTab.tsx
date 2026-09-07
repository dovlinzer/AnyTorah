"use client";

import { useEffect, useState } from "react";
import { loadEpisodeThumbnail, type CitedEpisode } from "@/lib/iggrosMoshePodcasts";

/** "Here's where to find it" indicator for Iggros Moshe simanim discussed on the "Iggros Moshe A
 *  to Z" podcast (Rabbi Dov Linzer) — a small trailing-edge badge, not a player, mirroring
 *  native's own docked-tab pattern (see AnyTorah/CLAUDE.md's "Iggros Moshe podcast citations"
 *  section). Tapping it opens a list of matching episodes; tapping an episode opens it externally
 *  on SoundCloud — no in-app playback, an explicit non-goal on the native side too. */
export default function IggrosMoshePodcastTab({
  episodes,
  hebrewMode,
}: {
  episodes: CitedEpisode[];
  hebrewMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    setThumbnail(null);
    if (episodes.length === 0) return;
    let cancelled = false;
    loadEpisodeThumbnail(episodes[0].audioUrl).then((url) => {
      if (!cancelled) setThumbnail(url);
    });
    return () => {
      cancelled = true;
    };
  }, [episodes]);

  // Navigating to a siman with no citations while the sheet is open should close it rather than
  // leave an empty sheet floating with no badge left to have opened it.
  useEffect(() => {
    if (episodes.length === 0) setOpen(false);
  }, [episodes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (episodes.length === 0) return null;

  return (
    <div dir={hebrewMode ? "rtl" : "ltr"} className="pointer-events-none absolute inset-0">
      <button
        onClick={() => setOpen(true)}
        aria-label={hebrewMode ? "פרקי פודקאסט על סימן זה" : "Podcast episodes on this siman"}
        title={hebrewMode ? "פרקי פודקאסט על סימן זה" : "Podcast episodes on this siman"}
        className="pointer-events-auto absolute bottom-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-black/70 bg-cover bg-center shadow-lg transition-transform hover:scale-105"
        style={{ insetInlineEnd: 16, backgroundImage: thumbnail ? `url(${thumbnail})` : undefined }}
      >
        {!thumbnail && <span className="text-2xl">🎧</span>}
        {thumbnail && (
          <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/70 px-1 py-0.5 text-[10px] leading-none">
            🎧
          </span>
        )}
        {episodes.length > 1 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--accent-foreground)]">
            {episodes.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {hebrewMode ? "פרקי פודקאסט" : "Podcast episodes"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {episodes.map((ep) => (
                <EpisodeRow key={ep.id} episode={ep} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EpisodeRow({ episode }: { episode: CitedEpisode }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEpisodeThumbnail(episode.audioUrl).then((url) => {
      if (!cancelled) setThumbnail(url);
    });
    return () => {
      cancelled = true;
    };
  }, [episode.audioUrl]);

  return (
    <a
      href={episode.audioUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded px-2 py-2 hover:bg-[var(--border)]"
    >
      <div
        className="h-12 w-12 shrink-0 overflow-hidden rounded bg-black/10 bg-cover bg-center"
        style={{ backgroundImage: thumbnail ? `url(${thumbnail})` : undefined }}
      >
        {!thumbnail && <div className="flex h-full w-full items-center justify-center text-lg">🎧</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{episode.title}</div>
        <div className="text-xs opacity-60">Episode {episode.episodeNumber}</div>
      </div>
    </a>
  );
}
