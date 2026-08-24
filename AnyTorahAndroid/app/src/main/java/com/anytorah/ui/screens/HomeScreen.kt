package com.anytorah.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.HistoryEdu
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.TextCategory
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel

/**
 * Home screen: category buttons only. Tapping a category restores its last-used
 * selection (or a sensible default) and immediately opens the reader — book/chapter/daf
 * navigation happens from the picker controls in the reader's own header, not here.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: TextReaderViewModel,
    onRead: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    var showSettings by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    if (showSettings) {
        ModalBottomSheet(
            onDismissRequest = { showSettings = false },
            sheetState = sheetState,
            containerColor = colors.cardBackground
        ) {
            SettingsScreen(vm = vm, onDismiss = { showSettings = false })
        }
    }

    fun selectCategory(cat: TextCategory) {
        vm.category = cat
        vm.restoreState(cat)
        vm.load()
        onRead()
    }

    Column(
        modifier = Modifier.fillMaxSize().background(colors.appBackground)
    ) {
        // Header: title + gear
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 48.dp, start = 12.dp, end = 4.dp, bottom = 12.dp)
        ) {
            Text(
                text = "AnyTorah",
                color = colors.appForeground,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.Center)
            )
            IconButton(
                onClick = { showSettings = true },
                modifier = Modifier.align(Alignment.CenterEnd)
            ) {
                Icon(
                    Icons.Default.Settings,
                    contentDescription = "Settings",
                    tint = colors.appForeground.copy(alpha = 0.75f)
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            // Category grid, wrapped 3-per-row (grows to fit however many categories exist).
            // A hardcoded take(3)/drop(3) split here previously assumed exactly 5 categories
            // fit in row 2 (<=3) — once Tur became the 7th category, row 2 held 4 items at a
            // fixed 1/3-width each, overflowing the row. Chunking avoids baking in a count.
            val allCategories = TextCategory.values().toList()
            val categoryRows = allCategories.chunked(3)
            val gridSpacing = 8.dp

            BoxWithConstraints(
                modifier = Modifier
                    .widthIn(max = 480.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
            ) {
                val cardWidth = (maxWidth - gridSpacing * 2) / 3

                Column(verticalArrangement = Arrangement.spacedBy(gridSpacing)) {
                    categoryRows.forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = if (row.size == 3) Arrangement.spacedBy(gridSpacing)
                                                     else Arrangement.Center
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(gridSpacing)) {
                                row.forEach { cat ->
                                    CategoryCard(
                                        category = cat,
                                        modifier = Modifier.width(cardWidth),
                                        onClick = { selectCategory(cat) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryCard(
    category: TextCategory,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val colors = LocalAnyTorahColors.current

    Column(
        modifier = modifier
            .height(90.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(colors.appForeground.copy(alpha = 0.08f))
            .border(0.5.dp, colors.appForeground.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = categoryIcon(category),
            contentDescription = null,
            tint = colors.appForeground,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(5.dp))
        Text(
            text = category.displayName,
            color = colors.appForeground.copy(alpha = 0.85f),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            lineHeight = 14.sp,
            maxLines = 2
        )
    }
}

private fun categoryIcon(category: TextCategory): ImageVector = when (category) {
    TextCategory.TANAKH -> Icons.Default.Book
    TextCategory.MISHNAH -> Icons.Default.LibraryBooks
    TextCategory.TALMUD -> Icons.Default.AutoStories
    TextCategory.RAMBAM -> Icons.Default.Star
    TextCategory.TUR -> Icons.Default.MenuBook
    TextCategory.SHULCHAN_ARUKH -> Icons.Default.FormatListBulleted
    TextCategory.MIDRASH -> Icons.Default.HistoryEdu
}
