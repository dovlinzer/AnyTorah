import Foundation
import SwiftUI
import Observation

@MainActor
@Observable
final class TextReaderViewModel {

    // MARK: - Selection state

    var category: TextCategory = .talmud {
        didSet { UserDefaults.standard.set(category.rawValue, forKey: "lastCategory") }
    }

    /// Set to true during restoreState(for:) to suppress cascading didSet resets.
    @ObservationIgnored private var isRestoring = false

    // Tanakh
    var tanakhBookIndex: Int = 0 {
        didSet { if !isRestoring { tanakhChapter = 1 } }
    }
    var tanakhChapter: Int = 1
    /// When set, TextContentView will scroll so this verse appears at the top after load.
    var tanakhScrollToVerse: Int? = nil

    // Mishnah — seder → tractate → chapter, with Tosefta toggle
    var mishnahSubcategory: MishnahSubcategory = .mishnah
    var mishnahSederIndex: Int = 0 {
        didSet { if !isRestoring { mishnahTractateIndexInSeder = 0; mishnahChapter = 1; toseftaChapter = 1 } }
    }
    var mishnahTractateIndexInSeder: Int = 0 {
        didSet { if !isRestoring { mishnahChapter = 1; toseftaChapter = 1 } }
    }
    var mishnahChapter: Int = 1
    var toseftaChapter: Int = 1

    // Talmud — seder → tractate → daf (Bavli), with Yerushalmi toggle
    var talmudSubcategory: TalmudSubcategory = .bavli
    var talmudSederIndex: Int = 0 {
        didSet { if !isRestoring { talmudTractateIndexInSeder = 0; talmudDaf = currentTalmudTractate?.startDaf ?? 2 } }
    }
    var talmudTractateIndexInSeder: Int = 0 {
        didSet { if !isRestoring { talmudDaf = currentTalmudTractate?.startDaf ?? 2 } }
    }
    var talmudDaf: Int = 2 {
        didSet { if !isRestoring { talmudAmud = Self.defaultAmud(tractate: currentTalmudTractate, daf: talmudDaf) } }
    }

    /// The amud (0 = alef, 1 = bet) a freshly-navigated-to daf should open on. Almost always 0 —
    /// Tamid's startDaf (25) is the one exception: its Gemara (and daf-image scans) only begin
    /// at 25b, since 25a has no content (confirmed empty on Sefaria — "firstAvailableSectionRef":
    /// "Tamid 25b") and no scanned page. Only applies at the tractate's actual startDaf — every
    /// other daf within Tamid still opens at amud alef like normal.
    private static func defaultAmud(tractate: TalmudTractate?, daf: Int) -> Int {
        if let tractate, tractate.sefariaName == "Tamid", daf == tractate.startDaf {
            return 1
        }
        return 0
    }

    // Yerushalmi — uses Mishnah seder structure, separate navigation state
    var yerushalmiSederIndex: Int = 0 {
        didSet { if !isRestoring { yerushalmiTractateIndexInSeder = 0; yerushalmiChapter = 1 } }
    }
    var yerushalmiTractateIndexInSeder: Int = 0 {
        didSet { if !isRestoring { yerushalmiChapter = 1 } }
    }
    var yerushalmiChapter: Int = 1 {
        didSet { if !isRestoring { yerushalmiHalakha = 1 } }
    }
    var yerushalmiHalakha: Int = 1
    var talmudAmud: Int = 0 {         // 0 = alef, 1 = bet
        didSet { if !isRestoring { saveState(for: .talmud) } }
    }
    var talmudScrollToAmudB: Bool = false
    var commentaryScrollToAmudB: Bool = false
    var commentaryScrollToAmudA: Bool = false

    // Rambam — sefer → work → chapter (0 = introduction, 1…N = regular chapters)
    var rambamSeferIndex: Int = 0 {
        didSet { if !isRestoring { rambamWorkIndexInSefer = 0 } }
    }
    var rambamWorkIndexInSefer: Int = 0 {
        didSet { if !isRestoring { rambamChapter = rambamHasIntro ? 0 : 1 } }
    }
    var rambamChapter: Int = 1

    /// True when an introduction is available for the current Rambam work.
    var rambamHasIntro: Bool {
        guard let w = currentRambamWork else { return false }
        return rambamIntroductions[w.id] != nil
    }

    // Shulkhan Arukh — section → siman
    var saSection: Int = 0
    var saSiman: Int = 1

    // Tur — section → siman (same shape as SA; no cross-cascade needed)
    var turSection: Int = 0
    var turSiman: Int = 1

    // Midrash — subcategory → work → book → chapter → verse (verse-based navigation)
    var midrashSubcategory: MidrashSubcategory = .halakha {
        didSet {
            guard !isRestoring else { return }
            midrashWork = MidrashWork.works(for: midrashSubcategory).first ?? .mekhiltaYishmael
            // Midrash Halakha (Mekhilta/Sifra/Sifrei) is always organized natively
            // (chapter/halakha or perek/pasuk), not by Tanakh verse — Midrash Aggada keeps
            // the by-verse default. Forced here, not just as an initial default, so the
            // single shared `midrashNavigationMode` property can't carry a stale value
            // across a Home-screen switch between the two sibling categories.
            midrashNavigationMode = midrashSubcategory == .halakha ? .native : .byVerse
        }
    }
    var midrashWork: MidrashWork = .mekhiltaYishmael {
        didSet {
            guard !isRestoring else { return }
            if !midrashWork.applicableBookIndices.contains(midrashBookIndex) {
                midrashBookIndex = midrashWork.applicableBookIndices.first ?? 1
            } else {
                midrashChapter = 1
                midrashVerse = 1
            }
        }
    }
    var midrashBookIndex: Int = 1 {        // default Exodus (first Halakha book)
        didSet { if !isRestoring { midrashChapter = 1; midrashVerse = 1 } }
    }
    var midrashChapter: Int = 1 {
        didSet { if !isRestoring { midrashVerse = 1 } }
    }
    var midrashVerse: Int = 1
    var midrashNavigationMode: MidrashNavigationMode = .byVerse
    var midrashNativeChapter: Int = 1
    var midrashNativeSection: Int = 1
    /// 1-based scroll target set after by-verse load; consumed by TextContentView scrollToVerse binding.
    var midrashScrollToIndex: Int? = nil

    // Teshuvot — subcategory → work → volume → siman. See TeshuvotWork's own doc comment:
    // volume/siman navigation uses draft, unverified Sefaria ref data.
    var teshuvotSubcategory: TeshuvotSubcategory = .rishonim
    var teshuvotWork: TeshuvotWork = .rashi {
        didSet { if !isRestoring { teshuvotVolume = 1; teshuvotSiman = 1 } }
    }
    var teshuvotVolume: Int = 1 {
        didSet { if !isRestoring { teshuvotSiman = 1 } }
    }
    var teshuvotSiman: Int = 1

    // MARK: - Display state

    private var _displayMode: TextDisplayMode = .source
    var displayMode: TextDisplayMode {
        get { _displayMode }
        set {
            _displayMode = newValue
            UserDefaults.standard.set(newValue.rawValue, forKey: "anyTorahDisplayMode")
        }
    }

    var segments: [TextSegment] = []
    var isLoading = false
    var error: String? = nil
    var currentRef: String = ""

    // Commentary layout visibility
    var commentaryVisible = false {
        didSet { UserDefaults.standard.set(commentaryVisible, forKey: "commentaryVisible") }
    }

    // Per-panel state — mainPanel is used in all layouts; rightPanel is used only
    // in the bothPanels layout (Step 4). Both are created eagerly so they can
    // load their persisted slot preferences at init time.
    var mainPanel: CommentaryPanelViewModel
    var rightPanel: CommentaryPanelViewModel

    /// Incremented at the start of every `load()` call.
    /// TextReaderView observes this to reload the right panel when in bothPanels layout.
    private(set) var loadGeneration: Int = 0

    // MARK: - Backward-compatible forwarding accessors (delegates to mainPanel)
    // Lets existing call-sites that reference vm.selectedCommentary etc. continue
    // to compile without change until they are migrated to use `panel` explicitly.

    var selectedCommentary: CommentaryType {
        get { mainPanel.selectedCommentary }
        set { mainPanel.selectedCommentary = newValue }
    }
    var commentaryEntries: [CommentaryEntry] { mainPanel.commentaryEntries }
    var isLoadingCommentary: Bool { mainPanel.isLoadingCommentary }
    var commentaryError: String? { mainPanel.commentaryError }

    // MARK: - Init

