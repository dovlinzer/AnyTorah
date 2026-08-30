import Foundation

/// Loads teshuvot_pages.json and teshuvot_siman_index.json from the app bundle and vends
/// Google Drive image URLs + siman->page lookups for Contemporary Teshuvot volumes (image-page
/// based, not Sefaria-based — see `ContemporaryTeshuvotWork`). Parallel to `TalmudPageManager`,
/// same Drive-thumbnail mechanism, but keyed by volume + raw page number instead of
/// tractate + daf/amud.
///
/// teshuvot_pages.json format:      { "IggrotMosheEH2": { "1": "DRIVE_FILE_ID", "2": "…", … }, … }
/// teshuvot_siman_index.json format: { "IggrotMosheEH2": { "1": 1, "2": 2, … } }  (siman -> page)
final class TeshuvotPageManager {
    static let shared = TeshuvotPageManager()

    /// [volumeId: [pageNumber: driveFileId]]
    private let pages: [String: [String: String]]
    /// [volumeId: [siman: page]]
    private let simanIndex: [String: [String: Int]]

    private init() {
        pages = Self.load("teshuvot_pages", as: [String: [String: String]].self) ?? [:]
        simanIndex = Self.load("teshuvot_siman_index", as: [String: [String: Int]].self) ?? [:]
    }

    private static func load<T: Decodable>(_ resource: String, as type: T.Type) -> T? {
        guard
            let url = Bundle.main.url(forResource: resource, withExtension: "json"),
            let data = try? Data(contentsOf: url)
        else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// Total page-image count available for a volume.
    func pageCount(volume: String) -> Int {
        pages[volume]?.count ?? 0
    }

    /// Google Drive thumbnail URL for a given volume + page number (1-indexed).
    func imageURL(volume: String, page: Int) -> URL? {
        guard let fileId = pages[volume]?[String(page)] else { return nil }
        return URL(string: "https://drive.google.com/thumbnail?id=\(fileId)&sz=w1600")
    }

    /// The page a siman starts on, from the hand-maintained index — see
    /// `ContemporaryTeshuvotVolume`'s doc comment for accuracy caveats.
    func page(volume: String, siman: Int) -> Int? {
        simanIndex[volume]?[String(siman)]
    }

    /// The siman most likely being displayed on a given page — the reverse of `page(volume:
    /// siman:)`, used to drive the reader header's siman pill (which should read as "you're
    /// looking at siman N", not "you're on page N"). Finds the largest indexed siman whose own
    /// page is <= the given page (a floor lookup, not an exact match) — correct for any page
    /// that falls within a teshuvah's own multi-page span, not just its first page, and degrades
    /// gracefully past the last indexed siman (stays pinned to it) rather than returning nil.
    func siman(volume: String, page: Int) -> Int? {
        guard let index = simanIndex[volume] else { return nil }
        var best: (siman: Int, page: Int)? = nil
        for (simanStr, simanPage) in index {
            guard simanPage <= page, let siman = Int(simanStr) else { continue }
            if best == nil || simanPage > best!.page {
                best = (siman, simanPage)
            }
        }
        return best?.siman
    }
}
