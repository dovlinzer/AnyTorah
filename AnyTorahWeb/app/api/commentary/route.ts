import { NextRequest, NextResponse } from "next/server";
import {
  loadCommentaryEntries,
  ref as buildRef,
  processedHebrew,
  stripHTML,
} from "@/lib/sefariaClient";
import { displayName, type CommentaryType } from "@/lib/commentaryTypes";
import { TextCatalog } from "@/lib/textCatalog";
import type { TextCategory, CommentaryEntry } from "@/lib/textModels";

const VALID_CATEGORIES: TextCategory[] = ["tanakh", "mishnah", "talmud", "rambam", "shulchanArukh", "midrash"];

function isCommentaryType(value: string | null): value is CommentaryType {
  return value !== null && Object.prototype.hasOwnProperty.call(displayName, value);
}

function plainText(entries: CommentaryEntry[]): CommentaryEntry[] {
  return entries.map((entry) =>
    entry.kind === "text"
      ? { ...entry, he: processedHebrew(entry.he), en: stripHTML(entry.en) }
      : entry,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category");
  const indexParam = searchParams.get("index");
  const chapterParam = searchParams.get("chapter");
  const typeParam = searchParams.get("type");

  if (!categoryParam || !VALID_CATEGORIES.includes(categoryParam as TextCategory)) {
    return NextResponse.json({ error: "Missing or invalid category" }, { status: 400 });
  }
  if (!isCommentaryType(typeParam)) {
    return NextResponse.json({ error: "Missing or invalid commentary type" }, { status: 400 });
  }
  const category = categoryParam as TextCategory;
  const index = Number(indexParam);
  const chapter = Number(chapterParam);
  if (!Number.isFinite(index) || !Number.isFinite(chapter)) {
    return NextResponse.json({ error: "index/chapter must be numbers" }, { status: 400 });
  }
  // Rambam "chapter 0" is the synthetic introduction (bundled mitzvot-list header, no Sefaria
  // ref) — there's nothing to fetch commentary against, matching native's empty-currentRef skip.
  if (category === "rambam" && chapter === 0) {
    return NextResponse.json({ entries: [] });
  }
  // Rambam's depth-3 fix needs the real halakha count of the current chapter (see
  // loadCommentaryEntries / depthFixedRef) — passed from the main chapter fetch the client
  // already did, not re-derived here.
  const mainCountParam = searchParams.get("mainCount");
  const mainSegmentCount = mainCountParam ? Number(mainCountParam) : undefined;

  // Talmud commentary is fetched per amud — a bare "{Tractate} {daf}" ref truncates on
  // Sefaria to amud A plus a sliver of amud B, not the full daf (see loadCommentaryEntries).
  const isTalmud = category === "talmud";
  const tractateName = isTalmud
    ? (TextCatalog.allTalmudTractates.find((t) => t.id === index) ?? TextCatalog.allTalmudTractates[0]).sefariaName
    : "";
  const mainRef = isTalmud ? `${tractateName} ${chapter}a` : buildRef(category, index, chapter);
  const secondMainRef = isTalmud ? `${tractateName} ${chapter}b` : undefined;

  try {
    const entries = await loadCommentaryEntries(typeParam, mainRef, category, secondMainRef, mainSegmentCount);
    return NextResponse.json({ entries: plainText(entries) });
  } catch (error) {
    console.error("commentary fetch failed", error);
    return NextResponse.json({ error: "Failed to fetch commentary from Sefaria" }, { status: 502 });
  }
}
