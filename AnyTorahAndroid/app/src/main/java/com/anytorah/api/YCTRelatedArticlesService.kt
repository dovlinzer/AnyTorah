package com.anytorah.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** A YCT halakha piece (article or audio episode) that cites the Shulchan Arukh siman it's keyed
 *  under -- sourced from AnyYCTorah's existing Supabase content index (library.yctorah.org +
 *  psak.yctorah.org, already classified/populated there; this app only reads it). See
 *  CLAUDE.md's "Related YCT Articles" section for the full data-model story. */
data class RelatedYCTPiece(
    val id: Long,
    val title: String,
    val url: String,
    val author: String?,
    val excerpt: String?,
    val postType: String,   // "post" | "audio"
    val imageURL: String?
) {
    val isAudio: Boolean get() = postType == "audio"
}

object YCTRelatedArticlesService {
    private const val SUPABASE_URL = "https://zewdazoijdpakugfvnzt.supabase.co"
    private val ANON_KEY = DedicationService.ANON_KEY   // already a non-private const val

    // Exact strings AnyYCTorah's book_or_tractate column uses (confirmed live) -- NOT
    // TextCatalog's own SA section names ("Yoreh Deah", no apostrophe).
    private val saBookNames = listOf("Orach Chayim", "Yoreh De'ah", "Even HaEzer", "Choshen Mishpat")

    // In-memory only, keyed by SA section (book) -- a siman-only change (the common case while
    // paging within one book) is then a free map lookup; only crossing OC/YD/EH/CM triggers a
    // real fetch.
    private val cacheBySection = HashMap<Int, Map<Int, List<RelatedYCTPiece>>>()

    suspend fun relatedPieces(saSection: Int, saSiman: Int): List<RelatedYCTPiece> {
        if (saSection !in saBookNames.indices) return emptyList()
        val indexed = cacheBySection[saSection] ?: fetchAndIndex(saBookNames[saSection]).also {
            cacheBySection[saSection] = it
        }
        return indexed[saSiman] ?: emptyList()
    }

    /** Fetches every SA citation for one book and indexes it by anchor siman. A piece citing
     *  multiple simanim in the same book collapses to one entry, anchored at its
     *  `is_book_primary` citation if one exists (an offline LLM tie-breaker AnyYCTorah already
     *  ran), else the lowest siman it cites -- the one piece of AnyYCTorah's server-computed
     *  logic worth replicating here, since it changes *which* siman a piece surfaces under.
     *  Language filtering/translation flags are deliberately NOT replicated -- see CLAUDE.md. */
    private suspend fun fetchAndIndex(book: String): Map<Int, List<RelatedYCTPiece>> = withContext(Dispatchers.IO) {
        try {
            val encodedBook = URLEncoder.encode(book, "UTF-8")
            val urlStr = "$SUPABASE_URL/rest/v1/piece_references" +
                "?select=piece_id,locator,is_book_primary,pieces(id,title,url,author,excerpt,post_type,image_url)" +
                "&source_type=eq.SA&book_or_tractate=eq.$encodedBook&limit=5000"
            val connection = URL(urlStr).openConnection() as HttpURLConnection
            connection.setRequestProperty("apikey", ANON_KEY)
            connection.setRequestProperty("Authorization", "Bearer $ANON_KEY")
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            if (connection.responseCode != 200) return@withContext emptyMap()
            val rows = JSONArray(connection.inputStream.bufferedReader().readText())

            data class Citation(val siman: Int, val isPrimary: Boolean)
            val citationsByPiece = HashMap<Long, MutableList<Citation>>()
            val pieceById = HashMap<Long, RelatedYCTPiece>()

            for (i in 0 until rows.length()) {
                val row = rows.getJSONObject(i)
                val siman = Regex("^\\d+").find(row.optString("locator"))?.value?.toIntOrNull() ?: continue
                val pieceObj = row.optJSONObject("pieces") ?: continue
                val pieceId = pieceObj.optLong("id", -1L)
                if (pieceId < 0) continue
                citationsByPiece.getOrPut(pieceId) { mutableListOf() }
                    .add(Citation(siman, row.optBoolean("is_book_primary", false)))
                if (pieceId !in pieceById) {
                    pieceById[pieceId] = RelatedYCTPiece(
                        id = pieceId,
                        title = pieceObj.optString("title"),
                        url = pieceObj.optString("url"),
                        author = pieceObj.optString("author").takeIf { it.isNotBlank() },
                        excerpt = pieceObj.optString("excerpt").takeIf { it.isNotBlank() },
                        postType = pieceObj.optString("post_type").ifBlank { "post" },
                        imageURL = pieceObj.optString("image_url").takeIf { it.isNotBlank() })
                }
            }

            val indexed = HashMap<Int, MutableList<RelatedYCTPiece>>()
            for ((pieceId, citations) in citationsByPiece) {
                val piece = pieceById[pieceId] ?: continue
                if (piece.url.isBlank()) continue
                val anchorSiman = citations.firstOrNull { it.isPrimary }?.siman ?: citations.minOf { it.siman }
                indexed.getOrPut(anchorSiman) { mutableListOf() }.add(piece)
            }
            indexed
        } catch (_: Exception) { emptyMap() }
    }
}
