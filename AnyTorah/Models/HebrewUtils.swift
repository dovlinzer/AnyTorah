import Foundation

extension String {
    /// Strip Hebrew nikud (vowel points U+05B0–U+05C7) and cantillation marks (U+0591–U+05AF).
    var strippingNikud: String {
        String(String.UnicodeScalarView(unicodeScalars.filter { $0.value < 0x0591 || $0.value > 0x05C7 }))
    }

    var strippingSeferPrefix: String {
        let prefix = "ספר "
        return hasPrefix(prefix) ? String(dropFirst(prefix.count)) : self
    }
}
