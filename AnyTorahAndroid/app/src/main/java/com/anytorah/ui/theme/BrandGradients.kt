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
 * Tosefta; Tur/Shulkhan Arukh) and shares its color rather than getting its own. BLOSSOM/TEAL
 * were retired across that change and an earlier one (tile text standardized to always-white,
 * removing the need for their pale, dark-foreground-friendly hues) and are not currently used.
 * NAVY (originally Rambam's color, retired the same day) was **restored 2026-08-25** for
 * Teshuvot Rishonim — the first new home-screen category since the retirement, exactly the case
 * anticipated when it was retired. LAVENDER was briefly restored 2026-08-28 for Teshuvot
 * Acharonim, then retired again the same day when all three Teshuvot row tiles (Rishonim/
 * Acharonim/Contemporary) were unified onto navy-family shades — per explicit request, that row
 * now reads as one coherent "Teshuvot" group rather than reusing the two-column grid's purple/
 * blue split, which stopped meaning anything once Teshuvot moved out of the columns entirely
 * (see NAVY_STEEL/NAVY_DEEP below). LAVENDER itself is left in place, unused, exactly as NAVY was
 * during its own earlier retirement — restore it the same way if a future category needs it.
 */
enum class BrandColorFamily(private val stops: List<Color>) {
    // Purple family — left column (Tanakh, Midrash Aggada/Halakha, Mishnah/Tosefta)
    PURPLE(listOf(Color(0xFFC68AF5), Color(0xFF6A2CD0), Color(0xFF3A1670))),
    VIOLET(listOf(Color(0xFFD8BFD8), Color(0xFF8A2BE2), Color(0xFF3F0071))),
    PLUM(listOf(Color(0xFFB98FD1), Color(0xFF6B3FA0), Color(0xFF331A4D))),
    LAVENDER(listOf(Color(0xFFE0C2FA), Color(0xFFBA7FEB), Color(0xFF6A2FB0))),

    // Blue family — right column (Talmud Bavli/Yerushalmi, Tur/Shulkhan Arukh, Rambam)
    BLUE(listOf(Color(0xFF4D6BFF), Color(0xFF0606BA), Color(0xFF14104A))),
    ROYAL_BLUE(listOf(Color(0xFF6FA3FF), Color(0xFF0059EA), Color(0xFF00297A))),
    SKY_BLUE(listOf(Color(0xFF6FE0FF), Color(0xFF0B90FF), Color(0xFF0044B8))),

    // Navy family — Teshuvot row (Rishonim/Acharonim/Contemporary): same hue, three shades, so
    // the row reads as one group with just enough contrast to tell the tiles apart.
    NAVY(listOf(Color(0xFF5C7FB0), Color(0xFF1E3A5F), Color(0xFF0A1826))),
    NAVY_STEEL(listOf(Color(0xFF6C8CB8), Color(0xFF2C4A70), Color(0xFF101F30))),
    NAVY_DEEP(listOf(Color(0xFF4A6690), Color(0xFF152C48), Color(0xFF060E18)));

    /** Diagonal top-left → bottom-right fill (`Brush.linearGradient`'s default start/end
     *  already resolve to the shape's actual bounds at draw time — no size measuring needed). */
    val brush: Brush get() = Brush.linearGradient(colors = stops)
}
