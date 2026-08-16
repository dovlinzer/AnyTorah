"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadTalmudPages,
  dafImageFileId,
  dafImageUrl,
  dafImageProxyUrl,
  type TalmudPages,
} from "@/lib/talmudPages";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/** Scanned Vilna Shas page for the given daf/amud, shown in a zoomable/pannable pane — the wheel
 * or the slider zooms, and dragging (mouse or touch, once zoomed past 1x) pans. Zooming always
 * keeps whatever's under the zoom anchor (the cursor for wheel, the pane's own center for the
 * slider) fixed on screen, so it doesn't fling the section you're looking at off to one side. */
export default function DafImagePanel({
  tractateSefariaName,
  daf,
  side,
}: {
  tractateSefariaName: string;
  daf: number;
  side: "a" | "b";
}) {
  const [pages, setPages] = useState<TalmudPages | null>(null);
  const [imgError, setImgError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTalmudPages().then((p) => {
      if (!cancelled) setPages(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setImgError(false);
    setNaturalSize(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [tractateSefariaName, daf, side]);

  const clampTranslate = (tx: number, ty: number, s: number, w: number, h: number) => ({
    x: Math.min(0, Math.max(w * (1 - s), tx)),
    y: Math.min(0, Math.max(h * (1 - s), ty)),
  });

  // Re-scales to `nextScaleRaw`, solving for the translate that keeps the content currently under
  // (anchorX, anchorY) — container-local pixels — at that same screen position afterward.
  const zoomTo = (nextScaleRaw: number, anchorX: number, anchorY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScaleRaw));
    if (nextScale === scale) return;
    const contentX = (anchorX - translate.x) / scale;
    const contentY = (anchorY - translate.y) / scale;
    const rawTx = anchorX - contentX * nextScale;
    const rawTy = anchorY - contentY * nextScale;
    setScale(nextScale);
    setTranslate(clampTranslate(rawTx, rawTy, nextScale, rect.width, rect.height));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomTo(scale * factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleSliderChange = (value: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    zoomTo(value, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
  };

  const resetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: translate.x, startTy: translate.y };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTranslate(
      clampTranslate(dragRef.current.startTx + dx, dragRef.current.startTy + dy, scale, rect.width, rect.height),
    );
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  if (!pages) {
    return <p className="p-4 text-center text-sm opacity-60">Loading daf image…</p>;
  }

  const fileId = dafImageFileId(pages, tractateSefariaName, daf, side === "a");

  if (!fileId) {
    return (
      <p className="p-4 text-center text-sm opacity-60">
        No scanned image for {tractateSefariaName} {daf}{side}.
      </p>
    );
  }

  if (imgError) {
    return <p className="p-4 text-center text-sm opacity-60">Image unavailable.</p>;
  }

  // The <img> src goes through our own /api/dafImage proxy (server-side fetch, no browser
  // cookies/referrer involved) rather than hitting Drive directly from the browser — see
  // app/api/dafImage/route.ts for why. The "Full size" link still points straight at Drive since
  // a top-level navigation doesn't have that problem.
  const directUrl = dafImageUrl(pages, tractateSefariaName, daf, side === "a")!;

  return (
    <div>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        className="relative w-full touch-none select-none overflow-hidden rounded bg-black/5"
        style={{
          aspectRatio: naturalSize ? `${naturalSize.w} / ${naturalSize.h}` : "3 / 4",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- proxied external image, not a local asset */}
        <img
          src={dafImageProxyUrl(fileId)}
          alt={`${tractateSefariaName} ${daf}${side}`}
          draggable={false}
          onError={() => setImgError(true)}
          onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="absolute left-0 top-0 h-full w-full"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs opacity-70">
        <button
          onClick={resetZoom}
          disabled={scale === 1}
          className="w-10 shrink-0 text-left disabled:opacity-40"
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.05}
          value={scale}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="h-1 flex-1 accent-[var(--accent)]"
          aria-label="Zoom"
        />
        <a
          href={directUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 underline decoration-dotted"
          title="Open full size in a new tab"
        >
          Full size
        </a>
      </div>
    </div>
  );
}
