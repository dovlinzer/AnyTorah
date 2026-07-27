import Foundation

/// Tur's own text has no native paragraph structure fine-grained enough to read comfortably — a
/// "Tur paragraph" is *defined* as "from one Beit Yosef comment to the next," since Beit Yosef
/// opens each entry with a direct quote of the Tur words it discusses. This whole file is a
/// faithful, line-by-line port of AnyTorahWeb's `lib/sefariaClient.ts` Tur paragraph-splitting
/// and Darkhei-Moshe-marker logic (already mechanically ported and verified against real Sefaria
/// data on Android first — see `TurParagraphEngine.kt`/`TurParagraphEngineTest.kt`) — every
/// constant, ordering, and heuristic here was independently debugged against real Sefaria data
/// (Tur OC 1/3/25/43/132/133) and must not be "improved"/redesigned without re-deriving against
/// those same simanim.
///
/// All position-based logic operates in UTF-16 code-unit index space (matching Kotlin's `Char`/
/// JavaScript's string-index semantics exactly, unlike Swift's default grapheme-cluster `String`
/// indexing) — safe here because Hebrew letters, nikud, and the HTML markup involved never
/// require surrogate pairs, so UTF-16 index == Unicode scalar index for this entire domain.
enum TurParagraphEngine {

    // MARK: - Self-contained string helpers (not shared with SefariaTextClient)
    //
    // SefariaTextClient is @MainActor-isolated (it owns UserDefaults/network state); calling its
    // static stripHTML/processedHebrew from this engine's synchronous, nonisolated functions
    // would force every algorithm function here to become async and actor-hop, which is exactly
    // the framework coupling this file is deliberately kept free of (see the type doc above).
    // These are plain copies of that logic, minus the Yerushalmi-footnote step (never relevant
    // to Tur/Beit-Yosef/SA content, which is all this engine ever processes).

    private static func stripHTML(_ html: String) -> String {
        html
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&thinsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&#x27;", with: "'")
            .replacingOccurrences(of: "&quot;", with: "\"")
    }

    /// Matches `SefariaTextClient.processedHebrew`'s default (showTrop == false) behavior —
    /// strips HTML then removes cantillation marks (U+0591–U+05AF).
    static func processedHebrew(_ html: String) -> String {
        let text = stripHTML(html)
        return String(text.unicodeScalars.filter { $0.value < 0x0591 || $0.value > 0x05AF })
    }

    /// Matches `SefariaTextClient.saHebrewLetter` exactly (standard additive Hebrew numeral
    /// system, no geresh marks).
    private static func saHebrewLetter(_ n: Int) -> String {
        guard n >= 1 else { return "\(n)" }
        let hundreds: [(Int, String)] = [(400, "ת"), (300, "ש"), (200, "ר"), (100, "ק")]
        let tens: [(Int, String)] = [(90, "צ"), (80, "פ"), (70, "ע"), (60, "ס"), (50, "נ"),
                                      (40, "מ"), (30, "ל"), (20, "כ"), (10, "י")]
        let units: [(Int, String)] = [(9, "ט"), (8, "ח"), (7, "ז"), (6, "ו"), (5, "ה"),
                                       (4, "ד"), (3, "ג"), (2, "ב"), (1, "א")]
        var result = ""
        var rem = n
        for (val, letter) in hundreds { while rem >= val { result += letter; rem -= val } }
        if rem == 15 { result += "טו"; rem = 0 }
        else if rem == 16 { result += "טז"; rem = 0 }
        for (val, letter) in tens { if rem >= val { result += letter; rem -= val } }
        for (val, letter) in units { if rem >= val { result += letter; rem -= val } }
        return result.isEmpty ? "\(n)" : result
    }

    // MARK: - Siman header split (also used for Shulchan Arukh, not just Tur)

    struct SimanHeaderSplit {
        let header: String
        let rest: String
    }

