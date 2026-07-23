import SwiftUI
import UIKit

/// Bottom panel (or side panel) showing commentary with tab selector.
/// `panel` holds the per-panel mutable state; `vm` provides context (category, ref, pool, etc.).
struct CommentaryPanelView: View {
    @Bindable var vm: TextReaderViewModel
    @Bindable var panel: CommentaryPanelViewModel
    let fg: Color
    let cardFill: Color

    @AppStorage("commentaryLayout") private var commentaryLayoutRaw: String = CommentaryLayout.bottomPanel.rawValue
    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false
    @AppStorage("useRashiFont") private var useRashiFont: Bool = false

    /// Index of the slot whose picker sheet is currently open (nil = closed).
    @State private var replacingSlotIndex: Int? = nil
    /// When true, ScrollView scrolling is disabled so UITextView can handle drag-handle selection.
    @State private var textSelectionMode: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            // Commentary tabs
            if vm.effectiveCommentaries(for: panel).count > 1 {
                commentaryTabs
            }

            // Content
            if panel.isLoadingCommentary {
                loadingView
            } else if let error = panel.commentaryError {
                errorView(error)
            } else if panel.commentaryEntries.isEmpty {
                emptyView
            } else {
                if textSelectionMode {
                    HStack {
                        Text("Text selection — scroll disabled")
                            .font(.caption2)
                            .foregroundStyle(fg.opacity(0.7))
                        Spacer()
                        Button("Done") { textSelectionMode = false }
                            .font(.caption2.bold())
                            .foregroundStyle(fg)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(fg.opacity(0.08))
                }
                commentaryScrollView
            }
        }
        .background(cardFill)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.15), radius: 8, y: -2)
        .sheet(isPresented: Binding(
            get: { replacingSlotIndex != nil },
            set: { if !$0 { replacingSlotIndex = nil } }
        )) {
            if let idx = replacingSlotIndex {
                CommentarySlotPicker(vm: vm, panel: panel, slotIndex: idx, fg: fg) {
                    replacingSlotIndex = nil
                }
            }
        }
    }

    // MARK: - Commentary Tabs

    private var commentaryTabs: some View {
        HStack(spacing: 8) {
            HStack(spacing: 0) {
                ForEach(vm.effectiveCommentaries(for: panel).indices, id: \.self) { idx in
                    let commentary = vm.effectiveCommentaries(for: panel)[idx]
                    let isSelected = panel.selectedCommentary == commentary
                    Button {
                        if isSelected {
                            // Tap the active tab → open slot-replacement picker (if pool exists).
                            if vm.hasExpandedCommentaryPool {
                                replacingSlotIndex = idx
                            }
                        } else {
                            panel.selectedCommentary = commentary
                            Task { await vm.loadCommentary(into: panel) }
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Text(saHebrewMode ? commentary.hebrewDisplayName : commentary.displayName)
                                .font(.footnote.bold())
                                .foregroundStyle(fg)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                            // Chevron hints that the active tab is tappable to swap.
                            if isSelected && vm.hasExpandedCommentaryPool {
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundStyle(fg.opacity(0.5))
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(isSelected ? fg.opacity(0.22) : Color.clear)
                        )
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(fg.opacity(0.18), lineWidth: 0.5)
            )
            .environment(\.layoutDirection, saHebrewMode ? .rightToLeft : .leftToRight)

            Button {
                textSelectionMode.toggle()
            } label: {
                Image(systemName: textSelectionMode ? "cursor.rays" : "text.cursor")
                    .font(.system(size: 15))
                    .foregroundStyle(textSelectionMode ? fg : fg.opacity(0.45))
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    // MARK: - Commentary Content

    private var commentaryScrollView: some View {
        // Bracket style and font size for SA sequential-marker commentators.
        // MB always uses Sefaria's own bold labels (no generated prefix, always full size).
        //
        // Single-panel mode (bottom / single side panel):
        //   slot 0 → ()  normal   slot 1 → {}  normal   slot 2 → ()  small
        //   When MB is present: lower non-MB rank → {}  normal; higher → ()  small.
        //
        // bothPanels mode — 6-slot table (mirrors SefariaTextClient.processCommentaryMarkers):
        //   Main panel   slots 0-2:  ()  {}  []  — all normal size
        //   Right panel  slots 3-5:  ()  {}  []  — all small size
        //   Panel offset: main = 0, right = 3.
        //   When MB is present: slot 0 (or 3) is "reserved" for MB's bracket; non-MB
        //   slots start at slot 1 (or 4) — i.e. {} then [].
        let panelAvailable = vm.availableCommentaries(for: panel)
        let mbSlotInPanel = panelAvailable.firstIndex(of: .mishnahBerurah)
        let isBothPanels = commentaryLayoutRaw == CommentaryLayout.bothPanels.rawValue
        let panelIsRight  = isBothPanels && (panel === vm.rightPanel)
        let panelOffset   = panelIsRight ? 3 : 0
        // Global 6-slot style table — same layout as processCommentaryMarkers in bothPanels mode.
        let allSlotStyles: [(open: String, close: String, isSmall: Bool)] = [
            ("(", ")", false), ("{", "}", false), ("[", "]", false),
            ("(", ")", true),  ("{", "}", true),  ("[", "]", true),
        ]

        let (saStyle, saLabelIsSmall): ((open: String, close: String)?, Bool) = {
            guard vm.category == .shulchanArukh else { return (nil, false) }
            // MB keeps Sefaria's own labels — never generate a prefix for it.
            if panel.selectedCommentary == .mishnahBerurah { return (nil, false) }
            // Other SA commentaries qualify only when they carry inline markers.
            guard panel.selectedCommentary.hasInlineSAMarkers(forSection: vm.saSection),
                  let si = panelAvailable.firstIndex(of: panel.selectedCommentary)
            else { return (nil, false) }

            if isBothPanels {
                // bothPanels: look up the global slot directly from the 6-entry table.
                if let mbSlot = mbSlotInPanel {
                    // Skip slot 0/3 (MB's bracket) — non-MB slots start at 1/4 ({}) then 2/5 ([]).
                    let nonMBSlots = (0..<panelAvailable.count).filter { $0 != mbSlot }.sorted()
                    let rank = nonMBSlots.firstIndex(of: si) ?? 0
                    let globalSi = min(panelOffset + 1 + rank, allSlotStyles.count - 1)
                    let s = allSlotStyles[globalSi]
                    return ((s.open, s.close), s.isSmall)
                }
                let globalSi = min(si + panelOffset, allSlotStyles.count - 1)
                let s = allSlotStyles[globalSi]
                return ((s.open, s.close), s.isSmall)
            }

            // Single-panel legacy scheme.
            if let mbSlot = mbSlotInPanel {
                let nonMBSlots = (0..<panelAvailable.count).filter { $0 != mbSlot }.sorted()
                let rank = nonMBSlots.firstIndex(of: si) ?? 0
                return rank == 0 ? (("{", "}"), false) : (("(", ")"), true)
            }
            switch si {
            case 0: return (("(", ")"), false)
            case 1: return (("{", "}"), false)
            default: return (("(", ")"), true)
            }
        }()

        return ScrollViewReader { proxy in
            ScrollView {

                // VStack (not Lazy) — LazyVStack fails to render in a height-constrained parent
                // because it can't determine its viewport size. Performance is acceptable since
                // commentary sets are small (typically <100 entries).
                VStack(alignment: .leading, spacing: 10) {
                    Color.clear.frame(height: 0).id("commentary_top")
                    let mode = vm.displayMode
                    ForEach(Array(panel.commentaryEntries.enumerated()), id: \.offset) { offset, entry in
                        switch entry {
                        case .text(let idx, let lbl, let he, let en):
                            let labelPrefix: String? = saStyle.map { s in
                                "\(s.open)\(SefariaTextClient.saHebrewLetter(idx + 1))\(s.close) "
                            }
                            CommentarySegmentView(
                                index: idx, displayIndex: lbl.map { $0 + 1 },
                                hebrewHTML: he, englishHTML: en,
                                displayMode: mode, fg: fg, saLabelPrefix: labelPrefix,
                                saLabelIsSmall: saLabelIsSmall,
                                useRashiFont: useRashiFont && (panel.selectedCommentary == .rashiTanakh
                                           || panel.selectedCommentary == .rashiTalmud),
                                textSelectionMode: textSelectionMode)
                        case .recensionHeader(let label):
                            RecensionHeaderView(label: label, fg: fg)
                                .id("header_\(offset)")
                        case .bookDivider(let label):
                            BookDividerView(label: label)
                        }
                    }
                    Color.clear.frame(height: 20)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .textSelection(.enabled)
            }
            .scrollEnabled(!textSelectionMode)
            .onChange(of: vm.commentaryScrollToAmudB) { _, newValue in
                guard newValue else { return }
                scrollToAmudBHeader(in: panel.commentaryEntries, proxy: proxy)
                vm.commentaryScrollToAmudB = false
            }
            .onChange(of: vm.commentaryScrollToAmudA) { _, newValue in
                guard newValue else { return }
                withAnimation { proxy.scrollTo("commentary_top", anchor: .top) }
                vm.commentaryScrollToAmudA = false
            }
            .onChange(of: panel.selectedCommentary) { _, _ in
                textSelectionMode = false
            }
            // When a new commentary loads while already on amud B, scroll to עמוד ב׳.
            // .task(id:) fires both on first appearance of the view (when loading completes
            // and commentaryScrollView re-enters the hierarchy) AND whenever loadVersion
            // changes while the view is already showing (instant cache-hit loads).
            // onChange(of: panel.loadVersion) was NOT sufficient because commentaryScrollView
            // is hidden during loading, so the onChange handler was never registered in time.
            .task(id: panel.loadVersion) {
                guard vm.talmudAmud == 1, !panel.commentaryEntries.isEmpty else { return }
                try? await Task.sleep(for: .milliseconds(200))
                scrollToAmudBHeader(in: panel.commentaryEntries, proxy: proxy)
            }
        }
        // ScrollViewReader doesn't propagate flexible sizing to SwiftUI's VStack layout
        // algorithm — without this, the Spacer(minLength:0) below claims all remaining
        // space and the scroll view collapses to zero height.
        .frame(maxHeight: .infinity)
    }

    @discardableResult
    private func scrollToAmudBHeader(in entries: [CommentaryEntry], proxy: ScrollViewProxy) -> Bool {
        guard let idx = entries.firstIndex(where: {
            if case .recensionHeader(let l) = $0 { return l == "עמוד ב׳" }
            return false
        }) else { return false }
        withAnimation { proxy.scrollTo("header_\(idx)", anchor: .top) }
        return true
    }

    private var loadingView: some View {
        VStack(spacing: 10) {
            ProgressView().tint(fg)
            Text("Loading \(saHebrewMode ? panel.selectedCommentary.hebrewDisplayName : panel.selectedCommentary.displayName)…")
                .font(.caption)
                .foregroundStyle(fg.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(40)
    }

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.yellow)
            Text(msg)
                .font(.caption)
                .foregroundStyle(fg.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
    }

    private var emptyView: some View {
        Text("No commentary available for this passage")
            .font(.caption)
            .foregroundStyle(fg.opacity(0.5))
            .multilineTextAlignment(.center)
            .padding(24)
            .frame(maxWidth: .infinity)
    }
}

// MARK: - Recension header

/// Horizontal rule with a centred Hebrew recension label — used to separate
/// consecutive Tosafot Rid recensions in the commentary scroll view.
private struct RecensionHeaderView: View {
    let label: String
    let fg: Color

    var body: some View {
        HStack(spacing: 8) {
            Rectangle().fill(fg.opacity(0.25)).frame(height: 1)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(fg.opacity(0.55))
                .lineLimit(1)
                .fixedSize()
            Rectangle().fill(fg.opacity(0.25)).frame(height: 1)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Book divider (two distinct works combined under one commentator)

/// Prominent horizontal rule separating two different books within a single commentator.
/// Yellow on dark background, blue on light background — intentionally eye-catching.
private struct BookDividerView: View {
    let label: String

    @AppStorage("useWhiteBackground") private var useWhiteBackground = false
    @AppStorage("sidePanelContrast") private var sidePanelContrast = false

    private var accentColor: Color {
        (useWhiteBackground || sidePanelContrast)
            ? Color(red: 0.10, green: 0.20, blue: 0.60)   // blue for light bg or light panel
            : Color(red: 0.94, green: 0.80, blue: 0.45)   // amber/yellow for dark bg
    }

    var body: some View {
        HStack(spacing: 8) {
            Rectangle().fill(accentColor.opacity(0.7)).frame(height: 1.5)
            Text(label)
                .font(.caption.weight(.bold))
                .foregroundStyle(accentColor)
                .lineLimit(1)
                .fixedSize()
            Rectangle().fill(accentColor.opacity(0.7)).frame(height: 1.5)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Slot replacement picker

private struct CommentarySlotPicker: View {
    @Bindable var vm: TextReaderViewModel
    @Bindable var panel: CommentaryPanelViewModel
    let slotIndex: Int
    let fg: Color
    let onDismiss: () -> Void

    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false

    private var currentInSlot: CommentaryType {
        vm.availableCommentaries(for: panel)[slotIndex]
    }

    /// Commentators in OTHER slots — they can't be selected for this slot (no duplicates).
    private var otherSlots: Set<CommentaryType> {
        Set(vm.availableCommentaries(for: panel).enumerated()
            .filter { $0.offset != slotIndex }
            .map { $0.element })
    }

    /// The selectable options grouped by section, with other-slot entries and empty groups removed.
    /// Labels are computed in the same pass so indices always align.
    private var optionGroupsAndLabels: ([[CommentaryType]], [String?]) {
        let sourceLabels = vm.commentaryPoolGroupLabels
        var groups: [[CommentaryType]] = []
        var labels: [String?] = []
        for (idx, group) in vm.commentaryPoolGrouped.enumerated() {
            let filtered = group.filter { !otherSlots.contains($0) }
            if !filtered.isEmpty {
                groups.append(filtered)
                labels.append(idx < sourceLabels.count ? sourceLabels[idx] : nil)
            }
        }
        return (groups, labels)
    }

    private var optionGroups: [[CommentaryType]] { optionGroupsAndLabels.0 }
    private var groupLabels: [String?] { optionGroupsAndLabels.1 }

    var body: some View {
        NavigationStack {
            List {
                ForEach(optionGroups.indices, id: \.self) { groupIdx in
                    Section {
                        ForEach(optionGroups[groupIdx]) { option in
                            Button {
                                Task { await vm.replaceSlot(at: slotIndex, with: option, in: panel) }
                                onDismiss()
                            } label: {
                                HStack {
                                    Text(saHebrewMode ? option.hebrewDisplayName : option.displayName)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if option == currentInSlot {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.blue)
                                    }
                                }
                            }
                        }
                    } header: {
                        let label = groupIdx < groupLabels.count ? groupLabels[groupIdx] : nil
                        if let label { Text(label) }
                    }
                }
            }
            .navigationTitle("Select Commentator")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Single commentary segment

private struct CommentarySegmentView: View {
    let index: Int
    /// Override for the displayed number. When set, shown instead of `index + 1`.
    var displayIndex: Int? = nil
    let hebrewHTML: String
    let englishHTML: String
    let displayMode: TextDisplayMode
    let fg: Color
    /// Optional Hebrew-letter prefix for SA sequential-marker commentators, e.g. "(א) ".
    var saLabelPrefix: String? = nil
    /// When true the label prefix is rendered at a smaller font size (Taz/OC, PT/YD+EH+CM).
    var saLabelIsSmall: Bool = false
    /// When true, renders Hebrew with Noto Rashi Hebrew (SwiftUI Text) instead of UITextView.
    /// UITextView silently substitutes the system Hebrew font for any custom font, so SwiftUI
    /// Text + Font.custom is the only reliable path for custom Hebrew scripts.
    var useRashiFont: Bool = false
    /// When true, renders text via UITextView (SelectableTextView) for drag-handle selection.
    /// The parent ScrollView must have isScrollEnabled = false to avoid gesture conflicts.
    var textSelectionMode: Bool = false

    @AppStorage("anyTorahFontSize") private var fontSizeLevel: Double = 0

    /// Number appears on right when Hebrew is shown (mirrors main text label position).
    private var labelOnRight: Bool {
        displayMode == .source || displayMode == .both
    }

    private var numberLabel: some View {
        Text("\(displayIndex ?? (index + 1))")
            .font(.caption2.monospacedDigit())
            .foregroundStyle(fg.opacity(0.4))
            .frame(width: 20, alignment: labelOnRight ? .leading : .trailing)
            .padding(.top, 3)
    }

    /// Prepend the SA letter prefix (if any) to Hebrew text. The prefix uses LTR characters
    /// (brackets + Hebrew letter) which the bidi algorithm places correctly at the RTL start.
    private func heText(_ raw: String) -> String {
        let stripped = SefariaTextClient.processedHebrew(raw)
        guard let prefix = saLabelPrefix else { return "\u{200F}" + stripped }
        return "\u{200F}" + prefix + stripped
    }

    /// Prepend the SA letter prefix (if any) to English text.
    /// When saLabelIsSmall is true the prefix is omitted here — the small Hebrew
    /// prefix already labels the entry; showing a full-size prefix on the English
    /// line would create a "small + large" duplicate.
    private func enText(_ raw: String) -> String {
        let stripped = SefariaTextClient.stripHTML(raw)
        guard let prefix = saLabelPrefix, !saLabelIsSmall else { return stripped }
        return prefix + stripped
    }

    /// Renders Hebrew commentary text using SwiftUI Text + Font.custom, which correctly
    /// applies Frank Ruhl Libre / Noto Rashi Hebrew. UITextView (SelectableTextView) was
    /// replaced because it silently overrides custom fonts on RTL runs and causes gesture
    /// conflicts with the parent SwiftUI ScrollView that block drag-handle text selection.
    @ViewBuilder
    private func hebrewContentView(_ raw: String) -> some View {
        if textSelectionMode {
            // UITextView gives drag-handle selection; scroll conflict is gone because
            // the parent ScrollView has isScrollEnabled = false in selection mode.
            // UITextView ignores custom fonts on RTL runs so Rashi/Frank Ruhl won't render,
            // but selection fidelity matters more than font fidelity in this mode.
            SelectableTextView(attributed: .hebrewCallout(
                html: raw,
                prefix: saLabelPrefix ?? "",
                prefixIsSmall: saLabelIsSmall,
                fg: UIColor(fg.opacity(0.88))
            ))
            .frame(maxWidth: .infinity, alignment: .trailing)
        } else if useRashiFont {
            rashiHebrewText(raw)
                .textSelection(.enabled)   // must be before .frame()
                .lineSpacing(4)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
        } else {
            hebrewCommentaryText(raw)
                .textSelection(.enabled)   // must be before .frame() — layout wrappers break selection
                .lineSpacing(4)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    /// Builds a SwiftUI `Text` for Hebrew commentary using Frank Ruhl Libre.
    /// Handles `<rf>` small-size spans (SA sequential-marker labels) and optional
    /// SA letter prefix with optional small-size rendering.
    private func hebrewCommentaryText(_ raw: String) -> Text {
        let base = UIFont.preferredFont(forTextStyle: .body).pointSize
        let offset: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 3 : -3
        let size = max(10, base + CGFloat(fontSizeLevel) * 2 + offset)
        let heFont = Font.system(size: size)
        let smFont = Font.system(size: max(10, size - 5))
        let color  = fg.opacity(0.88)

        // Prefix span: SA sequential-marker label, optionally at small size.
        let prefixText: Text? = saLabelPrefix.map { p in
            let pFont: Font = saLabelIsSmall ? smFont : heFont
            return Text("\u{200F}" + p).font(pFont).foregroundColor(color)
        }

        // Parse <rf> spans (SA inline bracket markers rendered at small size).
        let htmlWithRlm = "\u{200F}" + raw
        let rfPattern = #"<rf>(.*?)</rf>"#

        func bodyText() -> Text {
            guard let regex = try? NSRegularExpression(pattern: rfPattern) else {
                return Text(SefariaTextClient.processedHebrew(htmlWithRlm)).font(heFont).foregroundColor(color)
            }
            let ns = htmlWithRlm as NSString
            let matches = regex.matches(in: htmlWithRlm, range: NSRange(location: 0, length: ns.length))
            guard !matches.isEmpty else {
                return Text(SefariaTextClient.processedHebrew(htmlWithRlm)).font(heFont).foregroundColor(color)
            }
            var result = Text("")
            var lastEnd = 0
            for match in matches {
                if match.range.location > lastEnd {
                    let chunk = ns.substring(with: NSRange(location: lastEnd,
                                                           length: match.range.location - lastEnd))
                    let plain = SefariaTextClient.processedHebrew(chunk)
                    if !plain.isEmpty { result = result + Text(plain).font(heFont).foregroundColor(color) }
                }
                if let r = Range(match.range(at: 1), in: htmlWithRlm) {
                    let marker = SefariaTextClient.stripHTML(String(htmlWithRlm[r]))
                    if !marker.isEmpty { result = result + Text(marker).font(smFont).foregroundColor(color) }
                }
                lastEnd = match.range.location + match.range.length
            }
            if lastEnd < ns.length {
                let chunk = ns.substring(with: NSRange(location: lastEnd, length: ns.length - lastEnd))
                let plain = SefariaTextClient.processedHebrew(chunk)
                if !plain.isEmpty { result = result + Text(plain).font(heFont).foregroundColor(color) }
            }
            return result
        }

        let body = bodyText()
        return prefixText.map { $0 + body } ?? body
    }

    /// Builds a SwiftUI `Text` for Rashi commentary Hebrew using Noto Rashi Hebrew.
    private func rashiHebrewText(_ raw: String) -> Text {
        let base = UIFont.preferredFont(forTextStyle: .body).pointSize
        let offset: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 2 : -6
        let size = max(10, base + CGFloat(fontSizeLevel) * 2 + offset)
        let rashiFont = Font.custom("NotoRashiHebrew-Regular", size: size)
        let color = fg.opacity(0.88)
        let processed = SefariaTextClient.processedHebrew("\u{200F}" + raw)

        if let prefix = saLabelPrefix {
            let prefFont: Font = saLabelIsSmall
                ? .system(size: max(10, size - 4))
                : rashiFont
            return Text("\u{200F}" + prefix).font(prefFont).foregroundColor(color)
                 + Text(processed).font(rashiFont).foregroundColor(color)
        }
        return Text(processed).font(rashiFont).foregroundColor(color)
    }

    /// English commentary text as a SwiftUI view. Plain text (HTML already stripped by callers).
    /// SwiftUI Text is used instead of UITextView so .textSelection(.enabled) on the parent
    /// ScrollView enables drag-handle selection without gesture conflicts.
    @ViewBuilder
    private func englishCommentaryView(_ text: String) -> some View {
        let enOffset: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 3 : -3
        let size = max(10, UIFont.preferredFont(forTextStyle: .body).pointSize + CGFloat(fontSizeLevel) * 2 + enOffset)
        if textSelectionMode {
            SelectableTextView(attributed: .englishCallout(text: text, fg: UIColor(fg.opacity(0.88))))
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(text)
                .textSelection(.enabled)   // must be before .frame()
                .font(.system(size: size))
                .foregroundStyle(fg.opacity(0.88))
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    var body: some View {
        // Strip Sefaria's embedded bold label (e.g. <b>א</b>) when we manage our own
        // prefix — otherwise both labels appear simultaneously.
        let cleanHe = saLabelPrefix != nil
            ? SefariaTextClient.stripLeadingBoldLabel(hebrewHTML) : hebrewHTML
        let cleanEn = saLabelPrefix != nil
            ? SefariaTextClient.stripLeadingBoldLabel(englishHTML) : englishHTML

        HStack(alignment: .top, spacing: 8) {
            if !labelOnRight { numberLabel }

            VStack(alignment: .leading, spacing: 4) {
                switch displayMode {
                case .source:
                    if !cleanHe.isEmpty {
                        hebrewContentView(cleanHe)
                    } else {
                        // Fallback to English if no Hebrew
                        englishCommentaryView(enText(cleanEn))
                    }
                case .translation:
                    if !cleanEn.isEmpty {
                        englishCommentaryView(enText(cleanEn))
                    } else {
                        hebrewContentView(cleanHe)
                    }
                case .both:
                    if !cleanHe.isEmpty {
                        hebrewContentView(cleanHe)
                    }
                    if !cleanHe.isEmpty && !cleanEn.isEmpty {
                        Divider().background(fg.opacity(0.15))
                    }
                    if !cleanEn.isEmpty {
                        // English NEVER gets the prefix in BOTH mode — the Hebrew line
                        // already carries the letter label.
                        englishCommentaryView(SefariaTextClient.stripHTML(cleanEn))
                    }
                }
            }

            if labelOnRight { numberLabel }
        }
        .padding(.vertical, 4)
        .overlay(alignment: .bottom) {
            Divider().background(fg.opacity(0.07))
        }
    }
}
