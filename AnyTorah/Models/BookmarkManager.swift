import Foundation

@MainActor
@Observable
final class BookmarkManager {
    var bookmarks: [Bookmark] = []

    private static let fileURL: URL = {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("anyTorah_bookmarks.json")
    }()

    init() { load() }

    // MARK: - CRUD

    func add(_ bookmark: Bookmark) {
        bookmarks.insert(bookmark, at: 0)
        save()
    }

    func delete(at offsets: IndexSet) {
        bookmarks.remove(atOffsets: offsets)
        save()
    }

    func delete(_ bookmark: Bookmark) {
        bookmarks.removeAll { $0.id == bookmark.id }
        save()
    }

    func update(_ bookmark: Bookmark) {
        guard let idx = bookmarks.firstIndex(where: { $0.id == bookmark.id }) else { return }
        bookmarks[idx] = bookmark
        save()
    }

    func isBookmarked(id: UUID) -> Bool {
        bookmarks.contains { $0.id == id }
    }

    /// Returns true if the given ViewModel location is already bookmarked.
    func isCurrentLocationBookmarked(vm: TextReaderViewModel) -> Bool {
        bookmarks.contains { $0.category == vm.category && $0.subtitle == Bookmark.from(vm: vm).subtitle }
    }

    func existingBookmark(for vm: TextReaderViewModel) -> Bookmark? {
        let subtitle = Bookmark.from(vm: vm).subtitle
        return bookmarks.first { $0.category == vm.category && $0.subtitle == subtitle }
    }

    // MARK: - Persistence

    private func load() {
        guard FileManager.default.fileExists(atPath: Self.fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: Self.fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            bookmarks = try decoder.decode([Bookmark].self, from: data)
        } catch {
            print("BookmarkManager: load failed — \(error.localizedDescription)")
        }
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(bookmarks)
            try data.write(to: Self.fileURL, options: .atomic)
        } catch {
            print("BookmarkManager: save failed — \(error.localizedDescription)")
        }
    }
}
