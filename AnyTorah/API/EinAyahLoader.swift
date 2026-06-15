import Foundation

/// Loads the bundled Ein Ayah JSON and returns entries for a specific Talmud daf.
///
/// JSON structure: {"berakhot": {"2a": [{"citation": "...", "text": "..."}], ...}, "shabbat": {...}}
/// Ein Ayah only comments on aggadic passages, so many dafim have no entries.
struct EinAyahLoader {

    private static let cache: [String: Any] = {
        guard let url = Bundle.main.url(forResource: "ein_ayah", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return json
    }()

    /// `daf` is a bare daf number string (e.g. "3") — the app navigates whole dafim.
    /// Combines entries from amud a and amud b.
    static func entries(tractate: String, daf: String) -> [CommentaryEntry] {
        let key = tractateKey(for: tractate)
        guard let dafMap = cache[key] as? [String: Any] else { return [] }

        let rawA = (dafMap["\(daf)a"] as? [[String: String]]) ?? []
        let rawB = (dafMap["\(daf)b"] as? [[String: String]]) ?? []
        let combined = rawA + rawB

        return combined.enumerated().compactMap { idx, raw in
            guard let text = raw["text"], !text.isEmpty else { return nil }
            let citation = raw["citation"] ?? ""
            let he = citation.isEmpty ? text : "\(citation)\n\(text)"
            return .text(index: idx, he: he, en: "")
        }
    }

    private static func tractateKey(for sefariaName: String) -> String {
        switch sefariaName.lowercased() {
        case "berakhot":  return "berakhot"
        case "shabbat":   return "shabbat"
        default:          return sefariaName.lowercased()
        }
    }
}
