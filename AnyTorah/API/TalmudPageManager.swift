import Foundation

/// Loads pages.json from the app bundle and vends Google Drive image URLs
/// for each daf amud (side).
///
/// pages.json format:
///   { "Berakhot": { "0": "DRIVE_FILE_ID", "2": "DRIVE_FILE_ID", … }, … }
///
/// Page number ↔ daf conversion:
///   page = (daf - 1) * 2       for amud aleph (side a)
///   page = (daf - 1) * 2 + 1   for amud bet   (side b)
final class TalmudPageManager {
    static let shared = TalmudPageManager()

    /// [tractate: [pageNumber: driveFileId]]
    private let pages: [String: [String: String]]

    private init() {
        guard
            let url     = Bundle.main.url(forResource: "pages", withExtension: "json"),
            let data    = try? Data(contentsOf: url),
            let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: [String: String]]
        else {
            pages = [:]
            return
        }
        pages = decoded
    }

    /// Maps Sefaria API tractate names to their corresponding pages.json keys.
    /// The keys in pages.json match the Google Drive directory names, which use
    /// older/alternate transliterations that differ from Sefaria's spelling.
    private static let sefariaToPageKey: [String: String] = [
        "Eruvin":  "Eiruvin",   // Sefaria: "Eruvin",  Drive: "Eiruvin"
        "Chullin": "Hullin",    // Sefaria: "Chullin", Drive: "Hullin"
        "Taanit":  "Ta'anit",   // Sefaria: "Taanit",  Drive: "Ta'anit"
    ]

    /// Resolves a Sefaria tractate name to the key used in pages.json.
    private func pageKey(for tractate: String) -> String {
        Self.sefariaToPageKey[tractate] ?? tractate
    }

    /// Whether any page images are available for the given tractate.
    func hasPages(for tractate: String) -> Bool {
        !(pages[pageKey(for: tractate)]?.isEmpty ?? true)
    }

    /// Returns a Google Drive thumbnail URL for the given daf amud.
    /// - Parameters:
    ///   - tractate: Sefaria tractate name, e.g. "Berakhot"
    ///   - daf:      Daf number, e.g. 11
    ///   - sideA:    `true` for amud aleph (a), `false` for amud bet (b)
    func imageURL(tractate: String, daf: Int, sideA: Bool) -> URL? {
        let pageNumber = (daf - 1) * 2 + (sideA ? 0 : 1)
        guard let fileId = pages[pageKey(for: tractate)]?[String(pageNumber)] else { return nil }
        // sz=w1600 gives a ~1600-px-wide image — good for retina iPad displays.
        return URL(string: "https://drive.google.com/thumbnail?id=\(fileId)&sz=w1600")
    }
}
