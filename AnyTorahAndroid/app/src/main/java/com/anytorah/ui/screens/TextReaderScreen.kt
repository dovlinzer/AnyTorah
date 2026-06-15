package com.anytorah.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Bookmarks
import androidx.compose.material.icons.filled.Check
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.api.TalmudAudioService
import com.anytorah.audio.AudioPlayer
import com.anytorah.models.MidrashWork
import com.anytorah.models.SASimanNames
import com.anytorah.models.SATopicSection
import com.anytorah.models.TextCatalog
import com.anytorah.models.TextCategory
import com.anytorah.models.TextDisplayMode
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

enum class ActiveSheet { SELECTOR, SETTINGS, BOOKMARKS, BOOKMARK_EDIT, CHAPTER_PICKER, BOOK_PICKER }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TextReaderScreen(
    vm: TextReaderViewModel,
    audioPlayer: AudioPlayer,
    onBack: () -> Unit,
    onNavigateToSelector: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val scope = rememberCoroutineScope()
    val bookmarks by vm.bookmarkManager.bookmarks.collectAsState()

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

    // Check audio availability when Talmud daf changes
    LaunchedEffect(vm.category, vm.talmudDaf, vm.globalTalmudTractateIndex) {
        if (vm.category == TextCategory.TALMUD) {
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
        // Row 1: Settings | Title | [Bookmark, Bookmarks, List]
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 2.dp)
        ) {
            // Left: Settings
            IconButton(
                onClick = { activeSheet = ActiveSheet.SETTINGS },
                modifier = Modifier.align(Alignment.CenterStart)
            ) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = colors.appForeground)
            }

            // Center: Nav pills. In Hebrew mode the layout flips RTL so book name sits on the right.
            CompositionLocalProvider(
                LocalLayoutDirection provides if (vm.saHebrewMode) LayoutDirection.Rtl else LayoutDirection.Ltr
            ) {
            Row(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 88.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Book / tractate / work pill → opens in-reader list picker
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
                // Chapter / daf / siman pill → opens quick number picker
                TextButton(
                    onClick = { activeSheet = ActiveSheet.CHAPTER_PICKER },
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.textButtonColors(
                        containerColor = colors.appForeground.copy(alpha = 0.12f)
                    ),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = vm.navChapterTitle,
                        color = colors.appForeground,
                        fontSize = if (vm.category == TextCategory.TALMUD) 18.sp else 13.sp,
                        fontWeight = if (vm.category == TextCategory.TALMUD) FontWeight.Bold else FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }
            } // end CompositionLocalProvider

            // Right: bookmark, bookmarks list
            Row(modifier = Modifier.align(Alignment.CenterEnd)) {
                IconButton(onClick = { activeSheet = ActiveSheet.BOOKMARK_EDIT }) {
                    Icon(
                        Icons.Default.BookmarkBorder,
                        contentDescription = "Save bookmark",
                        tint = colors.editorialColor
                    )
                }
                IconButton(onClick = { activeSheet = ActiveSheet.BOOKMARKS }) {
                    Icon(
                        Icons.Default.Bookmarks,
                        contentDescription = "Bookmarks",
                        tint = colors.appForeground
                    )
                }
                IconButton(onClick = { onNavigateToSelector() }) {
                    Icon(
                        Icons.AutoMirrored.Filled.List,
                        contentDescription = "Selector",
                        tint = colors.appForeground
                    )
                }
            }
        }

        // Row 2: Back | Language pill | Commentary toggle
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

            if (vm.category == TextCategory.TALMUD) {
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

        // Row 3 (Talmud only): Audio player
        if (vm.category == TextCategory.TALMUD) {
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
                    // Navigate to selector
                    activeSheet = null
                    onNavigateToSelector()
                }
                ActiveSheet.CHAPTER_PICKER -> {
                    ChapterPickerSheet(vm = vm, onDone = {
                        activeSheet = null
                        vm.load()
                    })
                }
                ActiveSheet.BOOK_PICKER -> {
                    BookPickerSheet(vm = vm, onSelect = {
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
    // SA gets its own full-list picker
    if (vm.category == TextCategory.SHULCHAN_ARUKH) {
        SASimanPickerContent(vm = vm, onSelect = onDone)
        return
    }

    val colors = LocalAnyTorahColors.current
    val label = when (vm.category) {
        TextCategory.TALMUD -> "Select Daf"
        else                 -> "Select Chapter"
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
            else -> {} // SA handled above
        }

        Spacer(modifier = Modifier.height(16.dp))
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
