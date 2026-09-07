package com.anytorah.ui.screens

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
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
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Headphones
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.SubcomposeAsyncImage
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.api.RelatedYCTPiece
import com.anytorah.api.TalmudAudioService
import com.anytorah.api.YomiService
import com.anytorah.audio.AudioPlayer
import com.anytorah.models.ContemporaryTeshuvotVolume
import com.anytorah.models.ContemporaryTeshuvotWork
import com.anytorah.models.MidrashWork
import com.anytorah.models.MishnahSubcategory
import com.anytorah.models.NishmatHaBayitSiman
import com.anytorah.models.SASimanNames
import com.anytorah.models.SATopicSection
import com.anytorah.models.TextCatalog
import com.anytorah.models.TextCategory
import com.anytorah.models.TextDisplayMode
import com.anytorah.models.TalmudSubcategory
import com.anytorah.models.TeshuvotSubcategory
import com.anytorah.models.TeshuvotWork
import com.anytorah.api.IggrosMoshePodcastService
import com.anytorah.api.PodcastEpisodeCitation
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

enum class ActiveSheet { SETTINGS, BOOKMARKS, BOOKMARK_EDIT, CHAPTER_PICKER, BOOK_PICKER, VOLUME_PICKER, RELATED_ARTICLES, PODCAST_CITATIONS }

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
    // guard and ContemporaryTeshuvotPageView. True only for the page-image works (Iggros
    // Moshe) -- false for Contemporary's Sefaria-digitized works (Mishpetei Uziel etc.), which
    // use the ordinary text pipeline like Rishonim/Acharonim, Row 2 included.
    val isContemporaryPdf = vm.category == TextCategory.TESHUVOT &&
        vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !vm.contemporaryUsesSefaria

    // Shown only where a Sefaria daily-learning schedule actually applies to the screen
    // currently open -- Tosefta and Rambam have no requested yomi cycle here. Matches iOS.
    val showsYomiJumpButton = when (vm.category) {
        TextCategory.TALMUD  -> true                                        // Bavli -> Daf Yomi, Yerushalmi -> Yerushalmi Yomi
        TextCategory.MISHNAH -> vm.mishnahSubcategory == MishnahSubcategory.MISHNAH  // not Tosefta
        TextCategory.TANAKH  -> true                                        // -> this week's parsha
        else -> false
    }

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

    // Iggros Moshe podcast citations -- resolve the current siman via the same floor lookup
    // the siman pill already uses (TeshuvotPageManager.siman), keyed here (not inside the
    // effect) so the effect body -- and the state writes it does -- only re-runs when the
    // resolved siman actually changes, not on every single page turn within one teshuvah's span.
    // vm.resolvedContemporarySiman(context) (not the plain TeshuvotPageManager.siman floor
    // lookup directly) so this agrees with the header pill on "what siman am I looking at" --
    // honors an explicit picker selection (contemporaryPickedSiman) when two simanim share a
    // page, same reasoning as navChapterTitle(context)'s own call site.
    val currentContemporarySiman = if (vm.category == TextCategory.TESHUVOT &&
        vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !vm.contemporaryUsesSefaria
    ) {
        vm.resolvedContemporarySiman(context)
    } else null

    LaunchedEffect(vm.contemporaryVolume.id, currentContemporarySiman) {
        if (currentContemporarySiman == null) {
            vm.setCitedPodcastEpisodes(emptyList())
            return@LaunchedEffect
        }
        val episodes = IggrosMoshePodcastService.citedEpisodes(context, vm.contemporaryVolume.id, currentContemporarySiman)
        vm.setCitedPodcastEpisodes(episodes)
        for (episode in episodes) {
            if (vm.podcastArtwork.containsKey(episode.id)) continue
            launch {
                IggrosMoshePodcastService.artworkUrl(episode)?.let { vm.setPodcastArtwork(episode.id, it) }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
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
            // Left: bookmark, bookmarks list, jump-to-today. The first two are shrunk to 40.dp
            // (from IconButton's default 48.dp touch target) and grouped in their own Row so
            // they sit visibly closer together, since they're functionally related; the
            // jump-to-today icon (unrelated) keeps the default size and a normal gap.
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
                // The old combined book/chapter selector sheet (MenuBook icon) was removed
                // entirely (not just for Teshuvot) -- every category's own book/chapter nav
                // pills, right in this same row, already give full navigation, making the
                // separate wheel-picker sheet purely redundant everywhere. In its place: a
                // "jump to today" icon, shown only where a yomi/parsha schedule actually
                // applies to the current screen -- see `showsYomiJumpButton`. Matches iOS.
                if (showsYomiJumpButton) {
                    IconButton(onClick = { scope.launch { jumpToTodayYomi(vm) } }) {
                        Icon(
                            Icons.Default.CalendarToday,
                            contentDescription = "Jump to today",
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
                // Centered (not start-aligned) so the whole book/volume/siman cluster reads as
                // one centered unit in the available row space, per explicit request -- matches
                // iOS's equivalent `.frame(maxWidth: .infinity, alignment: .center)`.
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
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
        if (!isContemporaryPdf) {
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
                isContemporaryPdf -> {
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

    // Trailing-edge tab mirroring AnyYCTorah's own "cited from this daf" indicator
    // (LearnTheDafView.citingTab) -- docked to the screen edge, overlapping the content, so it
    // reads as persistently present rather than buried in Row 1's icon cluster (its previous
    // spot, easy to miss among several other icons). Only when real coverage exists for the
    // current siman -- pops in once the async fetch resolves. Matches iOS.
    if (vm.category == TextCategory.SHULCHAN_ARUKH && vm.relatedYCTPieces.isNotEmpty()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .clip(RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp))
                .background(Color.Black.copy(alpha = 0.55f))
                .clickable { activeSheet = ActiveSheet.RELATED_ARTICLES }
                .padding(vertical = 12.dp, horizontal = 8.dp)
        ) {
            Icon(
                Icons.Default.Article,
                contentDescription = "Related YCT Articles",
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = "${vm.relatedYCTPieces.size}",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }
    } else if (vm.category == TextCategory.TESHUVOT && vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY &&
        !vm.contemporaryUsesSefaria && vm.citedPodcastEpisodes.isNotEmpty()
    ) {
        // Same docked-to-edge mechanism as the Related Articles tab above, but made "a little
        // more visible" per explicit request: shows the first cited episode's real SoundCloud
        // artwork (once loaded) at a noticeably larger size than that tab's icon+count, with a
        // small headphones badge distinguishing it from the book-icon Related Articles tab.
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .clip(RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp))
                .background(Color.Black.copy(alpha = 0.55f))
                .clickable { activeSheet = ActiveSheet.PODCAST_CITATIONS }
                .padding(vertical = 10.dp, horizontal = 8.dp)
        ) {
            PodcastArtworkImage(vm.citedPodcastEpisodes[0], vm.podcastArtwork[vm.citedPodcastEpisodes[0].id], size = 64.dp)
            if (vm.citedPodcastEpisodes.size > 1) {
                Text(
                    text = "${vm.citedPodcastEpisodes.size}",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
    } // end Box

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
                ActiveSheet.CHAPTER_PICKER -> {
                    ChapterPickerSheet(vm = vm, onDone = {
                        activeSheet = null
                        vm.load()
                    })
                }
                ActiveSheet.BOOK_PICKER -> {
                    BookPickerSheet(vm = vm, onSelect = {
                        if (isContemporaryPdf) {
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
                ActiveSheet.RELATED_ARTICLES -> {
                    val context = LocalContext.current
                    RelatedArticlesSheet(
                        pieces = vm.relatedYCTPieces,
                        onOpen = { url ->
                            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
                        }
                    )
                }
                ActiveSheet.PODCAST_CITATIONS -> {
                    val context = LocalContext.current
                    PodcastCitationsSheet(
                        episodes = vm.citedPodcastEpisodes,
                        artwork = vm.podcastArtwork,
                        onOpen = { url ->
                            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
                        }
                    )
                }
                null -> {}
            }
        }
    }
}

// Fetches today's Sefaria daily-learning schedule and jumps the reader straight to it. Matches
// iOS's `jumpToTodayYomi()` in TextReaderView.swift.
private suspend fun jumpToTodayYomi(vm: TextReaderViewModel) {
    val result = YomiService.fetchToday()
    when (vm.category) {
        TextCategory.TALMUD -> {
            if (vm.talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
                val y = result.yerushalmi ?: return
                val globalIdx = vm.allYerushalmiTractates.indexOfFirst { it.name == y.tractateName }
                if (globalIdx == -1) return
                vm.setYerushalmiGlobalTractate(globalIdx)
                vm.yerushalmiChapter = y.chapter
                vm.yerushalmiHalakha = y.halakha
            } else {
                val d = result.daf ?: return
                vm.talmudSederIndex = d.sederIndex
                vm.talmudTractateIndexInSeder = d.tractateIndexInSeder
                vm.talmudDaf = d.daf
            }
        }
        TextCategory.MISHNAH -> {
            if (vm.mishnahSubcategory != MishnahSubcategory.MISHNAH) return
            val m = result.mishnah ?: return
            vm.mishnahSederIndex = m.sederIndex
            vm.mishnahTractateIndexInSeder = m.tractateIndexInSeder
            vm.mishnahChapter = m.chapter
        }
        TextCategory.TANAKH -> {
            val p = result.parsha ?: return
            vm.tanakhBookIndex = p.bookIndex
            vm.tanakhChapter = p.chapter
            vm.tanakhScrollToVerse = p.verse
        }
        else -> return
    }
    vm.load()
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
    } else if (vm.category == TextCategory.TESHUVOT && vm.contemporaryUsesSefaria && vm.teshuvotWork == TeshuvotWork.NISHMAT_HA_BAYIT) {
        NishmatHaBayitSimanPickerContent(vm = vm, onSelect = onDone)
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
                if (vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !vm.contemporaryUsesSefaria) {
                    // Selecting a siman jumps contemporaryPage to that siman's indexed page via
                    // vm.jumpToContemporarySiman (not a plain page assignment) -- this also
                    // records exactly which siman was picked, so the header pill shows it
                    // correctly even when another siman shares the same page (see
                    // TextReaderViewModel.contemporaryPickedSiman's doc comment).
                    val context = LocalContext.current
                    val simanCount = vm.contemporaryVolume.simanCount.coerceAtLeast(1)
                    // Re-keyed on volume id (like before) but seeded from the actually-resolved
                    // current siman rather than a hardcoded 1 -- a bare 1 only happened to look
                    // right because switching volumes always lands on siman 1 today; seeding
                    // from vm.resolvedContemporarySiman keeps this correct even after a restored
                    // (non-1) position, matching the fix applied to iOS's equivalent picker.
                    var selectedSiman by remember(vm.contemporaryVolume.id) {
                        mutableStateOf(vm.resolvedContemporarySiman(context) ?: vm.contemporaryPage)
                    }
                    WheelPicker(
                        items = (1..simanCount).map { if (useHe) SASimanNames.toHebrewNumeral(it) else it.toString() },
                        selectedIndex = (selectedSiman - 1).coerceIn(0, simanCount - 1),
                        onIndexSelected = { idx ->
                            val siman = idx + 1
                            selectedSiman = siman
                            vm.jumpToContemporarySiman(siman)
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
    if (vm.teshuvotSubcategory == TeshuvotSubcategory.CONTEMPORARY && !vm.contemporaryUsesSefaria) {
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
        // Exception set (2026-08-30, expanded 2026-09-01 after on-device review found the
        // default order wrong for most numeric-labeled works, not just Benei Banim/B'mareh
        // HaBazak): these need the generic word (Chelek/Klal) visually RIGHT of the numeral. If
        // a future numeric-labeled Hebrew volume work looks backwards on-device, it likely needs
        // its own entry here too rather than a global flip.
        val wordBeforeNumeralInHebrew = setOf(
            TeshuvotWork.BENEI_BANIM, TeshuvotWork.BMAREH_HABAZAK,
            TeshuvotWork.ROSH, TeshuvotWork.RASHBA, TeshuvotWork.TERUMAT_HA_DESHEN, TeshuvotWork.SEFER_HA_TASHBETZ,
            TeshuvotWork.HALAKHOT_KETANOT, TeshuvotWork.MAHARSHAM, TeshuvotWork.MELAMMED_LEHOIL, TeshuvotWork.MESHIV_DAVAR,
            TeshuvotWork.RADBAZ, TeshuvotWork.SHEILAT_YAAVETZ,
        )
        WheelPicker(
            items = (1..count).map { v ->
                val numeral = if (vm.saHebrewMode) vm.teshuvotWork.volumePickerDisplayLabelHebrew(v) else vm.teshuvotWork.volumeDisplayLabel(v)
                if (!vm.teshuvotWork.volumeLabelIsNumeric) numeral
                else if (vm.saHebrewMode) {
                    if (vm.teshuvotWork in wordBeforeNumeralInHebrew) "$label $numeral" else "$numeral $label"
                } else "$label $numeral"
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

/** Nishmat HaBayit's titled-list siman picker, grouped by its 5 Parts -- same shape as
 *  [SASimanPickerContent] above, since this work has no numeric Siman address type on Sefaria
 *  (see [NishmatHaBayitSiman]'s doc comment for why). */
@Composable
private fun NishmatHaBayitSimanPickerContent(vm: TextReaderViewModel, onSelect: () -> Unit) {
    val colors = LocalAnyTorahColors.current
    val useHe = vm.saHebrewMode
    val parts = remember { NishmatHaBayitSiman.all.map { it.partEnglish }.distinct() }
    CompositionLocalProvider(
        LocalLayoutDirection provides if (useHe) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        for (part in parts) {
            val entries = NishmatHaBayitSiman.all.filter { it.partEnglish == part }
            stickyHeader {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(colors.cardBackground)
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = if (useHe) entries.first().partHebrew else part,
                        color = colors.appForeground,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            for (entry in entries) {
                item {
                    val isSelected = vm.teshuvotSiman == entry.number
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { vm.teshuvotSiman = entry.number; onSelect() }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${entry.number}",
                            color = colors.appForeground.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            modifier = Modifier.width(28.dp),
                            textAlign = TextAlign.End
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (useHe) entry.titleHebrew else entry.titleEnglish,
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
    } // end CompositionLocalProvider
}

/** Lists YCT halakha pieces (library.yctorah.org/psak.yctorah.org) citing the current SA siman --
 *  see [YCTRelatedArticlesService]. Tapping a row opens it externally via Custom Tabs; no native
 *  in-app reader (this app has no other web-view precedent -- see CLAUDE.md). */
@Composable
private fun RelatedArticlesSheet(pieces: List<RelatedYCTPiece>, onOpen: (String) -> Unit) {
    val colors = LocalAnyTorahColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Related YCT Articles",
            color = colors.appForeground,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
        HorizontalDivider(color = colors.dividerColor)
        LazyColumn(modifier = Modifier.fillMaxWidth()) {
            items(pieces) { piece ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpen(piece.url) }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    RelatedArticleThumbnail(piece, colors)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(piece.title, color = colors.appForeground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        piece.author?.takeIf { it.isNotBlank() }?.let {
                            Text(it, color = colors.appForeground.copy(alpha = 0.6f), fontSize = 12.sp)
                        }
                        piece.excerpt?.takeIf { it.isNotBlank() }?.let {
                            Text(it, color = colors.appForeground.copy(alpha = 0.75f), fontSize = 12.sp,
                                maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                HorizontalDivider(color = colors.dividerColor)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
}

/** Featured-image thumbnail per piece, mirroring AnyYCTorah's `PostRow` thumbnail (real image
 *  when `pieces.image_url` is populated, else a gray placeholder with a content-type glyph). No
 *  author-photo fallback tier -- that's backed by AnyYCTorah's separate author-photo scraping
 *  pipeline, out of scope for this read-only surface. */
@Composable
private fun RelatedArticleThumbnail(piece: RelatedYCTPiece, colors: AnyTorahColors) {
    val shape = RoundedCornerShape(8.dp)
    val placeholder: @Composable () -> Unit = {
        Box(
            modifier = Modifier.size(56.dp).clip(shape).background(colors.appForeground.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (piece.isAudio) Icons.Default.Headphones else Icons.Default.Article,
                contentDescription = null,
                tint = colors.appForeground.copy(alpha = 0.5f)
            )
        }
    }
    if (!piece.imageURL.isNullOrBlank()) {
        SubcomposeAsyncImage(
            model = piece.imageURL,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(56.dp).clip(shape),
            loading = { placeholder() },
            error = { placeholder() }
        )
    } else {
        placeholder()
    }
}

/** Artwork thumbnail for one podcast episode citation -- [artworkUrl] is `vm.podcastArtwork`'s
 *  lookup for this episode (null until its SoundCloud oEmbed fetch resolves), falling back to a
 *  plain headphones-icon placeholder while loading or if the fetch fails. Same
 *  `SubcomposeAsyncImage` loading/error-slot shape as [RelatedArticleThumbnail]. */
@Composable
private fun PodcastArtworkImage(episode: PodcastEpisodeCitation, artworkUrl: String?, size: Dp) {
    val shape = RoundedCornerShape(8.dp)
    val placeholder: @Composable () -> Unit = {
        Box(
            modifier = Modifier.size(size).clip(shape).background(Color.White.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Headphones, contentDescription = null, tint = Color.White.copy(alpha = 0.7f))
        }
    }
    if (artworkUrl != null) {
        SubcomposeAsyncImage(
            model = artworkUrl,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(size).clip(shape),
            loading = { placeholder() },
            error = { placeholder() }
        )
    } else {
        placeholder()
    }
}

/** Lists every "Iggros Moshe A to Z" podcast episode (soundcloud.com/iggrosmosheatoz, Rabbi Dov
 *  Linzer) discussing the current siman -- see [IggrosMoshePodcastService]. Tapping a row opens
 *  it externally via Custom Tabs, matching [RelatedArticlesSheet]'s own pattern; no in-app
 *  playback (explicit non-goal, this is a "here's where to find it" indicator). */
@Composable
private fun PodcastCitationsSheet(episodes: List<PodcastEpisodeCitation>, artwork: Map<String, String>, onOpen: (String) -> Unit) {
    val colors = LocalAnyTorahColors.current
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Iggros Moshe A to Z",
            color = colors.appForeground,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
        HorizontalDivider(color = colors.dividerColor)
        LazyColumn(modifier = Modifier.fillMaxWidth()) {
            items(episodes) { episode ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpen(episode.audioUrl) }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    PodcastArtworkImage(episode, artwork[episode.id], size = 56.dp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Episode ${episode.episodeNumber}", color = colors.appForeground.copy(alpha = 0.6f), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        Text(episode.title, color = colors.appForeground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                HorizontalDivider(color = colors.dividerColor)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
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
                // Iggros Moshe (page-image works) first, then Contemporary's Sefaria-digitized
                // works (Mishpetei Uziel etc.) in declaration order -- per explicit request.
                // Always a flat list, never century-grouped/alphabetized like Rishonim/Acharonim.
                items(ContemporaryTeshuvotWork.works) { work ->
                    BookPickerRow(
                        // Full, un-abbreviated name here -- abbreviations (hebrewDisplayName,
                        // "אג״מ") are for the compact nav pill only, not the book-picker list.
                        // See TeshuvotVolume.pickerHebrewLabel's doc comment for the same
                        // standing policy applied to volume labels.
                        name = if (useHe) work.hebrewName else work.name,
                        isSelected = !vm.contemporaryUsesSefaria && vm.contemporaryWork.id == work.id,
                        onClick = {
                            vm.contemporaryUsesSefaria = false
                            vm.setContemporaryWork(work)
                            onSelect()
                        }
                    )
                    HorizontalDivider(color = colors.dividerColor)
                }
                items(TeshuvotWork.worksFor(TeshuvotSubcategory.CONTEMPORARY)) { work ->
                    BookPickerRow(
                        name = if (useHe) work.hebrewName else work.displayName,
                        isSelected = vm.contemporaryUsesSefaria && vm.teshuvotWork == work,
                        onClick = {
                            vm.contemporaryUsesSefaria = true
                            vm.teshuvotWork = work
                            vm.teshuvotVolume = 1; vm.teshuvotSiman = 1
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
