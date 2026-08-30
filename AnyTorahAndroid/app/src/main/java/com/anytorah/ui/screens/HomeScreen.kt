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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Email
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.MidrashNavigationMode
import com.anytorah.models.MidrashSubcategory
import com.anytorah.models.MidrashWork
import com.anytorah.models.MishnahSubcategory
import com.anytorah.models.TalmudSubcategory
import com.anytorah.models.TeshuvotSubcategory
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
                .padding(top = 48.dp, start = 12.dp, end = 4.dp, bottom = 24.dp)
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

        Box(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
            Column(
                modifier = Modifier
                    .widthIn(max = 600.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                        HomeCategoryEntry.leftColumn.forEach { entry ->
                            CategoryTile(entry = entry, onClick = { select(entry) })
                        }
                    }
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                        HomeCategoryEntry.rightColumn.forEach { entry ->
                            CategoryTile(entry = entry, onClick = { select(entry) })
                        }
                    }
                }

                // Teshuvot gets its own row below the two-column grid, not a slot inside it —
                // per explicit product direction, it's conceptually a third tier (rite/era of
                // the responsa literature), not just another sibling pair like Mishnah/Tosefta.
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    HorizontalDivider(color = colors.appForeground.copy(alpha = 0.2f))
                    Text(
                        text = "Teshuvot",
                        color = colors.appForeground,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HomeCategoryEntry.teshuvotRow.forEach { entry ->
                            Box(modifier = Modifier.weight(1f)) {
                                CategoryTile(entry = entry, onClick = { select(entry) })
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Icon + label, gradient background — matches AnyYCTorah's `TopicCard`. Dimmed and
 *  non-interactive when `entry.isEnabled` is false (the "Contemporary" Teshuvot placeholder).
 *  `entry.compact` (the Teshuvot row tiles) drops the icon and uses a smaller label size —
 *  three tiles split one row's width there, instead of each getting a full-width row like the
 *  two-column grid above. */
@Composable
private fun CategoryTile(entry: HomeCategoryEntry, onClick: () -> Unit) {
    val fg = Color.White

    Row(
        modifier = Modifier
            .fillMaxWidth()
            // Fixed height (not just a floor) so the three Teshuvot row tiles come out
            // identically tall regardless of whether a label happens to wrap to a second line
            // -- a Row doesn't equalize sibling heights on its own, so before this fix
            // "Contemporary" (longer than "Rishonim"/"Acharonim") could wrap and grow taller
            // than its neighbors. Matches iOS's same fix in HomeCombinedView.swift.
            .height(if (entry.compact) 52.dp else 64.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(entry.colorFamily.brush)
            .let {
                if (entry.isEnabled) {
                    it.clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onClick
                    )
                } else {
                    it.alpha(0.4f)
                }
            }
            .padding(if (entry.compact) 10.dp else 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (!entry.compact) {
            Icon(
                imageVector = entry.icon,
                contentDescription = null,
                tint = fg,
                modifier = Modifier.width(24.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
        }
        Text(
            text = entry.label,
            color = fg,
            fontSize = if (entry.compact) 12.sp else 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2
        )
    }
}

/** One home-screen category button. `applySelection` forces the specific subcategory this
 *  button represents; a no-op for categories with no subcategory concept (Tanakh, Rambam,
 *  Tur, Shulkhan Arukh). `isEnabled` false renders a dimmed, non-interactive tile — used only
 *  by the "Contemporary" Teshuvot placeholder. */
private data class HomeCategoryEntry(
    val label: String,
    val icon: ImageVector,
    val colorFamily: BrandColorFamily,
    val category: TextCategory,
    // isEnabled/compact sit BEFORE applySelection (not after) so trailing-lambda call syntax
    // keeps working for every existing entry — Kotlin's trailing lambda always binds to the
    // literal last constructor parameter, so applySelection must stay last; their defaults let
    // every ordinary call omit them positionally, with only the Teshuvot-row entries needing to
    // pass either explicitly (as named arguments: `isEnabled = false`, `compact = true`).
    val isEnabled: Boolean = true,
    /** True for the Teshuvot row tiles — see `CategoryTile`'s doc comment. */
    val compact: Boolean = false,
    val applySelection: (TextReaderViewModel) -> Unit
) {
    companion object {
        val leftColumn = listOf(
            HomeCategoryEntry("Tanakh", Icons.Default.Book, BrandColorFamily.PURPLE, TextCategory.TANAKH) { },
            HomeCategoryEntry("Midrash Aggada", Icons.Default.FormatQuote, BrandColorFamily.VIOLET, TextCategory.MIDRASH) { vm ->
                applyMidrashSubcategory(vm, MidrashSubcategory.AGGADA)
            },
            HomeCategoryEntry("Midrash Halakha", Icons.Default.HistoryEdu, BrandColorFamily.VIOLET, TextCategory.MIDRASH) { vm ->
                applyMidrashSubcategory(vm, MidrashSubcategory.HALAKHA)
            },
            HomeCategoryEntry("Mishnah", Icons.Default.LibraryBooks, BrandColorFamily.PLUM, TextCategory.MISHNAH) { vm ->
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
            HomeCategoryEntry("Talmud Yerushalmi", Icons.Default.AccountBalance, BrandColorFamily.BLUE, TextCategory.TALMUD) { vm ->
                vm.talmudSubcategory = TalmudSubcategory.YERUSHALMI
            },
            HomeCategoryEntry("Tur", Icons.Default.MenuBook, BrandColorFamily.ROYAL_BLUE, TextCategory.TUR) { },
            HomeCategoryEntry("Shulkhan Arukh", Icons.Default.FormatListBulleted, BrandColorFamily.ROYAL_BLUE, TextCategory.SHULCHAN_ARUKH) { },
            HomeCategoryEntry("Rambam", Icons.Default.Star, BrandColorFamily.SKY_BLUE, TextCategory.RAMBAM) { },
        )

        /** A third row below the two-column grid, not part of either column. All three share
         *  the navy family (just different shades) so the row reads as one group, and all
         *  three are `compact` (no icon, smaller font) since three tiles split one row's width
         *  instead of each getting a full-width row like the grid above. */
        val teshuvotRow = listOf(
            HomeCategoryEntry("Rishonim", Icons.Default.Email, BrandColorFamily.NAVY, TextCategory.TESHUVOT,
                compact = true) { vm ->
                vm.setTeshuvotSubcategory(TeshuvotSubcategory.RISHONIM)
            },
            HomeCategoryEntry("Acharonim", Icons.Default.Email, BrandColorFamily.NAVY_STEEL, TextCategory.TESHUVOT,
                compact = true) { vm ->
                vm.setTeshuvotSubcategory(TeshuvotSubcategory.ACHARONIM)
            },
            // "Contemp." not "Contemporary" -- the full word is prone to wrapping to a second
            // line at this tile's width/font. Enabled 2026-08-29 -- Android port shipped.
            HomeCategoryEntry("Contemp.", Icons.Default.Email, BrandColorFamily.NAVY_DEEP, TextCategory.TESHUVOT,
                compact = true) { vm ->
                vm.setTeshuvotSubcategory(TeshuvotSubcategory.CONTEMPORARY)
            },
        )

        /** Mirrors the reset `MidrashSubcategory`'s own toggle used to perform in
         *  `TextSelectorScreen`'s `MidrashWheels` before that toggle was removed — Android's
         *  `midrashSubcategory` has no didSet-equivalent cascade of its own (unlike iOS), so
         *  the work/book/chapter/verse reset has to happen here explicitly. Also forces the
         *  navigation mode: Midrash Halakha is always organized natively (chapter/halakha or
         *  perek/pasuk) rather than by Tanakh verse, per 2026-08-25 request — Midrash Aggada
         *  keeps the by-verse default. */
        private fun applyMidrashSubcategory(vm: TextReaderViewModel, sub: MidrashSubcategory) {
            vm.midrashSubcategory = sub
            val firstWork = MidrashWork.worksFor(sub).first()
            vm.midrashWork = firstWork
            if (firstWork.applicableBookIndices.isNotEmpty()) {
                vm.midrashBookIndex = firstWork.applicableBookIndices.first()
            }
            vm.midrashChapter = 1
            vm.midrashVerse = 1
            vm.midrashNavigationMode = if (sub == MidrashSubcategory.HALAKHA)
                MidrashNavigationMode.NATIVE else MidrashNavigationMode.BY_VERSE
        }
    }
}