    init() {
        mainPanel  = CommentaryPanelViewModel(panelId: "main",  defaultSlots: Self.defaultSlots)
        rightPanel = CommentaryPanelViewModel(panelId: "right", defaultSlots: Self.defaultSlots)

        if let stored = UserDefaults.standard.string(forKey: "anyTorahDisplayMode"),
           let mode = TextDisplayMode(rawValue: stored) {
            _displayMode = mode
        }
        // Restore commentary panel visibility.
        commentaryVisible = UserDefaults.standard.bool(forKey: "commentaryVisible")
        // Slot persistence is handled inside CommentaryPanelViewModel.init.

        // Restore last-used category and its picker state so the home screen and
        // reader reopen exactly where the user left off.
        if let raw = UserDefaults.standard.string(forKey: "lastCategory"),
           let cat = TextCategory(rawValue: raw) {
            category = cat
            restoreState(for: cat)
        }
    }

    // MARK: - Per-category selection persistence

    /// Restores the last-used picker state for `cat`, falling back to first-run defaults.
    /// Call this instead of hard-coding defaults whenever the user picks a category.
    func restoreState(for cat: TextCategory) {
        let d = UserDefaults.standard
        isRestoring = true
        defer { isRestoring = false }
        switch cat {
        case .tanakh:
            tanakhBookIndex = d.object(forKey: "sel_tanakh_book")    as? Int ?? 0
            tanakhChapter   = d.object(forKey: "sel_tanakh_chapter") as? Int ?? 1
        case .mishnah:
            if let sub = d.string(forKey: "sel_mishnah_subcategory").flatMap(MishnahSubcategory.init) {
                mishnahSubcategory = sub
            }
            mishnahSederIndex           = d.object(forKey: "sel_mishnah_seder")    as? Int ?? 0
            mishnahTractateIndexInSeder = d.object(forKey: "sel_mishnah_tractate") as? Int ?? 0
            mishnahChapter              = d.object(forKey: "sel_mishnah_chapter")  as? Int ?? 1
            toseftaChapter              = d.object(forKey: "sel_tosefta_chapter")  as? Int ?? 1
        case .talmud:
            if let sub = d.string(forKey: "sel_talmud_subcategory").flatMap(TalmudSubcategory.init) {
                talmudSubcategory = sub
            }
            talmudSederIndex           = d.object(forKey: "sel_talmud_seder")    as? Int ?? 0
            talmudTractateIndexInSeder = d.object(forKey: "sel_talmud_tractate") as? Int ?? 0
            talmudDaf                  = d.object(forKey: "sel_talmud_daf")      as? Int ?? 2
            yerushalmiSederIndex           = d.object(forKey: "sel_yerushalmi_seder")    as? Int ?? 0
            yerushalmiTractateIndexInSeder = d.object(forKey: "sel_yerushalmi_tractate") as? Int ?? 0
            yerushalmiChapter              = d.object(forKey: "sel_yerushalmi_chapter")  as? Int ?? 1
            yerushalmiHalakha              = d.object(forKey: "sel_yerushalmi_halakha") as? Int ?? 1
            talmudAmud                     = d.object(forKey: "sel_talmud_amud")        as? Int ?? 0
        case .rambam:
            rambamSeferIndex       = d.object(forKey: "sel_rambam_sefer") as? Int ?? 0
            rambamWorkIndexInSefer = d.object(forKey: "sel_rambam_work")  as? Int ?? 0
            rambamChapter          = d.object(forKey: "sel_rambam_ch")    as? Int ?? 1
        case .tur:
            turSection = d.object(forKey: "sel_tur_section") as? Int ?? 0
            turSiman   = d.object(forKey: "sel_tur_siman")   as? Int ?? 1
        case .shulchanArukh:
            saSection = d.object(forKey: "sel_sa_section") as? Int ?? 0
            saSiman   = d.object(forKey: "sel_sa_siman")   as? Int ?? 1
        case .midrash:
            if let sub = d.string(forKey: "sel_midrash_sub").flatMap(MidrashSubcategory.init) {
                midrashSubcategory = sub
            }
            if let raw = d.string(forKey: "sel_midrash_work"), let w = MidrashWork(rawValue: raw) {
                midrashWork = w
            }
            midrashBookIndex = d.object(forKey: "sel_midrash_book")    as? Int ?? 1
            midrashChapter   = d.object(forKey: "sel_midrash_chapter") as? Int ?? 1
            midrashVerse     = d.object(forKey: "sel_midrash_verse")   as? Int ?? 1
            if let rawMode = d.string(forKey: "sel_midrash_navmode"),
               let mode = MidrashNavigationMode(rawValue: rawMode) {
                midrashNavigationMode = mode
            }
            // Belt-and-suspenders against a stale persisted mode: Halakha is never by-verse.
            if midrashSubcategory == .halakha {
                midrashNavigationMode = .native
            }
            midrashNativeChapter = d.object(forKey: "sel_midrash_native_ch")  as? Int ?? 1
            midrashNativeSection = d.object(forKey: "sel_midrash_native_sec") as? Int ?? 1
        case .teshuvot:
            if let sub = d.string(forKey: "sel_teshuvot_sub").flatMap(TeshuvotSubcategory.init) {
                teshuvotSubcategory = sub
            }
            if let raw = d.string(forKey: "sel_teshuvot_work"), let w = TeshuvotWork(rawValue: raw) {
                teshuvotWork = w
            }
            teshuvotVolume = d.object(forKey: "sel_teshuvot_volume") as? Int ?? 1
            teshuvotSiman  = d.object(forKey: "sel_teshuvot_siman")  as? Int ?? 1
        }
    }

    /// Saves the current picker state for `cat` to UserDefaults.
    /// Called from load() so state is recorded whenever the user commits a selection.
    private func saveState(for cat: TextCategory) {
        let d = UserDefaults.standard
        switch cat {
        case .tanakh:
            d.set(tanakhBookIndex, forKey: "sel_tanakh_book")
            d.set(tanakhChapter,   forKey: "sel_tanakh_chapter")
        case .mishnah:
            d.set(mishnahSubcategory.rawValue, forKey: "sel_mishnah_subcategory")
            d.set(mishnahSederIndex,           forKey: "sel_mishnah_seder")
            d.set(mishnahTractateIndexInSeder, forKey: "sel_mishnah_tractate")
            d.set(mishnahChapter,              forKey: "sel_mishnah_chapter")
            d.set(toseftaChapter,              forKey: "sel_tosefta_chapter")
        case .talmud:
            d.set(talmudSubcategory.rawValue,       forKey: "sel_talmud_subcategory")
            d.set(talmudSederIndex,                 forKey: "sel_talmud_seder")
            d.set(talmudTractateIndexInSeder,       forKey: "sel_talmud_tractate")
            d.set(talmudDaf,                        forKey: "sel_talmud_daf")
            d.set(yerushalmiSederIndex,             forKey: "sel_yerushalmi_seder")
            d.set(yerushalmiTractateIndexInSeder,   forKey: "sel_yerushalmi_tractate")
            d.set(yerushalmiChapter,                forKey: "sel_yerushalmi_chapter")
            d.set(yerushalmiHalakha,               forKey: "sel_yerushalmi_halakha")
            d.set(talmudAmud,                      forKey: "sel_talmud_amud")
        case .rambam:
            d.set(rambamSeferIndex,       forKey: "sel_rambam_sefer")
            d.set(rambamWorkIndexInSefer, forKey: "sel_rambam_work")
            d.set(rambamChapter,          forKey: "sel_rambam_ch")
        case .tur:
            d.set(turSection, forKey: "sel_tur_section")
            d.set(turSiman,   forKey: "sel_tur_siman")
        case .shulchanArukh:
            d.set(saSection, forKey: "sel_sa_section")
            d.set(saSiman,   forKey: "sel_sa_siman")
        case .midrash:
            d.set(midrashSubcategory.rawValue, forKey: "sel_midrash_sub")
            d.set(midrashWork.rawValue,        forKey: "sel_midrash_work")
            d.set(midrashBookIndex,            forKey: "sel_midrash_book")
            d.set(midrashChapter,              forKey: "sel_midrash_chapter")
            d.set(midrashVerse,                forKey: "sel_midrash_verse")
            d.set(midrashNavigationMode.rawValue, forKey: "sel_midrash_navmode")
            d.set(midrashNativeChapter,           forKey: "sel_midrash_native_ch")
            d.set(midrashNativeSection,           forKey: "sel_midrash_native_sec")
        case .teshuvot:
            d.set(teshuvotSubcategory.rawValue, forKey: "sel_teshuvot_sub")
            d.set(teshuvotWork.rawValue,        forKey: "sel_teshuvot_work")
            d.set(teshuvotVolume,               forKey: "sel_teshuvot_volume")
            d.set(teshuvotSiman,                forKey: "sel_teshuvot_siman")
        }
    }

    // MARK: - Commentary slot configuration

