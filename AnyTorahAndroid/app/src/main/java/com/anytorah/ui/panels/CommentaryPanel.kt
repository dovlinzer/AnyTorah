package com.anytorah.ui.panels

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.R
import com.anytorah.api.SefariaTextClient
import com.anytorah.models.CommentaryEntry
import com.anytorah.models.CommentaryType
import com.anytorah.models.TextCategory
import com.anytorah.models.TextDisplayMode
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel


private val notoRashiFamily = FontFamily(Font(R.font.noto_rashi_hebrew_regular))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentaryPanel(
    vm: TextReaderViewModel,
    onLoadCommentary: () -> Unit,
    fontSizeLevel: Int = 0,
    modifier: Modifier = Modifier
) {
    val colors = LocalAnyTorahColors.current
    // Swap picker: which slot index is being replaced (null = closed)
    var replacingSlotIndex by remember { mutableStateOf<Int?>(null) }
    val swapSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(color = colors.cardBackground)
    ) {
        HorizontalDivider(color = colors.dividerColor)

        // Commentary tabs — use effective list so substituted slots show correct names.
        // Tapping the already-selected tab opens the swap picker (if pool has more options).
        val commentaries = vm.effectiveCommentaries
        val selectedIdx = commentaries.indexOf(vm.selectedCommentary).coerceAtLeast(0)

        if (commentaries.isNotEmpty()) {
            CompositionLocalProvider(
                LocalLayoutDirection provides if (vm.saHebrewMode) LayoutDirection.Rtl else LayoutDirection.Ltr
            ) {
            ScrollableTabRow(
                selectedTabIndex = selectedIdx.coerceIn(0, (commentaries.size - 1).coerceAtLeast(0)),
                containerColor = colors.cardBackground,
                contentColor = colors.appForeground,
                edgePadding = 0.dp,
                indicator = { tabPositions ->
                    if (selectedIdx < tabPositions.size) {
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[selectedIdx]),
                            color = colors.editorialColor
                        )
                    }
                }
            ) {
                commentaries.forEachIndexed { idx, commentary ->
                    Tab(
                        selected = idx == selectedIdx,
                        onClick = {
                            if (idx == selectedIdx && vm.hasExpandedCommentaryPool) {
                                // Tap active tab → open swap picker for this slot
                                replacingSlotIndex = idx
                            } else if (vm.selectedCommentary != commentary) {
                                vm.selectedCommentary = commentary
                                onLoadCommentary()
                            }
                        },
                        text = {
                            Text(
                                text = if (vm.saHebrewMode) commentary.hebrewDisplayName else commentary.displayName,
                                fontSize = 13.sp,
                                color = if (idx == selectedIdx) colors.editorialColor
                                        else colors.appForeground.copy(alpha = 0.6f)
                            )
                        }
                    )
                }
            }
            } // end CompositionLocalProvider
        }

        HorizontalDivider(color = colors.dividerColor)

        // Content area
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            when {
                vm.isLoadingCommentary -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = colors.editorialColor
                    )
                }
                vm.commentaryError != null -> {
                    Text(
                        text = vm.commentaryError!!,
                        color = colors.appForeground.copy(alpha = 0.6f),
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp)
                    )
                }
                vm.commentaryEntries.isEmpty() -> {
                    Text(
                        text = "No commentary available",
                        color = colors.appForeground.copy(alpha = 0.5f),
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp)
                    )
                }
                else -> {
                    // Bracket style and font size for SA sequential-marker commentators.
                    // MB always uses Sefaria's own bold labels (no generated prefix, full size).
                    // When MB is in the panel the other slots are ranked among themselves:
                    //   lower-index non-MB slot → curly brackets, normal font
                    //   higher-index non-MB slot → round brackets, small font
                    // When MB is absent the original position-based scheme applies.
                    val mbSlotInPanel = if (vm.category == TextCategory.SHULCHAN_ARUKH)
                        vm.availableCommentaries.indexOf(CommentaryType.MISHNAH_BERURAH)
                            .takeIf { it >= 0 }
                    else null
                    val isMBSelected = vm.category == TextCategory.SHULCHAN_ARUKH &&
                        vm.selectedCommentary == CommentaryType.MISHNAH_BERURAH
                    val saStyle: Pair<String, String>?
                    val saLabelIsSmall: Boolean
                    if (vm.category != TextCategory.SHULCHAN_ARUKH || isMBSelected) {
                        // Not SA, or MB itself — MB keeps Sefaria's own labels.
                        saStyle = null
                        saLabelIsSmall = false
                    } else {
                        val si = vm.availableCommentaries.indexOf(vm.selectedCommentary)
                        val hasMarkers = si >= 0 &&
                            vm.selectedCommentary.hasInlineSAMarkers(vm.saSection)
                        if (!hasMarkers) {
                            saStyle = null
                            saLabelIsSmall = false
                        } else if (mbSlotInPanel != null) {
                            // Rank this slot among the non-MB slots (ascending).
                            val nonMBSlots = vm.availableCommentaries.indices
                                .filter { it != mbSlotInPanel }
                                .sorted()
                            val rank = nonMBSlots.indexOf(si)
                            if (rank == 0) {
                                saStyle = Pair("{", "}")
                                saLabelIsSmall = false
                            } else {
                                saStyle = Pair("(", ")")
                                saLabelIsSmall = true
                            }
                        } else {
                            // Original position-based scheme when MB is not in the panel.
                            saStyle = when (si) {
                                0 -> Pair("(", ")")
                                1 -> Pair("{", "}")
                                else -> Pair("(", ")")
                            }
                            saLabelIsSmall = si >= 2
                        }
                    }
                    CommentaryContent(
                        entries = vm.commentaryEntries,
                        displayMode = vm.displayMode,
                        saStyle = saStyle,
                        saLabelIsSmall = saLabelIsSmall,
                        fontSizeLevel = fontSizeLevel,
                        useRashiFont = vm.useRashiFont && (vm.selectedCommentary == CommentaryType.RASHI_TANAKH
                                    || vm.selectedCommentary == CommentaryType.RASHI_TALMUD),
                        scrollToAmudB = vm.commentaryScrollToAmudB,
                        onScrollToAmudBConsumed = { vm.commentaryScrollToAmudB = false },
                        scrollToAmudA = vm.commentaryScrollToAmudA,
                        onScrollToAmudAConsumed = { vm.commentaryScrollToAmudA = false },
                        onAmudB = vm.category == TextCategory.TALMUD && vm.talmudAmud == 1,
                        loadVersion = vm.commentaryLoadVersion
                    )
                }
            }
        }
    }

    // Commentary swap picker sheet
    val slotIdx = replacingSlotIndex
    if (slotIdx != null) {
        ModalBottomSheet(
            onDismissRequest = { replacingSlotIndex = null },
            sheetState = swapSheetState,
            containerColor = colors.cardBackground
        ) {
            CommentarySwapPickerContent(
                vm = vm,
                slotIndex = slotIdx,
                onSelect = {
                    replacingSlotIndex = null
                }
            )
        }
    }
}