    /// Splits a Shulchan Arukh/Tur siman's leading bold title (e.g. "הלכות ציצית ועטיפתו. ובו יז
    /// סעיפים:") out of seif 1's Hebrew HTML into its own header line. Sefaria bakes the printed
    /// siman title into the very start of seif 1's Hebrew as a `<b>...</b>` block for every
    /// siman — confirmed directly against the API — with no parallel sentence in the English
    /// translation, so this only ever applies to the Hebrew side. Returns nil (leaving seif 1
    /// untouched) when the text doesn't start with a bold block, rather than assuming the
    /// pattern always holds.
    static func splitSimanHeader(_ rawHeHtml: String) -> SimanHeaderSplit? {
        guard let regex = try? NSRegularExpression(pattern: "^\\s*<b>([\\s\\S]*?)</b>\\s*") else { return nil }
        let ns = rawHeHtml as NSString
        guard let match = regex.firstMatch(in: rawHeHtml, range: NSRange(location: 0, length: ns.length)),
              match.range.location == 0 else { return nil }
        let header = ns.substring(with: match.range(at: 1))
        let rest = ns.substring(from: match.range.length)
        return SimanHeaderSplit(header: header, rest: rest)
    }

    // MARK: - Combining Tur's seifim into one flat string

    struct CombinedTurSeifim {
        let header: String?
        let combinedHe: String
        let seifStarts: [Int]
    }

    /// Extracts the siman-title header (seif 0 only) and concatenates every seif's remaining
    /// Hebrew into one continuous string. Tur's own (rare) seif divisions don't align with
    /// anything Beit Yosef's own commentary respects either (Beit Yosef's ref structure is
    /// Siman -> Seif Katan, entirely independent of Tur's own Siman -> Seif), so paragraph
    /// structure is computed flat across the whole siman. Also returns each seif's start offset
    /// (UTF-16 units) in the combined string, so English (fetched per-seif, unlike Hebrew's flat
    /// treatment here) can be attached to whichever output paragraph a seif actually begins in.
    static func combineTurSeifim(_ he: [String]) -> CombinedTurSeifim {
        var header: String? = nil
        var parts: [String] = []
        for (i, text) in he.enumerated() {
            if i == 0, let split = splitSimanHeader(text) {
                header = split.header
                parts.append(split.rest)
            } else {
                parts.append(text)
            }
        }
        var combinedHe = ""
        var seifStarts: [Int] = []
        for text in parts {
            seifStarts.append(combinedHe.utf16.count)
            if !combinedHe.isEmpty { combinedHe += " " }
            combinedHe += text
        }
        return CombinedTurSeifim(header: header, combinedHe: combinedHe, seifStarts: seifStarts)
    }

    // MARK: - Tolerant Hebrew word-sequence matching

    /// Matches a multi-letter Hebrew abbreviation: a gershayim (either the ASCII `"` or the
    /// proper Hebrew ״ character digitizations use interchangeably) between two Hebrew letters,
    /// e.g. "בה"כ" (= "בית הכסא"), "ת"ח" (= "תלמידי חכמים").
    private static let hebrewAbbreviationPattern = "[א-ת][\"״][א-ת]"

