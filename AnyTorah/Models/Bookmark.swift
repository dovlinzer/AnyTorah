import Foundation

/// A saved location in any Torah text, with an optional user note.
struct Bookmark: Codable, Identifiable {
    let id: UUID
    var name: String        // user-editable label
    var notes: String       // user-editable note
    let createdAt: Date

    // Human-readable subtitle shown in the list (e.g. "Talmud · Berakhot 2")
    let subtitle: String

    // Category
    let category: TextCategory

    // Which sibling of a flat home-screen pair this bookmark belongs to (Mishnah/Tosefta,
    // Talmud Bavli/Yerushalmi) — defaulted for bookmarks saved before these fields existed
    // (see the custom decoder below), where the default matches each subcategory's own
    // pre-existing fallback (`.mishnah`, `.bavli`).
    let mishnahSubcategory: MishnahSubcategory
    let talmudSubcategory: TalmudSubcategory

    // All VM indices — only the subset relevant to the category is meaningful,
    // but storing all avoids conditionals when restoring.
    let tanakhBookIndex: Int
    let tanakhChapter: Int
    let mishnahSederIndex: Int
    let mishnahTractateIndexInSeder: Int
    let mishnahChapter: Int
    let talmudSederIndex: Int
    let talmudTractateIndexInSeder: Int
    let talmudDaf: Int
    let rambamSeferIndex: Int
    let rambamWorkIndexInSefer: Int
    let rambamChapter: Int
    let saSection: Int
    let saSiman: Int
    let turSection: Int
    let turSiman: Int

    // Midrash Halakha/Aggada — mirrors Android's Bookmark.kt, which has always had these.
    // "By verse" navigation only (bookIndex/chapter/verse) — matches what Android supports;
    // "Native" mode's own chapter/section indices aren't captured here either.
    let midrashSubcategory: MidrashSubcategory
    let midrashWork: MidrashWork
    let midrashBookIndex: Int
    let midrashChapter: Int
    let midrashVerse: Int

    // Teshuvot Rishonim — added alongside the category itself, not as a later fix.
    let teshuvotSubcategory: TeshuvotSubcategory
    let teshuvotWork: TeshuvotWork
    let teshuvotVolume: Int
    let teshuvotSiman: Int

    /// Returns true if name, notes, or subtitle contain the query (case-insensitive).
    func matches(_ query: String) -> Bool {
        let q = query.lowercased()
        return name.lowercased().contains(q)
            || notes.lowercased().contains(q)
            || subtitle.lowercased().contains(q)
    }

    /// Explicit memberwise initializer (needed because the custom `init(from:)` below
    /// suppresses Swift's automatically-synthesized one).
    init(id: UUID, name: String, notes: String, createdAt: Date, subtitle: String,
         category: TextCategory,
         mishnahSubcategory: MishnahSubcategory = .mishnah,
         talmudSubcategory: TalmudSubcategory = .bavli,
         tanakhBookIndex: Int, tanakhChapter: Int,
         mishnahSederIndex: Int, mishnahTractateIndexInSeder: Int, mishnahChapter: Int,
         talmudSederIndex: Int, talmudTractateIndexInSeder: Int, talmudDaf: Int,
         rambamSeferIndex: Int, rambamWorkIndexInSefer: Int, rambamChapter: Int,
         saSection: Int, saSiman: Int,
         turSection: Int = 0, turSiman: Int = 1,
         midrashSubcategory: MidrashSubcategory = .halakha,
         midrashWork: MidrashWork = .mekhiltaYishmael,
         midrashBookIndex: Int = 1, midrashChapter: Int = 1, midrashVerse: Int = 1,
         teshuvotSubcategory: TeshuvotSubcategory = .rishonim,
         teshuvotWork: TeshuvotWork = .rashi,
         teshuvotVolume: Int = 1, teshuvotSiman: Int = 1) {
        self.id = id
        self.name = name
        self.notes = notes
        self.createdAt = createdAt
        self.subtitle = subtitle
        self.category = category
        self.mishnahSubcategory = mishnahSubcategory
        self.talmudSubcategory = talmudSubcategory
        self.tanakhBookIndex = tanakhBookIndex
        self.tanakhChapter = tanakhChapter
        self.mishnahSederIndex = mishnahSederIndex
        self.mishnahTractateIndexInSeder = mishnahTractateIndexInSeder
        self.mishnahChapter = mishnahChapter
        self.talmudSederIndex = talmudSederIndex
        self.talmudTractateIndexInSeder = talmudTractateIndexInSeder
        self.talmudDaf = talmudDaf
        self.rambamSeferIndex = rambamSeferIndex
        self.rambamWorkIndexInSefer = rambamWorkIndexInSefer
        self.rambamChapter = rambamChapter
        self.saSection = saSection
        self.saSiman = saSiman
        self.turSection = turSection
        self.turSiman = turSiman
        self.midrashSubcategory = midrashSubcategory
        self.midrashWork = midrashWork
        self.midrashBookIndex = midrashBookIndex
        self.midrashChapter = midrashChapter
        self.midrashVerse = midrashVerse
        self.teshuvotSubcategory = teshuvotSubcategory
        self.teshuvotWork = teshuvotWork
        self.teshuvotVolume = teshuvotVolume
        self.teshuvotSiman = teshuvotSiman
    }

