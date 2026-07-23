import SwiftUI

/// Scrollable text body — numbered segments, Hebrew/English/Both, amud markers.
struct TextContentView: View {
    let segments: [TextSegment]
    let displayMode: TextDisplayMode
    let category: TextCategory
    let daf: Int          // used for amud-B marker label (Talmud only)
    let fg: Color
    /// When true, renders main text one font step larger (used when side panels are open).
    var fontBoost: Bool = false
    /// When true, ScrollView scrolling is disabled and segments render via UITextView for drag-handle selection.
    var textSelectionMode: Bool = false
    /// When non-nil, scroll so this 1-based verse number is at the top after segments load.
    @Binding var scrollToVerse: Int?
    /// When true, scroll to the amud-B marker in the text.
    @Binding var scrollToAmudB: Bool

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                // VStack (not Lazy) so every row is in the layout tree immediately —
                // required for scrollTo to reliably land on off-screen verses (e.g.
                // parsha opening verse). Chapter/daf counts are small enough (≤180)
                // that the perf difference is imperceptible.
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(segments) { seg in
                        if seg.isAmudBMarker {
                            AmudBMarkerRow(daf: daf, displayMode: displayMode, fg: fg)
                                .id(seg.id)   // explicit id required for scrollTo
                        } else {
                            SegmentRow(seg: seg, displayMode: displayMode,
                                       labelStyle: category.segmentLabelStyle, fg: fg,
                                       fontBoost: fontBoost,
                                       textSelectionMode: textSelectionMode)
                                .id(seg.id)   // explicit id required for scrollTo
                        }
                    }
                    Color.clear.frame(height: 60) // bottom breathing room
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
            }
            // .task(id:) is cancelled and restarted whenever the key changes, so these
            // fire when the binding flips to a new non-nil / true value. Because load()
            // sets the flag *after* assigning segments (same sync block), segments are
            // already populated when the task body runs — no race with layout.
            .scrollEnabled(!textSelectionMode)
            .task(id: scrollToAmudB) {
                guard scrollToAmudB, !segments.isEmpty else { return }
                guard let marker = segments.first(where: { $0.isAmudBMarker }) else {
                    scrollToAmudB = false; return
                }
                try? await Task.sleep(for: .milliseconds(150))
                withAnimation(.easeInOut(duration: 0.4)) {
                    proxy.scrollTo(marker.id, anchor: .top)
                }
                scrollToAmudB = false
            }
            .task(id: scrollToVerse) {
                guard let verse = scrollToVerse, !segments.isEmpty else { return }
                let contentSegments = segments.filter { !$0.isAmudBMarker }
                let idx = max(0, min(verse - 1, contentSegments.count - 1))
                let target = contentSegments[idx]
                try? await Task.sleep(for: .milliseconds(150))
                withAnimation(.easeInOut(duration: 0.4)) {
                    proxy.scrollTo(target.id, anchor: .top)
                }
                scrollToVerse = nil
            }
        }
    }
}

// MARK: - Amud B Marker

private struct AmudBMarkerRow: View {
    let daf: Int
    let displayMode: TextDisplayMode
    let fg: Color

    @AppStorage("anyTorahFontSize") private var fontSizeLevel: Double = 0

    private var scaledCaptionSize: CGFloat {
        max(10, UIFont.preferredFont(forTextStyle: .caption1).pointSize + CGFloat(fontSizeLevel) * 2)
    }

    private var label: String {
        if displayMode == .source {
            return "[\(toHebrewNumeral(daf)) ע״ב]"
        }
        return "[\(daf)b]"
    }

    var body: some View {
        HStack {
            Rectangle()
                .fill(fg.opacity(0.25))
                .frame(height: 1)
            Text(label)
                .font(.system(size: scaledCaptionSize, weight: .medium))
                .foregroundStyle(fg.opacity(0.55))
                .fixedSize()
            Rectangle()
                .fill(fg.opacity(0.25))
                .frame(height: 1)
        }
        .padding(.vertical, 12)
    }
}

// MARK: - Segment Row

private struct SegmentRow: View {
    let seg: TextSegment
    let displayMode: TextDisplayMode
    let labelStyle: SegmentLabelStyle
    let fg: Color
    var fontBoost: Bool = false
    var textSelectionMode: Bool = false

    @AppStorage("useWhiteBackground") private var useWhiteBackground: Bool = false
    @AppStorage("anyTorahFontSize") private var fontSizeLevel: Double = 0
    @AppStorage("mainTextPanelBoost") private var mainTextPanelBoost: Bool = false

    private var fontBoostPoints: CGFloat { fontBoost ? 2 : 0 }

    private var scaledBodySize: CGFloat {
        let offset: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 6 : -4
        return max(10, UIFont.preferredFont(forTextStyle: .body).pointSize + CGFloat(fontSizeLevel) * 2 + offset)
    }

