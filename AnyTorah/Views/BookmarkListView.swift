import SwiftUI

struct BookmarkListView: View {
    @Bindable var bookmarkManager: BookmarkManager
    @Environment(\.dismiss) private var dismiss

    /// Called when the user taps a row to navigate to that passage.
    var onNavigate: ((Bookmark) -> Void)?

    @State private var searchText = ""

    private var filtered: [Bookmark] {
        searchText.isEmpty
            ? bookmarkManager.bookmarks
            : bookmarkManager.bookmarks.filter { $0.matches(searchText) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if bookmarkManager.bookmarks.isEmpty {
                    ContentUnavailableView(
                        "No Bookmarks",
                        systemImage: "bookmark",
                        description: Text("Tap the bookmark icon while reading to save your place.")
                    )
                } else if filtered.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                } else {
                    List {
                        ForEach(filtered) { bookmark in
                            Button {
                                onNavigate?(bookmark)
                                dismiss()
                            } label: {
                                BookmarkRow(bookmark: bookmark)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    bookmarkManager.delete(bookmark)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .searchable(text: $searchText, prompt: "Search bookmarks")
            .navigationTitle("Bookmarks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
    }
}

// MARK: - Row

private struct BookmarkRow: View {
    let bookmark: Bookmark

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(bookmark.name)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(bookmark.subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if !bookmark.notes.isEmpty {
                Text(bookmark.notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Text(bookmark.createdAt, style: .relative)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}