    /// Default (first-run) slot assignments for every context.
    private static let defaultSlots: [String: [CommentaryType]] = [
        "torah":   [.onkelos, .rashiTanakh, .ramban],
        "neviim":  [.targumYonatan, .rashiTanakh, .metzudatDavid],
        "ketuvim": [.targumKetuvim, .rashiTanakh, .metzudatDavid],
        "mishnah":    [.rambamMishnah, .bartenura, .tosafotYomTov],
        "tosefta":    [.briefCommentary, .toseftaKifshutah],
        "talmud":     [.rashiTalmud, .tosafot, .chiddusheiRamban],
        "yerushalmi": [.peneiMoshe, .mareyHaPanim, .ohrLayesharim],
        "rambam":  [.maggidMishnah, .kesefMishnah, .lochemMishnah],
        "sa_0":    [.mishnahBerurah, .biurHalakha, .magenAvraham],
        "sa_1":    [.taz, .shakh, .nekudatHaKesef],
        "sa_2":    [.chelkatMechokek, .beitShmuel, .taz],
        "sa_3":    [.meiratEinayim, .shakh, .ktzotHaChoshen],
        "tur_0":   [.beitYosef, .bach, .darkheiMoshe, .prishaDrisha],
        "tur_1":   [.beitYosef, .bach, .darkheiMoshe, .prishaDrisha],
        "tur_2":   [.beitYosef, .bach, .darkheiMoshe, .prishaDrisha],
        "tur_3":   [.beitYosef, .bach, .darkheiMoshe, .prishaDrisha],
    ]

    /// String key identifying the current reading context (used as a UserDefaults sub-key).
    var contextKey: String {
        switch category {
        case .tanakh:
            if tanakhBookIndex <= 4  { return "torah" }
            if tanakhBookIndex <= 25 { return "neviim" }
            return "ketuvim"
        case .mishnah:       return mishnahSubcategory == .tosefta ? "tosefta" : "mishnah"
        case .talmud:        return talmudSubcategory == .yerushalmi ? "yerushalmi" : "talmud"
        case .rambam:        return "rambam"
        case .tur:           return "tur_\(turSection)"
        case .shulchanArukh: return "sa_\(saSection)"
        case .midrash:       return "midrash"
        case .teshuvot:      return "teshuvot"
        }
    }

    /// True only for Talmud Bavli — false for Talmud Yerushalmi and every other category.
    /// Bavli-only features (daf images, amud A/B navigation, shiur audio) must gate on this
    /// rather than on `category == .talmud` alone, since Yerushalmi shares the same category
    /// but has no daf/amud concept and no matching audio/image content.
    var isTalmudBavli: Bool { category == .talmud && talmudSubcategory == .bavli }

    /// Fully-qualified display name for the current selection — e.g. "Talmud Yerushalmi",
    /// "Midrash Aggada", "Tosefta" — rather than the bare parent category name. Tanakh/Mishnah/
    /// Talmud/Midrash/etc. are chosen as independent, flat entry points from the home screen
    /// (not sub-choices within a shared category), so anywhere the app names "what the user is
    /// currently reading" should show the specific identity, not the generic parent.
    var categoryDisplayName: String {
        switch category {
        case .mishnah: return mishnahSubcategory.displayName
        case .talmud:  return "Talmud \(talmudSubcategory.displayName)"
        case .midrash: return midrashSubcategory.displayName
        case .teshuvot: return teshuvotSubcategory.displayName
        default:       return category.displayName
        }
    }

    var categoryHebrewDisplayName: String {
        switch category {
        case .mishnah: return mishnahSubcategory.hebrewName
        case .talmud:  return "\(category.hebrewName) \(talmudSubcategory.hebrewName)"
        case .midrash: return midrashSubcategory.hebrewName
        case .teshuvot: return teshuvotSubcategory.hebrewName
        default:       return category.hebrewName
        }
    }

    // MARK: - Computed helpers

    /// The commentators currently assigned to the visible tab slots for this context (main panel).
    var availableCommentaries: [CommentaryType] {
        mainPanel.slots(contextKey: contextKey, fallback: Self.defaultSlots[contextKey] ?? [])
    }

    /// Same as `availableCommentaries` but for an arbitrary panel — used by the right panel
    /// in the forthcoming bothPanels layout.
    func availableCommentaries(for panel: CommentaryPanelViewModel) -> [CommentaryType] {
        panel.slots(contextKey: contextKey, fallback: Self.defaultSlots[contextKey] ?? [])
    }

    /// Returns true when `type` has known content on Sefaria for the current position.
    func isCommentaryAvailable(_ type: CommentaryType) -> Bool {
        switch category {
        case .tanakh:
            return type.isAvailable(forTanakhBookIndex: tanakhBookIndex)
        case .mishnah:
            if mishnahSubcategory == .tosefta {
                return type.isAvailableForTosefta(tractateId: currentMishnahTractate?.id ?? 0)
            }
            return type.isAvailableForMishnah(
                sederIndex: mishnahSederIndex,
                globalTractateId: globalMishnahTractateIndex)
        case .talmud:
            if talmudSubcategory == .yerushalmi {
                return type.isAvailableForYerushalmi(tractateId: currentYerushalmiTractate?.id ?? 0)
            }
            return type.isAvailableForTalmud(tractateId: globalTalmudTractateIndex)
        case .rambam:
            return type.isAvailableForRambam(workId: currentRambamWork?.id ?? 0)
        case .tur:
            return true
        case .shulchanArukh:
            return true
        case .midrash:
            return false
        case .teshuvot:
            return false
        }
    }

    /// Ordered list of fallback commentaries used when a slot's stored type has no content
    /// for the current text.  First match not already assigned to another slot is used.
    private var fallbackCommentaries: [CommentaryType] {
        switch category {
        case .tanakh:
            if tanakhBookIndex <= 4  { return [.onkelos, .rashiTanakh, .ramban] }
            if tanakhBookIndex <= 25 { return [.targumYonatan, .rashiTanakh, .metzudatDavid] }
            return [.targumKetuvim, .rashiTanakh, .metzudatDavid]
        case .mishnah:
            if mishnahSubcategory == .tosefta {
                return CommentaryType.toseftaPool.filter { $0.isAvailableForTosefta(tractateId: currentMishnahTractate?.id ?? 0) }
            }
            return [.rambamMishnah, .bartenura, .tosafotYomTov]
        case .talmud:
            if talmudSubcategory == .yerushalmi {
                let tractateId = currentYerushalmiTractate?.id ?? 0
                return CommentaryType.yerushalmiPool.filter { $0.isAvailableForYerushalmi(tractateId: tractateId) }
            }
            return [.rashiTalmud, .tosafot, .chiddusheiRamban, .rashba, .ritva, .meiri]
        case .rambam:        return [.maggidMishnah, .kesefMishnah, .lochemMishnah,
                                    .mishnahLaMelech, .kiryatSefer, .maasehRokeach, .orSameach]
        case .tur:           return availableCommentaries  // Tur slots are always valid (fixed, no swap picker)
        case .shulchanArukh: return availableCommentaries  // SA slots are always valid
        case .midrash:       return []
        case .teshuvot:      return []
        }
    }

    /// Like `availableCommentaries`, but substitutes any slot whose stored type has no content
    /// for the current text with the first available fallback not already in another slot.
    var effectiveCommentaries: [CommentaryType] {
        let slots = availableCommentaries
        let fallbacks = fallbackCommentaries
        var effective: [CommentaryType] = []
        for cType in slots {
            if isCommentaryAvailable(cType) {
                effective.append(cType)
            } else {
                let used = Set(effective)
                if let sub = fallbacks.first(where: { isCommentaryAvailable($0) && !used.contains($0) }) {
                    effective.append(sub)
                } else {
                    effective.append(cType)  // no substitute found; content will be empty
                }
            }
        }
        return effective
    }

    /// Panel-aware version of `effectiveCommentaries` — substitutes unavailable commentaries
    /// using the specified panel's own slot assignments.
    func effectiveCommentaries(for panel: CommentaryPanelViewModel) -> [CommentaryType] {
        let slots = availableCommentaries(for: panel)
        let fallbacks = fallbackCommentaries
        var effective: [CommentaryType] = []
        for cType in slots {
            if isCommentaryAvailable(cType) {
                effective.append(cType)
            } else {
                let used = Set(effective)
                if let sub = fallbacks.first(where: { isCommentaryAvailable($0) && !used.contains($0) }) {
                    effective.append(sub)
                } else {
                    effective.append(cType)
                }
            }
        }
        return effective
    }

    /// The full curated pool of commentators the user can choose from for the current context,
    /// filtered to only those with known content for the currently-selected book/tractate.
    var commentaryPool: [CommentaryType] {
        commentaryPoolGrouped.flatMap { $0 }
    }

