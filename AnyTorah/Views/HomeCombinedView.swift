import SwiftUI

struct HomeCombinedView: View {
    @Bindable var vm: TextReaderViewModel
    let appBg: Color
    let appFg: Color
    let onGo: () -> Void

    @AppStorage("lastSelectedCategory") private var lastCategoryRaw: String = ""
    @State private var activeCategory: TextCategory? = nil
    @State private var showSettings = false

    var body: some View {
        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            if isLandscape {
                landscapeLayout
            } else {
                portraitLayout
            }
        }
        .background(appBg.ignoresSafeArea())
        .sheet(isPresented: $showSettings) { SettingsView() }
        .onAppear {
            if activeCategory == nil, !lastCategoryRaw.isEmpty,
               let cat = TextCategory(rawValue: lastCategoryRaw) {
                activeCategory = cat
                vm.category = cat
            }
        }
    }

    // MARK: - Portrait

    private var portraitLayout: some View {
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

            // 2-row (3 + 3) category grid
            CategoryGrid(selectedCategory: activeCategory, fg: appFg, onSelect: selectCategory)
                .padding(.horizontal, 12)
                .padding(.bottom, 20)

            Rectangle()
                .fill(appFg.opacity(0.55))
                .frame(height: 1.5)
                .padding(.bottom, 4)

            // Selector pulls down from divider; empty state when nothing selected
            if activeCategory != nil {
                TextSelectorView(vm: vm, appBg: appBg, appFg: appFg, onBack: nil, onGo: onGo, showGear: false)
                    .transition(.move(edge: .top).combined(with: .opacity))
            } else {
                Spacer()
                Text("Select a category to begin")
                    .font(.subheadline)
                    .foregroundStyle(appFg.opacity(0.40))
                Spacer()
            }
        }
    }

    // MARK: - Landscape

    private var landscapeLayout: some View {
        HStack(spacing: 0) {
            // Left panel: title + gear + vertical category list
            VStack(spacing: 0) {
                ZStack(alignment: .leading) {
                    Text("AnyTorah")
                        .font(.headline.bold())
                        .foregroundStyle(appFg)
                        .frame(maxWidth: .infinity)
                    Button { showSettings = true } label: {
                        Image(systemName: "gear")
                            .font(.subheadline)
                            .foregroundStyle(appFg.opacity(0.75))
                            .padding(6)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.top, 14)
                .padding(.bottom, 10)

                VStack(spacing: 6) {
                    ForEach(TextCategory.allCases) { cat in
                        LandscapeCategoryButton(
                            category: cat,
                            isSelected: cat == activeCategory,
                            fg: appFg,
                            onTap: { selectCategory(cat) }
                        )
                    }
                }
                .padding(.horizontal, 10)

                Spacer()
            }
            .frame(width: 160)

            Divider().background(appFg.opacity(0.30))

            // Right panel: selector or empty state
            if activeCategory != nil {
                TextSelectorView(vm: vm, appBg: appBg, appFg: appFg, onBack: nil, onGo: onGo, showGear: false)
            } else {
                Spacer()
                Text("Select a category")
                    .font(.subheadline)
                    .foregroundStyle(appFg.opacity(0.40))
                Spacer()
            }
        }
    }

    // MARK: - Shared

    private func selectCategory(_ cat: TextCategory) {
        lastCategoryRaw = cat.rawValue
        vm.category = cat
        vm.restoreState(for: cat)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            activeCategory = cat
        }
    }
}

// MARK: - Portrait: 2-row (3 + 2) category grid

private struct CategoryGrid: View {
    let selectedCategory: TextCategory?
    let fg: Color
    let onSelect: (TextCategory) -> Void

    private static let cardHeight: CGFloat = 90
    private static let spacing: CGFloat = 8

    var body: some View {
        GeometryReader { geo in
            let cardWidth = (geo.size.width - Self.spacing * 2) / 3
            let row1 = Array(TextCategory.allCases.prefix(3))
            let row2 = Array(TextCategory.allCases.suffix(3))

            VStack(spacing: Self.spacing) {
                // Row 1: 3 cards
                HStack(spacing: Self.spacing) {
                    ForEach(row1) { cat in
                        CompactCategoryCard(category: cat, isSelected: cat == selectedCategory, fg: fg) {
                            onSelect(cat)
                        }
                        .frame(width: cardWidth, height: Self.cardHeight)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Row 2: 2 cards, same width, centered
                HStack(spacing: Self.spacing) {
                    ForEach(row2) { cat in
                        CompactCategoryCard(category: cat, isSelected: cat == selectedCategory, fg: fg) {
                            onSelect(cat)
                        }
                        .frame(width: cardWidth, height: Self.cardHeight)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .frame(height: Self.cardHeight * 2 + Self.spacing)
    }
}

// MARK: - Portrait card

private struct CompactCategoryCard: View {
    let category: TextCategory
    let isSelected: Bool
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
                    .foregroundStyle(fg.opacity(isSelected ? 1 : 0.75))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(fg.opacity(isSelected ? 0.22 : pressed ? 0.14 : 0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(fg.opacity(isSelected ? 0.50 : 0.15),
                                    lineWidth: isSelected ? 1.5 : 0.5)
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(pressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.8), value: pressed)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: 50, pressing: { p in
            pressed = p
        }, perform: {})
    }
}

// MARK: - Landscape category button (icon + name, horizontal)

private struct LandscapeCategoryButton: View {
    let category: TextCategory
    let isSelected: Bool
    let fg: Color
    let onTap: () -> Void

    @State private var pressed = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                Image(systemName: category.icon)
                    .font(.system(size: 17))
                    .frame(width: 22)
                    .foregroundStyle(fg)
                Text(category.displayName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(fg.opacity(isSelected ? 1 : 0.80))
                    .lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(fg.opacity(isSelected ? 0.22 : pressed ? 0.12 : 0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(fg.opacity(isSelected ? 0.50 : 0.12),
                                    lineWidth: isSelected ? 1.5 : 0.5)
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(pressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.8), value: pressed)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: 50, pressing: { p in pressed = p }, perform: {})
    }
}
