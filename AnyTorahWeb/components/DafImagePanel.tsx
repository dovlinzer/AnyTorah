"use client";

import { useEffect, useState } from "react";
import {
  loadTalmudPages,
  dafImageFileId,
  dafImageUrl,
  dafImageProxyUrl,
  type TalmudPages,
} from "@/lib/talmudPages";

/** Scanned Vilna Shas page for the given daf/amud, shown in its own scrollable column. */
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

  useEffect(() => {
    let cancelled = false;
    loadTalmudPages().then((p) => {
      if (!cancelled) setPages(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => setImgError(false), [tractateSefariaName, daf, side]);

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
  // app/api/dafImage/route.ts for why. The "open full size" link still points straight at
  // Drive since a top-level navigation doesn't have that problem.
  const directUrl = dafImageUrl(pages, tractateSefariaName, daf, side === "a")!;

  return (
    <a href={directUrl} target="_blank" rel="noreferrer" title="Open full size in a new tab">
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied external image, not a local asset */}
      <img
        src={dafImageProxyUrl(fileId)}
        alt={`${tractateSefariaName} ${daf}${side}`}
        onError={() => setImgError(true)}
        className="w-full rounded"
      />
    </a>
  );
}
