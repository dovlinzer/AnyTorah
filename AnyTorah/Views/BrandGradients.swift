import SwiftUI

/// Home-screen tile gradients — borrows the two-column, brand-anchored gradient aesthetic
/// from AnyYCTorah's `BrandGradients.swift`/`HomeView.swift` (each tile is a three-stop
/// diagonal gradient: a brighter tint, a mid anchor hue, and a deeper shade of the same
/// hue — never a flat color or a cross-hue blend). `purple`, `violet`, `blue`, `royalBlue`,
/// and `skyBlue` reuse AnyYCTorah's exact confirmed-brand hex values directly. `plum` is a
/// new same-style extension — not claimed as a confirmed YCT brand hex, matching how
/// AnyYCTorah's own non-brand extensions (`green`/`gold`/`lavender`/`blossom`) are
/// documented there. As of 2026-08-25 each home-screen category pairs up with the sibling
/// it was split from (Midrash Aggada/Halakha; Mishnah/Tosefta; Tur/Shulkhan Arukh) and
/// shares its color rather than getting its own. `lavender`/`blossom`/`teal` were retired
/// across that change and an earlier one (tile text standardized to always-white, removing
/// the need for `lavender`/`blossom`'s pale, dark-foreground-friendly hues) and are not
/// currently used. `navy` (originally Rambam's color, retired the same day) was **restored
/// 2026-08-25** for Teshuvot Rishonim — the first new home-screen category since the
/// retirement, exactly the case anticipated when it was retired ("we might go back to those
/// colors... if we add more categories"). `lavender` was briefly restored 2026-08-28 for
/// Teshuvot Acharonim, then retired again the same day when all three Teshuvot row tiles
/// (Rishonim/Acharonim/Contemporary) were unified onto navy-family shades — per explicit
/// request, that row now reads as one coherent "Teshuvot" group rather than reusing the
/// two-column grid's purple/blue split, which stopped meaning anything once Teshuvot moved out
/// of the columns entirely (see `navySteel`/`navyDeep` below). `lavender` itself is left in
/// place, unused, exactly as `navy` was during its own earlier retirement — restore it the same
/// way if a future category needs it.
enum BrandColorFamily {
    // Purple family — left column (Tanakh, Midrash Aggada/Halakha, Mishnah/Tosefta)
    case purple, violet, plum, lavender
    // Blue family — right column (Talmud Bavli/Yerushalmi, Tur/Shulkhan Arukh, Rambam)
    case blue, royalBlue, skyBlue
    // Navy family — Teshuvot row (Rishonim/Acharonim/Contemporary): same hue, three shades, so
    // the row reads as one group with just enough contrast to tell the tiles apart.
    case navy, navySteel, navyDeep

    var stops: [Color] {
        switch self {
        case .purple:    return [Color(hex: "c68af5"), Color(hex: "6a2cd0"), Color(hex: "3a1670")]
        case .violet:    return [Color(hex: "d8bfd8"), Color(hex: "8a2be2"), Color(hex: "3f0071")]
        case .plum:      return [Color(hex: "b98fd1"), Color(hex: "6b3fa0"), Color(hex: "331a4d")]
        case .lavender:  return [Color(hex: "e0c2fa"), Color(hex: "ba7feb"), Color(hex: "6a2fb0")]
        case .blue:      return [Color(hex: "4d6bff"), Color(hex: "0606ba"), Color(hex: "14104a")]
        case .royalBlue: return [Color(hex: "6fa3ff"), Color(hex: "0059ea"), Color(hex: "00297a")]
        case .skyBlue:   return [Color(hex: "6fe0ff"), Color(hex: "0b90ff"), Color(hex: "0044b8")]
        case .navy:      return [Color(hex: "5c7fb0"), Color(hex: "1e3a5f"), Color(hex: "0a1826")]
        case .navySteel: return [Color(hex: "6c8cb8"), Color(hex: "2c4a70"), Color(hex: "101f30")]
        case .navyDeep:  return [Color(hex: "4a6690"), Color(hex: "152c48"), Color(hex: "060e18")]
        }
    }

    var gradient: LinearGradient {
        LinearGradient(colors: stops, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.hasPrefix("#") ? String(s.dropFirst()) : s
        var value: UInt64 = 0
        Scanner(string: s).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
