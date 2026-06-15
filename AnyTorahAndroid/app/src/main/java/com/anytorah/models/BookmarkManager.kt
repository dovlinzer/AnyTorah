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

// DTO for Gson serialization (uses string category instead of enum directly)
private data class BookmarkDto(
    val id: String,
    val categoryRaw: String,
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
            name = b.name,
            subtitle = b.subtitle,
            notes = b.notes,
            createdAt = b.createdAt
        )
    }
}
