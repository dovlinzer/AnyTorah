import SwiftUI

struct TextReaderView: View {
    @Bindable var vm: TextReaderViewModel
    @Bindable var bookmarkManager: BookmarkManager
    @Bindable var audioPlayer: AudioPlayer
    let appBg: Color
    let appFg: Color
    let onBack: () -> Void

    @State private var isLoadingAudio = false
    @State private var audioUnavailable = false

    @AppStorage("anyTorahFontSize") private var fontSizeRaw: Double = 0  // level: −2…+2 (each step = ±2 pt)

    // Daf image mode (Talmud only)
    @AppStorage("talmudShowDafImage") private var showDafImage: Bool = false
    @State private var dafSideA: Bool = true   // which amud is shown in image mode

    // Side panel appearance
    @AppStorage("useWhiteBackground") private var useWhiteBackground: Bool = false
    @AppStorage("sidePanelContrast") private var sidePanelContrast: Bool = false

    /// Background colour for side panel columns.
    /// In dark mode with contrast enabled: soft white with a hint of blue.
    /// Otherwise: matches the app background (same as main text column).
    private var panelBg: Color {
        guard sidePanelContrast && !useWhiteBackground else { return appBg }
        return Color(red: 0.93, green: 0.95, blue: 0.99)
    }

    /// Foreground colour for side panel text and icons.
    private var panelFg: Color {
        guard sidePanelContrast && !useWhiteBackground else { return appFg }
        return Color(red: 0.106, green: 0.227, blue: 0.541)
    }

    // Commentary layout (side panels)
    @AppStorage("commentaryLayout") private var commentaryLayoutRaw: String = CommentaryLayout.bottomPanel.rawValue
    @AppStorage("sidePanelFraction") private var sidePanelFraction: Double = 1.0/3.0
    @AppStorage("rightPanelFraction") private var rightPanelFraction: Double = 0.25
    @State private var mainPanelCollapsed: Bool = false   // single side-panel mode
    @State private var leftPanelCollapsed: Bool = false   // bothPanels left
    @State private var rightPanelCollapsed: Bool = false  // bothPanels right
    @State private var liveLeftFraction: Double? = nil    // non-nil while dragging left handle
    @State private var liveRightFraction: Double? = nil   // non-nil while dragging right handle
    @State private var displayModeChanging = false         // brief indicator during display-mode re-render

    private var commentaryLayout: CommentaryLayout {
        let stored = CommentaryLayout(rawValue: commentaryLayoutRaw) ?? .bottomPanel
        // Side panels and both-panels require too much horizontal space for iPhone.
        // Always use the bottom split on phone regardless of the stored setting.
        if UIDevice.current.userInterfaceIdiom == .phone {
            return .bottomPanel
        }
        return stored
    }

    // Single enum drives all sheet presentations — multiple .sheet(isPresented:) modifiers
    // on the same view interfere with each other in SwiftUI, causing the wrong sheet to show.
    private enum ActiveSheet: String, Identifiable {
        case selector, settings, bookmarks, bookmarkEdit, chapterPicker, bookPicker
        var id: String { rawValue }
    }
    @State private var activeSheet: ActiveSheet? = nil

    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false
    @AppStorage("reverseNavDirection") private var reverseNavDirection: Bool = false
    @AppStorage("bottomPanelFraction") private var bottomPanelFraction: Double = 0.40
    @State private var liveBottomFraction: Double? = nil
    @State private var mainTextSelectionMode: Bool = false

    private var cardFill: Color { appFg.opacity(0.08) }

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                readerHeader

