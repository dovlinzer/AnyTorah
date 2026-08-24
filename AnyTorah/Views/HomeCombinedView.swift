import SwiftUI

/// Home screen: category buttons only. Tapping a category restores its last-used
/// selection (or a sensible default) and immediately opens the reader — book/chapter/daf
/// navigation happens from the picker controls in the reader's own header, not here.
struct HomeCombinedView: View {
    @Bindable var vm: TextReaderViewModel
    let appBg: Color
    let appFg: Color
    let onGo: () -> Void

    @State private var showSettings = false

    var body: some View {
        VStack(spacing: 0) {
            // Header: gear (left) + centered app title
            ZStack(alignment: .leading) {
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
            .padding(.bottom, 14)

            Spacer()

            CategoryGrid(fg: appFg, onSelect: selectCategory)
                .padding(.horizontal, 20)
                .frame(maxWidth: 480)

            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(appBg.ignoresSafeArea())
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    private func selectCategory(_ cat: TextCategory) {
        vm.category = cat
        vm.restoreState(for: cat)
        onGo()
    }
}

// MARK: - Category grid, wrapped 3-per-row

private struct CategoryGrid: View {
    let fg: Color
    let onSelect: (TextCategory) -> Void

    private static let cardHeight: CGFloat = 90
    private static let spacing: CGFloat = 8
    private static let perRow = 3

    // Chunks *all* cases into rows of `perRow`, so adding/removing a category (e.g. Tur) can
    // never silently drop one — a hardcoded prefix(3)/suffix(3) split here previously assumed
    // exactly 6 categories and dropped whichever one landed in the middle once a 7th was added.
    private var rows: [[TextCategory]] {
        let all = TextCategory.allCases
        return stride(from: 0, to: all.count, by: Self.perRow).map {
            Array(all[$0..<min($0 + Self.perRow, all.count)])
        }
    }

    var body: some View {
        GeometryReader { geo in
            let cardWidth = (geo.size.width - Self.spacing * 2) / CGFloat(Self.perRow)
            let rows = rows

            VStack(spacing: Self.spacing) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: Self.spacing) {
                        ForEach(row) { cat in
                            CompactCategoryCard(category: cat, fg: fg) {
                                onSelect(cat)
                            }
                            .frame(width: cardWidth, height: Self.cardHeight)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: row.count == Self.perRow ? .leading : .center)
                }
            }
        }
        .frame(height: Self.cardHeight * CGFloat(rows.count) + Self.spacing * CGFloat(max(0, rows.count - 1)))
    }
}

// MARK: - Category card

private struct CompactCategoryCard: View {
    let category: TextCategory
    let fg: Color
    let onTap: () -> Void

    @State private var pressed = false

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 5) {
                Image(systemName: category.icon)
                    .font(.system(size: 24))
                    .foregroundStyle(fg)
                Text(category.displayName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(fg.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(fg.opacity(pressed ? 0.14 : 0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(fg.opacity(0.15), lineWidth: 0.5)
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(pressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.8), value: pressed)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: 50, pressing: { p in
            pressed = p
        }, perform: {})
    }
}
