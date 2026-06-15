package com.anytorah.ui.panels

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import com.anytorah.R
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.api.SefariaTextClient
import com.anytorah.models.TextDisplayMode
import com.anytorah.models.TextSegment
import com.anytorah.ui.theme.LocalAnyTorahColors


@Composable
fun TextContentPanel(
    segments: List<TextSegment>,
    displayMode: TextDisplayMode,
    scrollToVerse: Int?,
    onScrollToVerseConsumed: () -> Unit,
    scrollToAmudB: Boolean = false,
    onScrollToAmudBConsumed: () -> Unit = {},
    useBoldHighlight: Boolean = true,
    fontSizeLevel: Int = 0,
    showTrop: Boolean = false,
    /** True for Tanakh — uses Noto Serif Hebrew (has cantillation marks) instead of Frank Ruhl. */
    isTanakh: Boolean = false,
    modifier: Modifier = Modifier
) {
    val colors = LocalAnyTorahColors.current
    val scrollState = rememberScrollState()

    // Exact pixel positions measured via onGloballyPositioned on the target rows.
    // -1 means not yet measured.
    var amudBOffsetPx by remember(segments) { mutableIntStateOf(-1) }
    val verseOffsetsPx = remember(segments) { HashMap<Int, Int>() }

    // Tanakh uses Noto Serif Hebrew (covers cantillation marks); others use Frank Ruhl.
    // Frank Ruhl runs visually smaller than the system font — apply size compensation only
    // when using it (non-Tanakh) and the "Larger main text" toggle is on.
    // iPhone/compact screens: +1 compensation (Frank Ruhl looks proportionally larger on small screens)
    // Tablet/wide screens:    +2 compensation
    val hebrewFontFamily = if (isTanakh) notoSerifFamily else frankRuhlFamily
    val frankRuhlOffset = if (isTanakh) 0f else 2f   // Frank Ruhl runs smaller — static compensation
    val heFontSize = (9f + fontSizeLevel * 2f + frankRuhlOffset).coerceAtLeast(10f)
    val enFontSize = (7f + fontSizeLevel * 2f).coerceAtLeast(10f)
    val enBothFontSize = (6f + fontSizeLevel * 2f).coerceAtLeast(10f)

    // Scroll to verse — waits for the target row's measured position.
    LaunchedEffect(scrollToVerse, segments) {
        if (scrollToVerse != null && segments.isNotEmpty()) {
            val targetSegIdx = scrollToVerse - 1   // 0-based segment index
            // Poll up to ~1 s for the layout measurement to arrive.
            repeat(20) {
                val offset = verseOffsetsPx[targetSegIdx]
                if (offset != null) {
                    scrollState.animateScrollTo(offset)
                    onScrollToVerseConsumed()
                    return@LaunchedEffect
                }
                delay(50)
            }
            onScrollToVerseConsumed()   // give up but consume so we don't loop
        }
    }

    // Scroll to amud B marker — waits for the marker row's measured position.
    LaunchedEffect(scrollToAmudB, segments) {
        if (scrollToAmudB && segments.isNotEmpty()) {
            repeat(20) {
                val offset = amudBOffsetPx
                if (offset >= 0) {
                    scrollState.animateScrollTo(offset)
                    onScrollToAmudBConsumed()
                    return@LaunchedEffect
                }
                delay(50)
            }
            onScrollToAmudBConsumed()
        }
    }

    SelectionContainer {
        Column(
            modifier = modifier
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            for (segment in segments) {
                if (segment.isAmudBMarker) {
                    AmudBMarker(
                        daf = segment.markerDaf,
                        fontSizeLevel = fontSizeLevel,
                        modifier = Modifier.onGloballyPositioned { coords ->
                            val y = coords.positionInParent().y.toInt()
                            if (amudBOffsetPx != y) amudBOffsetPx = y
                        }
                    )
                } else {
                    SegmentRow(
                        segment = segment,
                        displayMode = displayMode,
                        useBoldHighlight = useBoldHighlight,
                        heFontSize = heFontSize,
                        enFontSize = enFontSize,
                        enBothFontSize = enBothFontSize,
                        showTrop = showTrop,
                        hebrewFontFamily = hebrewFontFamily,
                        modifier = Modifier.onGloballyPositioned { coords ->
                            val y = coords.positionInParent().y.toInt()
                            verseOffsetsPx[segment.index] = y
                        }
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
            }
            Spacer(modifier = Modifier.height(80.dp)) // bottom padding for panel
        }
    }
}

@Composable
private fun AmudBMarker(daf: Int, fontSizeLevel: Int = 0, modifier: Modifier = Modifier) {
    val colors = LocalAnyTorahColors.current
    val markerSize = (13f + fontSizeLevel * 2f).coerceAtLeast(10f)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = colors.dividerColor
        )
        Text(
            text = "  ${daf}b  ",
            color = colors.editorialColor,
            fontSize = markerSize.sp,
            fontWeight = FontWeight.SemiBold
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = colors.dividerColor
        )
    }
}

