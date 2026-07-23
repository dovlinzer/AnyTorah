package com.anytorah.api

import com.anytorah.models.CommentaryType
import com.anytorah.models.MidrashWork
import com.anytorah.models.MishnahTractate
import com.anytorah.models.SegmentLabelStyle
import com.anytorah.models.TextCategory
import com.anytorah.models.TextCatalog
import com.anytorah.models.TextSegment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.Cache
import okhttp3.CacheControl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Mirrors iOS's `SefariaError` — distinguishes a genuinely empty API result from a masked
 * network/decoding failure, so callers can tell "the text doesn't exist" apart from
 * "the request failed" instead of collapsing both into a blanket "No text found".
 */
sealed class SefariaException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    class NetworkError(cause: Throwable) : SefariaException(cause.message ?: "Network error", cause)
    object NoText : SefariaException("No text found")
    class DecodingError(status: Int? = null) : SefariaException(
        if (status != null) "Could not parse response (HTTP $status)" else "Could not parse response"
    )
}

object SefariaTextClient {

    private const val BASE_URL = "https://www.sefaria.org/api/texts"

    private var client: OkHttpClient? = null

    fun init(cacheDir: File) {
        val cache = Cache(File(cacheDir, "sefaria_cache"), 100L * 1024 * 1024)
        client = OkHttpClient.Builder()
            .cache(cache)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private fun getClient(): OkHttpClient = client ?: OkHttpClient()

    // MARK: - URL building

    private fun buildUrl(ref: String, lang: String): String {
        val encoded = ref.replace(" ", "%20")
        return "$BASE_URL/$encoded?context=0&lang=$lang"
    }

    // MARK: - Retry

    /**
     * Executes [request] with up to [attempts] tries, retrying only transient failures —
     * dropped connections, timeouts, DNS hiccups (any [IOException] from OkHttp) and 429/5xx
     * responses — with short backoff between tries. This exists because "No text found"
     * reports from real devices (including App Store/Play review) have turned out to be
     * transient network failures masquerading as an empty API response — a brief retry
     * resolves most of them instead of surfacing an error.
     */
    private suspend fun executeWithRetry(request: Request, attempts: Int = 3): Response =
        withContext(Dispatchers.IO) {
            var lastError: Exception = IOException("Unknown network error")
            for (attempt in 0 until attempts) {
                val isLastAttempt = attempt == attempts - 1
                try {
                    val response = getClient().newCall(request).execute()
                    if (response.code == 429 || response.code in 500..599) {
                        val status = response.code
                        response.close()
                        lastError = IOException("HTTP $status")
                        if (isLastAttempt) throw lastError
                    } else {
                        return@withContext response
                    }
                } catch (e: IOException) {
                    lastError = e
                    if (isLastAttempt) throw e
                }
                delay(300L * (attempt + 1))
            }
            throw lastError
        }

    // MARK: - Single-language fetch

    /** Low-level single-language fetch. lang="he" → json["he"], lang="en" → json["text"]. */
    private suspend fun fetchSingleLang(ref: String, lang: String): List<String> =
        withContext(Dispatchers.IO) {
            val url = buildUrl(ref, lang)
            val request = Request.Builder()
                .url(url)
                .cacheControl(CacheControl.Builder().maxStale(24, TimeUnit.HOURS).build())
                .build()
            val response = try {
                executeWithRetry(request)
            } catch (e: IOException) {
                throw SefariaException.NetworkError(e)
            }
            val (body, status) = response.use { it.body?.string() to it.code }
            if (body == null) throw SefariaException.DecodingError(status)
            val json = try {
                JSONObject(body)
            } catch (e: Exception) {
                throw SefariaException.DecodingError(status)
            }
            if (json.has("error")) {
                throw SefariaException.NetworkError(IOException(json.optString("error", "Sefaria API error")))
            }
            val key = if (lang == "he") "he" else "text"
            val value = json.opt(key) ?: throw SefariaException.NoText
            val segs = flattenValue(value).filter { it.isNotBlank() }
            if (segs.isEmpty()) throw SefariaException.NoText
            segs
        }

    // MARK: - Public fetch APIs

    suspend fun fetchBoth(ref: String): Pair<List<String>, List<String>> = coroutineScope {
        val heDef = async { runCatching { fetchSingleLang(ref, "he") } }
        val enDef = async { runCatching { fetchSingleLang(ref, "en") } }
        val heResult = heDef.await()
        val enResult = enDef.await()

        val heSegs = heResult.getOrElse { emptyList() }
        val enSegs = enResult.getOrElse { emptyList() }
        if (heSegs.isNotEmpty() || enSegs.isNotEmpty()) {
            return@coroutineScope Pair(heSegs, enSegs)
        }

        // Both sides came back empty. Rather than blanket-report "no text" (which is what a
        // network timeout, a blocked/challenged request, or a bad JSON response all look like
        // once swallowed), surface whichever underlying failure isn't itself a genuine "no text"
        // — that's the actual cause, and it's what needs fixing or reporting.
        for (result in listOf(heResult, enResult)) {
            val error = result.exceptionOrNull()
            if (error != null && error !is SefariaException.NoText) throw error
        }
        throw SefariaException.NoText
    }

    /**
     * Fetches Hebrew and English from a single request, preserving structural alignment.
     *
     * Sefaria commentary texts are depth-3: outer array = one entry per mishnah/verse/halakha,
     * inner array = paragraphs within that entry. Hebrew typically has 1 inner paragraph per
     * entry while the English translation may have several. Naively flattening and pairing
     * positionally produces misalignment whenever inner counts differ.
     *
     * Returns Triple(he, en, outerIndices) where outerIndices[i] is the 0-based outer-array
     * position (e.g. mishnah number) that paragraph i belongs to.
     */
    suspend fun fetchBothAligned(ref: String): Triple<List<String>, List<String>, List<Int>> =
        withContext(Dispatchers.IO) {
            val url = buildUrl(ref, "en")
            val request = Request.Builder()
                .url(url)
                .cacheControl(CacheControl.Builder().maxStale(24, TimeUnit.HOURS).build())
                .build()
            val body = try {
                executeWithRetry(request).use { it.body?.string() } ?: return@withContext Triple(emptyList(), emptyList(), emptyList())
            } catch (e: Exception) {
                return@withContext Triple(emptyList(), emptyList(), emptyList())
            }
            try {
                val json = JSONObject(body)
                if (json.has("error")) return@withContext Triple(emptyList(), emptyList(), emptyList())
                val heVal = json.opt("he") ?: return@withContext Triple(emptyList(), emptyList(), emptyList())
                val enVal = json.opt("text") ?: return@withContext Triple(emptyList(), emptyList(), emptyList())

                val heArr = heVal as? JSONArray
                val enArr = enVal as? JSONArray

                val heSegs = mutableListOf<String>()
                val enSegs = mutableListOf<String>()
                val outerIndices = mutableListOf<Int>()

                if (heArr != null && enArr != null) {
                    when {
                        heArr.length() == enArr.length() -> {
                            // Same outer count — pair per outer element, joining minority inner side.
                            for (i in 0 until heArr.length()) {
                                val hInner = flattenValue(heArr[i]).filter { it.isNotBlank() }
                                val eInner = flattenValue(enArr[i]).filter { it.isNotBlank() }
                                val before = heSegs.size
                                alignedAppend(hInner, eInner, heSegs, enSegs)
                                repeat(heSegs.size - before) { outerIndices.add(i) }
                            }
                        }
                        enArr.length() == 0 -> {
                            // No English translation — iterate over Hebrew structure.
                            for (i in 0 until heArr.length()) {
                                val hInner = flattenValue(heArr[i]).filter { it.isNotBlank() }
                                val before = heSegs.size
                                alignedAppend(hInner, emptyList(), heSegs, enSegs)
                                repeat(heSegs.size - before) { outerIndices.add(i) }
                            }
                        }
                        heArr.length() == 0 -> {
                            // No Hebrew translation — iterate over English structure.
                            for (i in 0 until enArr.length()) {
                                val eInner = flattenValue(enArr[i]).filter { it.isNotBlank() }
                                val before = heSegs.size
                                alignedAppend(emptyList(), eInner, heSegs, enSegs)
                                repeat(heSegs.size - before) { outerIndices.add(i) }
                            }
                        }
                        else -> {
                            // Outer counts differ and both non-zero (e.g. intro: 1 he vs 7 en).
                            val hInner = flattenValue(heArr).filter { it.isNotBlank() }
                            val eInner = flattenValue(enArr).filter { it.isNotBlank() }
                            val before = heSegs.size
                            alignedAppend(hInner, eInner, heSegs, enSegs)
                            repeat(heSegs.size - before) { outerIndices.add(0) }
                        }
                    }
                } else {
                    // Scalar or non-array values — fall back to flat lists.
                    heSegs.addAll(flattenValue(heVal).filter { it.isNotBlank() })
                    enSegs.addAll(flattenValue(enVal).filter { it.isNotBlank() })
                    for (i in heSegs.indices) outerIndices.add(i)
                }

                Triple(heSegs.toList(), enSegs.toList(), outerIndices.toList())
            } catch (e: Exception) {
                Triple(emptyList(), emptyList(), emptyList())
            }
        }

    private fun alignedAppend(
        hInner: List<String>, eInner: List<String>,
        heSegs: MutableList<String>, enSegs: MutableList<String>
    ) {
        if (hInner.isEmpty() && eInner.isEmpty()) return
        when {
            hInner.size == eInner.size ->
                hInner.zip(eInner).forEach { (h, e) -> heSegs.add(h); enSegs.add(e) }
            eInner.isEmpty() ->
                // No English: each Hebrew paragraph is its own entry.
                hInner.forEach { h -> heSegs.add(h); enSegs.add("") }
            hInner.isEmpty() ->
                // No Hebrew: each English paragraph is its own entry.
                eInner.forEach { e -> heSegs.add(""); enSegs.add(e) }
            hInner.size == 1 -> {
                // 1 Hebrew para, multiple English: join English into one entry.
                heSegs.add(hInner[0]); enSegs.add(eInner.joinToString(" "))
            }
            eInner.size == 1 -> {
                // Multiple Hebrew paras, 1 English: join Hebrew into one entry.
                heSegs.add(hInner.joinToString(" ")); enSegs.add(eInner[0])
            }
            else -> {
                // Both > 1 but different counts: pair up to min, extras get empty partner.
                val minCount = minOf(hInner.size, eInner.size)
                for (j in 0 until minCount) { heSegs.add(hInner[j]); enSegs.add(eInner[j]) }
                for (j in minCount until hInner.size) { heSegs.add(hInner[j]); enSegs.add("") }
                for (j in minCount until eInner.size) { heSegs.add(""); enSegs.add(eInner[j]) }
            }
        }
    }

    /** Fetches a pre-built Sefaria ref string in the given language ("he" or "en"). */
    suspend fun fetchRaw(ref: String, lang: String): List<String> =
        fetchSingleLang(ref, lang)

    suspend fun fetchCommentary(type: CommentaryType, mainRef: String): List<String> {
        val commentaryRef = type.sefariaRef(mainRef)
        return runCatching { fetchSingleLang(commentaryRef, "en") }.getOrElse { emptyList() }
    }

    suspend fun fetchCommentaryHebrew(type: CommentaryType, mainRef: String): List<String> {
        val commentaryRef = type.sefariaRef(mainRef)
        return runCatching { fetchSingleLang(commentaryRef, "he") }.getOrElse { emptyList() }
    }

    fun ref(category: TextCategory, bookOrTractateIndex: Int, chapterOrDaf: Int, amud: String? = null): String {
        return when (category) {
            TextCategory.TANAKH -> {
                val book = TextCatalog.allTanakhBooks.find { it.id == bookOrTractateIndex }
                    ?: TextCatalog.allTanakhBooks[0]
                "${book.sefariaName} $chapterOrDaf"
            }
            TextCategory.MISHNAH -> {
                val tractate = TextCatalog.allMishnahTractates.find { it.id == bookOrTractateIndex }
                    ?: TextCatalog.allMishnahTractates[0]
                "${tractate.sefariaName} $chapterOrDaf"
            }
            TextCategory.TALMUD -> {
                val tractate = TextCatalog.allTalmudTractates.find { it.id == bookOrTractateIndex }
                    ?: TextCatalog.allTalmudTractates[0]
                val a = amud ?: "a"
                "${tractate.sefariaName} $chapterOrDaf$a"
            }
            TextCategory.RAMBAM -> {
                val work = TextCatalog.allRambamWorks.find { it.id == bookOrTractateIndex }
                    ?: TextCatalog.allRambamWorks[0]
                "${work.sefariaName} $chapterOrDaf"
            }
            TextCategory.SHULCHAN_ARUKH -> {
                val section = TextCatalog.shulchanArukhSections.find { it.id == bookOrTractateIndex }
                    ?: TextCatalog.shulchanArukhSections[0]
                "${section.sefariaName} $chapterOrDaf"
            }
            TextCategory.MIDRASH -> ""
        }
    }

    suspend fun fetchFullDaf(tractateIndex: Int, daf: Int): List<TextSegment> = coroutineScope {
        val tractate = TextCatalog.allTalmudTractates.find { it.id == tractateIndex }
            ?: TextCatalog.allTalmudTractates[0]
        val refA = "${tractate.sefariaName} ${daf}a"
        val refB = "${tractate.sefariaName} ${daf}b"

        val pairADef = async { runCatching { fetchBoth(refA) } }
        val pairBDef = async { runCatching { fetchBoth(refB) } }

        val pairAResult = pairADef.await()
        val pairBResult = pairBDef.await()

        val pairA = pairAResult.getOrElse { Pair(emptyList(), emptyList()) }
        val pairB = pairBResult.getOrElse { Pair(emptyList(), emptyList()) }

        val segments = mutableListOf<TextSegment>()

        val (heA, enA) = pairA
        val realCountA = maxOf(heA.size, enA.size)
        for (i in 0 until realCountA) {
            segments.add(TextSegment.content(
                index = i,
                he = if (i < heA.size) heA[i] else "",
                en = if (i < enA.size) enA[i] else ""
            ))
        }

        // Insert amud-B marker
        segments.add(TextSegment.amudBMarker(daf))

        val (heB, enB) = pairB
        val startIdx = realCountA
        val realCountB = maxOf(heB.size, enB.size)
        for (i in 0 until realCountB) {
            segments.add(TextSegment.content(
                index = startIdx + i,
                he = if (i < heB.size) heB[i] else "",
                en = if (i < enB.size) enB[i] else ""
            ))
        }

        val validSegments = segments.filter { it.isAmudBMarker || it.hebrewHTML.isNotEmpty() || it.englishHTML.isNotEmpty() }
        if (validSegments.isNotEmpty()) return@coroutineScope validSegments

        for (result in listOf(pairAResult, pairBResult)) {
            val error = result.exceptionOrNull()
            if (error != null && error !is SefariaException.NoText) throw error
        }
        throw SefariaException.NoText
    }

    suspend fun fetchChapter(
        category: TextCategory,
        bookOrTractateIndex: Int,
        chapter: Int,
        selectedCommentaries: List<CommentaryType> = emptyList()
    ): List<TextSegment> {
        val r = ref(category, bookOrTractateIndex, chapter)
        val (he, en) = fetchBoth(r)
        val count = maxOf(he.size, en.size)
        val labelStyle = category.segmentLabelStyle
        val isSA = category == TextCategory.SHULCHAN_ARUKH

        if (isSA) {
            val sharedCounters = mutableMapOf<String, Int>()
            val segments = mutableListOf<TextSegment>()
            for (i in 0 until count) {
                val label = segmentLabel(labelStyle, i + 1)
                var heText = if (i < he.size) he[i] else ""
                val enText = if (i < en.size) en[i] else ""
                heText = processCommentaryMarkers(
                    heText, section = bookOrTractateIndex,
                    selectedCommentaries = selectedCommentaries,
                    counters = sharedCounters)
                segments.add(TextSegment.content(index = i, he = heText, en = enText, label = label))
            }
            return segments
        }

        return (0 until count).map { i ->
            val label = segmentLabel(labelStyle, i + 1)
            val heText = if (i < he.size) he[i] else ""
            val enText = if (i < en.size) en[i] else ""
            TextSegment.content(index = i, he = heText, en = enText, label = label)
        }
    }

    // MARK: - Ra'avad Hasagot fetch

    /**
     * Fetches Ra'avad's Hasagot for a Rambam chapter.
     * Returns a list parallel to halakhot; each element contains the Ra'avad's
     * comment strings for that halakha (empty list = no comment).
     */
    /** Fetches Ra'avad's Hasagot for a Rambam chapter in both languages, in parallel.
     *  Returns (he, en) arrays parallel to halakhot; empty inner list = no comment. */
    suspend fun fetchRaavad(rambamRef: String, count: Int): Pair<List<List<String>>, List<List<String>>> =
        coroutineScope {
            if (count <= 0) return@coroutineScope Pair(emptyList(), emptyList())
            val raavadRef = "Hasagot HaRa'avad on $rambamRef:1-$count"
            val heDef = async { fetchRaavadLang(raavadRef, "he") }
            val enDef = async { fetchRaavadLang(raavadRef, "en") }
            Pair(heDef.await(), enDef.await())
        }

    private suspend fun fetchRaavadLang(raavadRef: String, lang: String): List<List<String>> =
        withContext(Dispatchers.IO) {
            try {
                val url = buildUrl(raavadRef, lang)
                val request = Request.Builder()
                    .url(url)
                    .cacheControl(CacheControl.Builder().maxStale(24, TimeUnit.HOURS).build())
                    .build()
                val body = executeWithRetry(request).use { it.body?.string() } ?: return@withContext emptyList()
                val json = JSONObject(body)
                if (json.has("error")) return@withContext emptyList()
                val key = if (lang == "he") "he" else "text"
                val arr = json.optJSONArray(key) ?: return@withContext emptyList()
                (0 until arr.length()).map { i ->
                    when (val item = arr.opt(i)) {
                        is JSONArray -> (0 until item.length()).mapNotNull { j ->
                            (item.opt(j) as? String)?.takeIf { it.isNotBlank() }
                        }
                        is String -> if (item.isNotBlank()) listOf(item) else emptyList()
                        else -> emptyList()
                    }
                }
            } catch (e: Exception) {
                emptyList()
            }
        }

    /** Attaches Ra'avad Hasagot to matching Rambam text segments as plain text fields.
     *  he[i] / en[i] holds the comments for segments[i]; empty inner list = skip. */
    fun applyRaavad(heRaavad: List<List<String>>, enRaavad: List<List<String>>, segments: List<TextSegment>): List<TextSegment> {
        if (heRaavad.isEmpty() && enRaavad.isEmpty()) return segments
        return segments.mapIndexed { i, seg ->
            val heComments = heRaavad.getOrNull(i)?.takeIf { it.isNotEmpty() }
            val enComments = enRaavad.getOrNull(i)?.takeIf { it.isNotEmpty() }
            if (heComments == null && enComments == null) return@mapIndexed seg
            val heText = heComments?.let { stripHTML(it.joinToString(" ")) }
            val enText = enComments?.let { stripHTML(it.joinToString(" ")) }
            TextSegment.content(index = seg.index, he = seg.hebrewHTML, en = seg.englishHTML,
                                label = seg.label, raavadHe = heText, raavadEn = enText)
        }
    }

    // MARK: - Helpers

    private fun segmentLabel(style: SegmentLabelStyle, number: Int): String? = when (style) {
        SegmentLabelStyle.VERSE -> "$number"
        SegmentLabelStyle.MISHNAH -> "$number"
        SegmentLabelStyle.HALAKHA -> "$number"
        SegmentLabelStyle.SIF -> "$number"
        SegmentLabelStyle.NONE -> null
    }

    private fun flattenValue(value: Any): List<String> = when (value) {
        is String -> listOf(value)
        is JSONArray -> (0 until value.length()).flatMap { flattenValue(value.get(it)) }
        else -> emptyList()
    }

    // MARK: - SA Commentary Marker Processing

    /**
     * Converts inline Shulchan Arukh commentary markers to readable inline indicators.
     *
     * - Mishnah Berurah (OC): `<i data-commentator="Mishnah Berurah" data-label="X">` → `(X)`
     * - Key commentators by section: replaced with sequential Hebrew letters in the
     *   appropriate bracket style — `(א)` parens or `{א}` curly — based on document order.
     *
     * @param section  0=OC, 1=YD, 2=EH, 3=CM (matches SA section index)
     */
    fun processCommentaryMarkers(
        html: String,
        section: Int = 0,
        selectedCommentaries: List<CommentaryType> = emptyList(),
        counters: MutableMap<String, Int> = mutableMapOf()
    ): String {
        var s = html

        // Slot style table — shared by MB labels and sequential Hebrew-letter markers.
        // Single-panel mode (≤3 commentaries): round | curly | small-round (legacy).
        // Both-panels mode (>3 commentaries): 6-entry table where slots 0-2 are the main
        // panel (all normal size) and slots 3-5 are the right panel (all small size).
        // Bracket types: () round · {} curly · [] square — three visually distinct shapes.
        data class SlotStyle(val open: String, val close: String, val isSmall: Boolean)
        val slotStyles: List<SlotStyle> = if (selectedCommentaries.size > 3) listOf(
            SlotStyle("(", ")", false), SlotStyle("{", "}", false), SlotStyle("[", "]", false),  // main panel
            SlotStyle("(", ")", true),  SlotStyle("{", "}", true),  SlotStyle("[", "]", true)    // right panel (small)
        ) else listOf(
            SlotStyle("(", ")", false),   // slot 0
            SlotStyle("{", "}", false),   // slot 1
            SlotStyle("(", ")", true),    // slot 2 — smaller font (single-panel legacy)
        )

        // ── Mishnah Berurah (OC) — uses data-label attribute ──────────────────
        if (s.contains("Mishnah Berurah")) {
            // Bracket style follows MB's slot position, same as all other commentators.
            val mbSlotIdx = selectedCommentaries.indexOf(CommentaryType.MISHNAH_BERURAH)
            val mbStyle = if (mbSlotIdx in slotStyles.indices) slotStyles[mbSlotIdx]
                          else SlotStyle("(", ")", false)   // fallback when slot unknown
            s = s.replace(
                "data-commentator=Mishnah Berurah\"",
                "data-commentator=\"Mishnah Berurah\""
            )
            val mbRegex = Regex("""<i\b[^>]*Mishnah Berurah[^>]*\bdata-label="([^"]*)"[^>]*>\s*</i>""")
            s = mbRegex.replace(s) { mr ->
                val label = mr.groupValues[1]
                if (label.isEmpty()) ""
                else if (mbStyle.isSmall) "<rf>${mbStyle.open}$label${mbStyle.close}</rf>"
                else "${mbStyle.open}$label${mbStyle.close}"
            }
        }

        // ── Sequential Hebrew-letter markers — dynamic by user's selected commentary slots ───
        // Commentaries without inline markers in this section are skipped (no entry emitted).
        data class MarkerCfg(val name: String, val open: String, val close: String, val isSmall: Boolean = false)
        val sectionMarkers: List<MarkerCfg> = selectedCommentaries
            .mapIndexedNotNull { slotIdx, commentary ->
                if (slotIdx >= slotStyles.size) return@mapIndexedNotNull null
                val dataName = commentary.saCommentatorDataName(section) ?: return@mapIndexedNotNull null
                val st = slotStyles[slotIdx]
                MarkerCfg(name = dataName, open = st.open, close = st.close, isSmall = st.isSmall)
            }

        if (sectionMarkers.isNotEmpty()) {
            val tagRegex = Regex("""<i\b[^>]*\bdata-commentator="([^"]*)"[^>]*>\s*</i>""")
            // Collect (start, end, replacement) tuples in forward order
            data class Replacement(val start: Int, val end: Int, val text: String)
            val replacements = mutableListOf<Replacement>()
            for (mr in tagRegex.findAll(s)) {
                val name = mr.groupValues[1]
                val cfg = sectionMarkers.firstOrNull { it.name == name } ?: continue
                counters[name] = (counters[name] ?: 0) + 1
                val letter = saHebrewLetter(counters[name]!!)
                // Wrap in <rf>…</rf> only for commentators that get smaller rendering;
                // others emit the bracket marker directly at normal body size.
                val marker = if (cfg.isSmall) "<rf>${cfg.open}$letter${cfg.close}</rf> "
                             else "${cfg.open}$letter${cfg.close} "
                replacements.add(Replacement(mr.range.first, mr.range.last + 1, marker))
            }
            // Apply in reverse order so indices stay valid
            val sb = StringBuilder(s)
            for (r in replacements.asReversed()) {
                sb.replace(r.start, r.end, r.text)
            }
            s = sb.toString()
        }

        return s
    }

    /** Returns n as a Hebrew numeral string (additive system: 11=יא, 15=טו, 16=טז, …). */
    fun saHebrewLetter(n: Int): String {
        if (n < 1) return "$n"
        val hundreds = listOf(400 to "ת", 300 to "ש", 200 to "ר", 100 to "ק")
        val tens     = listOf(90 to "צ", 80 to "פ", 70 to "ע", 60 to "ס", 50 to "נ",
                              40 to "מ", 30 to "ל", 20 to "כ", 10 to "י")
        val units    = listOf(9 to "ט", 8 to "ח", 7 to "ז", 6 to "ו", 5 to "ה",
                              4 to "ד", 3 to "ג", 2 to "ב", 1 to "א")
        val result = StringBuilder()
        var rem = n
        for ((v, l) in hundreds) { while (rem >= v) { result.append(l); rem -= v } }
        if (rem == 15) { result.append("טו"); rem = 0 }
        else if (rem == 16) { result.append("טז"); rem = 0 }
        for ((v, l) in tens)  { if (rem >= v) { result.append(l); rem -= v } }
        for ((v, l) in units) { if (rem >= v) { result.append(l); rem -= v } }
        return if (result.isEmpty()) "$n" else result.toString()
    }

    // MARK: - HTML stripping

    /**
     * Strips a leading Sefaria-embedded bold label (e.g. `<b>א</b>`) from a commentary
     * entry's HTML. Called when the commentary panel adds its own slot-based prefix so
     * the Sefaria label and our prefix don't both appear (double-labeling).
     * The pattern only matches a short leading bold segment (≤ 15 chars) to avoid
     * accidentally stripping actual content.
     */
    fun stripLeadingBoldLabel(html: String): String =
        html.replace(Regex("""^\s*<b>[^<]{0,15}</b>\s*"""), "")

    /** Removes Yerushalmi footnote markers and footnote body from raw HTML,
     *  handling nested <i> tags inside the footnote text. */
    fun stripYerushalmiFootnotes(html: String): String {
        // Pass 1: strip <sup class="footnote-marker">N</sup> — simple, no nesting.
        var s = html.replace(
            Regex("""<sup[^>]*class="footnote-marker"[^>]*>.*?</sup>""", RegexOption.IGNORE_CASE), "")

        // Pass 2: depth-aware removal of <i class="footnote">…</i> blocks.
        val result = StringBuilder()
        var remaining = s
        val open = "<i class=\"footnote\""
        while (remaining.isNotEmpty()) {
            val openIdx = remaining.indexOf(open, ignoreCase = true)
            if (openIdx < 0) { result.append(remaining); break }
            result.append(remaining.substring(0, openIdx))
            remaining = remaining.substring(openIdx)
            // Skip to end of opening tag '>'
            val gtIdx = remaining.indexOf('>')
            if (gtIdx < 0) { result.append(remaining); break }
            remaining = remaining.substring(gtIdx + 1)
            // Walk forward counting <i> depth until depth reaches 0
            var depth = 1
            while (depth > 0 && remaining.isNotEmpty()) {
                val ni = remaining.indexOf("<i", ignoreCase = true).takeIf { it >= 0 }
                val nc = remaining.indexOf("</i>", ignoreCase = true).takeIf { it >= 0 }
                if (nc == null) { remaining = ""; break }
                if (ni != null && ni < nc) {
                    depth++
                    remaining = remaining.substring(ni + 2)
                } else {
                    depth--
                    remaining = remaining.substring(nc + 4)
                }
            }
        }
        return result.toString()
    }

    /** Removes bold blocks (including their content) then strips remaining HTML.
     *  Used for Tanakh main text where <b> marks unwanted lemas or footnote anchors. */
    fun stripBoldContent(html: String): String {
        val cleaned = html.replace(
            Regex("<(?:b|strong)[^>]*>.*?</(?:b|strong)>", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)),
            ""
        )
        return stripHTML(cleaned)
    }

