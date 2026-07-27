package com.anytorah.api

import com.anytorah.models.CommentaryEntry
import com.anytorah.models.CommentaryType
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Exercises [TurParagraphEngine] against real, live Sefaria data for the exact "golden simanim"
 * already validated on the reference web implementation (AnyTorahWeb/lib/sefariaClient.ts) —
 * ground-truth counts/labels pulled directly from that already-shipped app, not guessed. These
 * hit the public Sefaria API directly (read-only GETs, no auth) rather than baked fixtures, so a
 * failure here could in principle mean Sefaria's underlying text changed — but that's exactly
 * the kind of drift worth catching, not a reason to mock it away.
 *
 * Deliberately routes every fetch through the *real* [SefariaTextClient] functions (`fetchBoth`,
 * `fetchTurCommentaryEntries`) rather than a parallel test-only fetch/flatten implementation — an
 * earlier version of this file reimplemented its own fetching, which meant it never exercised
 * `fetchBothAligned`'s outer-count-mismatch handling and missed a real production bug (Tur OC 1's
 * Beit Yosef collapsing to 1 entry) that only surfaced live in the app. Exercising the same code
 * path production uses is the whole point.
 */
class TurParagraphEngineTest {

    private suspend fun fetchTurMainHe(section: String, siman: Int): List<String> =
        SefariaTextClient.fetchBoth("Tur, $section $siman").first

    private suspend fun fetchTurCommentaryEntries(type: CommentaryType, section: String, siman: Int): List<CommentaryEntry> =
        SefariaTextClient.fetchTurCommentaryEntries(type, "Tur, $section $siman")

    private data class Golden(
        val siman: Int,
        val beitYosefCount: Int,
        val mainSegmentCount: Int,
        val labels: List<Int>,
    )

    // Ground truth pulled directly from the live, already-shipped AnyTorahWeb app
    // (/api/commentary, /api/chapter) for Tur, Orach Chayim — not guessed.
    private val golden = listOf(
        Golden(siman = 1, beitYosefCount = 17, mainSegmentCount = 17,
            labels = listOf(0, 2, 2, 3, 4, 5, 6, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16)),
        Golden(siman = 3, beitYosefCount = 20, mainSegmentCount = 18,
            labels = listOf(0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 15, 15, 16, 17)),
        Golden(siman = 25, beitYosefCount = 9, mainSegmentCount = 9,
            labels = listOf(0, 1, 2, 3, 4, 5, 6, 7, 7)),
        Golden(siman = 43, beitYosefCount = 6, mainSegmentCount = 5,
            labels = listOf(0, 1, 1, 2, 3, 4)),
        Golden(siman = 132, beitYosefCount = 2, mainSegmentCount = 3,
            labels = listOf(1, 2)),
        Golden(siman = 133, beitYosefCount = 2, mainSegmentCount = 2,
            labels = listOf(0, 1)),
    )

    @Test
    fun `Beit Yosef raw entry counts match Sefaria's own segmentation`() = runBlocking {
        for (g in golden) {
            val entries = fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", g.siman)
            assertEquals("OC ${g.siman} Beit Yosef entry count", g.beitYosefCount, entries.size)
        }
    }

