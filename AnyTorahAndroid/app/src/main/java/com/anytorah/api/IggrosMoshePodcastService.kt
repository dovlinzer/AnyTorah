package com.anytorah.api

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** One "Iggros Moshe A to Z" podcast episode (Rabbi Dov Linzer) that discusses the current
 *  Contemporary Teshuvot siman -- sourced from a manually-maintained Google Sheet ("Shutim
 *  References" tab, filtered to Name of Shu"t == "Iggrot Moshe"), bundled as a static JSON
 *  asset rather than synced live -- see CLAUDE.md's "Iggros Moshe podcast citations" section. */
data class PodcastEpisodeCitation(
    val id: String,
    val title: String,
    val episodeNumber: Int,
    val audioUrl: String
)

/** Loads iggros_moshe_podcast_citations.json from assets (same bundle-JSON-at-init shape as
 *  [com.anytorah.api.TeshuvotPageManager]) and fetches per-episode artwork from SoundCloud's
 *  public oEmbed endpoint (no API key needed) -- the sheet itself has no artwork column.
 *
 *  iggros_moshe_podcast_citations.json format:
 *    { "episodes": { "13": {"title": "...", "episodeNumber": 13, "audioUrl": "..."}, ... },
 *      "citations": { "IggrotMosheEH2": { "17": ["13", "14"], ... }, ... } } */
object IggrosMoshePodcastService {
    private var episodes: Map<String, PodcastEpisodeCitation>? = null
    private var citations: Map<String, Map<String, List<String>>>? = null

    private val artworkCache = HashMap<String, String>()

    private fun ensureLoaded(context: Context) {
        if (episodes != null) return
        val loadedEpisodes = HashMap<String, PodcastEpisodeCitation>()
        val loadedCitations = HashMap<String, Map<String, List<String>>>()
        try {
            val text = context.assets.open("iggros_moshe_podcast_citations.json")
                .bufferedReader().use { it.readText() }
            val root = JSONObject(text)

            val episodesObj = root.getJSONObject("episodes")
            for (id in episodesObj.keys()) {
                val e = episodesObj.getJSONObject(id)
                loadedEpisodes[id] = PodcastEpisodeCitation(
                    id = id,
                    title = e.optString("title"),
                    episodeNumber = e.optInt("episodeNumber"),
                    audioUrl = e.optString("audioUrl")
                )
            }

            val citationsObj = root.getJSONObject("citations")
            for (volume in citationsObj.keys()) {
                val simanMap = citationsObj.getJSONObject(volume)
                val bySiman = HashMap<String, List<String>>()
                for (siman in simanMap.keys()) {
                    val arr = simanMap.getJSONArray(siman)
                    bySiman[siman] = (0 until arr.length()).map { arr.getString(it) }
                }
                loadedCitations[volume] = bySiman
            }
        } catch (_: Exception) {
            // Leave both maps empty -- citedEpisodes() degrades to "no citations" rather than crashing.
        }
        episodes = loadedEpisodes
        citations = loadedCitations
    }

    /** Every episode that discusses this volume+siman, in a stable order (by episode number) --
     *  empty if none. Purely synchronous, from bundled data -- no network involved. */
    fun citedEpisodes(context: Context, volume: String, siman: Int): List<PodcastEpisodeCitation> {
        ensureLoaded(context)
        val episodeIds = citations?.get(volume)?.get(siman.toString()) ?: return emptyList()
        return episodeIds.mapNotNull { episodes?.get(it) }.sortedBy { it.episodeNumber }
    }

    /** SoundCloud's public oEmbed thumbnail for this episode, cached by episode id. The sheet
     *  has no artwork column, so this is the only artwork source -- no auth/API key needed. */
    suspend fun artworkUrl(episode: PodcastEpisodeCitation): String? {
        artworkCache[episode.id]?.let { return it }
        return withContext(Dispatchers.IO) {
            try {
                val encodedUrl = URLEncoder.encode(episode.audioUrl, "UTF-8")
                val connection = URL("https://soundcloud.com/oembed?url=$encodedUrl&format=json")
                    .openConnection() as HttpURLConnection
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                if (connection.responseCode != 200) return@withContext null
                val json = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                val thumb = json.optString("thumbnail_url").takeIf { it.isNotBlank() }
                if (thumb != null) artworkCache[episode.id] = thumb
                thumb
            } catch (_: Exception) {
                null
            }
        }
    }
}
