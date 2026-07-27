import XCTest
@testable import AnyTorah

/// Exercises `TurParagraphEngine` against real, live Sefaria data for the exact "golden simanim"
/// already validated on the reference web implementation (AnyTorahWeb/lib/sefariaClient.ts) and
/// on the already-verified Android Kotlin port — ground-truth counts/labels pulled directly from
/// that already-shipped app, not guessed. These hit the public Sefaria API directly (read-only
/// GETs, no auth) rather than baked fixtures, so a failure here could in principle mean Sefaria's
/// underlying text changed — but that's exactly the kind of drift worth catching, not a reason to
/// mock it away.
///
/// Deliberately routes every fetch through the *real* `SefariaTextClient` functions
/// (`fetchBoth`, `fetchTurCommentaryEntries`) rather than a parallel test-only
/// fetch/flatten implementation — an earlier version of this file reimplemented its own fetching,
/// which meant it never exercised `fetchBothAligned`'s outer-count-mismatch handling and missed a
/// real production bug (Tur OC 1's Beit Yosef collapsing to 1 entry) that only surfaced live in
/// the app. Exercising the same code path production uses is the whole point.
final class TurParagraphEngineTests: XCTestCase {

    private func fetchTurMainHe(_ section: String, _ siman: Int) async throws -> [String] {
        try await SefariaTextClient.shared.fetchBoth(ref: "Tur, \(section) \(siman)").hebrew
    }

    private func fetchTurCommentaryEntries(_ type: CommentaryType, _ section: String, _ siman: Int) async -> [CommentaryEntry] {
        await SefariaTextClient.shared.fetchTurCommentaryEntries(type: type, mainRef: "Tur, \(section) \(siman)")
    }

    private struct Golden {
        let siman: Int
        let beitYosefCount: Int
        let mainSegmentCount: Int
        let labels: [Int]
    }

    // Ground truth pulled directly from the live, already-shipped AnyTorahWeb app
    // (/api/commentary, /api/chapter) for Tur, Orach Chayim — not guessed. Identical to the
    // already-verified Android Kotlin test's golden data.
    private let golden: [Golden] = [
        Golden(siman: 1, beitYosefCount: 17, mainSegmentCount: 17,
               labels: [0, 2, 2, 3, 4, 5, 6, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        Golden(siman: 3, beitYosefCount: 20, mainSegmentCount: 18,
               labels: [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 15, 15, 16, 17]),
        Golden(siman: 25, beitYosefCount: 9, mainSegmentCount: 9,
               labels: [0, 1, 2, 3, 4, 5, 6, 7, 7]),
        Golden(siman: 43, beitYosefCount: 6, mainSegmentCount: 5,
               labels: [0, 1, 1, 2, 3, 4]),
        Golden(siman: 132, beitYosefCount: 2, mainSegmentCount: 3,
               labels: [1, 2]),
        Golden(siman: 133, beitYosefCount: 2, mainSegmentCount: 2,
               labels: [0, 1]),
    ]

    func testBeitYosefRawEntryCountsMatchSefariasOwnSegmentation() async throws {
        for g in golden {
            let entries = await fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", g.siman)
            XCTAssertEqual(entries.count, g.beitYosefCount, "OC \(g.siman) Beit Yosef entry count")
        }
    }

    func testTurMainTextParagraphCountsMatchTheReferenceImplementation() async throws {
        for g in golden {
            let mainHe = try await fetchTurMainHe("Orach Chayim", g.siman)
            let enPlaceholder = Array(repeating: "", count: mainHe.count)
            let segments = await TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
                await self.fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", g.siman)
            }
            XCTAssertEqual(segments.count, g.mainSegmentCount, "OC \(g.siman) main-text segment count")
        }
    }

    func testBeitYosefEntriesAreLabeledWithTheCorrectTurParagraph() async throws {
        for g in golden {
            let mainHe = try await fetchTurMainHe("Orach Chayim", g.siman)
            let byEntries = await fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", g.siman)
            let paragraphs = await TurParagraphEngine.fetchTurParagraphPlainList(mainHe) { byEntries }
            let labeled = TurParagraphEngine.assignTurParagraphLabels(byEntries, paragraphs)
            let labels: [Int] = labeled.compactMap { entry in
                if case let .text(_, label, _, _) = entry { return label }
                return nil
            }
            XCTAssertEqual(labels, g.labels, "OC \(g.siman) Beit Yosef labels")
        }
    }

    func testOC43AbbreviationBridgesCorrectlyInsteadOfSlidingToTheNextWord() async throws {
        // Real bug found live: Beit Yosef abbreviates "לבית הכסא" as "לבה\"כ"; the paragraph
        // break must land at "אסור" (the real start), not slide forward to "קבוע".
        let mainHe = try await fetchTurMainHe("Orach Chayim", 43)
        let enPlaceholder = Array(repeating: "", count: mainHe.count)
        let segments = await TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            await self.fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", 43)
        }
        let firstParagraphText = TurParagraphEngine.processedHebrew(segments.first?.he ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        XCTAssertTrue(firstParagraphText.hasPrefix("אסור"), "OC 43 first paragraph should start with אסור, was: \(firstParagraphText)")
    }

    func testOC132DoesNotFragmentAtTheCitationColon() async throws {
        let mainHe = try await fetchTurMainHe("Orach Chayim", 132)
        let enPlaceholder = Array(repeating: "", count: mainHe.count)
        let segments = await TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            await self.fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", 132)
        }
        XCTAssertEqual(segments.count, 3)
    }

