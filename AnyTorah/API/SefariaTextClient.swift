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
            } else if heArr.count > enArr.count {
                // Hebrew has more (real, granular) outer paragraphs than English — e.g. Beit
                // Yosef, Orach Chayim 1 has 17 Hebrew comments but Sefaria's English translation
                // only covers the first one (confirmed live: the lone English entry is verbatim
                // just paragraph 1's translation). Hebrew's own paragraph count is the ground
                // truth here and must not be collapsed just because the translation is sparse —
                // pair by outer index, leaving English empty wherever there's no corresponding
                // entry, instead of joining every Hebrew paragraph into one blob (the old
                // behavior here silently collapsed Tur OC 1's Beit Yosef down to a single entry,
                // which cascades into a single unbroken Tur paragraph and missing Darkhei Moshe
                // marks — real regression found live, not a hypothetical).
                for i in 0..<heArr.count {
                    let hInner = flattenTextValue(heArr[i])
                        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                    let eInner = i < enArr.count
                        ? flattenTextValue(enArr[i]).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                        : []
                    let before = heSegs.count
                    alignedAppend(hInner: hInner, eInner: eInner, into: &heSegs, en: &enSegs)
                    let added = heSegs.count - before
                    outerIndices.append(contentsOf: repeatElement(i, count: added))
                }
            } else {
                // Opposite direction (e.g. intro: 1 he vs 7 en at top level) — Hebrew's single
                // outer entry is the real paragraph unit and English's extra granularity is just
                // translation-side formatting, so merge everything into one combined entry, as
                // before.
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

    /// Fetches a single language's text segments, optionally from a specific named Sefaria version.
    func fetchRaw(ref: String, language: String, version: String? = nil) async throws -> [String] {
        return try await fetchSingleLang(ref: ref, lang: language, version: version)
    }

    /// Low-level single-language fetch. lang="he" → json["he"], lang="en" → json["text"].
    private func fetchSingleLang(ref: String, lang: String, version: String? = nil) async throws -> [String] {
        let url = try buildURL(ref: ref, lang: lang, version: version)
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

    /// Kinnim and Middot have no Gemara — Sefaria doesn't index them by daf/amud at all, only as
    /// Mishnah chapters (confirmed live: "Kinnim 23a"/"Middot 34a" both 404). Shekalim has no
    /// Bavli text at all — only Jerusalem Talmud (confirmed live: "Shekalim 2a" 404), though it's
    /// printed and navigable in the Bavli volume/Daf Yomi cycle under Bavli-style daf pagination
    /// regardless. All three tractates are still printed (and navigable in this app) with their
    /// own daf/amud pages, so each daf+amud is mapped to the real ref that actually appears on
    /// that printed page. This is the same mapping already shipped in production in AnyDaf's
    /// SefariaClient.swift/.kt — reused here rather than re-derived, including a user-verified
    /// correction for Kinnim/Middot's exact chapter/mishnah boundaries (Kinnim has content only
    /// on amud alef of each daf — 22a/23a/24a/25a; there is no amud bet content for any Kinnim daf).
    private static let noStandardBavliRefTalmudRefs: [String: [String: String]] = [
        "Shekalim": [
            "2a": "Jerusalem Talmud Shekalim 1:1:1-5",
            "2b": "Jerusalem Talmud Shekalim 1:1:5-10",
            "3a": "Jerusalem Talmud Shekalim 1:1:10-2:5",
            "3b": "Jerusalem Talmud Shekalim 1:2:5-4:1",
            "4a": "Jerusalem Talmud Shekalim 1:4:1-5",
            "4b": "Jerusalem Talmud Shekalim 1:4:5-9",
            "5a": "Jerusalem Talmud Shekalim 1:4:9-2:1:4",
            "5b": "Jerusalem Talmud Shekalim 2:1:4-3:1",
            "6a": "Jerusalem Talmud Shekalim 2:3:1-4:1",
            "6b": "Jerusalem Talmud Shekalim 2:4:1-5",
            "7a": "Jerusalem Talmud Shekalim 2:4:5-5:4",
            "7b": "Jerusalem Talmud Shekalim 2:5:4-3:1:3",
            "8a": "Jerusalem Talmud Shekalim 3:1:3-2:2",
            "8b": "Jerusalem Talmud Shekalim 3:2:2-8",
            "9a": "Jerusalem Talmud Shekalim 3:2:8-3:1",
            "9b": "Jerusalem Talmud Shekalim 3:3:1-4:1:1",
            "10a": "Jerusalem Talmud Shekalim 4:1:1-2:1",
            "10b": "Jerusalem Talmud Shekalim 4:2:1-4",
            "11a": "Jerusalem Talmud Shekalim 4:2:4-3:2",
            "11b": "Jerusalem Talmud Shekalim 4:3:2-4:1",
            "12a": "Jerusalem Talmud Shekalim 4:4:1-5",
            "12b": "Jerusalem Talmud Shekalim 4:4:5-9",
            "13a": "Jerusalem Talmud Shekalim 4:4:9-5:1:3",
            "13b": "Jerusalem Talmud Shekalim 5:1:3-12",
            "14a": "Jerusalem Talmud Shekalim 5:1:12-21",
            "14b": "Jerusalem Talmud Shekalim 5:1:21-3:2",
            "15a": "Jerusalem Talmud Shekalim 5:3:2-4:10",
            "15b": "Jerusalem Talmud Shekalim 5:4:10-6:1:5",
            "16a": "Jerusalem Talmud Shekalim 6:1:5-11",
            "16b": "Jerusalem Talmud Shekalim 6:1:11-2:1",
            "17a": "Jerusalem Talmud Shekalim 6:2:1-7",
            "17b": "Jerusalem Talmud Shekalim 6:2:7-3:3",
            "18a": "Jerusalem Talmud Shekalim 6:3:3-4:2",
            "18b": "Jerusalem Talmud Shekalim 6:4:2-7",
            "19a": "Jerusalem Talmud Shekalim 6:4:7-7:2:1",
            "19b": "Jerusalem Talmud Shekalim 7:2:1-7",
            "20a": "Jerusalem Talmud Shekalim 7:2:7-3:2",
            "20b": "Jerusalem Talmud Shekalim 7:3:2-7",
            "21a": "Jerusalem Talmud Shekalim 7:3:7-8:1:1",
            "21b": "Jerusalem Talmud Shekalim 8:1:1-3:1",
            "22a": "Jerusalem Talmud Shekalim 8:3:1-4:4",
            "22b": "Jerusalem Talmud Shekalim 8:4:4",
        ],
        // Only amud alef of each daf has content; amud bet is absent (no text) for every Kinnim daf.
        "Kinnim": [
            "22a": "Mishnah Kinnim 1",
            "23a": "Mishnah Kinnim 2",
            "24a": "Mishnah Kinnim 3:1-5",
            "25a": "Mishnah Kinnim 3:6",
        ],
        "Middot": [
            "34a": "Mishnah Middot 1:1-4",
            "34b": "Mishnah Middot 1:5-9",
            "35a": "Mishnah Middot 2:1-3",
            "35b": "Mishnah Middot 2:4-6",
            "36a": "Mishnah Middot 3",
            "36b": "Mishnah Middot 4:1-2",
            "37a": "Mishnah Middot 4:3-7",
            "37b": "Mishnah Middot 5",
        ],
    ]

    /// Builds a Talmud-category ref for one amud, substituting the real ref for tractates that
    /// have no standard Bavli daf ref on Sefaria (see noStandardBavliRefTalmudRefs above). Falls
    /// back to the standard "{tractate} {daf}{amud}" form for every other tractate, including
    /// Tamid (mishnahOnly but has real Gemara from 25b on — only Shekalim/Kinnim/Middot need
    /// substitution).
    func talmudAmudRef(sefariaTractateName: String, daf: Int, amud: String) -> String {
        if let override = Self.noStandardBavliRefTalmudRefs[sefariaTractateName]?["\(daf)\(amud)"] {
            return override
        }
        return "\(sefariaTractateName) \(daf)\(amud)"
    }

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
            return talmudAmudRef(sefariaTractateName: tractate.sefariaName, daf: chapterOrDaf, amud: a)

        case .rambam:
            let work = allRambamWorks.first(where: { $0.id == bookOrTractateIndex })
                    ?? allRambamWorks[0]
            return "\(work.sefariaName) \(chapterOrDaf)"

        case .tur:
            let section = TextCatalog.turSections.first(where: { $0.id == bookOrTractateIndex })
                       ?? TextCatalog.turSections[0]
            return "\(section.sefariaName) \(chapterOrDaf)"

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
        let refA = talmudAmudRef(sefariaTractateName: tractate.sefariaName, daf: daf, amud: "a")
        let refB = talmudAmudRef(sefariaTractateName: tractate.sefariaName, daf: daf, amud: "b")

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

    /// Per-section Sefaria version title for Shulchan Arukh's vocalized (Torat Emet) edition —
    /// split across two physical volumes, confirmed directly against the API at multiple simanim
    /// spanning each section's full range (not assumed from one spot-check): Orach Chayim and
    /// Choshen Mishpat share one volume, Yoreh De'ah and Even HaEzer the other. Section index
    /// matches the 0=OC/1=YD/2=EH/3=CM convention used throughout this file.
    private static let saVocalizedVersion: [Int: String] = [
        0: "Torat Emet 363", // Orach Chayim
        1: "Torat Emet 357", // Yoreh De'ah
        2: "Torat Emet 357", // Even HaEzer
        3: "Torat Emet 363", // Choshen Mishpat
    ]

    func fetchChapter(category: TextCategory,
                      bookOrTractateIndex: Int,
                      chapter: Int,
                      selectedCommentaries: [CommentaryType] = [],
                      saTextMode: SATextMode = .commentary) async throws -> [TextSegment] {
        let r = ref(category: category, bookOrTractateIndex: bookOrTractateIndex, chapterOrDaf: chapter)
        let isSA = category == .shulchanArukh
        let useVocalizedSA = isSA && saTextMode == .nikud
        let (he, en): ([String], [String])
        if useVocalizedSA {
            async let heResult = fetchRaw(ref: r, language: "he",
                                          version: SefariaTextClient.saVocalizedVersion[bookOrTractateIndex])
            async let enResult = fetchRaw(ref: r, language: "en")
            (he, en) = try await (heResult, enResult)
        } else {
            (he, en) = try await fetchBoth(ref: r)
        }
        let count = max(he.count, en.count)
        let labelStyle = category.segmentLabelStyle

        if isSA {
            // Sefaria bakes each siman's printed title (e.g. "הלכות ציצית ועטיפתו. ובו יז
            // סעיפים:") into the start of seif 1's Hebrew as a <b>...</b> block, with no
            // parallel sentence in the English translation — confirmed directly against the
            // API. Split it into its own unlabeled header segment (no seif number — it isn't
            // one) rather than running it together with seif 1's actual text and commentary
            // markers. The vocalized edition has no such block at all — splitSimanHeader simply
            // finds no match and no-ops, so seif 1 just starts without a separate header line.
            var sharedCounters: [String: Int] = [:]
            var segments: [TextSegment] = []
            for i in 0..<count {
                let label = segmentLabel(style: labelStyle, number: i + 1)
                var heText = i < he.count ? he[i] : ""
                let enText = i < en.count ? en[i] : ""
                if i == 0, let split = TurParagraphEngine.splitSimanHeader(heText) {
                    segments.append(.content(index: segments.count, he: split.header, en: "", label: nil))
                    heText = split.rest
                }
                // Rema first — its opening-word test needs Sefaria's own contentless <i> markers
                // still in place, not the visible bracket text processCommentaryMarkers leaves
                // behind. See processRemaGlosses. Runs in both text modes — Rema's glosses exist
                // independently of which SA edition is fetched.
                heText = SefariaTextClient.processRemaGlosses(heText)
                // The vocalized edition carries no <i data-commentator> tags at all (confirmed
                // against the API) — processCommentaryMarkers would simply find nothing to
                // replace, so it's skipped outright rather than run for no effect.
                if !useVocalizedSA {
                    heText = SefariaTextClient.processCommentaryMarkers(
                        heText, section: bookOrTractateIndex,
                        selectedCommentaries: selectedCommentaries,
                        counters: &sharedCounters)
                }
                segments.append(.content(index: segments.count, he: heText, en: enText, label: label))
            }
            return segments
        }

        if category == .tur {
            let engineSegments = await TurParagraphEngine.buildTurSegments(he, en) {
                await SefariaTextClient.shared.fetchTurCommentaryEntries(type: .beitYosef, mainRef: r)
            }
            return engineSegments.map {
                .content(index: $0.index, he: $0.he, en: $0.en, label: $0.label)
            }
        }

        return (0..<count).map { i in
            let label = segmentLabel(style: labelStyle, number: i + 1)
            let heText = i < he.count ? he[i] : ""
            let enText = i < en.count ? en[i] : ""
            return .content(index: i, he: heText, en: enText, label: label)
        }
    }

    /// Fetches a Tur commentary's entries for `mainRef`, applying the blanket `:1-500` depth-3
    /// range fix (all 4 Tur commentary tabs need it, unlike SA's single-commentator Shakh
    /// exception — see `TextReaderViewModel.loadCommentary`) and walking
    /// `CommentaryType.sefariaRefVersions` the same way the general commentary-loading path
    /// does, so Prisha+Drisha's book-divider entry comes through correctly here too. Used both
    /// by `fetchChapter`'s Tur branch (always needs Beit Yosef, regardless of which tab is open)
    /// and by `TurParagraphEngine`'s own internal fetches (Beit Yosef for paragraph-splitting,
    /// Darkhei Moshe for the Beit-Yosef-anchored marker fallback).
    func fetchTurCommentaryEntries(type: CommentaryType, mainRef: String) async -> [CommentaryEntry] {
        let rangedRef = "\(mainRef):1-500"
        let versions = type.sefariaRefVersions(forMainRef: rangedRef)
        var entries: [CommentaryEntry] = []
        var seqIdx = 0
        for (versionRef, label) in versions {
            if let label {
                entries.append(type.usesBookDivider ? .bookDivider(label) : .recensionHeader(label))
            }
            let (hSegs, eSegs, _) = (try? await fetchBothAligned(ref: versionRef)) ?? ([], [], [])
            let count = max(hSegs.count, eSegs.count)
            for i in 0..<count {
                let h = i < hSegs.count ? hSegs[i] : ""
                let e = i < eSegs.count ? eSegs[i] : ""
                guard !h.trimmingCharacters(in: .whitespaces).isEmpty ||
                      !e.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                entries.append(.text(index: seqIdx, he: h, en: e))
                seqIdx += 1
            }
        }
        return entries
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

    private func buildURL(ref: String, lang: String = "he", version: String? = nil) throws -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.sefaria.org"
        // v2 API — returns {"he":[...], "text":[...]} where "text" is the requested lang
        components.path = "/api/texts/\(ref)"
        var items = [
            URLQueryItem(name: "context", value: "0"),
            URLQueryItem(name: "lang", value: lang),
        ]
        if let version {
            items.append(URLQueryItem(name: lang == "he" ? "vhe" : "ven", value: version))
        }
        components.queryItems = items
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

    // MARK: - Rema (the Mapah) glosses

    /// Matches a Rema gloss's opening word "הגה" — optionally behind a bracket/paren, and
    /// tolerating either gershayim spelling alongside the far more common unpunctuated "הגה".
    /// Tested against nikud-stripped text (see isRemaGloss) — the vocalized SA edition (see
    /// SATextMode) interleaves vowel points between the consonants ("הַגָּה"), which would
    /// otherwise break the literal match.
    ///
    /// The trailing `(?![א-ת])` is load-bearing, not decorative: without it this also matches
    /// "הגהות" ("Hagahot", e.g. the citation title "Hagahot Maimoniyot") as if it were the word
    /// "הגה" — a real bug found live (OC 2:6's own citation "(הגהות מיימוני...)" was wrongly
    /// styled as Rema). Requiring "הגה" not continue into another Hebrew letter makes it a whole
    /// word rather than a prefix match.
    private static let remaOpeningPattern = #"^[\s\[\(]*הג["'׳״]?ה(?![א-ת])"#

    /// Punctuation Sefaria's vocalized (Torat Emet) edition leaves between two sibling `<small>`
    /// tags that are really one continuous gloss (see absorbGlossRun below) — confirmed by
    /// scanning ~100 simanim across all four sections: plain space (the overwhelming majority),
    /// period+space, comma+space, and (found by direct inspection, rarer) semicolon+space.
    private static let remaGapPattern = #"^[\s.,;:]*"#
    private static let smallOpen  = "<small>"
    private static let smallClose = "</small>"

    /// Location of the `</small>` closing the `<small>` at `openIndex`, accounting for nesting.
    /// Returns nil when the tag is never closed, leaving the caller's text untouched.
    private static func matchingSmallEnd(_ ns: NSString, openIndex: Int) -> Int? {
        var depth = 1
        var i = openIndex + (smallOpen as NSString).length
        while i < ns.length {
            let rest = NSRange(location: i, length: ns.length - i)
            let close = ns.range(of: smallClose, range: rest)
            if close.location == NSNotFound { return nil }
            let open = ns.range(of: smallOpen, range: rest)
            if open.location != NSNotFound, open.location < close.location {
                depth += 1
                i = open.location + (smallOpen as NSString).length
                continue
            }
            depth -= 1
            if depth == 0 { return close.location }
            i = close.location + (smallClose as NSString).length
        }
        return nil
    }

    private static func isRemaGloss(_ bodyHTML: String) -> Bool {
        let text = stripHTML(bodyHTML).strippingNikud.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.range(of: remaOpeningPattern, options: .regularExpression) != nil
    }

    /// ASCII characters `remaGapPattern` matches — plain-character scan is enough (no need to
    /// compile an NSRegularExpression per call) since every observed gap character is basic ASCII
    /// whitespace/punctuation; any real Hebrew character always fails this membership test and
    /// correctly stops absorption, so there's no risk of swallowing real gloss/Mechaber text.
    private static let remaGapCharacters: Set<Character> = [" ", "\t", "\n", ".", ",", ";", ":"]

    /// Extends a confirmed Rema-gloss opening forward across any immediately-following sibling
    /// `<small>` tags separated only by whitespace/simple punctuation — see processRemaGlosses'
    /// doc comment for why this is needed. Returns the closeLocation of the last absorbed
    /// sibling (== `firstEnd` itself if nothing follows).
    private static func absorbGlossRun(_ ns: NSString, firstEnd: Int) -> Int {
        var runEnd = firstEnd
        while true {
            var p = runEnd + (smallClose as NSString).length
            while p < ns.length, let scalar = Unicode.Scalar(ns.character(at: p)),
                  remaGapCharacters.contains(Character(scalar)) {
                p += 1
            }
            let openLen = (smallOpen as NSString).length
            guard p + openLen <= ns.length,
                  ns.substring(with: NSRange(location: p, length: openLen)) == smallOpen
            else { return runEnd }
            guard let nextEnd = matchingSmallEnd(ns, openIndex: p) else { return runEnd }
            runEnd = nextEnd
        }
    }

    /// Wraps Rema's glosses — the Mapah — in `<rm>…</rm>` so `TextContentView.styledHebrew` can
    /// set them in a different face from the Mechaber's own text, the way printed Shulchan Arukh
    /// volumes distinguish the two.
    ///
    /// Sefaria marks each gloss as its own `<small>…</small>` block opening with the word "הגה",
    /// and uses that same `<small>` tag for unrelated parenthetical matter (word explanations,
    /// bare source citations) that must *not* be restyled — hence the opening-word test rather
    /// than treating every `<small>` as Rema. Verified against the live API over 60 simanim
    /// spanning all four sections: 114 of 235 `<small>` blocks opened with "הגה", and "הגה" never
    /// appeared outside a `<small>` even once, so this catches every gloss with no false positives.
    ///
    /// The `<small>` boundary — not the first colon — is where a gloss actually ends: glosses
    /// routinely contain internal colons ahead of their closing source citation (YD 1:1's
    /// "…שאין הנשים שוחטות: (ב"י בשם האגור):"), and many end on the citation rather than a colon
    /// at all, so cutting at the first colon would truncate Rema mid-gloss.
    ///
    /// **Must run before `processCommentaryMarkers`.** The opening-word test strips tags to read
    /// the gloss's first word, which only works while any leading tags are still Sefaria's
    /// contentless `<i data-commentator …></i>` markers — once those become `(א)` bracket text they
    /// carry visible characters of their own and would mask the "הגה".
    ///
    /// **The vocalized edition fragments one printed gloss across many sibling `<small>` tags**,
    /// unlike the default edition's single contiguous block per gloss — confirmed directly
    /// against the API (e.g. OC 1:1, 2:6, 3:11): only the *first* sibling opens with "הגה"; the
    /// rest are the same gloss's own continuation sentences and source citations, which don't
    /// themselves start with "הגה" and would otherwise be left unstyled. `absorbGlossRun` extends
    /// a confirmed opening forward across any immediately-following sibling `<small>` tags — real
    /// (non-whitespace, non-punctuation) Mechaber text between two `<small>` tags always signals
    /// the gloss has ended (confirmed in every case checked, e.g. OC 2's own "וְיִבְדֹּק נְקָבָיו:"
    /// sits plainly between two small runs there and is correctly excluded).
    static func processRemaGlosses(_ html: String) -> String {
        guard html.contains(smallOpen) else { return html }
        let ns = html as NSString
        var out = ""
        var i = 0
        while i < ns.length {
            let open = ns.range(of: smallOpen, range: NSRange(location: i, length: ns.length - i))
            if open.location == NSNotFound { break }
            guard let closeLocation = matchingSmallEnd(ns, openIndex: open.location) else { break }
            let bodyStart = open.location + (smallOpen as NSString).length
            let body = ns.substring(with: NSRange(location: bodyStart, length: closeLocation - bodyStart))
            out += ns.substring(with: NSRange(location: i, length: open.location - i))
            if isRemaGloss(body) {
                let runEnd = absorbGlossRun(ns, firstEnd: closeLocation)
                let wholeLen = runEnd + (smallClose as NSString).length - open.location
                let whole = ns.substring(with: NSRange(location: open.location, length: wholeLen))
                out += "<rm>\(whole)</rm>"
                i = runEnd + (smallClose as NSString).length
                continue
            } else {
                // Not Rema, but a gloss nested inside it still might be — recurse rather than skip.
                out += "\(smallOpen)\(processRemaGlosses(body))\(smallClose)"
            }
            i = closeLocation + (smallClose as NSString).length
        }
        return out + ns.substring(from: i)
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
