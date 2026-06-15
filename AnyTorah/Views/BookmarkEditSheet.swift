import SwiftUI

struct BookmarkEditSheet: View {
    @Bindable var bookmarkManager: BookmarkManager
    @Environment(\.dismiss) private var dismiss

    let vm: TextReaderViewModel
    let existingBookmark: Bookmark?

    @State private var name: String = ""
    @State private var notes: String = ""

    private var isEditing: Bool { existingBookmark != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("Bookmark Name") {
                    TextField("Name", text: $name)
                }

                Section("Notes") {
                    TextField("Add notes…", text: $notes, axis: .vertical)
                        .lineLimit(4...8)
                }

                Section("Location") {
                    LabeledContent("Category", value: vm.category.displayName)
                    LabeledContent("Passage",  value: vm.displayTitle)
                }
            }
            .navigationTitle(isEditing ? "Edit Bookmark" : "New Bookmark")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let existing = existingBookmark {
                    name  = existing.name
                    notes = existing.notes
                } else {
                    name = vm.displayTitle
                }
            }
        }
    }

    private func save() {
        if var existing = existingBookmark {
            existing.name  = name
            existing.notes = notes
            bookmarkManager.update(existing)
        } else {
            var bm = Bookmark.from(vm: vm)
            // Reconstruct with edited name/notes (Bookmark.from gives defaults)
            let updated = Bookmark(
                id: bm.id, name: name, notes: notes,
                createdAt: bm.createdAt, subtitle: bm.subtitle,
                category: bm.category,
                tanakhBookIndex: bm.tanakhBookIndex, tanakhChapter: bm.tanakhChapter,
                mishnahSederIndex: bm.mishnahSederIndex,
                mishnahTractateIndexInSeder: bm.mishnahTractateIndexInSeder,
                mishnahChapter: bm.mishnahChapter,
                talmudSederIndex: bm.talmudSederIndex,
                talmudTractateIndexInSeder: bm.talmudTractateIndexInSeder,
                talmudDaf: bm.talmudDaf,
                rambamSeferIndex: bm.rambamSeferIndex,
                rambamWorkIndexInSefer: bm.rambamWorkIndexInSefer,
                rambamChapter: bm.rambamChapter,
                saSection: bm.saSection, saSiman: bm.saSiman
            )
            bookmarkManager.add(updated)
        }
        dismiss()
    }
}
