package com.anytorah.ui.screens

import com.anytorah.api.SefariaTextClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.api.YomiService
import com.anytorah.models.MidrashNavigationMode
import com.anytorah.models.MidrashSubcategory
import com.anytorah.models.MidrashWork
import com.anytorah.models.MishnahSubcategory
import com.anytorah.models.torahVerseCount
import com.anytorah.models.SASimanNames
import com.anytorah.models.TalmudSubcategory
import com.anytorah.models.TextCatalog
import com.anytorah.models.TextCategory
import com.anytorah.ui.components.WheelPicker
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TextSelectorScreen(
    vm: TextReaderViewModel,
    onRead: () -> Unit,
    onBack: (() -> Unit)? = null,
    showHeader: Boolean = onBack != null
) {
    val colors = LocalAnyTorahColors.current
    val scope = rememberCoroutineScope()
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

    var yomiResults by remember { mutableStateOf<YomiService.YomiResults?>(null) }
    var isLoadingYomi by remember { mutableStateOf(false) }

    LaunchedEffect(vm.category) {
        isLoadingYomi = true
        yomiResults = YomiService.fetchToday()
        isLoadingYomi = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.appBackground)
    ) {
        // Top row: Back (left) | category name (center) | gear (right) — hidden when embedded
        if (showHeader) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (onBack != null) {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = colors.appForeground
                        )
                    }
                }
                Text(
                    text = vm.category.displayName,
                    color = colors.appForeground,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f).padding(horizontal = 4.dp)
                )
                IconButton(onClick = { showSettings = true }) {
                    Icon(Icons.Default.Settings, contentDescription = "Settings", tint = colors.appForeground.copy(alpha = 0.75f))
                }
            }

            HorizontalDivider(color = colors.dividerColor)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            when (vm.category) {
                TextCategory.TANAKH -> TanakhWheels(vm = vm, yomiResults = yomiResults, isLoadingYomi = isLoadingYomi)
                TextCategory.MISHNAH -> MishnahWheels(vm = vm, yomiResults = yomiResults, isLoadingYomi = isLoadingYomi)
                TextCategory.TALMUD -> TalmudWheels(vm = vm, yomiResults = yomiResults, isLoadingYomi = isLoadingYomi)
                TextCategory.RAMBAM -> RambamWheels(vm = vm, yomiResults = yomiResults, isLoadingYomi = isLoadingYomi)
                TextCategory.SHULCHAN_ARUKH -> SAWheels(vm = vm)
                TextCategory.MIDRASH -> MidrashWheels(vm = vm)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    vm.load()
                    onRead()
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.editorialColor,
                    contentColor = Color(0xFF1B3A8A)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(if (vm.saHebrewMode) "קרא" else "Read", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// MARK: - Tanakh Wheels

@Composable
private fun TanakhWheels(vm: TextReaderViewModel, yomiResults: YomiService.YomiResults?, isLoadingYomi: Boolean) {
    val colors = LocalAnyTorahColors.current
    val sections = TextCatalog.tanakhSections
    val hebrewMode = vm.saHebrewMode

    val sectionIndex = when {
        vm.tanakhBookIndex <= 4 -> 0
        vm.tanakhBookIndex <= 25 -> 1
        else -> 2
    }
    val currentSection = sections.getOrNull(sectionIndex)
    val books = currentSection?.books ?: emptyList()
    val bookIndexInSection = books.indexOfFirst { it.id == vm.tanakhBookIndex }.coerceAtLeast(0)
    val currentBook = books.getOrNull(bookIndexInSection)
    val chapterCount = currentBook?.chapters ?: 1

    if (hebrewMode) {
        // RTL: Chapter | Book | Section (section on far right)
        SelectorLabel("פרק")
        WheelPicker(
            items = (1..chapterCount).map { SASimanNames.toHebrewNumeral(it) },
            selectedIndex = (vm.tanakhChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = { vm.tanakhChapter = it + 1 }
        )
        SelectorLabel("ספר")
        WheelPicker(
            items = books.map { it.hebrewName.strippingNikud() },
            selectedIndex = bookIndexInSection,
            onIndexSelected = { newIdx ->
                val book = books.getOrNull(newIdx)
                if (book != null) vm.setTanakhBook(book.id)
            }
        )
        SelectorLabel("חלק")
        WheelPicker(
            items = sections.map { it.hebrewName.strippingNikud() },
            selectedIndex = sectionIndex,
            onIndexSelected = { newSec ->
                val firstBook = sections.getOrNull(newSec)?.books?.firstOrNull()
                if (firstBook != null) vm.setTanakhBook(firstBook.id)
            }
        )
    } else {
        SelectorLabel("Section")
        WheelPicker(
            items = sections.map { it.name },
            selectedIndex = sectionIndex,
            onIndexSelected = { newSec ->
                val firstBook = sections.getOrNull(newSec)?.books?.firstOrNull()
                if (firstBook != null) vm.setTanakhBook(firstBook.id)
            }
        )
        SelectorLabel("Book")
        WheelPicker(
            items = books.map { it.name },
            selectedIndex = bookIndexInSection,
            onIndexSelected = { newIdx ->
                val book = books.getOrNull(newIdx)
                if (book != null) vm.setTanakhBook(book.id)
            }
        )
        SelectorLabel("Chapter")
        WheelPicker(
            items = (1..chapterCount).map { it.toString() },
            selectedIndex = (vm.tanakhChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = { vm.tanakhChapter = it + 1 }
        )
    }

    // Yomi buttons
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        YomiButton(
            label = "Today's 929",
            enabled = !isLoadingYomi && yomiResults?.tanakh != null,
            modifier = Modifier.weight(1f)
        ) {
            val r = yomiResults?.tanakh ?: return@YomiButton
            vm.setTanakhBook(r.bookIndex)
            vm.tanakhChapter = r.chapter
        }
        YomiButton(
            label = yomiResults?.parsha?.name?.let { "Parsha: $it" } ?: "Parsha",
            enabled = !isLoadingYomi && yomiResults?.parsha != null,
            modifier = Modifier.weight(1f)
        ) {
            val r = yomiResults?.parsha ?: return@YomiButton
            vm.setTanakhBook(r.bookIndex)
            vm.tanakhChapter = r.chapter
            vm.tanakhScrollToVerse = r.verse
        }
    }
}

// MARK: - Mishnah Wheels

@Composable
private fun MishnahWheels(vm: TextReaderViewModel, yomiResults: YomiService.YomiResults?, isLoadingYomi: Boolean) {
    val sedarim = TextCatalog.mishnahSedarim
    val allTractates = TextCatalog.allMishnahTractates
    val hebrewMode = vm.saHebrewMode
    val isTosefta = vm.mishnahSubcategory == MishnahSubcategory.TOSEFTA
    val tractate = vm.currentMishnahTractate
    val chapterCount = if (isTosefta) {
        (tractate?.toseftaChapters ?: 1).coerceAtLeast(1)
    } else {
        tractate?.chapters ?: 1
    }
    val currentChapter = if (isTosefta) vm.toseftaChapter else vm.mishnahChapter

    // Subcategory toggle
    val colors = LocalAnyTorahColors.current
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        MishnahSubcategory.entries.forEachIndexed { idx, sub ->
            SegmentedButton(
                selected = vm.mishnahSubcategory == sub,
                onClick = { vm.mishnahSubcategory = sub },
                shape = SegmentedButtonDefaults.itemShape(index = idx, count = MishnahSubcategory.entries.size),
                label = { Text(if (hebrewMode) sub.hebrewName else sub.displayName) }
            )
        }
    }

    if (hebrewMode) {
        // RTL: Chapter | Tractate | Seder (seder on far right)
        SelectorLabel("פרק")
        WheelPicker(
            items = (1..chapterCount).map { SASimanNames.toHebrewNumeral(it) },
            selectedIndex = (currentChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = { if (isTosefta) vm.toseftaChapter = it + 1 else vm.mishnahChapter = it + 1 }
        )
        SelectorLabel("מסכת")
        WheelPicker(
            items = allTractates.map { it.hebrewName.strippingNikud() },
            selectedIndex = vm.mishnahGlobalTractateIndex,
            onIndexSelected = { vm.setMishnahGlobalTractate(it) },
            baseFontSize = 19.sp
        )
        SelectorLabel("סדר")
        WheelPicker(
            items = sedarim.map { it.hebrewName.strippingNikud() },
            selectedIndex = vm.mishnahSederIndex,
            onIndexSelected = { newSeder ->
                vm.mishnahSederIndex = newSeder
                vm.mishnahTractateIndexInSeder = 0
                vm.mishnahChapter = 1
                vm.toseftaChapter = 1
            }
        )
    } else {
        SelectorLabel("Seder")
        WheelPicker(
            items = sedarim.map { it.name },
            selectedIndex = vm.mishnahSederIndex,
            onIndexSelected = { newSeder ->
                vm.mishnahSederIndex = newSeder
                vm.mishnahTractateIndexInSeder = 0
                vm.mishnahChapter = 1
                vm.toseftaChapter = 1
            }
        )
        SelectorLabel("Tractate")
        WheelPicker(
            items = allTractates.map { it.name },
            selectedIndex = vm.mishnahGlobalTractateIndex,
            onIndexSelected = { vm.setMishnahGlobalTractate(it) },
            baseFontSize = 19.sp
        )
        SelectorLabel("Chapter")
        WheelPicker(
            items = (1..chapterCount).map { it.toString() },
            selectedIndex = (currentChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = { if (isTosefta) vm.toseftaChapter = it + 1 else vm.mishnahChapter = it + 1 }
        )
    }

    if (!isTosefta) {
        YomiButton(
            label = "Mishnah Yomi",
            enabled = !isLoadingYomi && yomiResults?.mishnah != null,
            modifier = Modifier.fillMaxWidth()
        ) {
            val r = yomiResults?.mishnah ?: return@YomiButton
            vm.setMishnahSeder(r.sederIndex)
            vm.setMishnahTractate(r.tractateIndexInSeder)
            vm.mishnahChapter = r.chapter
        }
    }
}

// MARK: - Talmud Wheels

@Composable
private fun TalmudWheels(vm: TextReaderViewModel, yomiResults: YomiService.YomiResults?, isLoadingYomi: Boolean) {
    val hebrewMode = vm.saHebrewMode

    // Subcategory toggle
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        TalmudSubcategory.entries.forEachIndexed { idx, sub ->
            SegmentedButton(
                selected = vm.talmudSubcategory == sub,
                onClick = { vm.talmudSubcategory = sub },
                shape = SegmentedButtonDefaults.itemShape(index = idx, count = TalmudSubcategory.entries.size),
                label = { Text(if (hebrewMode) sub.hebrewName else sub.displayName) }
            )
        }
    }

    if (vm.talmudSubcategory == TalmudSubcategory.YERUSHALMI) {
        YerushalmiWheels(vm = vm)
    } else {
        BavliWheels(vm = vm, yomiResults = yomiResults, isLoadingYomi = isLoadingYomi)
    }
}

@Composable
private fun BavliWheels(vm: TextReaderViewModel, yomiResults: YomiService.YomiResults?, isLoadingYomi: Boolean) {
    val allTractates = TextCatalog.allTalmudTractates
    val currentTractate = vm.currentTalmudTractate
    val hebrewMode = vm.saHebrewMode
    val startDaf = currentTractate?.startDaf ?: 2
    val endDaf = currentTractate?.endDaf ?: 2
    val colors = LocalAnyTorahColors.current

    val tractateColumn: @Composable (Modifier) -> Unit = { mod ->
        Column(modifier = mod) {
            WheelPicker(
                items = if (hebrewMode) allTractates.map { it.hebrewName.strippingNikud() } else allTractates.map { it.name },
                selectedIndex = vm.talmudGlobalTractateIndex,
                onIndexSelected = { vm.setTalmudGlobalTractate(it) },
                baseFontSize = 19.sp
            )
        }
    }

    val dafAmudColumn: @Composable (Modifier) -> Unit = { mod ->
        Column(modifier = mod) {
            // Amud pills at top — no "Daf" or "Amud" labels needed (self-explanatory)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(bottom = 4.dp)
            ) {
                listOf(0, 1).forEach { amud ->
                    val label = if (hebrewMode) (if (amud == 0) "ע״א" else "ע״ב") else (if (amud == 0) "a" else "b")
                    val isSelected = vm.talmudAmud == amud
                    androidx.compose.material3.TextButton(
                        onClick = { vm.talmudAmud = amud },
                        modifier = Modifier
                            .background(
                                if (isSelected) colors.appForeground else colors.appForeground.copy(alpha = 0.12f),
                                RoundedCornerShape(50)
                            )
                            .padding(horizontal = 0.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            label,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) colors.appBackground else colors.appForeground
                        )
                    }
                }
            }
            val dafItems = if (hebrewMode) (startDaf..endDaf).map { SASimanNames.toHebrewNumeral(it) }
                           else (startDaf..endDaf).map { it.toString() }
            WheelPicker(
                items = dafItems,
                selectedIndex = (vm.talmudDaf - startDaf).coerceIn(0, dafItems.size - 1),
                onIndexSelected = { vm.talmudDaf = startDaf + it }
            )
        }
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (hebrewMode) {
            // RTL: Daf+Amud left (narrow), Tractate right (wide)
            dafAmudColumn(Modifier.weight(1f))
            tractateColumn(Modifier.weight(2f))
        } else {
            // LTR: Tractate left (wide), Daf+Amud right (narrow)
            tractateColumn(Modifier.weight(2f))
            dafAmudColumn(Modifier.weight(1f))
        }
    }

    YomiButton(
        label = "Daf Yomi",
        enabled = !isLoadingYomi && yomiResults?.daf != null,
        modifier = Modifier.fillMaxWidth()
    ) {
        val r = yomiResults?.daf ?: return@YomiButton
        vm.setTalmudSeder(r.sederIndex)
        vm.setTalmudTractate(r.tractateIndexInSeder)
        vm.talmudDaf = r.daf
    }
}

@Composable
private fun YerushalmiWheels(vm: TextReaderViewModel) {
    val allTractates = vm.allYerushalmiTractates
    val hebrewMode = vm.saHebrewMode
    val tractate = vm.currentYerushalmiTractate
    val chapterCount = (tractate?.yerushalmiChapters ?: 1).coerceAtLeast(1)
    val globalIdx = vm.yerushalmiGlobalTractateIndex

    // Fetch actual halakha count for the selected chapter from Sefaria shape API.
    // Key on tractate+chapter so it re-fetches whenever either changes.
    val shapeKey = "${globalIdx}_${vm.yerushalmiChapter}"
    LaunchedEffect(shapeKey) {
        if (tractate != null) {
            val count = SefariaTextClient.fetchYerushalmiHalakhaCount(tractate, vm.yerushalmiChapter)
            vm.yerushalmiHalakhaCount = count
            // Snap halakha back to last valid value if it's now out of range
            if (vm.yerushalmiHalakha > count) vm.yerushalmiHalakha = count
        }
    }

    val halakhaCount = vm.yerushalmiHalakhaCount.coerceAtLeast(1)

    if (hebrewMode) {
        // RTL: Halakha | Chapter | Tractate (tractate on far right)
        SelectorLabel("הלכה")
        WheelPicker(
            items = (1..halakhaCount).map { SASimanNames.toHebrewNumeral(it) },
            selectedIndex = (vm.yerushalmiHalakha - 1).coerceIn(0, halakhaCount - 1),
            onIndexSelected = { vm.yerushalmiHalakha = it + 1 }
        )
        SelectorLabel("פרק")
        WheelPicker(
            items = (1..chapterCount).map { SASimanNames.toHebrewNumeral(it) },
            selectedIndex = (vm.yerushalmiChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = {
                vm.yerushalmiChapter = it + 1
                vm.yerushalmiHalakha = 1
            }
        )
        SelectorLabel("מסכת")
        WheelPicker(
            items = allTractates.map { it.hebrewName.strippingNikud() },
            selectedIndex = globalIdx.coerceIn(0, (allTractates.size - 1).coerceAtLeast(0)),
            onIndexSelected = { vm.setYerushalmiGlobalTractate(it) },
            baseFontSize = 19.sp
        )
    } else {
        SelectorLabel("Tractate")
        WheelPicker(
            items = allTractates.map { it.name },
            selectedIndex = globalIdx.coerceIn(0, (allTractates.size - 1).coerceAtLeast(0)),
            onIndexSelected = { vm.setYerushalmiGlobalTractate(it) },
            baseFontSize = 19.sp
        )
        SelectorLabel("Chapter")
        WheelPicker(
            items = (1..chapterCount).map { it.toString() },
            selectedIndex = (vm.yerushalmiChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = {
                vm.yerushalmiChapter = it + 1
                vm.yerushalmiHalakha = 1
            }
        )
        SelectorLabel("Halakha")
        WheelPicker(
            items = (1..halakhaCount).map { it.toString() },
            selectedIndex = (vm.yerushalmiHalakha - 1).coerceIn(0, halakhaCount - 1),
            onIndexSelected = { vm.yerushalmiHalakha = it + 1 }
        )
    }
}

// MARK: - Rambam Wheels

@Composable
private fun RambamWheels(vm: TextReaderViewModel, yomiResults: YomiService.YomiResults?, isLoadingYomi: Boolean) {
    val sefarim = TextCatalog.rambamSefarim
    val works = vm.rambamWorkCandidates
    val currentWork = vm.currentRambamWork
    val hebrewMode = vm.saHebrewMode
    val chapterCount = currentWork?.chapters ?: 1

    val hasIntro = vm.rambamHasIntro
    val offset = if (hasIntro) 1 else 0

    if (hebrewMode) {
        // RTL: Chapter | Hilkhot | Sefer (sefer on far right)
        SelectorLabel("פרק")
        val heLabels = buildList {
            if (hasIntro) add("הקדמה")
            addAll((1..chapterCount).map { SASimanNames.toHebrewNumeral(it) })
        }
        val heIdx = if (vm.rambamChapter == 0 && hasIntro) 0 else (vm.rambamChapter - 1 + offset).coerceIn(0, heLabels.size - 1)
        WheelPicker(
            items = heLabels,
            selectedIndex = heIdx,
            onIndexSelected = { vm.rambamChapter = if (hasIntro) it else it + 1 }
        )
        SelectorLabel("הלכות")
        WheelPicker(
            items = works.map { it.hebrewName.strippingNikud() },
            selectedIndex = vm.rambamWorkIndexInSefer,
            onIndexSelected = { vm.setRambamWork(it) }
        )
        SelectorLabel("ספר")
        WheelPicker(
            items = sefarim.map { it.hebrewName.strippingNikud().strippingSeferPrefix() },
            selectedIndex = vm.rambamSeferIndex,
            onIndexSelected = { vm.setRambamSefer(it) }
        )
    } else {
        SelectorLabel("Sefer")
        WheelPicker(
            items = sefarim.map { it.name },
            selectedIndex = vm.rambamSeferIndex,
            onIndexSelected = { vm.setRambamSefer(it) }
        )
        SelectorLabel("Work")
        WheelPicker(
            items = works.map { it.name },
            selectedIndex = vm.rambamWorkIndexInSefer,
            onIndexSelected = { vm.setRambamWork(it) }
        )
        SelectorLabel("Chapter")
        val enLabels = buildList {
            if (hasIntro) add("Intro")
            addAll((1..chapterCount).map { it.toString() })
        }
        val enIdx = if (vm.rambamChapter == 0 && hasIntro) 0 else (vm.rambamChapter - 1 + offset).coerceIn(0, enLabels.size - 1)
        WheelPicker(
            items = enLabels,
            selectedIndex = enIdx,
            onIndexSelected = { vm.rambamChapter = if (hasIntro) it else it + 1 }
        )
    }

    YomiButton(
        label = "Rambam Yomi",
        enabled = !isLoadingYomi && yomiResults?.rambam != null,
        modifier = Modifier.fillMaxWidth()
    ) {
        val r = yomiResults?.rambam ?: return@YomiButton
        vm.setRambamSefer(r.seferIndex)
        vm.setRambamWork(r.workIndexInSefer)
        vm.rambamChapter = r.chapter
    }
}

// MARK: - SA Wheels

@Composable
private fun SAWheels(vm: TextReaderViewModel) {
    val colors = LocalAnyTorahColors.current
    val saBooks = TextCatalog.shulchanArukhSections

    // Topic sections for the current book
    val topicSections = when (vm.saSection) {
        0 -> SASimanNames.sectionsOH
        1 -> SASimanNames.sectionsYD
        2 -> SASimanNames.sectionsEH
        3 -> SASimanNames.sectionsHM
        else -> SASimanNames.sectionsOH
    }

    // Topic section index — resets when book changes; initialises from current siman
    var topicSectionIdx by remember(vm.saSection) {
        mutableStateOf(
            topicSections.indexOfFirst { vm.saSiman >= it.start && vm.saSiman <= it.end }
                .coerceAtLeast(0)
        )
    }

    val currentTopicSection = topicSections.getOrNull(topicSectionIdx) ?: topicSections.firstOrNull()
    val simanStart = currentTopicSection?.start ?: 1
    val simanEnd   = currentTopicSection?.end   ?: (saBooks.getOrNull(vm.saSection)?.simanim ?: 1)

    val saBookHebNames = listOf("אורח חיים", "יורה דעה", "אבן העזר", "חושן משפט")

    // ── Book picker — segmented row of buttons ──
    // In Hebrew mode, iterate reversed so אורח חיים (OH) is on the far right
    val bookIndices = if (vm.saHebrewMode) saBooks.indices.reversed().toList() else saBooks.indices.toList()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .background(colors.cardBackground, RoundedCornerShape(8.dp)),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        bookIndices.forEach { index ->
            val book = saBooks[index]
            val isSelected = vm.saSection == index
            val displayName = if (vm.saHebrewMode)
                saBookHebNames.getOrElse(index) { book.name }
            else
                book.name
            androidx.compose.material3.TextButton(
                onClick = {
                    if (vm.saSection != index) {
                        vm.saSection = index
                        vm.saSiman = 1
                    }
                },
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = displayName,
                    color = if (isSelected) colors.editorialColor else colors.appForeground.copy(alpha = 0.5f),
                    fontSize = 11.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
            }
        }
    }

    Spacer(modifier = Modifier.height(10.dp))   // breathing room before column labels

    // ── Section + Siman wheels ──
    // Hebrew RTL: Siman on LEFT, Section on RIGHT (RTL reading order)
    // English LTR: Section on LEFT, Siman on RIGHT
    val sectionItems = topicSections.indices.map { i ->
        if (vm.saHebrewMode)
            (SASimanNames.sectionHebName(vm.saSection, i) ?: topicSections[i].name).strippingNikud()
        else {
            val raw = topicSections[i].name
            if (raw.startsWith("Laws of ")) raw.removePrefix("Laws of ") else raw
        }
    }
    val simanLabels = (simanStart..simanEnd).map { s ->
        if (vm.saHebrewMode) {
            val h = SASimanNames.toHebrewNumeral(s)
            val name = SASimanNames.simanName(vm.saSection, s)
            if (name != null) "$h – $name" else h
        } else {
            val enName = SASimanNames.simanNameEn(vm.saSection, s)
            if (enName != null) "$s – $enName" else "$s"
        }
    }

    val sectionColumn: @Composable (Modifier) -> Unit = { mod ->
        Column(modifier = mod) {
            SelectorLabel(if (vm.saHebrewMode) "נושא" else "Section")
            WheelPicker(
                items = sectionItems,
                selectedIndex = topicSectionIdx,
                visibleItems = 3,
                onIndexSelected = { idx ->
                    topicSectionIdx = idx
                    val sec = topicSections.getOrNull(idx)
                    if (sec != null) vm.saSiman = sec.start
                }
            )
        }
    }

    val simanColumn: @Composable (Modifier) -> Unit = { mod ->
        Column(modifier = mod) {
            SelectorLabel(if (vm.saHebrewMode) "סימן" else "Siman")
            WheelPicker(
                items = simanLabels,
                selectedIndex = (vm.saSiman - simanStart).coerceIn(0, simanLabels.size - 1),
                visibleItems = 3,
                onIndexSelected = { idx -> vm.saSiman = simanStart + idx }
            )
        }
    }

    Row(modifier = Modifier.fillMaxWidth()) {
        if (vm.saHebrewMode) {
            // RTL: Siman LEFT, Section RIGHT
            simanColumn(Modifier.weight(1f))
            sectionColumn(Modifier.weight(1f))
        } else {
            // LTR: Section LEFT, Siman RIGHT
            sectionColumn(Modifier.weight(1f))
            simanColumn(Modifier.weight(1f))
        }
    }
}

// MARK: - Helper composables

@Composable
private fun SelectorLabel(text: String) {
    val colors = LocalAnyTorahColors.current
    Text(
        text = text,
        color = colors.secondaryText,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.padding(bottom = 4.dp)
    )
}

@Composable
private fun YomiButton(
    label: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val colors = LocalAnyTorahColors.current
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = colors.editorialColor,
            disabledContentColor = colors.secondaryText
        )
    ) {
        Text(label, fontSize = 15.sp, maxLines = 1)
    }
}