    /// Amber (dark bg) or dark indigo (white bg) for editorial/bold words
    private var editorialColor: Color {
        useWhiteBackground
            ? Color(red: 0.10, green: 0.20, blue: 0.60)
            : Color(red: 0.94, green: 0.80, blue: 0.45)
    }

    // Label on right when showing Hebrew (source or both), left when translation only
    private var labelOnRight: Bool {
        displayMode == .source || displayMode == .both
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 8) {
                if !labelOnRight {
                    labelView
                }

                VStack(alignment: .leading, spacing: 6) {
                    switch displayMode {
                    case .source:
                        hebrewView
                    case .translation:
                        englishView
                    case .both:
                        hebrewView
                        Divider()
                            .background(fg.opacity(0.2))
                            .padding(.vertical, 2)
                        englishView
                    }

                    if seg.raavadHe != nil || seg.raavadEn != nil {
                        Divider()
                            .background(fg.opacity(0.25))
                            .padding(.top, 2)
                        raavadBlock
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if labelOnRight {
                    labelView
                }
            }
        }
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) {
            Divider()
                .background(fg.opacity(0.15))
        }
    }

    @ViewBuilder
    private var raavadBlock: some View {
        if displayMode == .source || displayMode == .both, let he = seg.raavadHe {
            (Text("השגות הראב״ד: ").foregroundStyle(editorialColor).fontWeight(.semibold) +
             Text(he).foregroundStyle(fg.opacity(0.95)))
                .font(.system(size: scaledBodySize))
                .lineSpacing(7)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, 4)
        }
        if displayMode == .translation || displayMode == .both, let en = seg.raavadEn {
            (Text("Ra'avad: ").foregroundStyle(editorialColor).fontWeight(.semibold) +
             Text(en).foregroundStyle(fg.opacity(0.90)))
                .font(.system(size: scaledBodySize))
                .lineSpacing(5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)
        }
    }

    @ViewBuilder
    private var labelView: some View {
        if let label = seg.label, labelStyle != .none {
            Text(label)
                .font(.caption2.monospacedDigit())
                .foregroundStyle(fg.opacity(0.45))
                .frame(width: 24, alignment: labelOnRight ? .leading : .trailing)
                .padding(.top, 3)
        } else if labelStyle != .none {
            Color.clear.frame(width: 24)
        }
    }

    @ViewBuilder
    private var hebrewView: some View {
        if textSelectionMode {
            SelectableTextView(attributed: .hebrewBody(
                html: seg.hebrewHTML, fg: UIColor(fg.opacity(0.95)),
                extraPoints: fontBoostPoints))
            .frame(maxWidth: .infinity, alignment: .trailing)
        } else {
            // SwiftUI Text correctly renders Frank Ruhl Libre for Hebrew.
            // UITextView substitutes the system Hebrew font for RTL character runs
            // regardless of the explicit NSAttributedString font attribute.
            styledHebrew(seg.hebrewHTML, fg: fg.opacity(0.95))
                .textSelection(.enabled)   // must be before .frame() — layout wrappers break selection
                .lineSpacing(7)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    /// Builds a `Text` by parsing `<rf>…</rf>` small-marker spans.
    /// Tanakh uses Noto Serif Hebrew (has cantillation marks); all others use Frank Ruhl Libre.
    /// Normal spans use the scaled font size; `<rf>` spans (SA inline markers) get a
    /// smaller system font. RLM is prepended so the bidi algorithm treats the run as RTL.
    private func styledHebrew(_ html: String, fg: Color) -> Text {
        // Tanakh uses Noto Serif Hebrew — it covers cantillation marks (U+0591–U+05AF)
        // so letters with trop don't fall back to the system font.
        // Frank Ruhl is kept for Talmud/Mishnah/SA/Rambam.
        // Frank Ruhl runs visually smaller than the system font; apply the +2 pt compensation
        // only when using it AND the "Larger main text" toggle is on.
        let isTanakh = (labelStyle == .verse)
        // iPhone: +1 compensation (Frank Ruhl appears proportionally larger on smaller screens)
        // iPad:   +2 compensation
        let frankRuhlCompensation: CGFloat = UIDevice.current.userInterfaceIdiom == .phone ? 1 : 2
        let frankRuhlBase: CGFloat = (!isTanakh && mainTextPanelBoost) ? frankRuhlCompensation : 0
        let fontSize = scaledBodySize + frankRuhlBase + fontBoostPoints
        let fontName = isTanakh ? "NotoSerifHebrew-Regular" : "FrankRuhlLibre-Regular"
        let heFont   = Font.custom(fontName, size: fontSize)
        let smFont   = Font.system(size: max(10, fontSize - 5))
        let rfPattern = #"<rf>(.*?)</rf>"#
        let htmlWithRlm = "\u{200F}" + html
        guard let regex = try? NSRegularExpression(pattern: rfPattern) else {
            return Text(SefariaTextClient.processedHebrew(htmlWithRlm)).font(heFont).foregroundColor(fg)
        }
        let ns = htmlWithRlm as NSString
        let matches = regex.matches(in: htmlWithRlm,
                                    range: NSRange(location: 0, length: ns.length))
        guard !matches.isEmpty else {
            return Text(SefariaTextClient.processedHebrew(htmlWithRlm)).font(heFont).foregroundColor(fg)
        }
        var result = Text("")
        var lastEnd = 0
        for match in matches {
            if match.range.location > lastEnd {
                let raw = ns.substring(with: NSRange(location: lastEnd,
                                                     length: match.range.location - lastEnd))
                let plain = SefariaTextClient.processedHebrew(raw)
                if !plain.isEmpty {
                    result = result + Text(plain).font(heFont).foregroundColor(fg)
                }
            }
            if let r = Range(match.range(at: 1), in: htmlWithRlm) {
                let markerText = SefariaTextClient.stripHTML(String(htmlWithRlm[r]))
                if !markerText.isEmpty {
                    result = result + Text(markerText).font(smFont).foregroundColor(fg)
                }
            }
            lastEnd = match.range.location + match.range.length
        }
        if lastEnd < ns.length {
            let raw = ns.substring(with: NSRange(location: lastEnd,
                                                 length: ns.length - lastEnd))
            let plain = SefariaTextClient.processedHebrew(raw)
            if !plain.isEmpty {
                result = result + Text(plain).font(heFont).foregroundColor(fg)
            }
        }
        return result
    }

    @ViewBuilder
    private var englishView: some View {
        // For Tanakh main text, strip bold content (lemas / footnote anchors).
        // For Talmud and Mishnah, keep amber editorial color for Aramaic/Hebrew term highlights.
        // For Rambam / SA, keep bold content but render it in fg color (no amber).
        let html = (labelStyle == .verse)
            ? SefariaTextClient.stripBoldContent(seg.englishHTML)
            : seg.englishHTML
        let boldColor: Color = (labelStyle == .none || labelStyle == .mishnah || labelStyle == .halakha)
            ? editorialColor : fg
        if textSelectionMode {
            SelectableTextView(attributed: .englishBody(
                html: html, fg: UIColor(fg.opacity(0.95)),
                editorialColor: UIColor(boldColor),
                extraPoints: fontBoostPoints))
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            styledEnglish(html, fg: fg, editorialColor: boldColor)
                .textSelection(.enabled)   // must be before .frame()
                .font(.system(size: max(10, scaledBodySize + fontBoostPoints - 1)))
                .lineSpacing(5)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Renders bold tags as editorial-colored text (Aramaic/Hebrew terms in Steinsaltz etc).
    private func styledEnglish(_ html: String, fg: Color, editorialColor: Color) -> Text {
        let cleaned = html
            .replacingOccurrences(of: "<br/>", with: "\n")
            .replacingOccurrences(of: "<br />", with: "\n")
            .replacingOccurrences(of: "<br>", with: "\n")

        let boldPattern = #"<(?:b|strong)>(.*?)</(?:b|strong)>"#
        guard let regex = try? NSRegularExpression(pattern: boldPattern,
                                                    options: [.dotMatchesLineSeparators]) else {
            return Text(SefariaTextClient.stripHTML(html)).foregroundColor(fg)
        }

        let ns = cleaned as NSString
        let matches = regex.matches(in: cleaned, range: NSRange(location: 0, length: ns.length))
        var result = Text("")
        var lastEnd = 0

        for match in matches {
            if match.range.location > lastEnd {
                let raw = ns.substring(with: NSRange(location: lastEnd,
                                                      length: match.range.location - lastEnd))
                let plain = SefariaTextClient.stripHTML(raw)
                if !plain.isEmpty { result = result + Text(plain).foregroundColor(fg) }
            }
            if let r = Range(match.range(at: 1), in: cleaned) {
                let bold = SefariaTextClient.stripHTML(String(cleaned[r]))
                if !bold.isEmpty {
                    result = result + Text(bold).foregroundColor(editorialColor)
                }
            }
            lastEnd = match.range.location + match.range.length
        }
        if lastEnd < ns.length {
            let raw = ns.substring(with: NSRange(location: lastEnd, length: ns.length - lastEnd))
            let plain = SefariaTextClient.stripHTML(raw)
            if !plain.isEmpty { result = result + Text(plain).foregroundColor(fg) }
        }

        // If no matches at all (no bold tags), strip and return plain
        if matches.isEmpty {
            return Text(SefariaTextClient.stripHTML(cleaned)).foregroundColor(fg)
        }

        return result
    }
}
