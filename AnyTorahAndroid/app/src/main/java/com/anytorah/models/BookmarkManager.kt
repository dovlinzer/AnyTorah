package com.anytorah.models

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BookmarkManager(private val context: Context) {

    private val gson = Gson()
    private val prefs = context.getSharedPreferences("anytorah_bookmarks", Context.MODE_PRIVATE)
    private val KEY = "bookmarks_json"

    private val _bookmarks = MutableStateFlow<List<Bookmark>>(emptyList())
    val bookmarks: StateFlow<List<Bookmark>> = _bookmarks.asStateFlow()

    init {
        load()
    }

    private fun load() {
        val json = prefs.getString(KEY, null) ?: return
        try {
            val type = object : TypeToken<List<BookmarkDto>>() {}.type
            val dtos: List<BookmarkDto> = gson.fromJson(json, type)
            _bookmarks.value = dtos.map { it.toBookmark() }
        } catch (e: Exception) {
            _bookmarks.value = emptyList()
        }
    }

    private fun save() {
        val dtos = _bookmarks.value.map { BookmarkDto.from(it) }
        prefs.edit().putString(KEY, gson.toJson(dtos)).apply()
    }

    fun add(bookmark: Bookmark) {
        _bookmarks.value = listOf(bookmark) + _bookmarks.value
        save()
    }

    fun delete(bookmarkId: String) {
        _bookmarks.value = _bookmarks.value.filter { it.id != bookmarkId }
        save()
    }

    fun update(bookmark: Bookmark) {
        _bookmarks.value = _bookmarks.value.map { if (it.id == bookmark.id) bookmark else it }
        save()
    }
}

