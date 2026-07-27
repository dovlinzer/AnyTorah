package com.anytorah.api

import com.anytorah.models.CommentaryEntry
import kotlin.math.ceil
import kotlin.math.min

/**
 * Tur's own text has no native paragraph structure fine-grained enough to read comfortably — a
 * "Tur paragraph" is *defined* as "from one Beit Yosef comment to the next," since Beit Yosef
 * opens each entry with a direct quote of the Tur words it discusses. This whole file is a
 * faithful, line-by-line port of AnyTorahWeb's `lib/sefariaClient.ts` Tur paragraph-splitting and
 * Darkhei-Moshe-marker logic — every constant, ordering, and heuristic here was independently
 * debugged there against real Sefaria data (Tur OC 1/3/25/43/132/133) and must not be
 * "improved"/redesigned without re-deriving against those same simanim.
 *
 * Kept free of networking/Android-framework dependencies (pure String/List/Regex logic) except
 * where fetching a *different* commentary's entries is unavoidable (the two orchestrator
 * functions at the bottom) — those take the fetch as a suspend lambda parameter instead of
 * calling network code directly, so this whole file stays directly unit-testable.
 */
object TurParagraphEngine {

    // MARK: - Siman header split (also used for Shulchan Arukh, not just Tur)

    data class SimanHeaderSplit(val header: String, val rest: String)

    /**
     * Splits a Shulchan Arukh/Tur siman's leading bold title (e.g. "הלכות ציצית ועטיפתו. ובו יז
     * סעיפים:") out of seif 1's Hebrew HTML into its own header line. Sefaria bakes the printed
     * siman title into the very start of seif 1's Hebrew as a `<b>...</b>` block for every siman
     * — confirmed directly against the API — with no parallel sentence in the English
     * translation, so this only ever applies to the Hebrew side. Returns null (leaving seif 1
     * untouched) when the text doesn't start with a bold block, rather than assuming the pattern
     * always holds.
     */
    fun splitSimanHeader(rawHeHtml: String): SimanHeaderSplit? {
        val m = Regex("^\\s*<b>([\\s\\S]*?)</b>\\s*").find(rawHeHtml) ?: return null
        return SimanHeaderSplit(header = m.groupValues[1], rest = rawHeHtml.substring(m.value.length))
    }

    // MARK: - Combining Tur's seifim into one flat string

    data class CombinedTurSeifim(val header: String?, val combinedHe: String, val seifStarts: List<Int>)

    /**
     * Extracts the siman-title header (seif 0 only) and concatenates every seif's remaining
     * Hebrew into one continuous string. Tur's own (rare) seif divisions don't align with
     * anything Beit Yosef's own commentary respects either (Beit Yosef's ref structure is
     * Siman -> Seif Katan, entirely independent of Tur's own Siman -> Seif), so paragraph
     * structure is computed flat across the whole siman. Also returns each seif's start offset
     * in the combined string, so English (fetched per-seif, unlike Hebrew's flat treatment here)
     * can be attached to whichever output paragraph a seif actually begins in.
     */
    fun combineTurSeifim(he: List<String>): CombinedTurSeifim {
        var header: String? = null
        val parts = he.mapIndexed { i, text ->
            if (i != 0) return@mapIndexed text
            val split = splitSimanHeader(text) ?: return@mapIndexed text
            header = split.header
            split.rest
        }
        val combinedHe = StringBuilder()
        val seifStarts = mutableListOf<Int>()
        for (text in parts) {
            seifStarts.add(combinedHe.length)
            if (combinedHe.isNotEmpty()) combinedHe.append(" ")
            combinedHe.append(text)
        }
        return CombinedTurSeifim(header, combinedHe.toString(), seifStarts)
    }

    // MARK: - Tolerant Hebrew word-sequence matching

    /** Matches a multi-letter Hebrew abbreviation: a gershayim (either the ASCII `"` or the
     *  proper Hebrew ״ character digitizations use interchangeably) between two Hebrew letters,
     *  e.g. "בה"כ" (= "בית הכסא"), "ת"ח" (= "תלמידי חכמים"). */
    private val HEBREW_ABBREVIATION_RE = Regex("[א-ת][\"״][א-ת]")

