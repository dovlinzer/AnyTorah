import Foundation

/// Fetches today's daily learning schedules from the Sefaria Calendars API
/// and maps them back to AnyTorah's catalog indices.
@MainActor
struct YomiService {

    // MARK: - Result types

    struct TanakhYomiResult {
        let bookIndex: Int        // index into TextCatalog.allTanakhBooks
        let chapter: Int
        let displayLabel: String  // e.g. "Deuteronomy 14"
    }

    struct ParshaResult {
        let bookIndex: Int
        let chapter: Int
        let verse: Int?           // opening verse of the parasha (e.g. 22)
        let name: String          // e.g. "Re'eh"
        let displayLabel: String  // e.g. "Re'eh (Devarim 14)"
    }

    struct DafYomiResult {
        let sederIndex: Int
        let tractateIndexInSeder: Int
        let daf: Int
        let displayLabel: String   // e.g. "Chullin 21"
    }

    struct MishnahYomiResult {
        let sederIndex: Int
        let tractateIndexInSeder: Int
        let chapter: Int
        let displayLabel: String   // e.g. "Kelim 4"
    }

    struct RambamYomiResult {
        let seferIndex: Int
        let workIndexInSefer: Int
        let chapter: Int
        let displayLabel: String   // e.g. "Tefillah ch. 4"
    }

    // MARK: - Sefaria calendar → AnyTorah sefariaName mappings
    // Only entries where the calendar ref differs from our catalog sefariaName.

    /// Talmud: calendar tractate name → AnyTorah TalmudTractate.sefariaName
    private static let talmudNameMap: [String: String] = [
        "Taanit": "Ta'anit",
        "Bava Metzia": "Bava Metzia",   // confirm spelling
    ]

    /// Mishnah: calendar tractate name (after stripping "Mishnah ") → our sefariaName.
    /// Only entries where the calendar ref differs from "Mishnah <name>".
    private static let mishnahNameMap: [String: String] = [:]
    // Add entries only when the calendar spells a tractate name differently than the catalog.
    // "Kelim" needs no entry — calendar and catalog both use "Mishnah Kelim".

    /// Rambam: calendar work name (after stripping "Mishneh Torah, ") → our sefariaName
    private static let rambamNameMap: [String: String] = [
        "The Order of Prayer":                              "Mishneh Torah, Prayer and the Priestly Blessing",
        "Oaths":                                            "Mishneh Torah, Oaths",
        "Sabbath":                                          "Mishneh Torah, Sabbath",
        "Foundations of the Torah":                         "Mishneh Torah, Foundations of the Torah",
        "Human Dispositions":                               "Mishneh Torah, Human Dispositions",
        "Torah Study":                                      "Mishneh Torah, Torah Study",
        "Foreign Worship and Customs of the Nations":       "Mishneh Torah, Foreign Worship and Customs of the Nations",
        "Repentance":                                       "Mishneh Torah, Repentance",
        "Reading the Shema":                                "Mishneh Torah, Reading the Shema",
        "Prayer and the Priestly Blessing":                 "Mishneh Torah, Prayer and the Priestly Blessing",
        "Tefillin, Mezuzah and the Torah Scroll":          "Mishneh Torah, Tefillin, Mezuzah and the Torah Scroll",
        "Fringes":                                          "Mishneh Torah, Fringes",
        "Blessings":                                        "Mishneh Torah, Blessings",
        "Circumcision":                                     "Mishneh Torah, Circumcision",
        "Eruvin":                                           "Mishneh Torah, Eruvin",
        "Leavened and Unleavened Bread":                   "Mishneh Torah, Leavened and Unleavened Bread",
        "Shofar, Sukkah and Lulav":                        "Mishneh Torah, Shofar, Sukkah and Lulav",
        "Fasts":                                            "Mishneh Torah, Fasts",
        "Scroll of Esther and Hanukkah":                   "Mishneh Torah, Scroll of Esther and Hanukkah",
    ]

    // MARK: - Public API

