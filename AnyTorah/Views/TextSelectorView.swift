import SwiftUI

/// Multi-wheel selector shown before reading. Layout adapts to the selected category.
struct TextSelectorView: View {
    @Bindable var vm: TextReaderViewModel
    let appBg: Color
    let appFg: Color
    let onBack: (() -> Void)?   // nil when presented as a sheet or embedded in HomeCombinedView
    let onGo: () -> Void
    let showGear: Bool          // false when embedded in HomeCombinedView (gear lives in parent header)

    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false
    @State private var showSettings = false
    @State private var yomiLabel: String? = nil    // set after fetching today's schedule
    @State private var yomiLoading = false
    // Cached results so jumpToYomi() doesn't make a second network call
    @State private var cachedDaf: YomiService.DafYomiResult? = nil
    @State private var cachedMishnah: YomiService.MishnahYomiResult? = nil
    @State private var cachedRambam: YomiService.RambamYomiResult? = nil
    @State private var cachedTanakh: YomiService.TanakhYomiResult? = nil
    @State private var cachedParsha: YomiService.ParshaResult? = nil

    init(vm: TextReaderViewModel, appBg: Color, appFg: Color,
         onBack: (() -> Void)? = nil, onGo: @escaping () -> Void,
         showGear: Bool = true) {
        self.vm = vm
        self.appBg = appBg
        self.appFg = appFg
        self.onBack = onBack
        self.onGo = onGo
        self.showGear = showGear
    }

    private var hasHeader: Bool { onBack != nil || showGear }