    /**
     * Builds a regex matching `words` (Hebrew letters only, in order) tolerating any amount of
     * intervening punctuation/nikud/whitespace between them — lets a Beit Yosef quote match
     * Tur's own text even where independent digitization introduced minor punctuation
     * differences. Also tolerates a definite-article "ה" mismatch on each word (real bug found
     * live: Tur OC 3 has "בפי טבעת" where Beit Yosef's quote of the same words is "בפי הטבעת" —
     * an exact-word match on "הטבעת" silently failed to find it, merging two real paragraphs
     * into one).
     *
     * A word that's itself a multi-letter abbreviation ([HEBREW_ABBREVIATION_RE]) is treated as
     * a short unconstrained gap instead of requiring its own letters to match literally — its
     * expansion in the *other* independently-digitized source routinely spells out completely
     * different letters (real bug found live: Tur OC 43 spells out "לבית הכסא"; Beit Yosef's
     * quote of the same words abbreviates it "לבה"כ" — a literal match on "לבהכ" never finds
     * "לבית הכסא", so the match silently slid forward to the next word that did line up,
     * "קבוע," breaking the paragraph one word later than the real start). The words immediately
     * before/after the abbreviation still have to match literally, which keeps this from
     * matching too loosely.
     *
     * Refuses to build a pattern (returns null) when more than half its words are these gap
     * placeholders — real bug found live: Tur OC 3 entry 12 tried a 3-word window that was
     * itself two citation abbreviations plus one generic word ("ג"ז בס"פ המוציא"), so with 2 of
     * 3 tokens wildcarded the pattern matched wherever "המוציא" next recurred, many paragraphs
     * later, skipping several real breaks in between. Citation-heavy commentary text clusters
     * abbreviations like this constantly, so a single stray one (the OC 43 case) is fine to
     * bridge, but a window that's mostly gaps has too little real anchor text left to trust —
     * better to let the caller fall through to a different word count/skip, or fail outright,
     * than risk a wild, far-away match.
     */
    fun buildHebrewWordPattern(words: List<String>): Regex? {
        val parts = mutableListOf<String>()
        var literalCount = 0
        for (raw in words) {
            if (HEBREW_ABBREVIATION_RE.containsMatchIn(raw)) {
                parts.add("[\\s\\S]{0,20}")
                continue
            }
            val cleaned = raw.filter { it in 'א'..'ת' }
            if (cleaned.isEmpty()) continue
            val stripped = if (cleaned.startsWith("ה") && cleaned.length > 1) cleaned.substring(1) else cleaned
            parts.add("ה?" + Regex.escape(stripped))
            literalCount++
        }
        if (parts.isEmpty()) return null
        if (literalCount < ceil(parts.size / 2.0)) return null
        return Regex(parts.joinToString("[^א-ת]*"))
    }

    // MARK: - Tag stripping with index mapping (for safe paragraph cut points)

    data class StrippedWithIndexMap(val text: String, val rawIndex: List<Int>)

    /**
     * Strips HTML tags only — keeps all text content, punctuation, and nikud intact — while
     * recording, for each kept character, its original index in `html`. Lets Beit-Yosef-quote
     * matching ([findTurBreakpoints]) search a tag-free string while still being able to cut the
     * *original* (tag-and-all) string at the exact right spot afterward, so a Darkhei Moshe
     * `<dm>N</dm>` marker embedded mid-paragraph still lands in the paragraph it belongs to.
     */
    fun stripTagsWithIndexMap(html: String): StrippedWithIndexMap {
        val text = StringBuilder()
        val rawIndex = mutableListOf<Int>()
        var inTag = false
        for (i in html.indices) {
            val ch = html[i]
            if (ch == '<') { inTag = true; continue }
            if (ch == '>') { inTag = false; continue }
            if (inTag) continue
            text.append(ch)
            rawIndex.add(i)
        }
        return StrippedWithIndexMap(text.toString(), rawIndex)
    }

    // MARK: - Finding Tur's own paragraph breakpoints from Beit Yosef's entries

