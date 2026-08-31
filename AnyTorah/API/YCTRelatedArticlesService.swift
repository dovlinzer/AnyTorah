import Foundation

/// A YCT halakha piece (article or audio episode) that cites the Shulchan Arukh siman it's
/// keyed under — sourced from AnyYCTorah's existing Supabase content index (library.yctorah.org
/// + psak.yctorah.org, already classified/populated there; this app only reads it). See
/// CLAUDE.md's "Related YCT Articles" section for the full data-model story.
struct RelatedYCTPiece: Identifiable {
    let id: Int64
    let title: String
    let url: String
    let author: String?
    let excerpt: String?
    let postType: String   // "post" | "audio"
    let imageURL: String?
    var isAudio: Bool { postType == "audio" }
}

enum YCTRelatedArticlesService {
    private static let supabaseURL = "https://zewdazoijdpakugfvnzt.supabase.co"
    private static let anonKey = DedicationService.anonKey  // same public embedded key, reused

    // Exact strings AnyYCTorah's `book_or_tractate` column uses (confirmed live) — NOT
    // TextCatalog.shulchanArukhSections' own names ("Yoreh Deah", no apostrophe).
    private static let saBookNames = ["Orach Chayim", "Yoreh De'ah", "Even HaEzer", "Choshen Mishpat"]

    // In-memory only, keyed by SA section (book) — a siman-only change (the common case while
    // paging within one book) is then a free dictionary lookup; only crossing OC/YD/EH/CM
    // triggers a real fetch.
    private static var cacheBySection: [Int: [Int: [RelatedYCTPiece]]] = [:]
    private static var inFlightBySection: [Int: Task<[Int: [RelatedYCTPiece]], Never>] = [:]

    static func relatedPieces(saSection: Int, saSiman: Int) async -> [RelatedYCTPiece] {
        guard saBookNames.indices.contains(saSection) else { return [] }
        if let indexed = cacheBySection[saSection] { return indexed[saSiman] ?? [] }
        if let existing = inFlightBySection[saSection] { return (await existing.value)[saSiman] ?? [] }
        let task = Task<[Int: [RelatedYCTPiece]], Never> { await fetchAndIndex(book: saBookNames[saSection]) }
        inFlightBySection[saSection] = task
        let indexed = await task.value
        cacheBySection[saSection] = indexed
        inFlightBySection[saSection] = nil
        return indexed[saSiman] ?? []
    }

    /// Fetches every SA citation for one book and indexes it by anchor siman. A piece citing
    /// multiple simanim in the same book collapses to one entry, anchored at its
    /// `is_book_primary` citation if one exists (an offline LLM tie-breaker AnyYCTorah already
    /// ran — see its own CLAUDE.md's "Competing-primary population"), else the lowest siman it
    /// cites. This is the one piece of AnyYCTorah's server-computed logic worth replicating here,
    /// since it changes *which* siman a piece surfaces under — everything else (language
    /// filtering, translation flags) is deliberately not ported, see CLAUDE.md.
    private static func fetchAndIndex(book: String) async -> [Int: [RelatedYCTPiece]] {
        var comps = URLComponents(string: "\(supabaseURL)/rest/v1/piece_references")!
        comps.queryItems = [
            URLQueryItem(name: "select", value: "piece_id,locator,is_book_primary,pieces(id,title,url,author,excerpt,post_type,image_url)"),
            URLQueryItem(name: "source_type", value: "eq.SA"),
            URLQueryItem(name: "book_or_tractate", value: "eq.\(book)"),
            URLQueryItem(name: "limit", value: "5000"),
        ]
        guard let url = comps.url else { return [:] }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [:] }

        struct Citation { let siman: Int; let isPrimary: Bool }
        var citationsByPiece: [Int64: [Citation]] = [:]
        var pieceById: [Int64: RelatedYCTPiece] = [:]

        for row in rows {
            guard let locator = row["locator"] as? String,
                  let siman = Int(locator.prefix(while: \.isNumber)),
                  let pieceObj = row["pieces"] as? [String: Any],
                  let pieceIdNum = pieceObj["id"] as? NSNumber
            else { continue }
            let pieceId = pieceIdNum.int64Value
            citationsByPiece[pieceId, default: []].append(
                Citation(siman: siman, isPrimary: (row["is_book_primary"] as? Bool) ?? false))
            if pieceById[pieceId] == nil {
                pieceById[pieceId] = RelatedYCTPiece(
                    id: pieceId,
                    title: (pieceObj["title"] as? String) ?? "",
                    url: (pieceObj["url"] as? String) ?? "",
                    author: pieceObj["author"] as? String,
                    excerpt: pieceObj["excerpt"] as? String,
                    postType: (pieceObj["post_type"] as? String) ?? "post",
                    imageURL: pieceObj["image_url"] as? String)
            }
        }

        var indexed: [Int: [RelatedYCTPiece]] = [:]
        for (pieceId, citations) in citationsByPiece {
            guard let piece = pieceById[pieceId], !piece.url.isEmpty else { continue }
            let anchorSiman = citations.first(where: \.isPrimary)?.siman ?? citations.map(\.siman).min()!
            indexed[anchorSiman, default: []].append(piece)
        }
        return indexed
    }
}