    /// The pool divided into display groups (Talmud has 3 groups; others have 1).
    /// Each group contains only commentaries available for the current selection.
    var commentaryPoolGrouped: [[CommentaryType]] {
        switch category {
        case .tanakh where tanakhBookIndex <= 4:
            let pool = CommentaryType.torahPool.filter { $0.isAvailable(forTanakhBookIndex: tanakhBookIndex) }
            return [pool]
        case .tanakh where tanakhBookIndex <= 25:
            let pool = CommentaryType.neviimPool.filter { $0.isAvailable(forTanakhBookIndex: tanakhBookIndex) }
            return [pool]
        case .tanakh:
            let pool = CommentaryType.ketuvimPool.filter { $0.isAvailable(forTanakhBookIndex: tanakhBookIndex) }
            return [pool]
        case .mishnah:
            if mishnahSubcategory == .tosefta {
                let tractateId = currentMishnahTractate?.id ?? 0
                let pool = CommentaryType.toseftaPool.filter { $0.isAvailableForTosefta(tractateId: tractateId) }
                return [pool]
            }
            let pool = CommentaryType.mishnahPool.filter {
                $0.isAvailableForMishnah(
                    sederIndex: mishnahSederIndex,
                    globalTractateId: globalMishnahTractateIndex)
            }
            return [pool]
        case .talmud:
            if talmudSubcategory == .yerushalmi {
                let tractateId = currentYerushalmiTractate?.id ?? 0
                return [CommentaryType.yerushalmiPool.filter { $0.isAvailableForYerushalmi(tractateId: tractateId) }]
            }
            return CommentaryType.talmudGrouped.map { group in
                group.filter { $0.isAvailableForTalmud(tractateId: globalTalmudTractateIndex) }
            }.filter { !$0.isEmpty }
        case .rambam:
            let workId = currentRambamWork?.id ?? 0
            return CommentaryType.rambamGrouped.map { group in
                group.filter { $0.isAvailableForRambam(workId: workId) }
            }.filter { !$0.isEmpty }
        case .tur:
            // Tur has NO swap picker: this pool must stay the same fixed 4-element array as
            // `availableCommentaries` (see defaultSlots "tur_0".."tur_3"). Returning an equal-size
            // pool here is load-bearing for `hasExpandedCommentaryPool` evaluating false for Tur —
            // don't let a future change give Tur a bigger pool without reconsidering that.
            return [CommentaryType.turPool]
        case .shulchanArukh:
            return [CommentaryType.saPool(forSection: saSection)]
        case .midrash:
            return []
        default:
            return [availableCommentaries]
        }
    }

    /// Section labels parallel to `commentaryPoolGrouped` (nil = no header for that group).
    /// Only Talmud and Rambam have meaningful group distinctions; other categories return [nil].
    var commentaryPoolGroupLabels: [String?] {
        switch category {
        case .talmud:
            let tractateId = globalTalmudTractateIndex
            let staticLabels: [String] = [
                "Rishonim — Rashi-style",
                "Rishonim — Chiddushim",
                "Rishonim — Tosafots",
                "Acharonim - On the daf",
                "Acharonim — Chiddushim",
            ]
            return zip(CommentaryType.talmudGrouped, staticLabels).compactMap { group, label in
                group.filter { $0.isAvailableForTalmud(tractateId: tractateId) }.isEmpty ? nil : label
            }
        case .rambam:
            let workId = currentRambamWork?.id ?? 0
            let staticLabels: [String] = ["Classic Commentaries", "Later Acharonim"]
            return zip(CommentaryType.rambamGrouped, staticLabels).compactMap { group, label in
                group.filter { $0.isAvailableForRambam(workId: workId) }.isEmpty ? nil : label
            }
        default:
            return Array(repeating: nil, count: commentaryPoolGrouped.count)
        }
    }

    /// True when the pool contains more options than the current slots, enabling the swap UI.
    var hasExpandedCommentaryPool: Bool {
        commentaryPool.count > availableCommentaries.count
    }

    // MARK: - Slot replacement

    /// Replaces the commentary in slot `slotIndex` with `type` in the main panel.
    func replaceSlot(at slotIndex: Int, with type: CommentaryType) async {
        await replaceSlot(at: slotIndex, with: type, in: mainPanel)
    }

    /// Replaces the commentary in slot `slotIndex` with `type` in `panel`, persists, and reloads.
    func replaceSlot(at slotIndex: Int, with type: CommentaryType, in panel: CommentaryPanelViewModel) async {
        var slots = availableCommentaries(for: panel)
        guard slotIndex < slots.count else { return }
        slots[slotIndex] = type
        panel.setSlots(slots, contextKey: contextKey)
        panel.selectedCommentary = type
        // For SA, reload the full text so inline commentary markers are reprocessed
        // with the new slot assignments. For other categories, just reload commentary.
        if category == .shulchanArukh {
            await load()
        } else {
            await loadCommentary(into: panel)
        }
    }

    var currentTanakhBook: TanakhBook? {
        guard tanakhBookIndex < TextCatalog.allTanakhBooks.count else { return nil }
        return TextCatalog.allTanakhBooks[tanakhBookIndex]
    }

    var mishnahTractateCandidates: [MishnahTractate] {
        guard mishnahSederIndex < TextCatalog.mishnahSedarim.count else { return [] }
        return TextCatalog.mishnahSedarim[mishnahSederIndex].tractates
    }

    var currentMishnahTractate: MishnahTractate? {
        let list = mishnahTractateCandidates
        guard mishnahTractateIndexInSeder < list.count else { return nil }
        return list[mishnahTractateIndexInSeder]
    }

    var globalMishnahTractateIndex: Int {
        currentMishnahTractate?.id ?? 0
    }

    var talmudTractateCandidates: [TalmudTractate] {
        guard talmudSederIndex < TextCatalog.talmudSedarim.count else { return [] }
        return TextCatalog.talmudSedarim[talmudSederIndex].tractates
    }

    var currentTalmudTractate: TalmudTractate? {
        let list = talmudTractateCandidates
        guard talmudTractateIndexInSeder < list.count else { return nil }
        return list[talmudTractateIndexInSeder]
    }

    var globalTalmudTractateIndex: Int {
        currentTalmudTractate?.id ?? 0
    }

    // Yerushalmi — uses Mishnah seder structure, filtered to tractates with Yerushalmi content
    var yerushalmiSedarim: [MishnahSeder] {
        TextCatalog.mishnahSedarim.filter { seder in
            seder.tractates.contains { $0.yerushalmiChapters > 0 }
        }
    }

    var yerushalmiTractateCandidates: [MishnahTractate] {
        guard yerushalmiSederIndex < yerushalmiSedarim.count else { return [] }
        return yerushalmiSedarim[yerushalmiSederIndex].tractates.filter { $0.yerushalmiChapters > 0 }
    }

    var currentYerushalmiTractate: MishnahTractate? {
        let list = yerushalmiTractateCandidates
        guard yerushalmiTractateIndexInSeder < list.count else { return nil }
        return list[yerushalmiTractateIndexInSeder]
    }

    var allYerushalmiTractates: [MishnahTractate] {
        TextCatalog.allMishnahTractates.filter { $0.yerushalmiChapters > 0 }
    }

    var yerushalmiGlobalTractateIndex: Int {
        guard let t = currentYerushalmiTractate else { return 0 }
        return allYerushalmiTractates.firstIndex(where: { $0.id == t.id }) ?? 0
    }

    func setYerushalmiGlobalTractate(_ globalIdx: Int) {
        let all = allYerushalmiTractates
        guard globalIdx < all.count else { return }
        let tractate = all[globalIdx]
        for (si, seder) in yerushalmiSedarim.enumerated() {
            let candidates = seder.tractates.filter { $0.yerushalmiChapters > 0 }
            if let ti = candidates.firstIndex(where: { $0.id == tractate.id }) {
                isRestoring = true
                yerushalmiSederIndex = si
                yerushalmiTractateIndexInSeder = ti
                yerushalmiChapter = 1
                yerushalmiHalakha = 1
                isRestoring = false
                break
            }
        }
    }

    var rambamWorkCandidates: [RambamWork] {
        guard rambamSeferIndex < TextCatalog.rambamSefarim.count else { return [] }
        return TextCatalog.rambamSefarim[rambamSeferIndex].works
    }

    var currentRambamWork: RambamWork? {
        let list = rambamWorkCandidates
        guard rambamWorkIndexInSefer < list.count else { return nil }
        return list[rambamWorkIndexInSefer]
    }

    // MARK: - Ref building

