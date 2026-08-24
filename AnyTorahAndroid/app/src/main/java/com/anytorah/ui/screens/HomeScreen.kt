package com.anytorah.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.FormatQuote
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.MidrashSubcategory
import com.anytorah.models.MidrashWork
import com.anytorah.models.MishnahSubcategory
import com.anytorah.models.TalmudSubcategory
import com.anytorah.models.TextCategory
import com.anytorah.ui.theme.BrandColorFamily
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel

/**
 * Home screen: category buttons only, styled after AnyYCTorah's two-column gradient tile grid
 * (`HomeView.swift`/`BrandGradients.swift`) — purple-family tiles on the left, blue-family
 * tiles on the right. Tapping a category restores its last-used selection (or a sensible
 * default) and immediately opens the reader — book/chapter/daf navigation happens from the
 * picker controls in the reader's own header, not here.
 *
 * Mishnah/Tosefta, Talmud Bavli/Talmud Yerushalmi, and Midrash Halakha/Midrash Aggada are each
 * their own independent, flat entry here — not sub-choices within a shared category. Under the
 * hood they still share `TextCategory.MISHNAH`/`TALMUD`/`MIDRASH` plus a fixed subcategory
 * (that's how the underlying Sefaria data and navigation wheels are genuinely organized), but
 * nothing downstream ever re-presents that as a toggle or a nested choice — see
 * `TextReaderViewModel.categoryDisplayName` and `TextSelectorScreen`'s removed subcategory
 * toggle.
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

    fun select(entry: HomeCategoryEntry) {
        vm.category = entry.category
        vm.restoreState(entry.category)
        entry.applySelection(vm)
        vm.load()
        onRead()
    }

    Column(
        modifier = Modifier.fillMaxSize().background(colors.appBackground)
    ) {
        // Header: title + gear (top-right, standard convention)
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

        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            Row(
                modifier = Modifier
                    .widthIn(max = 600.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    HomeCategoryEntry.leftColumn.forEach { entry ->
                        CategoryTile(entry = entry, onClick = { select(entry) })
                    }
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    HomeCategoryEntry.rightColumn.forEach { entry ->
                        CategoryTile(entry = entry, onClick = { select(entry) })
                    }
                }
            }
        }
    }
}

/** Icon + label, gradient background — matches AnyYCTorah's `TopicCard`. */
@Composable
private fun CategoryTile(entry: HomeCategoryEntry, onClick: () -> Unit) {
    val fg = if (entry.colorFamily.prefersDarkForeground) Color.Black.copy(alpha = 0.75f) else Color.White

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .sizeIn(minHeight = 64.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(entry.colorFamily.brush)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            )
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = entry.icon,
            contentDescription = null,
            tint = fg,
            modifier = Modifier.width(24.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = entry.label,
            color = fg,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2
        )
    }
}

/** One home-screen category button. `applySelection` forces the specific subcategory this
 *  button represents; a no-op for categories with no subcategory concept (Tanakh, Rambam,
 *  Tur, Shulkhan Arukh). */
private data class HomeCategoryEntry(
    val label: String,
    val icon: ImageVector,
    val colorFamily: BrandColorFamily,
    val category: TextCategory,
    val applySelection: (TextReaderViewModel) -> Unit
) {
    companion object {
        val leftColumn = listOf(
            HomeCategoryEntry("Tanakh", Icons.Default.Book, BrandColorFamily.PURPLE, TextCategory.TANAKH) { },
            HomeCategoryEntry("Midrash Aggada", Icons.Default.FormatQuote, BrandColorFamily.VIOLET, TextCategory.MIDRASH) { vm ->
                applyMidrashSubcategory(vm, MidrashSubcategory.AGGADA)
            },
            HomeCategoryEntry("Midrash Halakha", Icons.Default.HistoryEdu, BrandColorFamily.LAVENDER, TextCategory.MIDRASH) { vm ->
                applyMidrashSubcategory(vm, MidrashSubcategory.HALAKHA)
            },
            HomeCategoryEntry("Mishnah", Icons.Default.LibraryBooks, BrandColorFamily.BLOSSOM, TextCategory.MISHNAH) { vm ->
                vm.mishnahSubcategory = MishnahSubcategory.MISHNAH
            },
            HomeCategoryEntry("Tosefta", Icons.Default.Description, BrandColorFamily.PLUM, TextCategory.MISHNAH) { vm ->
                vm.mishnahSubcategory = MishnahSubcategory.TOSEFTA
            },
        )

        val rightColumn = listOf(
            HomeCategoryEntry("Talmud Bavli", Icons.Default.AutoStories, BrandColorFamily.BLUE, TextCategory.TALMUD) { vm ->
                vm.talmudSubcategory = TalmudSubcategory.BAVLI
            },
            HomeCategoryEntry("Talmud Yerushalmi", Icons.Default.AccountBalance, BrandColorFamily.ROYAL_BLUE, TextCategory.TALMUD) { vm ->
                vm.talmudSubcategory = TalmudSubcategory.YERUSHALMI
            },
            HomeCategoryEntry("Tur", Icons.Default.MenuBook, BrandColorFamily.SKY_BLUE, TextCategory.TUR) { },
            HomeCategoryEntry("Shulkhan Arukh", Icons.Default.FormatListBulleted, BrandColorFamily.TEAL, TextCategory.SHULCHAN_ARUKH) { },
            HomeCategoryEntry("Rambam", Icons.Default.Star, BrandColorFamily.NAVY, TextCategory.RAMBAM) { },
        )

        /** Mirrors the reset `MidrashSubcategory`'s own toggle used to perform in
         *  `TextSelectorScreen`'s `MidrashWheels` before that toggle was removed — Android's
         *  `midrashSubcategory` has no didSet-equivalent cascade of its own (unlike iOS), so
         *  the work/book/chapter/verse reset has to happen here explicitly. */
        private fun applyMidrashSubcategory(vm: TextReaderViewModel, sub: MidrashSubcategory) {
            vm.midrashSubcategory = sub
            val firstWork = MidrashWork.worksFor(sub).first()
            vm.midrashWork = firstWork
            if (firstWork.applicableBookIndices.isNotEmpty()) {
                vm.midrashBookIndex = firstWork.applicableBookIndices.first()
            }
            vm.midrashChapter = 1
            vm.midrashVerse = 1
        }
    }
}
