package com.anytorah.api

import android.content.Context
import com.anytorah.models.CommentaryEntry
import org.json.JSONObject

/**
 * Loads the bundled Ein Ayah JSON and returns entries for a specific Talmud daf.
 *
 * JSON structure: {"berakhot": {"2a": [{"citation": "...", "text": "..."}], ...}, "shabbat": {...}}
 * Ein Ayah only comments on aggadic passages, so many dafim have no entries.
 */
object EinAyahLoader {

    private var cache: JSONObject? = null

    private fun getCache(context: Context): JSONObject {
        cache?.let { return it }
        val json = context.assets.open("ein_ayah.json").bufferedReader().use { it.readText() }
        return JSONObject(json).also { cache = it }
    }

    /// `daf` is a bare daf number string (e.g. "3") — the app navigates whole dafim.
    /// Combines entries from amud a and amud b.
    fun entries(context: Context, tractate: String, daf: String): List<CommentaryEntry> {
        val data = try { getCache(context) } catch (e: Exception) { return emptyList() }
        val key = tractateKey(tractate)
        val dafMap = data.optJSONObject(key) ?: return emptyList()

        val result = mutableListOf<CommentaryEntry>()
        var idx = 0
        for (amud in listOf("${daf}a", "${daf}b")) {
            val arr = dafMap.optJSONArray(amud) ?: continue
            for (i in 0 until arr.length()) {
                val entry = arr.optJSONObject(i) ?: continue
                val text = entry.optString("text").takeIf { it.isNotEmpty() } ?: continue
                val citation = entry.optString("citation", "")
                val he = if (citation.isEmpty()) text else "$citation\n$text"
                result.add(CommentaryEntry.Text(index = idx++, he = he, en = ""))
            }
        }
        return result
    }

    private fun tractateKey(sefariaName: String): String = when (sefariaName.lowercase()) {
        "berakhot" -> "berakhot"
        "shabbat"  -> "shabbat"
        else       -> sefariaName.lowercase()
    }
}