    /**
     * Finds, for each Beit Yosef entry (in siman order), the raw-string offset in `combinedHe`
     * (Tur's own post-header Hebrew, tags intact, all seifim concatenated — see
     * [combineTurSeifim]) where that entry's opening words begin. These offsets become the
     * paragraph break points: a Tur paragraph is *defined* as "from one Beit Yosef comment to the
     * next," not by punctuation.
     *
     * Forward-only heuristic (shared with [assignTurParagraphLabels]): search only ever moves
     * forward from the last match (never back to an earlier position, even if the same short
     * phrase recurs later — the first hit scanning forward is taken as genuine), tried at
     * decreasing word counts (a long quote is a more confident match), and an entry with no match
     * simply contributes no break point — it merges into whichever paragraph precedes it —
     * rather than leaving a gap.
     *
     * Also tries skipping the entry's first 1-3 words before matching (real cases confirmed live
     * on Tur OC 3): Beit Yosef often opens a comment with a standard rhetorical connector —
     * "ומ"ש" (= "ומה שכתב", "and what [Tur] wrote...") or "ודע ד..." ("know that...") — that isn't
     * part of Tur's own text at all; the literal quote only starts a word or two later. Skipping
     * is tried only after the unskipped attempt fails, and only recovers a match if one of these
     * short preambles was the sole obstacle — an entry with no literal quote anywhere (a
     * free-standing aside not tied to a specific new Tur phrase) still correctly contributes no
     * break.
     */
    fun findTurBreakpoints(combinedHe: String, beitYosefHe: List<String>): List<Int> {
        val (plain, rawIndex) = stripTagsWithIndexMap(combinedHe)
        val breakpoints = mutableListOf<Int>()
        var cursor = 0
        for (entryHe in beitYosefHe) {
            val words = SefariaTextClient.stripHTML(entryHe).split(Regex("\\s+")).filter { it.isNotBlank() }
            var found: Int? = null
            outer@ for (skip in listOf(0, 1, 2, 3)) {
                val rest = words.drop(skip)
                for (wordCount in listOf(8, 6, 4, 3)) {
                    if (rest.size < wordCount) continue
                    val pattern = buildHebrewWordPattern(rest.take(wordCount)) ?: continue
                    val m = pattern.find(plain, cursor) ?: continue
                    found = m.range.first
                    break@outer
                }
            }
            if (found != null) {
                breakpoints.add(rawIndex.getOrElse(found) { 0 })
                cursor = found
            }
        }
        return breakpoints
    }

    /**
     * Splits `html` at each raw-string offset in `breakpoints` (from [findTurBreakpoints]) into
     * paragraphs — offsets always fall on a real-text character, never inside a tag (see
     * [stripTagsWithIndexMap]), so every cut is safe. Any resulting chunk with no real text of
     * its own (e.g. a lone commentator marker sitting right at a break) is merged forward into
     * the next real paragraph rather than becoming an empty entry.
     */
    fun splitByBreakpoints(html: String, breakpoints: List<Int>): List<String> {
        val sorted = breakpoints.toSortedSet().toList()
        val rawParts = mutableListOf<String>()
        var start = 0
        for (bp in sorted) {
            if (bp <= start) continue
            rawParts.add(html.substring(start, bp))
            start = bp
        }
        rawParts.add(html.substring(start))

        val result = mutableListOf<String>()
        var buffer = StringBuilder()
        for (part in rawParts) {
            buffer.append(part)
            if (SefariaTextClient.stripHTML(buffer.toString()).trim().isNotEmpty()) {
                result.add(buffer.toString())
                buffer = StringBuilder()
            }
        }
        if (buffer.isNotEmpty()) {
            if (result.isNotEmpty()) result[result.size - 1] = result.last() + buffer.toString()
            else result.add(buffer.toString())
        }
        return if (result.isNotEmpty()) result else listOf(html)
    }