                if vm.isLoading {
                    loadingView
                } else if let error = vm.error {
                    errorView(error)
                } else {
                    contentWithCommentary(geo: geo)
                        .overlay(alignment: .top) {
                            // Brief "Fetching text…" pill shown while commentary panels
                            // re-render attributed strings after a display-mode change.
                            if displayModeChanging {
                                HStack(spacing: 8) {
                                    ProgressView().tint(appFg).scaleEffect(0.75)
                                    Text("Updating text…")
                                        .font(.caption.weight(.medium))
                                        .foregroundStyle(appFg)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(appBg.opacity(0.92))
                                .clipShape(Capsule())
                                .shadow(color: .black.opacity(0.2), radius: 6)
                                .padding(.top, 6)
                                .transition(.move(edge: .top).combined(with: .opacity))
                            }
                        }
                        .animation(.easeInOut(duration: 0.2), value: displayModeChanging)
                }
            }
        }
        .background(appBg.ignoresSafeArea())
        // When the text changes (load() fires) while in bothPanels layout, reload the right panel.
        // The main panel is already reloaded by load() itself; only the right panel needs this.
        .onChange(of: vm.loadGeneration) { _, _ in
            guard commentaryLayout == .bothPanels && vm.commentaryVisible else { return }
            Task { await vm.loadCommentary(into: vm.rightPanel) }
        }
        // Reset collapsed state and reload panels when the layout setting changes.
        .onChange(of: commentaryLayoutRaw) { _, newVal in
            mainPanelCollapsed = false
            leftPanelCollapsed = false
            rightPanelCollapsed = false
            if vm.category == .shulchanArukh {
                // SA text embeds inline bracket markers via processCommentaryMarkers, and the
                // slot table switches between 3-slot (single-panel) and 6-slot (bothPanels).
                // Re-fetch the full text so markers are re-embedded with the new assignments.
                // load() also reloads commentary for all panels on completion.
                Task { await vm.load() }
            } else if newVal == CommentaryLayout.bothPanels.rawValue && vm.commentaryVisible {
                // Non-SA: text has no inline markers, just reload both commentary panels.
                Task { await vm.loadBothPanels() }
            }
        }
        .sheet(item: $activeSheet) { item in
            switch item {
            case .selector:
                selectorSheet
            case .settings:
                SettingsView()
            case .bookmarks:
                BookmarkListView(bookmarkManager: bookmarkManager) { bookmark in
                    bookmark.apply(to: vm)
                    Task { await vm.load() }
                }
            case .bookmarkEdit:
                BookmarkEditSheet(
                    bookmarkManager: bookmarkManager,
                    vm: vm,
                    existingBookmark: bookmarkManager.existingBookmark(for: vm)
                )
            case .chapterPicker:
                chapterPickerSheet
            case .bookPicker:
                bookPickerSheet
            }
        }
        .task {
            await vm.load()
        }
    }

    // MARK: - Header (two rows + optional audio row)

    private var readerHeader: some View {
        VStack(spacing: 0) {
            // Row 1: Gear (far left) | centered title | [bookmark][bookmarks][list] (far right)
            // The HStack gets .frame(maxWidth:.infinity) so it always spans the full width
            // regardless of ZStack sizing, keeping the right-icon cluster truly at the edge.
            ZStack {
                // Navigation pills — tap book to open full selector, tap chapter for quick chapter pick.
                // In Hebrew mode the layout flips RTL so the book name sits on the right.
                // In Talmud daf-image mode the amud A/B picker also lives here.
                HStack(spacing: 6) {
                    Button { activeSheet = .bookPicker } label: {
                        Text(vm.navBookTitle)
                            .font(vm.category == .talmud ? .title3.weight(.bold) : .callout.weight(.semibold))
                            .foregroundStyle(appFg)
                            .lineLimit(1)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(RoundedRectangle(cornerRadius: 8).fill(appFg.opacity(0.12)))
                    }
                    Button { activeSheet = .chapterPicker } label: {
                        Text(vm.navChapterTitle)
                            .font(vm.category == .talmud ? .title3.weight(.bold) : .callout.weight(.semibold))
                            .foregroundStyle(appFg)
                            .lineLimit(1)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(RoundedRectangle(cornerRadius: 8).fill(appFg.opacity(0.12)))
                    }
                    // Amud A/B selector — shown in daf-image mode (controls image side) or
                    // in text mode (scrolls within the loaded daf).
                    if vm.category == .talmud && showDafImage,
                       let tractate = vm.currentTalmudTractate,
                       TalmudPageManager.shared.hasPages(for: tractate.sefariaName) {
                        dafAmudPill
                    } else if vm.category == .talmud && !showDafImage {
                        talmudTextAmudPill
                    }
                }
                .environment(\.layoutDirection, saHebrewMode ? .rightToLeft : .leftToRight)
                .padding(.horizontal, 88)
                .frame(maxWidth: .infinity, alignment: .center)

                HStack {
                    Button { activeSheet = .settings } label: {
                        Image(systemName: "gear")
                            .foregroundStyle(appFg)
                            .font(.body)
                    }

                    Spacer()

                    // Right-side cluster — always together at the trailing edge
                    HStack(spacing: 14) {
                        Button { activeSheet = .bookmarkEdit } label: {
                            Image(systemName: bookmarkManager.isCurrentLocationBookmarked(vm: vm)
                                  ? "bookmark.fill" : "bookmark")
                                .foregroundStyle(appFg)
                                .font(.body)
                        }
                        Button { activeSheet = .bookmarks } label: {
                            Image(systemName: "bookmarks")
                                .foregroundStyle(appFg)
                                .font(.body)
                        }
                        Button { activeSheet = .selector } label: {
                            Image(systemName: "list.bullet")
                                .foregroundStyle(appFg)
                                .font(.body)
                        }
                    }
                }
                .frame(maxWidth: .infinity)   // guarantee full-width HStack in ZStack
                .environment(\.layoutDirection, .leftToRight)  // always LTR regardless of system locale
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 8)

            Divider()
                .background(appFg.opacity(0.25))

            // Row 2: Back (left) | language pill + text/daf toggle (centred) | commentary toggle (right)
            // Uses ZStack so the centre cluster is truly centred regardless of edge-button widths.
            ZStack {
                // ── Centre: language mode selector + optional text/daf toggle ──
                HStack(spacing: 0) {
                    displayModePill
                    if vm.category == .talmud,
                       let tractate = vm.currentTalmudTractate,
                       TalmudPageManager.shared.hasPages(for: tractate.sefariaName) {
                        Rectangle()
                            .fill(appFg.opacity(0.22))
                            .frame(width: 1, height: 18)
                            .padding(.horizontal, 8)
                        textDafToggle
                    }
                }
                .padding(.horizontal, 80)
                .frame(maxWidth: .infinity, alignment: .center)

                // ── Left + right edges ──
                HStack {
                    Button(action: onBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .foregroundStyle(appFg)
                        .font(.subheadline)
                    }

                    Spacer()

                    HStack(spacing: 14) {
                    Button {
                        mainTextSelectionMode.toggle()
                    } label: {
                        Image(systemName: mainTextSelectionMode ? "cursor.rays" : "text.cursor")
                            .foregroundStyle(mainTextSelectionMode ? appFg : appFg.opacity(0.45))
                            .font(.body)
                    }

                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            vm.commentaryVisible.toggle()
                            // When re-expanding a collapsed side panel, un-collapse it too.
                            if vm.commentaryVisible {
                                mainPanelCollapsed = false
                                leftPanelCollapsed = false
                                rightPanelCollapsed = false
                            }
                        }
                        if vm.commentaryVisible {
                            Task {
                                if commentaryLayout == .bothPanels {
                                    await vm.loadBothPanels()
                                } else {
                                    await vm.loadCommentary()
                                }
                            }
                        }
                    } label: {
                        Image(systemName: vm.commentaryVisible
                              ? "text.badge.checkmark"
                              : "text.badge.plus")
                        .foregroundStyle(appFg)
                        .font(.body)
                    }
                    } // HStack closing brace
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            // Row 3: Audio player (Talmud only)
            if vm.category == .talmud {
                Divider()
                    .background(appFg.opacity(0.25))
                audioPlayerRow
            }
        }
        // Force the entire header chrome to be LTR regardless of system locale
        // (Hebrew text inside still renders RTL via bidi algorithm)
        .environment(\.layoutDirection, .leftToRight)
    }

    // MARK: - Audio player row (Row 3, Talmud only)

    @ViewBuilder
    private var audioPlayerRow: some View {
        VStack(spacing: 0) {
            if isLoadingAudio || audioPlayer.isBuffering {
                HStack(spacing: 8) {
                    ProgressView().tint(appFg).scaleEffect(0.8)
                    Text("Loading audio…")
                        .font(.subheadline)
                        .foregroundStyle(appFg.opacity(0.6))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)

            } else if audioUnavailable {
                HStack(spacing: 6) {
                    Image(systemName: "speaker.slash")
                        .foregroundStyle(appFg.opacity(0.4))
                    Text("Audio unavailable for this daf")
                        .font(.caption)
                        .foregroundStyle(appFg.opacity(0.4))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)

            } else if audioPlayer.isStopped {
                // Idle — centered ▶ Play button
                Button { Task { await startAudio() } } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "play.fill")
                        Text("Play")
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(appFg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                }

            } else {
                // Active — full transport controls
                audioPlaybackControls
            }
        }
        // Stop & reset when the user navigates to a different daf or tractate
        .onChange(of: vm.talmudDaf) { _, _ in audioPlayer.stop(); audioUnavailable = false }
        .onChange(of: vm.talmudTractateIndexInSeder) { _, _ in audioPlayer.stop(); audioUnavailable = false }
    }

    private var audioPlaybackControls: some View {
        VStack(spacing: 4) {
            // Thin progress bar (full width, above the controls row)
            if audioPlayer.duration > 0 {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(appFg.opacity(0.15)).frame(height: 3)
                        Capsule()
                            .fill(appFg.opacity(0.65))
                            .frame(
                                width: geo.size.width * min(1, audioPlayer.currentTime / max(1, audioPlayer.duration)),
                                height: 3
                            )
                    }
                }
                .frame(height: 3)
                .padding(.horizontal, 16)
                .padding(.top, 6)
            }

            // Single compact row: elapsed | [⏮][⏸/▶][⏭] | [■] | [speed] | duration
            HStack(spacing: 0) {
                // Elapsed time
                Text(formatTime(audioPlayer.currentTime))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(appFg.opacity(0.5))
                    .frame(width: 56, alignment: .leading)
                    .padding(.leading, 12)

                Spacer(minLength: 4)

                // Transport cluster — [⏮][⏸/▶][⏭] with subtle grouped background
                HStack(spacing: 2) {
                    Button { audioPlayer.skip(by: -15) } label: {
                        Image(systemName: "gobackward.15")
                            .font(.callout)
                            .foregroundStyle(appFg)
                            .frame(width: 36, height: 34)
                    }
                    Button { audioPlayer.togglePlayPause() } label: {
                        Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(appFg)
                            .frame(width: 36, height: 34)
                    }
                    Button { audioPlayer.skip(by: 15) } label: {
                        Image(systemName: "goforward.15")
                            .font(.callout)
                            .foregroundStyle(appFg)
                            .frame(width: 36, height: 34)
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(appFg.opacity(0.10))
                )

                // Stop button
                Button {
                    audioPlayer.stop()
                    audioUnavailable = false
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.callout)
                        .foregroundStyle(appFg)
                        .frame(width: 34, height: 34)
                }
                .padding(.leading, 12)

                // Speed menu
                Menu {
                    ForEach([0.75, 1.0, 1.25, 1.5, 2.0] as [Double], id: \.self) { rate in
                        Button { audioPlayer.setRate(Float(rate)) } label: {
                            let label = rate == 1.0 ? "1×" : String(format: "%.2g×", rate)
                            if abs(Float(rate) - audioPlayer.playbackRate) < 0.01 {
                                Label(label, systemImage: "checkmark")
                            } else {
                                Text(label)
                            }
                        }
                    }
                } label: {
                    Text(audioPlayer.playbackRate == 1.0 ? "1×"
                         : String(format: "%.2g×", audioPlayer.playbackRate))
                        .font(.caption.monospacedDigit().weight(.medium))
                        .foregroundStyle(appFg)
                        .frame(width: 54, height: 34)
                }
                .padding(.leading, 10)

                Spacer(minLength: 4)

                // Total duration
                Text(formatTime(audioPlayer.duration))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(appFg.opacity(0.5))
                    .frame(width: 56, alignment: .trailing)
                    .padding(.trailing, 12)
            }
            .padding(.bottom, 6)
        }
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00" }
        let s = Int(seconds)
        let m = s / 60
        let h = m / 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m % 60, s % 60) }
        return String(format: "%d:%02d", m, s % 60)
    }

    private func startAudio() async {
        guard let tractate = vm.currentTalmudTractate else { return }
        isLoadingAudio = true
        audioUnavailable = false
        if let url = await TalmudAudioService.audioURL(tractate: tractate.sefariaName,
                                                        daf: vm.talmudDaf) {
            let title = "\(tractate.name) \(vm.talmudDaf) — YCT"
            audioPlayer.play(url: url, title: title)
        } else {
            audioUnavailable = true
        }
        isLoadingAudio = false
    }

    // MARK: - Text / Daf toggle (Talmud only)

    /// Small "Text / Daf" segmented button shown in the header right cluster.
    private var textDafToggle: some View {
        HStack(spacing: 0) {
            textDafButton("Text", isDaf: false)
            textDafButton("דף",  isDaf: true)
        }
        .background(
            RoundedRectangle(cornerRadius: 8)
                .stroke(appFg.opacity(0.22), lineWidth: 0.5)
        )
    }

    private func textDafButton(_ label: String, isDaf: Bool) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) { showDafImage = isDaf }
            if isDaf { dafSideA = true }
        } label: {
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(appFg)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(showDafImage == isDaf ? appFg.opacity(0.25) : Color.clear)
                )
        }
    }

    /// Amud A/B picker shown in Row 1 when the daf image is active.
    /// In Hebrew mode the buttons follow RTL order (ע״א on right, ע״ב on left);
    /// in English mode they show "a" and "b" in LTR order.
    private var dafAmudPill: some View {
        HStack(spacing: 0) {
            amudButton(saHebrewMode ? "א" : "a", sideA: true)
            amudButton(saHebrewMode ? "ב" : "b", sideA: false)
        }
        .background(Capsule().fill(appFg.opacity(0.12)))
        // Hebrew mode: RTL so ע״א appears on the right, ע״ב on the left.
        // English mode: LTR so "a" appears on the left, "b" on the right.
        // The pill is nested inside the nav HStack which already sets RTL in Hebrew mode,
        // so we just need to keep it consistent — do NOT override here; inherit from parent.
    }

    /// Amud A/B selector for text mode — scrolls within the loaded daf rather than switching image.
    private var talmudTextAmudPill: some View {
        HStack(spacing: 0) {
            talmudTextAmudButton(saHebrewMode ? "א" : "a", amud: 0)
            talmudTextAmudButton(saHebrewMode ? "ב" : "b", amud: 1)
        }
        .background(Capsule().fill(appFg.opacity(0.12)))
    }

    private func talmudTextAmudButton(_ label: String, amud: Int) -> some View {
        Button {
            if vm.talmudAmud != amud {
                vm.talmudAmud = amud
                if amud == 1 {
                    vm.talmudScrollToAmudB = true
                    vm.commentaryScrollToAmudB = true
                } else {
                    vm.tanakhScrollToVerse = 1
                    vm.commentaryScrollToAmudA = true
                }
            }
        } label: {
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(appFg)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(vm.talmudAmud == amud ? appFg.opacity(0.25) : Color.clear))
        }
    }

    private func amudButton(_ label: String, sideA: Bool) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) { dafSideA = sideA }
        } label: {
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(appFg)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(dafSideA == sideA ? appFg.opacity(0.25) : Color.clear))
        }
    }

    // MARK: - Display mode pill (א | A | אA)

    private var displayModePill: some View {
        HStack(spacing: 0) {
            pillButton("א", mode: .source)
            pillButton("A", mode: .translation)
            pillButton("\u{202D}א\u{200E}A", mode: .both)
        }
        .background(
            RoundedRectangle(cornerRadius: 8)
                .stroke(appFg.opacity(0.22), lineWidth: 0.5)
        )
    }

    private func pillButton(_ label: String, mode: TextDisplayMode) -> some View {
        Button {
            guard vm.displayMode != mode else { return }
            let hasSidePanels = commentaryLayout != .bottomPanel && vm.commentaryVisible
            if hasSidePanels {
                // Show indicator first, then apply the mode change so SwiftUI can
                // render the spinner before the (potentially slow) attributed-string re-render.
                displayModeChanging = true
                Task { @MainActor in
                    // 50 ms lets SwiftUI render the indicator before the (potentially heavy)
                    // attributed-string re-render fires on the main thread.
                    try? await Task.sleep(for: .milliseconds(50))
                    withAnimation(.easeInOut(duration: 0.18)) { vm.displayMode = mode }
                    // Keep the indicator visible until re-rendering is complete (~500 ms).
                    try? await Task.sleep(for: .milliseconds(500))
                    displayModeChanging = false
                }
            } else {
                withAnimation(.easeInOut(duration: 0.18)) { vm.displayMode = mode }
            }
        } label: {
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(appFg)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(vm.displayMode == mode ? appFg.opacity(0.25) : Color.clear)
                )
        }
    }

    // MARK: - Commentary pane (inline, not an overlay)

    @ViewBuilder
    private func bottomSplitLayout(geo: GeometryProxy) -> some View {
        // Use a nested GeometryReader so we measure the actual content area height
        // (excluding the header above), not the full screen height from the outer geo.
        GeometryReader { contentGeo in
            let frac = max(0.20, min(0.65, liveBottomFraction ?? bottomPanelFraction))
            let available = contentGeo.size.height
            let commentaryH = available * frac
            let mainH = max(0, available - (vm.commentaryVisible ? commentaryH + 20 : 0))

            VStack(spacing: 0) {
                mainTextColumn
                    .frame(height: mainH)
                if vm.commentaryVisible {
                    horizontalSplitDivider(totalH: available)
                    CommentaryPanelView(vm: vm, panel: vm.mainPanel, fg: panelFg, cardFill: panelFg.opacity(0.06))
                        .frame(height: commentaryH)
                        .background(panelBg)
                }
            }
        }
    }

    private func horizontalSplitDivider(totalH: CGFloat) -> some View {
        ZStack {
            Rectangle()
                .fill(appFg.opacity(0.18))
                .frame(height: 1)
            Capsule()
                .fill(appFg.opacity(0.55))
                .frame(width: 44, height: 5)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 20)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 4)
                .onChanged { value in
                    let delta = Double(value.translation.height) / Double(totalH)
                    liveBottomFraction = max(0.15, min(0.65, bottomPanelFraction - delta))
                }
                .onEnded { value in
                    let delta = Double(value.translation.height) / Double(totalH)
                    bottomPanelFraction = max(0.15, min(0.65, bottomPanelFraction - delta))
                    liveBottomFraction = nil
                }
        )
    }

    // MARK: - Content with commentary (routes to the correct layout)

    @ViewBuilder
    private func contentWithCommentary(geo: GeometryProxy) -> some View {
        switch commentaryLayout {
        case .bottomPanel:
            bottomSplitLayout(geo: geo)
        case .leftPanel:
            sidePanelLayout(geo: geo, panelOnLeft: true)
        case .rightPanel:
            sidePanelLayout(geo: geo, panelOnLeft: false)
        case .bothPanels:
            bothPanelsLayout(geo: geo)
        }
    }

    // MARK: - Single side-panel layout (left or right)

    @ViewBuilder
    private func sidePanelLayout(geo: GeometryProxy, panelOnLeft: Bool) -> some View {
        let totalW = geo.size.width
        // For left panel, the divider drags as "isLeft" → uses liveLeftFraction.
        // For right panel, the divider drags as "not isLeft" → uses liveRightFraction.
        let rawFrac = panelOnLeft
            ? (liveLeftFraction ?? sidePanelFraction)
            : (liveRightFraction ?? sidePanelFraction)
        let panelFrac = max(0.15, min(0.55, rawFrac))
        let panelW = totalW * panelFrac

        HStack(spacing: 0) {
            if panelOnLeft {
                if vm.commentaryVisible && !mainPanelCollapsed {
                    commentaryColumn(panel: vm.mainPanel, width: panelW)
                    splitDivider(geo: geo, isLeft: true)
                } else if vm.commentaryVisible {
                    expandButton(isLeft: true)
                }
                mainTextColumn
            } else {
                mainTextColumn
                if vm.commentaryVisible && !mainPanelCollapsed {
                    splitDivider(geo: geo, isLeft: false)
                    commentaryColumn(panel: vm.mainPanel, width: panelW)
                } else if vm.commentaryVisible {
                    expandButton(isLeft: false)
                }
            }
        }
    }

    // MARK: - Both-panels layout (left + center + right)

    @ViewBuilder
    private func bothPanelsLayout(geo: GeometryProxy) -> some View {
        let totalW = geo.size.width
        let leftFrac = max(0.15, min(0.45, liveLeftFraction ?? sidePanelFraction))
        let rightFrac = max(0.15, min(0.45, liveRightFraction ?? rightPanelFraction))
        let leftW = totalW * leftFrac
        let rightW = totalW * rightFrac

        HStack(spacing: 0) {
            // Left commentary panel
            if vm.commentaryVisible && !leftPanelCollapsed {
                commentaryColumn(panel: vm.mainPanel, width: leftW)
                splitDivider(geo: geo, isLeft: true)
            } else if vm.commentaryVisible {
                expandButton(isLeft: true)
            }

            // Main text (takes remaining width)
            mainTextColumn

            // Right commentary panel
            if vm.commentaryVisible && !rightPanelCollapsed {
                splitDivider(geo: geo, isLeft: false)
                commentaryColumn(panel: vm.rightPanel, width: rightW)
            } else if vm.commentaryVisible {
                expandButton(isLeft: false)
            }
        }
    }

    // MARK: - Shared side-panel subviews