    /// Builds a regex matching `words` (Hebrew letters only, in order) tolerating any amount of
    /// intervening punctuation/nikud/whitespace between them — lets a Beit Yosef quote match
    /// Tur's own text even where independent digitization introduced minor punctuation
    /// differences. Also tolerates a definite-article "ה" mismatch on each word (real bug found
    /// live: Tur OC 3 has "בפי טבעת" where Beit Yosef's quote of the same words is "בפי הטבעת" —
    /// an exact-word match on "הטבעת" silently failed to find it, merging two real paragraphs
    /// into one).
    ///
    /// A word that's itself a multi-letter abbreviation (`hebrewAbbreviationPattern`) is treated
    /// as a short unconstrained gap instead of requiring its own letters to match literally —
    /// its expansion in the *other* independently-digitized source routinely spells out
    /// completely different letters (real bug found live: Tur OC 43 spells out "לבית הכסא";
    /// Beit Yosef's quote of the same words abbreviates it "לבה"כ" — a literal match on "לבהכ"
    /// never finds "לבית הכסא", so the match silently slid forward to the next word that did
    /// line up, "קבוע," breaking the paragraph one word later than the real start). The words
    /// immediately before/after the abbreviation still have to match literally, which keeps this
    /// from matching too loosely.
    ///
    /// Refuses to build a pattern (returns nil) when more than half its words are these gap
    /// placeholders — real bug found live: Tur OC 3 entry 12 tried a 3-word window that was
    /// itself two citation abbreviations plus one generic word ("ג"ז בס"פ המוציא"), so with 2 of
    /// 3 tokens wildcarded the pattern matched wherever "המוציא" next recurred, many paragraphs
    /// later, skipping several real breaks in between. Citation-heavy commentary text clusters
    /// abbreviations like this constantly, so a single stray one (the OC 43 case) is fine to
    /// bridge, but a window that's mostly gaps has too little real anchor text left to trust —
    /// better to let the caller fall through to a different word count/skip, or fail outright,
    /// than risk a wild, far-away match.
    static func buildHebrewWordPattern(_ words: [String]) -> NSRegularExpression? {
        var parts: [String] = []
        var literalCount = 0
        for raw in words {
            if raw.range(of: hebrewAbbreviationPattern, options: .regularExpression) != nil {
                parts.append("[\\s\\S]{0,20}")
                continue
            }
            let cleaned = String(raw.unicodeScalars.filter { $0.value >= 0x05D0 && $0.value <= 0x05EA })
            if cleaned.isEmpty { continue }
            let stripped: String
            if cleaned.hasPrefix("ה") && cleaned.count > 1 {
                stripped = String(cleaned.dropFirst())
            } else {
                stripped = cleaned
            }
            parts.append("ה?" + NSRegularExpression.escapedPattern(for: stripped))
            literalCount += 1
        }
        if parts.isEmpty { return nil }
        if Double(literalCount) < (Double(parts.count) / 2.0).rounded(.up) { return nil }
        return try? NSRegularExpression(pattern: parts.joined(separator: "[^א-ת]*"))
    }

    // MARK: - Tag stripping with index mapping (for safe paragraph cut points)

    struct StrippedWithIndexMap {
        let text: String
        /// rawIndex[k] = the UTF-16 offset in the original html of the code unit that produced
        /// text's k-th UTF-16 code unit.
        let rawIndex: [Int]
    }

    /// Strips HTML tags only — keeps all text content, punctuation, and nikud intact — while
    /// recording, for each kept UTF-16 code unit, its original offset in `html`. Lets
    /// Beit-Yosef-quote matching (`findTurBreakpoints`) search a tag-free string while still
    /// being able to cut the *original* (tag-and-all) string at the exact right spot afterward,
    /// so a Darkhei Moshe `<dm>N</dm>` marker embedded mid-paragraph still lands in the paragraph
    /// it belongs to.
    static func stripTagsWithIndexMap(_ html: String) -> StrippedWithIndexMap {
        let units = Array(html.utf16)
        var textUnits: [UInt16] = []
        var rawIndex: [Int] = []
        var inTag = false
        for i in 0..<units.count {
            let ch = units[i]
            if ch == 0x3C { inTag = true; continue } // '<'
            if ch == 0x3E { inTag = false; continue } // '>'
            if inTag { continue }
            textUnits.append(ch)
            rawIndex.append(i)
        }
        let text = String(utf16CodeUnits: textUnits, count: textUnits.count)
        return StrippedWithIndexMap(text: text, rawIndex: rawIndex)
    }

    /// Finds the first match of `pattern` within `text`'s UTF-16 range `[from, text.utf16.count)`,
    /// returning the match's start UTF-16 offset (absolute, not relative to `from`), or nil.
    private static func firstMatchOffset(_ pattern: NSRegularExpression, in text: String, from: Int) -> Int? {
        let length = (text as NSString).length
        guard from <= length else { return nil }
        let searchRange = NSRange(location: from, length: length - from)
        guard let match = pattern.firstMatch(in: text, range: searchRange) else { return nil }
        return match.range.location
    }

