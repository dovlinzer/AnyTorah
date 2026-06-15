package com.anytorah.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.HistoryEdu
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.TextCategory
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryMenuScreen(
    vm: TextReaderViewModel,
    onCategorySelected: () -> Unit
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.appBackground)
    ) {
        // Gear icon — upper left
        IconButton(
            onClick = { showSettings = true },
            modifier = Modifier.align(Alignment.TopStart).padding(4.dp)
        ) {
            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = colors.appForeground.copy(alpha = 0.75f))
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
        Spacer(modifier = Modifier.height(48.dp))

        Text(
            text = "AnyTorah",
            color = colors.appForeground,
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "בחר קטגוריה",
            color = colors.appForeground.copy(alpha = 0.7f),
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
        )

        // 3 + 2 grid layout
        val categories = TextCategory.values().toList()

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // First row: 3 cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                categories.take(3).forEach { cat ->
                    CategoryCard(
                        category = cat,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            vm.category = cat
                            vm.restoreState(cat)
                            onCategorySelected()
                        }
                    )
                }
            }
            // Second row: 2 cards centered
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    categories.drop(3).take(2).forEach { cat ->
                        CategoryCard(
                            category = cat,
                            modifier = Modifier.size(width = 140.dp, height = 120.dp),
                            onClick = {
                                vm.category = cat
                                onCategorySelected()
                            }
                        )
                    }
                }
            }
        }
        } // end inner Column
    } // end Box
}

@Composable
private fun CategoryCard(
    category: TextCategory,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val colors = LocalAnyTorahColors.current

    Card(
        modifier = modifier
            .height(120.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = colors.cardBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = categoryIcon(category),
                contentDescription = null,
                tint = colors.editorialColor,
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = category.displayName,
                color = colors.appForeground,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            Text(
                text = category.hebrewName,
                color = colors.appForeground.copy(alpha = 0.7f),
                fontSize = 13.sp,
                textAlign = TextAlign.Center
            )
        }
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