    /// Custom decoder so bookmarks saved before Tur/Midrash/subcategory fields existed
    /// (missing those keys) still decode successfully instead of failing the whole array and
    /// silently wiping all of the user's existing bookmarks.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        notes = try c.decode(String.self, forKey: .notes)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        subtitle = try c.decode(String.self, forKey: .subtitle)
        category = try c.decode(TextCategory.self, forKey: .category)
        mishnahSubcategory = try c.decodeIfPresent(MishnahSubcategory.self, forKey: .mishnahSubcategory) ?? .mishnah
        talmudSubcategory = try c.decodeIfPresent(TalmudSubcategory.self, forKey: .talmudSubcategory) ?? .bavli
        tanakhBookIndex = try c.decode(Int.self, forKey: .tanakhBookIndex)
        tanakhChapter = try c.decode(Int.self, forKey: .tanakhChapter)
        mishnahSederIndex = try c.decode(Int.self, forKey: .mishnahSederIndex)
        mishnahTractateIndexInSeder = try c.decode(Int.self, forKey: .mishnahTractateIndexInSeder)
        mishnahChapter = try c.decode(Int.self, forKey: .mishnahChapter)
        talmudSederIndex = try c.decode(Int.self, forKey: .talmudSederIndex)
        talmudTractateIndexInSeder = try c.decode(Int.self, forKey: .talmudTractateIndexInSeder)
        talmudDaf = try c.decode(Int.self, forKey: .talmudDaf)
        rambamSeferIndex = try c.decode(Int.self, forKey: .rambamSeferIndex)
        rambamWorkIndexInSefer = try c.decode(Int.self, forKey: .rambamWorkIndexInSefer)
        rambamChapter = try c.decode(Int.self, forKey: .rambamChapter)
        saSection = try c.decode(Int.self, forKey: .saSection)
        saSiman = try c.decode(Int.self, forKey: .saSiman)
        turSection = try c.decodeIfPresent(Int.self, forKey: .turSection) ?? 0
        turSiman = try c.decodeIfPresent(Int.self, forKey: .turSiman) ?? 1
        midrashSubcategory = try c.decodeIfPresent(MidrashSubcategory.self, forKey: .midrashSubcategory) ?? .halakha
        midrashWork = try c.decodeIfPresent(MidrashWork.self, forKey: .midrashWork) ?? .mekhiltaYishmael
        midrashBookIndex = try c.decodeIfPresent(Int.self, forKey: .midrashBookIndex) ?? 1
        midrashChapter = try c.decodeIfPresent(Int.self, forKey: .midrashChapter) ?? 1
        midrashVerse = try c.decodeIfPresent(Int.self, forKey: .midrashVerse) ?? 1
        teshuvotSubcategory = try c.decodeIfPresent(TeshuvotSubcategory.self, forKey: .teshuvotSubcategory) ?? .rishonim
        teshuvotWork = try c.decodeIfPresent(TeshuvotWork.self, forKey: .teshuvotWork) ?? .rashi
        teshuvotVolume = try c.decodeIfPresent(Int.self, forKey: .teshuvotVolume) ?? 1
        teshuvotSiman = try c.decodeIfPresent(Int.self, forKey: .teshuvotSiman) ?? 1
    }

    /// Creates a Bookmark snapshot from the current ViewModel state.
    @MainActor
    static func from(vm: TextReaderViewModel) -> Bookmark {
        Bookmark(
            id: UUID(),
            name: vm.displayTitle,
            notes: "",
            createdAt: Date(),
            subtitle: "\(vm.categoryDisplayName) · \(vm.displayTitle)",
            category: vm.category,
            mishnahSubcategory:          vm.mishnahSubcategory,
            talmudSubcategory:           vm.talmudSubcategory,
            tanakhBookIndex:             vm.tanakhBookIndex,
            tanakhChapter:               vm.tanakhChapter,
            mishnahSederIndex:           vm.mishnahSederIndex,
            mishnahTractateIndexInSeder: vm.mishnahTractateIndexInSeder,
            mishnahChapter:              vm.mishnahChapter,
            talmudSederIndex:            vm.talmudSederIndex,
            talmudTractateIndexInSeder:  vm.talmudTractateIndexInSeder,
            talmudDaf:                   vm.talmudDaf,
            rambamSeferIndex:            vm.rambamSeferIndex,
            rambamWorkIndexInSefer:      vm.rambamWorkIndexInSefer,
            rambamChapter:               vm.rambamChapter,
            saSection:                   vm.saSection,
            saSiman:                     vm.saSiman,
            turSection:                  vm.turSection,
            turSiman:                    vm.turSiman,
            midrashSubcategory:          vm.midrashSubcategory,
            midrashWork:                 vm.midrashWork,
            midrashBookIndex:            vm.midrashBookIndex,
            midrashChapter:              vm.midrashChapter,
            midrashVerse:                vm.midrashVerse,
            teshuvotSubcategory:         vm.teshuvotSubcategory,
            teshuvotWork:                vm.teshuvotWork,
            teshuvotVolume:              vm.teshuvotVolume,
            teshuvotSiman:               vm.teshuvotSiman
        )
    }

    /// Restores this bookmark's location into the given ViewModel.
    @MainActor
    func apply(to vm: TextReaderViewModel) {
        vm.category                     = category
        vm.mishnahSubcategory           = mishnahSubcategory
        vm.talmudSubcategory            = talmudSubcategory
        vm.tanakhBookIndex              = tanakhBookIndex
        vm.tanakhChapter                = tanakhChapter
        vm.mishnahSederIndex            = mishnahSederIndex
        vm.mishnahTractateIndexInSeder  = mishnahTractateIndexInSeder
        vm.mishnahChapter               = mishnahChapter
        vm.talmudSederIndex             = talmudSederIndex
        vm.talmudTractateIndexInSeder   = talmudTractateIndexInSeder
        vm.talmudDaf                    = talmudDaf
        vm.rambamSeferIndex             = rambamSeferIndex
        vm.rambamWorkIndexInSefer       = rambamWorkIndexInSefer
        vm.rambamChapter                = rambamChapter
        vm.saSection                    = saSection
        vm.saSiman                      = saSiman
        vm.turSection                   = turSection
        vm.turSiman                     = turSiman
        vm.midrashSubcategory           = midrashSubcategory
        vm.midrashWork                  = midrashWork
        vm.midrashBookIndex             = midrashBookIndex
        vm.midrashChapter               = midrashChapter
        vm.midrashVerse                 = midrashVerse
        vm.teshuvotSubcategory          = teshuvotSubcategory
        vm.teshuvotWork                 = teshuvotWork
        vm.teshuvotVolume               = teshuvotVolume
        vm.teshuvotSiman                = teshuvotSiman
    }
}