@Composable
private fun SegmentRow(
    segment: TextSegment,
    displayMode: TextDisplayMode,
    useBoldHighlight: Boolean = true,
    heFontSize: Float = 18f,
    enFontSize: Float = 16f,
    enBothFontSize: Float = 15f,
    showTrop: Boolean = false,
    hebrewFontFamily: FontFamily = frankRuhlFamily,
    modifier: Modifier = Modifier
) {
    val colors = LocalAnyTorahColors.current
    val hasRaavad = segment.raavadHe != null || segment.raavadEn != null

    Column(modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth()) {
            // Label column
            if (segment.label != null) {
                Text(
                    text = segment.label,
                    color = colors.editorialColor,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .width(28.dp)
                        .padding(top = 2.dp),
                    textAlign = TextAlign.End
                )
                Spacer(modifier = Modifier.width(8.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                when (displayMode) {
                    TextDisplayMode.SOURCE -> {
                        if (segment.hebrewHTML.isNotEmpty()) {
                            HebrewText(html = segment.hebrewHTML, fontSize = heFontSize, showTrop = showTrop, fontFamily = hebrewFontFamily)
                        }
                    }
                    TextDisplayMode.TRANSLATION -> {
                        if (segment.englishHTML.isNotEmpty()) {
                            EnglishText(html = segment.englishHTML, fontSize = enFontSize, useBoldHighlight = useBoldHighlight)
                        }
                    }
                    TextDisplayMode.BOTH -> {
                        if (segment.hebrewHTML.isNotEmpty()) {
                            HebrewText(html = segment.hebrewHTML, fontSize = heFontSize, showTrop = showTrop, fontFamily = hebrewFontFamily)
                            Spacer(modifier = Modifier.height(6.dp))
                        }
                        if (segment.englishHTML.isNotEmpty()) {
                            EnglishText(html = segment.englishHTML, fontSize = enBothFontSize, useBoldHighlight = useBoldHighlight)
                        }
                    }
                }
            }
        }

        if (hasRaavad) {
            HorizontalDivider(
                modifier = Modifier.padding(top = 6.dp),
                color = colors.appForeground.copy(alpha = 0.25f)
            )
            RaavadBlock(segment = segment, displayMode = displayMode, heFontSize = heFontSize, enFontSize = enBothFontSize)
        }

        HorizontalDivider(
            modifier = Modifier.padding(top = 6.dp),
            color = colors.appForeground.copy(alpha = 0.15f)
        )
    }
}

@Composable
private fun RaavadBlock(
    segment: TextSegment,
    displayMode: TextDisplayMode,
    heFontSize: Float = 17f,
    enFontSize: Float = 15f
) {
    val colors = LocalAnyTorahColors.current
    val showHe = displayMode != TextDisplayMode.TRANSLATION && segment.raavadHe != null
    val showEn = displayMode != TextDisplayMode.SOURCE && segment.raavadEn != null
    Column(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
        if (showHe) {
            val annotated = buildAnnotatedString {
                pushStyle(SpanStyle(color = colors.editorialColor, fontWeight = FontWeight.SemiBold))
                append("השגות הראב״ד: ")
                pop()
                append(segment.raavadHe!!)
            }
            Text(
                text = annotated,
                color = colors.appForeground,
                fontSize = heFontSize.sp,
                lineHeight = (heFontSize * 1.7f).sp,
                style = TextStyle(textDirection = TextDirection.Rtl),
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (showEn) {
            if (showHe) Spacer(modifier = Modifier.height(4.dp))
            val annotated = buildAnnotatedString {
                pushStyle(SpanStyle(color = colors.editorialColor, fontWeight = FontWeight.SemiBold))
                append("Ra'avad: ")
                pop()
                append(segment.raavadEn!!)
            }
            Text(
                text = annotated,
                color = colors.appForeground,
                fontSize = enFontSize.sp,
                lineHeight = (enFontSize * 1.6f).sp,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

private val frankRuhlFamily = FontFamily(Font(R.font.frank_ruhl_libre_regular))
private val notoSerifFamily  = FontFamily(Font(R.font.noto_serif_hebrew_regular))

@Composable
fun HebrewText(html: String, fontSize: Float = 18f, showTrop: Boolean = false,
               fontFamily: FontFamily = frankRuhlFamily) {
    val colors = LocalAnyTorahColors.current
    if (html.contains("<rf>")) {
        // Build AnnotatedString with smaller-size spans for <rf>…</rf> sequential markers.
        // Normal spans go through processedHebrew; small (rf) marker spans are ASCII — strip only.
        val rawSegments = SefariaTextClient.parseRashiSegments(html)
        val annotated = buildAnnotatedString {
            for ((text, isSmall) in rawSegments) {
                if (isSmall) {
                    pushStyle(SpanStyle(fontSize = (fontSize - 5f).coerceAtLeast(10f).sp))
                    append(text)  // SA bracket markers are plain ASCII — no trop to strip
                    pop()
                } else {
                    val processed = SefariaTextClient.processedHebrew(text, showTrop)
                    pushStyle(SpanStyle(fontSize = fontSize.sp, fontFamily = fontFamily))
                    append(processed)
                    pop()
                }
            }
        }
        Text(
            text = annotated,
            color = colors.appForeground,
            lineHeight = (fontSize * 1.7f).sp,
            style = TextStyle(textDirection = TextDirection.Rtl),
            modifier = Modifier.fillMaxWidth()
        )
    } else {
        val clean = SefariaTextClient.processedHebrew(html, showTrop)
        Text(
            text = clean,
            color = colors.appForeground,
            fontSize = fontSize.sp,
            lineHeight = (fontSize * 1.7f).sp,
            fontFamily = fontFamily,
            style = TextStyle(textDirection = TextDirection.Rtl),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun EnglishText(html: String, fontSize: Float = 16f, useBoldHighlight: Boolean = true) {
    val colors = LocalAnyTorahColors.current
    // For Tanakh main text (useBoldHighlight=false): strip bold content (lemas / footnote
    // anchors that repeat the source before the translation) and render plain.
    // For Talmud/Mishnah: keep amber editorial color to distinguish text types.
    val annotated = if (useBoldHighlight) {
        buildBoldAnnotatedString(html, colors.editorialColor)
    } else {
        buildBoldAnnotatedString(SefariaTextClient.stripBoldContent(html), colors.appForeground)
    }
    Text(
        text = annotated,
        color = colors.appForeground,
        fontSize = fontSize.sp,
        lineHeight = (fontSize * 1.6f).sp,
        modifier = Modifier.fillMaxWidth()
    )
}

fun buildBoldAnnotatedString(html: String, boldColor: Color): AnnotatedString {
    val segments = SefariaTextClient.parseBoldSegments(html)
    return buildAnnotatedString {
        for ((text, isBold) in segments) {
            if (isBold) {
                pushStyle(SpanStyle(color = boldColor, fontWeight = FontWeight.SemiBold))
                append(text)
                pop()
            } else {
                append(text)
            }
        }
    }
}