    fun stripHTML(html: String): String {
        // Use depth-aware stripping for footnotes — the simple lazy regex fails when
        // the footnote body contains nested <i> tags (e.g. <i>Deut.</i> inside the note).
        var s = stripYerushalmiFootnotes(html)
        // Strip remaining HTML tags and decode entities
        return s
            .replace(Regex("<[^>]+>"), "")
            .replace("&nbsp;",  " ")
            .replace("&thinsp;", " ")
            .replace("&amp;",  "&")
            .replace("&lt;",   "<")
            .replace("&gt;",   ">")
            .replace("&#x27;", "'")
            .replace("&quot;", "\"")
    }

    /**
     * Strips HTML and optionally removes cantillation marks (U+0591–U+05AF) based on the
     * "showTrop" SharedPreferences key (default false). Use for Hebrew text rendering;
     * use [stripHTML] directly for English text.
     */
    fun processedHebrew(html: String, showTrop: Boolean): String {
        val text = stripHTML(html)
        return if (showTrop) text
        else text.filter { c -> c.code < 0x0591 || c.code > 0x05AF }
    }

    /**
     * Parses `<rf>…</rf>` Rashi-font spans from HTML.
     * Returns a list of (text, isRashi) pairs where isRashi=true means Rashi script.
     * Remaining HTML in non-rashi spans is stripped of all tags.
     */
    fun parseRashiSegments(html: String): List<Pair<String, Boolean>> {
        if (!html.contains("<rf>")) return listOf(Pair(stripHTML(html), false))
        val result = mutableListOf<Pair<String, Boolean>>()
        var remaining = html
        while (remaining.isNotEmpty()) {
            val rfStart = remaining.indexOf("<rf>")
            if (rfStart == -1) {
                val text = stripHTML(remaining)
                if (text.isNotEmpty()) result.add(Pair(text, false))
                break
            }
            if (rfStart > 0) {
                val text = stripHTML(remaining.substring(0, rfStart))
                if (text.isNotEmpty()) result.add(Pair(text, false))
            }
            val contentStart = rfStart + "<rf>".length
            val rfEnd = remaining.indexOf("</rf>", contentStart)
            if (rfEnd == -1) {
                val text = stripHTML(remaining.substring(rfStart))
                if (text.isNotEmpty()) result.add(Pair(text, true))
                break
            }
            val rashiText = stripHTML(remaining.substring(contentStart, rfEnd))
            if (rashiText.isNotEmpty()) result.add(Pair(rashiText, true))
            remaining = remaining.substring(rfEnd + "</rf>".length)
        }
        return result
    }