    func testOC133SevenVersePsalmListStaysOneParagraph() async throws {
        let mainHe = try await fetchTurMainHe("Orach Chayim", 133)
        let enPlaceholder = Array(repeating: "", count: mainHe.count)
        let segments = await TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            await self.fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", 133)
        }
        XCTAssertEqual(segments.count, 2)
    }

    // MARK: - Darkhei Moshe marker system

    private struct DmGolden {
        let siman: Int
        let beitYosefAssignment: [Int: Int]
    }

    // Ground truth: Beit-Yosef-entry-index -> Darkhei-Moshe-number, confirmed by the user against
    // a printed edition on the reference implementation. Identical to the Android test's data.
    private let dmGolden: [DmGolden] = [
        DmGolden(siman: 1, beitYosefAssignment: [15: 2]),
        DmGolden(siman: 2, beitYosefAssignment: [2: 1]),
        DmGolden(siman: 3, beitYosefAssignment: [3: 1, 6: 2, 12: 3, 19: 4]),
    ]

    func testDarkheiMosheMarksAnchoredInBeitYosefFillExactlyTheGapsTursOwnTagsMiss() async throws {
        for g in dmGolden {
            let turRawHe = try await fetchTurMainHe("Orach Chayim", g.siman)
            let byEntries = await fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", g.siman)
            let assignment = await TurParagraphEngine.computeBeitYosefDarkheiMosheMarks(turRawHe, byEntries) {
                await self.fetchTurCommentaryEntries(.darkheiMoshe, "Orach Chayim", g.siman)
            }
            XCTAssertEqual(assignment, g.beitYosefAssignment, "OC \(g.siman) Beit-Yosef-anchored Darkhei Moshe assignment")
        }
    }

    func testInsertBeitYosefDarkheiMosheMarkAndRenderingProduceTheCorrectParenthesizedNumeral() {
        let he = "<i data-commentator=\"Darchei Moshe\"></i>שלום עולם"
        let withMark = TurParagraphEngine.insertBeitYosefDarkheiMosheMark(he, 2)
        let rendered = TurParagraphEngine.processedHebrewWithTurMarkers(withMark)
        XCTAssertTrue(rendered.contains("(ב)"), "expected (ב) in rendered output, got: \(rendered)")
    }

    func testTurOC1sOwnDataOrderTagsCoverMarks1And3LeavingMark2ToBeitYosef() async throws {
        let mainHe = try await fetchTurMainHe("Orach Chayim", 1)
        let enPlaceholder = Array(repeating: "", count: mainHe.count)
        let segments = await TurParagraphEngine.buildTurSegments(mainHe, enPlaceholder) {
            await self.fetchTurCommentaryEntries(.beitYosef, "Orach Chayim", 1)
        }
        let segWithMark1 = segments.first { $0.label == "12" }
        let segWithMark3 = segments.first { $0.label == "17" }
        XCTAssertTrue(segWithMark1?.he.contains("<dm>1</dm>") == true, "expected <dm>1</dm> in paragraph labeled 12")
        XCTAssertTrue(segWithMark3?.he.contains("<dm>3</dm>") == true, "expected <dm>3</dm> in paragraph labeled 17")
    }
}
