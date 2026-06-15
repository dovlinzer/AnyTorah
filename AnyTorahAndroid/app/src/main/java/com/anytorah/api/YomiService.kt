package com.anytorah.api

import com.anytorah.models.TextCatalog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

object YomiService {

    data class TanakhYomiResult(val bookIndex: Int, val chapter: Int, val displayLabel: String)
    data class ParshaResult(val bookIndex: Int, val chapter: Int, val verse: Int?, val name: String, val displayLabel: String)
    data class DafYomiResult(val sederIndex: Int, val tractateIndexInSeder: Int, val daf: Int, val displayLabel: String)
    data class MishnahYomiResult(val sederIndex: Int, val tractateIndexInSeder: Int, val chapter: Int, val displayLabel: String)
    data class RambamYomiResult(val seferIndex: Int, val workIndexInSefer: Int, val chapter: Int, val displayLabel: String)

    data class YomiResults(
        val daf: DafYomiResult? = null,
        val mishnah: MishnahYomiResult? = null,
        val rambam: RambamYomiResult? = null,
        val tanakh: TanakhYomiResult? = null,
        val parsha: ParshaResult? = null
    )

    private val talmudNameMap = mapOf(
        "Taanit" to "Ta'anit",
        "Bava Metzia" to "Bava Metzia"
    )

    private val mishnahNameMap = emptyMap<String, String>()

    private val rambamNameMap = mapOf(
        "The Order of Prayer" to "Mishneh Torah, Prayer and the Priestly Blessing",
        "Oaths" to "Mishneh Torah, Oaths",
        "Sabbath" to "Mishneh Torah, Sabbath",
        "Foundations of the Torah" to "Mishneh Torah, Foundations of the Torah",
        "Human Dispositions" to "Mishneh Torah, Human Dispositions",
        "Torah Study" to "Mishneh Torah, Torah Study",
        "Foreign Worship and Customs of the Nations" to "Mishneh Torah, Foreign Worship and Customs of the Nations",
        "Repentance" to "Mishneh Torah, Repentance",
        "Reading the Shema" to "Mishneh Torah, Reading the Shema",
        "Prayer and the Priestly Blessing" to "Mishneh Torah, Prayer and the Priestly Blessing",
        "Tefillin, Mezuzah and the Torah Scroll" to "Mishneh Torah, Tefillin, Mezuzah and the Torah Scroll",
        "Fringes" to "Mishneh Torah, Fringes",
        "Blessings" to "Mishneh Torah, Blessings",
        "Circumcision" to "Mishneh Torah, Circumcision",
        "Eruvin" to "Mishneh Torah, Eruvin",
        "Leavened and Unleavened Bread" to "Mishneh Torah, Leavened and Unleavened Bread",
        "Shofar, Sukkah and Lulav" to "Mishneh Torah, Shofar, Sukkah and Lulav",
        "Fasts" to "Mishneh Torah, Fasts",
        "Scroll of Esther and Hanukkah" to "Mishneh Torah, Scroll of Esther and Hanukkah"
    )

