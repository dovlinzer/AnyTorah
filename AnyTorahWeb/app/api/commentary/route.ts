import { NextRequest, NextResponse } from "next/server";
import {
  loadCommentaryEntries,
  ref as buildRef,
  talmudAmudRef,
  processedHebrew,
  processedHebrewWithTurMarkers,
  stripHTML,
  fetchTurParagraphPlainList,
  assignTurParagraphLabels,
  fetchBoth,
  computeBeitYosefDarkheiMosheMarks,
  insertBeitYosefDarkheiMosheMark,
} from "@/lib/sefariaClient";
import { displayName, type CommentaryType } from "@/lib/commentaryTypes";
import { TextCatalog } from "@/lib/textCatalog";
import type { TextCategory, CommentaryEntry } from "@/lib/textModels";

const VALID_CATEGORIES: TextCategory[] = ["tanakh", "mishnah", "talmud", "rambam", "shulchanArukh", "tur", "midrash"];

function isCommentaryType(value: string | null): value is CommentaryType {
  return value !== null && Object.prototype.hasOwnProperty.call(displayName, value);
}

function plainText(entries: CommentaryEntry[], preserveMarkers = false): CommentaryEntry[] {
  const hebrewFn = preserveMarkers ? processedHebrewWithTurMarkers : processedHebrew;
  return entries.map((entry) =>
    entry.kind === "text"
      ? { ...entry, he: hebrewFn(entry.he), en: stripHTML(entry.en) }
      : entry,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category");
  const indexParam = searchParams.get("index");
  const chapterParam = searchParams.get("chapter");
  const typeParam = searchParams.get("type");
  // Tosefta (mishnah) / Yerushalmi (talmud) subcategories — see AnyTorahWeb CLAUDE.md.
  const subcategoryParam = searchParams.get("subcategory");
  const halakhaParam = searchParams.get("halakha");

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
  if (category === "mishnah" && subcategoryParam === "tosefta") {
    const tractate = TextCatalog.allMishnahTractates.find((t) => t.id === index);
    if (!tractate) return NextResponse.json({ error: "Unknown tractate" }, { status: 400 });
    const mainRef = `Tosefta ${tractate.name} ${chapter}`;
    try {
      const entries = await loadCommentaryEntries(typeParam, mainRef, "mishnah", undefined, undefined, true, false);
      return NextResponse.json({ entries: plainText(entries) });
    } catch (error) {
      console.error("commentary fetch failed", error);
      return NextResponse.json({ error: "Failed to fetch commentary from Sefaria" }, { status: 502 });
    }
  }
  if (category === "talmud" && subcategoryParam === "yerushalmi") {
    const tractate = TextCatalog.allMishnahTractates.find((t) => t.id === index);
    if (!tractate) return NextResponse.json({ error: "Unknown tractate" }, { status: 400 });
    const halakha = Number(halakhaParam) || 1;
    const mainRef = `Jerusalem Talmud ${tractate.name} ${chapter}:${halakha}`;
    try {
      const entries = await loadCommentaryEntries(typeParam, mainRef, "talmud", undefined, undefined, false, true);
      return NextResponse.json({ entries: plainText(entries) });
    } catch (error) {
      console.error("commentary fetch failed", error);
      return NextResponse.json({ error: "Failed to fetch commentary from Sefaria" }, { status: 502 });
    }
  }
  // Beit Yosef, Bach, and the combined Prisha+Drisha tab each open their comment with a direct
  // quote of the Tur words they're discussing — assignTurParagraphLabels matches those opening
  // words against Tur's own Beit-Yosef-derived paragraphs (see buildTurSegments/fetchChapter) to
  // number each entry by the Tur paragraph it actually comments on, instead of a generic
  // sequential count. Darkhei Moshe itself is excluded from this branch — most of its comments
  // anchor via Sefaria's data-order markers in Tur's own main text (see processTurMarkers), not
  // by quote-matching, so it keeps the generic sequential numbering below.
  if (category === "tur" && (typeParam === "beitYosef" || typeParam === "bach" || typeParam === "prishaDrisha")) {
    const mainRef = buildRef(category, index, chapter);
    try {
      const [entries, paragraphs] = await Promise.all([
        loadCommentaryEntries(typeParam, mainRef, category),
        fetchTurParagraphPlainList(mainRef),
      ]);
      // Label using the *original* entries — inserting a <dm> marker below must happen after
      // labeling, not before, so the marker's digit can never end up among the opening words
      // assignTurParagraphLabels searches with (it would otherwise risk corrupting the match).
      let finalEntries = assignTurParagraphLabels(entries, paragraphs);
      let preserveMarkers = false;
      // Darkhei Moshe sometimes comments on Beit Yosef's own words rather than Tur's — confirmed
      // live against a printed edition. Beit Yosef's raw text carries the same kind of Darkhei
      // Moshe position tag Tur does; computeBeitYosefDarkheiMosheMarks figures out which entries
      // need one and what number, using whichever entry numbers Tur's own tags don't already
      // cover (see that function's doc for the full method).
      if (typeParam === "beitYosef") {
        const { hebrew: turRawHe } = await fetchBoth(mainRef);
        const marks = await computeBeitYosefDarkheiMosheMarks(mainRef, turRawHe, entries);
        if (marks.size > 0) {
          preserveMarkers = true;
          finalEntries = finalEntries.map((entry, i) => {
            const n = marks.get(i);
            return entry.kind === "text" && n !== undefined
              ? { ...entry, he: insertBeitYosefDarkheiMosheMark(entry.he, n) }
              : entry;
          });
        }
      }
      return NextResponse.json({ entries: plainText(finalEntries, preserveMarkers) });
    } catch (error) {
      console.error("commentary fetch failed", error);
      return NextResponse.json({ error: "Failed to fetch commentary from Sefaria" }, { status: 502 });
    }
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
  const mainRef = isTalmud ? talmudAmudRef(tractateName, chapter, "a") : buildRef(category, index, chapter);
  const secondMainRef = isTalmud ? talmudAmudRef(tractateName, chapter, "b") : undefined;

  try {
    const entries = await loadCommentaryEntries(typeParam, mainRef, category, secondMainRef, mainSegmentCount);
    return NextResponse.json({ entries: plainText(entries) });
  } catch (error) {
    console.error("commentary fetch failed", error);
    return NextResponse.json({ error: "Failed to fetch commentary from Sefaria" }, { status: 502 });
  }
}