/// Main text + nav arrows + swipe gesture; used by all layouts.
    @ViewBuilder
    private var mainTextColumn: some View {
        mainContentPanel
            .overlay { navArrows }
            .simultaneousGesture(swipeGesture)
    }

    /// A commentary panel column with a fixed width, using panel-specific colours.
    private func commentaryColumn(panel: CommentaryPanelViewModel, width: CGFloat) -> some View {
        CommentaryPanelView(vm: vm, panel: panel, fg: panelFg, cardFill: panelFg.opacity(0.06))
            .frame(width: width)
            .background(panelBg)
    }

    /// Vertical drag handle between the commentary panel and the main text.
    /// `isLeft` = true means this is the left panel's right edge (drag moves left panel boundary).
    /// The touch target is 20 pt wide — much easier to grab than the visual divider alone.
    private func splitDivider(geo: GeometryProxy, isLeft: Bool) -> some View {
        ZStack {
            // Thin visual rule
            Rectangle()
                .fill(appFg.opacity(0.18))
                .frame(width: 1)
            // Prominent grip pill
            Capsule()
                .fill(appFg.opacity(0.55))
                .frame(width: 5, height: 44)
        }
        .frame(maxHeight: .infinity)
        .frame(width: 20)    // wide hit target — centered over the visual divider
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 4)
                .onChanged { value in
                    let delta = Double(value.translation.width) / Double(geo.size.width)
                    if isLeft {
                        let base = sidePanelFraction
                        liveLeftFraction = max(0.10, min(0.55, base + delta))
                    } else {
                        let base = commentaryLayout == .bothPanels ? rightPanelFraction : sidePanelFraction
                        // For right panel, dragging right makes it smaller
                        liveRightFraction = max(0.10, min(0.55, base - delta))
                    }
                }
                .onEnded { value in
                    let delta = Double(value.translation.width) / Double(geo.size.width)
                    if isLeft {
                        let newFrac = max(0.10, min(0.55, sidePanelFraction + delta))
                        if newFrac < 0.12 {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                                if commentaryLayout == .bothPanels {
                                    leftPanelCollapsed = true
                                } else {
                                    mainPanelCollapsed = true
                                }
                            }
                        } else {
                            sidePanelFraction = newFrac
                        }
                        liveLeftFraction = nil
                    } else {
                        let base = commentaryLayout == .bothPanels ? rightPanelFraction : sidePanelFraction
                        let newFrac = max(0.10, min(0.55, base - delta))
                        if newFrac < 0.12 {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                                if commentaryLayout == .bothPanels {
                                    rightPanelCollapsed = true
                                } else {
                                    mainPanelCollapsed = true
                                }
                            }
                        } else {
                            if commentaryLayout == .bothPanels {
                                rightPanelFraction = newFrac
                            } else {
                                sidePanelFraction = newFrac
                            }
                        }
                        liveRightFraction = nil
                    }
                }
        )
    }

    /// Thin "ear" shown at the edge when a panel is collapsed; tap to re-expand.
    private func expandButton(isLeft: Bool) -> some View {
        Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                if isLeft {
                    if commentaryLayout == .bothPanels { leftPanelCollapsed = false }
                    else { mainPanelCollapsed = false }
                } else {
                    if commentaryLayout == .bothPanels { rightPanelCollapsed = false }
                    else { mainPanelCollapsed = false }
                }
            }
        } label: {
            Image(systemName: isLeft ? "chevron.right" : "chevron.left")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(appFg.opacity(0.6))
                .frame(width: 18)
                .frame(maxHeight: .infinity)
                .background(appFg.opacity(0.06))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Swipe-to-navigate gesture

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 35)
            .onEnded { val in
                // Don't navigate if a UITextView owns the responder chain — the user
                // is dragging a text-selection handle, not swiping to a new chapter.
                if UIApplication.shared.firstResponder is UITextView { return }
                let h = val.translation.width
                let v = val.translation.height
                // Only fire when the gesture is clearly horizontal
                guard abs(h) > abs(v) * 1.3, abs(h) > 35 else { return }
                // Swipe right = previous (or next when reversed); swipe left = next (or previous when reversed).
                if h > 0 {
                    Task { reverseNavDirection ? await vm.navigateNext() : await vm.navigatePrevious() }
                } else {
                    Task { reverseNavDirection ? await vm.navigatePrevious() : await vm.navigateNext() }
                }
            }
    }

    // MARK: - Main content panel (text or daf image)

    @ViewBuilder
    private var mainContentPanel: some View {
        if vm.category == .talmud && showDafImage,
           let tractate = vm.currentTalmudTractate,
           TalmudPageManager.shared.hasPages(for: tractate.sefariaName) {
            DafPageView(
                tractate: tractate.sefariaName,
                daf: vm.talmudDaf,
                sideA: dafSideA,
                fg: appFg,
                onPrevious: { Task { reverseNavDirection ? await vm.navigateNext()     : await vm.navigatePrevious() } },
                onNext:     { Task { reverseNavDirection ? await vm.navigatePrevious() : await vm.navigateNext()     } }
            )
            // Reset to amud-aleph whenever the daf changes.
            .onChange(of: vm.talmudDaf) { _, _ in dafSideA = true }
        } else {
            VStack(spacing: 0) {
                if mainTextSelectionMode {
                    HStack {
                        Text("Text selection — scroll disabled")
                            .font(.caption2)
                            .foregroundStyle(appFg.opacity(0.7))
                        Spacer()
                        Button("Done") { mainTextSelectionMode = false }
                            .font(.caption2.bold())
                            .foregroundStyle(appFg)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(appFg.opacity(0.08))
                }
                TextContentView(
                    segments: vm.segments,
                    displayMode: vm.displayMode,
                    category: vm.category,
                    daf: vm.talmudDaf,
                    fg: appFg,
                    textSelectionMode: mainTextSelectionMode,
                    scrollToVerse: vm.category == .midrash ? $vm.midrashScrollToIndex : $vm.tanakhScrollToVerse,
                    scrollToAmudB: $vm.talmudScrollToAmudB)
            }
        }
    }

    // MARK: - Margin navigation arrows

    private var navArrows: some View {
        HStack {
            // Left edge
            Button {
                Task { reverseNavDirection ? await vm.navigateNext() : await vm.navigatePrevious() }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(appFg.opacity(0.3))
                    .frame(width: 28, height: 56)
                    .contentShape(Rectangle())
            }

            Spacer()

            // Right edge
            Button {
                Task { reverseNavDirection ? await vm.navigatePrevious() : await vm.navigateNext() }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(appFg.opacity(0.3))
                    .frame(width: 28, height: 56)
                    .contentShape(Rectangle())
            }
        }
        .padding(.horizontal, 2)
    }

    // MARK: - Selector sheet

    private var selectorSheet: some View {
        NavigationStack {
            TextSelectorView(vm: vm, appBg: appBg, appFg: appFg) {
                activeSheet = nil
                Task { await vm.load() }
            }
            .navigationTitle("Select Passage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { activeSheet = nil }
                        .foregroundStyle(appFg)
                }
            }
            .toolbarBackground(appBg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Chapter picker sheet

    @ViewBuilder
    private var chapterPickerSheet: some View {
        if vm.category == .shulchanArukh {
            saSimanPickerSheet
        } else {
            regularChapterPickerSheet
        }
    }

    private var regularChapterPickerSheet: some View {
        let label: String = {
            switch vm.category {
            case .talmud: return "Select Daf"
            default:      return "Select Chapter"
            }
        }()
        return VStack(spacing: 0) {
            HStack {
                Text(label)
                    .font(.headline)
                    .foregroundStyle(appFg)
                Spacer()
                Button("Done") {
                    activeSheet = nil
                    Task { await vm.load() }
                }
                .foregroundStyle(appFg)
            }
            .padding()

            Divider().background(appFg.opacity(0.25))

            chapterPickerWheel
                .foregroundStyle(appFg)

            Spacer()
        }
        .background(appBg)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var chapterPickerWheel: some View {
        switch vm.category {
        case .tanakh:
            let count = vm.currentTanakhBook?.chapters ?? 1
            Picker("", selection: $vm.tanakhChapter) {
                ForEach(1...max(1, count), id: \.self) { ch in
                    Text(saHebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)").tag(ch)
                }
            }
            .pickerStyle(.wheel)
        case .mishnah:
            let count = vm.currentMishnahTractate?.chapters ?? 1
            Picker("", selection: $vm.mishnahChapter) {
                ForEach(1...max(1, count), id: \.self) { ch in
                    Text(saHebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)").tag(ch)
                }
            }
            .pickerStyle(.wheel)
        case .talmud:
            if let tractate = vm.currentTalmudTractate {
                Picker("", selection: $vm.talmudDaf) {
                    ForEach(tractate.startDaf...max(tractate.startDaf, tractate.endDaf), id: \.self) { d in
                        Text(saHebrewMode ? SASimanNames.toHebrewNumeral(d) : "\(d)").tag(d)
                    }
                }
                .pickerStyle(.wheel)
            }
        case .rambam:
            let count = vm.currentRambamWork?.chapters ?? 1
            Picker("", selection: $vm.rambamChapter) {
                if vm.rambamHasIntro {
                    Text(saHebrewMode ? "הקדמה" : "Intro").tag(0)
                }
                ForEach(1...max(1, count), id: \.self) { ch in
                    Text(saHebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)").tag(ch)
                }
            }
            .pickerStyle(.wheel)
        case .shulchanArukh:
            let total = vm.saSection < TextCatalog.shulchanArukhSections.count
                ? TextCatalog.shulchanArukhSections[vm.saSection].simanim : 1
            Picker("", selection: $vm.saSiman) {
                ForEach(1...max(1, total), id: \.self) { s in
                    Text(saHebrewMode ? SASimanNames.toHebrewNumeral(s) : "\(s)").tag(s)
                }
            }
            .pickerStyle(.wheel)
        case .midrash:
            let chCount = TextCatalog.allTanakhBooks.first(where: { $0.id == vm.midrashBookIndex })?.chapters ?? 1
            Picker("", selection: $vm.midrashChapter) {
                ForEach(1...max(1, chCount), id: \.self) { ch in
                    Text("\(ch)").tag(ch)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    // MARK: - SA siman picker (full list with names + topic-section grouping)

    @ViewBuilder
    private var saSimanPickerSheet: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(TextCatalog.shulchanArukhSections.indices, id: \.self) { bookIdx in
                    let book = TextCatalog.shulchanArukhSections[bookIdx]
                    let sections = saTopicSections(for: bookIdx)
                    Section {
                        ForEach(sections.indices, id: \.self) { sIdx in
                            let sec = sections[sIdx]
                            // Topic sub-section header row
                            let topicName = saHebrewMode
                                ? (SASimanNames.sectionHebName(bookIndex: bookIdx, sectionIdx: sIdx) ?? sec.name)
                                : sec.name
                            Text(topicName)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(appFg.opacity(0.4))
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 2, trailing: 16))
                                .listRowSeparator(.hidden)
                            // Siman rows for this topic section
                            ForEach(sec.start...max(sec.start, sec.end), id: \.self) { siman in
                                let isSelected = vm.saSection == bookIdx && vm.saSiman == siman
                                let numStr = saHebrewMode
                                    ? SASimanNames.toHebrewNumeral(siman)
                                    : "§\(siman)"
                                let name = saHebrewMode
                                    ? SASimanNames.simanName(bookIndex: bookIdx, siman: siman)
                                    : SASimanNames.simanNameEn(bookIndex: bookIdx, siman: siman)
                                Button {
                                    vm.saSection = bookIdx
                                    vm.saSiman = siman
                                    activeSheet = nil
                                    Task { await vm.load() }
                                } label: {
                                    HStack(spacing: 8) {
                                        Text(numStr)
                                            .foregroundStyle(appFg.opacity(0.5))
                                            .font(.caption.monospacedDigit())
                                            .frame(minWidth: 34, alignment: .trailing)
                                        Text(name ?? (saHebrewMode ? "סימן \(siman)" : "Siman \(siman)"))
                                            .foregroundStyle(appFg)
                                            .font(.subheadline)
                                        Spacer()
                                        if isSelected {
                                            Image(systemName: "checkmark")
                                                .foregroundStyle(appFg)
                                                .font(.caption.weight(.semibold))
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparatorTint(appFg.opacity(0.08))
                                .id("siman_\(bookIdx)_\(siman)")
                            }
                        }
                    } header: {
                        Text(saHebrewMode ? book.hebrewName.strippingNikud : book.name)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(appFg)
                            .textCase(nil)
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(appBg)
            .environment(\.layoutDirection, saHebrewMode ? .rightToLeft : .leftToRight)
            .onAppear {
                let scrollId = "siman_\(vm.saSection)_\(vm.saSiman)"
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    proxy.scrollTo(scrollId, anchor: .center)
                }
            }
        }
        .background(appBg)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func saTopicSections(for bookIndex: Int) -> [SATopicSection] {
        switch bookIndex {
        case 0: return SASimanNames.sectionsOH
        case 1: return SASimanNames.sectionsYD
        case 2: return SASimanNames.sectionsEH
        case 3: return SASimanNames.sectionsHM
        default: return []
        }
    }

    // MARK: - Book picker sheet

    private var bookPickerSheet: some View {
        ScrollViewReader { proxy in
            List {
                switch vm.category {
                case .tanakh:
                    ForEach(TextCatalog.allTanakhBooks.indices, id: \.self) { idx in
                        let book = TextCatalog.allTanakhBooks[idx]
                        let isSelected = vm.tanakhBookIndex == idx
                        Button {
                            vm.tanakhBookIndex = idx
                            activeSheet = nil
                            Task { await vm.load() }
                        } label: {
                            HStack {
                                Text(saHebrewMode ? book.hebrewName.strippingNikud : book.name).foregroundStyle(appFg)
                                Spacer()
                                if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
                            }.contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(appFg.opacity(0.12))
                        .id("book_\(idx)")
                    }

                case .mishnah:
                    ForEach(TextCatalog.mishnahSedarim.indices, id: \.self) { si in
                        let seder = TextCatalog.mishnahSedarim[si]
                        Section {
                            ForEach(seder.tractates.indices, id: \.self) { ti in
                                let t = seder.tractates[ti]
                                let isSelected = vm.mishnahSederIndex == si && vm.mishnahTractateIndexInSeder == ti
                                Button {
                                    vm.mishnahSederIndex = si
                                    vm.mishnahTractateIndexInSeder = ti
                                    activeSheet = nil
                                    Task { await vm.load() }
                                } label: {
                                    HStack {
                                        Text(saHebrewMode ? t.hebrewName.strippingNikud : t.name).foregroundStyle(appFg)
                                        Spacer()
                                        if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
                                    }.contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparatorTint(appFg.opacity(0.12))
                                .id("book_\(si)_\(ti)")
                            }
                        } header: {
                            Text(saHebrewMode ? seder.hebrewName.strippingNikud : seder.name)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(appFg.opacity(0.5))
                                .textCase(nil)
                        }
                    }

                case .talmud:
                    ForEach(TextCatalog.talmudSedarim.indices, id: \.self) { si in
                        let seder = TextCatalog.talmudSedarim[si]
                        Section {
                            ForEach(seder.tractates.indices, id: \.self) { ti in
                                let t = seder.tractates[ti]
                                let isSelected = vm.talmudSederIndex == si && vm.talmudTractateIndexInSeder == ti
                                Button {
                                    vm.talmudSederIndex = si
                                    vm.talmudTractateIndexInSeder = ti
                                    activeSheet = nil
                                    Task { await vm.load() }
                                } label: {
                                    HStack {
                                        Text(saHebrewMode ? t.hebrewName.strippingNikud : t.name).foregroundStyle(appFg)
                                        Spacer()
                                        if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
                                    }.contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparatorTint(appFg.opacity(0.12))
                                .id("book_\(si)_\(ti)")
                            }
                        } header: {
                            Text(saHebrewMode ? seder.hebrewName.strippingNikud : seder.name)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(appFg.opacity(0.5))
                                .textCase(nil)
                        }
                    }

                case .rambam:
                    ForEach(TextCatalog.rambamSefarim.indices, id: \.self) { si in
                        let sefer = TextCatalog.rambamSefarim[si]
                        Section {
                            ForEach(sefer.works.indices, id: \.self) { wi in
                                let w = sefer.works[wi]
                                let isSelected = vm.rambamSeferIndex == si && vm.rambamWorkIndexInSefer == wi
                                Button {
                                    vm.rambamSeferIndex = si
                                    vm.rambamWorkIndexInSefer = wi
                                    activeSheet = nil
                                    Task { await vm.load() }
                                } label: {
                                    HStack {
                                        Text(saHebrewMode ? w.hebrewName.strippingNikud : w.name).foregroundStyle(appFg)
                                        Spacer()
                                        if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
                                    }.contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparatorTint(appFg.opacity(0.12))
                                .id("book_\(si)_\(wi)")
                            }
                        } header: {
                            Text(saHebrewMode ? sefer.hebrewName.strippingNikud : sefer.name)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(appFg.opacity(0.5))
                                .textCase(nil)
                        }
                    }

                case .shulchanArukh:
                    ForEach(TextCatalog.shulchanArukhSections.indices, id: \.self) { idx in
                        let section = TextCatalog.shulchanArukhSections[idx]
                        let isSelected = vm.saSection == idx
                        Button {
                            vm.saSection = idx
                            vm.saSiman = 1
                            activeSheet = nil
                            Task { await vm.load() }
                        } label: {
                            HStack {
                                Text(saHebrewMode ? section.hebrewName.strippingNikud : section.name).foregroundStyle(appFg)
                                Spacer()
                                if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
                            }.contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(appFg.opacity(0.12))
                        .id("book_\(idx)")
                    }

                case .midrash:
                    let works = MidrashWork.works(for: vm.midrashSubcategory)
                    ForEach(works.indices, id: \.self) { idx in
                        let work = works[idx]
                        let isSelected = vm.midrashWork == work
                        Button {
                            vm.midrashWork = work
                            activeSheet = nil
                            Task { await vm.load() }
                        } label: {
                            HStack {
                                Text(saHebrewMode ? work.hebrewName : work.displayName).foregroundStyle(appFg)
                                Spacer()
                                if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
                            }.contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(appFg.opacity(0.12))
                        .id("book_midrash_\(idx)")
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(appBg)
            .environment(\.layoutDirection, saHebrewMode ? .rightToLeft : .leftToRight)
            .onAppear {
                let scrollId: String = {
                    switch vm.category {
                    case .tanakh:        return "book_\(vm.tanakhBookIndex)"
                    case .mishnah:       return "book_\(vm.mishnahSederIndex)_\(vm.mishnahTractateIndexInSeder)"
                    case .talmud:        return "book_\(vm.talmudSederIndex)_\(vm.talmudTractateIndexInSeder)"
                    case .rambam:        return "book_\(vm.rambamSeferIndex)_\(vm.rambamWorkIndexInSefer)"
                    case .shulchanArukh: return "book_\(vm.saSection)"
                    case .midrash:
                        let works = MidrashWork.works(for: vm.midrashSubcategory)
                        let idx = works.firstIndex(of: vm.midrashWork) ?? 0
                        return "book_midrash_\(idx)"
                    }
                }()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    proxy.scrollTo(scrollId, anchor: .center)
                }
            }
        }
        .background(appBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Loading / Error

    private var loadingView: some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView().tint(appFg)
            Text("Loading from Sefaria…")
                .foregroundStyle(appFg.opacity(0.7))
            Spacer()
        }
    }

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.yellow)
            Text(msg)
                .foregroundStyle(appFg.opacity(0.8))
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Try Again") {
                Task { await vm.load() }
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
    }
}
