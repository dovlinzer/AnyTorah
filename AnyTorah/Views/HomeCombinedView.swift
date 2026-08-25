import SwiftUI

/// Home screen: category buttons only, styled after AnyYCTorah's two-column gradient tile
/// grid (`HomeView.swift`/`BrandGradients.swift`) — purple-family tiles on the left, blue-
/// family tiles on the right. Tapping a category restores its last-used selection (or a
/// sensible default) and immediately opens the reader — book/chapter/daf navigation happens
/// from the picker controls in the reader's own header, not here.
///
/// Mishnah/Tosefta, Talmud Bavli/Talmud Yerushalmi, and Midrash Halakha/Midrash Aggada are
/// each their own independent, flat entry here — not sub-choices within a shared category.
/// Under the hood they still share `TextCategory.mishnah`/`.talmud`/`.midrash` plus a fixed
/// subcategory (that's how the underlying Sefaria data and navigation wheels are genuinely
/// organized), but nothing downstream ever re-presents that as a toggle or a nested choice —
/// see `TextReaderViewModel.categoryDisplayName` and `TextSelectorView`'s removed subcategory
/// toggle.
struct HomeCombinedView: View {
    @Bindable var vm: TextReaderViewModel
    let appBg: Color
    let appFg: Color
    let onGo: () -> Void

    @State private var showSettings = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header

                HStack(alignment: .top, spacing: 24) {
                    VStack(spacing: 18) {
                        ForEach(HomeCategoryEntry.leftColumn) { entry in
                            categoryButton(entry)
                        }
                    }
                    VStack(spacing: 18) {
                        ForEach(HomeCategoryEntry.rightColumn) { entry in
                            categoryButton(entry)
                        }
                    }
                }
                .frame(maxWidth: 600)
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(appBg.ignoresSafeArea())
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    private var header: some View {
        ZStack(alignment: .trailing) {
            Text("AnyTorah")
                .font(.title2.bold())
                .foregroundStyle(appFg)
                .frame(maxWidth: .infinity)
            Button { showSettings = true } label: {
                Image(systemName: "gear")
                    .font(.title3)
                    .foregroundStyle(appFg.opacity(0.75))
                    .padding(8)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 40)
    }

    private func categoryButton(_ entry: HomeCategoryEntry) -> some View {
        Button { select(entry) } label: {
            CategoryTile(entry: entry)
        }
        .buttonStyle(.plain)
    }

    private func select(_ entry: HomeCategoryEntry) {
        vm.category = entry.category
        vm.restoreState(for: entry.category)
        entry.applySelection(vm)
        onGo()
    }
}

// MARK: - Category tile (icon + label, gradient background — matches AnyYCTorah's TopicCard)

private struct CategoryTile: View {
    let entry: HomeCategoryEntry

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: entry.icon)
                .font(.title3)
            Text(entry.label)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
        .background(entry.colorFamily.gradient)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Category entries

private struct HomeCategoryEntry: Identifiable {
    let id: String
    let label: String
    let icon: String
    let colorFamily: BrandColorFamily
    let category: TextCategory
    /// Forces the specific subcategory this button represents. No-op for categories with no
    /// subcategory concept (Tanakh, Rambam, Tur, Shulkhan Arukh). `@MainActor`-annotated
    /// because `TextReaderViewModel` itself is `@MainActor` — without this, the closures
    /// below can't mutate its properties.
    let applySelection: @MainActor (TextReaderViewModel) -> Void

    static let leftColumn: [HomeCategoryEntry] = [
        HomeCategoryEntry(id: "tanakh", label: "Tanakh", icon: "book.closed",
                           colorFamily: .purple, category: .tanakh) { _ in },
        HomeCategoryEntry(id: "midrashAggada", label: "Midrash Aggada", icon: "quote.bubble",
                           colorFamily: .violet, category: .midrash) { $0.midrashSubcategory = .aggada },
        HomeCategoryEntry(id: "midrashHalakha", label: "Midrash Halakha", icon: "text.book.closed",
                           colorFamily: .plum, category: .midrash) { $0.midrashSubcategory = .halakha },
        HomeCategoryEntry(id: "mishnah", label: "Mishnah", icon: "books.vertical",
                           colorFamily: .blossom, category: .mishnah) { $0.mishnahSubcategory = .mishnah },
        HomeCategoryEntry(id: "tosefta", label: "Tosefta", icon: "doc.text",
                           colorFamily: .lavender, category: .mishnah) { $0.mishnahSubcategory = .tosefta },
    ]

    static let rightColumn: [HomeCategoryEntry] = [
        HomeCategoryEntry(id: "talmudBavli", label: "Talmud Bavli", icon: "scroll",
                           colorFamily: .blue, category: .talmud) { $0.talmudSubcategory = .bavli },
        HomeCategoryEntry(id: "talmudYerushalmi", label: "Talmud Yerushalmi", icon: "building.columns",
                           colorFamily: .blue, category: .talmud) { $0.talmudSubcategory = .yerushalmi },
        HomeCategoryEntry(id: "tur", label: "Tur", icon: "list.bullet.rectangle",
                           colorFamily: .royalBlue, category: .tur) { _ in },
        HomeCategoryEntry(id: "shulchanArukh", label: "Shulkhan Arukh", icon: "checklist",
                           colorFamily: .skyBlue, category: .shulchanArukh) { _ in },
        HomeCategoryEntry(id: "rambam", label: "Rambam", icon: "star.circle",
                           colorFamily: .teal, category: .rambam) { _ in },
    ]
}