    /**
     * Fetches Beit Yosef for `mainRef` (via the caller-supplied `fetchBeitYosefEntries`) and uses
     * its entries to split `combinedHe` into paragraphs ([findTurBreakpoints]/
     * [splitByBreakpoints]) — shared by the main-text builder and the matching corpus used by
     * [assignTurParagraphLabels] for Bach/Prisha+Drisha, so both always agree on where a Tur
     * paragraph begins. A siman with no usable Beit Yosef data (fetch failure, or a siman Beit
     * Yosef simply doesn't cover) falls back to a single paragraph for the whole siman — never a
     * crash, never a gap.
     */
    suspend fun computeTurParagraphChunks(
        combinedHe: String,
        fetchBeitYosefEntries: suspend () -> List<CommentaryEntry>,
    ): List<String> {
        val beitYosefHe: List<String> = try {
            fetchBeitYosefEntries().filterIsInstance<CommentaryEntry.Text>().map { it.he }
        } catch (e: Exception) {
            emptyList()
        }
        val breakpoints = findTurBreakpoints(combinedHe, beitYosefHe)
        return splitByBreakpoints(combinedHe, breakpoints)
    }

    // MARK: - Assigning Tur paragraph labels to Beit Yosef/Bach/Prisha+Drisha entries

    private fun findParagraphMatch(paragraphs: List<String>, cursor: Int, pattern: Regex): Int? {
        for (pi in cursor until paragraphs.size) {
            if (pattern.containsMatchIn(paragraphs[pi])) return pi
        }
        return null
    }

    /**
     * Assigns each Beit Yosef/Bach/Prisha+Drisha entry a `label` matching the Tur paragraph
     * (0-based, from `paragraphs`) it comments on, instead of a generic sequential number. These
     * commentaries each open their comment with a direct quote of the Tur words being discussed
     * — so a paragraph is found by searching for the entry's own opening words, tried at
     * decreasing word counts (a long quote is a more confident match; a short one is tried only
     * if the longer ones fail).
     *
     * Best-effort heuristic, not exact: search only ever moves forward from the last match (never
     * back to an earlier paragraph, even if the same short phrase also happens to recur later —
     * the first hit found scanning forward is taken as genuine) and a miss just carries the
     * previous entry's label forward rather than leaving a gap. `entries` may contain a
     * [CommentaryEntry.BookDivider] between Prisha's and Drisha's own entries — each is a
     * separate work independently commenting on the Tur from its own start, so the search cursor
     * and carried-forward label both reset there.
     *
     * Shares [buildHebrewWordPattern] with [findTurBreakpoints] (the "ה" article tolerance and
     * the Hebrew-abbreviation gap) — both corpora (Tur's raw text there, the already-split
     * `paragraphs` here) must always benefit from the same match improvements; never let this
     * function drift onto its own separate matcher.
     */
    fun assignTurParagraphLabels(entries: List<CommentaryEntry>, paragraphs: List<String>): List<CommentaryEntry> {
        var cursor = 0
        var lastLabel: Int? = null
        return entries.map { entry ->
            if (entry !is CommentaryEntry.Text) {
                cursor = 0
                lastLabel = null
                return@map entry
            }
            val words = SefariaTextClient.stripHTML(entry.he).split(Regex("\\s+")).filter { it.isNotBlank() }
            var matchIdx: Int? = null
            outer@ for (skip in listOf(0, 1, 2, 3)) {
                val rest = words.drop(skip)
                for (wordCount in listOf(8, 6, 4, 3)) {
                    if (rest.size < wordCount) continue
                    val pattern = buildHebrewWordPattern(rest.take(wordCount)) ?: continue
                    val found = findParagraphMatch(paragraphs, cursor, pattern) ?: continue
                    matchIdx = found
                    break@outer
                }
            }
            if (matchIdx != null) {
                lastLabel = matchIdx
                cursor = matchIdx
            } else if (lastLabel == null) {
                lastLabel = 0 // no match yet at all — default to the siman's first paragraph
            }
            entry.copy(label = lastLabel)
        }
    }

    // MARK: - Darkhei Moshe markers baked into Tur's own text

    /** Converts Tur's Darkhei Moshe position markers into a `<dm>N</dm>` placeholder — printed
     *  Tur editions anchor Darkhei Moshe's marginal notes with a reference number at this exact
     *  spot, and Sefaria's own `data-order="N.M"` already carries that same 1-based sequential
     *  number (confirmed live: it lines up with Darkhei Moshe's own commentary entries in fetch
     *  order, so no separate counter is needed). Every other commentator's markers in the same
     *  text (Beit Yosef, Bach, Prisha, Drisha, and Sefaria's own unlinked "Hagahot" tags) are
     *  deliberately left alone here; they fall out via generic tag-stripping. */
    private val TUR_DM_MARKER_RE =
        Regex("<i\\b[^>]*\\bdata-commentator=\"Darkhei Moshe\"[^>]*\\bdata-order=\"(\\d+)\\.\\d+\"[^>]*>\\s*</i>")

