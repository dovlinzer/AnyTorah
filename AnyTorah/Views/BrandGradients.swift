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
/// shares its color rather than getting its own — so this enum now has only 6 cases, not
/// one per category. `lavender`/`blossom`/`teal`/`navy` were retired across that change and
/// an earlier one (tile text standardized to always-white, removing the need for
/// `lavender`/`blossom`'s pale, dark-foreground-friendly hues; the right column's colors
/// shifting down by one, retiring `navy`) — no category needs a color of its own anymore.
enum BrandColorFamily {
    // Purple family — left column (Tanakh, Midrash Aggada/Halakha, Mishnah/Tosefta)
    case purple, violet, plum
    // Blue family — right column (Talmud Bavli/Yerushalmi, Tur/Shulkhan Arukh, Rambam)
    case blue, royalBlue, skyBlue

    var stops: [Color] {
        switch self {
        case .purple:    return [Color(hex: "c68af5"), Color(hex: "6a2cd0"), Color(hex: "3a1670")]
        case .violet:    return [Color(hex: "d8bfd8"), Color(hex: "8a2be2"), Color(hex: "3f0071")]
        case .plum:      return [Color(hex: "b98fd1"), Color(hex: "6b3fa0"), Color(hex: "331a4d")]
        case .blue:      return [Color(hex: "4d6bff"), Color(hex: "0606ba"), Color(hex: "14104a")]
        case .royalBlue: return [Color(hex: "6fa3ff"), Color(hex: "0059ea"), Color(hex: "00297a")]
        case .skyBlue:   return [Color(hex: "6fe0ff"), Color(hex: "0b90ff"), Color(hex: "0044b8")]
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