@Composable
private fun CommentarySwapPickerContent(
    vm: TextReaderViewModel,
    slotIndex: Int,
    onSelect: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val currentInSlot = vm.availableCommentaries.getOrNull(slotIndex)
    val otherSlots = vm.availableCommentaries.mapIndexedNotNull { i, c ->
        if (i != slotIndex) c else null
    }.toSet()

    // Groups with commentaries in other slots filtered out; empty groups dropped
    val optionGroups: List<List<CommentaryType>> = vm.commentaryPoolGrouped.map { group ->
        group.filter { it !in otherSlots }
    }.filter { it.isNotEmpty() }

    val groupLabels: List<String?> = run {
        val allLabels = vm.commentaryPoolGroupLabels
        // Re-align labels: zip with the non-empty filtered groups
        var labelIdx = 0
        val result = mutableListOf<String?>()
        vm.commentaryPoolGrouped.forEachIndexed { i, group ->
            val filtered = group.filter { it !in otherSlots }
            if (filtered.isNotEmpty()) {
                result.add(if (labelIdx < allLabels.size) allLabels[i] else null)
                labelIdx++
            }
        }
        result
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Header
        Text(
            text = "Select Commentator",
            color = colors.appForeground,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
        HorizontalDivider(color = colors.dividerColor)

        LazyColumn(modifier = Modifier.fillMaxWidth()) {
            optionGroups.forEachIndexed { groupIdx, group ->
                val label = groupLabels.getOrNull(groupIdx)
                if (label != null) {
                    item {
                        Text(
                            text = label,
                            color = colors.appForeground.copy(alpha = 0.45f),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(start = 16.dp, top = 10.dp, bottom = 2.dp, end = 16.dp)
                        )
                    }
                }
                itemsIndexed(group) { _, option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                vm.replaceSlot(slotIndex, option)
                                onSelect()
                            }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (vm.saHebrewMode) option.hebrewDisplayName else option.displayName,
                            color = colors.appForeground,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f)
                        )
                        if (option == currentInSlot) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                tint = colors.editorialColor,
                                modifier = androidx.compose.ui.Modifier.padding(start = 8.dp)
                            )
                        }
                    }
                    HorizontalDivider(color = colors.dividerColor)
                }
            }
            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun CommentaryContent(
    entries: List<CommentaryEntry>,
    displayMode: TextDisplayMode,
    saStyle: Pair<String, String>? = null,
    saLabelIsSmall: Boolean = false,
    fontSizeLevel: Int = 0,
    useRashiFont: Boolean = false,
    scrollToAmudB: Boolean = false,
    onScrollToAmudBConsumed: () -> Unit = {},
    scrollToAmudA: Boolean = false,
    onScrollToAmudAConsumed: () -> Unit = {},
    onAmudB: Boolean = false,
    loadVersion: Int = 0
) {
    val colors = LocalAnyTorahColors.current
    val isTablet = LocalConfiguration.current.smallestScreenWidthDp >= 600
    val tabletBoost = if (isTablet) 8f else 0f
    val commHeFontSize = (17f + fontSizeLevel * 2f + tabletBoost).coerceAtLeast(10f)
    val rashiHeFontSize = (9f + fontSizeLevel * 2f + tabletBoost).coerceAtLeast(10f)
    val actualHeFontSize = if (useRashiFont) rashiHeFontSize else commHeFontSize
    val hebrewFontFamily = if (useRashiFont) notoRashiFamily else FontFamily(Font(R.font.frank_ruhl_libre_regular))
    val commEnFontSize = (13f + fontSizeLevel * 2f + tabletBoost).coerceAtLeast(10f)
    val commSmallFontSize = (13f + fontSizeLevel * 2f + tabletBoost).coerceAtLeast(10f)

    val scrollState = rememberScrollState()
    var amudBOffsetPx by remember(loadVersion) { mutableStateOf(-1) }

    androidx.compose.runtime.LaunchedEffect(scrollToAmudB, loadVersion) {
        if (scrollToAmudB && entries.isNotEmpty()) {
            repeat(20) {
                if (amudBOffsetPx >= 0) {
                    scrollState.animateScrollTo(amudBOffsetPx)
                    onScrollToAmudBConsumed()
                    return@LaunchedEffect
                }
                kotlinx.coroutines.delay(50)
            }
            onScrollToAmudBConsumed()
        }
    }

    androidx.compose.runtime.LaunchedEffect(scrollToAmudA) {
        if (scrollToAmudA) {
            scrollState.animateScrollTo(0)
            onScrollToAmudAConsumed()
        }
    }

    // When new commentary loads while already on amud B, jump to the ב marker.
    // Keyed on loadVersion (not entries) so it fires even when entry count is unchanged.
    androidx.compose.runtime.LaunchedEffect(loadVersion) {
        if (onAmudB && entries.isNotEmpty()) {
            repeat(20) {
                if (amudBOffsetPx >= 0) {
                    scrollState.animateScrollTo(amudBOffsetPx)
                    return@LaunchedEffect
                }
                kotlinx.coroutines.delay(50)
            }
        }
    }

    SelectionContainer {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        var prevWasText = false
        for (entry in entries) {
            when (entry) {
                is CommentaryEntry.RecensionHeader -> {
                    prevWasText = false
                    RecensionHeaderRow(
                        label = entry.label,
                        fg = colors.appForeground,
                        modifier = if (entry.label == "עמוד ב׳") {
                            Modifier.onGloballyPositioned { coords ->
                                val y = coords.positionInParent().y.toInt()
                                if (amudBOffsetPx != y) amudBOffsetPx = y
                            }
                        } else Modifier
                    )
                }
                is CommentaryEntry.BookDivider -> {
                    prevWasText = false
                    BookDividerRow(label = entry.label, accentColor = colors.editorialColor)
                }
                is CommentaryEntry.Text -> {
                    if (prevWasText) {
                        HorizontalDivider(
                            color = colors.dividerColor.copy(alpha = 0.5f),
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    }
                    prevWasText = true
                    // Build the Hebrew-letter prefix for SA sequential-marker commentators.
                    val prefix = saStyle?.let { (open, close) ->
                        "$open${SefariaTextClient.saHebrewLetter(entry.index + 1)}$close "
                    } ?: ""
                    // Strip Sefaria's embedded bold label (e.g. <b>א</b>) when we manage
                    // our own prefix — otherwise both labels appear simultaneously.
                    val displayHe = if (saStyle != null) SefariaTextClient.stripLeadingBoldLabel(entry.he) else entry.he
                    val displayEn = if (saStyle != null) SefariaTextClient.stripLeadingBoldLabel(entry.en) else entry.en
                    when (displayMode) {
                        TextDisplayMode.SOURCE -> {
                            if (displayHe.isNotEmpty()) {
                                if (saLabelIsSmall && prefix.isNotEmpty()) {
                                    HebrewTextWithSmallPrefix(
                                        prefix = prefix,
                                        bodyHtml = displayHe,
                                        fontSize = actualHeFontSize,
                                        smallFontSize = commSmallFontSize,
                                        fontFamily = hebrewFontFamily
                                    )
                                } else {
                                    HebrewText(html = prefix + displayHe, fontSize = actualHeFontSize,
                                               fontFamily = hebrewFontFamily)
                                }
                            }
                        }
                        TextDisplayMode.TRANSLATION -> {
                            // When the prefix is small it only applies to the Hebrew line;
                            // the English line gets no prefix in that case.
                            val enPrefix = if (saLabelIsSmall) "" else prefix
                            if (displayEn.isNotEmpty())
                                EnglishText(html = enPrefix + displayEn, fontSize = commEnFontSize)
                        }
                        TextDisplayMode.BOTH -> {
                            if (displayHe.isNotEmpty()) {
                                if (saLabelIsSmall && prefix.isNotEmpty()) {
                                    HebrewTextWithSmallPrefix(
                                        prefix = prefix,
                                        bodyHtml = displayHe,
                                        fontSize = actualHeFontSize,
                                        smallFontSize = commSmallFontSize,
                                        fontFamily = hebrewFontFamily
                                    )
                                } else {
                                    HebrewText(html = prefix + displayHe, fontSize = actualHeFontSize,
                                               fontFamily = hebrewFontFamily)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                            }
                            // English NEVER gets the prefix in BOTH mode — the Hebrew line
                            // already carries the letter label.
                            if (displayEn.isNotEmpty())
                                EnglishText(html = displayEn, fontSize = commEnFontSize)
                        }
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
    } // SelectionContainer
}

/** Renders Hebrew commentary text with the label prefix at a smaller size
 *  so sequential-marker letters are visually subordinate to the commentary body. */
@Composable
private fun HebrewTextWithSmallPrefix(
    prefix: String,
    bodyHtml: String,
    fontSize: Float,
    smallFontSize: Float = 13f,
    fontFamily: FontFamily = FontFamily(Font(R.font.frank_ruhl_libre_regular))
) {
    val colors = LocalAnyTorahColors.current
    val body = SefariaTextClient.processedHebrew(bodyHtml, showTrop = false)
    val annotated = buildAnnotatedString {
        pushStyle(SpanStyle(fontSize = smallFontSize.sp, fontFamily = fontFamily))
        append(prefix)
        pop()
        pushStyle(SpanStyle(fontSize = fontSize.sp, fontFamily = fontFamily))
        append(body)
        pop()
    }
    Text(
        text = annotated,
        color = colors.appForeground,
        lineHeight = (fontSize * 1.7f).sp,
        style = androidx.compose.ui.text.TextStyle(
            textDirection = androidx.compose.ui.text.style.TextDirection.Rtl
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

/** Prominent separator for commentators that combine two distinct books. */
@Composable
private fun BookDividerRow(label: String, accentColor: androidx.compose.ui.graphics.Color) {
    androidx.compose.foundation.layout.Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = androidx.compose.ui.Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp)
    ) {
        HorizontalDivider(
            modifier = androidx.compose.ui.Modifier.weight(1f),
            thickness = 1.5.dp,
            color = accentColor.copy(alpha = 0.7f)
        )
        Text(
            text = label,
            color = accentColor,
            fontSize = 12.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            modifier = androidx.compose.ui.Modifier.padding(horizontal = 8.dp)
        )
        HorizontalDivider(
            modifier = androidx.compose.ui.Modifier.weight(1f),
            thickness = 1.5.dp,
            color = accentColor.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun RecensionHeaderRow(
    label: String,
    fg: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    androidx.compose.foundation.layout.Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        HorizontalDivider(
            modifier = androidx.compose.ui.Modifier.weight(1f),
            color = fg.copy(alpha = 0.25f)
        )
        Text(
            text = label,
            color = fg.copy(alpha = 0.55f),
            fontSize = 12.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
            modifier = androidx.compose.ui.Modifier.padding(horizontal = 8.dp)
        )
        HorizontalDivider(
            modifier = androidx.compose.ui.Modifier.weight(1f),
            color = fg.copy(alpha = 0.25f)
        )
    }
}
