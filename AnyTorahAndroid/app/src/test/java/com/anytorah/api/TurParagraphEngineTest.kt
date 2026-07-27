package com.anytorah.api

import com.anytorah.models.CommentaryEntry
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URLEncoder

/**
 * Exercises [TurParagraphEngine] against real, live Sefaria data for the exact "golden simanim"
 * already validated on the reference web implementation (AnyTorahWeb/lib/sefariaClient.ts) —
 * ground-truth counts/labels pulled directly from that already-shipped app, not guessed. These
 * hit the public Sefaria API directly (read-only GETs, no auth) rather than baked fixtures, so a
 * failure here could in principle mean Sefaria's underlying text changed — but that's exactly
 * the kind of drift worth catching, not a reason to mock it away.
 */
class TurParagraphEngineTest {

    private val client = OkHttpClient()

    /** Fetches the raw `he` field for a Sefaria ref (bare, no range) as a JSONArray. */
    private fun fetchRawHeArray(ref: String): JSONArray {
        val encoded = URLEncoder.encode(ref, "UTF-8").replace("+", "%20")
        val url = "https://www.sefaria.org/api/texts/$encoded?context=0&lang=he"
        val response = client.newCall(Request.Builder().url(url).build()).execute()
        val body = response.body?.string() ?: error("empty response for $ref")
        val json = JSONObject(body)
        if (json.has("error")) error("Sefaria error for $ref: ${json.getString("error")}")
        return json.getJSONArray("he")
    }

    /** Recursively flattens a Sefaria `he`/`text` JSON value (arbitrarily nested JSONArrays of
     *  strings) into a flat list of non-blank strings, mirroring the reference web
     *  implementation's `flattenTextValue`. */
    private fun flatten(value: Any?): List<String> = when (value) {
        is JSONArray -> (0 until value.length()).flatMap { flatten(value.opt(it)) }
        is String -> if (value.isNotBlank()) listOf(value) else emptyList()
        else -> emptyList()
    }

    private fun fetchTurMainHe(section: String, siman: Int): List<String> =
        flatten(fetchRawHeArray("Tur, $section $siman"))

    /** Fetches a Tur commentary's entries for `siman`, applying the same blanket `:1-500`
     *  depth-3 range fix production code uses (see [TurParagraphEngine]'s doc and
     *  `depthFixedRef` in the reference web implementation), and wraps each flattened entry as
     *  a plain sequential [CommentaryEntry.Text] (English left blank — not needed for these
     *  paragraph-engine assertions). */
    private fun fetchTurCommentaryEntries(title: String, section: String, siman: Int): List<CommentaryEntry> {
        val flat = flatten(fetchRawHeArray("$title, $section $siman:1-500"))
        return flat.mapIndexed { i, text -> CommentaryEntry.Text(index = i, he = text, en = "") }
    }

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
            val entries = fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", g.siman)
            assertEquals("OC ${g.siman} Beit Yosef entry count", g.beitYosefCount, entries.size)
        }
    }

    @Test
    fun `Tur main-text paragraph counts match the reference implementation`() = runBlocking {
        for (g in golden) {
            val mainHe = fetchTurMainHe("Orach Chayim", g.siman)
            val enPlaceholder = List(mainHe.size) { "" }
            val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
                fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", g.siman)
            }
            assertEquals("OC ${g.siman} main-text segment count", g.mainSegmentCount, segments.size)
        }
    }

    @Test
    fun `Beit Yosef entries are labeled with the correct Tur paragraph`() = runBlocking {
        for (g in golden) {
            val mainHe = fetchTurMainHe("Orach Chayim", g.siman)
            val byEntries = fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", g.siman)
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
            fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", 43)
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
            fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", 132)
        }
        assertEquals(3, segments.size)
    }

    @Test
    fun `OC 133 seven-verse Psalm list stays one paragraph`() = runBlocking {
        val mainHe = fetchTurMainHe("Orach Chayim", 133)
        val enPlaceholder = List(mainHe.size) { "" }
        val segments = TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", 133)
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
            // turRawHe must be the per-seif array with tags intact (not flattened past the seif
            // level, unlike fetchTurMainHe/flatten which is for depth-3 commentary refs) — a
            // bare "Tur, Orach Chayim N" ref returns one raw HTML string per seif directly.
            val rawArray = fetchRawHeArray("Tur, Orach Chayim ${g.siman}")
            val turRawHe = (0 until rawArray.length()).map { rawArray.getString(it) }
            val byEntries = fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", g.siman)
            val assignment = TurParagraphEngine.computeBeitYosefDarkheiMosheMarks(turRawHe, byEntries) {
                fetchTurCommentaryEntries("Darkhei Moshe", "Orach Chayim", g.siman)
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
            fetchTurCommentaryEntries("Beit Yosef", "Orach Chayim", 1)
        }
        val segWithMark1 = segments.firstOrNull { it.label == "12" }
        val segWithMark3 = segments.firstOrNull { it.label == "17" }
        assertTrue("expected <dm>1</dm> in paragraph labeled 12", segWithMark1?.he?.contains("<dm>1</dm>") == true)
        assertTrue("expected <dm>3</dm> in paragraph labeled 17", segWithMark3?.he?.contains("<dm>3</dm>") == true)
    }
}
