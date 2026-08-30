package com.anytorah.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.api.TalmudAudioService
import com.anytorah.audio.AudioPlayer
import com.anytorah.models.ContemporaryTeshuvotVolume
import com.anytorah.models.ContemporaryTeshuvotWork
import com.anytorah.models.MidrashWork
import com.anytorah.models.SASimanNames
import com.anytorah.models.SATopicSection
import com.anytorah.models.TextCatalog
import com.anytorah.models.TextCategory
import com.anytorah.models.TextDisplayMode
import com.anytorah.models.TeshuvotSubcategory
import com.anytorah.models.TeshuvotWork
import com.anytorah.api.TeshuvotPageManager
import com.anytorah.ui.components.WheelPicker
import com.anytorah.ui.panels.AudioPlayerPanel
import com.anytorah.ui.panels.CommentaryPanel
import com.anytorah.ui.panels.TextContentPanel
import com.anytorah.ui.theme.AnyTorahColors
import com.anytorah.ui.theme.EditorialIndigo
import com.anytorah.ui.theme.LocalAnyTorahColors
import androidx.compose.ui.graphics.Color
import com.anytorah.viewmodels.TextReaderViewModel
import kotlinx.coroutines.launch

enum class ActiveSheet { SELECTOR, SETTINGS, BOOKMARKS, BOOKMARK_EDIT, CHAPTER_PICKER, BOOK_PICKER, VOLUME_PICKER }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TextReaderScreen(
    vm: TextReaderViewModel,
    audioPlayer: AudioPlayer,
    onBack: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val scope = rememberCoroutineScope()
    val bookmarks by vm.bookmarkManager.bookmarks.collectAsState()
    // Needed for Contemporary Teshuvot's reverse siman lookup (vm.navChapterTitle) and its
    // page-image manifest (TeshuvotPageManager) -- both read a bundled Android asset.
    val context = LocalContext.current
    // Bypasses the whole Sefaria text/commentary/audio pipeline below (Row 2's display-mode
    // pill and commentary toggle, Row 3's audio player, the segment-based text content area) --
    // matches iOS's equivalent hard branch in TextReaderView.body. See load()'s early-return
    // guard and ContemporaryTeshuvotPageView.
    val isContemporary = vm.category == TextCategory.TESHUVOT && vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY

    var activeSheet by remember { mutableStateOf<ActiveSheet?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Audio availability for Talmud
    var audioUrl by remember { mutableStateOf<String?>(null) }
    var isCheckingAudio by remember { mutableStateOf(false) }

    // Load text on entry
    LaunchedEffect(Unit) {
        if (vm.segments.isEmpty() && !vm.isLoading) {
            vm.load()
        }
    }

    // Check audio availability when Talmud daf changes (Bavli only — no shiur audio for Yerushalmi)
    LaunchedEffect(vm.category, vm.talmudSubcategory, vm.talmudDaf, vm.globalTalmudTractateIndex) {
        if (vm.isTalmudBavli) {
            audioPlayer.stop()
            audioUrl = null
            isCheckingAudio = true
            val tractate = vm.currentTalmudTractate
            if (tractate != null) {
                audioUrl = TalmudAudioService.audioUrl(tractate.name, vm.talmudDaf)
            }
            isCheckingAudio = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.appBackground)
    ) {
        // Row 1: [Bookmark, Bookmarks, List] | Pills (fill remaining width) | Settings.
        // A single flat Row, not three overlaid Box-aligned rows — the pills cluster gets every
        // dp of space the two icon clusters don't need, rather than a guessed symmetric inset
        // (previously a flat 88dp each side, which under- or over-estimated the icon clusters'
        // real width depending on device/content and just wasted room a long work title, e.g.
        // "Teshuvot Rabbi Akiva Eiger", could have used).
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: bookmark, bookmarks list, selector. The first two are shrunk to 40.dp (from
            // IconButton's default 48.dp touch target) and grouped in their own Row so they sit
            // visibly closer together, since they're functionally related; selector (unrelated —
            // opens the full book/chapter picker) keeps the default size and a normal gap.
            Row {
                Row {
                    IconButton(
                        onClick = { activeSheet = ActiveSheet.BOOKMARK_EDIT },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            Icons.Default.BookmarkBorder,
                            contentDescription = "Save bookmark",
                            tint = colors.editorialColor
                        )
                    }
                    IconButton(
                        onClick = { activeSheet = ActiveSheet.BOOKMARKS },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.List,
                            contentDescription = "Bookmarks",
                            tint = colors.appForeground
                        )
                    }
                }
                // Teshuvot's book/volume/siman pills already give full navigation on their own
                // (tap any pill to jump straight to that level) -- the separate combined
                // selector sheet is redundant for it, per explicit request. Matches iOS.
                if (vm.category != TextCategory.TESHUVOT) {
                    IconButton(onClick = { activeSheet = ActiveSheet.SELECTOR }) {
                        Icon(
                            Icons.Default.MenuBook,
                            contentDescription = "Selector",
                            tint = colors.appForeground
                        )
                    }
                }
            }

            // Nav pills — fills whatever width is left between the two icon clusters. In Hebrew
            // mode the layout flips RTL so book name sits on the right.
            CompositionLocalProvider(
                LocalLayoutDirection provides if (vm.saHebrewMode) LayoutDirection.Rtl else LayoutDirection.Ltr
            ) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Book / tractate / work pill → opens in-reader list picker. Left unweighted (and
                // therefore measured before the weighted volume/chapter pills below — Compose's
                // Row measures non-weighted children first, each getting its full natural width)
                // so a long work name always renders in full; the volume/chapter pills are the
                // ones that give up space when the row is tight.
                TextButton(
                    onClick = { activeSheet = ActiveSheet.BOOK_PICKER },
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.textButtonColors(
                        containerColor = colors.appForeground.copy(alpha = 0.12f)
                    ),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = vm.navBookTitle,
                        color = colors.appForeground,
                        fontSize = if (vm.category == TextCategory.TALMUD) 18.sp else 13.sp,
                        fontWeight = if (vm.category == TextCategory.TALMUD) FontWeight.Bold else FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                // Teshuvot only, and only for works with a volume level (Rashba's Part, Rosh's
                // Klal, etc.) -- a dedicated step between the work pill and the siman pill,
                // rather than requiring the separate full selector sheet to reach it.
                val navVolumeTitle = vm.navVolumeTitle
                if (vm.category == TextCategory.TESHUVOT && navVolumeTitle != null) {
                    TextButton(
                        onClick = { activeSheet = ActiveSheet.VOLUME_PICKER },
                        modifier = Modifier.weight(1f, fill = false),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.textButtonColors(
                            containerColor = colors.appForeground.copy(alpha = 0.12f)
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = navVolumeTitle,
                            color = colors.appForeground,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                // Chapter / daf / siman pill → opens quick number picker
                TextButton(
                    onClick = { activeSheet = ActiveSheet.CHAPTER_PICKER },
                    modifier = Modifier.weight(1f, fill = false),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.textButtonColors(
                        containerColor = colors.appForeground.copy(alpha = 0.12f)
                    ),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = vm.navChapterTitle(context),
                        color = colors.appForeground,
                        fontSize = if (vm.category == TextCategory.TALMUD) 18.sp else 13.sp,
                        fontWeight = if (vm.category == TextCategory.TALMUD) FontWeight.Bold else FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            } // end CompositionLocalProvider

            // Right: Settings
            IconButton(onClick = { activeSheet = ActiveSheet.SETTINGS }) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = colors.appForeground)
            }
        }

        // Row 2: Back | Language pill | Commentary toggle -- none of this applies to
        // Contemporary Teshuvot (no display mode, no commentary, content navigation happens
        // via the image pager's own gestures/edge taps instead).
        if (!isContemporary) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { vm.navigatePrevious() }) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Previous",
                    tint = colors.appForeground
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            // Language pill: א / A / אA
            DisplayModePill(vm = vm)

            if (vm.isTalmudBavli) {
                Spacer(modifier = Modifier.width(8.dp))
                TalmudAmudPill(vm = vm)
            }

            Spacer(modifier = Modifier.weight(1f))

            // Commentary toggle
            TextButton(
                onClick = {
                    vm.updateCommentaryVisible(!vm.commentaryVisible)
                    if (vm.commentaryVisible) {
                        scope.launch { vm.loadCommentary() }
                    }
                }
            ) {
                Text(
                    "פרשנות",
                    color = if (vm.commentaryVisible) colors.editorialColor else colors.appForeground.copy(alpha = 0.5f),
                    fontSize = 14.sp,
                    fontWeight = if (vm.commentaryVisible) FontWeight.SemiBold else FontWeight.Normal
                )
            }
        }

        HorizontalDivider(color = colors.dividerColor)
        }

        // Row 3 (Talmud Bavli only): Audio player
        if (vm.isTalmudBavli) {
            AudioPlayerPanel(
                audioPlayer = audioPlayer,
                onPlay = {
                    val url = audioUrl ?: return@AudioPlayerPanel
                    val tractate = vm.currentTalmudTractate?.name ?: "Talmud"
                    audioPlayer.play(url, "$tractate ${vm.talmudDaf}")
                },
                isAvailable = audioUrl != null,
                isCheckingAvailability = isCheckingAudio
            )
            HorizontalDivider(color = colors.dividerColor)
        }

        // Text content area
        Box(modifier = Modifier.weight(1f)) {
            when {
                isContemporary -> {
                    ContemporaryTeshuvotContent(vm = vm, fg = colors.appForeground)
                }
                vm.isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = colors.editorialColor
                    )
                }
                vm.error != null -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Error loading text",
                            color = colors.appForeground,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = vm.error ?: "",
                            color = colors.secondaryText,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                        TextButton(onClick = { vm.load() }) {
                            Text("Retry", color = colors.editorialColor)
                        }
                    }
                }
                vm.segments.isEmpty() -> {
                    Text(
                        text = "No text loaded",
                        color = colors.secondaryText,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    var bottomFraction by remember { mutableFloatStateOf(0.40f) }
                    var columnHeightPx by remember { mutableFloatStateOf(0f) }
                    val colors = LocalAnyTorahColors.current

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .onGloballyPositioned { coords -> columnHeightPx = coords.size.height.toFloat() }
                    ) {
                        TextContentPanel(
                            segments = vm.segments,
                            displayMode = vm.displayMode,
                            scrollToVerse = if (vm.category == TextCategory.MIDRASH) vm.midrashScrollToIndex else vm.tanakhScrollToVerse,
                            onScrollToVerseConsumed = { if (vm.category == TextCategory.MIDRASH) vm.midrashScrollToIndex = null else vm.tanakhScrollToVerse = null },
                            scrollToAmudB = vm.talmudScrollToAmudB,
                            onScrollToAmudBConsumed = { vm.talmudScrollToAmudB = false },
                            useBoldHighlight = vm.category != TextCategory.TANAKH,
                            fontSizeLevel = vm.fontSizeLevel,
                            showTrop = vm.showTrop,
                            isTanakh = vm.category == TextCategory.TANAKH,
                            modifier = Modifier.weight(if (vm.commentaryVisible) 1f - bottomFraction else 1f)
                        )

                        if (vm.commentaryVisible) {
                            // Draggable horizontal split divider
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(20.dp)
                                    .pointerInput(Unit) {
                                        detectVerticalDragGestures { _, dragAmount ->
                                            if (columnHeightPx > 0f) {
                                                val delta = dragAmount / columnHeightPx
                                                bottomFraction = (bottomFraction - delta).coerceIn(0.15f, 0.65f)
                                            }
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                HorizontalDivider(
                                    color = colors.appForeground.copy(alpha = 0.18f),
                                    thickness = 1.dp
                                )
                                Box(
                                    modifier = Modifier
                                        .width(44.dp)
                                        .height(5.dp)
                                        .background(
                                            color = colors.appForeground.copy(alpha = 0.55f),
                                            shape = CircleShape
                                        )
                                )
                            }

                            // Commentary — fills its fraction of the column height
                            val useLightPanel = vm.sidePanelContrast && !vm.useWhiteBackground
                            val lightPanelColors = AnyTorahColors(
                                appBackground   = Color(0xFFEDF2FC),
                                appForeground   = Color(0xFF1B3A8A),
                                editorialColor  = EditorialIndigo,
                                cardBackground  = Color(0xFFDDE5F8),
                                dividerColor    = Color(0xFFBBCCEE),
                                secondaryText   = Color(0xFF334488),
                                isLight         = true
                            )
                            val panelModifier = Modifier.weight(bottomFraction)
                            if (useLightPanel) {
                                CompositionLocalProvider(LocalAnyTorahColors provides lightPanelColors) {
                                    CommentaryPanel(
                                        vm = vm,
                                        onLoadCommentary = { scope.launch { vm.loadCommentary() } },
                                        fontSizeLevel = vm.fontSizeLevel,
                                        modifier = panelModifier
                                    )
                                }
                            } else {
                                CommentaryPanel(
                                    vm = vm,
                                    onLoadCommentary = { scope.launch { vm.loadCommentary() } },
                                    fontSizeLevel = vm.fontSizeLevel,
                                    modifier = panelModifier
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Sheet management
    if (activeSheet != null) {
        ModalBottomSheet(
            onDismissRequest = { activeSheet = null },
            sheetState = sheetState,
            containerColor = colors.cardBackground
        ) {
            when (activeSheet) {
                ActiveSheet.SETTINGS -> {
                    SettingsScreen(
                        vm = vm,
                        onDismiss = { activeSheet = null }
                    )
                }
                ActiveSheet.BOOKMARKS -> {
                    BookmarkListScreen(
                        bookmarks = bookmarks,
                        onSelect = { bookmark ->
                            activeSheet = null
                            vm.applyBookmark(bookmark)
                        },
                        onDelete = { vm.bookmarkManager.delete(it.id) },
                        onDismiss = { activeSheet = null }
                    )
                }
                ActiveSheet.BOOKMARK_EDIT -> {
                    BookmarkEditSheet(
                        initialBookmark = vm.createBookmark(),
                        onSave = { bookmark ->
                            vm.bookmarkManager.add(bookmark)
                            activeSheet = null
                        },
                        onDismiss = { activeSheet = null }
                    )
                }
                ActiveSheet.SELECTOR -> {
                    // TextSelectorScreen's own "Read" button already calls vm.load()
                    // before invoking onRead — just dismiss the sheet here.
                    TextSelectorScreen(
                        vm = vm,
                        onRead = { activeSheet = null },
                        showHeader = true
                    )
                }
                ActiveSheet.CHAPTER_PICKER -> {
                    ChapterPickerSheet(vm = vm, onDone = {
                        activeSheet = null
                        vm.load()
                    })
                }
                ActiveSheet.BOOK_PICKER -> {
                    BookPickerSheet(vm = vm, onSelect = {
                        if (isContemporary) {
                            // Every Contemporary work has a real volume level worth surfacing
                            // immediately -- always chain into the volume picker, unlike
                            // Rishonim/Acharonim's volumeLabel != null gate below.
                            activeSheet = ActiveSheet.VOLUME_PICKER
                        } else if (vm.category == TextCategory.TESHUVOT && vm.teshuvotWork.volumeLabel != null) {
                            // Chain straight into the volume picker instead of loading Volume 1
                            // first and making the user separately discover that pill.
                            activeSheet = ActiveSheet.VOLUME_PICKER
                        } else {
                            activeSheet = null
                            vm.load()
                        }
                    })
                }
                ActiveSheet.VOLUME_PICKER -> {
                    VolumePickerSheet(vm = vm, onDone = {
                        activeSheet = null
                        vm.load()
                    })
                }
                null -> {}
            }
        }
    }
}

@Composable
private fun ChapterPickerSheet(vm: TextReaderViewModel, onDone: () -> Unit) {
    // SA and Tur get their own full-list pickers
    if (vm.category == TextCategory.SHULCHAN_ARUKH) {
        SASimanPickerContent(vm = vm, onSelect = onDone)
        return
    } else if (vm.category == TextCategory.TUR) {
        TurSimanPickerContent(vm = vm, onSelect = onDone)
        return
    }

    val colors = LocalAnyTorahColors.current
    val label = when (vm.category) {
        TextCategory.TALMUD   -> "Select Daf"
        TextCategory.TESHUVOT -> "Select Siman"
        else                  -> "Select Chapter"
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                color = colors.appForeground,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onDone) {
                Text("Done", color = colors.editorialColor, fontWeight = FontWeight.SemiBold)
            }
        }

        HorizontalDivider(color = colors.dividerColor)

        // Number wheel
        val useHe = vm.saHebrewMode
        when (vm.category) {
            TextCategory.TANAKH -> {
                val count = (vm.currentTanakhBook?.chapters ?: 1).coerceAtLeast(1)
                WheelPicker(
                    items = (1..count).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() },
                    selectedIndex = (vm.tanakhChapter - 1).coerceIn(0, count - 1),
                    onIndexSelected = { vm.tanakhChapter = it + 1 },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            TextCategory.MISHNAH -> {
                val count = (vm.currentMishnahTractate?.chapters ?: 1).coerceAtLeast(1)
                WheelPicker(
                    items = (1..count).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() },
                    selectedIndex = (vm.mishnahChapter - 1).coerceIn(0, count - 1),
                    onIndexSelected = { vm.mishnahChapter = it + 1 },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            TextCategory.TALMUD -> {
                val start = vm.currentTalmudTractate?.startDaf ?: 2
                val end   = vm.currentTalmudTractate?.endDaf ?: 2
                WheelPicker(
                    items = (start..end).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() },
                    selectedIndex = (vm.talmudDaf - start).coerceIn(0, end - start),
                    onIndexSelected = { vm.talmudDaf = start + it },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            TextCategory.RAMBAM -> {
                val count = (vm.currentRambamWork?.chapters ?: 1).coerceAtLeast(1)
                val hasIntro = vm.rambamHasIntro
                val introLabel = if (useHe) "הקדמה" else "Intro"
                val chapterLabels = (1..count).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() }
                val items = if (hasIntro) listOf(introLabel) + chapterLabels else chapterLabels
                // selectedIndex: intro is index 0 when present, chapters start at index (if hasIntro then 1 else 0)
                val offset = if (hasIntro) 1 else 0
                val selectedIndex = if (vm.rambamChapter == 0 && hasIntro) 0
                                    else (vm.rambamChapter - 1 + offset).coerceIn(0, items.size - 1)
                WheelPicker(
                    items = items,
                    selectedIndex = selectedIndex,
                    onIndexSelected = { idx ->
                        vm.rambamChapter = if (hasIntro) idx else idx + 1
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            TextCategory.TESHUVOT -> {
                if (vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY) {
                    // Selecting a siman jumps contemporaryPage to that siman's indexed page
                    // (see TeshuvotPageManager.page) rather than storing the siman itself --
                    // page, not siman, is Contemporary's real navigable unit, since the index
                    // is a hand-maintained best-effort lookup, not guaranteed page-perfect.
                    val context = LocalContext.current
                    val simanCount = vm.contemporaryVolume.simanCount.coerceAtLeast(1)
                    var selectedSiman by remember(vm.contemporaryVolume.id) { mutableStateOf(1) }
                    WheelPicker(
                        items = (1..simanCount).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() },
                        selectedIndex = (selectedSiman - 1).coerceIn(0, simanCount - 1),
                        onIndexSelected = { idx ->
                            val siman = idx + 1
                            selectedSiman = siman
                            TeshuvotPageManager.page(context, vm.contemporaryVolume.id, siman)?.let {
                                vm.setContemporaryPage(it)
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    // Siman only -- volume (when the work has one) gets its own pill/sheet, see
                    // VolumePickerSheet.
                    val maxSiman = vm.teshuvotWork.maxSiman(vm.teshuvotVolume)
                    WheelPicker(
                        items = (1..maxSiman).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() },
                        selectedIndex = (vm.teshuvotSiman - 1).coerceIn(0, maxSiman - 1),
                        onIndexSelected = { vm.teshuvotSiman = it + 1 },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
            else -> {} // SA handled above
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

/** A dedicated step between the work pill and the siman pill for Teshuvot works that have a
 *  volume level (Rashba's Part, Rosh's Klal, Terumat HaDeshen's Part, Sefer HaTashbetz's
 *  Chelek). Mirrors [ChapterPickerSheet]'s shape but shows each volume's real display label
 *  ([TeshuvotWork.volumeDisplayLabel]) rather than a bare wheel position, since that position
 *  doesn't always equal the label (Rashba's wheel position 2 is Part IV, not II). */
@Composable
private fun VolumePickerSheet(vm: TextReaderViewModel, onDone: () -> Unit) {
    if (vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY) {
        ContemporaryVolumePickerSheet(vm = vm, onDone = onDone)
        return
    }
    val colors = LocalAnyTorahColors.current
    val englishLabel = vm.teshuvotWork.volumeLabel ?: "Volume"
    val label = if (vm.saHebrewMode) vm.teshuvotWork.volumeLabelHebrew ?: englishLabel else englishLabel
    val count = vm.teshuvotWork.volumeCount

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Select $label",
                color = colors.appForeground,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onDone) {
                Text("Done", color = colors.editorialColor, fontWeight = FontWeight.SemiBold)
            }
        }

        HorizontalDivider(color = colors.dividerColor)

        // The wheel row's own bidi resolution doesn't reorder this the way plain RTL text
        // would -- verified on-device the numeral stays visually on the right unless it's
        // placed first in typed order. So for Hebrew mode the numeral is typed before the
        // label ("ד חלק"), landing it on the left, where English types the label first
        // ("Part IV"). The generic word is dropped entirely when the volume labels aren't
        // plain numbers -- "Kamma"/"EH I" already read fine on their own; only "Part IV"-style
        // needs it.
        WheelPicker(
            items = (1..count).map { v ->
                val numeral = if (vm.saHebrewMode) vm.teshuvotWork.volumeDisplayLabelHebrew(v) else vm.teshuvotWork.volumeDisplayLabel(v)
                if (!vm.teshuvotWork.volumeLabelIsNumeric) numeral
                else if (vm.saHebrewMode) "$numeral $label" else "$label $numeral"
            },
            selectedIndex = (vm.teshuvotVolume - 1).coerceIn(0, count - 1),
            onIndexSelected = { vm.teshuvotVolume = it + 1 },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun ContemporaryVolumePickerSheet(vm: TextReaderViewModel, onDone: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Select Volume",
                color = colors.appForeground,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onDone) {
                Text("Done", color = colors.editorialColor, fontWeight = FontWeight.SemiBold)
            }
        }
        HorizontalDivider(color = colors.dividerColor)
        LazyColumn(modifier = Modifier.fillMaxWidth()) {
            items(vm.contemporaryWork.volumes) { volume ->
                BookPickerRow(
                    name = if (vm.saHebrewMode) volume.hebrewLabel else volume.label,
                    isSelected = volume.id == vm.contemporaryVolume.id,
                    onClick = {
                        vm.setContemporaryVolume(volume)
                        onDone()
                    }
                )
                HorizontalDivider(color = colors.dividerColor)
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SASimanPickerContent(vm: TextReaderViewModel, onSelect: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    val useHe = vm.saHebrewMode
    CompositionLocalProvider(
        LocalLayoutDirection provides if (useHe) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        for (bookIdx in 0..3) {
            val book = TextCatalog.shulchanArukhSections.getOrNull(bookIdx) ?: continue
            val sections = saBookSections(bookIdx)
            stickyHeader {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(colors.cardBackground)
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = if (useHe) book.hebrewName.strippingNikud() else book.name,
                        color = colors.appForeground,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            for ((sIdx, sec) in sections.withIndex()) {
                item {
                    Text(
                        text = if (useHe) SASimanNames.sectionHebName(bookIdx, sIdx) ?: sec.name else sec.name,
                        color = colors.appForeground.copy(alpha = 0.4f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 20.dp, top = 6.dp, bottom = 2.dp, end = 16.dp)
                    )
                }
                for (siman in sec.start..sec.end) {
                    item {
                        val isSelected = vm.saSection == bookIdx && vm.saSiman == siman
                        val numStr = if (useHe) SASimanNames.toHebrewNumeral(siman) else "§$siman"
                        val name = if (useHe) SASimanNames.simanName(bookIdx, siman) else SASimanNames.simanNameEn(bookIdx, siman)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { vm.saSection = bookIdx; vm.saSiman = siman; onSelect() }
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = numStr,
                                color = colors.appForeground.copy(alpha = 0.5f),
                                fontSize = 12.sp,
                                modifier = Modifier.width(36.dp),
                                textAlign = TextAlign.End
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = name ?: if (useHe) "סימן $siman" else "Siman $siman",
                                color = colors.appForeground,
                                fontSize = 14.sp,
                                modifier = Modifier.weight(1f)
                            )
                            if (isSelected) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = colors.appForeground,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                        HorizontalDivider(color = colors.dividerColor)
                    }
                }
            }
        }
    }
    } // end CompositionLocalProvider
}

private fun saBookSections(bookIdx: Int): List<SATopicSection> = when (bookIdx) {
    0 -> SASimanNames.sectionsOH
    1 -> SASimanNames.sectionsYD
    2 -> SASimanNames.sectionsEH
    3 -> SASimanNames.sectionsHM
    else -> emptyList()
}

/**
 * Tur's own siman picker — a close copy of [SASimanPickerContent] reading [TextCatalog.turSections]
 * / [TextReaderViewModel.turSection] / [TextReaderViewModel.turSiman] instead of the SA fields.
 * Reuses [SASimanNames]'s topic-section/name lookups (they take a raw bookIndex, not SA-specific),
 * but clamps Choshen Mishpat (Tur section index 3) to Tur's real max of 426 simanim — one less
 * than SA's own Choshen Mishpat (427) that SASimanNames' section/name tables assume. Siman 427
 * must never appear or be selectable for Tur's Choshen Mishpat.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TurSimanPickerContent(vm: TextReaderViewModel, onSelect: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    val useHe = vm.saHebrewMode
    CompositionLocalProvider(
        LocalLayoutDirection provides if (useHe) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        for (bookIdx in 0..3) {
            val book = TextCatalog.turSections.getOrNull(bookIdx) ?: continue
            val maxSiman = book.simanim // Tur's real max — clamps Choshen Mishpat to 426
            val sections = saBookSections(bookIdx)
            stickyHeader {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(colors.cardBackground)
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = if (useHe) book.hebrewName.strippingNikud() else book.name,
                        color = colors.appForeground,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            for ((sIdx, sec) in sections.withIndex()) {
                if (sec.start > maxSiman) continue // section entirely beyond Tur's range (CM only)
                val sectionEnd = minOf(sec.end, maxSiman)
                item {
                    Text(
                        text = if (useHe) SASimanNames.sectionHebName(bookIdx, sIdx) ?: sec.name else sec.name,
                        color = colors.appForeground.copy(alpha = 0.4f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 20.dp, top = 6.dp, bottom = 2.dp, end = 16.dp)
                    )
                }
                for (siman in sec.start..sectionEnd) {
                    item {
                        val isSelected = vm.turSection == bookIdx && vm.turSiman == siman
                        val numStr = if (useHe) SASimanNames.toHebrewNumeral(siman) else "§$siman"
                        val name = if (useHe) SASimanNames.simanName(bookIdx, siman) else SASimanNames.simanNameEn(bookIdx, siman)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { vm.turSection = bookIdx; vm.turSiman = siman; onSelect() }
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = numStr,
                                color = colors.appForeground.copy(alpha = 0.5f),
                                fontSize = 12.sp,
                                modifier = Modifier.width(36.dp),
                                textAlign = TextAlign.End
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = name ?: if (useHe) "סימן $siman" else "Siman $siman",
                                color = colors.appForeground,
                                fontSize = 14.sp,
                                modifier = Modifier.weight(1f)
                            )
                            if (isSelected) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = colors.appForeground,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                        HorizontalDivider(color = colors.dividerColor)
                    }
                }
            }
        }
    }
    } // end CompositionLocalProvider
}

private fun String.strippingNikud(): String = filter { c -> c.code < 0x0591 || c.code > 0x05C7 }

@Composable
private fun BookPickerSheet(vm: TextReaderViewModel, onSelect: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    val useHe = vm.saHebrewMode
    CompositionLocalProvider(
        LocalLayoutDirection provides if (useHe) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        when (vm.category) {
            TextCategory.TANAKH -> {
                itemsIndexed(TextCatalog.allTanakhBooks) { idx, book ->
                    BookPickerRow(
                        name = if (useHe) book.hebrewName.strippingNikud() else book.name,
                        isSelected = vm.tanakhBookIndex == idx,
                        onClick = { vm.setTanakhBook(idx); onSelect() }
                    )
                    HorizontalDivider(color = colors.dividerColor)
                }
            }
            TextCategory.MISHNAH -> {
                TextCatalog.mishnahSedarim.forEachIndexed { si, seder ->
                    item { BookPickerSectionHeader(if (useHe) seder.hebrewName.strippingNikud() else seder.name) }
                    itemsIndexed(seder.tractates) { ti, tractate ->
                        BookPickerRow(
                            name = if (useHe) tractate.hebrewName.strippingNikud() else tractate.name,
                            isSelected = vm.mishnahSederIndex == si && vm.mishnahTractateIndexInSeder == ti,
                            onClick = { vm.setMishnahSeder(si); vm.setMishnahTractate(ti); onSelect() }
                        )
                        HorizontalDivider(color = colors.dividerColor)
                    }
                }
            }
            TextCategory.TALMUD -> {
                TextCatalog.talmudSedarim.forEachIndexed { si, seder ->
                    item { BookPickerSectionHeader(if (useHe) seder.hebrewName.strippingNikud() else seder.name) }
                    itemsIndexed(seder.tractates) { ti, tractate ->
                        BookPickerRow(
                            name = if (useHe) tractate.hebrewName.strippingNikud() else tractate.name,
                            isSelected = vm.talmudSederIndex == si && vm.talmudTractateIndexInSeder == ti,
                            onClick = { vm.setTalmudSeder(si); vm.setTalmudTractate(ti); onSelect() }
                        )
                        HorizontalDivider(color = colors.dividerColor)
                    }
                }
            }
            TextCategory.RAMBAM -> {
                TextCatalog.rambamSefarim.forEachIndexed { si, sefer ->
                    item { BookPickerSectionHeader(if (useHe) sefer.hebrewName.strippingNikud() else sefer.name) }
                    itemsIndexed(sefer.works) { wi, work ->
                        BookPickerRow(
                            name = if (useHe) work.hebrewName.strippingNikud() else work.name,
                            isSelected = vm.rambamSeferIndex == si && vm.rambamWorkIndexInSefer == wi,
                            onClick = { vm.setRambamSefer(si); vm.setRambamWork(wi); onSelect() }
                        )
                        HorizontalDivider(color = colors.dividerColor)
                    }
                }
            }
            TextCategory.TUR -> {
                itemsIndexed(TextCatalog.turSections) { idx, section ->
                    BookPickerRow(
                        name = if (useHe) section.hebrewName.strippingNikud() else section.name,
                        isSelected = vm.turSection == idx,
                        onClick = { vm.turSection = idx; vm.turSiman = 1; onSelect() }
                    )
                    HorizontalDivider(color = colors.dividerColor)
                }
            }
            TextCategory.SHULCHAN_ARUKH -> {
                itemsIndexed(TextCatalog.shulchanArukhSections) { idx, section ->
                    BookPickerRow(
                        name = if (useHe) section.hebrewName.strippingNikud() else section.name,
                        isSelected = vm.saSection == idx,
                        onClick = { vm.saSection = idx; vm.saSiman = 1; onSelect() }
                    )
                    HorizontalDivider(color = colors.dividerColor)
                }
            }
            TextCategory.MIDRASH -> {
                val works = MidrashWork.worksFor(vm.midrashSubcategory)
                itemsIndexed(works) { _, work ->
                    BookPickerRow(
                        name = if (useHe) work.hebrewName else work.displayName,
                        isSelected = vm.midrashWork == work,
                        onClick = {
                            vm.midrashWork = work
                            if (!work.applicableBookIndices.contains(vm.midrashBookIndex)) {
                                vm.midrashBookIndex = work.applicableBookIndices.firstOrNull() ?: 1
                            }
                            vm.midrashChapter = 1; vm.midrashVerse = 1
                            onSelect()
                        }
                    )
                    HorizontalDivider(color = colors.dividerColor)
                }
            }
            TextCategory.TESHUVOT -> if (vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY) {
                // Only one work (Iggros Moshe) exists as of 2026-08-29, but built as a real
                // list, not a special case, since more are planned -- see CLAUDE.md.
                items(ContemporaryTeshuvotWork.works) { work ->
                    BookPickerRow(
                        name = if (useHe) work.hebrewDisplayName else work.name,
                        isSelected = vm.contemporaryWork.id == work.id,
                        onClick = {
                            vm.setContemporaryWork(work)
                            onSelect()
                        }
                    )
                    HorizontalDivider(color = colors.dividerColor)
                }
            } else {
                val works = TeshuvotWork.worksFor(vm.teshuvotSubcategory)
                val orderedWorks = if (vm.teshuvotAlphabeticalOrder) {
                    works.sortedBy { (if (useHe) it.hebrewName else it.displayName) }
                } else null
                if (orderedWorks != null) {
                    items(orderedWorks) { work ->
                        BookPickerRow(
                            name = "${if (useHe) work.hebrewName else work.displayName} (${if (useHe) work.edah.hebrewAbbreviation else work.edah.abbreviation})",
                            isSelected = vm.teshuvotWork == work,
                            onClick = {
                                vm.teshuvotWork = work
                                vm.teshuvotVolume = 1; vm.teshuvotSiman = 1
                                onSelect()
                            }
                        )
                        HorizontalDivider(color = colors.dividerColor)
                    }
                } else {
                    var lastCentury: String? = null
                    works.forEach { work ->
                        if (work.century != lastCentury) {
                            item { BookPickerSectionHeader(work.century) }
                            lastCentury = work.century
                        }
                        item {
                            BookPickerRow(
                                name = "${if (useHe) work.hebrewName else work.displayName} (${if (useHe) work.edah.hebrewAbbreviation else work.edah.abbreviation})",
                                isSelected = vm.teshuvotWork == work,
                                onClick = {
                                    vm.teshuvotWork = work
                                    vm.teshuvotVolume = 1; vm.teshuvotSiman = 1
                                    onSelect()
                                }
                            )
                            HorizontalDivider(color = colors.dividerColor)
                        }
                    }
                }
            }
        }
    }
    } // end CompositionLocalProvider
}

@Composable
private fun BookPickerSectionHeader(title: String) {
    val colors = LocalAnyTorahColors.current
    Text(
        text = title,
        color = colors.appForeground.copy(alpha = 0.5f),
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
    )
}

@Composable
private fun BookPickerRow(name: String, isSelected: Boolean, onClick: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = name,
            color = colors.appForeground,
            fontSize = 15.sp,
            modifier = Modifier.weight(1f)
        )
        if (isSelected) {
            Icon(
                Icons.Default.Check,
                contentDescription = null,
                tint = colors.appForeground,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
private fun TalmudAmudPill(vm: TextReaderViewModel) {
    val colors = LocalAnyTorahColors.current
    val useHe = vm.saHebrewMode
    val options = listOf(0 to (if (useHe) "א" else "a"), 1 to (if (useHe) "ב" else "b"))
    Row(
        modifier = Modifier
            .background(colors.appForeground.copy(alpha = 0.12f), RoundedCornerShape(50))
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        options.forEach { (amud, label) ->
            val isSelected = vm.talmudAmud == amud
            TextButton(
                onClick = {
                    if (vm.talmudAmud != amud) {
                        vm.talmudAmud = amud
                        if (amud == 1) {
                            vm.talmudScrollToAmudB = true
                            vm.commentaryScrollToAmudB = true
                        } else {
                            vm.tanakhScrollToVerse = 1
                            vm.commentaryScrollToAmudA = true
                        }
                    }
                },
                shape = RoundedCornerShape(50),
                colors = ButtonDefaults.textButtonColors(
                    containerColor = if (isSelected) colors.appForeground.copy(alpha = 0.25f) else Color.Transparent
                ),
                modifier = Modifier.padding(horizontal = 0.dp)
            ) {
                Text(
                    text = label,
                    color = colors.appForeground,
                    fontSize = 16.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}

@Composable
private fun DisplayModePill(vm: TextReaderViewModel) {
    val colors = LocalAnyTorahColors.current

    val options = listOf(
        TextDisplayMode.SOURCE to "א",
        TextDisplayMode.TRANSLATION to "A",
        TextDisplayMode.BOTH to "אA"
    )

    Row(
        modifier = Modifier
            .background(colors.cardBackground, androidx.compose.foundation.shape.RoundedCornerShape(20.dp))
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        options.forEach { (mode, label) ->
            val isSelected = vm.displayMode == mode
            TextButton(
                onClick = { vm.updateDisplayMode(mode) },
                modifier = Modifier.padding(horizontal = 0.dp)
            ) {
                Text(
                    text = label,
                    color = if (isSelected) colors.editorialColor else colors.appForeground.copy(alpha = 0.5f),
                    fontSize = 16.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}

/**
 * Contemporary Teshuvot's main content -- the page image plus forward/back chevron buttons.
 * Mirrors iOS's contemporaryTeshuvotContent, minus reverseNavDirection support: that setting
 * doesn't exist on Android at all yet (checked -- no equivalent anywhere in AppPreferences.kt
 * or SettingsScreen.kt, iOS-only as of this writing), so this always uses the plain left=back/
 * right=forward mapping. Porting that setting itself to Android is a separate task.
 */
@Composable
private fun ContemporaryTeshuvotContent(vm: TextReaderViewModel, fg: Color) {
    val context = LocalContext.current
    val pageCount = TeshuvotPageManager.pageCount(context, vm.contemporaryVolume.id)

    fun goPrevious() {
        if (vm.contemporaryPage > 1) vm.setContemporaryPage(vm.contemporaryPage - 1)
    }
    fun goNext() {
        if (vm.contemporaryPage < pageCount) vm.setContemporaryPage(vm.contemporaryPage + 1)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ContemporaryTeshuvotPageView(
            volume = vm.contemporaryVolume.id,
            page = vm.contemporaryPage,
            fg = fg,
            onPrevious = ::goPrevious,
            onNext = ::goNext
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp, start = 12.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (vm.contemporaryPage > 1) {
                IconButton(onClick = ::goPrevious) {
                    Icon(
                        Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDescription = "Previous page",
                        modifier = Modifier.size(36.dp),
                        tint = fg.copy(alpha = 0.35f)
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(48.dp))
            }
            Spacer(modifier = Modifier.weight(1f))
            if (vm.contemporaryPage < pageCount) {
                IconButton(onClick = ::goNext) {
                    Icon(
                        Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = "Next page",
                        modifier = Modifier.size(36.dp),
                        tint = fg.copy(alpha = 0.35f)
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(48.dp))
            }
        }
    }
}