    var displayTitle: String {
        switch category {
        case .tanakh:
            let book = currentTanakhBook?.name ?? ""
            return "\(book), ch. \(tanakhChapter)"
        case .mishnah:
            if mishnahSubcategory == .tosefta {
                let t = currentMishnahTractate?.name ?? ""
                return "Tosefta \(t), ch. \(toseftaChapter)"
            }
            let t = currentMishnahTractate?.name ?? ""
            return "\(t), ch. \(mishnahChapter)"
        case .talmud:
            if talmudSubcategory == .yerushalmi {
                let t = currentYerushalmiTractate?.name ?? ""
                let halakhaStr = yerushalmiHalakha > 1 ? ":\(yerushalmiHalakha)" : ""
                return "Yerushalmi \(t) \(yerushalmiChapter)\(halakhaStr)"
            }
            let t = currentTalmudTractate?.name ?? ""
            return "\(t) \(talmudDaf)\(talmudAmud == 0 ? "a" : "b")"
        case .rambam:
            let w = currentRambamWork?.name ?? ""
            if rambamChapter == 0 { return "\(w), Intro" }
            return "\(w), ch. \(rambamChapter)"
        case .tur:
            guard turSection < TextCatalog.turSections.count else { return "" }
            let s = TextCatalog.turSections[turSection].name
            return "\(s), §\(turSiman)"
        case .shulchanArukh:
            guard saSection < TextCatalog.shulchanArukhSections.count else { return "" }
            let s = TextCatalog.shulchanArukhSections[saSection].name
            return "\(s), §\(saSiman)"
        case .midrash:
            if midrashNavigationMode == .native {
                let labels = midrashWork.nativeChapterLabels
                let chapLabel = midrashNativeChapter <= labels.count ? labels[midrashNativeChapter - 1] : "\(midrashNativeChapter)"
                if midrashWork.nativeIsOneLevel {
                    return "\(midrashWork.displayName), \(chapLabel)"
                }
                return "\(midrashWork.displayName), \(chapLabel):\(midrashNativeSection)"
            }
            let bookName = TextCatalog.allTanakhBooks.first(where: { $0.id == midrashBookIndex })?.name ?? ""
            return "\(midrashWork.displayName), \(bookName) \(midrashChapter):\(midrashVerse)"
        case .teshuvot:
            if let label = teshuvotWork.volumeLabel {
                return "\(teshuvotWork.displayName), \(label) \(teshuvotVolume):\(teshuvotSiman)"
            }
            return "\(teshuvotWork.displayName) §\(teshuvotSiman)"
        }
    }

    /// Short title for the "book" navigation pill in the reader header.
    /// Returns Hebrew name (nikkud-stripped) when saHebrewMode is on.
    var navBookTitle: String {
        let useHe = UserDefaults.standard.value(forKey: "saHebrewMode") as? Bool ?? false
        switch category {
        case .tanakh:
            guard let b = currentTanakhBook else { return "–" }
            return useHe ? b.hebrewName.strippingNikud : b.name
        case .mishnah:
            guard let t = currentMishnahTractate else { return "–" }
            return useHe ? t.hebrewName.strippingNikud : t.name
        case .talmud:
            if talmudSubcategory == .yerushalmi {
                guard let t = currentYerushalmiTractate else { return "–" }
                return useHe ? t.hebrewName.strippingNikud : t.name
            }
            guard let t = currentTalmudTractate else { return "–" }
            return useHe ? t.hebrewName.strippingNikud : t.name
        case .rambam:
            guard let w = currentRambamWork else { return "–" }
            return useHe ? w.hebrewName.strippingNikud : w.name
        case .tur:
            guard turSection < TextCatalog.turSections.count else { return "–" }
            let s = TextCatalog.turSections[turSection]
            return useHe ? s.hebrewName.strippingNikud : s.name
        case .shulchanArukh:
            guard saSection < TextCatalog.shulchanArukhSections.count else { return "–" }
            let s = TextCatalog.shulchanArukhSections[saSection]
            return useHe ? s.hebrewName.strippingNikud : s.name
        case .midrash:
            return useHe ? midrashWork.hebrewName : midrashWork.displayName
        case .teshuvot:
            return useHe ? teshuvotWork.hebrewName : teshuvotWork.displayName
        }
    }

    /// Short title for the "chapter" navigation pill in the reader header.
    /// Returns Hebrew numeral when saHebrewMode is on.
    var navChapterTitle: String {
        let useHe = UserDefaults.standard.value(forKey: "saHebrewMode") as? Bool ?? false
        switch category {
        case .tanakh:        return useHe ? "פרק \(SASimanNames.toHebrewNumeral(tanakhChapter))"   : "ch. \(tanakhChapter)"
        case .mishnah:
            if mishnahSubcategory == .tosefta {
                return useHe ? "פרק \(SASimanNames.toHebrewNumeral(toseftaChapter))" : "ch. \(toseftaChapter)"
            }
            return useHe ? "פרק \(SASimanNames.toHebrewNumeral(mishnahChapter))" : "ch. \(mishnahChapter)"
        case .talmud:
            if talmudSubcategory == .yerushalmi {
                let halakhaStr = yerushalmiHalakha > 1 ? ":\(yerushalmiHalakha)" : ""
                return useHe ? "פרק \(SASimanNames.toHebrewNumeral(yerushalmiChapter))\(halakhaStr)" : "\(yerushalmiChapter)\(halakhaStr)"
            }
            return useHe ? SASimanNames.toHebrewNumeral(talmudDaf) : "\(talmudDaf)"
        case .rambam:
            if rambamChapter == 0 { return useHe ? "הקדמה" : "Intro" }
            return useHe ? "פרק \(SASimanNames.toHebrewNumeral(rambamChapter))" : "ch. \(rambamChapter)"
        case .tur:            return useHe ? "סי׳ \(SASimanNames.toHebrewNumeral(turSiman))"         : "§\(turSiman)"
        case .shulchanArukh: return useHe ? "סי׳ \(SASimanNames.toHebrewNumeral(saSiman))"         : "§\(saSiman)"
        case .midrash:
            if midrashNavigationMode == .native {
                let labels = midrashWork.nativeChapterLabels
                let chapLabel = midrashNativeChapter <= labels.count ? labels[midrashNativeChapter - 1] : "\(midrashNativeChapter)"
                if midrashWork.nativeIsOneLevel {
                    return chapLabel
                }
                return "\(chapLabel):\(midrashNativeSection)"
            }
            let bookName = TextCatalog.allTanakhBooks.first(where: { $0.id == midrashBookIndex })?.name ?? "?"
            return "\(bookName) \(midrashChapter):\(midrashVerse)"
        case .teshuvot:
            if teshuvotWork.volumeLabel != nil {
                return "\(teshuvotVolume):\(teshuvotSiman)"
            }
            return "§\(teshuvotSiman)"
        }
    }

    // MARK: - Fetch