    fun processTurMarkers(html: String): String =
        TUR_DM_MARKER_RE.replace(html) { m -> "<dm>${m.groupValues[1]}</dm>" }

    /**
     * Builds Tur's main-text segments: the siman-title header (if any) as its own unnumbered
     * segment, then one segment per Beit-Yosef-derived paragraph, each processed for Darkhei
     * Moshe's inline reference markers. Numbering runs flat across the whole siman rather than
     * resetting per seif. English is attached to whichever paragraph the corresponding seif's
     * Hebrew actually starts in; most simanim are a single seif, so this is exact, and a siman
     * with several seifim whose paragraph boundaries don't line up with seif boundaries is a
     * known, accepted imprecision.
     */
    data class TurSegment(val index: Int, val he: String, val en: String, val label: String?)

    suspend fun buildTurSegments(
        he: List<String>,
        en: List<String>,
        fetchBeitYosefEntries: suspend () -> List<CommentaryEntry>,
    ): List<TurSegment> {
        val (header, combinedHe, seifStarts) = combineTurSeifim(he)
        val rawParagraphs = computeTurParagraphChunks(combinedHe, fetchBeitYosefEntries)

        val segments = mutableListOf<TurSegment>()
        var segIndex = 0
        if (header != null) segments.add(TurSegment(segIndex++, header, "", null))

        var offset = 0
        var paraNum = 0
        for (rawPara in rawParagraphs) {
            val start = offset
            val end = start + rawPara.length
            offset = end
            paraNum++
            val heText = processTurMarkers(rawPara)
            val enParts = seifStarts.withIndex()
                .filter { (_, seifStart) -> seifStart in start until end }
                .map { (seifIdx, _) -> en.getOrElse(seifIdx) { "" } }
                .filter { it.isNotBlank() }
            segments.add(TurSegment(segIndex++, heText, enParts.joinToString(" "), paraNum.toString()))
        }
        return segments
    }

    /**
     * Plain (fully HTML/nikud-stripped), paragraph-split Hebrew text of a Tur siman, used only as
     * the matching corpus for [assignTurParagraphLabels] — a fresh, independent fetch/split
     * rather than reusing [buildTurSegments]' output, so no `<dm>` marker digits ever end up
     * inline in the matching text. Uses the same Beit-Yosef-derived paragraph boundaries as the
     * main text so Bach/Prisha+Drisha's paragraph numbers always agree with what's actually
     * shown.
     */
    suspend fun fetchTurParagraphPlainList(
        turHebrew: List<String>,
        fetchBeitYosefEntries: suspend () -> List<CommentaryEntry>,
    ): List<String> {
        val (_, combinedHe, _) = combineTurSeifim(turHebrew)
        val rawParagraphs = computeTurParagraphChunks(combinedHe, fetchBeitYosefEntries)
        return rawParagraphs.map { SefariaTextClient.processedHebrew(it, showTrop = false) }
    }

    // MARK: - Darkhei Moshe anchored in Beit Yosef, not Tur

    /** Matches (and, via replace, removes the *first* occurrence of) a Beit Yosef position tag
     *  for Darkhei Moshe — spelled "Darchei Moshe" (with a c) in Beit Yosef's data, vs Tur's own
     *  "Darkhei Moshe" (with a kh). Only the first match in a given entry is ever touched,
     *  matching the "one marker per entry" assumption below. */
    private val BY_DM_MARKER_RE = Regex("<i\\b[^>]*\\bdata-commentator=\"Darchei Moshe\"[^>]*>\\s*</i>")