    var body: some View {
        VStack(spacing: 0) {
            // Top row: ← Categories (left, standalone only) | gear (right, when not embedded)
            if hasHeader {
                HStack {
                    if let onBack {
                        Button(action: onBack) {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                Text("Categories")
                            }
                            .foregroundStyle(appFg)
                            .font(.subheadline)
                        }
                    }
                    Spacer()
                    if showGear {
                        Button { showSettings = true } label: {
                            Image(systemName: "gear")
                                .font(.title3)
                                .foregroundStyle(appFg.opacity(0.75))
                                .padding(4)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 10)

                // Breathing room between top row and category name
                Spacer().frame(height: onBack != nil ? 12 : 8)
            }

            // Row 2: Category name — hidden when embedded (card strip already shows selection)
            if hasHeader {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(vm.category.displayName)
                            .font(.title2.bold())
                            .foregroundStyle(appFg)
                        Text(vm.category.hebrewName)
                            .font(.subheadline)
                            .foregroundStyle(appFg.opacity(0.65))
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, onBack != nil ? 0 : 16)
                .padding(.bottom, [TextCategory.talmud, .mishnah, .rambam, .tanakh].contains(vm.category) ? 20 : 10)
            }

            // Yomi jump buttons
            if [TextCategory.talmud, .mishnah, .rambam].contains(vm.category) {
                yomiButton
                    .padding(.horizontal, 16)
                    .padding(.top, hasHeader ? 0 : 16)
                    .padding(.bottom, 20)
            } else if vm.category == .tanakh {
                HStack(spacing: 10) {
                    tanakhYomiButton
                    parshaButton
                }
                .padding(.horizontal, 16)
                .padding(.top, hasHeader ? 0 : 16)
                .padding(.bottom, 20)
            }

            if !hasHeader && vm.category == .shulchanArukh {
                Spacer().frame(height: 16)
            }

            Divider().background(appFg.opacity(0.7))
            Spacer().frame(height: 8)

            // Wheels
            // Subcategory toggles
            if vm.category == .mishnah {
                SubcategoryToggle(
                    options: MishnahSubcategory.allCases.map { $0.displayName },
                    selectedIndex: Binding(
                        get: { MishnahSubcategory.allCases.firstIndex(of: vm.mishnahSubcategory) ?? 0 },
                        set: { vm.mishnahSubcategory = MishnahSubcategory.allCases[$0] }
                    ),
                    fg: appFg
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            } else if vm.category == .talmud {
                SubcategoryToggle(
                    options: TalmudSubcategory.allCases.map { $0.displayName },
                    selectedIndex: Binding(
                        get: { TalmudSubcategory.allCases.firstIndex(of: vm.talmudSubcategory) ?? 0 },
                        set: { vm.talmudSubcategory = TalmudSubcategory.allCases[$0] }
                    ),
                    fg: appFg
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            } else if vm.category == .midrash {
                SubcategoryToggle(
                    options: MidrashSubcategory.allCases.map { $0.displayName },
                    selectedIndex: Binding(
                        get: { MidrashSubcategory.allCases.firstIndex(of: vm.midrashSubcategory) ?? 0 },
                        set: { vm.midrashSubcategory = MidrashSubcategory.allCases[$0] }
                    ),
                    fg: appFg
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }

            Group {
                switch vm.category {
                case .tanakh:        TanakhWheels(vm: vm, fg: appFg)
                case .mishnah:       MishnahWheels(vm: vm, fg: appFg)
                case .talmud:
                    if vm.talmudSubcategory == .yerushalmi {
                        YerushalmiWheels(vm: vm, fg: appFg, appBg: appBg)
                    } else {
                        TalmudWheels(vm: vm, fg: appFg, appBg: appBg)
                    }
                case .rambam:        RambamWheels(vm: vm, fg: appFg)
                case .shulchanArukh: SAWheels(vm: vm, fg: appFg)
                case .midrash:       MidrashWheels(vm: vm, fg: appFg)
                }
            }
            .frame(height: vm.category == .shulchanArukh ? 210 :
                          (vm.category == .midrash ? 200 : 160))

            Divider().background(appFg.opacity(0.7))

            // Go button
            Button(action: onGo) {
                Text(saHebrewMode
                     ? "פתח \(vm.navBookTitle) \(vm.navChapterTitle)"
                     : "Open \(vm.displayTitle)")
                    .font(.headline)
                    .foregroundStyle(appBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(appFg)
                    )
            }
            .padding()

            Spacer() // push all content to top
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(appBg.ignoresSafeArea())
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .task(id: vm.category) {
            // Reset all cached results so ensureCached() re-fetches for the new category
            cachedDaf = nil; cachedMishnah = nil; cachedRambam = nil
            cachedTanakh = nil; cachedParsha = nil
            await fetchYomi()
        }
    }

    // MARK: - Yomi button

    @ViewBuilder
    private var yomiButton: some View {
        let title: String = switch vm.category {
        case .talmud:  "Daf Yomi"
        case .mishnah: "Mishnah Yomi"
        case .rambam:  "Rambam Yomi"
        default:       ""
        }
        simpleYomiButton(label: title) { Task { await jumpToYomi() } }
    }

    @ViewBuilder
    private var tanakhYomiButton: some View {
        simpleYomiButton(label: "Today's 929") { Task { await jumpToTanakhYomi() } }
    }

    @ViewBuilder
    private var parshaButton: some View {
        let label = cachedParsha.map { "Parsha: \($0.name)" } ?? "Parsha"
        simpleYomiButton(label: label) { Task { await jumpToParsha() } }
    }

    private func simpleYomiButton(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(appFg.opacity(0.85))
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(appFg.opacity(0.3), lineWidth: 0.5)
                        .background(RoundedRectangle(cornerRadius: 8).fill(appFg.opacity(0.08)))
                )
        }
        .buttonStyle(.plain)
    }

    private func fetchYomi() async {
        guard [TextCategory.talmud, .mishnah, .rambam, .tanakh].contains(vm.category) else { return }
        yomiLoading = true
        yomiLabel = nil
        let (daf, mishnah, rambam, tanakh, parsha) = await YomiService.fetchToday()
        cachedDaf     = daf
        cachedMishnah = mishnah
        cachedRambam  = rambam
        cachedTanakh  = tanakh
        cachedParsha  = parsha
        switch vm.category {
        case .talmud:  yomiLabel = daf?.displayLabel
        case .mishnah: yomiLabel = mishnah?.displayLabel
        case .rambam:  yomiLabel = rambam?.displayLabel
        case .tanakh:  break   // Tanakh shows two separate buttons; no single yomiLabel needed
        default: break
        }
        yomiLoading = false
    }

    /// Ensures all cached yomi results are populated, fetching if needed.
    private func ensureCached() async {
        guard cachedDaf == nil && cachedMishnah == nil && cachedRambam == nil
                && cachedTanakh == nil && cachedParsha == nil
        else { return }
        let r = await YomiService.fetchToday()
        cachedDaf = r.daf; cachedMishnah = r.mishnah; cachedRambam = r.rambam
        cachedTanakh = r.tanakh; cachedParsha = r.parsha
    }

    private func jumpToYomi() async {
        await ensureCached()
        switch vm.category {
        case .talmud:
            guard let d = cachedDaf else { return }
            vm.talmudSederIndex            = d.sederIndex
            vm.talmudTractateIndexInSeder  = d.tractateIndexInSeder
            vm.talmudDaf                   = d.daf
        case .mishnah:
            guard let m = cachedMishnah else { return }
            vm.mishnahSederIndex            = m.sederIndex
            vm.mishnahTractateIndexInSeder  = m.tractateIndexInSeder
            vm.mishnahChapter               = m.chapter
        case .rambam:
            guard let r = cachedRambam else { return }
            vm.rambamSeferIndex       = r.seferIndex
            vm.rambamWorkIndexInSefer = r.workIndexInSefer
            vm.rambamChapter          = r.chapter
        default: break
        }
    }

    private func jumpToTanakhYomi() async {
        await ensureCached()
        guard let t = cachedTanakh else { return }
        vm.tanakhBookIndex      = t.bookIndex
        vm.tanakhChapter        = t.chapter
        vm.tanakhScrollToVerse  = nil   // 929 is a full chapter, no specific start verse
    }

    private func jumpToParsha() async {
        await ensureCached()
        guard let p = cachedParsha else { return }
        vm.tanakhBookIndex     = p.bookIndex
        vm.tanakhChapter       = p.chapter
        vm.tanakhScrollToVerse = p.verse   // scroll to opening verse when text loads
    }
}

// MARK: - Tanakh Wheels

private struct TanakhWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color

    @State private var sectionIndex: Int = 0
    @State private var bookInSection: Int = 0
    @AppStorage("saHebrewMode") private var hebrewMode: Bool = false

    private let sections = TextCatalog.tanakhSections
    private var currentSection: TanakhSection { sections[sectionIndex] }
    private var chapterCount: Int {
        guard vm.tanakhBookIndex < TextCatalog.allTanakhBooks.count else { return 1 }
        return TextCatalog.allTanakhBooks[vm.tanakhBookIndex].chapters
    }

    @ViewBuilder
    private func sectionColumn() -> some View {
        WheelColumn(fg: fg, label: hebrewMode ? "חלק" : "Section") {
            Picker("", selection: Binding(
                get: { sectionIndex },
                set: { newVal in
                    sectionIndex = newVal
                    bookInSection = 0
                    vm.tanakhChapter = 1
                    syncBookIndex()
                }
            )) {
                ForEach(sections.indices, id: \.self) { i in
                    Text(hebrewMode ? sections[i].hebrewName.strippingNikud : sections[i].name)
                        .foregroundStyle(i == sectionIndex ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    @ViewBuilder
    private func bookColumn() -> some View {
        let snap = currentSection
        WheelColumn(fg: fg, label: hebrewMode ? "ספר" : "Book") {
            Picker("", selection: Binding(
                get: { bookInSection },
                set: { newVal in
                    bookInSection = newVal
                    vm.tanakhChapter = 1
                    syncBookIndex()
                }
            )) {
                ForEach(snap.books.indices, id: \.self) { i in
                    Text(hebrewMode ? snap.books[i].hebrewName.strippingNikud : snap.books[i].name)
                        .foregroundStyle(i == bookInSection ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
            .id(sectionIndex)
        }
    }

    @ViewBuilder
    private func chapterColumn() -> some View {
        let safeMax = max(1, chapterCount)
        let selCh   = min(max(1, vm.tanakhChapter), safeMax)
        WheelColumn(fg: fg, label: hebrewMode ? "פרק" : "Chapter") {
            Picker("", selection: Binding(
                get: { selCh },
                set: { vm.tanakhChapter = $0 }
            )) {
                ForEach(1...safeMax, id: \.self) { ch in
                    Text(hebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)")
                        .foregroundStyle(ch == selCh ? fg : fg.opacity(0.35))
                        .tag(ch)
                }
            }
            .pickerStyle(.wheel)
            .id(vm.tanakhBookIndex)
        }
    }

    var body: some View {
        Group {
            if hebrewMode {
                // RTL: Chapter (left) | Book | Section (right)
                HStack(spacing: 0) {
                    chapterColumn()
                    bookColumn()
                    sectionColumn()
                }
            } else {
                // LTR: Section (left) | Book | Chapter (right)
                HStack(spacing: 0) {
                    sectionColumn()
                    bookColumn()
                    chapterColumn()
                }
            }
        }
        .onAppear { restoreState() }
        .onChange(of: vm.tanakhBookIndex) { _, _ in restoreState() }
    }

    private func syncBookIndex() {
        guard bookInSection < currentSection.books.count else { return }
        vm.tanakhBookIndex = currentSection.books[bookInSection].id
    }

    private func restoreState() {
        let globalIdx = vm.tanakhBookIndex
        for (si, section) in sections.enumerated() {
            if let bi = section.books.firstIndex(where: { $0.id == globalIdx }) {
                sectionIndex = si
                bookInSection = bi
                return
            }
        }
    }
}

// MARK: - Mishnah Wheels

private struct MishnahWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color

    @State private var globalTractateIdx: Int = 0
    @State private var sederIdx: Int = 0
    @AppStorage("saHebrewMode") private var hebrewMode: Bool = false

    private var sedarim: [MishnahSeder] { TextCatalog.mishnahSedarim }
    private var allTractates: [MishnahTractate] { TextCatalog.allMishnahTractates }
    private var chapterCount: Int {
        guard globalTractateIdx < allTractates.count else { return 1 }
        let t = allTractates[globalTractateIdx]
        if vm.mishnahSubcategory == .tosefta {
            return max(1, t.toseftaChapters)
        }
        return t.chapters
    }
    private var currentChapter: Int {
        vm.mishnahSubcategory == .tosefta ? vm.toseftaChapter : vm.mishnahChapter
    }

    private func globalIdx(seder: Int, tractate: Int) -> Int {
        var offset = 0
        for si in 0..<min(seder, sedarim.count) { offset += sedarim[si].tractates.count }
        return offset + tractate
    }

    private func decompose(_ global: Int) -> (seder: Int, tractate: Int) {
        var remaining = global
        for (si, seder) in sedarim.enumerated() {
            if remaining < seder.tractates.count { return (si, remaining) }
            remaining -= seder.tractates.count
        }
        return (0, 0)
    }

    @ViewBuilder
    private func sederColumn() -> some View {
        WheelColumn(fg: fg, label: hebrewMode ? "סדר" : "Seder") {
            Picker("", selection: Binding(
                get: { sederIdx },
                set: { newIdx in
                    sederIdx = newIdx
                    vm.mishnahSederIndex = newIdx
                    vm.mishnahTractateIndexInSeder = 0
                    vm.mishnahChapter = 1
                    globalTractateIdx = globalIdx(seder: newIdx, tractate: 0)
                }
            )) {
                ForEach(sedarim.indices, id: \.self) { i in
                    Text(hebrewMode ? sedarim[i].hebrewName.strippingNikud : sedarim[i].name)
                        .foregroundStyle(i == sederIdx ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    @ViewBuilder
    private func tractateColumn() -> some View {
        WheelColumn(fg: fg, label: hebrewMode ? "מסכת" : "Tractate", fontSizeBoost: 4) {
            Picker("", selection: Binding(
                get: { globalTractateIdx },
                set: { newGlobal in
                    globalTractateIdx = newGlobal
                    let (s, t) = decompose(newGlobal)
                    sederIdx = s
                    vm.mishnahSederIndex = s
                    vm.mishnahTractateIndexInSeder = t
                    vm.mishnahChapter = 1
                }
            )) {
                ForEach(allTractates.indices, id: \.self) { i in
                    Text(hebrewMode ? allTractates[i].hebrewName.strippingNikud : allTractates[i].name)
                        .foregroundStyle(i == globalTractateIdx ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    @ViewBuilder
    private func chapterColumn() -> some View {
        let safeMax = max(1, chapterCount)
        let selCh   = min(max(1, currentChapter), safeMax)
        WheelColumn(fg: fg, label: hebrewMode ? "פרק" : "Chapter") {
            Picker("", selection: Binding(
                get: { selCh },
                set: {
                    if vm.mishnahSubcategory == .tosefta { vm.toseftaChapter = $0 }
                    else { vm.mishnahChapter = $0 }
                }
            )) {
                ForEach(1...safeMax, id: \.self) { ch in
                    Text(hebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)")
                        .foregroundStyle(ch == selCh ? fg : fg.opacity(0.35))
                        .tag(ch)
                }
            }
            .pickerStyle(.wheel)
            .id("\(globalTractateIdx)-\(vm.mishnahSubcategory.rawValue)")
        }
    }

    var body: some View {
        Group {
            if hebrewMode {
                // RTL: Chapter (left) | Tractate | Seder (right)
                HStack(spacing: 0) {
                    chapterColumn()
                    tractateColumn()
                    sederColumn()
                }
            } else {
                // LTR: Seder (left) | Tractate | Chapter (right)
                HStack(spacing: 0) {
                    sederColumn()
                    tractateColumn()
                    chapterColumn()
                }
            }
        }
        .onAppear {
            sederIdx = vm.mishnahSederIndex
            globalTractateIdx = globalIdx(seder: vm.mishnahSederIndex,
                                          tractate: vm.mishnahTractateIndexInSeder)
        }
        .onChange(of: vm.mishnahSederIndex) { _, newVal in
            if sederIdx != newVal { sederIdx = newVal }
            let newGlobal = globalIdx(seder: vm.mishnahSederIndex,
                                      tractate: vm.mishnahTractateIndexInSeder)
            if globalTractateIdx != newGlobal { globalTractateIdx = newGlobal }
        }
        .onChange(of: vm.mishnahTractateIndexInSeder) { _, _ in
            let newGlobal = globalIdx(seder: vm.mishnahSederIndex,
                                      tractate: vm.mishnahTractateIndexInSeder)
            if globalTractateIdx != newGlobal { globalTractateIdx = newGlobal }
        }
    }
}

// MARK: - Talmud Wheels

private struct TalmudWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color
    let appBg: Color

    @State private var globalTractateIdx: Int = 0
    @State private var sederIdx: Int = 0
    @AppStorage("saHebrewMode") private var hebrewMode: Bool = false

    private var sedarim: [TalmudSeder] { TextCatalog.talmudSedarim }
    private var allTractates: [TalmudTractate] { TextCatalog.allTalmudTractates }
    private var dafRange: ClosedRange<Int> {
        guard vm.talmudSederIndex < sedarim.count else { return 2...2 }
        let vmTractates = sedarim[vm.talmudSederIndex].tractates
        guard vm.talmudTractateIndexInSeder < vmTractates.count else { return 2...2 }
        let t = vmTractates[vm.talmudTractateIndexInSeder]
        return t.startDaf...t.endDaf
    }

    private func globalIdx(seder: Int, tractate: Int) -> Int {
        var offset = 0
        for si in 0..<min(seder, sedarim.count) { offset += sedarim[si].tractates.count }
        return offset + tractate
    }

    private func decompose(_ global: Int) -> (seder: Int, tractate: Int) {
        var remaining = global
        for (si, seder) in sedarim.enumerated() {
            if remaining < seder.tractates.count { return (si, remaining) }
            remaining -= seder.tractates.count
        }
        return (0, 0)
    }

    @AppStorage("useWhiteBackground") private var useWhiteBackground: Bool = false

    /// Flat wheel items: tractates interleaved with separator sentinels (negative tags) between sedarim.
    private var tractateWheelItems: [(tag: Int, label: String)] {
        var items: [(tag: Int, label: String)] = []
        var offset = 0
        for (si, seder) in sedarim.enumerated() {
            if si > 0 {
                items.append((tag: -(si), label: ""))   // separator between sedarim
            }
            for tractate in seder.tractates {
                let label = hebrewMode ? tractate.hebrewName.strippingNikud : tractate.name
                items.append((tag: offset, label: label))
                offset += 1
            }
        }
        return items
    }

    /// Tractate wheel — fixed width so daf and amud columns fit on the same row.
    /// Faint separator rows mark seder boundaries.
    @ViewBuilder
    private func tractateColumn() -> some View {
        let items = tractateWheelItems
        WheelColumn(fg: fg, label: "", fixedWidth: 195, fontSizeBoost: 4) {
            Picker("", selection: Binding(
                get: { globalTractateIdx },
                set: { newGlobal in
                    guard newGlobal >= 0 else { return }   // ignore separator taps
                    globalTractateIdx = newGlobal
                    let (s, t) = decompose(newGlobal)
                    sederIdx = s
                    vm.talmudSederIndex = s
                    vm.talmudTractateIndexInSeder = t
                }
            )) {
                ForEach(items, id: \.tag) { item in
                    if item.tag < 0 {
                        Text("────────")
                            .font(.system(size: 6))
                            .foregroundStyle(fg.opacity(0.2))
                            .tag(item.tag)
                    } else {
                        Text(item.label)
                            .foregroundStyle(item.tag == globalTractateIdx ? fg : fg.opacity(0.35))
                            .font(.system(size: item.tag == globalTractateIdx ? 23 : 18,
                                          weight: item.tag == globalTractateIdx ? .semibold : .regular))
                            .tag(item.tag)
                    }
                }
            }
            .pickerStyle(.wheel)
        }
    }

    /// Daf number wheel — narrow fixed-width column.
    @ViewBuilder
    private func dafColumn() -> some View {
        let start  = dafRange.lowerBound
        let end    = max(dafRange.lowerBound, dafRange.upperBound)
        let selDaf = dafRange.contains(vm.talmudDaf) ? vm.talmudDaf : dafRange.lowerBound
        WheelColumn(fg: fg, label: "", fixedWidth: 68) {
            Picker("", selection: Binding(
                get: { selDaf },
                set: { vm.talmudDaf = $0 }
            )) {
                ForEach(start...end, id: \.self) { daf in
                    Text(hebrewMode ? SASimanNames.toHebrewNumeral(daf) : "\(daf)")
                        .foregroundStyle(daf == selDaf ? fg : fg.opacity(0.35))
                        .font(.system(size: daf == selDaf ? 21 : 16, weight: daf == selDaf ? .semibold : .regular))
                        .tag(daf)
                }
            }
            .pickerStyle(.wheel)
            .id(globalTractateIdx)
            .onChange(of: vm.talmudTractateIndexInSeder) { _, _ in
                if vm.talmudDaf < dafRange.lowerBound || vm.talmudDaf > dafRange.upperBound {
                    vm.talmudDaf = dafRange.lowerBound
                }
            }
            .onChange(of: sederIdx) { _, _ in
                if vm.talmudDaf < dafRange.lowerBound || vm.talmudDaf > dafRange.upperBound {
                    vm.talmudDaf = dafRange.lowerBound
                }
            }
        }
    }

    /// Amud (a/b) toggle pills — side-by-side, vertically centered alongside the wheels.
    @ViewBuilder
    private func amudColumn() -> some View {
        VStack {
            Spacer()
            HStack(spacing: 5) {
                // Hebrew RTL: ב on left, א on right; English LTR: a on left, b on right
                ForEach(hebrewMode ? [1, 0] : [0, 1], id: \.self) { amud in
                    let lbl = hebrewMode
                        ? (amud == 0 ? "א" : "ב")
                        : (amud == 0 ? "a" : "b")
                    Button { vm.talmudAmud = amud } label: {
                        Text(lbl)
                            .font(.caption.bold())
                            .foregroundStyle(vm.talmudAmud == amud ? appBg : fg)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(
                                vm.talmudAmud == amud ? fg : fg.opacity(0.15)))
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer()
        }
        .frame(width: 68)
    }

    var body: some View {
        Group {
            if hebrewMode {
                // RTL: amud | daf | Tractate (right)
                HStack(alignment: .center, spacing: 4) {
                    amudColumn()
                    dafColumn()
                    tractateColumn()
                }
            } else {
                // LTR: Tractate | daf | amud (right)
                HStack(alignment: .center, spacing: 4) {
                    tractateColumn()
                    dafColumn()
                    amudColumn()
                }
            }
        }
        .onAppear {
            sederIdx = vm.talmudSederIndex
            globalTractateIdx = globalIdx(seder: vm.talmudSederIndex,
                                          tractate: vm.talmudTractateIndexInSeder)
        }
        .onChange(of: vm.talmudSederIndex) { _, newVal in
            if sederIdx != newVal { sederIdx = newVal }
            let newGlobal = globalIdx(seder: vm.talmudSederIndex,
                                      tractate: vm.talmudTractateIndexInSeder)
            if globalTractateIdx != newGlobal { globalTractateIdx = newGlobal }
        }
        .onChange(of: vm.talmudTractateIndexInSeder) { _, _ in
            let newGlobal = globalIdx(seder: vm.talmudSederIndex,
                                      tractate: vm.talmudTractateIndexInSeder)
            if globalTractateIdx != newGlobal { globalTractateIdx = newGlobal }
        }
    }
}

// MARK: - Yerushalmi Wheels

private struct YerushalmiWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color
    let appBg: Color

    @AppStorage("saHebrewMode") private var hebrewMode: Bool = false
    /// Actual halakha count for the selected chapter, loaded dynamically from Sefaria shape API.
    @State private var halakhaCount: Int = 7

    private var allTractates: [MishnahTractate] { vm.allYerushalmiTractates }
    private var chapterCount: Int {
        guard let t = vm.currentYerushalmiTractate else { return 1 }
        return max(1, t.yerushalmiChapters)
    }

    @ViewBuilder
    private func tractateColumn() -> some View {
        let tractates = allTractates
        let globalIdx = vm.yerushalmiGlobalTractateIndex
        WheelColumn(fg: fg, label: hebrewMode ? "מסכת" : "Tractate", fontSizeBoost: 4) {
            Picker("", selection: Binding(
                get: { globalIdx },
                set: { newIdx in
                    vm.setYerushalmiGlobalTractate(newIdx)
                }
            )) {
                ForEach(tractates.indices, id: \.self) { i in
                    Text(hebrewMode ? tractates[i].hebrewName.strippingNikud : tractates[i].name)
                        .foregroundStyle(i == globalIdx ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    @ViewBuilder
    private func chapterColumn() -> some View {
        let safeMax = max(1, chapterCount)
        let selCh   = min(max(1, vm.yerushalmiChapter), safeMax)
        WheelColumn(fg: fg, label: hebrewMode ? "פרק" : "Chapter") {
            Picker("", selection: Binding(
                get: { selCh },
                set: {
                    vm.yerushalmiChapter = $0
                    vm.yerushalmiHalakha = 1
                }
            )) {
                ForEach(1...safeMax, id: \.self) { ch in
                    Text(hebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)")
                        .foregroundStyle(ch == selCh ? fg : fg.opacity(0.35))
                        .tag(ch)
                }
            }
            .pickerStyle(.wheel)
            .id(vm.yerushalmiGlobalTractateIndex)
        }
    }

    @ViewBuilder
    private func halakhaColumn() -> some View {
        // Clamp current selection within actual halakha count
        let maxH  = max(1, halakhaCount)
        let selH  = min(max(1, vm.yerushalmiHalakha), maxH)
        WheelColumn(fg: fg, label: hebrewMode ? "הלכה" : "Halakha") {
            Picker("", selection: Binding(
                get: { selH },
                set: { vm.yerushalmiHalakha = $0 }
            )) {
                ForEach(1...maxH, id: \.self) { h in
                    Text(hebrewMode ? SASimanNames.toHebrewNumeral(h) : "\(h)")
                        .foregroundStyle(h == selH ? fg : fg.opacity(0.35))
                        .tag(h)
                }
            }
            .pickerStyle(.wheel)
            .id("\(vm.yerushalmiGlobalTractateIndex)-\(vm.yerushalmiChapter)-\(halakhaCount)")
        }
    }

    var body: some View {
        Group {
            if hebrewMode {
                // RTL: Halakha (left) | Chapter | Tractate (right)
                HStack(spacing: 0) {
                    halakhaColumn()
                    chapterColumn()
                    tractateColumn()
                }
            } else {
                // LTR: Tractate | Chapter | Halakha (right)
                HStack(spacing: 0) {
                    tractateColumn()
                    chapterColumn()
                    halakhaColumn()
                }
            }
        }
        // Fetch the correct halakha count whenever tractate or chapter changes.
        // Uses Sefaria's shape API; URLSession caches results so repeat requests are instant.
        .task(id: "\(vm.yerushalmiGlobalTractateIndex)-\(vm.yerushalmiChapter)") {
            guard let tractate = vm.currentYerushalmiTractate else { return }
            let count = await SefariaTextClient.shared.fetchYerushalmiHalakhaCount(
                tractate: tractate, chapter: vm.yerushalmiChapter)
            halakhaCount = count
            // If current selection is out of range, snap back to last valid halakha
            if vm.yerushalmiHalakha > count { vm.yerushalmiHalakha = count }
        }
    }
}

// MARK: - Subcategory Toggle

private struct SubcategoryToggle: View {
    let options: [String]
    @Binding var selectedIndex: Int
    let fg: Color

    var body: some View {
        Picker("", selection: $selectedIndex) {
            ForEach(options.indices, id: \.self) { i in
                Text(options[i]).tag(i)
            }
        }
        .pickerStyle(.segmented)
    }
}

// MARK: - Rambam Wheels

private struct RambamWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color

    @State private var seferIdx: Int = 0
    @AppStorage("saHebrewMode") private var hebrewMode: Bool = false

    private var sefarim: [RambamSefer] { TextCatalog.rambamSefarim }
    private var works: [RambamWork] {
        guard seferIdx < sefarim.count else { return [] }
        return sefarim[seferIdx].works
    }
    private var chapterCount: Int {
        guard vm.rambamWorkIndexInSefer < works.count else { return 1 }
        return works[vm.rambamWorkIndexInSefer].chapters
    }

    @ViewBuilder
    private func seferColumn() -> some View {
        WheelColumn(fg: fg, label: hebrewMode ? "ספר" : "Sefer") {
            Picker("", selection: Binding(
                get: { seferIdx },
                set: { newIdx in
                    seferIdx = newIdx
                    vm.rambamSeferIndex = newIdx
                    vm.rambamWorkIndexInSefer = 0
                    // rambamWorkIndexInSefer.didSet will set chapter to 0 or 1 based on intro availability
                }
            )) {
                ForEach(sefarim.indices, id: \.self) { i in
                    Text(hebrewMode ? sefarim[i].hebrewName.strippingNikud.strippingSeferPrefix : sefarim[i].name)
                        .foregroundStyle(i == seferIdx ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    @ViewBuilder
    private func hilkhotColumn() -> some View {
        WheelColumn(fg: fg, label: hebrewMode ? "הלכות" : "Hilkhot") {
            Picker("", selection: $vm.rambamWorkIndexInSefer) {
                ForEach(works.indices, id: \.self) { i in
                    Text(hebrewMode ? works[i].hebrewName.strippingNikud : works[i].name)
                        .foregroundStyle(i == vm.rambamWorkIndexInSefer ? fg : fg.opacity(0.35))
                        .tag(i)
                }
            }
            .pickerStyle(.wheel)
            .id(seferIdx)
            .onChange(of: seferIdx) { _, _ in
                if vm.rambamWorkIndexInSefer >= works.count {
                    vm.rambamWorkIndexInSefer = 0
                }
            }
        }
    }

    @ViewBuilder
    private func chapterColumn() -> some View {
        let safeMax = max(1, chapterCount)
        let hasIntro = vm.rambamHasIntro
        // Clamp to valid range: 0 if intro allowed, else 1–safeMax
        let selCh: Int = {
            if vm.rambamChapter == 0 { return hasIntro ? 0 : 1 }
            return min(max(1, vm.rambamChapter), safeMax)
        }()
        WheelColumn(fg: fg, label: hebrewMode ? "פרק" : "Chapter") {
            Picker("", selection: Binding(
                get: { selCh },
                set: { vm.rambamChapter = $0 }
            )) {
                if hasIntro {
                    Text(hebrewMode ? "הקדמה" : "Intro")
                        .foregroundStyle(selCh == 0 ? fg : fg.opacity(0.35))
                        .tag(0)
                }
                ForEach(1...safeMax, id: \.self) { ch in
                    Text(hebrewMode ? SASimanNames.toHebrewNumeral(ch) : "\(ch)")
                        .foregroundStyle(ch == selCh ? fg : fg.opacity(0.35))
                        .tag(ch)
                }
            }
            .pickerStyle(.wheel)
            .id("\(seferIdx)-\(vm.rambamWorkIndexInSefer)")
        }
    }

    var body: some View {
        Group {
            if hebrewMode {
                // RTL: Chapter (left) | Hilkhot | Sefer (right)
                HStack(spacing: 0) {
                    chapterColumn()
                    hilkhotColumn()
                    seferColumn()
                }
            } else {
                // LTR: Sefer (left) | Hilkhot | Chapter (right)
                HStack(spacing: 0) {
                    seferColumn()
                    hilkhotColumn()
                    chapterColumn()
                }
            }
        }
        .onAppear { seferIdx = vm.rambamSeferIndex }
        .onChange(of: vm.rambamSeferIndex) { _, newVal in
            if seferIdx != newVal { seferIdx = newVal }
        }
    }
}

// MARK: - Shulkhan Arukh Wheels

private struct SAWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color

    @State private var topicSectionIdx: Int = 0
    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false

    private var saBooks: [ShulchanArukh_Section] { TextCatalog.shulchanArukhSections }

    private var topicSections: [SATopicSection] {
        switch vm.saSection {
        case 0: return SASimanNames.sectionsOH
        case 1: return SASimanNames.sectionsYD
        case 2: return SASimanNames.sectionsEH
        case 3: return SASimanNames.sectionsHM
        default: return SASimanNames.sectionsOH
        }
    }

    private var simanStart: Int { topicSections.indices.contains(topicSectionIdx) ? topicSections[topicSectionIdx].start : 1 }
    private var simanEnd:   Int { topicSections.indices.contains(topicSectionIdx) ? topicSections[topicSectionIdx].end   : (saBooks.indices.contains(vm.saSection) ? saBooks[vm.saSection].simanim : 1) }

    // The section picker — shared by both modes, direction-agnostic.
    // Captures `sections` as a local snapshot so the ForEach range and the
    // subscript inside the body closure always refer to the same array, even
    // if vm.saSection changes mid-render and topicSections would return a
    // different (shorter) array.
    @ViewBuilder
    private func sectionPicker(label: String) -> some View {
        let sections = topicSections   // ← snapshot; avoids out-of-bounds crash on book change
        WheelColumn(fg: fg, label: label) {
            Picker("", selection: $topicSectionIdx) {
                ForEach(sections.indices, id: \.self) { i in
                    if saHebrewMode {
                        Text((SASimanNames.sectionHebName(bookIndex: vm.saSection, sectionIdx: i)
                             ?? sections[i].name).strippingNikud)
                            .foregroundStyle(i == topicSectionIdx ? fg : fg.opacity(0.35))
                            .tag(i)
                    } else {
                        let raw = sections[i].name
                        let display = raw.hasPrefix("Laws of ") ? String(raw.dropFirst(8)) : raw
                        Text(display)
                            .foregroundStyle(i == topicSectionIdx ? fg : fg.opacity(0.35))
                            .tag(i)
                    }
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 110)
            .id(vm.saSection)
            .onChange(of: topicSectionIdx) { _, newVal in
                guard sections.indices.contains(newVal) else { return }
                vm.saSiman = sections[newVal].start
            }
        }
    }

    // The siman picker — content differs by mode.
    // Snapshot simanStart/simanEnd so the ForEach range stays stable during the render pass.
    @ViewBuilder
    private func simanPicker(label: String) -> some View {
        let start = simanStart
        let end   = max(simanStart, simanEnd)
        WheelColumn(fg: fg, label: label) {
            Picker("", selection: $vm.saSiman) {
                ForEach(start...end, id: \.self) { s in
                    if saHebrewMode {
                        let h = SASimanNames.toHebrewNumeral(s)
                        let name = SASimanNames.simanName(bookIndex: vm.saSection, siman: s)
                        Text(name.map { "\(h) – \($0)" } ?? h)
                            .foregroundStyle(s == vm.saSiman ? fg : fg.opacity(0.35))
                            .tag(s)
                            .font(.system(size: 14))
                            .lineLimit(1)
                    } else {
                        let enName = SASimanNames.simanNameEn(bookIndex: vm.saSection, siman: s)
                        Text(enName.map { "\(s) – \($0)" } ?? "\(s)")
                            .foregroundStyle(s == vm.saSiman ? fg : fg.opacity(0.35))
                            .tag(s)
                            .font(.system(size: 13))
                            .lineLimit(1)
                    }
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 110)
            .id("\(vm.saSection)-\(topicSectionIdx)-\(saHebrewMode)")
        }
    }

    // Hebrew names for the four SA books
    private let saBookHebNames = ["אורח חיים", "יורה דעה", "אבן העזר", "חושן משפט"]

    var body: some View {
        VStack(spacing: 0) {
            // ── Book picker ──
            // In Hebrew mode, iterate reversed so OH appears on the far right
            Picker("Book", selection: $vm.saSection) {
                ForEach(saHebrewMode ? Array(saBooks.indices.reversed()) : Array(saBooks.indices), id: \.self) { i in
                    Text(saHebrewMode
                         ? (saBookHebNames[safe: i] ?? saBooks[i].name)
                         : saBooks[i].name)
                        .tag(i)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 10)
            .onChange(of: vm.saSection) { _, _ in
                topicSectionIdx = 0
                vm.saSiman = 1
            }

            Spacer().frame(height: 12)   // breathing room before column labels

            // ── Section + Siman wheels ──
            // Hebrew RTL: Siman on LEFT, Section on RIGHT (RTL reading order)
            // English LTR: Section on LEFT, Siman on RIGHT
            if saHebrewMode {
                HStack(spacing: 0) {
                    simanPicker(label: "סימן")
                    sectionPicker(label: "נושא")
                }
            } else {
                HStack(spacing: 0) {
                    sectionPicker(label: "Section")
                    simanPicker(label: "Siman")
                }
            }
        }
        .onAppear {
            topicSectionIdx = topicSections.firstIndex(where: {
                vm.saSiman >= $0.start && vm.saSiman <= $0.end
            }) ?? 0
        }
    }
}

// MARK: - Midrash

private struct MidrashWheels: View {
    @Bindable var vm: TextReaderViewModel
    let fg: Color

    private var availableWorks: [MidrashWork] {
        MidrashWork.works(for: vm.midrashSubcategory)
    }

    private var currentWorkIdx: Int {
        availableWorks.firstIndex(of: vm.midrashWork) ?? 0
    }

    private var availableBooks: [TanakhBook] {
        let ids = vm.midrashWork.applicableBookIndices
        return TextCatalog.allTanakhBooks.filter { ids.contains($0.id) }
    }

    private var currentBookLocalIdx: Int {
        availableBooks.firstIndex(where: { $0.id == vm.midrashBookIndex }) ?? 0
    }

    private var chapterCount: Int {
        availableBooks.first(where: { $0.id == vm.midrashBookIndex })?.chapters ?? 1
    }

    private var verseCount: Int {
        torahVerseCount(bookIndex: vm.midrashBookIndex, chapter: vm.midrashChapter)
    }

    var body: some View {
        VStack(spacing: 8) {
            // Mode toggle
            Picker("Nav Mode", selection: $vm.midrashNavigationMode) {
                Text("By Verse").tag(MidrashNavigationMode.byVerse)
                Text("Native").tag(MidrashNavigationMode.native)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .onChange(of: vm.midrashNavigationMode) { _, _ in
                vm.midrashNativeChapter = 1
                vm.midrashNativeSection = 1
            }

            HStack(spacing: 0) {
                // Work picker is always visible
                WheelColumn(fg: fg, label: "Work") {
                    Picker("Work", selection: Binding(
                        get: { currentWorkIdx },
                        set: { vm.midrashWork = availableWorks[$0] }
                    )) {
                        ForEach(Array(availableWorks.enumerated()), id: \.offset) { i, work in
                            Text(work.displayName).tag(i)
                        }
                    }
                    .pickerStyle(.wheel)
                }

                if vm.midrashNavigationMode == .native {
                    nativeWheels
                } else {
                    byVerseWheels
                }
            }
        }
    }

    @ViewBuilder
    private var byVerseWheels: some View {
        if availableBooks.count > 1 {
            WheelColumn(fg: fg, label: "Book") {
                Picker("Book", selection: Binding(
                    get: { currentBookLocalIdx },
                    set: { vm.midrashBookIndex = availableBooks[$0].id }
                )) {
                    ForEach(Array(availableBooks.enumerated()), id: \.offset) { i, book in
                        Text(book.name).tag(i)
                    }
                }
                .pickerStyle(.wheel)
            }
        }

        WheelColumn(fg: fg, label: "Ch") {
            Picker("Ch", selection: $vm.midrashChapter) {
                ForEach(1...max(1, chapterCount), id: \.self) { ch in
                    Text("\(ch)").tag(ch)
                }
            }
            .pickerStyle(.wheel)
        }

        WheelColumn(fg: fg, label: "Vs") {
            Picker("Vs", selection: $vm.midrashVerse) {
                ForEach(1...max(1, verseCount), id: \.self) { vs in
                    Text("\(vs)").tag(vs)
                }
            }
            .pickerStyle(.wheel)
        }
    }

    @ViewBuilder
    private var nativeWheels: some View {
        let chapLabels = vm.midrashWork.nativeChapterLabels
        let chapLabel  = vm.midrashWork.nativeChapterLabel

        WheelColumn(fg: fg, label: chapLabel) {
            Picker(chapLabel, selection: $vm.midrashNativeChapter) {
                ForEach(Array(chapLabels.enumerated()), id: \.offset) { i, name in
                    Text(name).tag(i + 1)
                }
            }
            .pickerStyle(.wheel)
            .onChange(of: vm.midrashWork) { _, _ in vm.midrashNativeChapter = 1; vm.midrashNativeSection = 1 }
        }

        if !vm.midrashWork.nativeIsOneLevel {
            WheelColumn(fg: fg, label: "Section") {
                Picker("Section", selection: $vm.midrashNativeSection) {
                    // Show 1–50 sections; actual max varies per chapter and we don't have
                    // a static table — navigating past the end shows a "no text" error.
                    ForEach(1...50, id: \.self) { sec in
                        Text("\(sec)").tag(sec)
                    }
                }
                .pickerStyle(.wheel)
            }
        }
    }
}

// MARK: - Shared WheelColumn wrapper

private struct WheelColumn<Content: View>: View {
    let fg: Color
    let label: String
    /// If set, the column has a fixed width instead of expanding to fill.
    var fixedWidth: CGFloat? = nil
    /// Extra points added to the default picker font size (positive = larger).
    var fontSizeBoost: CGFloat = 0
    @ViewBuilder let content: () -> Content

    @AppStorage("anyTorahFontSize") private var fontSizeLevel: Double = 0
    @AppStorage("useWhiteBackground") private var useWhiteBackground: Bool = false

    /// Picker item font size: base ~17 pt (body) ± 2 pt per level step.
    private var scaledPickerSize: CGFloat {
        max(13, 17 + CGFloat(fontSizeLevel) * 2 + fontSizeBoost)
    }

    // Label chip: contrasting light/dark background so it reads as a distinct badge.
    private var labelBg: Color {
        useWhiteBackground ? Color(.systemGray5) : fg.opacity(0.88)
    }
    private var labelFg: Color {
        useWhiteBackground ? Color(.label) : ContentView.appBg
    }

    var body: some View {
        VStack(spacing: 4) {
            if !label.isEmpty {
                Text(label)
                    .font(.caption2.bold())
                    .foregroundStyle(labelFg)
                    .textCase(.uppercase)
                    .kerning(0.5)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(RoundedRectangle(cornerRadius: 5).fill(labelBg))
            }
            content()
                .foregroundStyle(fg.opacity(0.35))  // base dim; individual items override for selected
                .font(.system(size: scaledPickerSize))
                .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: fixedWidth ?? .infinity)
    }
}

// MARK: - Helpers

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