    // MARK: - Finding Tur's own paragraph breakpoints from Beit Yosef's entries

    /// Finds, for each Beit Yosef entry (in siman order), the raw-string UTF-16 offset in
    /// `combinedHe` (Tur's own post-header Hebrew, tags intact, all seifim concatenated — see
    /// `combineTurSeifim`) where that entry's opening words begin. These offsets become the
    /// paragraph break points: a Tur paragraph is *defined* as "from one Beit Yosef comment to
    /// the next," not by punctuation.
    ///
    /// Forward-only heuristic (shared with `assignTurParagraphLabels`): search only ever moves
    /// forward from the last match (never back to an earlier position, even if the same short
    /// phrase recurs later — the first hit scanning forward is taken as genuine), tried at
    /// decreasing word counts (a long quote is a more confident match), and an entry with no
    /// match simply contributes no break point — it merges into whichever paragraph precedes it
    /// — rather than leaving a gap.
    ///
    /// Also tries skipping the entry's first 1-3 words before matching (real cases confirmed
    /// live on Tur OC 3): Beit Yosef often opens a comment with a standard rhetorical connector —
    /// "ומ"ש" (= "ומה שכתב", "and what [Tur] wrote...") or "ודע ד..." ("know that...") — that
    /// isn't part of Tur's own text at all; the literal quote only starts a word or two later.
    /// Skipping is tried only after the unskipped attempt fails, and only recovers a match if one
    /// of these short preambles was the sole obstacle — an entry with no literal quote anywhere
    /// (a free-standing aside not tied to a specific new Tur phrase) still correctly contributes
    /// no break.
    static func findTurBreakpoints(_ combinedHe: String, _ beitYosefHe: [String]) -> [Int] {
        let stripped = stripTagsWithIndexMap(combinedHe)
        var breakpoints: [Int] = []
        var cursor = 0
        for entryHe in beitYosefHe {
            let words = stripHTML(entryHe)
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }
            var found: Int? = nil
            outer: for skip in [0, 1, 2, 3] {
                let rest = skip < words.count ? Array(words[skip...]) : []
                for wordCount in [8, 6, 4, 3] {
                    if rest.count < wordCount { continue }
                    guard let pattern = buildHebrewWordPattern(Array(rest.prefix(wordCount))) else { continue }
                    guard let offset = firstMatchOffset(pattern, in: stripped.text, from: cursor) else { continue }
                    found = offset
                    break outer
                }
            }
            if let found {
                breakpoints.append(found < stripped.rawIndex.count ? stripped.rawIndex[found] : 0)
                cursor = found
            }
        }
        return breakpoints
    }

    /// Splits `html` at each raw-string UTF-16 offset in `breakpoints` (from `findTurBreakpoints`)
    /// into paragraphs — offsets always fall on a real-text character, never inside a tag (see
    /// `stripTagsWithIndexMap`), so every cut is safe. Any resulting chunk with no real text of
    /// its own (e.g. a lone commentator marker sitting right at a break) is merged forward into
    /// the next real paragraph rather than becoming an empty entry.
    static func splitByBreakpoints(_ html: String, _ breakpoints: [Int]) -> [String] {
        let ns = html as NSString
        let sorted = Array(Set(breakpoints)).sorted()
        var rawParts: [String] = []
        var start = 0
        for bp in sorted {
            if bp <= start { continue }
            rawParts.append(ns.substring(with: NSRange(location: start, length: bp - start)))
            start = bp
        }
        rawParts.append(ns.substring(from: start))

        var result: [String] = []
        var buffer = ""
        for part in rawParts {
            buffer += part
            if !stripHTML(buffer).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                result.append(buffer)
                buffer = ""
            }
        }
        if !buffer.isEmpty {
            if !result.isEmpty {
                result[result.count - 1] += buffer
            } else {
                result.append(buffer)
            }
        }
        return result.isEmpty ? [html] : result
    }

    /// Fetches Beit Yosef for `mainRef` (via the caller-supplied `fetchBeitYosefEntries`) and
    /// uses its entries to split `combinedHe` into paragraphs (`findTurBreakpoints`/
    /// `splitByBreakpoints`) — shared by the main-text builder and the matching corpus used by
    /// `assignTurParagraphLabels` for Bach/Prisha+Drisha, so both always agree on where a Tur
    /// paragraph begins. A siman with no usable Beit Yosef data (fetch failure, or a siman Beit
    /// Yosef simply doesn't cover) falls back to a single paragraph for the whole siman — never
    /// a crash, never a gap.
    static func computeTurParagraphChunks(
        _ combinedHe: String,
        fetchBeitYosefEntries: () async -> [CommentaryEntry]
    ) async -> [String] {
        let entries = await fetchBeitYosefEntries()
        let beitYosefHe: [String] = entries.compactMap { entry in
            if case let .text(_, _, he, _) = entry { return he }
            return nil
        }
        let breakpoints = findTurBreakpoints(combinedHe, beitYosefHe)
        return splitByBreakpoints(combinedHe, breakpoints)
    }

    // MARK: - Assigning Tur paragraph labels to Beit Yosef/Bach/Prisha+Drisha entries

    private static func findParagraphMatch(_ paragraphs: [String], _ cursor: Int, _ pattern: NSRegularExpression) -> Int? {
        guard cursor < paragraphs.count else { return nil }
        for pi in cursor..<paragraphs.count {
            let p = paragraphs[pi]
            let range = NSRange(location: 0, length: (p as NSString).length)
            if pattern.firstMatch(in: p, range: range) != nil { return pi }
        }
        return nil
    }

    /// Assigns each Beit Yosef/Bach/Prisha+Drisha entry a `label` matching the Tur paragraph
    /// (0-based, from `paragraphs`) it comments on, instead of a generic sequential number.
    /// These commentaries each open their comment with a direct quote of the Tur words being
    /// discussed — so a paragraph is found by searching for the entry's own opening words, tried
    /// at decreasing word counts (a long quote is a more confident match; a short one is tried
    /// only if the longer ones fail).
    ///
    /// Best-effort heuristic, not exact: search only ever moves forward from the last match
    /// (never back to an earlier paragraph, even if the same short phrase also happens to recur
    /// later — the first hit found scanning forward is taken as genuine) and a miss just carries
    /// the previous entry's label forward rather than leaving a gap. `entries` may contain a
    /// `.bookDivider` between Prisha's and Drisha's own entries — each is a separate work
    /// independently commenting on the Tur from its own start, so the search cursor and
    /// carried-forward label both reset there.
    ///
    /// Shares `buildHebrewWordPattern` with `findTurBreakpoints` (the "ה" article tolerance and
    /// the Hebrew-abbreviation gap) — both corpora (Tur's raw text there, the already-split
    /// `paragraphs` here) must always benefit from the same match improvements; never let this
    /// function drift onto its own separate matcher.
    static func assignTurParagraphLabels(_ entries: [CommentaryEntry], _ paragraphs: [String]) -> [CommentaryEntry] {
        var cursor = 0
        var lastLabel: Int? = nil
        return entries.map { entry in
            guard case let .text(index, _, he, en) = entry else {
                cursor = 0
                lastLabel = nil
                return entry
            }
            let words = stripHTML(he)
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }
            var matchIdx: Int? = nil
            outer: for skip in [0, 1, 2, 3] {
                let rest = skip < words.count ? Array(words[skip...]) : []
                for wordCount in [8, 6, 4, 3] {
                    if rest.count < wordCount { continue }
                    guard let pattern = buildHebrewWordPattern(Array(rest.prefix(wordCount))) else { continue }
                    guard let found = findParagraphMatch(paragraphs, cursor, pattern) else { continue }
                    matchIdx = found
                    break outer
                }
            }
            if let matchIdx {
                lastLabel = matchIdx
                cursor = matchIdx
            } else if lastLabel == nil {
                lastLabel = 0 // no match yet at all — default to the siman's first paragraph
            }
            return .text(index: index, label: lastLabel, he: he, en: en)
        }
    }

    // MARK: - Darkhei Moshe markers baked into Tur's own text

    /// Converts Tur's Darkhei Moshe position markers into a `<dm>N</dm>` placeholder — printed
    /// Tur editions anchor Darkhei Moshe's marginal notes with a reference number at this exact
    /// spot, and Sefaria's own `data-order="N.M"` already carries that same 1-based sequential
    /// number (confirmed live: it lines up with Darkhei Moshe's own commentary entries in fetch
    /// order, so no separate counter is needed). Every other commentator's markers in the same
    /// text (Beit Yosef, Bach, Prisha, Drisha, and Sefaria's own unlinked "Hagahot" tags) are
    /// deliberately left alone here; they fall out via generic tag-stripping.
    private static let turDMMarkerPattern =
        "<i\\b[^>]*\\bdata-commentator=\"Darkhei Moshe\"[^>]*\\bdata-order=\"(\\d+)\\.\\d+\"[^>]*>\\s*</i>"

    static func processTurMarkers(_ html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: turDMMarkerPattern) else { return html }
        let ns = html as NSString
        var result = ""
        var lastEnd = 0
        regex.enumerateMatches(in: html, range: NSRange(location: 0, length: ns.length)) { match, _, _ in
            guard let match else { return }
            result += ns.substring(with: NSRange(location: lastEnd, length: match.range.location - lastEnd))
            let n = ns.substring(with: match.range(at: 1))
            result += "<dm>\(n)</dm>"
            lastEnd = match.range.location + match.range.length
        }
        result += ns.substring(from: lastEnd)
        return result
    }

    /// Builds Tur's main-text segments: the siman-title header (if any) as its own unnumbered
    /// segment, then one segment per Beit-Yosef-derived paragraph, each processed for Darkhei
    /// Moshe's inline reference markers. Numbering runs flat across the whole siman rather than
    /// resetting per seif. English is attached to whichever paragraph the corresponding seif's
    /// Hebrew actually starts in; most simanim are a single seif, so this is exact, and a siman
    /// with several seifim whose paragraph boundaries don't line up with seif boundaries is a
    /// known, accepted imprecision.
    struct TurSegment {
        let index: Int
        let he: String
        let en: String
        let label: String?
    }

    static func buildTurSegments(
        _ he: [String],
        _ en: [String],
        fetchBeitYosefEntries: () async -> [CommentaryEntry]
    ) async -> [TurSegment] {
        let combined = combineTurSeifim(he)
        let rawParagraphs = await computeTurParagraphChunks(combined.combinedHe, fetchBeitYosefEntries: fetchBeitYosefEntries)

        var segments: [TurSegment] = []
        var segIndex = 0
        if let header = combined.header {
            segments.append(TurSegment(index: segIndex, he: header, en: "", label: nil))
            segIndex += 1
        }

        var offset = 0
        var paraNum = 0
        for rawPara in rawParagraphs {
            let start = offset
            let end = start + (rawPara as NSString).length
            offset = end
            paraNum += 1
            let heText = processTurMarkers(rawPara)
            let enParts = combined.seifStarts.enumerated()
                .filter { (_, seifStart) in seifStart >= start && seifStart < end }
                .map { (seifIdx, _) in seifIdx < en.count ? en[seifIdx] : "" }
                .filter { !$0.isEmpty }
            segments.append(TurSegment(index: segIndex, he: heText, en: enParts.joined(separator: " "), label: "\(paraNum)"))
            segIndex += 1
        }
        return segments
    }

    /// Plain (fully HTML/nikud-stripped), paragraph-split Hebrew text of a Tur siman, used only
    /// as the matching corpus for `assignTurParagraphLabels` — a fresh, independent fetch/split
    /// rather than reusing `buildTurSegments`' output, so no `<dm>` marker digits ever end up
    /// inline in the matching text. Uses the same Beit-Yosef-derived paragraph boundaries as the
    /// main text so Bach/Prisha+Drisha's paragraph numbers always agree with what's actually
    /// shown.
    static func fetchTurParagraphPlainList(
        _ turHebrew: [String],
        fetchBeitYosefEntries: () async -> [CommentaryEntry]
    ) async -> [String] {
        let combined = combineTurSeifim(turHebrew)
        let rawParagraphs = await computeTurParagraphChunks(combined.combinedHe, fetchBeitYosefEntries: fetchBeitYosefEntries)
        return rawParagraphs.map { processedHebrew($0) }
    }

    // MARK: - Darkhei Moshe anchored in Beit Yosef, not Tur

    /// Matches (and, via replacement, removes the *first* occurrence of) a Beit Yosef position
    /// tag for Darkhei Moshe — spelled "Darchei Moshe" (with a c) in Beit Yosef's data, vs Tur's
    /// own "Darkhei Moshe" (with a kh). Only the first match in a given entry is ever touched,
    /// matching the "one marker per entry" assumption below.
    private static let byDMMarkerPattern = "<i\\b[^>]*\\bdata-commentator=\"Darchei Moshe\"[^>]*>\\s*</i>"

    /// Determines which Beit Yosef entries should carry a Darkhei Moshe reference letter, and
    /// which number to show, for comments Darkhei Moshe anchors in Beit Yosef's own words rather
    /// than Tur's. Confirmed live by direct comparison against a printed edition (5 positions
    /// across 2 simanim, all correct): Beit Yosef's raw text carries the same kind of position
    /// tag Tur does, but its `data-order` attribute is **not** a reliable entry number the way
    /// Tur's is (Sefaria labels every single one `data-order="1"` regardless of which comment it
    /// anchors).
    ///
    /// Method: Tur's own `data-order` values ARE trusted as the true entry number for whichever
    /// comments they cover. The remaining ("missing") entry numbers are filled, in ascending
    /// order, by Beit Yosef's own Darchei-Moshe-tagged entries, taken in the order they appear
    /// in Beit Yosef's text. Any entry number left over once Beit Yosef's own tags run out gets
    /// no marker anywhere — an honest, accepted gap in Sefaria's source data, not a guess.
    ///
    /// Returns a map from Beit Yosef entry index (0-based, matching `beitYosefEntries`'s own
    /// order) to the Darkhei Moshe entry number that belongs there.
    static func computeBeitYosefDarkheiMosheMarks(
        _ turRawHe: [String],
        _ beitYosefEntries: [CommentaryEntry],
        fetchDarkheiMosheEntries: () async -> [CommentaryEntry]
    ) async -> [Int: Int] {
        let dmEntries = await fetchDarkheiMosheEntries()
        let total = dmEntries.filter { if case .text = $0 { return true }; return false }.count
        if total == 0 { return [:] }

        var turAnchored = Set<Int>()
        guard let dmRegex = try? NSRegularExpression(pattern: turDMMarkerPattern) else { return [:] }
        for seifText in turRawHe {
            let ns = seifText as NSString
            let matches = dmRegex.matches(in: seifText, range: NSRange(location: 0, length: ns.length))
            for match in matches {
                if let n = Int(ns.substring(with: match.range(at: 1))) { turAnchored.insert(n) }
            }
        }

        let missing = (1...total).filter { !turAnchored.contains($0) }
        if missing.isEmpty { return [:] }

        guard let byRegex = try? NSRegularExpression(pattern: byDMMarkerPattern) else { return [:] }
        var byTaggedIndices: [Int] = []
        for (i, entry) in beitYosefEntries.enumerated() {
            guard case let .text(_, _, he, _) = entry else { continue }
            let ns = he as NSString
            if byRegex.firstMatch(in: he, range: NSRange(location: 0, length: ns.length)) != nil {
                byTaggedIndices.append(i)
            }
        }

        var assignment: [Int: Int] = [:]
        for i in 0..<min(missing.count, byTaggedIndices.count) {
            assignment[byTaggedIndices[i]] = missing[i]
        }
        return assignment
    }

    /// Replaces the first Darchei-Moshe position tag in a Beit Yosef entry's raw Hebrew with a
    /// `<dm>N</dm>` placeholder — same tag `processedHebrewWithTurMarkers` already knows how to
    /// turn into a styled `(letter)` string, reused as-is so Beit Yosef's markers render
    /// identically to Tur's own.
    static func insertBeitYosefDarkheiMosheMark(_ he: String, _ n: Int) -> String {
        guard let regex = try? NSRegularExpression(pattern: byDMMarkerPattern) else { return he }
        let ns = he as NSString
        guard let match = regex.firstMatch(in: he, range: NSRange(location: 0, length: ns.length)) else { return he }
        return ns.replacingCharacters(in: match.range, with: "<dm>\(n)</dm>")
    }

    // MARK: - Rendering `<dm>N</dm>` as a parenthesized Hebrew numeral

    private static let turMarkerTagPattern = "<dm>(\\d+)</dm>"

    /// Like `SefariaTextClient.processedHebrew`, but preserves `processTurMarkers`'s `<dm>N</dm>`
    /// tags — converting them into a parenthesized Hebrew numeral (`saHebrewLetter`, standard
    /// gematria — א=1, י=10, כ=20, etc.), matching how printed Tur volumes mark Darkhei Moshe's
    /// reference points, rather than a plain digit — instead of stripping them along with the
    /// rest of Sefaria's HTML. Used only for Tur's Hebrew main text and Beit Yosef's Hebrew (when
    /// it carries a spliced-in mark). The marker text is pulled out before stripping (via a
    /// private-use-area-delimited placeholder that survives both the tag-stripping regex and the
    /// cantillation-mark filter) and spliced back in afterward.
    static func processedHebrewWithTurMarkers(_ html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: turMarkerTagPattern) else {
            return processedHebrew(html)
        }
        let sentinel = "\u{E000}"
        var markers: [String] = []
        let ns = html as NSString
        var withPlaceholders = ""
        var lastEnd = 0
        regex.enumerateMatches(in: html, range: NSRange(location: 0, length: ns.length)) { match, _, _ in
            guard let match else { return }
            withPlaceholders += ns.substring(with: NSRange(location: lastEnd, length: match.range.location - lastEnd))
            let n = Int(ns.substring(with: match.range(at: 1))) ?? 0
            let i = markers.count
            markers.append("(\(saHebrewLetter(n)))")
            withPlaceholders += "\(sentinel)DM\(i)\(sentinel)"
            lastEnd = match.range.location + match.range.length
        }
        withPlaceholders += ns.substring(from: lastEnd)

        let stripped = processedHebrew(withPlaceholders)
        guard let placeholderRegex = try? NSRegularExpression(pattern: "\(sentinel)DM(\\d+)\(sentinel)") else {
            return stripped
        }
        let strippedNs = stripped as NSString
        var final = ""
        var lastEnd2 = 0
        placeholderRegex.enumerateMatches(in: stripped, range: NSRange(location: 0, length: strippedNs.length)) { match, _, _ in
            guard let match else { return }
            final += strippedNs.substring(with: NSRange(location: lastEnd2, length: match.range.location - lastEnd2))
            let idx = Int(strippedNs.substring(with: match.range(at: 1))) ?? -1
            final += (idx >= 0 && idx < markers.count) ? markers[idx] : ""
            lastEnd2 = match.range.location + match.range.length
        }
        final += strippedNs.substring(from: lastEnd2)
        return final
    }
}
