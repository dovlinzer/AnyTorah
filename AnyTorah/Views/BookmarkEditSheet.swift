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
                    LabeledContent("Category", value: vm.categoryDisplayName)
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
            // `name`/`notes` are the only `var` fields on Bookmark — mutate those directly
            // rather than reconstructing via the memberwise init, which previously dropped
            // every field it didn't explicitly forward (turSection/turSiman, and now the
            // subcategory + midrash fields too) back to their defaults.
            var bm = Bookmark.from(vm: vm)
            bm.name = name
            bm.notes = notes
            bookmarkManager.add(bm)
        }
        dismiss()
    }
}