    @Test
    fun `Tur main-text paragraph counts match the reference implementation`() = runBlocking {
        for (g in golden) {
            val mainHe = fetchTurMainHe("Orach Chayim", g.siman)
            val enPlaceholder = List(mainHe.size) { "" }
            val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
                fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", g.siman)
            }
            assertEquals("OC ${g.siman} main-text segment count", g.mainSegmentCount, segments.size)
        }
    }

    @Test
    fun `Beit Yosef entries are labeled with the correct Tur paragraph`() = runBlocking {
        for (g in golden) {
            val mainHe = fetchTurMainHe("Orach Chayim", g.siman)
            val byEntries = fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", g.siman)
            val paragraphs = TurParagraphEngine.fetchTurParagraphPlainList(mainHe) { byEntries }
            val labeled = TurParagraphEngine.assignTurParagraphLabels(byEntries, paragraphs)
            val labels = labeled.filterIsInstance<CommentaryEntry.Text>().map { it.label }
            assertEquals("OC ${g.siman} Beit Yosef labels", g.labels, labels)
        }
    }

    @Test
    fun `OC 43 abbreviation bridges correctly instead of sliding to the next word`() = runBlocking {
        // Real bug found live: Beit Yosef abbreviates "לבית הכסא" as "לבה\"כ"; the paragraph
        // break must land at "אסור" (the real start), not slide forward to "קבוע".
        val mainHe = fetchTurMainHe("Orach Chayim", 43)
        val enPlaceholder = List(mainHe.size) { "" }
        val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", 43)
        }
        val firstParagraphText = SefariaTextClient.processedHebrew(segments.first().he, showTrop = false).trim()
        assertTrue(
            "OC 43 first paragraph should start with אסור, was: $firstParagraphText",
            firstParagraphText.startsWith("אסור"),
        )
    }

    @Test
    fun `OC 132 does not fragment at the (צא-) citation colon`() = runBlocking {
        val mainHe = fetchTurMainHe("Orach Chayim", 132)
        val enPlaceholder = List(mainHe.size) { "" }
        val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", 132)
        }
        assertEquals(3, segments.size)
    }

    @Test
    fun `OC 133 seven-verse Psalm list stays one paragraph`() = runBlocking {
        val mainHe = fetchTurMainHe("Orach Chayim", 133)
        val enPlaceholder = List(mainHe.size) { "" }
        val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", 133)
        }
        assertEquals(2, segments.size)
    }

    // MARK: - Darkhei Moshe marker system (Phase 3)

    private data class DmGolden(val siman: Int, val beitYosefAssignment: Map<Int, Int>)

    // Ground truth pulled directly from the live, already-shipped AnyTorahWeb app
    // (Beit-Yosef-entry-index -> Darkhei-Moshe-number), confirmed by the user against a printed
    // edition on the reference implementation.
    private val dmGolden = listOf(
        DmGolden(siman = 1, beitYosefAssignment = mapOf(15 to 2)),
        DmGolden(siman = 2, beitYosefAssignment = mapOf(2 to 1)),
        DmGolden(siman = 3, beitYosefAssignment = mapOf(3 to 1, 6 to 2, 12 to 3, 19 to 4)),
    )

    @Test
    fun `Darkhei Moshe marks anchored in Beit Yosef fill exactly the gaps Tur's own tags miss`() = runBlocking {
        for (g in dmGolden) {
            val turRawHe = fetchTurMainHe("Orach Chayim", g.siman)
            val byEntries = fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", g.siman)
            val assignment = TurParagraphEngine.computeBeitYosefDarkheiMosheMarks(turRawHe, byEntries) {
                fetchTurCommentaryEntries(CommentaryType.DARKHEI_MOSHE, "Orach Chayim", g.siman)
            }
            assertEquals("OC ${g.siman} Beit-Yosef-anchored Darkhei Moshe assignment", g.beitYosefAssignment, assignment)
        }
    }

    @Test
    fun `insertBeitYosefDarkheiMosheMark and rendering produce the correct parenthesized numeral`() {
        val he = """<i data-commentator="Darchei Moshe"></i>שלום עולם"""
        val withMark = TurParagraphEngine.insertBeitYosefDarkheiMosheMark(he, 2)
        val rendered = TurParagraphEngine.processedHebrewWithTurMarkers(withMark)
        assertTrue("expected (ב) in rendered output, got: $rendered", rendered.contains("(ב)"))
    }

    @Test
    fun `Tur OC 1's own data-order tags cover marks 1 and 3, leaving 2 to Beit Yosef`() = runBlocking {
        val mainHe = fetchTurMainHe("Orach Chayim", 1)
        val enPlaceholder = List(mainHe.size) { "" }
        val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, "Orach Chayim", 1)
        }
        val segWithMark1 = segments.firstOrNull { it.label == "12" }
        val segWithMark3 = segments.firstOrNull { it.label == "17" }
        assertTrue("expected <dm>1</dm> in paragraph labeled 12", segWithMark1?.he?.contains("<dm>1</dm>") == true)
        assertTrue("expected <dm>3</dm> in paragraph labeled 17", segWithMark3?.he?.contains("<dm>3</dm>") == true)
    }
}
