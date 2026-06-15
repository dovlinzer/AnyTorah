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
                        case .text(let idx, let he, let en):
                            let labelPrefix: String? = saStyle.map { s in
                                "\(s.open)\(SefariaTextClient.saHebrewLetter(idx + 1))\(s.close) "
                            }
                            CommentarySegmentView(
                                index: idx, hebrewHTML: he, englishHTML: en,
                                displayMode: mode, fg: fg, saLabelPrefix: labelPrefix,
                                saLabelIsSmall: saLabelIsSmall,
                                useRashiFont: useRashiFont && (panel.selectedCommentary == .rashiTanakh
                                           || panel.selectedCommentary == .rashiTalmud))
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

    /// The selectable options grouped by section; each group has other-slots filtered out.
    private var optionGroups: [[CommentaryType]] {
        vm.commentaryPoolGrouped.map { group in
            group.filter { !otherSlots.contains($0) }
        }.filter { !$0.isEmpty }
    }

    private var groupLabels: [String?] { vm.commentaryPoolGroupLabels }

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

    /// Observing this causes the view to re-render when the font size changes,
    /// which forces SelectableTextView to rebuild its attributed strings with the new scale.
    @AppStorage("anyTorahFontSize") private var fontSizeLevel: Double = 0

    /// Number appears on right when Hebrew is shown (mirrors main text label position).
    private var labelOnRight: Bool {
        displayMode == .source || displayMode == .both
    }

    private var numberLabel: some View {
        Text("\(index + 1)")
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

    /// Renders Hebrew commentary text. When `saLabelIsSmall` is true and a prefix is present,
    /// the prefix renders at a smaller size (Taz/OC, PT/YD+EH+CM). All other prefixes
    /// render at the same callout size as the commentary body.
    ///
    /// When `useRashiFont` is set, uses SwiftUI Text + Noto Rashi Hebrew, bypassing UITextView
    /// (which overrides custom Hebrew fonts with the system font at the CoreText level).
    @ViewBuilder
    private func hebrewContentView(_ raw: String) -> some View {
        if useRashiFont {
            rashiHebrewText(raw)
                .lineSpacing(4)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
        } else {
            SelectableTextView(attributed: .hebrewCallout(
                html: raw,
                prefix: saLabelPrefix ?? "",
                prefixIsSmall: saLabelIsSmall,
                fg: UIColor(fg.opacity(0.88)),
                lineSpacing: 4
            ))
            .id("he-\(fontSizeLevel)")   // force UITextView recreation on font size change
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    /// Builds a SwiftUI `Text` for Rashi commentary Hebrew using Noto Rashi Hebrew.
    /// Uses the callout scale + app font size setting (same scale as SelectableTextView path).
    private func rashiHebrewText(_ raw: String) -> Text {
        let base = UIFont.preferredFont(forTextStyle: .body).pointSize
        let size = max(10, base + CGFloat(fontSizeLevel) * 2 - 8)
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
                        SelectableTextView(attributed: .englishCallout(
                            text: enText(cleanEn),
                            fg: UIColor(fg.opacity(0.88)),
                            lineSpacing: 4
                        ))
                        .id("en-\(fontSizeLevel)")
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                case .translation:
                    if !cleanEn.isEmpty {
                        SelectableTextView(attributed: .englishCallout(
                            text: enText(cleanEn),
                            fg: UIColor(fg.opacity(0.88)),
                            lineSpacing: 4
                        ))
                        .id("en-\(fontSizeLevel)")
                        .frame(maxWidth: .infinity, alignment: .leading)
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
                        SelectableTextView(attributed: .englishCallout(
                            text: SefariaTextClient.stripHTML(cleanEn),
                            fg: UIColor(fg.opacity(0.88)),
                            lineSpacing: 4
                        ))
                        .id("en-\(fontSizeLevel)")
                        .frame(maxWidth: .infinity, alignment: .leading)
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
