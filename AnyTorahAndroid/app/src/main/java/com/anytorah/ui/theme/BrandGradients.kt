package com.anytorah.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Home-screen tile gradients — borrows the two-column, brand-anchored gradient aesthetic from
 * AnyYCTorah's `BrandGradients.swift`/`HomeView.swift` (each tile is a three-stop diagonal
 * gradient: a brighter tint, a mid anchor hue, and a deeper shade of the same hue — never a flat
 * color or a cross-hue blend). [PURPLE], [VIOLET], [BLUE], [ROYAL_BLUE], and [SKY_BLUE] reuse
 * AnyYCTorah's exact confirmed-brand hex values directly; [LAVENDER] and [BLOSSOM] also reuse
 * AnyYCTorah's exact hex values. [PLUM] and [TEAL] are new same-style extensions sized to
 * exactly the ten home-screen categories here (five purple-family, five blue-family) — not
 * claimed as confirmed YCT brand hexes, matching how AnyYCTorah's own non-brand extensions
 * (green/gold/lavender/blossom) are documented there. NAVY (originally Rambam's color) was
 * retired 2026-08-25 when tile text was standardized to always-white and the right column's
 * colors shifted down by one (Bavli's blue now covers Yerushalmi too, freeing
 * royalBlue/skyBlue/teal to shift onto Tur/SA/Rambam) — no category needs a sixth blue shade.
 */
enum class BrandColorFamily(private val stops: List<Color>) {
    // Purple family — left column (Tanakh, Midrash Aggada, Midrash Halakha, Mishnah, Tosefta)
    PURPLE(listOf(Color(0xFFC68AF5), Color(0xFF6A2CD0), Color(0xFF3A1670))),
    VIOLET(listOf(Color(0xFFD8BFD8), Color(0xFF8A2BE2), Color(0xFF3F0071))),
    LAVENDER(listOf(Color(0xFFE0C2FA), Color(0xFFBA7FEB), Color(0xFF6A2FB0))),
    BLOSSOM(listOf(Color(0xFFF9D4FB), Color(0xFFEE9CF7), Color(0xFFB84FC4))),
    PLUM(listOf(Color(0xFFB98FD1), Color(0xFF6B3FA0), Color(0xFF331A4D))),

    // Blue family — right column (Talmud Bavli, Talmud Yerushalmi, Tur, Shulkhan Arukh, Rambam)
    BLUE(listOf(Color(0xFF4D6BFF), Color(0xFF0606BA), Color(0xFF14104A))),
    ROYAL_BLUE(listOf(Color(0xFF6FA3FF), Color(0xFF0059EA), Color(0xFF00297A))),
    SKY_BLUE(listOf(Color(0xFF6FE0FF), Color(0xFF0B90FF), Color(0xFF0044B8))),
    TEAL(listOf(Color(0xFF7DD3E8), Color(0xFF0EA5E9), Color(0xFF0369A1)));

    /** Diagonal top-left → bottom-right fill (`Brush.linearGradient`'s default start/end
     *  already resolve to the shape's actual bounds at draw time — no size measuring needed). */
    val brush: Brush get() = Brush.linearGradient(colors = stops)
}
