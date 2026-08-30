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
            VStack(spacing: 32) {
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

                teshuvotSection
            }
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(appBg.ignoresSafeArea())
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    /// Teshuvot gets its own row below the two-column grid, not a slot inside it — per explicit
    /// product direction, it's conceptually a third tier (rite/era of the responsa literature),
    /// not just another sibling pair like Mishnah/Tosefta. A horizontal divider + "Teshuvot"
    /// label separates it from the grid above, then three equal tiles: Rishonim, Acharonim
    /// (both Sefaria-based), and Contemporary (PDF/scanned-page based — enabled 2026-08-29,
    /// see `ContemporaryTeshuvotWork` and CLAUDE.md's Contemporary Teshuvot section).
    private var teshuvotSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Divider().background(appFg.opacity(0.2))
            Text("Teshuvot")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(appFg)
            HStack(spacing: 12) {
                ForEach(HomeCategoryEntry.teshuvotRow) { entry in
                    categoryButton(entry)
                }
            }
        }
        .frame(maxWidth: 600)
        .padding(.horizontal, 16)
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
                .opacity(entry.isEnabled ? 1 : 0.4)
        }
        .buttonStyle(.plain)
        .disabled(!entry.isEnabled)
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
            // Teshuvot row tiles skip the icon entirely — three tiles share one row (vs. one
            // tile per full-width row in the two-column grid), so every point of width matters
            // for showing the full label ("Contemporary" in particular).
            if !entry.compact {
                Image(systemName: entry.icon)
                    .font(.title3)
            }
            Text(entry.label)
                // Same reasoning as dropping the icon — a smaller weight lets longer labels
                // fit in the Teshuvot row's narrower per-tile width without wrapping.
                .font(entry.compact ? .caption.weight(.semibold) : .subheadline.weight(.semibold))
                .lineLimit(2)
                .minimumScaleFactor(entry.compact ? 0.8 : 1)
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(entry.compact ? 10 : 14)
        // maxHeight pinned to the same value as minHeight (not just a floor) so the three
        // Teshuvot row tiles come out identically tall regardless of whether their label
        // happens to wrap to a second line — an HStack doesn't equalize sibling heights on its
        // own, so before this fix "Contemporary" (longer than "Rishonim"/"Acharonim") could
        // wrap and grow taller than its neighbors.
        .frame(maxWidth: .infinity, minHeight: entry.compact ? 52 : 64, maxHeight: entry.compact ? 52 : 64, alignment: .leading)
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
    /// False for the "Contemporary" Teshuvot placeholder — not a real category yet, so its tile
    /// renders dimmed and doesn't respond to taps. Every other entry defaults to enabled.
    var isEnabled: Bool = true
    /// True for the Teshuvot row tiles — three tiles share one row there (vs. one tile per
    /// full-width row in the two-column grid above), so `CategoryTile` drops the icon and uses
    /// a smaller label font to leave room for the full name.
    var compact: Bool = false
    // Kept last: trailing-closure call sites below rely on this being the final parameter (the
    // same ordering rule that applies on the Kotlin/Android side, for the same reason — see
    // CLAUDE.md's Teshuvot section).
    let applySelection: @MainActor (TextReaderViewModel) -> Void

    static let leftColumn: [HomeCategoryEntry] = [
        HomeCategoryEntry(id: "tanakh", label: "Tanakh", icon: "book.closed",
                           colorFamily: .purple, category: .tanakh) { _ in },
        HomeCategoryEntry(id: "midrashAggada", label: "Midrash Aggada", icon: "quote.bubble",
                           colorFamily: .violet, category: .midrash) { $0.midrashSubcategory = .aggada },
        HomeCategoryEntry(id: "midrashHalakha", label: "Midrash Halakha", icon: "text.book.closed",
                           colorFamily: .violet, category: .midrash) { $0.midrashSubcategory = .halakha },
        HomeCategoryEntry(id: "mishnah", label: "Mishnah", icon: "books.vertical",
                           colorFamily: .plum, category: .mishnah) { $0.mishnahSubcategory = .mishnah },
        HomeCategoryEntry(id: "tosefta", label: "Tosefta", icon: "doc.text",
                           colorFamily: .plum, category: .mishnah) { $0.mishnahSubcategory = .tosefta },
    ]

    static let rightColumn: [HomeCategoryEntry] = [
        HomeCategoryEntry(id: "talmudBavli", label: "Talmud Bavli", icon: "scroll",
                           colorFamily: .blue, category: .talmud) { $0.talmudSubcategory = .bavli },
        HomeCategoryEntry(id: "talmudYerushalmi", label: "Talmud Yerushalmi", icon: "building.columns",
                           colorFamily: .blue, category: .talmud) { $0.talmudSubcategory = .yerushalmi },
        HomeCategoryEntry(id: "tur", label: "Tur", icon: "list.bullet.rectangle",
                           colorFamily: .royalBlue, category: .tur) { _ in },
        HomeCategoryEntry(id: "shulchanArukh", label: "Shulkhan Arukh", icon: "checklist",
                           colorFamily: .royalBlue, category: .shulchanArukh) { _ in },
        HomeCategoryEntry(id: "rambam", label: "Rambam", icon: "star.circle",
                           colorFamily: .skyBlue, category: .rambam) { _ in },
    ]

    /// A third row below the two-column grid, not part of either column — see `teshuvotSection`.
    /// All three share the navy family (just different shades) so the row reads as one group,
    /// and all three are `compact` (no icon, smaller font) since three tiles split one row's
    /// width instead of each getting a full-width row like the grid above.
    static let teshuvotRow: [HomeCategoryEntry] = [
        HomeCategoryEntry(id: "teshuvotRishonim", label: "Rishonim", icon: "envelope",
                           colorFamily: .navy, category: .teshuvot, compact: true) { $0.teshuvotSubcategory = .rishonim },
        HomeCategoryEntry(id: "teshuvotAcharonim", label: "Acharonim", icon: "envelope",
                           colorFamily: .navySteel, category: .teshuvot, compact: true) { $0.teshuvotSubcategory = .acharonim },
        // "Contemp." not "Contemporary" — the full word is prone to wrapping to a second line
        // at this tile's width/font, which (before the tile's maxHeight fix above) made this
        // tile visibly taller than Rishonim/Acharonim.
        HomeCategoryEntry(id: "teshuvotContemporary", label: "Contemp.", icon: "envelope",
                           colorFamily: .navyDeep, category: .teshuvot, compact: true) { $0.teshuvotSubcategory = .contemporary },
    ]
}