    // Check if html has bold tags (used for editorial highlighting)
    fun hasBoldTags(html: String): Boolean = html.contains("<b>") || html.contains("<strong>")

    // Extract bold segments — returns list of (text, isBold) pairs
    fun parseBoldSegments(html: String): List<Pair<String, Boolean>> {
        val clean = stripHTML(html) // basic strip for non-bold version
        if (!hasBoldTags(html)) return listOf(Pair(stripHTML(html), false))

        val result = mutableListOf<Pair<String, Boolean>>()
        var remaining = html
        while (remaining.isNotEmpty()) {
            val boldStart = remaining.indexOf("<b>").let { if (it == -1) remaining.indexOf("<strong>") else it }
            if (boldStart == -1) {
                val text = stripHTML(remaining)
                if (text.isNotEmpty()) result.add(Pair(text, false))
                break
            }
            if (boldStart > 0) {
                val text = stripHTML(remaining.substring(0, boldStart))
                if (text.isNotEmpty()) result.add(Pair(text, false))
            }
            val isStrong = remaining.substring(boldStart).startsWith("<strong>")
            val closeTag = if (isStrong) "</strong>" else "</b>"
            val openTag = if (isStrong) "<strong>" else "<b>"
            val contentStart = boldStart + openTag.length
            val boldEnd = remaining.indexOf(closeTag, contentStart)
            if (boldEnd == -1) {
                val text = stripHTML(remaining.substring(boldStart))
                if (text.isNotEmpty()) result.add(Pair(text, true))
                break
            }
            val boldText = stripHTML(remaining.substring(contentStart, boldEnd))
            if (boldText.isNotEmpty()) result.add(Pair(boldText, true))
            remaining = remaining.substring(boldEnd + closeTag.length)
        }
        return result
    }

