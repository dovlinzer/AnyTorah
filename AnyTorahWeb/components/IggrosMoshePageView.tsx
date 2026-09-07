"use client";

import { useEffect, useRef, useState } from "react";
import { dafImageProxyUrl } from "@/lib/talmudPages";
import { loadTeshuvotPages, teshuvotImageFileId, type TeshuvotPages } from "@/lib/teshuvotPageManager";

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
// Starts zoomed out to half size so a full (typically portrait, taller-than-the-reading-column)
// page fits on screen without scrolling — 100% ("fit width") is often still too tall to see the
// whole page at once, unlike Talmud's daf images (DafImagePanel), which stay at a 1x floor since
// their own aspect ratio rarely overflows the viewport the same way.
const DEFAULT_SCALE = 0.5;

/** Scanned Iggros Moshe page, shown in a zoomable/pannable pane — same click/scroll-wheel-zoom +
 *  drag-to-pan interaction as DafImagePanel (Talmud's own scanned-page viewer), adapted rather
 *  than shared: the two evolved from different lookup shapes (Talmud's daf/amud arithmetic vs.
 *  Iggros Moshe's siman->page index) and a forced shared abstraction would cost more than the
 *  ~90% code overlap saves — same reasoning native's own CLAUDE.md gives for keeping
 *  ContemporaryTeshuvotPageView and DafPageView separate on that side. */
export default function IggrosMoshePageView({
  volumeId,
  page,
  label,
}: {
  volumeId: string;
  page: number | null;
  label: string;
}) {
  const [pages, setPages] = useState<TeshuvotPages | null>(null);
  const [imgError, setImgError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTeshuvotPages().then((p) => {
      if (!cancelled) setPages(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setImgError(false);
    setNaturalSize(null);
    setScale(DEFAULT_SCALE);
    setTranslate({ x: 0, y: 0 });
  }, [volumeId, page]);

  const clampTranslate = (tx: number, ty: number, s: number, w: number, h: number) => ({
    x: Math.min(0, Math.max(w * (1 - s), tx)),
    y: Math.min(0, Math.max(h * (1 - s), ty)),
  });

  // Below 100%, the whole box shrinks instead of the image floating inside a same-size box (see
  // boxScale/imgScale below) — there's nothing to crop or pan at that point, just a smaller page,
  // so scale changes in that range always land at a clean, centered rest state (no anchor math).
  // At/above 100%, behavior is unchanged from before 50%-and-below was possible: the box is
  // pinned to full size and zooming crops+pans within it, keeping whatever's under the anchor
  // fixed on screen.
  const zoomTo = (nextScaleRaw: number, anchorX: number, anchorY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScaleRaw));
    if (nextScale === scale) return;
    if (nextScale <= 1) {
      setScale(nextScale);
      setTranslate({ x: 0, y: 0 });
      return;
    }
    const effectiveScale = Math.max(scale, 1);
    const contentX = (anchorX - translate.x) / effectiveScale;
    const contentY = (anchorY - translate.y) / effectiveScale;
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
    setScale(DEFAULT_SCALE);
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

  if (!pages || page == null) {
    return <p className="p-4 text-center text-sm opacity-60">Loading page image…</p>;
  }

  const fileId = teshuvotImageFileId(pages, volumeId, page);

  if (!fileId) {
    return <p className="p-4 text-center text-sm opacity-60">No scanned image for {label}.</p>;
  }

  if (imgError) {
    return <p className="p-4 text-center text-sm opacity-60">Image unavailable.</p>;
  }

  // Same proxy the Talmud daf-image viewer uses (see app/api/dafImage/route.ts) — it's a plain
  // Drive-thumbnail-by-file-id proxy with no Talmud-specific logic, so it's reused as-is here
  // rather than standing up a second, identical API route.
  const directUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;

  // boxScale sizes the visible box itself (shrinks it below 100% so a whole tall page can fit
  // without scrolling); imgScale is the internal crop/zoom applied within that box, which only
  // ever kicks in once the box is already pinned to full size (scale >= 1) — see zoomTo's comment.
  const boxScale = Math.min(scale, 1);
  const imgScale = Math.max(scale, 1);

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
        className="relative mx-auto touch-none select-none overflow-hidden rounded bg-black/5"
        style={{
          width: `${boxScale * 100}%`,
          aspectRatio: naturalSize ? `${naturalSize.w} / ${naturalSize.h}` : "3 / 4",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- proxied external image, not a local asset */}
        <img
          src={dafImageProxyUrl(fileId)}
          alt={label}
          draggable={false}
          onError={() => setImgError(true)}
          onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="absolute left-0 top-0 h-full w-full"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${imgScale})`,
            transformOrigin: "0 0",
          }}
        />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs opacity-70">
        <button
          onClick={resetZoom}
          disabled={scale === DEFAULT_SCALE}
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