    /**
     * Determines which Beit Yosef entries should carry a Darkhei Moshe reference letter, and
     * which number to show, for comments Darkhei Moshe anchors in Beit Yosef's own words rather
     * than Tur's. Confirmed live by direct comparison against a printed edition (5 positions
     * across 2 simanim, all correct): Beit Yosef's raw text carries the same kind of position tag
     * Tur does, but its `data-order` attribute is **not** a reliable entry number the way Tur's
     * is (Sefaria labels every single one `data-order="1"` regardless of which comment it
     * anchors).
     *
     * Method: Tur's own `data-order` values ARE trusted as the true entry number for whichever
     * comments they cover. The remaining ("missing") entry numbers are filled, in ascending
     * order, by Beit Yosef's own Darchei-Moshe-tagged entries, taken in the order they appear in
     * Beit Yosef's text. Any entry number left over once Beit Yosef's own tags run out gets no
     * marker anywhere — an honest, accepted gap in Sefaria's source data, not a guess.
     *
     * Returns a map from Beit Yosef entry index (0-based, matching `beitYosefEntries`'s own
     * order) to the Darkhei Moshe entry number that belongs there.
     */
    suspend fun computeBeitYosefDarkheiMosheMarks(
        turRawHe: List<String>,
        beitYosefEntries: List<CommentaryEntry>,
        fetchDarkheiMosheEntries: suspend () -> List<CommentaryEntry>,
    ): Map<Int, Int> {
        val total = try {
            fetchDarkheiMosheEntries().count { it is CommentaryEntry.Text }
        } catch (e: Exception) {
            return emptyMap()
        }
        if (total == 0) return emptyMap()

        val turAnchored = mutableSetOf<Int>()
        for (seifText in turRawHe) {
            for (m in TUR_DM_MARKER_RE.findAll(seifText)) {
                m.groupValues[1].toIntOrNull()?.let { turAnchored.add(it) }
            }
        }

        val missing = (1..total).filter { it !in turAnchored }
        if (missing.isEmpty()) return emptyMap()

        val byTaggedIndices = beitYosefEntries.withIndex()
            .filter { (_, entry) -> entry is CommentaryEntry.Text && BY_DM_MARKER_RE.containsMatchIn(entry.he) }
            .map { (i, _) -> i }

        val assignment = mutableMapOf<Int, Int>()
        for (i in 0 until min(missing.size, byTaggedIndices.size)) {
            assignment[byTaggedIndices[i]] = missing[i]
        }
        return assignment
    }

    /** Replaces the first Darchei-Moshe position tag in a Beit Yosef entry's raw Hebrew with a
     *  `<dm>N</dm>` placeholder — same tag [processedHebrewWithTurMarkers] already knows how to
     *  turn into a styled `(letter)` string, reused as-is so Beit Yosef's markers render
     *  identically to Tur's own. */
    fun insertBeitYosefDarkheiMosheMark(he: String, n: Int): String =
        BY_DM_MARKER_RE.replaceFirst(he, "<dm>$n</dm>")

    // MARK: - Rendering `<dm>N</dm>` as a parenthesized Hebrew numeral

    private val TUR_MARKER_TAG_RE = Regex("<dm>(\\d+)</dm>")

    /**
     * Like [SefariaTextClient.processedHebrew], but preserves [processTurMarkers]'s `<dm>N</dm>`
     * tags — converting them into a parenthesized Hebrew numeral (`saHebrewLetter`, standard
     * gematria — א=1, י=10, כ=20, etc.), matching how printed Tur volumes mark Darkhei Moshe's
     * reference points, rather than a plain digit — instead of stripping them along with the
     * rest of Sefaria's HTML. Used only for Tur's Hebrew main text and Beit Yosef's Hebrew (when
     * it carries a spliced-in mark). The marker text is pulled out before stripping (via a
     * placeholder that survives both the tag-stripping regex and the cantillation-mark filter)
     * and spliced back in afterward.
     */
    fun processedHebrewWithTurMarkers(html: String, showTrop: Boolean = false): String {
        val markers = mutableListOf<String>()
        val withPlaceholders = TUR_MARKER_TAG_RE.replace(html) { m ->
            val i = markers.size
            markers.add("(${SefariaTextClient.saHebrewLetter(m.groupValues[1].toInt())})")
            "DM${i}"
        }
        val stripped = SefariaTextClient.processedHebrew(withPlaceholders, showTrop)
        return Regex("DM(\\d+)").replace(stripped) { m ->
            markers.getOrElse(m.groupValues[1].toInt()) { "" }
        }
    }
}