    // MARK: - Tosefta / Yerushalmi

    suspend fun fetchTosefta(tractate: MishnahTractate, chapter: Int): List<TextSegment> {
        val r = "Tosefta ${tractate.name} $chapter"
        val (he, en) = fetchBoth(r)
        val count = maxOf(he.size, en.size)
        return (0 until count).map { i ->
            val label = segmentLabel(SegmentLabelStyle.MISHNAH, i + 1)
            TextSegment.content(
                index = i,
                he = if (i < he.size) he[i] else "",
                en = if (i < en.size) en[i] else "",
                label = label
            )
        }
    }

    suspend fun fetchMidrashByVerse(work: MidrashWork, bookSefariaName: String, chapter: Int, verse: Int): Pair<List<TextSegment>, Int> {
        val verseKey = "$bookSefariaName.$chapter.$verse"
        val encoded = verseKey.replace(" ", "%20")
        val data = withContext(Dispatchers.IO) {
            val req = Request.Builder()
                .url("https://www.sefaria.org/api/links/$encoded")
                .build()
            executeWithRetry(req).use { it.body?.string() ?: "[]" }
        }
        val json = JSONArray(data)
        var midrashRef: String? = null
        for (i in 0 until json.length()) {
            val link = json.getJSONObject(i)
            if (link.optString("index_title") == work.sefariaIndexTitle) {
                val r = link.optString("ref")
                if (r.isNotEmpty()) { midrashRef = r; break }
            }
        }
        if (midrashRef == null) throw Exception("No Midrash passage found for $verseKey in ${work.displayName}")

        // Strip last ":N" to fetch the whole parent section; parse N as scroll target (0-based)
        val colonIdx = midrashRef!!.lastIndexOf(':')
        val scrollToIndex: Int
        val parentRef: String
        if (colonIdx >= 0) {
            val lastNum = midrashRef.substring(colonIdx + 1).toIntOrNull()
            if (lastNum != null) {
                parentRef = midrashRef.substring(0, colonIdx)
                scrollToIndex = maxOf(0, lastNum - 1)
            } else {
                parentRef = midrashRef
                scrollToIndex = 0
            }
        } else {
            parentRef = midrashRef
            scrollToIndex = 0
        }

        val (he, en) = fetchBoth(parentRef)
        val count = maxOf(he.size, en.size)
        if (count == 0) throw Exception("No text found")
        val segs = (0 until count).map { i ->
            TextSegment.content(index = i, he = if (i < he.size) he[i] else "", en = if (i < en.size) en[i] else "")
        }.filter { it.hebrewHTML.isNotEmpty() || it.englishHTML.isNotEmpty() }
        if (segs.isEmpty()) throw Exception("No text found")
        return Pair(segs, scrollToIndex)
    }

