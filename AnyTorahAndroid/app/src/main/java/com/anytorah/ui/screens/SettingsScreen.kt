package com.anytorah.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.models.TextDisplayMode
import com.anytorah.ui.theme.LocalAnyTorahColors
import com.anytorah.viewmodels.TextReaderViewModel

@Composable
fun SettingsScreen(
    vm: TextReaderViewModel,
    onDismiss: () -> Unit
) {
    val colors = LocalAnyTorahColors.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.cardBackground)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Settings",
                color = colors.appForeground,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = colors.appForeground)
            }
        }

        HorizontalDivider(color = colors.dividerColor, modifier = Modifier.padding(vertical = 8.dp))

        // Theme toggle
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text("White Background", color = colors.appForeground, fontSize = 15.sp)
                Text(
                    "Switch between deep blue and white theme",
                    color = colors.secondaryText,
                    fontSize = 12.sp
                )
            }
            Switch(
                checked = vm.useWhiteBackground,
                onCheckedChange = { vm.updateBackground(it) },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = colors.editorialColor,
                    checkedTrackColor = colors.editorialColor.copy(alpha = 0.4f)
                )
            )
        }

        HorizontalDivider(color = colors.dividerColor, modifier = Modifier.padding(vertical = 4.dp))

        // Text size — dots selector matching AnyDaf style
        val fontSizeName = when (vm.fontSizeLevel) {
            -2 -> "Smallest"
            -1 -> "Small"
            1  -> "Large"
            2  -> "Largest"
            else -> "Default"
        }
        val fontLevels = listOf(-2, -1, 0, 1, 2)

        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text("Text Size", color = colors.appForeground, fontSize = 15.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Small A
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(36.dp)
                        .clickable(enabled = vm.fontSizeLevel > -2) {
                            vm.updateFontSizeLevel(vm.fontSizeLevel - 1)
                        }
                ) {
                    Text(
                        "A",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (vm.fontSizeLevel > -2) colors.appForeground
                                else colors.appForeground.copy(alpha = 0.3f)
                    )
                }

                // Growing dots — each dot's diameter increases with its index
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    fontLevels.forEachIndexed { i, level ->
                        val dotDp = (5 + i * 2).dp
                        Box(
                            modifier = Modifier
                                .size(dotDp)
                                .clip(CircleShape)
                                .background(
                                    if (vm.fontSizeLevel == level) colors.appForeground
                                    else colors.appForeground.copy(alpha = 0.25f)
                                )
                                .clickable { vm.updateFontSizeLevel(level) }
                        )
                        if (i < fontLevels.size - 1) Spacer(modifier = Modifier.width(8.dp))
                    }
                }

                // Large A
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(36.dp)
                        .clickable(enabled = vm.fontSizeLevel < 2) {
                            vm.updateFontSizeLevel(vm.fontSizeLevel + 1)
                        }
                ) {
                    Text(
                        "A",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (vm.fontSizeLevel < 2) colors.appForeground
                                else colors.appForeground.copy(alpha = 0.3f)
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                fontSizeName,
                color = colors.appForeground.copy(alpha = 0.6f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }

        HorizontalDivider(color = colors.dividerColor, modifier = Modifier.padding(vertical = 4.dp))

        // Trop + panel font boost
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text("Show cantillation marks (trop)", color = colors.appForeground, fontSize = 15.sp)
                Text(
                    if (vm.showTrop) "Cantillation marks shown in Tanakh text alongside vowels."
                    else "Only vowel points shown; cantillation marks hidden.",
                    color = colors.secondaryText,
                    fontSize = 12.sp
                )
            }
            Switch(
                checked = vm.showTrop,
                onCheckedChange = { vm.updateShowTrop(it) },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = colors.editorialColor,
                    checkedTrackColor = colors.editorialColor.copy(alpha = 0.4f)
                )
            )
        }

        // Light commentary panel — only meaningful in dark mode
        if (!vm.useWhiteBackground) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                    Text("Light commentary panel", color = colors.appForeground, fontSize = 15.sp)
                }
                Switch(
                    checked = vm.sidePanelContrast,
                    onCheckedChange = { vm.updateSidePanelContrast(it) },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = colors.editorialColor,
                        checkedTrackColor = colors.editorialColor.copy(alpha = 0.4f)
                    )
                )
            }
        }

        HorizontalDivider(color = colors.dividerColor, modifier = Modifier.padding(vertical = 4.dp))

        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text("Rashi script for Rashi commentary", color = colors.appForeground, fontSize = 15.sp)
            }
            Switch(
                checked = vm.useRashiFont,
                onCheckedChange = { vm.updateUseRashiFont(it) },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = colors.editorialColor,
                    checkedTrackColor = colors.editorialColor.copy(alpha = 0.4f)
                )
            )
        }

        HorizontalDivider(color = colors.dividerColor, modifier = Modifier.padding(vertical = 4.dp))

        // SA navigation language
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text("Navigation", color = colors.appForeground, fontSize = 15.sp)
                Text(
                    if (vm.saHebrewMode)
                        "Hebrew RTL — Hebrew names, Hebrew numerals"
                    else
                        "English LTR — English names, Arabic numerals",
                    color = colors.secondaryText,
                    fontSize = 12.sp
                )
            }
            Switch(
                checked = vm.saHebrewMode,
                onCheckedChange = { vm.updateSaHebrewMode(it) },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = colors.editorialColor,
                    checkedTrackColor = colors.editorialColor.copy(alpha = 0.4f)
                )
            )
        }

        HorizontalDivider(color = colors.dividerColor, modifier = Modifier.padding(vertical = 4.dp))

        // Display mode
        Text(
            "Default Display Mode",
            color = colors.appForeground,
            fontSize = 15.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
        )

        val displayOptions = listOf(
            TextDisplayMode.SOURCE to "Hebrew (Source)",
            TextDisplayMode.TRANSLATION to "English (Translation)",
            TextDisplayMode.BOTH to "Both"
        )

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            displayOptions.forEach { (mode, label) ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(label, color = colors.appForeground, fontSize = 14.sp)
                    Switch(
                        checked = vm.displayMode == mode,
                        onCheckedChange = { if (it) vm.updateDisplayMode(mode) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = colors.editorialColor,
                            checkedTrackColor = colors.editorialColor.copy(alpha = 0.4f)
                        )
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}
