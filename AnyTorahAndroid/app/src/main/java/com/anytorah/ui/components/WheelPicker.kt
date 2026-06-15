package com.anytorah.ui.components

import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.ui.theme.LocalAnyTorahColors
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * A smooth wheel-picker composable using LazyColumn with snap behavior.
 * The center item is highlighted; items above/below are faded.
 */
@Composable
fun WheelPicker(
    items: List<String>,
    selectedIndex: Int,
    onIndexSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
    visibleItems: Int = 5,
    itemHeight: Dp = 44.dp,
    /** Base font size for non-centered items; centered item is 2sp larger. */
    baseFontSize: androidx.compose.ui.unit.TextUnit = 15.sp
) {
    val colors = LocalAnyTorahColors.current
    val listState = rememberLazyListState()
    val snapFlingBehavior = rememberSnapFlingBehavior(listState)
    val totalHeight = itemHeight * visibleItems
    val centerOffset = visibleItems / 2

    // Scroll to selected on external changes
    LaunchedEffect(selectedIndex, items.size) {
        if (items.isNotEmpty() && selectedIndex in items.indices) {
            listState.scrollToItem(
                index = (selectedIndex + centerOffset).coerceIn(0, (items.size + visibleItems - 1).coerceAtLeast(0)),
                scrollOffset = 0
            )
        }
    }

    // Detect the center-visible item and report it
    val centeredIndex by remember {
        derivedStateOf {
            val firstVisible = listState.firstVisibleItemIndex
            val offset = listState.firstVisibleItemScrollOffset
            val centerItem = if (offset > itemHeight.value * 0.5f) firstVisible + 1 else firstVisible
            (centerItem - centerOffset).coerceIn(0, (items.size - 1).coerceAtLeast(0))
        }
    }

    LaunchedEffect(listState) {
        snapshotFlow { centeredIndex }
            .distinctUntilChanged()
            .collect { idx ->
                if (idx != selectedIndex) {
                    onIndexSelected(idx)
                }
            }
    }

    Box(modifier = modifier.height(totalHeight)) {
        // Selection indicator lines
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.Center)
        ) {
            HorizontalDivider(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(top = (totalHeight / 2) - (itemHeight / 2)),
                color = colors.appForeground.copy(alpha = 0.7f),
                thickness = 1.dp
            )
            HorizontalDivider(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(top = (totalHeight / 2) + (itemHeight / 2)),
                color = colors.appForeground.copy(alpha = 0.7f),
                thickness = 1.dp
            )
        }

        // Padded item list with leading/trailing spacers to allow center alignment
        LazyColumn(
            state = listState,
            flingBehavior = snapFlingBehavior,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Leading spacer items
            items(centerOffset) {
                Box(modifier = Modifier.height(itemHeight).fillMaxWidth())
            }

            itemsIndexed(items) { idx, item ->
                val isCentered = idx == centeredIndex
                val alpha = when {
                    isCentered -> 1f
                    kotlin.math.abs(idx - centeredIndex) == 1 -> 0.55f
                    else -> 0.25f
                }
                Box(
                    modifier = Modifier.height(itemHeight).fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = item,
                        color = colors.appForeground.copy(alpha = alpha),
                        fontSize = if (isCentered) (baseFontSize.value + 2).sp else baseFontSize,
                        fontWeight = if (isCentered) FontWeight.SemiBold else FontWeight.Normal,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }
            }

            // Trailing spacer items
            items(centerOffset) {
                Box(modifier = Modifier.height(itemHeight).fillMaxWidth())
            }
        }
    }
}