    func load() async {
        loadGeneration += 1
        isLoading = true
        error = nil
        segments = []

        do {
            switch category {
            case .tanakh:
                let r = SefariaTextClient.shared.ref(
                    category: .tanakh,
                    bookOrTractateIndex: tanakhBookIndex,
                    chapterOrDaf: tanakhChapter)
                currentRef = r
                segments = try await SefariaTextClient.shared.fetchChapter(
                    category: .tanakh,
                    bookOrTractateIndex: tanakhBookIndex,
                    chapter: tanakhChapter)
            case .mishnah:
                if mishnahSubcategory == .tosefta {
                    guard let tractate = currentMishnahTractate else {
                        self.error = "No tractate selected"; isLoading = false; return
                    }
                    let r = "Tosefta \(tractate.name) \(toseftaChapter)"
                    currentRef = r
                    segments = try await SefariaTextClient.shared.fetchTosefta(
                        tractate: tractate, chapter: toseftaChapter)
                } else {
                    let r = SefariaTextClient.shared.ref(
                        category: .mishnah,
                        bookOrTractateIndex: globalMishnahTractateIndex,
                        chapterOrDaf: mishnahChapter)
                    currentRef = r
                    segments = try await SefariaTextClient.shared.fetchChapter(
                        category: .mishnah,
                        bookOrTractateIndex: globalMishnahTractateIndex,
                        chapter: mishnahChapter)
                }
            case .talmud:
                if talmudSubcategory == .yerushalmi {
                    guard let tractate = currentYerushalmiTractate else {
                        self.error = "No tractate selected"; isLoading = false; return
                    }
                    let r = "Jerusalem Talmud \(tractate.name) \(yerushalmiChapter):\(yerushalmiHalakha)"
                    currentRef = r
                    segments = try await SefariaTextClient.shared.fetchYerushalmi(
                        tractate: tractate, chapter: yerushalmiChapter, halakha: yerushalmiHalakha)
                    // No scroll needed — fetchYerushalmi loads exactly the selected halakha
                } else {
                    guard let tractate = currentTalmudTractate else {
                        self.error = "No tractate selected"; isLoading = false; return
                    }
                    currentRef = "\(tractate.sefariaName) \(talmudDaf)"
                    segments = try await SefariaTextClient.shared.fetchFullDaf(
                        tractateIndex: globalTalmudTractateIndex,
                        daf: talmudDaf)
                    if talmudAmud == 1 { talmudScrollToAmudB = true }
                }
            case .rambam:
                guard let work = currentRambamWork else { break }
                if rambamChapter == 0 {
                    // Introduction chapter — use bundled Chabad content, no Sefaria fetch.
                    currentRef = ""
                    if let intro = rambamIntroductions[work.id], !intro.he.isEmpty || !intro.en.isEmpty {
                        segments = [.content(index: 0, he: intro.he, en: intro.en, label: nil)]
                    } else {
                        segments = []
                    }
                    break
                }
                let r = SefariaTextClient.shared.ref(
                    category: .rambam,
                    bookOrTractateIndex: work.id,
                    chapterOrDaf: rambamChapter)
                currentRef = r
                let rambamSegs = try await SefariaTextClient.shared.fetchChapter(
                    category: .rambam,
                    bookOrTractateIndex: work.id,
                    chapter: rambamChapter)
                let (heRaavad, enRaavad) = await SefariaTextClient.shared.fetchRaavad(
                    rambamRef: r, count: rambamSegs.count)
                segments = SefariaTextClient.applyRaavad(he: heRaavad, en: enRaavad, to: rambamSegs)
            case .midrash:
                midrashScrollToIndex = nil
                if midrashNavigationMode == .native {
                    let ref = midrashWork.nativeRef(chapter: midrashNativeChapter, section: midrashNativeSection)
                    currentRef = ref
                    let (he, en) = try await SefariaTextClient.shared.fetchBoth(ref: ref)
                    let count = max(he.count, en.count)
                    segments = (0..<count).compactMap { i in
                        let seg = TextSegment.content(index: i,
                                                      he: i < he.count ? he[i] : "",
                                                      en: i < en.count ? en[i] : "")
                        return seg.hebrewHTML.isEmpty && seg.englishHTML.isEmpty ? nil : seg
                    }
                } else {
                    guard let book = TextCatalog.allTanakhBooks.first(where: { $0.id == midrashBookIndex }) else {
                        self.error = "No book selected"; isLoading = false; return
                    }
                    let r = "\(book.sefariaName) \(midrashChapter):\(midrashVerse)"
                    currentRef = r
                    let (segs, scrollIdx) = try await SefariaTextClient.shared.fetchMidrashByVerse(
                        work: midrashWork,
                        bookSefariaName: book.sefariaName,
                        chapter: midrashChapter,
                        verse: midrashVerse)
                    segments = segs
                    midrashScrollToIndex = scrollIdx + 1  // 1-based for scrollToVerse compat
                }
            case .teshuvot:
                // DRAFT ref — see TeshuvotWork's own doc comment. Same generic-ref fetch
                // pattern as Midrash's native-mode branch above; a wrong ref surfaces via the
                // existing "Error loading text" / Retry UI, not a crash.
                let ref = teshuvotWork.sefariaRef(volume: teshuvotVolume, siman: teshuvotSiman)
                currentRef = ref
                let (he, en) = try await SefariaTextClient.shared.fetchBoth(ref: ref)
                let count = max(he.count, en.count)
                segments = (0..<count).compactMap { i in
                    let seg = TextSegment.content(index: i,
                                                  he: i < he.count ? he[i] : "",
                                                  en: i < en.count ? en[i] : "")
                    return seg.hebrewHTML.isEmpty && seg.englishHTML.isEmpty ? nil : seg
                }
            case .tur:
                let r = SefariaTextClient.shared.ref(
                    category: .tur,
                    bookOrTractateIndex: turSection,
                    chapterOrDaf: turSiman)
                currentRef = r
                // Phase 1 stub: naive per-seif segments, no special header-splitting or
                // paragraph-merging (that's a separate later phase). Tur has no swap picker,
                // so unlike SA there's no bothPanels commentary concatenation to do here.
                segments = try await SefariaTextClient.shared.fetchChapter(
                    category: .tur,
                    bookOrTractateIndex: turSection,
                    chapter: turSiman)
            case .shulchanArukh:
                let r = SefariaTextClient.shared.ref(
                    category: .shulchanArukh,
                    bookOrTractateIndex: saSection,
                    chapterOrDaf: saSiman)
                currentRef = r
                // In bothPanels mode the marker processor needs all 6 slot assignments so
                // every panel's bracket markers are baked into the text simultaneously.
                let layoutRaw = UserDefaults.standard.string(forKey: "commentaryLayout") ?? "bottom"
                let saCommentaries = layoutRaw == CommentaryLayout.bothPanels.rawValue
                    ? availableCommentaries(for: mainPanel) + availableCommentaries(for: rightPanel)
                    : availableCommentaries
                let saTextModeRaw = UserDefaults.standard.string(forKey: "saTextMode") ?? SATextMode.commentary.rawValue
                segments = try await SefariaTextClient.shared.fetchChapter(
                    category: .shulchanArukh,
                    bookOrTractateIndex: saSection,
                    chapter: saSiman,
                    selectedCommentaries: saCommentaries,
                    saTextMode: SATextMode(rawValue: saTextModeRaw) ?? .commentary)
            }
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false

        // Persist the current selection so the picker reopens here next time.
        saveState(for: category)

        // Snap selectedCommentary into the effective list for the new location.
        // If the current selection is still valid leave it; otherwise fall back to first.
        // Apply to both panels so neither shows a stale / unavailable commentator after navigation.
        if !effectiveCommentaries(for: mainPanel).contains(mainPanel.selectedCommentary) {
            mainPanel.selectedCommentary = effectiveCommentaries(for: mainPanel).first ?? mainPanel.selectedCommentary
        }
        if !effectiveCommentaries(for: rightPanel).contains(rightPanel.selectedCommentary) {
            rightPanel.selectedCommentary = effectiveCommentaries(for: rightPanel).first ?? rightPanel.selectedCommentary
        }

        // Auto-load commentary if panel was already visible.
        // In bothPanels layout both panels need to refresh; otherwise only the main panel.
        if commentaryVisible {
            let layoutRaw = UserDefaults.standard.string(forKey: "commentaryLayout") ?? "bottom"
            if layoutRaw == CommentaryLayout.bothPanels.rawValue {
                await loadBothPanels()
            } else {
                await loadCommentary(into: mainPanel)
            }
        }
    }

    /// Loads commentary into the main panel (convenience wrapper).
    func loadCommentary() async {
        await loadCommentary(into: mainPanel)
    }

    /// Loads commentary into both panels concurrently (used in bothPanels layout).
    func loadBothPanels() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadCommentary(into: self.mainPanel) }
            group.addTask { await self.loadCommentary(into: self.rightPanel) }
        }
    }

    /// Loads commentary into `panel`. All context (category, ref, etc.) is read from the VM.
    func loadCommentary(into panel: CommentaryPanelViewModel) async {
        let panelAvailable = availableCommentaries(for: panel)
        guard !currentRef.isEmpty, !panelAvailable.isEmpty else {
            panel.commentaryEntries = []
            return
        }
        panel.isLoadingCommentary = true
        panel.commentaryError = nil
        panel.commentaryEntries = []

        // Some commentaries are depth-3 texts: requesting a chapter/siman-level ref
        // without a range only returns the first sub-entry (halakha/seif 1).
        // Appending ":1-N" fetches all sub-entries; Sefaria caps at the actual count.
        //
        // • Rambam — Maggid Mishneh / Kessef Mishneh: depth = Chapter → Halakha → Comment
        //   Use segments.count so the range matches the actual number of halakhot.
        // • SA — Shach (Siftei Kohen): depth = Siman → Seif → Comment
        //   100 is a safe upper bound for any siman's Shach entries.
        let commentaryRef: String
        if category == .rambam && !segments.isEmpty {
            // All Rambam commentaries on Sefaria are depth-3 (Chapter → Halakha → Comment).
            // Appending ":1-N" fetches all sub-entries for the current chapter.
            commentaryRef = "\(currentRef):1-\(segments.count)"
        } else if category == .shulchanArukh && panel.selectedCommentary == .shakh {
            commentaryRef = "\(currentRef):1-100"
        } else if category == .tur {
            // All 4 Tur commentaries (Beit Yosef, Bach, Darkhei Moshe, Prisha+Drisha) are
            // depth-3 (Siman → Seif → Comment) — a bare siman ref returns only seif 1.
            // Unlike SA (where only Shakh needs this), this applies uniformly to every
            // Tur commentary type, so no further discrimination by commentary is needed.
            commentaryRef = "\(currentRef):1-500"
        } else if category == .mishnah && mishnahSubcategory == .tosefta {
            // Tosefta Kifshutah and Brief Commentary are depth-3 (Chapter → Mishnah → Comment).
            commentaryRef = "\(currentRef):1-200"
        } else if category == .mishnah &&
                  [.rambamMishnah, .bartenura, .tosafotYomTov, .melekhetShlomo,
                   .tosafotRabbiAkivaEiger, .englishExplanation,
                   .rashMiShantz, .yeshSederLaMishnah, .gra,
                   .rashash, .yachin].contains(panel.selectedCommentary) {
            // All these Mishnah commentaries are textDepth=3 (Chapter → Mishnah → Comment).
            // A bare chapter ref returns only mishnah-1 comments; append range to get all.
            commentaryRef = "\(currentRef):1-20"
        } else if category == .tanakh {
            // ALL Tanakh commentaries on Sefaria are textDepth=3
            // (Chapter → Verse → Comment). A bare chapter ref returns only the
            // comments on the first verse; a verse-range ref returns the full
            // per-verse arrays which flattenTextValue flattens correctly.
            commentaryRef = "\(currentRef):1-200"
        } else if category == .talmud {
            // Use bare daf ref (no amud suffix) — the Sefaria response nests amud-a and
            // amud-b together and flattenTextValue extracts everything correctly.
            // Explicit amud-a refs (e.g. "Chullin 5a") return fewer entries than the
            // bare daf ref on some tractates and should be avoided.
            commentaryRef = currentRef
        } else {
            commentaryRef = currentRef
        }

        // Ein Ayah is bundled — no Sefaria fetch needed.
        if panel.selectedCommentary == .einAyah {
            let parts = commentaryRef.split(separator: " ", maxSplits: 1)
            let tractate = parts.count > 0 ? String(parts[0]) : ""
            let daf      = parts.count > 1 ? String(parts[1]) : ""
            panel.commentaryEntries = EinAyahLoader.entries(tractate: tractate, daf: daf)
            panel.loadVersion += 1
            panel.isLoadingCommentary = false
            return
        }

        let versions = panel.selectedCommentary.sefariaRefVersions(forMainRef: commentaryRef)

        // If we're at the very first section of this text, try to fetch an introduction
        // that some commentaries have before their first chapter/daf.
        // introRef strips the trailing chapter/daf number from the commentary ref to get
        // the base title (e.g. "Meiri on Niddah"), then appends " Introduction".
        // Only try the introduction fetch for single-ref commentaries. Multi-ref ones
        // (Tosafot Rid recensions, Maharsha Halachot+Agadot, R. Akiva Eiger) don't have
        // introduction sections and the base-ref lookup would return wrong content.
        // SA commentaries have no introduction sections on Sefaria — skip introRef entirely
        // to prevent Sefaria from returning siman-1 content for the "Introduction" pseudo-ref
        // and prepending it as a duplicate of the real siman-1 data.
        // Mishnah commentaries don't have genuine intro sections on Sefaria — their
        // "Introduction" ref returns ch.1 content, duplicating the main fetch.
        // Tur commentaries have no genuine Sefaria "Introduction" pseudo-ref concept either
        // (same reasoning as SA/Mishnah/Rambam) — skip the intro fetch for Tur too.
        let introR: String? = (isAtFirstSection && versions.count == 1
                               && category != .shulchanArukh
                               && category != .mishnah
                               && category != .rambam
                               && category != .tur)
            ? Self.introRef(for: versions[0].ref) : nil

        // Use outer-level indices (= mishnah/verse/halakha number) as display labels for
        // Mishnah and Rambam commentary so entries reflect the actual halakha/mishnah number.
        let useMishnahLabels = category == .mishnah || category == .rambam || category == .tanakh

        if versions.count == 1 {
            // Fast path: single aligned fetch so he[i] and en[i] always correspond.
            let ref = versions[0].ref
            let (hSegs, eSegs, outerIdx) = (try? await SefariaTextClient.shared.fetchBothAligned(ref: ref)) ?? ([], [], [])
            let count = max(eSegs.count, hSegs.count)
            var seqIdx = 0
            var entries: [CommentaryEntry] = (0..<count).compactMap { i in
                let h = i < hSegs.count ? hSegs[i] : ""
                let e = i < eSegs.count ? eSegs[i] : ""
                guard !h.trimmingCharacters(in: .whitespaces).isEmpty ||
                      !e.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
                let label: Int? = useMishnahLabels ? (i < outerIdx.count ? outerIdx[i] : i) : nil
                let entry = CommentaryEntry.text(index: seqIdx, label: label, he: h, en: e)
                seqIdx += 1
                return entry
            }
            if let ir = introR {
                entries = await prependIntro(to: entries, introRef: ir)
            }
            panel.commentaryEntries = entries
        } else {
            // Multi-recension path (Tosafot Rid on Avodah Zarah / Megillah).
            // Fetch each recension sequentially, inserting a labelled divider between them.
            // Any introduction is prepended before the first recension.
            var entries: [CommentaryEntry] = []
            var segIdx = 0

            if let ir = introR {
                let introEntries = await fetchIntroEntries(ref: ir, startIdx: 0)
                entries.append(contentsOf: introEntries)
                segIdx = introEntries.count
            }

            let useBookDivider = panel.selectedCommentary.usesBookDivider
            for (ref, label) in versions {
                if let lbl = label {
                    entries.append(useBookDivider ? .bookDivider(lbl) : .recensionHeader(lbl))
                }
                let (hSegs, eSegs, _) = (try? await SefariaTextClient.shared.fetchBothAligned(ref: ref)) ?? ([], [], [])
                let count = max(eSegs.count, hSegs.count)
                var added = 0
                for i in 0..<count {
                    let h = i < hSegs.count ? hSegs[i] : ""
                    let e = i < eSegs.count ? eSegs[i] : ""
                    guard !h.trimmingCharacters(in: .whitespaces).isEmpty ||
                          !e.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                    entries.append(.text(index: segIdx + added, label: nil, he: h, en: e))
                    added += 1
                }
                segIdx += added
            }
            panel.commentaryEntries = entries
        }

        // Beit Yosef/Bach/Prisha+Drisha each open their comment with a direct quote of the Tur
        // words they're discussing — assignTurParagraphLabels matches those opening words
        // against Tur's own Beit-Yosef-derived paragraphs to number each entry by the Tur
        // paragraph it actually comments on, instead of a generic sequential count. Darkhei
        // Moshe is excluded: it anchors via its own real data-order markers, not by
        // quote-matching, so it keeps plain sequential numbering. Re-fetches Tur's own raw text
        // and (when the open tab isn't already Beit Yosef) Beit Yosef's entries independently,
        // rather than threading them through from load() — an intentional
        // simplicity-over-micro-perf tradeoff, matching the reference web implementation.
        if category == .tur && panel.selectedCommentary != .darkheiMoshe {
            let turHe = ((try? await SefariaTextClient.shared.fetchBoth(ref: currentRef))?.hebrew) ?? []
            if !turHe.isEmpty {
                let beitYosefEntries: [CommentaryEntry]
                if panel.selectedCommentary == .beitYosef {
                    beitYosefEntries = panel.commentaryEntries
                } else {
                    beitYosefEntries = await SefariaTextClient.shared.fetchTurCommentaryEntries(type: .beitYosef, mainRef: currentRef)
                }
                let paragraphs = await TurParagraphEngine.fetchTurParagraphPlainList(turHe) { beitYosefEntries }
                var labeled = TurParagraphEngine.assignTurParagraphLabels(panel.commentaryEntries, paragraphs)

                // Darkhei Moshe sometimes anchors on Beit Yosef's own words rather than Tur's —
                // labels must be assigned first (above), using the *original* entries, so an
                // inserted <dm> digit never ends up among the "opening words" the paragraph
                // matcher searches with.
                if panel.selectedCommentary == .beitYosef {
                    let marks = await TurParagraphEngine.computeBeitYosefDarkheiMosheMarks(turHe, labeled) {
                        await SefariaTextClient.shared.fetchTurCommentaryEntries(type: .darkheiMoshe, mainRef: currentRef)
                    }
                    if !marks.isEmpty {
                        labeled = labeled.enumerated().map { i, entry in
                            guard case let .text(index, label, he, en) = entry, let n = marks[i] else { return entry }
                            return .text(index: index, label: label, he: TurParagraphEngine.insertBeitYosefDarkheiMosheMark(he, n), en: en)
                        }
                    }
                }
                panel.commentaryEntries = labeled
            }
        }

        // For Talmud single-version commentary: the bare daf ref (e.g. "Rashi on Berakhot 2")
        // only returns 1 amud-b entry regardless of actual count. Fetch amud-a and amud-b
        // separately with range queries and rebuild the entry list with an "עמוד ב׳" divider.
        if category == .talmud && !currentRef.isEmpty
            && panel.selectedCommentary != .einAyah && versions.count == 1 {
            let baseRef = versions[0].ref  // e.g. "Rashi on Berakhot 2"
            let refA = baseRef + "a.1-200"
            let refB = baseRef + "b.1-200"
            async let aFetch = SefariaTextClient.shared.fetchBothAligned(ref: refA)
            async let bFetch = SefariaTextClient.shared.fetchBothAligned(ref: refB)
            let (aHe, aEn, _) = (try? await aFetch) ?? ([], [], [])
            let (bHe, bEn, _) = (try? await bFetch) ?? ([], [], [])
            let aCount = max(aHe.count, aEn.count)
            let bCount = max(bHe.count, bEn.count)
            if aCount > 0 || bCount > 0 {
                var entries: [CommentaryEntry] = []
                var idx = 0
                for i in 0..<aCount {
                    let h = i < aHe.count ? aHe[i] : ""
                    let e = i < aEn.count ? aEn[i] : ""
                    guard !h.trimmingCharacters(in: .whitespaces).isEmpty ||
                          !e.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                    entries.append(.text(index: idx, he: h, en: e)); idx += 1
                }
                if bCount > 0 {
                    entries.append(.recensionHeader("עמוד ב׳"))
                    for i in 0..<bCount {
                        let h = i < bHe.count ? bHe[i] : ""
                        let e = i < bEn.count ? bEn[i] : ""
                        guard !h.trimmingCharacters(in: .whitespaces).isEmpty ||
                              !e.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                        entries.append(.text(index: idx, he: h, en: e)); idx += 1
                    }
                }
                panel.commentaryEntries = entries
            }
        }

        // No-commentary is a normal state — leave commentaryError nil so the
        // panel shows a quiet "nothing here" message rather than a warning.
        panel.loadVersion += 1
        panel.isLoadingCommentary = false
    }

    // MARK: - Introduction helpers

    /// True when the current position is the first section of its parent text
    /// (chapter 1, daf 2/startDaf, siman 1) — the place where introductions appear.
    private var isAtFirstSection: Bool {
        switch category {
        case .tanakh:        return tanakhChapter == 1
        case .mishnah:       return mishnahChapter == 1
        case .talmud:        return talmudDaf == currentTalmudTractate?.startDaf
        case .rambam:        return rambamChapter == 1   // chapter 0 is intro, not "first chapter"
        case .tur:           return turSiman == 1
        case .shulchanArukh: return saSiman == 1
        case .midrash:
            if midrashNavigationMode == .native {
                return midrashNativeChapter == 1 && midrashNativeSection == 1
            }
            return midrashChapter == 1 && midrashVerse == 1
        case .teshuvot:
            return teshuvotVolume == 1 && teshuvotSiman == 1
        }
    }

    /// Given a full commentary ref (possibly with a ":1-N" depth-3 suffix), strips the
    /// trailing chapter/daf number and returns a "{base} Introduction" ref to try.
    /// Returns nil if the ref doesn't end with a plain number.
    private static func introRef(for commentaryRef: String) -> String? {
        // Strip depth-3 range suffix, e.g. "Ramban on Numbers 1:1-200" → "Ramban on Numbers 1"
        let noRange = commentaryRef.components(separatedBy: ":").first ?? commentaryRef
        // Strip trailing " {number}" to get the book-level title
        let parts = noRange.components(separatedBy: " ")
        guard let last = parts.last, Int(last) != nil, parts.count > 1 else { return nil }
        return parts.dropLast().joined(separator: " ") + ", Introduction"
    }

    /// Fetches he/en for `ref` in a single aligned request and returns CommentaryEntry.text values
    /// numbered starting from `startIdx`.  Returns [] if the ref has no content.
    private func fetchIntroEntries(ref: String, startIdx: Int) async -> [CommentaryEntry] {
        guard let (hSegs, eSegs, _) = try? await SefariaTextClient.shared.fetchBothAligned(ref: ref) else {
            return []
        }
        let count = max(hSegs.count, eSegs.count)
        guard count > 0 else { return [] }
        var seqIdx = startIdx
        return (0..<count).compactMap { i in
            let h = i < hSegs.count ? hSegs[i] : ""
            let e = i < eSegs.count ? eSegs[i] : ""
            guard !h.trimmingCharacters(in: .whitespaces).isEmpty ||
                  !e.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
            let entry = CommentaryEntry.text(index: seqIdx, label: nil, he: h, en: e)
            seqIdx += 1
            return entry
        }
    }

    /// Prepends introduction entries to `entries`, re-indexing existing text entries
    /// so numbering stays sequential (intro: 0…iCount-1, main: iCount…).
    private func prependIntro(to entries: [CommentaryEntry], introRef: String) async -> [CommentaryEntry] {
        let introEntries = await fetchIntroEntries(ref: introRef, startIdx: 0)
        guard !introEntries.isEmpty else { return entries }
        let iCount = introEntries.count
        let shifted: [CommentaryEntry] = entries.map { entry in
            if case .text(let idx, let lbl, let h, let e) = entry {
                return .text(index: idx + iCount, label: lbl, he: h, en: e)
            }
            return entry
        }
        return introEntries + shifted
    }

    // MARK: - Navigation

    func navigatePrevious() async {
        switch category {
        case .tanakh:
            if tanakhChapter > 1 {
                tanakhChapter -= 1
            } else if tanakhBookIndex > 0 {
                tanakhBookIndex -= 1
                tanakhChapter = TextCatalog.allTanakhBooks[tanakhBookIndex].chapters
            }
        case .mishnah:
            if mishnahChapter > 1 {
                mishnahChapter -= 1
            }
        case .talmud:
            if let t = currentTalmudTractate, talmudDaf > t.startDaf {
                talmudDaf -= 1
            }
        case .rambam:
            // Only go to chapter 0 if an intro exists; otherwise stop at chapter 1
            let minChapter = rambamHasIntro ? 0 : 1
            if rambamChapter > minChapter { rambamChapter -= 1 } else { break }
        case .tur:
            if turSiman > 1 { turSiman -= 1 }
        case .shulchanArukh:
            if saSiman > 1 { saSiman -= 1 }
        case .midrash:
            if midrashNavigationMode == .native {
                if !midrashWork.nativeIsOneLevel && midrashNativeSection > 1 {
                    midrashNativeSection -= 1
                } else if midrashNativeChapter > 1 {
                    midrashNativeChapter -= 1
                    midrashNativeSection = 1
                }
            } else {
                if midrashVerse > 1 { midrashVerse -= 1 }
                else if midrashChapter > 1 { midrashChapter -= 1 }
            }
        case .teshuvot:
            if teshuvotSiman > 1 {
                teshuvotSiman -= 1
            } else if teshuvotWork.volumeLabel != nil && teshuvotVolume > 1 {
                teshuvotVolume -= 1
            }
        }
        await load()
    }

    func navigateNext() async {
        switch category {
        case .tanakh:
            let bookChapters = TextCatalog.allTanakhBooks[tanakhBookIndex].chapters
            if tanakhChapter < bookChapters {
                tanakhChapter += 1
            } else if tanakhBookIndex < TextCatalog.allTanakhBooks.count - 1 {
                tanakhBookIndex += 1
                tanakhChapter = 1
            }
        case .mishnah:
            if let t = currentMishnahTractate, mishnahChapter < t.chapters {
                mishnahChapter += 1
            }
        case .talmud:
            if let t = currentTalmudTractate, talmudDaf < t.endDaf {
                talmudDaf += 1
            }
        case .rambam:
            if let w = currentRambamWork, rambamChapter < w.chapters { rambamChapter += 1 }
        case .tur:
            let maxSiman = TextCatalog.turSections[turSection].simanim
            if turSiman < maxSiman { turSiman += 1 }
        case .shulchanArukh:
            let maxSiman = TextCatalog.shulchanArukhSections[saSection].simanim
            if saSiman < maxSiman { saSiman += 1 }
        case .midrash:
            if midrashNavigationMode == .native {
                // For two-level works, increment section first; sections/chapter vary so
                // we bump unconditionally and let the load() fail with noText if past end.
                if !midrashWork.nativeIsOneLevel {
                    midrashNativeSection += 1
                } else if midrashNativeChapter < midrashWork.nativeMaxChapters {
                    midrashNativeChapter += 1
                }
            } else {
                let maxVerse = torahVerseCount(bookIndex: midrashBookIndex, chapter: midrashChapter)
                if midrashVerse < maxVerse {
                    midrashVerse += 1
                } else {
                    let bookChapters = TextCatalog.allTanakhBooks.first(where: { $0.id == midrashBookIndex })?.chapters ?? 1
                    if midrashChapter < bookChapters { midrashChapter += 1 }
                }
            }
        case .teshuvot:
            if teshuvotSiman < TeshuvotWork.placeholderMaxSiman {
                teshuvotSiman += 1
            } else if teshuvotWork.volumeLabel != nil && teshuvotVolume < teshuvotWork.volumeCount {
                teshuvotVolume += 1
                teshuvotSiman = 1
            }
        }
        await load()
    }
}
