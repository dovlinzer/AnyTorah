package com.anytorah.ui.screens

import android.content.res.Configuration
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.HistoryEdu
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.TextCategory
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: TextReaderViewModel,
    onRead: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    var showSettings by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var activeCategory by remember {
        mutableStateOf<TextCategory?>(vm.lastSelectedCategory)
    }

    // Sync VM on first composition if restoring a saved category
    if (activeCategory != null && vm.category != activeCategory) {
        vm.category = activeCategory!!
    }

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
        activeCategory = cat
        vm.lastSelectedCategory = cat
        vm.category = cat
        vm.restoreState(cat)
    }

    if (isLandscape) {
        // Landscape: side-by-side layout
        Row(modifier = Modifier.fillMaxSize().background(colors.appBackground)) {
            // Left panel: title + gear + vertical category list
            Column(
                modifier = Modifier
                    .width(160.dp)
                    .fillMaxHeight()
                    .padding(horizontal = 10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 14.dp, bottom = 10.dp)
                ) {
                    Text(
                        text = "AnyTorah",
                        color = colors.appForeground,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.Center)
                    )
                    IconButton(
                        onClick = { showSettings = true },
                        modifier = Modifier.align(Alignment.CenterEnd).size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Settings,
                            contentDescription = "Settings",
                            tint = colors.appForeground.copy(alpha = 0.75f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextCategory.values().forEach { cat ->
                        LandscapeCategoryButton(
                            category = cat,
                            isSelected = cat == activeCategory,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { selectCategory(cat) }
                        )
                    }
                }
            }

            VerticalDivider(color = colors.dividerColor)

            // Right panel: selector or empty state
            if (activeCategory != null) {
                TextSelectorScreen(
                    vm = vm,
                    onRead = onRead,
                    onBack = null,
                    showHeader = false
                )
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Select a category",
                        color = colors.appForeground.copy(alpha = 0.40f),
                        fontSize = 15.sp
                    )
                }
            }
        }
    } else {
        // Portrait: stacked layout
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

            // 2-row (3 + 2) category grid — cards in row 2 match row 1 width (1/3 each)
            val allCategories = TextCategory.values().toList()
            val row1 = allCategories.take(3)
            val row2 = allCategories.drop(3)
            val gridSpacing = 8.dp

            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp)
            ) {
                val cardWidth = (maxWidth - gridSpacing * 2) / 3

                Column(verticalArrangement = Arrangement.spacedBy(gridSpacing)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(gridSpacing)) {
                        row1.forEach { cat ->
                            PortraitCategoryCard(
                                category = cat,
                                isSelected = cat == activeCategory,
                                modifier = Modifier.width(cardWidth),
                                onClick = { selectCategory(cat) }
                            )
                        }
                    }
                    // Row 2: 2 cards, same card width as row 1, centered
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(gridSpacing)) {
                            row2.forEach { cat ->
                                PortraitCategoryCard(
                                    category = cat,
                                    isSelected = cat == activeCategory,
                                    modifier = Modifier.width(cardWidth),
                                    onClick = { selectCategory(cat) }
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = colors.dividerColor)

            // Selector slides down from the divider; empty state when nothing selected
            AnimatedVisibility(
                visible = activeCategory != null,
                enter = slideInVertically(initialOffsetY = { -it / 3 }) + fadeIn(),
                exit = fadeOut()
            ) {
                TextSelectorScreen(
                    vm = vm,
                    onRead = onRead,
                    onBack = null,
                    showHeader = false
                )
            }

            if (activeCategory == null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Select a category to begin",
                        color = colors.appForeground.copy(alpha = 0.40f),
                        fontSize = 15.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun PortraitCategoryCard(
    category: TextCategory,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val bgAlpha = if (isSelected) 0.22f else 0.08f
    val borderAlpha = if (isSelected) 0.50f else 0.15f
    val borderWidth = if (isSelected) 1.5.dp else 0.5.dp

    Column(
        modifier = modifier
            .height(90.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(colors.appForeground.copy(alpha = bgAlpha))
            .border(borderWidth, colors.appForeground.copy(alpha = borderAlpha), RoundedCornerShape(12.dp))
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
            color = colors.appForeground.copy(alpha = if (isSelected) 1f else 0.75f),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            lineHeight = 14.sp,
            maxLines = 2
        )
    }
}

@Composable
private fun LandscapeCategoryButton(
    category: TextCategory,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val bgAlpha = if (isSelected) 0.22f else 0.08f
    val borderAlpha = if (isSelected) 0.50f else 0.12f
    val borderWidth = if (isSelected) 1.5.dp else 0.5.dp

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(colors.appForeground.copy(alpha = bgAlpha))
            .border(borderWidth, colors.appForeground.copy(alpha = borderAlpha), RoundedCornerShape(10.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            )
            .padding(horizontal = 10.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = categoryIcon(category),
            contentDescription = null,
            tint = colors.appForeground,
            modifier = Modifier.size(17.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = category.displayName,
            color = colors.appForeground.copy(alpha = if (isSelected) 1f else 0.80f),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1
        )
    }
}

private fun categoryIcon(category: TextCategory): ImageVector = when (category) {
    TextCategory.TANAKH -> Icons.Default.Book
    TextCategory.MISHNAH -> Icons.Default.LibraryBooks
    TextCategory.TALMUD -> Icons.Default.AutoStories
    TextCategory.RAMBAM -> Icons.Default.Star
    TextCategory.SHULCHAN_ARUKH -> Icons.Default.FormatListBulleted
    TextCategory.MIDRASH -> Icons.Default.HistoryEdu
}
