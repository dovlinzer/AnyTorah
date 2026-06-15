package com.anytorah.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

object TalmudAudioService {

    private const val SUPABASE_URL = "https://zewdazoijdpakugfvnzt.supabase.co"
    private const val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpld2Rhem9pamRwYWt1Z2Z2bnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzIwODYsImV4cCI6MjA5MDA0ODA4Nn0.HJxIG18vEpt-exzoQwRLeXiKLAinWfBl7gMORKjxIz8"

    const val SOUNDCLOUD_CLIENT_ID = "tkIWLs4MIowq7bCXP80TOwx6DnDa7UPc"

    private val nameMap = mapOf(
        "Eruvin" to "Eiruvin",
        "Chullin" to "Hullin",
        "Taanit" to "Ta’anit"  // right single quotation mark
    )

    fun supabaseName(tractate: String): String = nameMap[tractate] ?: tractate

    suspend fun audioUrl(tractate: String, daf: Int): String? = withContext(Dispatchers.IO) {
        try {
            val name = supabaseName(tractate)
            val encoded = java.net.URLEncoder.encode(name, "UTF-8")
            val urlStr = "$SUPABASE_URL/rest/v1/episode_audio" +
                    "?select=audio_url" +
                    "&tractate=eq.$encoded" +
                    "&daf=eq.${daf.toDouble()}" +
                    "&limit=1"

            val client = OkHttpClient()
            val request = Request.Builder()
                .url(urlStr)
                .header("apikey", ANON_KEY)
                .header("Authorization", "Bearer $ANON_KEY")
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext null
            val arr = JSONArray(body)
            if (arr.length() == 0) return@withContext null
            val first = arr.getJSONObject(0)
            first.optString("audio_url").takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Resolves a SoundCloud track ID to a playable CDN stream URL.
     * Returns null on failure (expired client ID, network error, etc.)
     */
    suspend fun resolveSoundCloudUrl(trackId: String): String? = withContext(Dispatchers.IO) {
        try {
            val client = OkHttpClient()

            // Step 1: fetch track metadata
            val trackUrl = "https://api-v2.soundcloud.com/tracks/$trackId?client_id=$SOUNDCLOUD_CLIENT_ID"
            val trackReq = Request.Builder().url(trackUrl).build()
            val trackResp = client.newCall(trackReq).execute()
            if (trackResp.code != 200) return@withContext null
            val trackBody = trackResp.body?.string() ?: return@withContext null

            val trackJson = org.json.JSONObject(trackBody)
            val auth = trackJson.optString("track_authorization")
            val media = trackJson.optJSONObject("media") ?: return@withContext null
            val transcodings = media.optJSONArray("transcodings") ?: return@withContext null

            // Prefer progressive (direct MP3) over HLS
            var tcUrl: String? = null
            for (i in 0 until transcodings.length()) {
                val tc = transcodings.getJSONObject(i)
                val format = tc.optJSONObject("format")
                if (format?.optString("protocol") == "progressive") {
                    tcUrl = tc.optString("url")
                    break
                }
            }
            if (tcUrl.isNullOrEmpty()) return@withContext null
            val resolveUrl = "$tcUrl?client_id=$SOUNDCLOUD_CLIENT_ID&track_authorization=$auth"

            // Step 2: resolve transcoding URL → CDN URL
            val streamReq = Request.Builder().url(resolveUrl).build()
            val streamResp = client.newCall(streamReq).execute()
            if (streamResp.code != 200) return@withContext null
            val streamBody = streamResp.body?.string() ?: return@withContext null

            val streamJson = org.json.JSONObject(streamBody)
            streamJson.optString("url").takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            null
        }
    }
}