    static func fetchToday() async -> (daf: DafYomiResult?,
                                       mishnah: MishnahYomiResult?,
                                       rambam: RambamYomiResult?,
                                       tanakh: TanakhYomiResult?,
                                       parsha: ParshaResult?) {
        guard let url = URL(string: "https://www.sefaria.org/api/calendars"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = json["calendar_items"] as? [[String: Any]]
        else { return (nil, nil, nil, nil, nil) }

        var daf: DafYomiResult?
        var mishnah: MishnahYomiResult?
        var rambam: RambamYomiResult?
        var tanakh: TanakhYomiResult?
        var parsha: ParshaResult?

        for item in items {
            guard let titleEn = (item["title"] as? [String: Any])?["en"] as? String else { continue }
            let ref = item["ref"] as? String ?? ""

            switch titleEn {
            case "Daf Yomi":
                daf = parseDafYomi(ref: ref)
            case "Daily Mishnah":
                mishnah = parseMishnahYomi(ref: ref)
            case "Daily Rambam":
                rambam = parseRambamYomi(ref: ref)
            case "929":
                tanakh = parseTanakhYomi(ref: ref)
            case "Parashat Hashavua":
                let name = (item["displayValue"] as? [String: Any])?["en"] as? String ?? ""
                parsha = parseParshaYomi(ref: ref, name: name)
            default: break
            }
        }

        return (daf, mishnah, rambam, tanakh, parsha)
    }

    // MARK: - Parsers

    /// Parses "Chullin 21" → DafYomiResult
    private static func parseDafYomi(ref: String) -> DafYomiResult? {
        let parts = ref.components(separatedBy: " ")
        guard parts.count >= 2, let daf = Int(parts.last!) else { return nil }
        var tractate = parts.dropLast().joined(separator: " ")
        tractate = talmudNameMap[tractate] ?? tractate

        for (si, seder) in TextCatalog.talmudSedarim.enumerated() {
            for (ti, t) in seder.tractates.enumerated() where t.sefariaName == tractate {
                return DafYomiResult(sederIndex: si, tractateIndexInSeder: ti,
                                     daf: daf, displayLabel: "\(t.sefariaName) \(daf)")
            }
        }
        return nil
    }

    /// Parses "Mishnah Kelim 4:3-4" or "Mishnah Bava Kamma 3:1" → MishnahYomiResult
    private static func parseMishnahYomi(ref: String) -> MishnahYomiResult? {
        // Strip "Mishnah " prefix → "Kelim 4:3-4" or "Bava Kamma 3:1"
        let r = ref.hasPrefix("Mishnah ") ? String(ref.dropFirst("Mishnah ".count)) : ref
        let parts = r.components(separatedBy: " ")
        guard parts.count >= 2 else { return nil }
        // Last component is "chapter:verse-range" — extract just the chapter number
        let chapterStr = (parts.last ?? "").components(separatedBy: ":").first ?? ""
        guard let chapter = Int(chapterStr) else { return nil }
        // Everything except the last component is the tractate name (handles multi-word names)
        let tractate = parts.dropLast().joined(separator: " ")
        let sefariaName = mishnahNameMap[tractate] ?? "Mishnah \(tractate)"

        for (si, seder) in TextCatalog.mishnahSedarim.enumerated() {
            for (ti, t) in seder.tractates.enumerated() where t.sefariaName == sefariaName {
                return MishnahYomiResult(sederIndex: si, tractateIndexInSeder: ti,
                                         chapter: chapter,
                                         displayLabel: "\(t.name) ch. \(chapter)")
            }
        }
        return nil
    }

    /// Parses a Tanakh ref like "Deuteronomy 14:22-16:17" or "Joshua 3"
    /// into (bookIndex, chapter, openingVerse).
    private static func parseTanakhRef(_ ref: String) -> (bookIndex: Int, chapter: Int, verse: Int?)? {
        let parts = ref.components(separatedBy: " ")
        guard parts.count >= 2 else { return nil }
        // Last component: "14:22-16:17" or "14:22" or just "14"
        let chapterVerse = parts.last ?? ""
        let colonParts   = chapterVerse.components(separatedBy: ":")
        guard let chapter = Int(colonParts[0]) else { return nil }
        // Opening verse is after the first colon, before any dash or further range
        let verse = colonParts.count > 1
            ? Int(colonParts[1].components(separatedBy: "-").first ?? "")
            : nil
        let bookName = parts.dropLast().joined(separator: " ")
        guard let idx = TextCatalog.allTanakhBooks.firstIndex(where: { $0.sefariaName == bookName })
        else { return nil }
        return (idx, chapter, verse)
    }

    /// Parses "Joshua 3" or "Deuteronomy 14:22-16:17" → TanakhYomiResult
    private static func parseTanakhYomi(ref: String) -> TanakhYomiResult? {
        guard let (bookIdx, chapter, _) = parseTanakhRef(ref) else { return nil }
        let book = TextCatalog.allTanakhBooks[bookIdx]
        return TanakhYomiResult(bookIndex: bookIdx, chapter: chapter,
                                displayLabel: "\(book.name) \(chapter)")
    }

    /// Parses the weekly parasha ref + name → ParshaResult (includes opening verse)
    private static func parseParshaYomi(ref: String, name: String) -> ParshaResult? {
        guard let (bookIdx, chapter, verse) = parseTanakhRef(ref) else { return nil }
        let book = TextCatalog.allTanakhBooks[bookIdx]
        return ParshaResult(bookIndex: bookIdx, chapter: chapter, verse: verse,
                            name: name,
                            displayLabel: "\(name) (\(book.name) \(chapter))")
    }

    /// Parses "Mishneh Torah, The Order of Prayer 4" → RambamYomiResult
    private static func parseRambamYomi(ref: String) -> RambamYomiResult? {
        // Strip "Mishneh Torah, " prefix → "The Order of Prayer 4"
        let r = ref.hasPrefix("Mishneh Torah, ") ? String(ref.dropFirst("Mishneh Torah, ".count)) : ref
        let parts = r.components(separatedBy: " ")
        guard parts.count >= 2, let chapter = Int(parts.last!) else { return nil }
        let calendarWorkName = parts.dropLast().joined(separator: " ")

        // Try direct full sefariaName match first, then mapping table
        let candidates: [String] = [
            "Mishneh Torah, \(calendarWorkName)",          // direct
            rambamNameMap[calendarWorkName] ?? ""          // mapped
        ].filter { !$0.isEmpty }

        for sefariaName in candidates {
            for (si, sefer) in TextCatalog.rambamSefarim.enumerated() {
                for (wi, work) in sefer.works.enumerated() where work.sefariaName == sefariaName {
                    return RambamYomiResult(seferIndex: si, workIndexInSefer: wi,
                                            chapter: chapter,
                                            displayLabel: "\(work.name) ch. \(chapter)")
                }
            }
        }
        return nil
    }
}
