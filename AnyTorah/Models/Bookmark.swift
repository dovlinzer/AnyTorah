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

    /// Returns true if name, notes, or subtitle contain the query (case-insensitive).
    func matches(_ query: String) -> Bool {
        let q = query.lowercased()
        return name.lowercased().contains(q)
            || notes.lowercased().contains(q)
            || subtitle.lowercased().contains(q)
    }

    /// Creates a Bookmark snapshot from the current ViewModel state.
    @MainActor
    static func from(vm: TextReaderViewModel) -> Bookmark {
        Bookmark(
            id: UUID(),
            name: vm.displayTitle,
            notes: "",
            createdAt: Date(),
            subtitle: "\(vm.category.displayName) · \(vm.displayTitle)",
            category: vm.category,
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
            saSiman:                     vm.saSiman
        )
    }

    /// Restores this bookmark's location into the given ViewModel.
    @MainActor
    func apply(to vm: TextReaderViewModel) {
        vm.category                     = category
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
    }
}
