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
        case selector, settings, bookmarks, bookmarkEdit, chapterPicker, bookPicker, volumePicker, relatedArticles, podcastCitations
        var id: String { rawValue }
    }
    @State private var activeSheet: ActiveSheet? = nil
    @State private var externalArticleURL: IdentifiableURL? = nil

    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false
    @AppStorage("teshuvotAlphabeticalOrder") private var teshuvotAlphabeticalOrder: Bool = false
    @AppStorage("reverseNavDirection") private var reverseNavDirection: Bool = false
    @AppStorage("bottomPanelFraction") private var bottomPanelFraction: Double = 0.40
    @State private var liveBottomFraction: Double? = nil
    @State private var mainTextSelectionMode: Bool = false
    /// Transient UI-only siman-wheel selection for Contemporary Teshuvot's siman picker — see
    /// its `.teshuvot` branch in `chapterPickerWheel`. Not persisted; `contemporaryPage` (the
    /// resolved page, which IS persisted) is the real state.
    @State private var contemporarySimanSelection: Int = 1

    private var cardFill: Color { appFg.opacity(0.08) }

    /// True only for the page-image Contemporary works (Iggros Moshe) — false for Contemporary's
    /// Sefaria-digitized works (Mishpetei Uziel etc.), which use the ordinary text pipeline like
    /// Rishonim/Acharonim. See `TextReaderViewModel.contemporaryUsesSefaria`.
    private var isContemporaryPdfMode: Bool {
        vm.category == .teshuvot && vm.teshuvotSubcategory == .contemporary && !vm.contemporaryUsesSefaria
    }

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                readerHeader

                if isContemporaryPdfMode {
                    // Bypasses the whole Sefaria text/commentary pipeline below — see
                    // load()'s early-return guard and ContemporaryTeshuvotPageView.
                    contemporaryTeshuvotContent
                } else if vm.isLoading {
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
        .overlay(alignment: .trailing) {
            // Only when real coverage exists for the current siman — pops in once the async
            // fetch resolves, same as the Talmud audio row. Previously a header-row icon among
            // several others (easy to miss); moved to a trailing-edge tab per the pattern
            // AnyYCTorah already shipped for its own "cited from this daf" indicator
            // (LearnTheDafView.citingTab) — docked to the screen edge, overlapping the content,
            // so it reads as persistently present rather than buried in a row of controls.
            if vm.category == .shulchanArukh, !vm.relatedYCTPieces.isEmpty {
                relatedArticlesTab
            } else if isContemporaryPdfMode, !vm.citedPodcastEpisodes.isEmpty {
                podcastCitationTab
            }
        }
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
            case .volumePicker:
                volumePickerSheet
            case .relatedArticles:
                relatedArticlesSheet
            case .podcastCitations:
                podcastCitationsSheet
            }
        }
        .task {
            await vm.load()
        }
    }

    // MARK: - Header (two rows + optional audio row)

    private var readerHeader: some View {
        VStack(spacing: 0) {
            // Row 1: [bookmark][bookmarks][list] (far left) | pills (fill remaining width) | Gear (far right).
            // A single flat HStack, not a ZStack of two overlaid rows — the pills cluster gets
            // every point of space the two icon clusters don't need, rather than a guessed
            // symmetric inset (previously a flat 88pt each side, which under- or over-estimated
            // the icon clusters' real width depending on device/content and just wasted room
            // that a long work title (e.g. "Teshuvot Rabbi Akiva Eiger") could have used).
            HStack(spacing: 8) {
                // Left-side cluster — always together at the leading edge. The bookmark-edit and
                // bookmarks-list icons are grouped in their own tight-spaced HStack (4pt) since
                // they're functionally related; the selector icon (unrelated — opens the full
                // book/chapter picker) keeps a bit more breathing room (10pt) from that pair.
                HStack(spacing: 10) {
                    HStack(spacing: 4) {
                        Button { activeSheet = .bookmarkEdit } label: {
                            Image(systemName: bookmarkManager.isCurrentLocationBookmarked(vm: vm)
                                  ? "bookmark.fill" : "bookmark")
                                .foregroundStyle(appFg)
                                .font(.body)
                        }
                        // "list.bullet" (not the "bookmarks" ribbon-stack glyph) — a plain bullet
                        // list reads unambiguously as "list of my bookmarks", which is what this
                        // button opens (BookmarkListView: search + tap-to-navigate + swipe-to-
                        // delete). Previously this glyph sat on the *selector* button instead,
                        // which made that unrelated full book/chapter picker look like the
                        // bookmarks list and got tapped by mistake.
                        Button { activeSheet = .bookmarks } label: {
                            Image(systemName: "list.bullet")
                                .foregroundStyle(appFg)
                                .font(.body)
                        }
                    }
                    // Teshuvot's book/volume/siman pills already give full navigation on their
                    // own (tap any pill to jump straight to that level) — the separate combined
                    // selector sheet (TeshuvotWheels) is redundant for it, per explicit request,
                    // and was never wired up for the Contemporary subcategory in the first place.
                    if vm.category != .teshuvot {
                        Button { activeSheet = .selector } label: {
                            Image(systemName: "text.book.closed")
                                .foregroundStyle(appFg)
                                .font(.body)
                        }
                    }
                }
                .environment(\.layoutDirection, .leftToRight)  // always LTR regardless of system locale

                // Navigation pills — tap book to open full selector, tap chapter for quick chapter pick.
                // In Hebrew mode the layout flips RTL so the book name sits on the right.
                // In Talmud daf-image mode the amud A/B picker also lives here.
                HStack(spacing: 6) {
                    Button { activeSheet = .bookPicker } label: {
                        Text(vm.navBookTitle)
                            .font(vm.category == .talmud ? .title3.weight(.bold) : .callout.weight(.semibold))
                            .foregroundStyle(appFg)
                            .lineLimit(1)
                            .layoutPriority(1)  // claim space before the volume/chapter pills so it isn't the one truncated
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(RoundedRectangle(cornerRadius: 8).fill(appFg.opacity(0.12)))
                    }
                    // Teshuvot only, and only for works with a volume level (Rashba's Part,
                    // Rosh's Klal, etc.) — a dedicated step between the work pill and the siman
                    // pill, rather than requiring the separate full selector sheet to reach it.
                    if vm.category == .teshuvot, let navVolumeTitle = vm.navVolumeTitle {
                        Button { activeSheet = .volumePicker } label: {
                            Text(navVolumeTitle)
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(appFg)
                                .lineLimit(1)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 8).fill(appFg.opacity(0.12)))
                        }
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
                    // in text mode (scrolls within the loaded daf). Bavli only — Yerushalmi
                    // has no daf/amud concept, it navigates by chapter/halakha instead.
                    if vm.isTalmudBavli && showDafImage,
                       let tractate = vm.currentTalmudTractate,
                       TalmudPageManager.shared.hasPages(for: tractate.sefariaName) {
                        dafAmudPill
                    } else if vm.isTalmudBavli && !showDafImage {
                        talmudTextAmudPill
                    }
                }
                .environment(\.layoutDirection, saHebrewMode ? .rightToLeft : .leftToRight)
                // Claim every point of width the two icon clusters don't need — previously a
                // Spacer(minLength: 8) sat between this HStack and the gear, so it (not the
                // pills) absorbed any leftover room and pills stayed at their compressed
                // ideal width even when the row had space to spare. Centered (not edge-aligned)
                // so the whole book/volume/siman cluster reads as one centered unit in the
                // available row space, per explicit request — same in both reading directions
                // since the RTL flip above already handles internal pill order.
                .frame(maxWidth: .infinity, alignment: .center)

                // Settings gear — top-right, matching the home screen convention
                Button { activeSheet = .settings } label: {
                    Image(systemName: "gear")
                        .foregroundStyle(appFg)
                        .font(.body)
                }
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
                    // Hidden for Iggros Moshe (page images, not text — no Hebrew/English
                    // toggle applies) per explicit request; still shown for Contemporary's
                    // Sefaria-digitized works, which have real translations like any other
                    // Teshuvot work.
                    if !isContemporaryPdfMode {
                        displayModePill
                    }
                    if vm.isTalmudBavli,
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

            // Row 3: Audio player (Talmud Bavli only — no shiur audio exists for Yerushalmi)
            if vm.isTalmudBavli {
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

    // MARK: - Contemporary Teshuvot content (image pager, bypasses the Sefaria pipeline)

    /// Page image + forward/back paging by raw page number — edge tap zones rather than a
    /// swipe gesture, since `ContemporaryTeshuvotPageView` already uses a drag gesture for
    /// pan-when-zoomed and a competing outer swipe would fight it for the same gesture.
    private var contemporaryTeshuvotContent: some View {
        let pageCount = TeshuvotPageManager.shared.pageCount(volume: vm.contemporaryVolume.id)
        // reverseNavDirection (an existing app-wide setting — see its other call sites above,
        // e.g. the Talmud swipe handler) swaps which edge moves forward vs. back, for readers
        // who expect the left edge to advance (natural for RTL/Hebrew reading direction).
        let leftGoesForward = reverseNavDirection
        func goLeft() {
            if leftGoesForward {
                if vm.contemporaryPage < pageCount { vm.contemporaryPage += 1 }
            } else {
                if vm.contemporaryPage > 1 { vm.contemporaryPage -= 1 }
            }
        }
        func goRight() {
            if leftGoesForward {
                if vm.contemporaryPage > 1 { vm.contemporaryPage -= 1 }
            } else {
                if vm.contemporaryPage < pageCount { vm.contemporaryPage += 1 }
            }
        }
        let leftEnabled = leftGoesForward ? vm.contemporaryPage < pageCount : vm.contemporaryPage > 1
        let rightEnabled = leftGoesForward ? vm.contemporaryPage > 1 : vm.contemporaryPage < pageCount

        return ZStack {
            ContemporaryTeshuvotPageView(
                volume: vm.contemporaryVolume.id,
                page: vm.contemporaryPage,
                fg: appFg
            )

            // Edge tap zones only claim the outer ~18% of the width each (plain Color.clear
            // with no contentShape in the middle), leaving the center free for the pinch/pan/
            // double-tap-zoom gestures on the image itself underneath.
            GeometryReader { geo in
                HStack(spacing: 0) {
                    Color.clear
                        .frame(width: geo.size.width * 0.18)
                        .contentShape(Rectangle())
                        .onTapGesture(perform: goLeft)
                    Spacer(minLength: 0)
                    Color.clear
                        .frame(width: geo.size.width * 0.18)
                        .contentShape(Rectangle())
                        .onTapGesture(perform: goRight)
                }
            }

            VStack {
                Spacer()
                HStack {
                    if leftEnabled {
                        Image(systemName: "chevron.left.circle.fill")
                            .font(.title2)
                            .foregroundStyle(appFg.opacity(0.35))
                            .padding(.leading, 12)
                    }
                    Spacer()
                    if rightEnabled {
                        Image(systemName: "chevron.right.circle.fill")
                            .font(.title2)
                            .foregroundStyle(appFg.opacity(0.35))
                            .padding(.trailing, 12)
                    }
                }
                .padding(.bottom, 16)
                .allowsHitTesting(false)
            }
        }
        .background(appBg)
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
        if vm.isTalmudBavli && showDafImage,
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
        } else if vm.category == .tur {
            turSimanPickerSheet
        } else if vm.category == .teshuvot && vm.contemporaryUsesSefaria && vm.teshuvotWork == .nishmatHaBayit {
            nishmatHaBayitSimanPickerSheet
        } else {
            regularChapterPickerSheet
        }
    }

    private var regularChapterPickerSheet: some View {
        let label: String = {
            switch vm.category {
            case .talmud:   return "Select Daf"
            case .teshuvot: return "Select Siman"
            default:        return "Select Chapter"
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
        case .tur:
            let total = vm.turSection < TextCatalog.turSections.count
                ? TextCatalog.turSections[vm.turSection].simanim : 1
            Picker("", selection: $vm.turSiman) {
                ForEach(1...max(1, total), id: \.self) { s in
                    Text(saHebrewMode ? SASimanNames.toHebrewNumeral(s) : "\(s)").tag(s)
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
        case .teshuvot:
            if isContemporaryPdfMode {
                // Selecting a siman jumps `contemporaryPage` to that siman's indexed page (see
                // ContemporaryTeshuvotVolume.page(forSiman:)) rather than storing the siman
                // itself — page, not siman, is Contemporary's real navigable unit, since the
                // index is a hand-maintained best-effort lookup, not guaranteed page-perfect.
                Picker("", selection: Binding(
                    get: { contemporarySimanSelection },
                    set: { newValue in
                        contemporarySimanSelection = newValue
                        if let page = vm.contemporaryVolume.page(forSiman: newValue) {
                            vm.contemporaryPage = page
                        }
                    }
                )) {
                    ForEach(1...max(1, vm.contemporaryVolume.simanCount), id: \.self) { s in
                        Text(saHebrewMode ? SASimanNames.toHebrewNumeral(s) : "\(s)").tag(s)
                    }
                }
                .pickerStyle(.wheel)
            } else {
                // Siman only — volume (when the work has one) gets its own pill/sheet, see
                // volumePickerSheet.
                Picker("", selection: $vm.teshuvotSiman) {
                    ForEach(1...vm.teshuvotWork.maxSiman(forVolume: vm.teshuvotVolume), id: \.self) { s in
                        Text(saHebrewMode ? SASimanNames.toHebrewNumeral(s) : "\(s)").tag(s)
                    }
                }
                .pickerStyle(.wheel)
            }
        }
    }

    // MARK: - Teshuvot volume picker sheet

    /// A dedicated step between the work pill and the siman pill for Teshuvot works that have
    /// a volume level (Rashba's Part, Rosh's Klal, Terumat HaDeshen's Part, Sefer HaTashbetz's
    /// Chelek). Mirrors `regularChapterPickerSheet`'s shape but shows each volume's real display
    /// label (`TeshuvotWork.volumeDisplayLabel`) rather than a bare wheel position, since that
    /// position doesn't always equal the label (Rashba's wheel position 2 is Part IV, not II).
    private var volumePickerSheet: some View {
        if isContemporaryPdfMode {
            return AnyView(contemporaryVolumePickerSheet)
        }
        return AnyView(regularVolumePickerSheet)
    }

    private var contemporaryVolumePickerSheet: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Select Volume")
                    .font(.headline)
                    .foregroundStyle(appFg)
                Spacer()
                Button("Done") { activeSheet = nil }
                    .foregroundStyle(appFg)
            }
            .padding()

            Divider().background(appFg.opacity(0.25))

            List {
                ForEach(vm.contemporaryWork.volumes) { volume in
                    Button {
                        vm.contemporaryVolume = volume
                        activeSheet = nil
                    } label: {
                        HStack {
                            Text(saHebrewMode ? volume.hebrewLabel : volume.label)
                                .foregroundStyle(appFg)
                            Spacer()
                            if volume.id == vm.contemporaryVolume.id {
                                Image(systemName: "checkmark").foregroundStyle(appFg)
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .background(appBg)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private var regularVolumePickerSheet: some View {
        let englishLabel = vm.teshuvotWork.volumeLabel ?? "Volume"
        let label = saHebrewMode ? (vm.teshuvotWork.volumeLabelHebrew ?? englishLabel) : englishLabel
        let count = vm.teshuvotWork.volumeCount
        let selVol = min(max(1, vm.teshuvotVolume), count)
        return VStack(spacing: 0) {
            HStack {
                Text("Select \(label)")
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

            Picker("", selection: Binding(
                get: { selVol },
                set: { vm.teshuvotVolume = $0 }
            )) {
                ForEach(1...count, id: \.self) { v in
                    // The wheel row's own bidi resolution doesn't reorder this the way plain
                    // RTL text would — verified on-device the numeral stays visually on the
                    // right unless it's placed first in typed order. So for Hebrew mode the
                    // numeral is typed before the label ("ד חלק"), landing it on the left,
                    // where English types the label first ("Part IV"). The generic word is
                    // dropped entirely when the volume labels aren't plain numbers — "Kamma"/
                    // "EH I" already read fine on their own; only "Part IV"-style needs it.
                    let numeral = saHebrewMode
                        ? vm.teshuvotWork.volumePickerDisplayLabelHebrew(v)
                        : vm.teshuvotWork.volumeDisplayLabel(v)
                    // Scoped exception (2026-08-30), not a global flip: Benei Banim/B'mareh
                    // HaBazak need חלק visually RIGHT of the numeral, the opposite of every
                    // other numeric-labeled work already verified correct with the typed order
                    // below. RTL wheel-row bidi gotcha — see the comment above; if a future
                    // numeric-labeled Hebrew volume work looks backwards on-device, it likely
                    // needs its own entry in this same exception set rather than a global change.
                    let wordBeforeNumeralInHebrew: Set<TeshuvotWork> = [.beneiBanim, .bmarehHabazak]
                    let text = vm.teshuvotWork.volumeLabelIsNumeric
                        ? (saHebrewMode
                            ? (wordBeforeNumeralInHebrew.contains(vm.teshuvotWork) ? "\(label) \(numeral)" : "\(numeral) \(label)")
                            : "\(label) \(numeral)")
                        : numeral
                    Text(text).tag(v)
                }
            }
            .pickerStyle(.wheel)
            .foregroundStyle(appFg)

            Spacer()
        }
        .background(appBg)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
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

    // MARK: - Related YCT Articles (Shulchan Arukh only)

    private struct IdentifiableURL: Identifiable { let url: URL; var id: String { url.absoluteString } }

    /// Trailing-edge tab mirroring AnyYCTorah's `LearnTheDafView.citingTab`: a small badge
    /// (icon + count) pinned to the screen's trailing edge, rounded only on the leading corners
    /// so it reads as docked to the edge rather than a floating button. Tapping opens
    /// `relatedArticlesSheet`.
    private var relatedArticlesTab: some View {
        Button {
            activeSheet = .relatedArticles
        } label: {
            VStack(spacing: 4) {
                Image(systemName: "text.book.closed.fill")
                    .font(.system(size: 15))
                Text("\(vm.relatedYCTPieces.count)")
                    .font(.caption2.weight(.bold))
            }
            .foregroundStyle(.white)
            .padding(.vertical, 12)
            .padding(.horizontal, 8)
            .background(Color.black.opacity(0.55))
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 10, bottomLeadingRadius: 10))
        }
        .buttonStyle(.plain)
    }

    /// Lists YCT halakha pieces (library.yctorah.org/psak.yctorah.org) citing the current SA
    /// siman — see YCTRelatedArticlesService. Tapping a row opens it externally via SafariView;
    /// no native in-app reader (this app has no other web-view precedent — see CLAUDE.md).
    private var relatedArticlesSheet: some View {
        NavigationStack {
            List(vm.relatedYCTPieces) { piece in
                Button {
                    guard let url = URL(string: piece.url) else { return }
                    externalArticleURL = IdentifiableURL(url: url)
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        relatedArticleThumbnail(piece)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(piece.title).font(.subheadline.weight(.semibold)).foregroundStyle(appFg)
                            if let author = piece.author, !author.isEmpty {
                                Text(author).font(.caption).foregroundStyle(appFg.opacity(0.6))
                            }
                            if let excerpt = piece.excerpt, !excerpt.isEmpty {
                                Text(excerpt).font(.caption).foregroundStyle(appFg.opacity(0.75)).lineLimit(2)
                            }
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
                .listRowSeparatorTint(appFg.opacity(0.12))
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(appBg)
            .navigationTitle("Related YCT Articles")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { activeSheet = nil }
                        .foregroundStyle(appFg)
                }
            }
        }
        .background(appBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(item: $externalArticleURL) { item in SafariView(url: item.url) }
    }

    /// Featured-image thumbnail per piece, mirroring AnyYCTorah's `PostRow.thumbnail` (real
    /// image when `pieces.image_url` is populated, else a gray placeholder with a content-type
    /// glyph). No author-photo fallback tier here — that's backed by AnyYCTorah's separate
    /// `AuthorPhotoCache` scraping pipeline, out of scope for this read-only surface.
    @ViewBuilder
    private func relatedArticleThumbnail(_ piece: RelatedYCTPiece) -> some View {
        let placeholder = RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(appFg.opacity(0.12))
            .overlay {
                Image(systemName: piece.isAudio ? "headphones" : "doc.text")
                    .foregroundStyle(appFg.opacity(0.5))
            }
            .frame(width: 56, height: 56)

        if let imageURLString = piece.imageURL, let url = URL(string: imageURLString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    // MARK: - Iggros Moshe podcast citations (Contemporary Teshuvot only)

    /// Trailing-edge tab, same docked-to-edge mechanism as `relatedArticlesTab`, but made "a
    /// little more visible" per explicit request: shows the first cited episode's real
    /// SoundCloud artwork (once loaded) at a noticeably larger size than that tab's icon+count,
    /// with a small headphones badge distinguishing it from the book-icon Related Articles tab.
    private var podcastCitationTab: some View {
        Button {
            activeSheet = .podcastCitations
        } label: {
            VStack(spacing: 4) {
                ZStack(alignment: .bottomTrailing) {
                    podcastArtworkImage(for: vm.citedPodcastEpisodes[0], size: 64)
                    Image(systemName: "headphones")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(Circle().fill(Color.black.opacity(0.65)))
                        .offset(x: 4, y: 4)
                }
                if vm.citedPodcastEpisodes.count > 1 {
                    Text("\(vm.citedPodcastEpisodes.count)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                }
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 8)
            .background(Color.black.opacity(0.55))
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 10, bottomLeadingRadius: 10))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func podcastArtworkImage(for episode: PodcastEpisodeCitation, size: CGFloat) -> some View {
        let placeholder = RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(Color.white.opacity(0.15))
            .overlay {
                Image(systemName: "headphones")
                    .foregroundStyle(.white.opacity(0.7))
            }
            .frame(width: size, height: size)

        if let url = vm.podcastArtwork[episode.id] {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                        .frame(width: size, height: size)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    /// Lists every "Iggros Moshe A to Z" podcast episode (soundcloud.com/iggrosmosheatoz,
    /// Rabbi Dov Linzer) discussing the current siman — see IggrosMoshePodcastService. Tapping a
    /// row opens it externally via SafariView, matching Related YCT Articles' own pattern; no
    /// in-app playback (explicit non-goal, this is a "here's where to find it" indicator).
    private var podcastCitationsSheet: some View {
        NavigationStack {
            List(vm.citedPodcastEpisodes) { episode in
                Button {
                    guard let url = URL(string: episode.audioUrl) else { return }
                    externalArticleURL = IdentifiableURL(url: url)
                } label: {
                    HStack(alignment: .center, spacing: 10) {
                        podcastArtworkImage(for: episode, size: 56)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Episode \(episode.episodeNumber)")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(appFg.opacity(0.6))
                            Text(episode.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(appFg)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
                .listRowSeparatorTint(appFg.opacity(0.12))
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(appBg)
            .navigationTitle("Iggros Moshe A to Z")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { activeSheet = nil }
                        .foregroundStyle(appFg)
                }
            }
        }
        .background(appBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(item: $externalArticleURL) { item in SafariView(url: item.url) }
    }

    // MARK: - Nishmat HaBayit siman picker (titled list, grouped by Part — no numeric wheel)

    /// Same List+Section shape as `saSimanPickerSheet` above, grouped by Nishmat HaBayit's 5
    /// Parts instead of SA's Tur-order books — see `NishmatHaBayitSiman`'s doc comment for why
    /// this work needs a titled list rather than the ordinary numeric wheel every other Teshuvot
    /// work uses.
    private var nishmatHaBayitParts: [String] {
        var seen = Set<String>()
        return NishmatHaBayitSiman.all.map { $0.partEnglish }.filter { seen.insert($0).inserted }
    }

    @ViewBuilder
    private var nishmatHaBayitSimanPickerSheet: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(nishmatHaBayitParts, id: \.self) { part in
                    let entries = NishmatHaBayitSiman.all.filter { $0.partEnglish == part }
                    Section {
                        ForEach(entries, id: \.number) { entry in
                            let isSelected = vm.teshuvotSiman == entry.number
                            Button {
                                vm.teshuvotSiman = entry.number
                                activeSheet = nil
                                Task { await vm.load() }
                            } label: {
                                HStack(spacing: 8) {
                                    Text("\(entry.number)")
                                        .foregroundStyle(appFg.opacity(0.5))
                                        .font(.caption.monospacedDigit())
                                        .frame(minWidth: 24, alignment: .trailing)
                                    Text(saHebrewMode ? entry.titleHebrew : entry.titleEnglish)
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
                            .id("nishmat_siman_\(entry.number)")
                        }
                    } header: {
                        Text(saHebrewMode ? (entries.first?.partHebrew ?? part) : part)
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
                let scrollId = "nishmat_siman_\(vm.teshuvotSiman)"
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

    // MARK: - Tur siman picker (full list with names + topic-section grouping)

    /// Same topic-section data as SA (`SASimanNames` isn't SA-specific by signature — it just
    /// takes a raw bookIndex), but Tur's Choshen Mishpat tops out at 426, one LESS than SA's own
    /// 427 — a real, confirmed discrepancy. Clamps the last topic section's `end` (and drops any
    /// section that would start beyond 426 entirely, though none currently do) so the Tur CM
    /// picker never offers siman 427.
    private func turTopicSections(for bookIndex: Int) -> [SATopicSection] {
        let sections = saTopicSections(for: bookIndex)
        guard bookIndex == 3 else { return sections }
        let maxSiman = TextCatalog.turSections[3].simanim  // 426
        return sections.compactMap { sec in
            guard sec.start <= maxSiman else { return nil }
            return sec.end > maxSiman
                ? SATopicSection(name: sec.name, start: sec.start, end: maxSiman)
                : sec
        }
    }

    @ViewBuilder
    private var turSimanPickerSheet: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(TextCatalog.turSections.indices, id: \.self) { bookIdx in
                    let book = TextCatalog.turSections[bookIdx]
                    let sections = turTopicSections(for: bookIdx)
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
                                let isSelected = vm.turSection == bookIdx && vm.turSiman == siman
                                let numStr = saHebrewMode
                                    ? SASimanNames.toHebrewNumeral(siman)
                                    : "§\(siman)"
                                let name = saHebrewMode
                                    ? SASimanNames.simanName(bookIndex: bookIdx, siman: siman)
                                    : SASimanNames.simanNameEn(bookIndex: bookIdx, siman: siman)
                                Button {
                                    vm.turSection = bookIdx
                                    vm.turSiman = siman
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
                                .id("tursiman_\(bookIdx)_\(siman)")
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
                let scrollId = "tursiman_\(vm.turSection)_\(vm.turSiman)"
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    proxy.scrollTo(scrollId, anchor: .center)
                }
            }
        }
        .background(appBg)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Book picker sheet

    /// Groups `works` (already declared in chronological order) into consecutive same-century
    /// runs, keyed by `TeshuvotWork.century`, for the book-picker sheet's `Section` headers.
    private func teshuvotCenturyGroups(_ works: [TeshuvotWork]) -> [(century: String, workIndices: [Int])] {
        var groups: [(century: String, workIndices: [Int])] = []
        for idx in works.indices {
            let century = works[idx].century
            if groups.last?.century == century {
                groups[groups.count - 1].workIndices.append(idx)
            } else {
                groups.append((century: century, workIndices: [idx]))
            }
        }
        return groups
    }

    /// `works`' indices sorted alphabetically (by displayName in English, hebrewName in Hebrew
    /// mode) rather than the chronological declaration order — for the "Alphabetical Order"
    /// setting, which drops century grouping entirely on both the book-picker sheet and the
    /// work wheel.
    private func teshuvotAlphabeticalIndices(_ works: [TeshuvotWork]) -> [Int] {
        works.indices.sorted { lhs, rhs in
            let a = saHebrewMode ? works[lhs].hebrewName : works[lhs].displayName
            let b = saHebrewMode ? works[rhs].hebrewName : works[rhs].displayName
            return a.localizedStandardCompare(b) == .orderedAscending
        }
    }

    /// One row of the Teshuvot book-picker sheet, shared by both the century-grouped and
    /// alphabetical display orders (see `teshuvotAlphabeticalOrder`) — pulled out to a real
    /// method rather than a closure-local func, which `ViewBuilder` doesn't allow.
    @ViewBuilder
    private func teshuvotBookRow(_ idx: Int, works: [TeshuvotWork]) -> some View {
        let work = works[idx]
        let isSelected = vm.teshuvotWork == work
        Button {
            vm.teshuvotWork = work
            if work.volumeLabel != nil {
                // Chain straight into the volume picker — see volumePickerSheet — instead of
                // loading Volume 1 first and making the user separately discover that pill.
                activeSheet = .volumePicker
            } else {
                activeSheet = nil
                Task { await vm.load() }
            }
        } label: {
            HStack {
                Text(saHebrewMode ? work.hebrewName : work.displayName).foregroundStyle(appFg)
                Text("(\(saHebrewMode ? work.edah.hebrewAbbreviation : work.edah.abbreviation))").foregroundStyle(appFg.opacity(0.5)).font(.caption)
                Spacer()
                if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
            }.contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(Color.clear)
        .listRowSeparatorTint(appFg.opacity(0.12))
        .id("book_teshuvot_\(idx)")
    }

    /// One row of the Contemporary Teshuvot book-picker sheet for a page-image work (Iggros
    /// Moshe). See `contemporarySefariaBookRow` for the sibling row type used by Contemporary's
    /// Sefaria-digitized works (Mishpetei Uziel etc.) — both appear in the same list, in a
    /// specific order (Iggros Moshe first) per explicit request.
    @ViewBuilder
    private func contemporaryBookRow(_ work: ContemporaryTeshuvotWork) -> some View {
        let isSelected = !vm.contemporaryUsesSefaria && vm.contemporaryWork.id == work.id
        Button {
            vm.contemporaryUsesSefaria = false
            vm.contemporaryWork = work
            // Chain straight into the volume picker, same reasoning as teshuvotBookRow —
            // every Contemporary work has a real volume level worth surfacing immediately.
            activeSheet = .volumePicker
        } label: {
            HStack {
                // Full, un-abbreviated name here — abbreviations (hebrewDisplayName, "אג״מ")
                // are for the compact nav pill only, not the book-picker list. See
                // `TeshuvotVolume.pickerHebrewLabel`'s doc comment for the same standing policy
                // applied to volume labels.
                Text(saHebrewMode ? work.hebrewName : work.name).foregroundStyle(appFg)
                Spacer()
                if isSelected { Image(systemName: "checkmark").foregroundStyle(appFg).font(.caption.weight(.semibold)) }
            }.contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(Color.clear)
        .listRowSeparatorTint(appFg.opacity(0.12))
        .id("book_contemp_\(work.id)")
    }

    /// One row of the Contemporary Teshuvot book-picker sheet for a Sefaria-digitized work
    /// (Mishpetei Uziel, Benei Banim, B'mareh HaBazak) — added 2026-08-30. Unlike
    /// `teshuvotBookRow` (Rishonim/Acharonim), this list is never century-grouped or
    /// alphabetized: Contemporary is always a flat list, Iggros Moshe first, per explicit
    /// request. Selecting a row switches Contemporary onto the ordinary Sefaria fetch pipeline
    /// via `contemporaryUsesSefaria`.
    @ViewBuilder
    private func contemporarySefariaBookRow(_ work: TeshuvotWork) -> some View {
        let isSelected = vm.contemporaryUsesSefaria && vm.teshuvotWork == work
        Button {
            vm.contemporaryUsesSefaria = true
            vm.teshuvotWork = work
            if work.volumeLabel != nil {
                activeSheet = .volumePicker
            } else {
                activeSheet = nil
                Task { await vm.load() }
            }
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
        .id("book_contemp_sefaria_\(work.rawValue)")
    }

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

                case .tur:
                    ForEach(TextCatalog.turSections.indices, id: \.self) { idx in
                        let section = TextCatalog.turSections[idx]
                        let isSelected = vm.turSection == idx
                        Button {
                            vm.turSection = idx
                            vm.turSiman = 1
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
                case .teshuvot:
                    if vm.teshuvotSubcategory == .contemporary {
                        ForEach(ContemporaryTeshuvotWork.works) { work in
                            contemporaryBookRow(work)
                        }
                        ForEach(TeshuvotWork.works(for: .contemporary)) { work in
                            contemporarySefariaBookRow(work)
                        }
                    } else {
                        let works = TeshuvotWork.works(for: vm.teshuvotSubcategory)
                        if teshuvotAlphabeticalOrder {
                            ForEach(teshuvotAlphabeticalIndices(works), id: \.self) { idx in
                                teshuvotBookRow(idx, works: works)
                            }
                        } else {
                            ForEach(teshuvotCenturyGroups(works), id: \.century) { group in
                                Section {
                                    ForEach(group.workIndices, id: \.self) { idx in
                                        teshuvotBookRow(idx, works: works)
                                    }
                                } header: {
                                    Text(group.century)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(appFg.opacity(0.5))
                                        .textCase(nil)
                                }
                            }
                        }
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
                    case .tur:           return "book_\(vm.turSection)"
                    case .shulchanArukh: return "book_\(vm.saSection)"
                    case .midrash:
                        let works = MidrashWork.works(for: vm.midrashSubcategory)
                        let idx = works.firstIndex(of: vm.midrashWork) ?? 0
                        return "book_midrash_\(idx)"
                    case .teshuvot:
                        if vm.teshuvotSubcategory == .contemporary {
                            if vm.contemporaryUsesSefaria {
                                return "book_contemp_sefaria_\(vm.teshuvotWork.rawValue)"
                            }
                            return "book_contemp_\(vm.contemporaryWork.id)"
                        }
                        let works = TeshuvotWork.works(for: vm.teshuvotSubcategory)
                        let idx = works.firstIndex(of: vm.teshuvotWork) ?? 0
                        return "book_teshuvot_\(idx)"
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
