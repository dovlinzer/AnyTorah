package com.anytorah.api

import android.content.Context
import org.json.JSONObject

/**
 * Loads teshuvot_pages.json and teshuvot_siman_index.json from Android assets and vends Google
 * Drive image URLs + siman->page lookups for Contemporary Teshuvot volumes (image-page based,
 * not Sefaria-based -- see ContemporaryTeshuvotWork). Mirrors TeshuvotPageManager.swift's logic
 * (same Drive-thumbnail mechanism, same siman-floor-lookup), adapted to this codebase's
 * Context-parameterized asset-loading pattern (see EinAyahLoader for the same shape).
 *
 * teshuvot_pages.json format:       { "IggrotMosheEH2": { "1": "DRIVE_FILE_ID", "2": "...", ... }, ... }
 * teshuvot_siman_index.json format: { "IggrotMosheEH2": { "1": 1, "2": 2, ... } }  (siman -> page)
 */
object TeshuvotPageManager {

    private var pagesCache: JSONObject? = null
    private var simanIndexCache: JSONObject? = null

    private fun pages(context: Context): JSONObject {
        pagesCache?.let { return it }
        val json = context.assets.open("teshuvot_pages.json").bufferedReader().use { it.readText() }
        return JSONObject(json).also { pagesCache = it }
    }

    private fun simanIndex(context: Context): JSONObject {
        simanIndexCache?.let { return it }
        val json = context.assets.open("teshuvot_siman_index.json").bufferedReader().use { it.readText() }
        return JSONObject(json).also { simanIndexCache = it }
    }

    /** Total page-image count available for a volume. */
    fun pageCount(context: Context, volume: String): Int {
        val obj = try { pages(context).optJSONObject(volume) } catch (e: Exception) { null } ?: return 0
        return obj.length()
    }

    /** Google Drive thumbnail URL for a given volume + page number (1-indexed). */
    fun imageUrl(context: Context, volume: String, page: Int): String? {
        val obj = try { pages(context).optJSONObject(volume) } catch (e: Exception) { null } ?: return null
        val fileId = obj.optString(page.toString(), "").takeIf { it.isNotEmpty() } ?: return null
        return "https://drive.google.com/thumbnail?id=$fileId&sz=w1600"
    }

    /** The page a siman starts on, from the hand-maintained index -- see
     *  ContemporaryTeshuvotVolume's Swift doc comment for accuracy caveats. */
    fun page(context: Context, volume: String, siman: Int): Int? {
        val obj = try { simanIndex(context).optJSONObject(volume) } catch (e: Exception) { null } ?: return null
        val p = obj.optInt(siman.toString(), -1)
        return if (p >= 0) p else null
    }

    /** The siman most likely being displayed on a given page -- the reverse of [page], used to
     *  drive the reader header's siman pill. Finds the largest indexed siman whose own page is
     *  <= the given page (a floor lookup, not an exact match) -- see the Swift copy's doc
     *  comment for the full reasoning, including why ties (two simanim starting on the exact
     *  same page, a real common case) now deterministically prefer the SMALLEST siman rather
     *  than whichever `JSONObject` key happened to iterate last (a real reported bug,
     *  2026-08-31). Doesn't handle "the reader explicitly picked the LATER of two simanim
     *  sharing a page" -- that's `TextReaderViewModel.contemporaryPickedSiman`'s job, checked
     *  before this function is even called. */
    fun siman(context: Context, volume: String, page: Int): Int? {
        val obj = try { simanIndex(context).optJSONObject(volume) } catch (e: Exception) { null } ?: return null
        var bestSiman: Int? = null
        var bestPage = -1
        val keys = obj.keys()
        while (keys.hasNext()) {
            val simanStr = keys.next()
            val simanPage = obj.optInt(simanStr, -1)
            val siman = simanStr.toIntOrNull() ?: continue
            if (simanPage !in 0..page) continue
            if (simanPage > bestPage || (simanPage == bestPage && siman < (bestSiman ?: Int.MAX_VALUE))) {
                bestPage = simanPage
                bestSiman = siman
            }
        }
        return bestSiman
    }
}
