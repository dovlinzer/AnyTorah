import SwiftUI

/// Home-screen tile gradients — borrows the two-column, brand-anchored gradient aesthetic
/// from AnyYCTorah's `BrandGradients.swift`/`HomeView.swift` (each tile is a three-stop
/// diagonal gradient: a brighter tint, a mid anchor hue, and a deeper shade of the same
/// hue — never a flat color or a cross-hue blend). `purple`, `violet`, `blue`, `royalBlue`,
/// and `skyBlue` reuse AnyYCTorah's exact confirmed-brand hex values directly; `lavender`
/// and `blossom` also reuse AnyYCTorah's exact hex values. `plum` and `teal` are new
/// same-style extensions sized to exactly the ten home-screen categories here (five
/// purple-family, five blue-family) — not claimed as confirmed YCT brand hexes, matching
/// how AnyYCTorah's own non-brand extensions (`green`/`gold`/`lavender`/`blossom`) are
/// documented there. `navy` (originally Rambam's color) was retired 2026-08-25 when tile
/// text was standardized to always-white and the right column's colors shifted down by one
/// (Bavli's blue now covers Yerushalmi too, freeing royalBlue/skyBlue/teal to shift onto
/// Tur/SA/Rambam) — no category needs a sixth blue shade.
enum BrandColorFamily {
    // Purple family — left column (Tanakh, Midrash Aggada, Midrash Halakha, Mishnah, Tosefta)
    case purple, violet, lavender, blossom, plum
    // Blue family — right column (Talmud Bavli, Talmud Yerushalmi, Tur, Shulkhan Arukh, Rambam)
    case blue, royalBlue, skyBlue, teal

    var stops: [Color] {
        switch self {
        case .purple:    return [Color(hex: "c68af5"), Color(hex: "6a2cd0"), Color(hex: "3a1670")]
        case .violet:    return [Color(hex: "d8bfd8"), Color(hex: "8a2be2"), Color(hex: "3f0071")]
        case .lavender:  return [Color(hex: "e0c2fa"), Color(hex: "ba7feb"), Color(hex: "6a2fb0")]
        case .blossom:   return [Color(hex: "f9d4fb"), Color(hex: "ee9cf7"), Color(hex: "b84fc4")]
        case .plum:      return [Color(hex: "b98fd1"), Color(hex: "6b3fa0"), Color(hex: "331a4d")]
        case .blue:      return [Color(hex: "4d6bff"), Color(hex: "0606ba"), Color(hex: "14104a")]
        case .royalBlue: return [Color(hex: "6fa3ff"), Color(hex: "0059ea"), Color(hex: "00297a")]
        case .skyBlue:   return [Color(hex: "6fe0ff"), Color(hex: "0b90ff"), Color(hex: "0044b8")]
        case .teal:      return [Color(hex: "7dd3e8"), Color(hex: "0ea5e9"), Color(hex: "0369a1")]
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
