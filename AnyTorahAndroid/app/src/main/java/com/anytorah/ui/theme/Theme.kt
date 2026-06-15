package com.anytorah.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// App-specific colors
val DeepBlue = Color(0xFF1B3A8A)       // dark theme background
val EditorialAmber = Color(0xFFF0CC72) // bold text highlight on dark bg
val EditorialIndigo = Color(0xFF1A3399) // bold text highlight on light bg

data class AnyTorahColors(
    val appBackground: Color,
    val appForeground: Color,
    val editorialColor: Color,
    val cardBackground: Color,
    val dividerColor: Color,
    val secondaryText: Color,
    val isLight: Boolean
)

val LocalAnyTorahColors = staticCompositionLocalOf {
    AnyTorahColors(
        appBackground = DeepBlue,
        appForeground = Color.White,
        editorialColor = EditorialAmber,
        cardBackground = Color(0xFF2A4AA0),
        dividerColor = Color(0xFF3B5BC0),
        secondaryText = Color(0xFFB0C4FF),
        isLight = false
    )
}

private val darkColors = AnyTorahColors(
    appBackground = DeepBlue,
    appForeground = Color.White,
    editorialColor = EditorialAmber,
    cardBackground = Color(0xFF2A4AA0),
    dividerColor = Color(0xFF3B5BC0),
    secondaryText = Color(0xFFB0C4FF),
    isLight = false
)

private val lightColors = AnyTorahColors(
    appBackground = Color.White,
    appForeground = Color.Black,
    editorialColor = EditorialIndigo,
    cardBackground = Color(0xFFF2F4FF),
    dividerColor = Color(0xFFDDE3FF),
    secondaryText = Color(0xFF555577),
    isLight = true
)

private val DarkMaterialScheme = darkColorScheme(
    primary = Color(0xFF6B8FFF),
    secondary = Color(0xFF8FA8FF),
    background = DeepBlue,
    surface = Color(0xFF2A4AA0),
    onBackground = Color.White,
    onSurface = Color.White,
)

private val LightMaterialScheme = lightColorScheme(
    primary = Color(0xFF1A3399),
    secondary = Color(0xFF3355BB),
    background = Color.White,
    surface = Color(0xFFF2F4FF),
    onBackground = Color.Black,
    onSurface = Color.Black,
)

@Composable
fun AnyTorahTheme(
    useWhiteBackground: Boolean = false,
    content: @Composable () -> Unit
) {
    val appColors = if (useWhiteBackground) lightColors else darkColors
    val materialScheme = if (useWhiteBackground) LightMaterialScheme else DarkMaterialScheme

    CompositionLocalProvider(LocalAnyTorahColors provides appColors) {
        MaterialTheme(
            colorScheme = materialScheme,
            content = content
        )
    }
}