// MARK: - Midrash Wheels

@Composable
private fun MidrashWheels(vm: TextReaderViewModel) {
    val hebrewMode = vm.saHebrewMode
    val colors = LocalAnyTorahColors.current

    val availableWorks = MidrashWork.worksFor(vm.midrashSubcategory)
    val workIdx = availableWorks.indexOf(vm.midrashWork).coerceAtLeast(0)

    val availableBooks = TextCatalog.allTanakhBooks.filter { it.id in vm.midrashWork.applicableBookIndices }
    val bookIdx = availableBooks.indexOfFirst { it.id == vm.midrashBookIndex }.coerceAtLeast(0)

    val currentBook = availableBooks.getOrNull(bookIdx)
    val chapterCount = currentBook?.chapters ?: 1
    val verseCount = torahVerseCount(vm.midrashBookIndex, vm.midrashChapter)

    // Subcategory toggle
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        MidrashSubcategory.entries.forEachIndexed { idx, sub ->
            SegmentedButton(
                selected = vm.midrashSubcategory == sub,
                onClick = {
                    if (vm.midrashSubcategory != sub) {
                        vm.midrashSubcategory = sub
                        val firstWork = MidrashWork.worksFor(sub).first()
                        vm.midrashWork = firstWork
                        if (firstWork.applicableBookIndices.isNotEmpty()) {
                            vm.midrashBookIndex = firstWork.applicableBookIndices.first()
                        }
                        vm.midrashChapter = 1
                        vm.midrashVerse = 1
                    }
                },
                shape = SegmentedButtonDefaults.itemShape(index = idx, count = MidrashSubcategory.entries.size),
                label = { Text(if (hebrewMode) sub.hebrewName else sub.displayName, fontSize = 13.sp) }
            )
        }
    }

    Spacer(modifier = Modifier.height(8.dp))

    // Work picker
    SelectorLabel(if (hebrewMode) "מדרש" else "Work")
    WheelPicker(
        items = availableWorks.map { if (hebrewMode) it.hebrewName else it.displayName },
        selectedIndex = workIdx,
        onIndexSelected = { idx ->
            val newWork = availableWorks.getOrNull(idx) ?: return@WheelPicker
            vm.midrashWork = newWork
            if (!newWork.applicableBookIndices.contains(vm.midrashBookIndex)) {
                vm.midrashBookIndex = newWork.applicableBookIndices.firstOrNull() ?: 1
            }
            vm.midrashChapter = 1
            vm.midrashVerse = 1
            vm.midrashNativeChapter = 1
            vm.midrashNativeSection = 1
        }
    )

    Spacer(modifier = Modifier.height(8.dp))

    // Navigation mode toggle
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        listOf("By Verse" to MidrashNavigationMode.BY_VERSE, "Native" to MidrashNavigationMode.NATIVE)
            .forEachIndexed { idx, (label, mode) ->
                SegmentedButton(
                    selected = vm.midrashNavigationMode == mode,
                    onClick = {
                        vm.midrashNavigationMode = mode
                        vm.midrashNativeChapter = 1
                        vm.midrashNativeSection = 1
                    },
                    shape = SegmentedButtonDefaults.itemShape(index = idx, count = 2),
                    label = { Text(label, fontSize = 13.sp) }
                )
            }
    }

    Spacer(modifier = Modifier.height(8.dp))

    if (vm.midrashNavigationMode == MidrashNavigationMode.NATIVE) {
        // Native navigation: chapter/section based on work structure
        val chapLabels = vm.midrashWork.nativeChapterLabels
        SelectorLabel(vm.midrashWork.nativeChapterLabel)
        WheelPicker(
            items = chapLabels,
            selectedIndex = (vm.midrashNativeChapter - 1).coerceIn(0, chapLabels.size - 1),
            onIndexSelected = { vm.midrashNativeChapter = it + 1; vm.midrashNativeSection = 1 }
        )

        if (!vm.midrashWork.nativeIsOneLevel) {
            SelectorLabel("Section")
            WheelPicker(
                items = (1..50).map { it.toString() },
                selectedIndex = (vm.midrashNativeSection - 1).coerceIn(0, 49),
                onIndexSelected = { vm.midrashNativeSection = it + 1 }
            )
        }
    } else {
        // By-verse navigation: Torah book/chapter/verse
        if (availableBooks.size > 1) {
            SelectorLabel(if (hebrewMode) "ספר" else "Book")
            WheelPicker(
                items = availableBooks.map { if (hebrewMode) it.hebrewName.strippingNikud() else it.name },
                selectedIndex = bookIdx,
                onIndexSelected = { idx ->
                    val book = availableBooks.getOrNull(idx) ?: return@WheelPicker
                    vm.midrashBookIndex = book.id
                    vm.midrashChapter = 1
                    vm.midrashVerse = 1
                }
            )
        }

        SelectorLabel(if (hebrewMode) "פרק" else "Chapter")
        WheelPicker(
            items = (1..chapterCount).map { if (hebrewMode) SASimanNames.toHebrewNumeral(it) else it.toString() },
            selectedIndex = (vm.midrashChapter - 1).coerceIn(0, chapterCount - 1),
            onIndexSelected = { vm.midrashChapter = it + 1; vm.midrashVerse = 1 }
        )

        SelectorLabel(if (hebrewMode) "פסוק" else "Verse")
        WheelPicker(
            items = (1..verseCount).map { if (hebrewMode) SASimanNames.toHebrewNumeral(it) else it.toString() },
            selectedIndex = (vm.midrashVerse - 1).coerceIn(0, verseCount - 1),
            onIndexSelected = { vm.midrashVerse = it + 1 }
        )
    }
}

// MARK: - Helpers

/** Strip Hebrew nikud (vowel points U+05B0–U+05C7) and cantillation marks (U+0591–U+05AF). */
private fun String.strippingNikud(): String =
    filter { c -> c.code < 0x0591 || c.code > 0x05C7 }

/** Strip leading "ספר " prefix (used to shorten Rambam sefer names in Hebrew picker). */
private fun String.strippingSeferPrefix(): String =
    if (startsWith("ספר ")) substring("ספר ".length) else this