    suspend fun fetchToday(): YomiResults = withContext(Dispatchers.IO) {
        try {
            val client = OkHttpClient()
            val request = Request.Builder()
                .url("https://www.sefaria.org/api/calendars")
                .build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext YomiResults()
            val json = JSONObject(body)
            val items = json.optJSONArray("calendar_items") ?: return@withContext YomiResults()

            var daf: DafYomiResult? = null
            var mishnah: MishnahYomiResult? = null
            var rambam: RambamYomiResult? = null
            var tanakh: TanakhYomiResult? = null
            var parsha: ParshaResult? = null

            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                val titleObj = item.optJSONObject("title") ?: continue
                val titleEn = titleObj.optString("en") ?: continue
                val ref = item.optString("ref") ?: ""

                when (titleEn) {
                    "Daf Yomi" -> daf = parseDafYomi(ref)
                    "Daily Mishnah" -> mishnah = parseMishnahYomi(ref)
                    "Daily Rambam" -> rambam = parseRambamYomi(ref)
                    "929" -> tanakh = parseTanakhYomi(ref)
                    "Parashat Hashavua" -> {
                        val displayObj = item.optJSONObject("displayValue")
                        val name = displayObj?.optString("en") ?: ""
                        parsha = parseParshaYomi(ref, name)
                    }
                }
            }

            YomiResults(daf = daf, mishnah = mishnah, rambam = rambam, tanakh = tanakh, parsha = parsha)
        } catch (e: Exception) {
            YomiResults()
        }
    }

    private fun parseDafYomi(ref: String): DafYomiResult? {
        val parts = ref.split(" ")
        if (parts.size < 2) return null
        val daf = parts.last().toIntOrNull() ?: return null
        var tractate = parts.dropLast(1).joinToString(" ")
        tractate = talmudNameMap[tractate] ?: tractate

        for ((si, seder) in TextCatalog.talmudSedarim.withIndex()) {
            for ((ti, t) in seder.tractates.withIndex()) {
                if (t.sefariaName == tractate) {
                    return DafYomiResult(sederIndex = si, tractateIndexInSeder = ti,
                        daf = daf, displayLabel = "${t.sefariaName} $daf")
                }
            }
        }
        return null
    }

    private fun parseMishnahYomi(ref: String): MishnahYomiResult? {
        val r = if (ref.startsWith("Mishnah ")) ref.drop("Mishnah ".length) else ref
        val parts = r.split(" ")
        if (parts.size < 2) return null
        val chapterStr = (parts.last()).split(":").first()
        val chapter = chapterStr.toIntOrNull() ?: return null
        val tractate = parts.dropLast(1).joinToString(" ")
        val sefariaName = mishnahNameMap[tractate] ?: "Mishnah $tractate"

        for ((si, seder) in TextCatalog.mishnahSedarim.withIndex()) {
            for ((ti, t) in seder.tractates.withIndex()) {
                if (t.sefariaName == sefariaName) {
                    return MishnahYomiResult(sederIndex = si, tractateIndexInSeder = ti,
                        chapter = chapter, displayLabel = "${t.name} ch. $chapter")
                }
            }
        }
        return null
    }

    private data class TanakhRefParsed(val bookIndex: Int, val chapter: Int, val verse: Int?)

    private fun parseTanakhRef(ref: String): TanakhRefParsed? {
        val parts = ref.split(" ")
        if (parts.size < 2) return null
        val chapterVerse = parts.last()
        val colonParts = chapterVerse.split(":")
        val chapter = colonParts[0].toIntOrNull() ?: return null
        val verse = if (colonParts.size > 1)
            colonParts[1].split("-").first().toIntOrNull()
        else null
        val bookName = parts.dropLast(1).joinToString(" ")
        val idx = TextCatalog.allTanakhBooks.indexOfFirst { it.sefariaName == bookName }
        if (idx == -1) return null
        return TanakhRefParsed(idx, chapter, verse)
    }

    private fun parseTanakhYomi(ref: String): TanakhYomiResult? {
        val parsed = parseTanakhRef(ref) ?: return null
        val book = TextCatalog.allTanakhBooks[parsed.bookIndex]
        return TanakhYomiResult(bookIndex = parsed.bookIndex, chapter = parsed.chapter,
            displayLabel = "${book.name} ${parsed.chapter}")
    }

    private fun parseParshaYomi(ref: String, name: String): ParshaResult? {
        val parsed = parseTanakhRef(ref) ?: return null
        val book = TextCatalog.allTanakhBooks[parsed.bookIndex]
        return ParshaResult(bookIndex = parsed.bookIndex, chapter = parsed.chapter,
            verse = parsed.verse, name = name,
            displayLabel = "$name (${book.name} ${parsed.chapter})")
    }

    private fun parseRambamYomi(ref: String): RambamYomiResult? {
        val r = if (ref.startsWith("Mishneh Torah, ")) ref.drop("Mishneh Torah, ".length) else ref
        val parts = r.split(" ")
        if (parts.size < 2) return null
        val chapter = parts.last().toIntOrNull() ?: return null
        val calendarWorkName = parts.dropLast(1).joinToString(" ")

        val candidates = listOf(
            "Mishneh Torah, $calendarWorkName",
            rambamNameMap[calendarWorkName] ?: ""
        ).filter { it.isNotEmpty() }

        for (sefariaName in candidates) {
            for ((si, sefer) in TextCatalog.rambamSefarim.withIndex()) {
                for ((wi, work) in sefer.works.withIndex()) {
                    if (work.sefariaName == sefariaName) {
                        return RambamYomiResult(seferIndex = si, workIndexInSefer = wi,
                            chapter = chapter, displayLabel = "${work.name} ch. $chapter")
                    }
                }
            }
        }
        return null
    }
}