    /** Returns the number of halakhot in [chapter] (1-based) for the given Yerushalmi tractate.
     *  Fetches Sefaria's /api/shape endpoint; URLSession caches responses.
     *  Falls back to [defaultCount] if the fetch fails or chapter is out of range. */
    suspend fun fetchYerushalmiHalakhaCount(tractate: MishnahTractate, chapter: Int,
                                             defaultCount: Int = 7): Int {
        return try {
            val encodedName = java.net.URLEncoder.encode(tractate.name, "UTF-8").replace("+", "%20")
            val url = java.net.URL("https://www.sefaria.org/api/shape/Jerusalem%20Talmud%20$encodedName")
            val json = url.readText()
            val arr = org.json.JSONArray(json)
            if (arr.length() == 0) return defaultCount
            val obj = arr.getJSONObject(0)
            val chapters = obj.getJSONArray("chapters")
            val idx = chapter - 1
            if (idx < 0 || idx >= chapters.length()) return defaultCount
            val chapterArr = chapters.getJSONArray(idx)
            maxOf(1, chapterArr.length())
        } catch (e: Exception) { defaultCount }
    }

    suspend fun fetchYerushalmi(tractate: MishnahTractate, chapter: Int, halakha: Int = 1): List<TextSegment> {
        // Use chapter:halakha ref so the API returns only that halakha's segments.
        // halakha 1 == "Tractate 1:1" which the API treats the same as "Tractate 1".
        val r = "Jerusalem Talmud ${tractate.name} $chapter:$halakha"
        val (he, en) = fetchBoth(r)
        val count = maxOf(he.size, en.size)
        return (0 until count).map { i ->
            val label = segmentLabel(SegmentLabelStyle.HALAKHA, i + 1)
            val rawEn = if (i < en.size) en[i] else ""
            TextSegment.content(
                index = i,
                he = if (i < he.size) he[i] else "",
                en = stripYerushalmiFootnotes(rawEn),
                label = label
            )
        }
    }
}
