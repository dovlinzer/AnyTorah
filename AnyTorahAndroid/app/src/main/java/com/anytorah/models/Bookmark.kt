package com.anytorah.models

import java.util.UUID

data class Bookmark(
    val id: String = UUID.randomUUID().toString(),
    val category: TextCategory,
    val tanakhBookIndex: Int = 0,
    val tanakhChapter: Int = 1,
    val mishnahSederIndex: Int = 0,
    val mishnahTractateIndexInSeder: Int = 0,
    val mishnahChapter: Int = 1,
    val talmudSederIndex: Int = 0,
    val talmudTractateIndexInSeder: Int = 0,
    val talmudDaf: Int = 2,
    val rambamSeferIndex: Int = 0,
    val rambamWorkIndexInSefer: Int = 0,
    val rambamChapter: Int = 1,
    val saSection: Int = 0,
    val saSiman: Int = 1,
    val midrashSubcategoryId: String = MidrashSubcategory.HALAKHA.id,
    val midrashWorkId: String = MidrashWork.MEKHILTA_YISHMAEL.id,
    val midrashBookIndex: Int = 1,
    val midrashChapter: Int = 1,
    val midrashVerse: Int = 1,
    val name: String,
    val subtitle: String,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
) {
    fun matches(query: String): Boolean {
        val q = query.lowercase()
        return name.lowercase().contains(q) ||
               subtitle.lowercase().contains(q) ||
               notes.lowercase().contains(q)
    }
}
