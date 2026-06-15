import SwiftUI

struct CategoryMenuView: View {
    @Binding var selectedCategory: TextCategory?
    let appBg: Color
    let appFg: Color

    @State private var showSettings = false
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                ZStack(alignment: .topLeading) {
                    VStack(spacing: 4) {
                        Text("AnyTorah")
                            .font(.largeTitle.bold())
                            .foregroundStyle(appFg)
                    }
                    .frame(maxWidth: .infinity)

                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gear")
                            .font(.title3)
                            .foregroundStyle(appFg.opacity(0.75))
                            .padding(8)
                    }
                }
                .padding(.top, 40)

                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(TextCategory.allCases) { cat in
                        CategoryCard(category: cat, fg: appFg) {
                            selectedCategory = cat
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .background(appBg.ignoresSafeArea())
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }
}

private struct CategoryCard: View {
    let category: TextCategory
    let fg: Color
    let onTap: () -> Void

    @State private var pressed = false

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 12) {
                Image(systemName: category.icon)
                    .font(.system(size: 36))
                    .foregroundStyle(fg)

                VStack(spacing: 2) {
                    Text(category.displayName)
                        .font(.headline.bold())
                        .foregroundStyle(fg)
                    Text(category.hebrewName)
                        .font(.subheadline)
                        .foregroundStyle(fg.opacity(0.75))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(fg.opacity(pressed ? 0.18 : 0.10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(fg.opacity(0.22), lineWidth: 0.5)
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(pressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 0.8), value: pressed)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: 50, pressing: { p in
            pressed = p
        }, perform: {})
    }
}