// DTO for Gson serialization (uses string category instead of enum directly).
//
// Fields added after the original version (turSection/turSiman, the midrash* fields, and now
// mishnahSubcategoryId/talmudSubcategoryId) are declared nullable with an explicit `?:`
// fallback in toBookmark() — NOT non-null with a Kotlin default parameter value. Plain Gson
// (no kotlin-reflect adapter registered here) constructs objects via unsafe allocation for
// data classes, which does NOT run the constructor and so does NOT apply Kotlin default
// parameter values for a field missing from old JSON; a non-null Int would silently come back
// 0 instead of its declared default. Nullable fields don't have this trap — a missing JSON key
// reliably decodes to null, which the `?:` below then maps to the real default explicitly.
//
// Historical bug fixed alongside the two new subcategory fields: this DTO never included
// turSection/turSiman or any midrash* field at all (not even non-nullable), so every Tur or
// Midrash bookmark silently lost its location on save/reload — it displayed correctly for the
// remainder of the session that created it (the in-memory Bookmark list is untouched), but
// reopening the app always snapped back to Tur OC siman 1 / Midrash Halakha's first work,
// regardless of what was actually bookmarked. Fixed by adding the missing fields here too.
private data class BookmarkDto(
    val id: String,
    val categoryRaw: String,
    val mishnahSubcategoryId: String? = null,
    val talmudSubcategoryId: String? = null,
    val tanakhBookIndex: Int,
    val tanakhChapter: Int,
    val mishnahSederIndex: Int,
    val mishnahTractateIndexInSeder: Int,
    val mishnahChapter: Int,
    val talmudSederIndex: Int,
    val talmudTractateIndexInSeder: Int,
    val talmudDaf: Int,
    val rambamSeferIndex: Int,
    val rambamWorkIndexInSefer: Int,
    val rambamChapter: Int,
    val saSection: Int,
    val saSiman: Int,
    val turSection: Int? = null,
    val turSiman: Int? = null,
    val midrashSubcategoryId: String? = null,
    val midrashWorkId: String? = null,
    val midrashBookIndex: Int? = null,
    val midrashChapter: Int? = null,
    val midrashVerse: Int? = null,
    // Teshuvot Rishonim — nullable for the same reason as every other field added after the
    // original version (see the class doc comment above); added alongside the category itself.
    val teshuvotSubcategoryId: String? = null,
    val teshuvotWorkId: String? = null,
    val teshuvotVolume: Int? = null,
    val teshuvotSiman: Int? = null,
    val name: String,
    val subtitle: String,
    val notes: String,
    val createdAt: Long
) {
    fun toBookmark(): Bookmark {
        val cat = TextCategory.values().find { it.name == categoryRaw } ?: TextCategory.TALMUD
        return Bookmark(
            id = id,
            category = cat,
            mishnahSubcategoryId = mishnahSubcategoryId ?: MishnahSubcategory.MISHNAH.id,
            talmudSubcategoryId = talmudSubcategoryId ?: TalmudSubcategory.BAVLI.id,
            tanakhBookIndex = tanakhBookIndex,
            tanakhChapter = tanakhChapter,
            mishnahSederIndex = mishnahSederIndex,
            mishnahTractateIndexInSeder = mishnahTractateIndexInSeder,
            mishnahChapter = mishnahChapter,
            talmudSederIndex = talmudSederIndex,
            talmudTractateIndexInSeder = talmudTractateIndexInSeder,
            talmudDaf = talmudDaf,
            rambamSeferIndex = rambamSeferIndex,
            rambamWorkIndexInSefer = rambamWorkIndexInSefer,
            rambamChapter = rambamChapter,
            saSection = saSection,
            saSiman = saSiman,
            turSection = turSection ?: 0,
            turSiman = turSiman ?: 1,
            midrashSubcategoryId = midrashSubcategoryId ?: MidrashSubcategory.HALAKHA.id,
            midrashWorkId = midrashWorkId ?: MidrashWork.MEKHILTA_YISHMAEL.id,
            midrashBookIndex = midrashBookIndex ?: 1,
            midrashChapter = midrashChapter ?: 1,
            midrashVerse = midrashVerse ?: 1,
            teshuvotSubcategoryId = teshuvotSubcategoryId ?: TeshuvotSubcategory.RISHONIM.id,
            teshuvotWorkId = teshuvotWorkId ?: TeshuvotWork.RASHI.id,
            teshuvotVolume = teshuvotVolume ?: 1,
            teshuvotSiman = teshuvotSiman ?: 1,
            name = name,
            subtitle = subtitle,
            notes = notes,
            createdAt = createdAt
        )
    }

    companion object {
        fun from(b: Bookmark) = BookmarkDto(
            id = b.id,
            categoryRaw = b.category.name,
            mishnahSubcategoryId = b.mishnahSubcategoryId,
            talmudSubcategoryId = b.talmudSubcategoryId,
            tanakhBookIndex = b.tanakhBookIndex,
            tanakhChapter = b.tanakhChapter,
            mishnahSederIndex = b.mishnahSederIndex,
            mishnahTractateIndexInSeder = b.mishnahTractateIndexInSeder,
            mishnahChapter = b.mishnahChapter,
            talmudSederIndex = b.talmudSederIndex,
            talmudTractateIndexInSeder = b.talmudTractateIndexInSeder,
            talmudDaf = b.talmudDaf,
            rambamSeferIndex = b.rambamSeferIndex,
            rambamWorkIndexInSefer = b.rambamWorkIndexInSefer,
            rambamChapter = b.rambamChapter,
            saSection = b.saSection,
            saSiman = b.saSiman,
            turSection = b.turSection,
            turSiman = b.turSiman,
            midrashSubcategoryId = b.midrashSubcategoryId,
            midrashWorkId = b.midrashWorkId,
            midrashBookIndex = b.midrashBookIndex,
            midrashChapter = b.midrashChapter,
            midrashVerse = b.midrashVerse,
            teshuvotSubcategoryId = b.teshuvotSubcategoryId,
            teshuvotWorkId = b.teshuvotWorkId,
            teshuvotVolume = b.teshuvotVolume,
            teshuvotSiman = b.teshuvotSiman,
            name = b.name,
            subtitle = b.subtitle,
            notes = b.notes,
            createdAt = b.createdAt
        )
    }
}
