import Foundation

// MARK: - Errors

enum SefariaError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case noText
    case decodingError(status: Int?)

    var errorDescription: String? {
        switch self {
        case .invalidURL:          return "Invalid Sefaria URL"
        case .networkError(let e): return "Network error: \(e.localizedDescription)"
        case .noText:              return "No text found"
        case .decodingError(let status):
            if let status { return "Could not parse response (HTTP \(status))" }
            return "Could not parse response"
        }
    }
}

// MARK: - Client

@MainActor
final class SefariaTextClient {

    static let shared = SefariaTextClient()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 20 * 1024 * 1024,
                                   diskCapacity:  100 * 1024 * 1024)
        config.requestCachePolicy = .returnCacheDataElseLoad
        // A short per-request timeout keeps a stalled connection from blocking the UI for
        // the platform's 60s default; retries below then get several tries within that budget.
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }()

    // MARK: - Retry

    /// Fetches `url` with up to `attempts` tries, retrying only transient failures — dropped
    /// connections, timeouts, DNS hiccups, and 429/5xx responses — with short backoff between
    /// tries. Non-transient errors (e.g. a malformed URL's connection refusal) are rethrown
    /// immediately. This exists because "No text found" reports from real devices (including
    /// App Store review) have turned out to be transient network failures masquerading as an
    /// empty API response — a brief retry resolves most of them instead of surfacing an error.
    private func dataWithRetry(from url: URL, attempts: Int = 3) async throws -> (Data, URLResponse) {
        var lastError: Error = URLError(.unknown)
        for attempt in 0..<attempts {
            let isLastAttempt = attempt == attempts - 1
            do {
                let (data, response) = try await session.data(from: url)
                if let http = response as? HTTPURLResponse, Self.isRetryableStatus(http.statusCode) {
                    lastError = NSError(domain: "Sefaria", code: http.statusCode,
                                         userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode)"])
                } else {
                    return (data, response)
                }
            } catch {
                lastError = error
                if !Self.isRetryableNetworkError(error) { throw error }
            }
            if isLastAttempt { throw lastError }
            try? await Task.sleep(nanoseconds: Self.backoffNanoseconds(for: attempt))
        }
        throw lastError
    }

    private static func backoffNanoseconds(for attempt: Int) -> UInt64 {
        UInt64(300_000_000 * (attempt + 1))  // 0.3s, 0.6s, ...
    }

    private static func isRetryableNetworkError(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        switch urlError.code {
        case .timedOut, .networkConnectionLost, .cannotConnectToHost,
             .dnsLookupFailed, .cannotFindHost, .resourceUnavailable:
            return true
        default:
            return false
        }
    }

    private static func isRetryableStatus(_ code: Int) -> Bool {
        code == 429 || (500...599).contains(code)
    }

    /// True when `error` is `SefariaError.noText` — used to distinguish "the text genuinely
    /// doesn't exist" from a masked network/decoding failure when unwrapping combined fetches.
    private func isNoText(_ error: Error) -> Bool {
        if case SefariaError.noText = error { return true }
        return false
    }

    // MARK: - Public API

    /// Fetches Hebrew and English segments in parallel with explicit lang parameters.
    /// Uses lang=he → json["he"] and lang=en → json["text"] so each is unambiguous.
    func fetchBoth(ref: String) async throws -> (hebrew: [String], english: [String]) {
        async let heResult = fetchSingleLangResult(ref: ref, lang: "he")
        async let enResult = fetchSingleLangResult(ref: ref, lang: "en")
        let (heRes, enRes) = await (heResult, enResult)

        let heSegs = (try? heRes.get()) ?? []
        let enSegs = (try? enRes.get()) ?? []
        if !heSegs.isEmpty || !enSegs.isEmpty {
            return (heSegs, enSegs)
        }

        // Both sides came back empty. Rather than blanket-report "no text" (which is what a
        // network timeout, a blocked/challenged request, or a bad JSON response all look like
        // once swallowed), surface whichever underlying failure isn't itself a genuine "no text"
        // — that's the actual cause, and it's what needs fixing or reporting.
        for result in [heRes, enRes] {
            if case .failure(let error) = result, !isNoText(error) { throw error }
        }
        throw SefariaError.noText
    }

    private func fetchSingleLangResult(ref: String, lang: String) async -> Result<[String], Error> {
        do { return .success(try await fetchSingleLang(ref: ref, lang: lang)) }
        catch { return .failure(error) }
    }

    /// Fetches Hebrew and English from a single request, preserving structural alignment.
    ///
    /// Sefaria commentary texts are depth-3: outer array = one entry per mishnah/verse/halakha,
    /// inner array = paragraphs within that entry.  Hebrew typically has 1 inner paragraph per
    /// entry while the English translation may have several.  Naively flattening both and then
    /// pairing positionally produces misalignment whenever inner counts differ.
    ///
    /// This method pairs at the *outer* level first.  When the inner paragraph counts for a
    /// given outer element differ between languages it joins the minority side into one string,
    /// giving one aligned entry per outer element regardless of English verbosity.
    /// Returns `(he, en, outerIndices)` where `outerIndices[i]` is the 0-based outer-array
    /// position (e.g. mishnah number) that paragraph `i` belongs to.  Callers can use this
    /// to display a per-mishnah label instead of a sequential paragraph counter.
    func fetchBothAligned(ref: String) async throws -> (he: [String], en: [String], outerIndices: [Int]) {
        let url = try buildURL(ref: ref, lang: "en")
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await dataWithRetry(from: url)
        } catch {
            throw SefariaError.networkError(error)
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SefariaError.decodingError(status: (response as? HTTPURLResponse)?.statusCode)
        }
        if let errMsg = json["error"] as? String {
            throw SefariaError.networkError(
                NSError(domain: "Sefaria", code: 0,
                        userInfo: [NSLocalizedDescriptionKey: errMsg]))
        }
        guard let heVal = json["he"], let enVal = json["text"] else {
            throw SefariaError.noText
        }

        var heSegs: [String] = []
        var enSegs: [String] = []
        var outerIndices: [Int] = []

        let heArr = heVal as? [Any]
        let enArr = enVal as? [Any]

        if let heArr, let enArr {
            if heArr.count == enArr.count {
                // Same outer count — pair per outer element, joining minority inner side.
                for i in 0..<heArr.count {
                    let hInner = flattenTextValue(heArr[i])
                        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                    let eInner = flattenTextValue(enArr[i])
                        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                    let before = heSegs.count
                    alignedAppend(hInner: hInner, eInner: eInner, into: &heSegs, en: &enSegs)
                    let added = heSegs.count - before
                    outerIndices.append(contentsOf: repeatElement(i, count: added))
                }
            } else if enArr.isEmpty {
                // No English translation — iterate over Hebrew structure, empty English.
                for i in 0..<heArr.count {
                    let hInner = flattenTextValue(heArr[i])
                        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                    let before = heSegs.count
                    alignedAppend(hInner: hInner, eInner: [], into: &heSegs, en: &enSegs)
                    let added = heSegs.count - before
                    outerIndices.append(contentsOf: repeatElement(i, count: added))
                }
            } else if heArr.isEmpty {
                // No Hebrew translation — iterate over English structure, empty Hebrew.
                for i in 0..<enArr.count {
                    let eInner = flattenTextValue(enArr[i])
                        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                    let before = heSegs.count
                    alignedAppend(hInner: [], eInner: eInner, into: &heSegs, en: &enSegs)
                    let added = heSegs.count - before
                    outerIndices.append(contentsOf: repeatElement(i, count: added))
                }
            } else {
                // Outer counts differ and both non-zero (e.g. intro: 1 he vs 7 en at top level).
                // Flatten each side fully, then apply the same minority-join logic once.
                let hInner = flattenTextValue(heArr)
                    .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                let eInner = flattenTextValue(enArr)
                    .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                let before = heSegs.count
                alignedAppend(hInner: hInner, eInner: eInner, into: &heSegs, en: &enSegs)
                let added = heSegs.count - before
                outerIndices.append(contentsOf: repeatElement(0, count: added))
            }
        } else {
            // Scalar values — fall back to flat lists.
            heSegs = flattenTextValue(heVal)
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            enSegs = flattenTextValue(enVal)
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            outerIndices = Array(0..<heSegs.count)
        }

        guard !heSegs.isEmpty || !enSegs.isEmpty else { throw SefariaError.noText }
        return (heSegs, enSegs, outerIndices)
    }

    /// Appends aligned (he, en) pairs to the output arrays.
    /// When inner paragraph counts match, pairs directly.
    /// When one side has more paragraphs, joins it into a single string paired with the minority.
    /// When both sides have multiple paragraphs but different counts, pairs up to min then
    /// appends extras with an empty partner.
    private func alignedAppend(hInner: [String], eInner: [String],
                                into heSegs: inout [String], en enSegs: inout [String]) {
        guard !hInner.isEmpty || !eInner.isEmpty else { return }
        if hInner.count == eInner.count {
            for j in 0..<hInner.count { heSegs.append(hInner[j]); enSegs.append(eInner[j]) }
        } else if eInner.isEmpty {
            // No English at all — each Hebrew paragraph is its own entry.
            for h in hInner { heSegs.append(h); enSegs.append("") }
        } else if hInner.isEmpty {
            // No Hebrew at all — each English paragraph is its own entry.
            for e in eInner { heSegs.append(""); enSegs.append(e) }
        } else if hInner.count == 1 {
            // 1 Hebrew para, multiple English: join English into one entry.
            heSegs.append(hInner[0])
            enSegs.append(eInner.joined(separator: " "))
        } else if eInner.count == 1 {
            // Multiple Hebrew paras, 1 English: join Hebrew into one entry.
            heSegs.append(hInner.joined(separator: " "))
            enSegs.append(eInner[0])
        } else {
            // Both > 1 but different counts: pair up to min, extras get empty partner.
            let minCount = min(hInner.count, eInner.count)
            for j in 0..<minCount { heSegs.append(hInner[j]); enSegs.append(eInner[j]) }
            for j in minCount..<hInner.count { heSegs.append(hInner[j]); enSegs.append("") }
            for j in minCount..<eInner.count { heSegs.append(""); enSegs.append(eInner[j]) }
        }
    }

    /// Fetches a single language's text segments.
    func fetchRaw(ref: String, language: String) async throws -> [String] {
        return try await fetchSingleLang(ref: ref, lang: language)
    }

    /// Low-level single-language fetch. lang="he" → json["he"], lang="en" → json["text"].
    private func fetchSingleLang(ref: String, lang: String) async throws -> [String] {
        let url = try buildURL(ref: ref, lang: lang)
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await dataWithRetry(from: url)
        } catch {
            throw SefariaError.networkError(error)
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SefariaError.decodingError(status: (response as? HTTPURLResponse)?.statusCode)
        }
        if let errMsg = json["error"] as? String {
            throw SefariaError.networkError(
                NSError(domain: "Sefaria", code: 0,
                        userInfo: [NSLocalizedDescriptionKey: errMsg]))
        }
        // v2 API: "he" key is always Hebrew; "text" key carries the requested translation
        let key = lang == "he" ? "he" : "text"
        guard let val = json[key] else { throw SefariaError.noText }
        let segs = flattenTextValue(val).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        guard !segs.isEmpty else { throw SefariaError.noText }
        return segs
    }

    // MARK: - Ref Building

    /// Builds the canonical Sefaria ref string for the given category + selection indices.
    func ref(category: TextCategory,
             bookOrTractateIndex: Int,
             chapterOrDaf: Int,
             amud: String? = nil) -> String {
        switch category {
        case .tanakh:
            let book = TextCatalog.allTanakhBooks.first(where: { $0.id == bookOrTractateIndex })
                    ?? TextCatalog.allTanakhBooks[0]
            return "\(book.sefariaName) \(chapterOrDaf)"

        case .mishnah:
            let tractate = TextCatalog.allMishnahTractates.first(where: { $0.id == bookOrTractateIndex })
                        ?? TextCatalog.allMishnahTractates[0]
            return "\(tractate.sefariaName) \(chapterOrDaf)"

        case .talmud:
            let tractate = TextCatalog.allTalmudTractates.first(where: { $0.id == bookOrTractateIndex })
                        ?? TextCatalog.allTalmudTractates[0]
            let a = amud ?? "a"
            return "\(tractate.sefariaName) \(chapterOrDaf)\(a)"

        case .rambam:
            let work = allRambamWorks.first(where: { $0.id == bookOrTractateIndex })
                    ?? allRambamWorks[0]
            return "\(work.sefariaName) \(chapterOrDaf)"

        case .shulchanArukh:
            let section = TextCatalog.shulchanArukhSections.first(where: { $0.id == bookOrTractateIndex })
                       ?? TextCatalog.shulchanArukhSections[0]
            return "\(section.sefariaName) \(chapterOrDaf)"
        case .midrash:
            // Midrash uses verse-based navigation; this fallback shouldn't be called.
            return ""
        }
    }

    // MARK: - Full-daf fetch (Talmud)

    /// Fetches both amudim of a Talmud daf and inserts an amud-B marker between them.
    func fetchFullDaf(tractateIndex: Int, daf: Int) async throws -> [TextSegment] {
        let tractate = TextCatalog.allTalmudTractates.first(where: { $0.id == tractateIndex })
                    ?? TextCatalog.allTalmudTractates[0]
        let refA = "\(tractate.sefariaName) \(daf)a"
        let refB = "\(tractate.sefariaName) \(daf)b"

        async let resultA = fetchBothResult(ref: refA)
        async let resultB = fetchBothResult(ref: refB)
        let (pairAResult, pairBResult) = await (resultA, resultB)

        let segsA = try? pairAResult.get()
        let segsB = try? pairBResult.get()

        var segments: [TextSegment] = []

        if let (heA, enA) = segsA {
            let count = min(heA.count, enA.count)
            for i in 0..<count {
                segments.append(.content(index: i, he: heA[i], en: enA[i]))
            }
        }

        // Insert amud-B marker
        segments.append(.amudBMarker(daf: daf))

        if let (heB, enB) = segsB {
            let startIdx = (segsA.map { min($0.0.count, $0.1.count) } ?? 0)
            let count = min(heB.count, enB.count)
            for i in 0..<count {
                segments.append(.content(index: startIdx + i, he: heB[i], en: enB[i]))
            }
        }

        let validSegments = segments.filter { $0.isAmudBMarker || !$0.hebrewHTML.isEmpty || !$0.englishHTML.isEmpty }
        if !validSegments.isEmpty { return validSegments }

        for result in [pairAResult, pairBResult] {
            if case .failure(let error) = result, !isNoText(error) { throw error }
        }
        throw SefariaError.noText
    }

    private func fetchBothResult(ref: String) async -> Result<(hebrew: [String], english: [String]), Error> {
        do { return .success(try await fetchBoth(ref: ref)) }
        catch { return .failure(error) }
    }

    // MARK: - Tosefta fetch

    func fetchTosefta(tractate: MishnahTractate, chapter: Int) async throws -> [TextSegment] {
        let r = "Tosefta \(tractate.name) \(chapter)"
        let (he, en) = try await fetchBoth(ref: r)
        let count = max(he.count, en.count)
        var segments: [TextSegment] = []
        for i in 0..<count {
            let label = segmentLabel(style: .mishnah, number: i + 1)
            segments.append(.content(index: i,
                                     he: i < he.count ? he[i] : "",
                                     en: i < en.count ? en[i] : "",
                                     label: label))
        }
        let valid = segments.filter { !$0.hebrewHTML.isEmpty || !$0.englishHTML.isEmpty }
        guard !valid.isEmpty else { throw SefariaError.noText }
        return valid
    }

    // MARK: - Yerushalmi fetch

    func fetchYerushalmi(tractate: MishnahTractate, chapter: Int, halakha: Int = 1) async throws -> [TextSegment] {
        // Specify chapter:halakha so the API returns only that halakha's segments,
        // not the whole (flattened) chapter.  halakha 1 == "Peah 1:1" == "Peah 1".
        let r = "Jerusalem Talmud \(tractate.name) \(chapter):\(halakha)"
        let (he, en) = try await fetchBoth(ref: r)
        let count = max(he.count, en.count)
        var segments: [TextSegment] = []
        for i in 0..<count {
            let label = segmentLabel(style: .halakha, number: i + 1)
            let rawEn = i < en.count ? en[i] : ""
            segments.append(.content(index: i,
                                     he: i < he.count ? he[i] : "",
                                     en: SefariaTextClient.stripYerushalmiFootnotes(rawEn),
                                     label: label))
        }
        let valid = segments.filter { !$0.hebrewHTML.isEmpty || !$0.englishHTML.isEmpty }
        guard !valid.isEmpty else { throw SefariaError.noText }
        return valid
    }

    // MARK: - Yerushalmi shape (halakha counts per chapter)

    /// Returns the number of halakhot in `chapter` (1-based) for the given Yerushalmi tractate.
    /// Uses Sefaria's /api/shape endpoint; result cached by URLSession.
    /// Falls back to `defaultCount` if the fetch fails or chapter is out of range.
    func fetchYerushalmiHalakhaCount(tractate: MishnahTractate, chapter: Int,
                                      defaultCount: Int = 7) async -> Int {
        let name = tractate.name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)
                   ?? tractate.name
        guard let url = URL(string: "https://www.sefaria.org/api/shape/Jerusalem%20Talmud%20\(name)"),
              let (data, _) = try? await dataWithRetry(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let first = json.first,
              let chapters = first["chapters"] as? [[Any]] else {
            return defaultCount
        }
        let idx = chapter - 1
        guard idx >= 0, idx < chapters.count else { return defaultCount }
        return max(1, chapters[idx].count)
    }

    // MARK: - Midrash fetch (verse-based via links API)

    /// Looks up which passage in `work` primarily treats `bookSefariaName chapter:verse`
    /// using Sefaria's /api/links endpoint, then fetches and returns that passage.
    func fetchMidrashByVerse(work: MidrashWork,
                             bookSefariaName: String,
                             chapter: Int,
                             verse: Int) async throws -> (segments: [TextSegment], scrollToIndex: Int) {
        // Build links API URL: dots separate book.chapter.verse
        let verseKey = "\(bookSefariaName).\(chapter).\(verse)"
        guard let encoded = verseKey.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let url = URL(string: "https://www.sefaria.org/api/links/\(encoded)") else {
            throw SefariaError.invalidURL
        }
        let (data, response) = try await dataWithRetry(from: url)
        guard let links = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            throw SefariaError.decodingError(status: (response as? HTTPURLResponse)?.statusCode)
        }
        // Filter by index_title; "ref" is the Midrash passage ref (not "anchor_ref" which is the Torah back-ref)
        let matching = links.filter { link in
            (link["index_title"] as? String) == work.sefariaIndexTitle
        }
        guard let first = matching.first,
              let midrashRef = first["ref"] as? String, !midrashRef.isEmpty else {
            throw SefariaError.noText
        }
        // Strip the last ":N" to get the parent section; parse N as 1-based scroll target.
        // e.g. "Bereshit Rabbah 1:5" → parentRef="Bereshit Rabbah 1", scrollToIndex=4 (0-based)
        let parentRef: String
        let scrollToIndex: Int
        if let colonRange = midrashRef.range(of: ":", options: .backwards),
           let lastNum = Int(midrashRef[midrashRef.index(after: colonRange.lowerBound)...]) {
            parentRef = String(midrashRef[..<colonRange.lowerBound])
            scrollToIndex = max(0, lastNum - 1)
        } else {
            parentRef = midrashRef
            scrollToIndex = 0
        }
        // Fetch the entire parent section so the user can scroll through all paragraphs
        let (he, en) = try await fetchBoth(ref: parentRef)
        let count = max(he.count, en.count)
        var segs: [TextSegment] = []
        for i in 0..<count {
            segs.append(.content(index: i,
                                 he: i < he.count ? he[i] : "",
                                 en: i < en.count ? en[i] : ""))
        }
        let valid = segs.filter { !$0.hebrewHTML.isEmpty || !$0.englishHTML.isEmpty }
        guard !valid.isEmpty else { throw SefariaError.noText }
        return (segments: valid, scrollToIndex: scrollToIndex)
    }

    // MARK: - Chapter fetch (Tanakh, Mishnah, Rambam, SA)

    func fetchChapter(category: TextCategory,
                      bookOrTractateIndex: Int,
                      chapter: Int,
                      selectedCommentaries: [CommentaryType] = []) async throws -> [TextSegment] {
        let r = ref(category: category, bookOrTractateIndex: bookOrTractateIndex, chapterOrDaf: chapter)
        let (he, en) = try await fetchBoth(ref: r)
        let count = max(he.count, en.count)
        let labelStyle = category.segmentLabelStyle
        let isSA = category == .shulchanArukh

        if isSA {
            // For SA: use a for-loop so we can pass shared counters as inout across seifim,
            // ensuring sequential markers number continuously throughout the siman.
            var sharedCounters: [String: Int] = [:]
            var segments: [TextSegment] = []
            for i in 0..<count {
                let label = segmentLabel(style: labelStyle, number: i + 1)
                var heText = i < he.count ? he[i] : ""
                let enText = i < en.count ? en[i] : ""
                heText = SefariaTextClient.processCommentaryMarkers(
                    heText, section: bookOrTractateIndex,
                    selectedCommentaries: selectedCommentaries,
                    counters: &sharedCounters)
                segments.append(.content(index: i, he: heText, en: enText, label: label))
            }
            return segments
        }
        return (0..<count).map { i in
            let label = segmentLabel(style: labelStyle, number: i + 1)
            let heText = i < he.count ? he[i] : ""
            let enText = i < en.count ? en[i] : ""
            return .content(index: i, he: heText, en: enText, label: label)
        }
    }

    // MARK: - Ra'avad Hasagot fetch

    /// Fetches Ra'avad's Hasagot for a Rambam chapter in both languages, in parallel.
    /// Returns `(he, en)` arrays parallel to halakhot; each element contains the Ra'avad's
    /// comment strings for that halakha (empty array = no comment on that halakha).
    func fetchRaavad(rambamRef: String, count: Int) async -> (he: [[String]], en: [[String]]) {
        guard count > 0 else { return ([], []) }
        let raavadRef = "Hasagot HaRa'avad on \(rambamRef):1-\(count)"
        async let heResult = fetchRaavadLang(raavadRef: raavadRef, langKey: "he")
        async let enResult = fetchRaavadLang(raavadRef: raavadRef, langKey: "en")
        return await (heResult, enResult)
    }

    private func fetchRaavadLang(raavadRef: String, langKey: String) async -> [[String]] {
        let lang = langKey == "he" ? "he" : "en"
        guard let url = try? buildURL(ref: raavadRef, lang: lang) else { return [] }
        guard let (data, _) = try? await dataWithRetry(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["error"] == nil,
              let arr = json[langKey == "he" ? "he" : "text"] as? [Any] else { return [] }
        return arr.map { item -> [String] in
            if let innerArr = item as? [Any] {
                return innerArr.compactMap { $0 as? String }
                               .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            }
            if let s = item as? String, !s.trimmingCharacters(in: .whitespaces).isEmpty {
                return [s]
            }
            return []
        }
    }

    /// Attaches Ra'avad Hasagot to matching Rambam text segments as plain text fields.
    /// `he[i]` / `en[i]` holds the comments for `segments[i]`; empty inner array = skip.
    static func applyRaavad(he heRaavad: [[String]], en enRaavad: [[String]], to segments: [TextSegment]) -> [TextSegment] {
        guard !heRaavad.isEmpty || !enRaavad.isEmpty else { return segments }
        return segments.enumerated().map { (i, seg) in
            let heComments = i < heRaavad.count ? heRaavad[i] : []
            let enComments = i < enRaavad.count ? enRaavad[i] : []
            guard !heComments.isEmpty || !enComments.isEmpty else { return seg }
            let heText = heComments.isEmpty ? nil : stripHTML(heComments.joined(separator: " "))
            let enText = enComments.isEmpty ? nil : stripHTML(enComments.joined(separator: " "))
            return .content(index: seg.index, he: seg.hebrewHTML, en: seg.englishHTML,
                            label: seg.label, raavadHe: heText, raavadEn: enText)
        }
    }

    // MARK: - Commentary fetch

    func fetchCommentary(type: CommentaryType, mainRef: String) async throws -> [String] {
        let commentaryRef = type.sefariaRef(forMainRef: mainRef)
        return try await fetchRaw(ref: commentaryRef, language: "en")
    }

    func fetchCommentaryHebrew(type: CommentaryType, mainRef: String) async throws -> [String] {
        let commentaryRef = type.sefariaRef(forMainRef: mainRef)
        return try await fetchRaw(ref: commentaryRef, language: "he")
    }

    // MARK: - Helpers

    private func buildURL(ref: String, lang: String = "he") throws -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.sefaria.org"
        // v2 API — returns {"he":[...], "text":[...]} where "text" is the requested lang
        components.path = "/api/texts/\(ref)"
        components.queryItems = [
            URLQueryItem(name: "context", value: "0"),
            URLQueryItem(name: "lang", value: lang),
        ]
        guard let url = components.url else { throw SefariaError.invalidURL }
        return url
    }

    private func flattenTextValue(_ value: Any) -> [String] {
        if let s = value as? String { return [s] }
        if let arr = value as? [Any] { return arr.flatMap { flattenTextValue($0) } }
        return []
    }

    private func segmentLabel(style: SegmentLabelStyle, number: Int) -> String? {
        switch style {
        case .verse:    return "\(number)"
        case .mishnah:  return "\(number)"
        case .halakha:  return "\(number)"
        case .sif:      return "\(number)"
        case .none:     return nil
        }
    }

    // MARK: - SA Commentary Marker Processing

    /// Converts inline Shulchan Arukh commentary markers to readable inline indicators.
    ///
    /// - Mishnah Berurah (OC): `<i data-commentator="Mishnah Berurah" data-label="X">` → `(X)`
    /// - Key commentators by section: replaced with sequential Hebrew letters in the
    ///   appropriate bracket style — `(א)` parens, `{א}` curly — based on document order.
    ///
    /// - parameter section: 0=OC, 1=YD, 2=EH, 3=CM  (matches SA section index).
    static func processCommentaryMarkers(_ html: String, section: Int = 0,
                                          selectedCommentaries: [CommentaryType] = [],
                                          counters: inout [String: Int]) -> String {
        var s = html

        // Slot style table — shared by MB labels and sequential Hebrew-letter markers.
        // Single-panel mode (≤3 commentaries): round | curly | small-round (legacy).
        // Both-panels mode (>3 commentaries): 6-entry table where slots 0-2 are the main
        // panel (all normal size) and slots 3-5 are the right panel (all small size).
        // Bracket types: () round · {} curly · [] square — three visually distinct shapes.
        let slotStyles: [(open: String, close: String, isSmall: Bool)] =
            selectedCommentaries.count > 3
            ? [("(", ")", false), ("{", "}", false), ("[", "]", false),   // main panel
               ("(", ")", true),  ("{", "}", true),  ("[", "]", true)]    // right panel (small)
            : [("(", ")", false), ("{", "}", false), ("(", ")", true)]    // single-panel legacy

        // ── Mishnah Berurah (OC) — uses data-label attribute ────────────────────
        if s.contains("Mishnah Berurah") {
            // Bracket style follows MB's slot position, same as all other commentators.
            let mbSlotIdx = selectedCommentaries.firstIndex(of: .mishnahBerurah)
            let mbStyle = mbSlotIdx.flatMap { $0 < slotStyles.count ? slotStyles[$0] : nil }
                ?? (open: "(", close: ")", isSmall: false)  // fallback when slot unknown
            s = s.replacingOccurrences(
                of: #"data-commentator=Mishnah Berurah""#,
                with: #"data-commentator="Mishnah Berurah""#)
            if let mbRegex = try? NSRegularExpression(
                pattern: #"<i\b[^>]*Mishnah Berurah[^>]*\bdata-label="([^"]*)"[^>]*>\s*</i>"#) {
                let matches = mbRegex.matches(in: s, range: NSRange(s.startIndex..., in: s))
                for match in matches.reversed() {
                    guard let fullRange = Range(match.range, in: s) else { continue }
                    let label: String
                    if match.range(at: 1).location != NSNotFound,
                       let lr = Range(match.range(at: 1), in: s) {
                        label = String(s[lr])
                    } else { label = "" }
                    guard !label.isEmpty else { s.replaceSubrange(fullRange, with: ""); continue }
                    let text = mbStyle.isSmall
                        ? "<rf>\(mbStyle.open)\(label)\(mbStyle.close)</rf>"
                        : "\(mbStyle.open)\(label)\(mbStyle.close)"
                    s.replaceSubrange(fullRange, with: text)
                }
            }
        }

        // ── Sequential Hebrew-letter markers — dynamic by user's selected commentary slots ────
        // Commentaries without inline markers in this section are skipped (no entry emitted).
        let sectionMarkers: [(name: String, open: String, close: String, isSmall: Bool)] =
            selectedCommentaries.enumerated().compactMap { slotIdx, commentary in
                guard slotIdx < slotStyles.count,
                      let dataName = commentary.saCommentatorDataName(forSection: section)
                else { return nil }
                let s = slotStyles[slotIdx]
                return (name: dataName, open: s.open, close: s.close, isSmall: s.isSmall)
            }

        if !sectionMarkers.isEmpty,
           let tagRegex = try? NSRegularExpression(
                pattern: #"<i\b[^>]*\bdata-commentator="([^"]*)"[^>]*>\s*</i>"#) {
            // Count each configured commentator's occurrences in forward document order,
            // collecting (range, replacement) pairs, then apply in reverse.
            // `counters` is shared across seifim so numbering continues across the siman.
            var replacements: [(range: Range<String.Index>, text: String)] = []
            let allMatches = tagRegex.matches(in: s, range: NSRange(s.startIndex..., in: s))
            for match in allMatches {
                guard let fullRange  = Range(match.range,     in: s),
                      let nameRange  = Range(match.range(at: 1), in: s) else { continue }
                let name = String(s[nameRange])
                guard let cfg = sectionMarkers.first(where: { $0.name == name }) else { continue }
                counters[name, default: 0] += 1
                let letter = saHebrewLetter(counters[name]!)
                // Wrap in <rf>…</rf> only for commentators that get smaller rendering;
                // others emit the bracket marker directly at normal body size.
                let marker = cfg.isSmall
                    ? "<rf>\(cfg.open)\(letter)\(cfg.close)</rf> "
                    : "\(cfg.open)\(letter)\(cfg.close) "
                replacements.append((fullRange, marker))
            }
            for (range, text) in replacements.reversed() {
                s.replaceSubrange(range, with: text)
            }
        }

        return s
    }

    /// Returns the Hebrew numeral representation of n for sequential marker labelling,
    /// without geresh marks: 1=א … 10=י, 11=יא, 12=יב … 20=כ, 21=כא, etc.
    /// Uses the standard additive system (15→טו, 16→טז to avoid divine name combinations).
    static func saHebrewLetter(_ n: Int) -> String {
        guard n >= 1 else { return "\(n)" }
        let hundreds: [(Int, String)] = [(400,"ת"),(300,"ש"),(200,"ר"),(100,"ק")]
        let tens:     [(Int, String)] = [(90,"צ"),(80,"פ"),(70,"ע"),(60,"ס"),(50,"נ"),
                                         (40,"מ"),(30,"ל"),(20,"כ"),(10,"י")]
        let units:    [(Int, String)] = [(9,"ט"),(8,"ח"),(7,"ז"),(6,"ו"),(5,"ה"),
                                         (4,"ד"),(3,"ג"),(2,"ב"),(1,"א")]
        var result = ""
        var rem = n
        for (val, letter) in hundreds { while rem >= val { result += letter; rem -= val } }
        // Special cases: avoid יה (15) and יו (16)
        if rem == 15 { result += "טו"; rem = 0 }
        else if rem == 16 { result += "טז"; rem = 0 }
        for (val, letter) in tens  { if rem >= val { result += letter; rem -= val } }
        for (val, letter) in units { if rem >= val { result += letter; rem -= val } }
        return result.isEmpty ? "\(n)" : result
    }

    // MARK: - HTML stripping

    /// Removes Yerushalmi footnote markers and footnote text from raw HTML.
    /// Handles nested `<i>` tags inside the footnote body that would trip up a simple lazy regex.
    /// Apply to English HTML before storing segments; Hebrew does not carry footnotes.
    static func stripYerushalmiFootnotes(_ html: String) -> String {
        // Pass 1: strip footnote markers — simple, no nesting issues.
        var s = html.replacingOccurrences(
            of: #"<sup[^>]*class="footnote-marker"[^>]*>.*?</sup>"#,
            with: "", options: [.regularExpression, .caseInsensitive])

        // Pass 2: strip <i class="footnote">…</i> blocks depth-first
        // so nested <i> tags inside the footnote body don't confuse the scan.
        var result = ""
        var remaining = s[s.startIndex...]
        let open = "<i class=\"footnote\""
        while !remaining.isEmpty {
            guard let openRange = remaining.range(of: open, options: .caseInsensitive) else {
                result += remaining; break
            }
            result += remaining[..<openRange.lowerBound]
            remaining = remaining[openRange.lowerBound...]
            // Skip to end of opening tag '>'
            guard let gtIdx = remaining.firstIndex(of: ">") else { result += remaining; break }
            remaining = remaining[remaining.index(after: gtIdx)...]
            // Walk forward, tracking <i> depth, until depth reaches 0
            var depth = 1
            while depth > 0, !remaining.isEmpty {
                let ni = remaining.range(of: "<i",   options: .caseInsensitive)
                let nc = remaining.range(of: "</i>", options: .caseInsensitive)
                guard let closeRange = nc else { remaining = remaining[remaining.endIndex...]; break }
                if let openRng = ni, openRng.lowerBound < closeRange.lowerBound {
                    depth += 1
                    remaining = remaining[openRng.upperBound...]
                } else {
                    depth -= 1
                    remaining = remaining[closeRange.upperBound...]
                }
            }
        }
        return result
    }

    /// Removes `<b>…</b>` / `<strong>…</strong>` blocks **including content** then strips
    /// remaining HTML.  Used for Tanakh main text where bold marks unwanted lemas or
    /// footnote anchors that appear before the actual translation text.
    static func stripBoldContent(_ html: String) -> String {
        var s = html
        if let regex = try? NSRegularExpression(
            pattern: #"<(?:b|strong)[^>]*>.*?</(?:b|strong)>"#,
            options: [.caseInsensitive, .dotMatchesLineSeparators]) {
            s = regex.stringByReplacingMatches(
                in: s, range: NSRange(s.startIndex..., in: s), withTemplate: "")
        }
        return stripHTML(s)
    }

    /// Removes a leading bold label such as `<b>א</b>` from Sefaria HTML.
    /// Used when the commentary panel manages its own sequential prefix so that
    /// Sefaria's embedded label and our prefix don't both appear.
    static func stripLeadingBoldLabel(_ html: String) -> String {
        html.replacingOccurrences(
            of: #"^\s*<b>[^<]{0,15}</b>\s*"#,
            with: "", options: [.regularExpression])
    }

    static func stripHTML(_ html: String) -> String {
        // Use depth-aware stripping for footnotes — the simple lazy regex fails when
        // the footnote body contains nested <i> tags (e.g. <i>Deut.</i> inside the note).
        var s = stripYerushalmiFootnotes(html)
        // Strip remaining HTML tags and decode common entities
        return s
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;",  with: " ")
            .replacingOccurrences(of: "&thinsp;", with: " ")
            .replacingOccurrences(of: "&amp;",   with: "&")
            .replacingOccurrences(of: "&lt;",    with: "<")
            .replacingOccurrences(of: "&gt;",    with: ">")
            .replacingOccurrences(of: "&#x27;",  with: "'")
            .replacingOccurrences(of: "&quot;",  with: "\"")
    }

    /// Returns Hebrew text with HTML stripped and cantillation marks (U+0591–U+05AF) optionally
    /// removed based on the user's "showTrop" preference (stored in UserDefaults, default false).
    /// Use this for all Hebrew main-text rendering; use `stripHTML` directly for English text.
    static func processedHebrew(_ html: String) -> String {
        let text = stripHTML(html)
        guard UserDefaults.standard.bool(forKey: "showTrop") else {
            return String(text.unicodeScalars.filter { $0.value < 0x0591 || $0.value > 0x05AF })
        }
        return text
    }
}

// MARK: - Rambam flat list helper

private let allRambamWorks: [RambamWork] = TextCatalog.rambamSefarim.flatMap { $0.works }

extension SefariaTextClient {
    var rambamWorks: [RambamWork] { allRambamWorks }
}
