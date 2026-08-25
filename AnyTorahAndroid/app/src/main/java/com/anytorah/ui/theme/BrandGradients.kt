package com.anytorah.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Home-screen tile gradients — borrows the two-column, brand-anchored gradient aesthetic from
 * AnyYCTorah's `BrandGradients.swift`/`HomeView.swift` (each tile is a three-stop diagonal
 * gradient: a brighter tint, a mid anchor hue, and a deeper shade of the same hue — never a flat
 * color or a cross-hue blend). [PURPLE], [VIOLET], [BLUE], [ROYAL_BLUE], and [SKY_BLUE] reuse
 * AnyYCTorah's exact confirmed-brand hex values directly. [PLUM] is a new same-style extension —
 * not claimed as a confirmed YCT brand hex, matching how AnyYCTorah's own non-brand extensions
 * (green/gold/lavender/blossom) are documented there. As of 2026-08-25 each home-screen
 * category pairs up with the sibling it was split from (Midrash Aggada/Halakha; Mishnah/
 * Tosefta; Tur/Shulkhan Arukh) and shares its color rather than getting its own. LAVENDER/
 * BLOSSOM/TEAL were retired across that change and an earlier one (tile text standardized to
 * always-white, removing the need for LAVENDER/BLOSSOM's pale, dark-foreground-friendly hues)
 * and are not currently used. NAVY (originally Rambam's color, retired the same day) was
 * **restored 2026-08-25** for Teshuvot Rishonim — the first new home-screen category since the
 * retirement, exactly the case anticipated when it was retired.
 */
enum class BrandColorFamily(private val stops: List<Color>) {
    // Purple family — left column (Tanakh, Midrash Aggada/Halakha, Mishnah/Tosefta)
    PURPLE(listOf(Color(0xFFC68AF5), Color(0xFF6A2CD0), Color(0xFF3A1670))),
    VIOLET(listOf(Color(0xFFD8BFD8), Color(0xFF8A2BE2), Color(0xFF3F0071))),
    PLUM(listOf(Color(0xFFB98FD1), Color(0xFF6B3FA0), Color(0xFF331A4D))),

    // Blue family — right column (Talmud Bavli/Yerushalmi, Tur/Shulkhan Arukh, Rambam, Teshuvot Rishonim)
    BLUE(listOf(Color(0xFF4D6BFF), Color(0xFF0606BA), Color(0xFF14104A))),
    ROYAL_BLUE(listOf(Color(0xFF6FA3FF), Color(0xFF0059EA), Color(0xFF00297A))),
    SKY_BLUE(listOf(Color(0xFF6FE0FF), Color(0xFF0B90FF), Color(0xFF0044B8))),
    NAVY(listOf(Color(0xFF5C7FB0), Color(0xFF1E3A5F), Color(0xFF0A1826)));

    /** Diagonal top-left → bottom-right fill (`Brush.linearGradient`'s default start/end
     *  already resolve to the shape's actual bounds at draw time — no size measuring needed). */
    val brush: Brush get() = Brush.linearGradient(colors = stops)
}
