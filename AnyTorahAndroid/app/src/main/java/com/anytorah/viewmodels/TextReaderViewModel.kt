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
import com.anytorah.api.PodcastEpisodeCitation
import com.anytorah.api.RelatedYCTPiece
import com.anytorah.api.SefariaTextClient
import com.anytorah.api.TeshuvotPageManager
import com.anytorah.api.TurParagraphEngine
import com.anytorah.api.YCTRelatedArticlesService
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
import com.anytorah.models.SATextMode
import com.anytorah.models.TalmudSubcategory
import com.anytorah.models.TalmudTractate
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

    /** true = Teshuvot work pickers list poskim alphabetically with no century grouping;
     *  false (default) = grouped by century, chronological order. */
    var teshuvotAlphabeticalOrder by mutableStateOf(prefs.getBoolean("teshuvotAlphabeticalOrder", false))
        private set

    fun updateTeshuvotAlphabeticalOrder(value: Boolean) {
        teshuvotAlphabeticalOrder = value
        prefs.edit().putBoolean("teshuvotAlphabeticalOrder", value).apply()
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

    /** Shulchan Arukh main-text edition — commentary markers (default) or vocalized nikud.
     *  See SATextMode in models/TextModels.kt. */
    var saTextMode by mutableStateOf(SATextMode.fromRaw(prefs.getString("saTextMode", null)))
        private set

    fun updateSaTextMode(value: SATextMode) {
        saTextMode = value
        prefs.edit().putString("saTextMode", value.raw).apply()
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
        set(v) { _talmudDaf.intValue = v; talmudAmud = defaultAmud(currentTalmudTractate, v) }

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

    // Tur
    var turSection by mutableIntStateOf(0)
    var turSiman by mutableIntStateOf(1)

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

    // Teshuvot — subcategory -> work -> volume -> siman. See TeshuvotWork's own doc comment.
    var teshuvotSubcategory by mutableStateOf(TeshuvotSubcategory.RISHONIM)
    var teshuvotWork by mutableStateOf(TeshuvotWork.RASHI)
    var teshuvotVolume by mutableIntStateOf(1)
    var teshuvotSiman by mutableIntStateOf(1)

    // Contemporary Teshuvot — parallel state to the block above, not reused, since navigation
    // is page-image based (see ContemporaryTeshuvotWork) rather than Sefaria-fetch based.
    // contemporaryPage (not siman) is the actual navigable unit — the siman picker just jumps
    // it via TeshuvotPageManager.page(...); forward/back moves it by raw page number. Always go
    // through setContemporaryWork/setContemporaryVolume/setContemporaryPage rather than
    // assigning these directly — they also persist state, since Contemporary's reader (a plain
    // image pager) never calls load(), which is where every other category's state normally
    // gets saved.
    var contemporaryWork by mutableStateOf(ContemporaryTeshuvotWork.works.first())
    var contemporaryVolume by mutableStateOf(ContemporaryTeshuvotWork.works.first().volumes.first())
    // Default is siman 1's real page, not raw page 1 -- restoreState(TESHUVOT) only reaches the
    // firstSimanPage fallback below once teshuvotSubcategory is already CONTEMPORARY, but on a
    // fresh install teshuvotSubcategory itself still defaults to RISHONIM (no "sel_teshuvot_sub"
    // pref saved yet), so the very first visit to Contemporary/Iggros Moshe renders whatever this
    // stored default is -- a bare 1 landed on the title/front-matter page while the pill still
    // read "1", the exact bug this fixes.
    var contemporaryPage by mutableIntStateOf(firstSimanPage(ContemporaryTeshuvotWork.works.first().volumes.first()))

    /** Set only by [jumpToContemporarySiman] (the siman picker), never by forward/back paging --
     *  lets the header pill honor exactly which siman the reader picked even when another siman
     *  shares the same page (a real, common case -- see [resolvedContemporarySiman] and
     *  [TeshuvotPageManager.siman]'s own doc comment on the same bug). Not itself cleared on
     *  every page change; [resolvedContemporarySiman] instead checks whether this siman's own
     *  indexed page still equals [contemporaryPage] and falls through to the plain floor lookup
     *  the moment it doesn't (e.g. after a forward/back page turn). */
    var contemporaryPickedSiman by mutableStateOf<Int?>(null)

    /** True when Contemporary's currently-selected "book" is one of the Sefaria-digitized works
     *  (Mishpetei Uziel, Benei Banim, B'mareh HaBazak — fetched/rendered through the ordinary
     *  teshuvotWork/load() pipeline, exactly like Rishonim/Acharonim) rather than the page-image-
     *  based Iggros Moshe (contemporaryWork/the image pager). Both systems live under the one
     *  CONTEMPORARY subcategory and share its book picker — this flag is the discriminator every
     *  Contemporary-aware call site checks. Set directly by the book-picker row handlers in
     *  TextReaderScreen.kt, not by any cascade of its own — mirrors contemporaryWork's own shape. */
    var contemporaryUsesSefaria by mutableStateOf(false)

    fun setContemporaryWork(work: ContemporaryTeshuvotWork) {
        contemporaryWork = work
        contemporaryVolume = work.volumes.first()
        contemporaryPage = firstSimanPage(contemporaryVolume)
        contemporaryPickedSiman = null
        saveState(TextCategory.TESHUVOT)
    }

    fun setContemporaryVolume(volume: ContemporaryTeshuvotVolume) {
        contemporaryVolume = volume
        contemporaryPage = firstSimanPage(contemporaryVolume)
        contemporaryPickedSiman = null
        saveState(TextCategory.TESHUVOT)
    }

    /** Jumps to the page a specific siman starts on and remembers that this exact siman was
     *  explicitly picked (see [contemporaryPickedSiman]) -- the siman picker's only entry point,
     *  instead of assigning [contemporaryPage] directly. */
    fun jumpToContemporarySiman(siman: Int) {
        contemporaryPickedSiman = siman
        TeshuvotPageManager.page(getApplication(), contemporaryVolume.id, siman)?.let { contemporaryPage = it }
    }

    /** The page siman 1 actually starts on, not raw page 1 -- several volumes open with a
     *  title/front-matter page or two before siman 1 begins (e.g. Iggros Moshe OC I: siman 1 is
     *  page 5, not 1), and landing on that title page while the siman pill/picker reads "1" was
     *  a real, reported mismatch. Falls back to 1 if siman 1 isn't indexed yet for this volume.
     *  Uses [getApplication] directly (already done elsewhere in this class, e.g. the
     *  EinAyahLoader call below) rather than threading Context through from the Composable
     *  layer, since [com.anytorah.viewmodels.TextReaderViewModel] is an AndroidViewModel. */
    private fun firstSimanPage(volume: ContemporaryTeshuvotVolume): Int =
        TeshuvotPageManager.page(getApplication(), volume.id, 1) ?: 1

    /** The siman actually being displayed right now -- [contemporaryPickedSiman] when it's
     *  still valid (see its own doc comment), else the plain floor lookup. Shared by
     *  [navChapterTitle]'s pill and the podcast-citations `LaunchedEffect` in
     *  TextReaderScreen.kt so both agree on "what siman am I looking at" when two simanim share
     *  a page. Takes Context explicitly (unlike [firstSimanPage]/[jumpToContemporarySiman]'s use
     *  of [getApplication]) to match [navChapterTitle]'s own existing optional-Context shape. */
    fun resolvedContemporarySiman(context: android.content.Context): Int? {
        val picked = contemporaryPickedSiman
        if (picked != null && TeshuvotPageManager.page(context, contemporaryVolume.id, picked) == contemporaryPage) {
            return picked
        }
        return TeshuvotPageManager.siman(context, contemporaryVolume.id, contemporaryPage)
    }

    fun setContemporaryPage(page: Int) {
        contemporaryPage = page
        saveState(TextCategory.TESHUVOT)
    }

    /** Every "Iggros Moshe A to Z" podcast episode citing the current Contemporary siman (empty
     *  if none) -- see [com.anytorah.api.IggrosMoshePodcastService]. Kept Context-free like the
     *  rest of this ViewModel (established convention -- see contemporaryPage's own doc comment
     *  and [com.anytorah.api.TeshuvotPageManager]); the lookup itself runs from a
     *  `LaunchedEffect` in TextReaderScreen.kt, which has `LocalContext.current` available. */
    var citedPodcastEpisodes by mutableStateOf<List<PodcastEpisodeCitation>>(emptyList())
        private set

    /** [episodeId: artworkUrl], populated as each episode's SoundCloud oEmbed fetch resolves. */
    var podcastArtwork by mutableStateOf<Map<String, String>>(emptyMap())
        private set

    fun setCitedPodcastEpisodes(episodes: List<PodcastEpisodeCitation>) {
        citedPodcastEpisodes = episodes
    }

    fun setPodcastArtwork(episodeId: String, url: String) {
        podcastArtwork = podcastArtwork + (episodeId to url)
    }

    private fun teshuvotWorkKey(sub: TeshuvotSubcategory) = "sel_teshuvot_work_${sub.id}"
    private fun teshuvotVolumeKey(sub: TeshuvotSubcategory) = "sel_teshuvot_volume_${sub.id}"
    private fun teshuvotSimanKey(sub: TeshuvotSubcategory) = "sel_teshuvot_siman_${sub.id}"

    /** Restores [sub]'s own last-used work/volume/siman from prefs (falling back to the first
     *  work / siman 1 if [sub] has never been visited). Shared by `restoreState(TESHUVOT)` and
     *  `setTeshuvotSubcategory` so both paths use the same per-subcategory keys — see
     *  `setTeshuvotSubcategory`'s doc comment for why per-subcategory keys are needed at all. */
    private fun loadRegularTeshuvotState(sub: TeshuvotSubcategory) {
        val savedWork = prefs.getString(teshuvotWorkKey(sub), null)?.let { TeshuvotWork.fromId(it) }
        if (savedWork != null) {
            teshuvotWork = savedWork
            teshuvotVolume = prefs.getInt(teshuvotVolumeKey(sub), 1)
            teshuvotSiman = prefs.getInt(teshuvotSimanKey(sub), 1)
        } else {
            teshuvotWork = TeshuvotWork.worksFor(sub).firstOrNull() ?: TeshuvotWork.RASHI
            teshuvotVolume = 1
            teshuvotSiman = 1
        }
    }

    /** Sets [teshuvotSubcategory] and restores that subcategory's own last-used work/volume/
     *  siman — Kotlin's plain `mutableStateOf` properties have no iOS-style `didSet` cascade, so
     *  without this, switching subcategory (e.g. via the Home screen's Rishonim/Acharonim
     *  buttons) left `teshuvotWork` pointing at a work from the *previous* subcategory: the
     *  pickers correctly filtered to the new subcategory's works, but the reader itself kept
     *  showing the stale work's content. Always call this instead of assigning
     *  `teshuvotSubcategory` directly — mirrors `applyMidrashSubcategory` in HomeScreen.kt for
     *  the same reason. */
    // Only restores/resets work/volume/siman when the subcategory actually changes -- not on
    // every call, since the Home screen's Rishonim/Acharonim buttons call restoreState(TESHUVOT)
    // and THEN this function, even when re-selecting the SAME subcategory the user was already
    // on. Rishonim and Acharonim used to share one set of prefs keys for work/volume/siman, so
    // whichever was visited most recently silently overwrote the other's saved position --
    // alternating between the two buttons made every switch look like "first time ever" and
    // reset to the first work/siman 1 regardless of that subcategory's own history. Each
    // subcategory now gets its own keys (see loadRegularTeshuvotState).
    fun setTeshuvotSubcategory(sub: TeshuvotSubcategory) {
        val changed = sub != teshuvotSubcategory
        teshuvotSubcategory = sub
        if (changed && sub != TeshuvotSubcategory.CONTEMPORARY) {
            loadRegularTeshuvotState(sub)
        }
    }

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
    /** YCT halakha pieces (library.yctorah.org/psak.yctorah.org) citing the current SA siman --
     *  see YCTRelatedArticlesService. Shulchan Arukh only; empty for every other category. */
    var relatedYCTPieces by mutableStateOf<List<RelatedYCTPiece>>(emptyList())
        private set

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
            "tur_0"   to listOf(CommentaryType.BEIT_YOSEF, CommentaryType.BACH, CommentaryType.DARKHEI_MOSHE, CommentaryType.PRISHA_DRISHA),
            "tur_1"   to listOf(CommentaryType.BEIT_YOSEF, CommentaryType.BACH, CommentaryType.DARKHEI_MOSHE, CommentaryType.PRISHA_DRISHA),
            "tur_2"   to listOf(CommentaryType.BEIT_YOSEF, CommentaryType.BACH, CommentaryType.DARKHEI_MOSHE, CommentaryType.PRISHA_DRISHA),
            "tur_3"   to listOf(CommentaryType.BEIT_YOSEF, CommentaryType.BACH, CommentaryType.DARKHEI_MOSHE, CommentaryType.PRISHA_DRISHA),
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
        TextCategory.TUR -> "tur_$turSection"
        TextCategory.SHULCHAN_ARUKH -> "sa_$saSection"
        TextCategory.MIDRASH -> "midrash"
        TextCategory.TESHUVOT -> "teshuvot"
    }

    /** True only for Talmud Bavli — false for Talmud Yerushalmi and every other category.
     *  Bavli-only features (daf images, amud A/B navigation, shiur audio) must gate on this
     *  rather than on `category == TALMUD` alone, since Yerushalmi shares the same category
     *  but has no daf/amud concept and no matching audio/image content. */
    val isTalmudBavli: Boolean get() = category == TextCategory.TALMUD && talmudSubcategory == TalmudSubcategory.BAVLI

    /** Fully-qualified display name for the current selection — e.g. "Talmud Yerushalmi",
     *  "Midrash Aggada", "Tosefta" — rather than the bare parent category name. Tanakh/Mishnah/
     *  Talmud/Midrash/etc. are chosen as independent, flat entry points from the home screen
     *  (not sub-choices within a shared category), so anywhere the app names "what the user is
     *  currently reading" should show the specific identity, not the generic parent. */
    val categoryDisplayName: String get() = when (category) {
        TextCategory.MISHNAH -> mishnahSubcategory.displayName
        TextCategory.TALMUD  -> "Talmud ${talmudSubcategory.displayName}"
        TextCategory.MIDRASH -> midrashSubcategory.displayName
        TextCategory.TESHUVOT -> teshuvotSubcategory.displayName
        else -> category.displayName
    }

    val categoryHebrewDisplayName: String get() = when (category) {
        TextCategory.MISHNAH -> mishnahSubcategory.hebrewName
        TextCategory.TALMUD  -> "${category.hebrewName} ${talmudSubcategory.hebrewName}"
        TextCategory.MIDRASH -> midrashSubcategory.hebrewName
        TextCategory.TESHUVOT -> teshuvotSubcategory.hebrewName
        else -> category.hebrewName
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
        TextCategory.TUR -> listOf(CommentaryType.turPool)
        TextCategory.SHULCHAN_ARUKH -> listOf(CommentaryType.saPool(saSection))
        TextCategory.MIDRASH -> listOf(emptyList())
        TextCategory.TESHUVOT -> listOf(emptyList())
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
        TextCategory.TUR -> true
        TextCategory.SHULCHAN_ARUKH -> true
        TextCategory.MIDRASH -> false
        TextCategory.TESHUVOT -> false
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
        TextCategory.TUR -> availableCommentaries
        TextCategory.SHULCHAN_ARUKH -> availableCommentaries
        TextCategory.MIDRASH -> emptyList()
        TextCategory.TESHUVOT -> emptyList()
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
            TextCategory.TUR -> {
                turSection = prefs.getInt("sel_tur_section", 0)
                turSiman   = prefs.getInt("sel_tur_siman", 1)
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
                // Belt-and-suspenders against a stale persisted mode: Halakha is never by-verse.
                if (midrashSubcategory == MidrashSubcategory.HALAKHA) {
                    midrashNavigationMode = MidrashNavigationMode.NATIVE
                }
                midrashNativeChapter  = prefs.getInt("sel_midrash_native_ch", 1)
                midrashNativeSection  = prefs.getInt("sel_midrash_native_sec", 1)
            }
            TextCategory.TESHUVOT -> {
                teshuvotSubcategory = TeshuvotSubcategory.fromId(prefs.getString("sel_teshuvot_sub", null))
                if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY) {
                    contemporaryUsesSefaria = prefs.getBoolean("sel_contemp_uses_sefaria", false)
                }
                if (teshuvotSubcategory != TeshuvotSubcategory.CONTEMPORARY || contemporaryUsesSefaria) {
                    loadRegularTeshuvotState(teshuvotSubcategory)
                }
                if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !contemporaryUsesSefaria) {
                    val workId = prefs.getString("sel_contemp_work", null)
                    contemporaryWork = ContemporaryTeshuvotWork.works.firstOrNull { it.id == workId }
                        ?: ContemporaryTeshuvotWork.works.first()
                    val volId = prefs.getString("sel_contemp_volume", null)
                    contemporaryVolume = contemporaryWork.volumes.firstOrNull { it.id == volId }
                        ?: contemporaryWork.volumes.first()
                    contemporaryPage = if (prefs.contains("sel_contemp_page")) {
                        prefs.getInt("sel_contemp_page", 1)
                    } else {
                        firstSimanPage(contemporaryVolume)
                    }
                    contemporaryPickedSiman = null
                }
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
            TextCategory.TUR -> {
                e.putInt("sel_tur_section", turSection)
                e.putInt("sel_tur_siman", turSiman)
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
            TextCategory.TESHUVOT -> {
                e.putString("sel_teshuvot_sub", teshuvotSubcategory.id)
                if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY) {
                    e.putBoolean("sel_contemp_uses_sefaria", contemporaryUsesSefaria)
                }
                if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !contemporaryUsesSefaria) {
                    e.putString("sel_contemp_work", contemporaryWork.id)
                    e.putString("sel_contemp_volume", contemporaryVolume.id)
                    e.putInt("sel_contemp_page", contemporaryPage)
                } else {
                    // Keyed per subcategory -- see setTeshuvotSubcategory's doc comment.
                    e.putString(teshuvotWorkKey(teshuvotSubcategory), teshuvotWork.id)
                    e.putInt(teshuvotVolumeKey(teshuvotSubcategory), teshuvotVolume)
                    e.putInt(teshuvotSimanKey(teshuvotSubcategory), teshuvotSiman)
                }
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

    /**
     * The amud (0 = alef, 1 = bet) a freshly-navigated-to daf should open on. Almost always 0 —
     * Tamid's startDaf (25) is the one exception: its Gemara (and daf-image scans) only begin
     * at 25b, since 25a has no content (confirmed empty on Sefaria — "firstAvailableSectionRef":
     * "Tamid 25b") and no scanned page. Only applies at the tractate's actual startDaf — every
     * other daf within Tamid still opens at amud alef like normal.
     */
    private fun defaultAmud(tractate: TalmudTractate?, daf: Int): Int {
        if (tractate?.sefariaName == "Tamid" && daf == tractate.startDaf) return 1
        return 0
    }

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
        TextCategory.TUR -> {
            val s = TextCatalog.turSections.getOrNull(turSection)?.name ?: ""
            "$s, §$turSiman"
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
        TextCategory.TESHUVOT -> {
            val label = teshuvotWork.volumeLabel
            if (label != null) "${teshuvotWork.displayName}, $label ${teshuvotWork.volumeDisplayLabel(teshuvotVolume)}:$teshuvotSiman"
            else "${teshuvotWork.displayName} §$teshuvotSiman"
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
        TextCategory.TUR -> {
            val s = TextCatalog.turSections.getOrNull(turSection)
            if (s == null) "–" else if (saHebrewMode) s.hebrewName.strippingNikud() else s.name
        }
        TextCategory.SHULCHAN_ARUKH -> {
            val s = TextCatalog.shulchanArukhSections.getOrNull(saSection)
            if (s == null) "–" else if (saHebrewMode) s.hebrewName.strippingNikud() else s.name
        }
        TextCategory.MIDRASH -> if (saHebrewMode) midrashWork.hebrewName else midrashWork.displayName
        TextCategory.TESHUVOT -> {
            if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !contemporaryUsesSefaria) {
                if (saHebrewMode) contemporaryWork.hebrewDisplayName else contemporaryWork.name
            } else {
                if (saHebrewMode) teshuvotWork.hebrewName else teshuvotWork.displayName
            }
        }
    }

    /** Short title for the dedicated "volume" navigation pill (Teshuvot only, and only for
     *  works with a volume level -- see [TeshuvotWork.volumeLabel]); null hides the pill. Just
     *  the bare numeral -- the roman numeral already reads as a volume number in English, no
     *  prefix needed. */
    val navVolumeTitle: String? get() {
        if (category != TextCategory.TESHUVOT) return null
        if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !contemporaryUsesSefaria) {
            // Always shown (unlike Rishonim/Acharonim, gated on volumeLabel != null) -- every
            // Contemporary work has a real, always-relevant volume level.
            return if (saHebrewMode) contemporaryVolume.hebrewLabel else contemporaryVolume.label
        }
        if (teshuvotWork.volumeLabel == null) return null
        return if (saHebrewMode) {
            teshuvotWork.volumeDisplayLabelHebrew(teshuvotVolume)
        } else {
            teshuvotWork.volumeDisplayLabel(teshuvotVolume)
        }
    }

    /** Short title for the "chapter" navigation pill in the reader header. */
    /** [contemporaryContext] is only consulted for the Contemporary Teshuvot branch (reverse
     *  siman lookup needs an Android Context to read the bundled asset -- see
     *  TeshuvotPageManager) -- every other category ignores it. Pass null only when you know
     *  category/subcategory can't be Contemporary at that call site; the one real call site
     *  (TextReaderScreen.kt) always has LocalContext.current available. */
    fun navChapterTitle(contemporaryContext: android.content.Context? = null): String = when (category) {
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
        TextCategory.TUR -> if (saHebrewMode) "סי׳ ${SASimanNames.toHebrewNumeral(turSiman)}" else "§$turSiman"
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
        TextCategory.TESHUVOT -> {
            if (teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !contemporaryUsesSefaria) {
                // resolvedContemporarySiman honors an explicit pick (contemporaryPickedSiman)
                // when it's still valid -- when two simanim share a page, the plain floor lookup
                // alone can't tell which one the reader actually wants. No descriptor/label,
                // bare numeral only, per explicit request -- falls back to the page number if
                // context is unavailable or nothing's indexed yet.
                val siman = contemporaryContext?.let { resolvedContemporarySiman(it) } ?: contemporaryPage
                if (saHebrewMode) SASimanNames.toHebrewNumeral(siman) else "$siman"
            } else {
                // Volume (when present) has its own pill -- see navVolumeTitle -- so this stays
                // siman-only rather than repeating it here. Hebrew mode drops the "סי׳" symbol
                // too -- bare numeral, matching the volume pill's compact style.
                if (saHebrewMode) SASimanNames.toHebrewNumeral(teshuvotSiman) else "§$teshuvotSiman"
            }
        }
    }

    // MARK: - Load

    fun load() {
        // Contemporary Teshuvot's PDF-based works (Iggros Moshe) use a plain image pager
        // (TeshuvotPageManager, ContemporaryTeshuvotPageView) -- there's no Sefaria text to
        // fetch. Contemporary's Sefaria-digitized works (Mishpetei Uziel etc.) fall through to
        // the ordinary TESHUVOT branch below instead, via contemporaryUsesSefaria.
        if (category == TextCategory.TESHUVOT && teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !contemporaryUsesSefaria) {
            isLoading = false
            error = null
            return
        }

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
                    TextCategory.TUR -> {
                        // Phase 1 stub: naive per-seif segmentation, no header-splitting or
                        // paragraph-merging (a separate later phase handles that).
                        val r = SefariaTextClient.ref(TextCategory.TUR, turSection, turSiman)
                        currentRef = r
                        segments = SefariaTextClient.fetchChapter(TextCategory.TUR, turSection, turSiman)
                    }
                    TextCategory.SHULCHAN_ARUKH -> {
                        val r = SefariaTextClient.ref(TextCategory.SHULCHAN_ARUKH, saSection, saSiman)
                        currentRef = r

                        // Fire-and-forget: fetch related YCT pieces for this siman, without
                        // blocking the main text/commentary fetch below. Guarded by comparing
                        // captured vs. current saSection/saSiman (no loadGeneration equivalent
                        // on Android) so a stale response from a since-superseded load can't
                        // clobber a newer one's result.
                        val sectionAtFetch = saSection
                        val simanAtFetch = saSiman
                        relatedYCTPieces = emptyList()
                        viewModelScope.launch {
                            val pieces = YCTRelatedArticlesService.relatedPieces(sectionAtFetch, simanAtFetch)
                            if (sectionAtFetch == saSection && simanAtFetch == saSiman) relatedYCTPieces = pieces
                        }

                        segments = SefariaTextClient.fetchChapter(TextCategory.SHULCHAN_ARUKH, saSection, saSiman,
                            selectedCommentaries = availableCommentaries, saTextMode = saTextMode)
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
                    TextCategory.TESHUVOT -> {
                        // Same generic-ref fetch pattern as Midrash's native-mode branch above;
                        // an occasional bad ref (e.g. an unverified per-volume siman ceiling
                        // overshooting the real count) surfaces via the existing error/Retry UI.
                        val ref = teshuvotWork.sefariaRef(teshuvotVolume, teshuvotSiman)
                        currentRef = ref
                        val (he, en) = SefariaTextClient.fetchBoth(ref)
                        val count = maxOf(he.size, en.size)
                        segments = (0 until count).mapNotNull { i ->
                            val seg = TextSegment.content(index = i, he = if (i < he.size) he[i] else "", en = if (i < en.size) en[i] else "")
                            if (seg.hebrewHTML.isEmpty() && seg.englishHTML.isEmpty()) null else seg
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

            // All 4 Tur commentaries are depth-3 (Siman → Seif → Comment); a bare siman ref
            // otherwise truncates to a single entry. Applies uniformly — unlike SA, where only
            // Shakh needs a special range.
            category == TextCategory.TUR -> "$currentRef:1-500"

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
            && category != TextCategory.RAMBAM
            && category != TextCategory.TUR) introRef(commentaryRef) else null

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

        // Beit Yosef/Bach/Prisha+Drisha each open their comment with a direct quote of the Tur
        // words they're discussing — assignTurParagraphLabels matches those opening words
        // against Tur's own Beit-Yosef-derived paragraphs to number each entry by the Tur
        // paragraph it actually comments on, instead of a generic sequential count. Darkhei
        // Moshe is excluded: it anchors via its own real data-order markers (processed inline
        // into the main text/Beit Yosef's own text), not by quote-matching, so it keeps plain
        // sequential numbering. Re-fetches Tur's own raw text and (when the open tab isn't
        // already Beit Yosef) Beit Yosef's entries independently, rather than threading them
        // through from load() — an intentional simplicity-over-micro-perf tradeoff, matching
        // the reference web implementation.
        if (category == TextCategory.TUR && selectedCommentary != CommentaryType.DARKHEI_MOSHE) {
            val (turHe, _) = runCatching { SefariaTextClient.fetchBoth(currentRef) }
                .getOrElse { Pair(emptyList(), emptyList()) }
            if (turHe.isNotEmpty()) {
                val beitYosefEntries = if (selectedCommentary == CommentaryType.BEIT_YOSEF) {
                    commentaryEntries
                } else {
                    runCatching { SefariaTextClient.fetchTurCommentaryEntries(CommentaryType.BEIT_YOSEF, currentRef) }
                        .getOrElse { emptyList() }
                }
                val paragraphs = TurParagraphEngine.fetchTurParagraphPlainList(turHe) { beitYosefEntries }
                var labeled = TurParagraphEngine.assignTurParagraphLabels(commentaryEntries, paragraphs)

                // Darkhei Moshe sometimes anchors on Beit Yosef's own words rather than Tur's —
                // labels must be assigned first (above), using the *original* entries, so an
                // inserted <dm> digit never ends up among the "opening words" the paragraph
                // matcher searches with.
                if (selectedCommentary == CommentaryType.BEIT_YOSEF) {
                    val marks = TurParagraphEngine.computeBeitYosefDarkheiMosheMarks(turHe, labeled) {
                        runCatching { SefariaTextClient.fetchTurCommentaryEntries(CommentaryType.DARKHEI_MOSHE, currentRef) }
                            .getOrElse { emptyList() }
                    }
                    if (marks.isNotEmpty()) {
                        labeled = labeled.mapIndexed { i, entry ->
                            val n = marks[i]
                            if (entry is CommentaryEntry.Text && n != null) {
                                entry.copy(he = TurParagraphEngine.insertBeitYosefDarkheiMosheMark(entry.he, n))
                            } else entry
                        }
                    }
                }
                commentaryEntries = labeled
            }
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
        TextCategory.TUR -> turSiman == 1
        TextCategory.SHULCHAN_ARUKH -> saSiman == 1
        TextCategory.MIDRASH -> if (midrashNavigationMode == MidrashNavigationMode.NATIVE)
            midrashNativeChapter == 1 && midrashNativeSection == 1
        else midrashChapter == 1 && midrashVerse == 1
        TextCategory.TESHUVOT -> teshuvotVolume == 1 && teshuvotSiman == 1
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
                TextCategory.TUR -> {
                    if (turSiman > 1) turSiman -= 1
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
                TextCategory.TESHUVOT -> {
                    if (teshuvotSiman > 1) {
                        teshuvotSiman -= 1
                    } else if (teshuvotWork.volumeLabel != null && teshuvotVolume > 1) {
                        teshuvotVolume -= 1
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
                TextCategory.TUR -> {
                    val maxSiman = TextCatalog.turSections.getOrNull(turSection)?.simanim ?: 1
                    if (turSiman < maxSiman) turSiman += 1
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
                TextCategory.TESHUVOT -> {
                    if (teshuvotSiman < teshuvotWork.maxSiman(teshuvotVolume)) {
                        teshuvotSiman += 1
                    } else if (teshuvotWork.volumeLabel != null && teshuvotVolume < teshuvotWork.volumeCount) {
                        teshuvotVolume += 1
                        teshuvotSiman = 1
                    }
                }
            }
            load()
        }
    }

    // MARK: - Bookmark helpers

    fun createBookmark(): Bookmark = Bookmark(
        category = category,
        mishnahSubcategoryId = mishnahSubcategory.id,
        talmudSubcategoryId = talmudSubcategory.id,
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
        turSection = turSection,
        turSiman = turSiman,
        midrashSubcategoryId = midrashSubcategory.id,
        midrashWorkId = midrashWork.id,
        midrashBookIndex = midrashBookIndex,
        midrashChapter = midrashChapter,
        midrashVerse = midrashVerse,
        teshuvotSubcategoryId = teshuvotSubcategory.id,
        teshuvotWorkId = teshuvotWork.id,
        teshuvotVolume = teshuvotVolume,
        teshuvotSiman = teshuvotSiman,
        name = displayTitle,
        subtitle = "$categoryDisplayName · $displayTitle"
    )

    fun applyBookmark(bookmark: Bookmark) {
        category = bookmark.category
        mishnahSubcategory = MishnahSubcategory.fromId(bookmark.mishnahSubcategoryId)
        talmudSubcategory = TalmudSubcategory.fromId(bookmark.talmudSubcategoryId)
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
        turSection = bookmark.turSection
        turSiman = bookmark.turSiman
        midrashSubcategory = MidrashSubcategory.fromId(bookmark.midrashSubcategoryId)
        midrashWork = MidrashWork.fromId(bookmark.midrashWorkId)
        midrashBookIndex = bookmark.midrashBookIndex
        midrashChapter = bookmark.midrashChapter
        midrashVerse = bookmark.midrashVerse
        teshuvotSubcategory = TeshuvotSubcategory.fromId(bookmark.teshuvotSubcategoryId)
        teshuvotWork = TeshuvotWork.fromId(bookmark.teshuvotWorkId)
        teshuvotVolume = bookmark.teshuvotVolume
        teshuvotSiman = bookmark.teshuvotSiman
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
