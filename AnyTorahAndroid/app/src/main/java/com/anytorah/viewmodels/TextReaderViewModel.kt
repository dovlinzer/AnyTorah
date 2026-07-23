package com.anytorah.viewmodels

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.anytorah.api.Dedication
import com.anytorah.api.DedicationService
import com.anytorah.api.EinAyahLoader
import com.anytorah.api.SefariaTextClient
import com.anytorah.models.Bookmark
import com.anytorah.models.BookmarkManager
import com.anytorah.models.CommentaryEntry
import com.anytorah.models.CommentaryType
import com.anytorah.models.MidrashNavigationMode
import com.anytorah.models.MidrashSubcategory
import com.anytorah.models.MidrashWork
import com.anytorah.models.MishnahSubcategory
import com.anytorah.models.torahVerseCount
import com.anytorah.models.MishnahTractate
import com.anytorah.models.SASimanNames
import com.anytorah.models.TalmudSubcategory
import com.anytorah.models.TextCatalog
import com.anytorah.models.TextCategory
import com.anytorah.models.TextDisplayMode
import com.anytorah.models.TextSegment
import com.anytorah.models.rambamIntroductions
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

class TextReaderViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("anytorah_prefs", android.content.Context.MODE_PRIVATE)
    val bookmarkManager = BookmarkManager(application)

    // MARK: - Dedication

    private val _dedication = MutableStateFlow<Dedication?>(null)
    val dedication: StateFlow<Dedication?> = _dedication.asStateFlow()

    fun checkDedication() {
        viewModelScope.launch {
            val today = LocalDate.now().toString()
            val lastShown = prefs.getString("lastDedicationDateShown", "") ?: ""
            if (today == lastShown) return@launch
            val ded = DedicationService.fetch()
            if (ded != null) {
                prefs.edit().putString("lastDedicationDateShown", today).apply()
                _dedication.value = ded
            }
        }
    }

    fun dismissDedication() {
        _dedication.value = null
    }

    init {
        SefariaTextClient.init(application.cacheDir)
    }

    // MARK: - Settings

    var useWhiteBackground by mutableStateOf(prefs.getBoolean("useWhiteBackground", false))
        private set

    fun updateBackground(value: Boolean) {
        useWhiteBackground = value
        prefs.edit().putBoolean("useWhiteBackground", value).apply()
    }

    /** true = Hebrew RTL (section on right, Hebrew numerals); false = English LTR */
    var saHebrewMode by mutableStateOf(prefs.getBoolean("saHebrewMode", false))
        private set

    fun updateSaHebrewMode(value: Boolean) {
        saHebrewMode = value
        prefs.edit().putBoolean("saHebrewMode", value).apply()
    }

    /** Font size level: −2 … +2, each step = ±2 sp from the base size. Default 0. */
    var fontSizeLevel by mutableStateOf(prefs.getInt("anyTorahFontSize", 0))
        private set

    fun updateFontSizeLevel(level: Int) {
        fontSizeLevel = level.coerceIn(-2, 2)
        prefs.edit().putInt("anyTorahFontSize", fontSizeLevel).apply()
    }

    /** When true, cantillation marks (trop, U+0591–U+05AF) are shown in Hebrew Tanakh text. */
    var showTrop by mutableStateOf(prefs.getBoolean("showTrop", false))
        private set

    fun updateShowTrop(value: Boolean) {
        showTrop = value
        prefs.edit().putBoolean("showTrop", value).apply()
    }

    /** When true (dark mode only), commentary panel uses a light background with blue text. */
    var sidePanelContrast by mutableStateOf(prefs.getBoolean("sidePanelContrast", false))
        private set

    fun updateSidePanelContrast(value: Boolean) {
        sidePanelContrast = value
        prefs.edit().putBoolean("sidePanelContrast", value).apply()
    }

    /** When true, Rashi/Rashi-on-Talmud commentary renders in Noto Rashi Hebrew script. Default off. */
    var useRashiFont by mutableStateOf(prefs.getBoolean("useRashiFont", false))
        private set

    fun updateUseRashiFont(value: Boolean) {
        useRashiFont = value
        prefs.edit().putBoolean("useRashiFont", value).apply()
    }

    // MARK: - Home screen — last selected category persistence

    var lastSelectedCategory: TextCategory?
        get() = prefs.getString("lastSelectedCategory", null)
            ?.let { raw -> TextCategory.values().find { it.name == raw } }
        set(value) {
            if (value == null) prefs.edit().remove("lastSelectedCategory").apply()
            else prefs.edit().putString("lastSelectedCategory", value.name).apply()
        }

    // MARK: - Selection state

    var category by mutableStateOf(TextCategory.TALMUD)

    // Tanakh
    var tanakhBookIndex by mutableIntStateOf(0)
    var tanakhChapter by mutableIntStateOf(1)
    var tanakhScrollToVerse by mutableStateOf<Int?>(null)

    // Mishnah
    var mishnahSubcategory by mutableStateOf(MishnahSubcategory.MISHNAH)
    var mishnahSederIndex by mutableIntStateOf(0)
    var mishnahTractateIndexInSeder by mutableIntStateOf(0)
    var mishnahChapter by mutableIntStateOf(1)
    var toseftaChapter by mutableIntStateOf(1)

    // Talmud
    var talmudSubcategory by mutableStateOf(TalmudSubcategory.BAVLI)
    var talmudSederIndex by mutableIntStateOf(0)
    var talmudTractateIndexInSeder by mutableIntStateOf(0)
    private val _talmudDaf = mutableIntStateOf(2)
    var talmudDaf: Int
        get() = _talmudDaf.intValue
        set(v) { _talmudDaf.intValue = v; talmudAmud = 0 }

    // Yerushalmi (uses Mishnah seder structure)
    var yerushalmiSederIndex by mutableIntStateOf(0)
    var yerushalmiTractateIndexInSeder by mutableIntStateOf(0)
    var yerushalmiChapter by mutableIntStateOf(1)
    private val _yerushalmiHalakha = mutableIntStateOf(prefs.getInt("sel_yerushalmi_halakha", 1))
    var yerushalmiHalakha: Int
        get() = _yerushalmiHalakha.intValue
        set(v) { _yerushalmiHalakha.intValue = v; prefs.edit().putInt("sel_yerushalmi_halakha", v).apply() }
    /** Actual number of halakhot in the currently-selected chapter; updated by fetchYerushalmiShape. */
    var yerushalmiHalakhaCount by mutableIntStateOf(7)

    // Talmud amud
    private val _talmudAmud = mutableIntStateOf(prefs.getInt("sel_talmud_amud", 0))
    var talmudAmud: Int
        get() = _talmudAmud.intValue
        set(v) { _talmudAmud.intValue = v; prefs.edit().putInt("sel_talmud_amud", v).apply() }
    var talmudScrollToAmudB: Boolean by mutableStateOf(false)
    var commentaryScrollToAmudB: Boolean by mutableStateOf(false)
    var commentaryScrollToAmudA: Boolean by mutableStateOf(false)

    // Rambam (rambamChapter 0 = introduction, 1…N = regular chapters)
    var rambamSeferIndex by mutableIntStateOf(0)
    var rambamWorkIndexInSefer by mutableIntStateOf(0)
    var rambamChapter by mutableIntStateOf(1)

    val rambamHasIntro: Boolean get() = currentRambamWork?.let { rambamIntroductions.containsKey(it.id) } ?: false

    // Shulchan Arukh
    var saSection by mutableIntStateOf(0)
    var saSiman by mutableIntStateOf(1)

    // Midrash
    var midrashSubcategory by mutableStateOf(MidrashSubcategory.HALAKHA)
    var midrashWork by mutableStateOf(MidrashWork.MEKHILTA_YISHMAEL)
    var midrashBookIndex by mutableIntStateOf(1)
    var midrashChapter by mutableIntStateOf(1)
    var midrashVerse by mutableIntStateOf(1)
    var midrashNavigationMode by mutableStateOf(MidrashNavigationMode.BY_VERSE)
    var midrashNativeChapter by mutableIntStateOf(1)
    var midrashNativeSection by mutableIntStateOf(1)
    var midrashScrollToIndex by mutableStateOf<Int?>(null)

    // MARK: - Display state

    private fun loadDisplayMode(): TextDisplayMode {
        val raw = prefs.getString("anyTorahDisplayMode", null) ?: return TextDisplayMode.SOURCE
        return TextDisplayMode.values().find { it.raw == raw } ?: TextDisplayMode.SOURCE
    }

    var displayMode by mutableStateOf(loadDisplayMode())
        private set

    fun updateDisplayMode(mode: TextDisplayMode) {
        displayMode = mode
        prefs.edit().putString("anyTorahDisplayMode", mode.raw).apply()
    }

    var segments by mutableStateOf<List<TextSegment>>(emptyList())
    var isLoading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var currentRef by mutableStateOf("")

    // Commentary
    var commentaryVisible by mutableStateOf(prefs.getBoolean("commentaryVisible", false))
    var selectedCommentary by mutableStateOf(CommentaryType.RASHI_TALMUD)
    var commentaryEntries by mutableStateOf<List<CommentaryEntry>>(emptyList())
    var commentaryLoadVersion by mutableStateOf(0)
    var isLoadingCommentary by mutableStateOf(false)
    var commentaryError by mutableStateOf<String?>(null)

    // Commentary slot configuration (persisted per context)
    private val commentarySlots = mutableMapOf<String, List<CommentaryType>>()

    companion object {
        val defaultSlots = mapOf(
            "torah"   to listOf(CommentaryType.ONKELOS, CommentaryType.RASHI_TANAKH, CommentaryType.RAMBAN),
            "neviim"  to listOf(CommentaryType.TARGUM_YONATAN, CommentaryType.RASHI_TANAKH, CommentaryType.METZUDAT_DAVID),
            "ketuvim" to listOf(CommentaryType.TARGUM_KETUVIM, CommentaryType.RASHI_TANAKH, CommentaryType.METZUDAT_DAVID),
            "mishnah"    to listOf(CommentaryType.RAMBAM_MISHNAH, CommentaryType.BARTENURA, CommentaryType.TOSAFOT_YOM_TOV),
            "tosefta"    to listOf(CommentaryType.TOSEFTA_KIFSHUTAH, CommentaryType.BRIEF_COMMENTARY),
            "talmud"     to listOf(CommentaryType.RASHI_TALMUD, CommentaryType.TOSAFOT, CommentaryType.CHIDDUSHEI_RAMBAN),
            "yerushalmi" to listOf(CommentaryType.PENEI_MOSHE, CommentaryType.MAREY_HA_PANIM, CommentaryType.OHR_LAYESHARIM),
            "rambam"  to listOf(CommentaryType.MAGGID_MISHNAH, CommentaryType.KESEF_MISHNAH, CommentaryType.LECHEM_MISHNEH),
            "sa_0"    to listOf(CommentaryType.MISHNAH_BERURAH, CommentaryType.BIUR_HALAKHA, CommentaryType.MAGEN_AVRAHAM),
            "sa_1"    to listOf(CommentaryType.TAZ, CommentaryType.SHAKH, CommentaryType.NEKUDAT_HA_KESEF),
            "sa_2"    to listOf(CommentaryType.CHELKAT_MECHOKEK, CommentaryType.BEIT_SHMUEL, CommentaryType.TAZ),
            "sa_3"    to listOf(CommentaryType.MEIRAT_EINAYIM, CommentaryType.SHAKH, CommentaryType.KTZOT_HA_CHOSHEN),
        )
    }

    init {
        // Load persisted commentary slots.
        // New format: comma-separated String (order-preserving).
        // Old format: StringSet (unordered, broken) — ignored on migration.
        for ((key, defaults) in defaultSlots) {
            val csv = prefs.getString("commentarySlots_$key", null)
            if (csv != null) {
                val loaded = csv.split(",").mapNotNull { CommentaryType.fromId(it) }
                if (loaded.size == defaults.size) {
                    commentarySlots[key] = loaded
                }
            }
        }
    }

    val contextKey: String get() = when (category) {
        TextCategory.TANAKH -> when {
            tanakhBookIndex <= 4  -> "torah"
            tanakhBookIndex <= 25 -> "neviim"
            else -> "ketuvim"
        }
        TextCategory.MISHNAH -> if (mishnahSubcategory == MishnahSubcategory.TOSEFTA) "tosefta" else "mishnah"
        TextCategory.TALMUD -> if (talmudSubcategory == TalmudSubcategory.YERUSHALMI) "yerushalmi" else "talmud"
        TextCategory.RAMBAM -> "rambam"
        TextCategory.SHULCHAN_ARUKH -> "sa_$saSection"
        TextCategory.MIDRASH -> "midrash"
    }

    val availableCommentaries: List<CommentaryType> get() =
        commentarySlots[contextKey] ?: defaultSlots[contextKey] ?: emptyList()

    val commentaryPool: List<CommentaryType> get() = commentaryPoolGrouped.flatten()

    /** Pool divided into display groups; Talmud has 3, all others have 1. */
    val commentaryPoolGrouped: List<List<CommentaryType>> get() = when (category) {
        TextCategory.TALMUD ->
            if (talmudSubcategory == TalmudSubcategory.YERUSHALMI)
                listOf(CommentaryType.yerushalmiPool.filter { it.isAvailableForYerushalmi(currentYerushalmiTractate?.id ?: 0) })
            else
                CommentaryType.talmudGrouped.map { group ->
                    group.filter { it.isAvailableForTalmud(globalTalmudTractateIndex) }
                }.filter { it.isNotEmpty() }
        TextCategory.MISHNAH ->
            if (mishnahSubcategory == MishnahSubcategory.TOSEFTA) {
                val tractateId = currentMishnahTractate?.id ?: 0
                listOf(CommentaryType.toseftaPool.filter { it.isAvailableForTosefta(tractateId) })
            } else listOf(CommentaryType.mishnahPool.filter {
                it.isAvailableForMishnah(mishnahSederIndex, globalMishnahTractateIndex)
            })
        TextCategory.TANAKH -> {
            val base = when {
                tanakhBookIndex <= 4  -> CommentaryType.torahPool
                tanakhBookIndex <= 25 -> CommentaryType.neviimPool
                else                  -> CommentaryType.ketuvimPool
            }
            listOf(base.filter { it.isAvailable(tanakhBookIndex) })
        }
        TextCategory.RAMBAM -> {
            val workId = currentRambamWork?.id ?: 0
            CommentaryType.rambamGrouped.map { group ->
                group.filter { it.isAvailableForRambam(workId) }
            }.filter { it.isNotEmpty() }
        }
        TextCategory.SHULCHAN_ARUKH -> listOf(CommentaryType.saPool(saSection))
        TextCategory.MIDRASH -> listOf(emptyList())
    }

    /** Section labels parallel to [commentaryPoolGrouped]; null means no header for that group. */
    val commentaryPoolGroupLabels: List<String?> get() = when (category) {
        TextCategory.TALMUD -> {
            val tractateId = globalTalmudTractateIndex
            val staticLabels = listOf(
                "Rishonim — Rashi-style",
                "Rishonim — Chiddushim",
                "Rishonim — Tosafots",
                "Acharonim - On the daf",
                "Acharonim — Chiddushim"
            )
            CommentaryType.talmudGrouped.zip(staticLabels).mapNotNull { (group, label) ->
                if (group.none { it.isAvailableForTalmud(tractateId) }) null else label
            }
        }
        TextCategory.RAMBAM -> {
            val workId = currentRambamWork?.id ?: 0
            val staticLabels = listOf("Classic Commentaries", "Later Acharonim")
            CommentaryType.rambamGrouped.zip(staticLabels).mapNotNull { (group, label) ->
                if (group.none { it.isAvailableForRambam(workId) }) null else label
            }
        }
        else -> List(commentaryPoolGrouped.size) { null }
    }

    val hasExpandedCommentaryPool: Boolean get() = commentaryPool.size > availableCommentaries.size

    fun isCommentaryAvailable(type: CommentaryType): Boolean = when (category) {
        TextCategory.TANAKH      -> type.isAvailable(tanakhBookIndex)
        TextCategory.MISHNAH     -> if (mishnahSubcategory == MishnahSubcategory.TOSEFTA)
                                        type.isAvailableForTosefta(currentMishnahTractate?.id ?: 0)
                                    else type.isAvailableForMishnah(mishnahSederIndex, globalMishnahTractateIndex)
        TextCategory.TALMUD      -> if (talmudSubcategory == TalmudSubcategory.YERUSHALMI)
                                        type.isAvailableForYerushalmi(currentYerushalmiTractate?.id ?: 0)
                                    else type.isAvailableForTalmud(globalTalmudTractateIndex)
        TextCategory.RAMBAM      -> type.isAvailableForRambam(currentRambamWork?.id ?: 0)
        TextCategory.SHULCHAN_ARUKH -> true
        TextCategory.MIDRASH -> false
    }

    private val fallbackCommentaries: List<CommentaryType> get() = when (category) {
        TextCategory.TANAKH -> when {
            tanakhBookIndex <= 4  -> listOf(CommentaryType.ONKELOS, CommentaryType.RASHI_TANAKH, CommentaryType.RAMBAN)
            tanakhBookIndex <= 25 -> listOf(CommentaryType.TARGUM_YONATAN, CommentaryType.RASHI_TANAKH, CommentaryType.METZUDAT_DAVID)
            else                  -> listOf(CommentaryType.TARGUM_KETUVIM, CommentaryType.RASHI_TANAKH, CommentaryType.METZUDAT_DAVID)
        }
        TextCategory.MISHNAH -> if (mishnahSubcategory == MishnahSubcategory.TOSEFTA)
                                    CommentaryType.toseftaPool.filter { it.isAvailableForTosefta(currentMishnahTractate?.id ?: 0) }
                                else listOf(CommentaryType.RAMBAM_MISHNAH, CommentaryType.BARTENURA, CommentaryType.TOSAFOT_YOM_TOV)
        TextCategory.TALMUD -> if (talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
                                    val tractateId = currentYerushalmiTractate?.id ?: 0
                                    CommentaryType.yerushalmiPool.filter { it.isAvailableForYerushalmi(tractateId) }
                                }
                               else listOf(CommentaryType.RASHI_TALMUD, CommentaryType.TOSAFOT, CommentaryType.CHIDDUSHEI_RAMBAN, CommentaryType.RASHBA, CommentaryType.RITVA, CommentaryType.MEIRI)
        TextCategory.RAMBAM         -> listOf(CommentaryType.MAGGID_MISHNAH, CommentaryType.KESEF_MISHNAH, CommentaryType.LECHEM_MISHNEH,
                                              CommentaryType.MISHNEH_LA_MELECH, CommentaryType.KIRYAT_SEFER, CommentaryType.MAASEH_ROKEACH, CommentaryType.OR_SAMEACH)
        TextCategory.SHULCHAN_ARUKH -> availableCommentaries
        TextCategory.MIDRASH -> emptyList()
    }

    val effectiveCommentaries: List<CommentaryType> get() {
        val slots = availableCommentaries
        val fallbacks = fallbackCommentaries
        val effective = mutableListOf<CommentaryType>()
        for (cType in slots) {
            if (isCommentaryAvailable(cType)) {
                effective.add(cType)
            } else {
                val used = effective.toSet()
                val sub = fallbacks.firstOrNull { isCommentaryAvailable(it) && it !in used }
                effective.add(sub ?: cType)
            }
        }
        return effective
    }

    fun replaceSlot(slotIndex: Int, type: CommentaryType) {
        val slots = availableCommentaries.toMutableList()
        if (slotIndex >= slots.size) return
        slots[slotIndex] = type
        commentarySlots[contextKey] = slots
        // Persist as comma-separated string to preserve slot order (StringSet is unordered)
        prefs.edit().putString("commentarySlots_$contextKey", slots.joinToString(",") { it.id }).apply()
        selectedCommentary = type
        viewModelScope.launch {
            if (category == TextCategory.SHULCHAN_ARUKH) {
                // SA inline text markers depend on slot positions — reload the full text
                // so markers are reprocessed with the new slot assignments.
                load()
            } else {
                loadCommentary()
            }
        }
    }

    fun updateCommentaryVisible(visible: Boolean) {
        commentaryVisible = visible
        prefs.edit().putBoolean("commentaryVisible", visible).apply()
    }

    // MARK: - Per-category selection persistence

    /** Restores the last-used picker state for [cat], falling back to first-run defaults. */
    fun restoreState(cat: TextCategory) {
        when (cat) {
            TextCategory.TANAKH -> {
                tanakhBookIndex = prefs.getInt("sel_tanakh_book", 0)
                tanakhChapter   = prefs.getInt("sel_tanakh_chapter", 1)
            }
            TextCategory.MISHNAH -> {
                mishnahSubcategory          = MishnahSubcategory.fromId(prefs.getString("sel_mishnah_subcategory", null))
                mishnahSederIndex           = prefs.getInt("sel_mishnah_seder", 0)
                mishnahTractateIndexInSeder = prefs.getInt("sel_mishnah_tractate", 0)
                mishnahChapter              = prefs.getInt("sel_mishnah_chapter", 1)
                toseftaChapter              = prefs.getInt("sel_tosefta_chapter", 1)
            }
            TextCategory.TALMUD -> {
                talmudSubcategory              = TalmudSubcategory.fromId(prefs.getString("sel_talmud_subcategory", null))
                talmudSederIndex               = prefs.getInt("sel_talmud_seder", 0)
                talmudTractateIndexInSeder     = prefs.getInt("sel_talmud_tractate", 0)
                talmudDaf                      = prefs.getInt("sel_talmud_daf", 2)
                yerushalmiSederIndex           = prefs.getInt("sel_yerushalmi_seder", 0)
                yerushalmiTractateIndexInSeder = prefs.getInt("sel_yerushalmi_tractate", 0)
                yerushalmiChapter              = prefs.getInt("sel_yerushalmi_chapter", 1)
                yerushalmiHalakha              = prefs.getInt("sel_yerushalmi_halakha", 1)
                talmudAmud                     = prefs.getInt("sel_talmud_amud", 0)
            }
            TextCategory.RAMBAM -> {
                rambamSeferIndex       = prefs.getInt("sel_rambam_sefer", 0)
                rambamWorkIndexInSefer = prefs.getInt("sel_rambam_work", 0)
                rambamChapter          = prefs.getInt("sel_rambam_ch", 1)
            }
            TextCategory.SHULCHAN_ARUKH -> {
                saSection = prefs.getInt("sel_sa_section", 0)
                saSiman   = prefs.getInt("sel_sa_siman", 1)
            }
            TextCategory.MIDRASH -> {
                midrashSubcategory    = MidrashSubcategory.fromId(prefs.getString("sel_midrash_sub", null))
                midrashWork           = MidrashWork.fromId(prefs.getString("sel_midrash_work", null))
                midrashBookIndex      = prefs.getInt("sel_midrash_book", 1)
                midrashChapter        = prefs.getInt("sel_midrash_chapter", 1)
                midrashVerse          = prefs.getInt("sel_midrash_verse", 1)
                midrashNavigationMode = MidrashNavigationMode.fromId(prefs.getString("sel_midrash_navmode", null))
                midrashNativeChapter  = prefs.getInt("sel_midrash_native_ch", 1)
                midrashNativeSection  = prefs.getInt("sel_midrash_native_sec", 1)
            }
        }
    }

    private fun saveState(cat: TextCategory) {
        val e = prefs.edit()
        when (cat) {
            TextCategory.TANAKH -> {
                e.putInt("sel_tanakh_book", tanakhBookIndex)
                e.putInt("sel_tanakh_chapter", tanakhChapter)
            }
            TextCategory.MISHNAH -> {
                e.putString("sel_mishnah_subcategory", mishnahSubcategory.id)
                e.putInt("sel_mishnah_seder", mishnahSederIndex)
                e.putInt("sel_mishnah_tractate", mishnahTractateIndexInSeder)
                e.putInt("sel_mishnah_chapter", mishnahChapter)
                e.putInt("sel_tosefta_chapter", toseftaChapter)
            }
            TextCategory.TALMUD -> {
                e.putString("sel_talmud_subcategory", talmudSubcategory.id)
                e.putInt("sel_talmud_seder", talmudSederIndex)
                e.putInt("sel_talmud_tractate", talmudTractateIndexInSeder)
                e.putInt("sel_talmud_daf", talmudDaf)
                e.putInt("sel_yerushalmi_seder", yerushalmiSederIndex)
                e.putInt("sel_yerushalmi_tractate", yerushalmiTractateIndexInSeder)
                e.putInt("sel_yerushalmi_chapter", yerushalmiChapter)
                e.putInt("sel_yerushalmi_halakha", yerushalmiHalakha)
                e.putInt("sel_talmud_amud", talmudAmud)
            }
            TextCategory.RAMBAM -> {
                e.putInt("sel_rambam_sefer", rambamSeferIndex)
                e.putInt("sel_rambam_work", rambamWorkIndexInSefer)
                e.putInt("sel_rambam_ch", rambamChapter)
            }
            TextCategory.SHULCHAN_ARUKH -> {
                e.putInt("sel_sa_section", saSection)
                e.putInt("sel_sa_siman", saSiman)
            }
            TextCategory.MIDRASH -> {
                e.putString("sel_midrash_sub", midrashSubcategory.id)
                e.putString("sel_midrash_work", midrashWork.id)
                e.putInt("sel_midrash_book", midrashBookIndex)
                e.putInt("sel_midrash_chapter", midrashChapter)
                e.putInt("sel_midrash_verse", midrashVerse)
                e.putString("sel_midrash_navmode", midrashNavigationMode.id)
                e.putInt("sel_midrash_native_ch", midrashNativeChapter)
                e.putInt("sel_midrash_native_sec", midrashNativeSection)
            }
        }
        e.apply()
    }

    // MARK: - Computed helpers

    val currentTanakhBook get() = TextCatalog.allTanakhBooks.getOrNull(tanakhBookIndex)

    val mishnahTractateCandidates get() = TextCatalog.mishnahSedarim.getOrNull(mishnahSederIndex)?.tractates ?: emptyList()
    val currentMishnahTractate get() = mishnahTractateCandidates.getOrNull(mishnahTractateIndexInSeder)
    val globalMishnahTractateIndex get() = currentMishnahTractate?.id ?: 0

    val talmudTractateCandidates get() = TextCatalog.talmudSedarim.getOrNull(talmudSederIndex)?.tractates ?: emptyList()
    val currentTalmudTractate get() = talmudTractateCandidates.getOrNull(talmudTractateIndexInSeder)
    val globalTalmudTractateIndex get() = currentTalmudTractate?.id ?: 0

    // Yerushalmi — Mishnah seder structure filtered to tractates with Yerushalmi content
    val yerushalmiSedarim get() = TextCatalog.mishnahSedarim.filter { seder -> seder.tractates.any { it.yerushalmiChapters > 0 } }
    val yerushalmiTractateCandidates get() = yerushalmiSedarim.getOrNull(yerushalmiSederIndex)?.tractates?.filter { it.yerushalmiChapters > 0 } ?: emptyList()
    val currentYerushalmiTractate get() = yerushalmiTractateCandidates.getOrNull(yerushalmiTractateIndexInSeder)

    val allYerushalmiTractates: List<MishnahTractate>
        get() = TextCatalog.allMishnahTractates.filter { it.yerushalmiChapters > 0 }

    val yerushalmiGlobalTractateIndex: Int
        get() {
            val t = currentYerushalmiTractate ?: return 0
            return allYerushalmiTractates.indexOfFirst { it.id == t.id }.coerceAtLeast(0)
        }

    fun setYerushalmiGlobalTractate(globalIdx: Int) {
        val all = allYerushalmiTractates
        if (globalIdx >= all.size) return
        val tractate = all[globalIdx]
        for ((si, seder) in yerushalmiSedarim.withIndex()) {
            val candidates = seder.tractates.filter { it.yerushalmiChapters > 0 }
            val ti = candidates.indexOfFirst { it.id == tractate.id }
            if (ti >= 0) {
                yerushalmiSederIndex = si
                yerushalmiTractateIndexInSeder = ti
                yerushalmiChapter = 1
                yerushalmiHalakha = 1
                break
            }
        }
    }

    val rambamWorkCandidates get() = TextCatalog.rambamSefarim.getOrNull(rambamSeferIndex)?.works ?: emptyList()
    val currentRambamWork get() = rambamWorkCandidates.getOrNull(rambamWorkIndexInSefer)

    // MARK: - Display title

    val displayTitle: String get() = when (category) {
        TextCategory.TANAKH -> {
            val book = currentTanakhBook?.name ?: ""
            "$book, ch. $tanakhChapter"
        }
        TextCategory.MISHNAH -> {
            val t = currentMishnahTractate?.name ?: ""
            if (mishnahSubcategory == MishnahSubcategory.TOSEFTA) "Tosefta $t, ch. $toseftaChapter"
            else "$t, ch. $mishnahChapter"
        }
        TextCategory.TALMUD -> {
            if (talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
                val t = currentYerushalmiTractate?.name ?: ""
                val halakhaStr = if (yerushalmiHalakha > 1) ":$yerushalmiHalakha" else ""
                "Yerushalmi $t $yerushalmiChapter$halakhaStr"
            } else {
                val t = currentTalmudTractate?.name ?: ""
                "$t $talmudDaf${if (talmudAmud == 0) "a" else "b"}"
            }
        }
        TextCategory.RAMBAM -> {
            val w = currentRambamWork?.name ?: ""
            if (rambamChapter == 0) "$w, Intro" else "$w, ch. $rambamChapter"
        }
        TextCategory.SHULCHAN_ARUKH -> {
            val s = TextCatalog.shulchanArukhSections.getOrNull(saSection)?.name ?: ""
            "$s, §$saSiman"
        }
        TextCategory.MIDRASH -> {
            if (midrashNavigationMode == MidrashNavigationMode.NATIVE) {
                val labels = midrashWork.nativeChapterLabels
                val chapLabel = if (midrashNativeChapter <= labels.size) labels[midrashNativeChapter - 1] else "$midrashNativeChapter"
                if (midrashWork.nativeIsOneLevel) "${midrashWork.displayName}, $chapLabel"
                else "${midrashWork.displayName}, $chapLabel:$midrashNativeSection"
            } else {
                val book = TextCatalog.allTanakhBooks.getOrNull(midrashBookIndex)?.name ?: ""
                "${midrashWork.displayName}, $book $midrashChapter:$midrashVerse"
            }
        }
    }

    /** Short title for the "book" navigation pill in the reader header. */
    val navBookTitle: String get() = when (category) {
        TextCategory.TANAKH -> {
            val b = currentTanakhBook
            if (b == null) "–" else if (saHebrewMode) b.hebrewName.strippingNikud() else b.name
        }
        TextCategory.MISHNAH -> {
            val t = currentMishnahTractate
            if (t == null) "–" else if (saHebrewMode) t.hebrewName.strippingNikud() else t.name
        }
        TextCategory.TALMUD -> {
            if (talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
                val t = currentYerushalmiTractate
                if (t == null) "–" else if (saHebrewMode) t.hebrewName.strippingNikud() else t.name
            } else {
                val t = currentTalmudTractate
                if (t == null) "–" else if (saHebrewMode) t.hebrewName.strippingNikud() else t.name
            }
        }
        TextCategory.RAMBAM -> {
            val w = currentRambamWork
            if (w == null) "–" else if (saHebrewMode) w.hebrewName.strippingNikud() else w.name
        }
        TextCategory.SHULCHAN_ARUKH -> {
            val s = TextCatalog.shulchanArukhSections.getOrNull(saSection)
            if (s == null) "–" else if (saHebrewMode) s.hebrewName.strippingNikud() else s.name
        }
        TextCategory.MIDRASH -> if (saHebrewMode) midrashWork.hebrewName else midrashWork.displayName
    }

    /** Short title for the "chapter" navigation pill in the reader header. */
    val navChapterTitle: String get() = when (category) {
        TextCategory.TANAKH         -> if (saHebrewMode) "פרק ${SASimanNames.toHebrewNumeral(tanakhChapter)}" else "ch. $tanakhChapter"
        TextCategory.MISHNAH -> {
            val ch = if (mishnahSubcategory == MishnahSubcategory.TOSEFTA) toseftaChapter else mishnahChapter
            if (saHebrewMode) "פרק ${SASimanNames.toHebrewNumeral(ch)}" else "ch. $ch"
        }
        TextCategory.TALMUD -> {
            if (talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
                val halakhaStr = if (yerushalmiHalakha > 1) ":$yerushalmiHalakha" else ""
                if (saHebrewMode) "פרק ${SASimanNames.toHebrewNumeral(yerushalmiChapter)}$halakhaStr" else "$yerushalmiChapter$halakhaStr"
            } else {
                if (saHebrewMode) SASimanNames.toHebrewNumeral(talmudDaf) else "$talmudDaf"
            }
        }
        TextCategory.RAMBAM         -> when {
            rambamChapter == 0 -> if (saHebrewMode) "הקדמה" else "Intro"
            else -> if (saHebrewMode) "פרק ${SASimanNames.toHebrewNumeral(rambamChapter)}" else "ch. $rambamChapter"
        }
        TextCategory.SHULCHAN_ARUKH -> if (saHebrewMode) "סי׳ ${SASimanNames.toHebrewNumeral(saSiman)}" else "§$saSiman"
        TextCategory.MIDRASH -> {
            if (midrashNavigationMode == MidrashNavigationMode.NATIVE) {
                val labels = midrashWork.nativeChapterLabels
                val chapLabel = if (midrashNativeChapter <= labels.size) labels[midrashNativeChapter - 1] else "$midrashNativeChapter"
                if (midrashWork.nativeIsOneLevel) chapLabel else "$chapLabel:$midrashNativeSection"
            } else {
                val book = TextCatalog.allTanakhBooks.getOrNull(midrashBookIndex)?.name ?: ""
                "$book $midrashChapter:$midrashVerse"
            }
        }
    }

    // MARK: - Load

    fun load() {
        viewModelScope.launch {
            isLoading = true
            error = null
            segments = emptyList()

            try {
                when (category) {
                    TextCategory.TANAKH -> {
                        val r = SefariaTextClient.ref(TextCategory.TANAKH, tanakhBookIndex, tanakhChapter)
                        currentRef = r
                        segments = SefariaTextClient.fetchChapter(TextCategory.TANAKH, tanakhBookIndex, tanakhChapter)
                    }
                    TextCategory.MISHNAH -> {
                        if (mishnahSubcategory == MishnahSubcategory.TOSEFTA) {
                            val tractate = currentMishnahTractate
                            if (tractate == null || tractate.toseftaChapters == 0) {
                                error = "No Tosefta available for this tractate"
                                isLoading = false
                                return@launch
                            }
                            val r = "Tosefta ${tractate.name} $toseftaChapter"
                            currentRef = r
                            segments = SefariaTextClient.fetchTosefta(tractate, toseftaChapter)
                        } else {
                            val r = SefariaTextClient.ref(TextCategory.MISHNAH, globalMishnahTractateIndex, mishnahChapter)
                            currentRef = r
                            segments = SefariaTextClient.fetchChapter(TextCategory.MISHNAH, globalMishnahTractateIndex, mishnahChapter)
                        }
                    }
                    TextCategory.TALMUD -> {
                        if (talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
                            val tractate = currentYerushalmiTractate
                            if (tractate == null) {
                                error = "No tractate selected"
                                isLoading = false
                                return@launch
                            }
                            val r = "Jerusalem Talmud ${tractate.name} $yerushalmiChapter:$yerushalmiHalakha"
                            currentRef = r
                            // Pass halakha so the API returns only that halakha's segments — no scroll needed
                            segments = SefariaTextClient.fetchYerushalmi(tractate, yerushalmiChapter, yerushalmiHalakha)
                        } else {
                            val tractate = currentTalmudTractate
                            if (tractate == null) {
                                error = "No tractate selected"
                                isLoading = false
                                return@launch
                            }
                            currentRef = "${tractate.sefariaName} $talmudDaf"
                            segments = SefariaTextClient.fetchFullDaf(globalTalmudTractateIndex, talmudDaf)
                            if (talmudAmud == 1) { talmudScrollToAmudB = true }
                        }
                    }
                    TextCategory.RAMBAM -> {
                        val work = currentRambamWork ?: run {
                            isLoading = false
                            return@launch
                        }
                        if (rambamChapter == 0) {
                            // Introduction chapter — use bundled Chabad content, no Sefaria fetch.
                            currentRef = ""
                            val intro = rambamIntroductions[work.id]
                            segments = if (intro != null && (intro.he.isNotEmpty() || intro.en.isNotEmpty())) {
                                listOf(TextSegment.content(index = 0, he = intro.he, en = intro.en, label = null))
                            } else {
                                emptyList()
                            }
                        } else {
                            val r = SefariaTextClient.ref(TextCategory.RAMBAM, work.id, rambamChapter)
                            currentRef = r
                            val rambamSegs = SefariaTextClient.fetchChapter(TextCategory.RAMBAM, work.id, rambamChapter)
                            val (heRaavad, enRaavad) = SefariaTextClient.fetchRaavad(r, rambamSegs.size)
                            segments = SefariaTextClient.applyRaavad(heRaavad, enRaavad, rambamSegs)
                        }
                    }
                    TextCategory.SHULCHAN_ARUKH -> {
                        val r = SefariaTextClient.ref(TextCategory.SHULCHAN_ARUKH, saSection, saSiman)
                        currentRef = r
                        segments = SefariaTextClient.fetchChapter(TextCategory.SHULCHAN_ARUKH, saSection, saSiman,
                            selectedCommentaries = availableCommentaries)
                    }
                    TextCategory.MIDRASH -> {
                        midrashScrollToIndex = null
                        if (midrashNavigationMode == MidrashNavigationMode.NATIVE) {
                            val ref = midrashWork.nativeRef(midrashNativeChapter, midrashNativeSection)
                            currentRef = ref
                            val (he, en) = SefariaTextClient.fetchBoth(ref)
                            val count = maxOf(he.size, en.size)
                            segments = (0 until count).mapNotNull { i ->
                                val seg = TextSegment.content(index = i, he = if (i < he.size) he[i] else "", en = if (i < en.size) en[i] else "")
                                if (seg.hebrewHTML.isEmpty() && seg.englishHTML.isEmpty()) null else seg
                            }
                        } else {
                            val book = TextCatalog.allTanakhBooks.getOrNull(midrashBookIndex)
                            if (book == null) {
                                error = "No book selected"
                                isLoading = false
                                return@launch
                            }
                            val r = "${book.sefariaName} $midrashChapter:$midrashVerse"
                            currentRef = r
                            val (segs, scrollIdx) = SefariaTextClient.fetchMidrashByVerse(midrashWork, book.sefariaName, midrashChapter, midrashVerse)
                            segments = segs
                            midrashScrollToIndex = scrollIdx + 1  // 1-based for scrollToVerse compat
                        }
                    }
                }
            } catch (e: Exception) {
                error = e.localizedMessage ?: "Unknown error"
            }

            isLoading = false

            // Persist current selection so picker reopens here next time
            saveState(category)

            // Snap selected commentary to first effective for current context
            if (!effectiveCommentaries.contains(selectedCommentary)) {
                selectedCommentary = effectiveCommentaries.firstOrNull() ?: selectedCommentary
            }

            if (commentaryVisible) {
                loadCommentary()
            }
        }
    }

    fun loadCommentaryAsync() {
        viewModelScope.launch { loadCommentary() }
    }

    suspend fun loadCommentary() {
        if (currentRef.isEmpty() || availableCommentaries.isEmpty()) {
            commentaryEntries = emptyList()
            return
        }
        isLoadingCommentary = true
        commentaryError = null
        commentaryEntries = emptyList()

        // Depth-3 ref adjustment — Sefaria stores some commentaries at verse level
        // rather than chapter level (textDepth=3: Chapter → Verse → Comment).
        // Requesting a bare chapter ref returns empty for these; a verse-range ref works.
        val commentaryRef = when {
            // All Rambam commentaries on Sefaria are depth-3 (Chapter → Halakha → Comment).
            category == TextCategory.RAMBAM &&
            segments.isNotEmpty() -> "$currentRef:1-${segments.size}"

            category == TextCategory.SHULCHAN_ARUKH &&
            selectedCommentary == CommentaryType.SHAKH -> "$currentRef:1-100"

            category == TextCategory.MISHNAH &&
            mishnahSubcategory == MishnahSubcategory.TOSEFTA ->
                "$currentRef:1-200"

            category == TextCategory.MISHNAH &&
            selectedCommentary in listOf(
                CommentaryType.RAMBAM_MISHNAH, CommentaryType.BARTENURA,
                CommentaryType.TOSAFOT_YOM_TOV, CommentaryType.MELEKHET_SHLOMO,
                CommentaryType.TOSAFOT_RABBI_AKIVA_EIGER, CommentaryType.ENGLISH_EXPLANATION,
                CommentaryType.RASH_MI_SHANTZ, CommentaryType.YESH_SEDER_LA_MISHNAH,
                CommentaryType.GRA, CommentaryType.RASHASH, CommentaryType.YACHIN) ->
                "$currentRef:1-20"

            category == TextCategory.TANAKH -> "$currentRef:1-200"

            // Use bare daf ref (no amud suffix) — the Sefaria response nests amud-a and
            // amud-b together and flattenTextValue extracts everything correctly.
            category == TextCategory.TALMUD -> currentRef

            else -> currentRef
        }

        // Ein Ayah is bundled — no Sefaria fetch needed.
        if (selectedCommentary == CommentaryType.EIN_AYAH) {
            val parts = commentaryRef.split(" ", limit = 2)
            val tractate = parts.getOrElse(0) { "" }
            val daf      = parts.getOrElse(1) { "" }
            commentaryEntries = EinAyahLoader.entries(getApplication(), tractate, daf)
            commentaryLoadVersion++
            isLoadingCommentary = false
            return
        }

        val versions = selectedCommentary.sefariaRefVersions(commentaryRef)
        // Only try the introduction fetch for single-ref commentaries. Multi-ref ones
        // (Tosafot Rid recensions, Maharsha Halachot+Agadot, R. Akiva Eiger) don't have
        // introduction sections and the base-ref lookup would return wrong content.
        // SA commentaries have no introduction sections on Sefaria — skip introRef entirely
        // to prevent Sefaria from returning siman-1 content for the "Introduction" pseudo-ref
        // and prepending it as a duplicate of the real siman-1 data.
        val introR: String? = if (isAtFirstSection && versions.size == 1
            && category != TextCategory.SHULCHAN_ARUKH
            && category != TextCategory.MISHNAH
            && category != TextCategory.RAMBAM) introRef(commentaryRef) else null

        val useMishnahLabels = category == TextCategory.MISHNAH || category == TextCategory.RAMBAM || category == TextCategory.TANAKH

        if (versions.size == 1) {
            // Fast path: single aligned fetch preserving outer structural pairing.
            val ref = versions[0].first
            val (hSegs, eSegs, outerIdx) = runCatching {
                SefariaTextClient.fetchBothAligned(ref)
            }.getOrElse { Triple(emptyList(), emptyList(), emptyList()) }
            val count = maxOf(eSegs.size, hSegs.size)
            var seqIdx = 0
            var entries: List<CommentaryEntry> = (0 until count).mapNotNull { i ->
                val h = hSegs.getOrElse(i) { "" }
                val e = eSegs.getOrElse(i) { "" }
                if (h.isBlank() && e.isBlank()) return@mapNotNull null
                val label: Int? = if (useMishnahLabels) outerIdx.getOrElse(i) { i } else null
                CommentaryEntry.Text(index = seqIdx++, label = label, he = h, en = e)
            }
            if (introR != null) entries = prependIntro(entries, introR)
            commentaryEntries = entries
        } else {
            // Multi-recension path (Tosafot Rid on Avodah Zarah / Megillah).
            val entries = mutableListOf<CommentaryEntry>()
            var segIdx = 0
            if (introR != null) {
                val introEntries = fetchIntroEntries(introR, 0)
                entries.addAll(introEntries)
                segIdx = introEntries.size
            }
            val useBookDivider = selectedCommentary.usesBookDivider
            for ((ref, label) in versions) {
                if (label != null) entries.add(
                    if (useBookDivider) CommentaryEntry.BookDivider(label)
                    else CommentaryEntry.RecensionHeader(label)
                )
                val (hSegs, eSegs, _) = runCatching {
                    SefariaTextClient.fetchBothAligned(ref)
                }.getOrElse { Triple(emptyList(), emptyList(), emptyList()) }
                val count = maxOf(eSegs.size, hSegs.size)
                for (i in 0 until count) {
                    entries.add(CommentaryEntry.Text(
                        index = segIdx + i,
                        he = hSegs.getOrElse(i) { "" },
                        en = eSegs.getOrElse(i) { "" }
                    ))
                }
                segIdx += count
            }
            commentaryEntries = entries
        }
        // For Talmud single-version commentary: the bare daf ref only returns 1 amud-b entry
        // regardless of actual count. Fetch amud-a and amud-b separately with range queries
        // and rebuild the entry list with an "עמוד ב׳" divider.
        if (category == TextCategory.TALMUD && currentRef.isNotEmpty()
            && selectedCommentary != CommentaryType.EIN_AYAH && versions.size == 1) {
            val baseRef = versions[0].first  // e.g. "Rashi on Berakhot 2"
            val refA = "${baseRef}a.1-200"
            val refB = "${baseRef}b.1-200"
            val aFetch = viewModelScope.async { runCatching { SefariaTextClient.fetchBothAligned(refA) }.getOrElse { Triple(emptyList(), emptyList(), emptyList()) } }
            val bFetch = viewModelScope.async { runCatching { SefariaTextClient.fetchBothAligned(refB) }.getOrElse { Triple(emptyList(), emptyList(), emptyList()) } }
            val (aHe, aEn, _) = aFetch.await()
            val (bHe, bEn, _) = bFetch.await()
            val aCount = maxOf(aHe.size, aEn.size)
            val bCount = maxOf(bHe.size, bEn.size)
            if (aCount > 0 || bCount > 0) {
                val entries = mutableListOf<CommentaryEntry>()
                for (i in 0 until aCount) {
                    entries.add(CommentaryEntry.Text(
                        index = i,
                        he = aHe.getOrElse(i) { "" },
                        en = aEn.getOrElse(i) { "" }
                    ))
                }
                if (bCount > 0) {
                    entries.add(CommentaryEntry.RecensionHeader("עמוד ב׳"))
                    for (i in 0 until bCount) {
                        entries.add(CommentaryEntry.Text(
                            index = aCount + i,
                            he = bHe.getOrElse(i) { "" },
                            en = bEn.getOrElse(i) { "" }
                        ))
                    }
                }
                commentaryEntries = entries
            }
        }

        commentaryLoadVersion++
        isLoadingCommentary = false
    }

    // MARK: - Intro helpers

    private val isAtFirstSection: Boolean get() = when (category) {
        TextCategory.TANAKH      -> tanakhChapter == 1
        TextCategory.MISHNAH     -> mishnahChapter == 1
        TextCategory.TALMUD      -> talmudDaf == (currentTalmudTractate?.startDaf ?: 2)
        TextCategory.RAMBAM      -> rambamChapter == 1
        TextCategory.SHULCHAN_ARUKH -> saSiman == 1
        TextCategory.MIDRASH -> if (midrashNavigationMode == MidrashNavigationMode.NATIVE)
            midrashNativeChapter == 1 && midrashNativeSection == 1
        else midrashChapter == 1 && midrashVerse == 1
    }

    private fun introRef(commentaryRef: String): String? {
        var ref = commentaryRef
        // Strip ":N-M" depth-3 range suffix
        ref = ref.replace(Regex(":\\d+-\\d+$"), "")
        // Strip trailing " N" (chapter/daf number)
        val lastSpace = ref.lastIndexOf(' ')
        if (lastSpace < 0) return null
        val afterSpace = ref.substring(lastSpace + 1)
        if (!afterSpace.all { it.isDigit() }) return null
        return ref.substring(0, lastSpace) + ", Introduction"
    }

    private suspend fun fetchIntroEntries(ref: String, startIdx: Int): List<CommentaryEntry> {
        val (hSegs, eSegs, _) = runCatching {
            SefariaTextClient.fetchBothAligned(ref)
        }.getOrElse { Triple(emptyList(), emptyList(), emptyList()) }
        val count = maxOf(eSegs.size, hSegs.size)
        if (count == 0) return emptyList()
        return (0 until count).map { i ->
            CommentaryEntry.Text(
                index = startIdx + i,
                he = hSegs.getOrElse(i) { "" },
                en = eSegs.getOrElse(i) { "" }
            )
        }
    }

    private suspend fun prependIntro(entries: List<CommentaryEntry>, introRef: String): List<CommentaryEntry> {
        val introEntries = fetchIntroEntries(introRef, 0)
        if (introEntries.isEmpty()) return entries
        val iCount = introEntries.size
        val shifted = entries.map { entry ->
            when (entry) {
                is CommentaryEntry.Text -> CommentaryEntry.Text(
                    index = entry.index + iCount,
                    label = entry.label,
                    he = entry.he,
                    en = entry.en
                )
                else -> entry
            }
        }
        return introEntries + shifted
    }

    // MARK: - Navigation

    fun navigatePrevious() {
        viewModelScope.launch {
            when (category) {
                TextCategory.TANAKH -> {
                    if (tanakhChapter > 1) {
                        tanakhChapter -= 1
                    } else if (tanakhBookIndex > 0) {
                        tanakhBookIndex -= 1
                        tanakhChapter = TextCatalog.allTanakhBooks[tanakhBookIndex].chapters
                    }
                }
                TextCategory.MISHNAH -> {
                    if (mishnahChapter > 1) mishnahChapter -= 1
                }
                TextCategory.TALMUD -> {
                    val t = currentTalmudTractate
                    if (t != null && talmudDaf > t.startDaf) talmudDaf -= 1
                }
                TextCategory.RAMBAM -> {
                    // Only go to chapter 0 if an intro exists; otherwise stop at chapter 1
                    val minChapter = if (rambamHasIntro) 0 else 1
                    if (rambamChapter > minChapter) rambamChapter -= 1 else return@launch
                }
                TextCategory.SHULCHAN_ARUKH -> {
                    if (saSiman > 1) saSiman -= 1
                }
                TextCategory.MIDRASH -> {
                    if (midrashNavigationMode == MidrashNavigationMode.NATIVE) {
                        if (!midrashWork.nativeIsOneLevel && midrashNativeSection > 1) {
                            midrashNativeSection -= 1
                        } else if (midrashNativeChapter > 1) {
                            midrashNativeChapter -= 1
                            midrashNativeSection = 1
                        }
                    } else {
                        if (midrashVerse > 1) {
                            midrashVerse -= 1
                        } else if (midrashChapter > 1) {
                            midrashChapter -= 1
                            midrashVerse = torahVerseCount(midrashBookIndex, midrashChapter)
                        }
                    }
                }
            }
            load()
        }
    }

    fun navigateNext() {
        viewModelScope.launch {
            when (category) {
                TextCategory.TANAKH -> {
                    val bookChapters = TextCatalog.allTanakhBooks.getOrNull(tanakhBookIndex)?.chapters ?: 1
                    if (tanakhChapter < bookChapters) {
                        tanakhChapter += 1
                    } else if (tanakhBookIndex < TextCatalog.allTanakhBooks.size - 1) {
                        tanakhBookIndex += 1
                        tanakhChapter = 1
                    }
                }
                TextCategory.MISHNAH -> {
                    val t = currentMishnahTractate
                    if (t != null && mishnahChapter < t.chapters) mishnahChapter += 1
                }
                TextCategory.TALMUD -> {
                    val t = currentTalmudTractate
                    if (t != null && talmudDaf < t.endDaf) talmudDaf += 1
                }
                TextCategory.RAMBAM -> {
                    val w = currentRambamWork
                    if (w != null && rambamChapter < w.chapters) rambamChapter += 1
                }
                TextCategory.SHULCHAN_ARUKH -> {
                    val maxSiman = TextCatalog.shulchanArukhSections.getOrNull(saSection)?.simanim ?: 1
                    if (saSiman < maxSiman) saSiman += 1
                }
                TextCategory.MIDRASH -> {
                    if (midrashNavigationMode == MidrashNavigationMode.NATIVE) {
                        if (!midrashWork.nativeIsOneLevel) {
                            midrashNativeSection += 1
                        } else if (midrashNativeChapter < midrashWork.nativeMaxChapters) {
                            midrashNativeChapter += 1
                        }
                    } else {
                        val maxVerse = torahVerseCount(midrashBookIndex, midrashChapter)
                        if (midrashVerse < maxVerse) {
                            midrashVerse += 1
                        } else {
                            val bookChapters = TextCatalog.allTanakhBooks.getOrNull(midrashBookIndex)?.chapters ?: 1
                            if (midrashChapter < bookChapters) {
                                midrashChapter += 1
                                midrashVerse = 1
                            }
                        }
                    }
                }
            }
            load()
        }
    }

    // MARK: - Bookmark helpers

    fun createBookmark(): Bookmark = Bookmark(
        category = category,
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
        midrashSubcategoryId = midrashSubcategory.id,
        midrashWorkId = midrashWork.id,
        midrashBookIndex = midrashBookIndex,
        midrashChapter = midrashChapter,
        midrashVerse = midrashVerse,
        name = displayTitle,
        subtitle = "${category.displayName} · $displayTitle"
    )

    fun applyBookmark(bookmark: Bookmark) {
        category = bookmark.category
        tanakhBookIndex = bookmark.tanakhBookIndex
        tanakhChapter = bookmark.tanakhChapter
        mishnahSederIndex = bookmark.mishnahSederIndex
        mishnahTractateIndexInSeder = bookmark.mishnahTractateIndexInSeder
        mishnahChapter = bookmark.mishnahChapter
        talmudSederIndex = bookmark.talmudSederIndex
        talmudTractateIndexInSeder = bookmark.talmudTractateIndexInSeder
        talmudDaf = bookmark.talmudDaf
        rambamSeferIndex = bookmark.rambamSeferIndex
        rambamWorkIndexInSefer = bookmark.rambamWorkIndexInSefer
        rambamChapter = bookmark.rambamChapter
        saSection = bookmark.saSection
        saSiman = bookmark.saSiman
        midrashSubcategory = MidrashSubcategory.fromId(bookmark.midrashSubcategoryId)
        midrashWork = MidrashWork.fromId(bookmark.midrashWorkId)
        midrashBookIndex = bookmark.midrashBookIndex
        midrashChapter = bookmark.midrashChapter
        midrashVerse = bookmark.midrashVerse
        load()
    }

    // MARK: - Talmud seder/tractate reset helpers

    fun setTalmudSeder(idx: Int) {
        talmudSederIndex = idx
        talmudTractateIndexInSeder = 0
        val t = talmudTractateCandidates.firstOrNull()
        talmudDaf = t?.startDaf ?: 2
    }

    fun setTalmudTractate(idx: Int) {
        talmudTractateIndexInSeder = idx
        val t = talmudTractateCandidates.getOrNull(idx)
        talmudDaf = t?.startDaf ?: 2
    }

    fun setMishnahSeder(idx: Int) {
        mishnahSederIndex = idx
        mishnahTractateIndexInSeder = 0
        mishnahChapter = 1
    }

    fun setMishnahTractate(idx: Int) {
        mishnahTractateIndexInSeder = idx
        mishnahChapter = 1
    }

    /** Set Mishnah selection from a flat global index into allMishnahTractates. */
    fun setMishnahGlobalTractate(globalIdx: Int) {
        val sedarim = TextCatalog.mishnahSedarim
        var remaining = globalIdx
        for ((si, seder) in sedarim.withIndex()) {
            if (remaining < seder.tractates.size) {
                mishnahSederIndex = si
                mishnahTractateIndexInSeder = remaining
                mishnahChapter = 1
                return
            }
            remaining -= seder.tractates.size
        }
    }

    /** Set Talmud selection from a flat global index into allTalmudTractates. */
    fun setTalmudGlobalTractate(globalIdx: Int) {
        val sedarim = TextCatalog.talmudSedarim
        var remaining = globalIdx
        for ((si, seder) in sedarim.withIndex()) {
            if (remaining < seder.tractates.size) {
                talmudSederIndex = si
                talmudTractateIndexInSeder = remaining
                talmudDaf = seder.tractates[remaining].startDaf
                return
            }
            remaining -= seder.tractates.size
        }
    }

    /** Flat position of current Mishnah tractate in allMishnahTractates. */
    val mishnahGlobalTractateIndex: Int get() {
        val sedarim = TextCatalog.mishnahSedarim
        var offset = 0
        for (si in 0 until mishnahSederIndex.coerceAtMost(sedarim.size)) {
            offset += sedarim[si].tractates.size
        }
        return offset + mishnahTractateIndexInSeder
    }

    /** Flat position of current Talmud tractate in allTalmudTractates. */
    val talmudGlobalTractateIndex: Int get() {
        val sedarim = TextCatalog.talmudSedarim
        var offset = 0
        for (si in 0 until talmudSederIndex.coerceAtMost(sedarim.size)) {
            offset += sedarim[si].tractates.size
        }
        return offset + talmudTractateIndexInSeder
    }

    fun setRambamSefer(idx: Int) {
        rambamSeferIndex = idx
        rambamWorkIndexInSefer = 0
        rambamChapter = if (rambamHasIntro) 0 else 1
    }

    fun setRambamWork(idx: Int) {
        rambamWorkIndexInSefer = idx
        rambamChapter = if (rambamHasIntro) 0 else 1
    }

    fun setTanakhBook(idx: Int) {
        tanakhBookIndex = idx
        tanakhChapter = 1
    }
}

private fun String.strippingNikud(): String = filter { c -> c.code < 0x0591 || c.code > 0x05C7 }
