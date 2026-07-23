import { NextRequest, NextResponse } from "next/server";
import {
  fetchChapter,
  fetchFullDaf,
  ref as buildRef,
  SefariaNoTextError,
  processedHebrew,
  processedHebrewWithMarkers,
  processedEnglishWithBold,
  stripBoldContent,
  stripHTML,
} from "@/lib/sefariaClient";
import { displayName, type CommentaryType } from "@/lib/commentaryTypes";
import type { TextCategory, TextSegment } from "@/lib/textModels";
import { contentSegment } from "@/lib/textModels";
import { rambamIntroductions } from "@/lib/rambamIntroductions";
import { TextCatalog } from "@/lib/textCatalog";

// v1 rendering strips HTML to plain text rather than reproducing Sefaria's inline styling,
// with two exceptions carried over from native: Shulchan Arukh's Hebrew keeps its inline
// commentary-marker spans (see processedHebrewWithMarkers) so the client can style each
// commentator's brackets distinctly, and Talmud/Mishnah's English keeps its bold "glue word"
// spans (see processedEnglishWithBold) so the client can color them instead of stripping the
// distinction entirely. Tanakh's English drops bold content outright (native: those bold marks
// are lemma/footnote anchors, not a translation-glue distinction, so there's nothing worth
// keeping). Both exceptions render via dangerouslySetInnerHTML on the client.
function englishProcessor(category: TextCategory): (html: string) => string {
  if (category === "tanakh") return stripBoldContent;
  if (category === "talmud" || category === "mishnah") return processedEnglishWithBold;
  return stripHTML;
}

function plainText(segments: TextSegment[], category: TextCategory): TextSegment[] {
  const hebrewFn = category === "shulchanArukh" ? processedHebrewWithMarkers : processedHebrew;
  const englishFn = englishProcessor(category);
  return segments.map((seg) => ({
    ...seg,
    hebrewHTML: hebrewFn(seg.hebrewHTML),
    englishHTML: englishFn(seg.englishHTML),
  }));
}

function isCommentaryType(value: string): value is CommentaryType {
  return Object.prototype.hasOwnProperty.call(displayName, value);
}

const VALID_CATEGORIES: TextCategory[] = ["tanakh", "mishnah", "talmud", "rambam", "shulchanArukh", "midrash"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category");
  const indexParam = searchParams.get("index");
  const chapterParam = searchParams.get("chapter");
  // Only meaningful for Shulchan Arukh (drives the inline commentary-marker brackets in the
  // main text), but harmless to accept generically.
  const commentariesParam = searchParams.get("commentaries");

  if (!categoryParam || !VALID_CATEGORIES.includes(categoryParam as TextCategory)) {
    return NextResponse.json({ error: "Missing or invalid category" }, { status: 400 });
  }
  const category = categoryParam as TextCategory;
  const index = Number(indexParam);
  const chapter = Number(chapterParam);
  if (!Number.isFinite(index) || !Number.isFinite(chapter)) {
    return NextResponse.json({ error: "index/chapter must be numbers" }, { status: 400 });
  }
  const selectedCommentaries: CommentaryType[] = commentariesParam
    ? commentariesParam.split(",").filter(isCommentaryType)
    : [];

  try {
    if (category === "talmud") {
      const segments = await fetchFullDaf(index, chapter);
      return NextResponse.json({ ref: buildRef("talmud", index, chapter), segments: plainText(segments, category) });
    }
    // Rambam "chapter 0" is a synthetic introduction — the work's bundled mitzvot-list header
    // (Chabad.org) — rendered with no Sefaria fetch, matching the native app.
    if (category === "rambam" && chapter === 0) {
      const intro = rambamIntroductions[index];
      const work = TextCatalog.allRambamWorks.find((w) => w.id === index);
      const segments = intro && (intro.he || intro.en) ? [contentSegment(0, intro.he, intro.en, null)] : [];
      return NextResponse.json({
        ref: work ? `${work.name} — Introduction` : "Introduction",
        segments: plainText(segments, category),
      });
    }
    const segments = await fetchChapter(category, index, chapter, selectedCommentaries);
    return NextResponse.json({ ref: buildRef(category, index, chapter), segments: plainText(segments, category) });
  } catch (error) {
    if (error instanceof SefariaNoTextError) {
      return NextResponse.json({ error: "No text found for this selection" }, { status: 404 });
    }
    console.error("chapter fetch failed", error);
    return NextResponse.json({ error: "Failed to fetch text from Sefaria" }, { status: 502 });
  }
}
