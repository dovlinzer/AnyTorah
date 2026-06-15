import SwiftUI

struct SettingsView: View {
    @AppStorage("useWhiteBackground") private var useWhiteBackground: Bool = false
    @AppStorage("saHebrewMode") private var saHebrewMode: Bool = false
    @AppStorage("reverseNavDirection") private var reverseNavDirection: Bool = false
    @AppStorage("anyTorahFontSize") private var fontSizeLevel: Double = 0
    @AppStorage("showTrop") private var showTrop: Bool = false
    @AppStorage("commentaryLayout") private var commentaryLayoutRaw: String = CommentaryLayout.bottomPanel.rawValue
    @AppStorage("sidePanelContrast") private var sidePanelContrast: Bool = false
    @AppStorage("useRashiFont") private var useRashiFont: Bool = false

    private var fontSizeName: String {
        switch Int(fontSizeLevel) {
        case -2: return "Smallest"
        case -1: return "Small"
        case  1: return "Large"
        case  2: return "Largest"
        default: return "Default"
        }
    }
    @Environment(\.dismiss) private var dismiss

    private var commentaryLayout: CommentaryLayout {
        CommentaryLayout(rawValue: commentaryLayoutRaw) ?? .bottomPanel
    }

    private var isPhone: Bool {
        UIDevice.current.userInterfaceIdiom == .phone
    }

    private var appBg: Color {
        useWhiteBackground ? .white : Color(red: 0.106, green: 0.227, blue: 0.541)
    }
    private var appFg: Color {
        useWhiteBackground ? Color(.label) : .white
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Display") {
                    Toggle("White Background", isOn: $useWhiteBackground)
                }
                Section("Text Size") {
                    let levels: [Int] = [-2, -1, 0, 1, 2]
                    let currentIdx = levels.firstIndex(of: Int(fontSizeLevel)) ?? 2
                    HStack(spacing: 0) {
                        // Small A
                        Button {
                            if currentIdx > 0 { fontSizeLevel = Double(levels[currentIdx - 1]) }
                        } label: {
                            Text("A")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(currentIdx > 0 ? appFg : appFg.opacity(0.3))
                                .frame(width: 36, height: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        // Dots — growing circles; filled dot marks the active level
                        HStack(spacing: 0) {
                            Spacer(minLength: 4)
                            ForEach(levels.indices, id: \.self) { i in
                                let dotSize: CGFloat = 5 + CGFloat(i) * 2
                                Circle()
                                    .fill(i == currentIdx ? appFg : appFg.opacity(0.25))
                                    .frame(width: dotSize, height: dotSize)
                                    .animation(.spring(response: 0.25), value: fontSizeLevel)
                                    .onTapGesture {
                                        fontSizeLevel = Double(levels[i])
                                    }
                                if i < levels.count - 1 { Spacer(minLength: 4) }
                            }
                            Spacer(minLength: 4)
                        }
                        .frame(maxWidth: .infinity)

                        // Large A
                        Button {
                            if currentIdx < levels.count - 1 {
                                fontSizeLevel = Double(levels[currentIdx + 1])
                            }
                        } label: {
                            Text("A")
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(currentIdx < levels.count - 1 ? appFg : appFg.opacity(0.3))
                                .frame(width: 36, height: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 2)
                    Text(fontSizeName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                Section("Hebrew Text") {
                    Toggle("Show cantillation marks (trop)", isOn: $showTrop)
                    Text(showTrop
                         ? "Cantillation marks (טַעֲמֵי הַמִּקְרָא) are shown in Tanakh text alongside the vowels."
                         : "Only vowel points (niqqud) are shown. Cantillation marks are hidden for cleaner reading.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section("Navigation") {
                    Toggle("Hebrew (RTL) Navigation", isOn: $saHebrewMode)
                    Text(saHebrewMode
                         ? "All categories show Hebrew names with RTL column order; numbers as Hebrew numerals."
                         : "All categories show English names with LTR column order; Arabic numerals.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Toggle("Reverse Navigation Direction", isOn: $reverseNavDirection)
                    Text(reverseNavDirection
                         ? "Left arrow/swipe moves forward; right arrow/swipe moves backward."
                         : "Left arrow/swipe moves backward; right arrow/swipe moves forward.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section("Commentary Panels") {
                    if !isPhone {
                        Picker("Commentaries appear", selection: $commentaryLayoutRaw) {
                            ForEach(CommentaryLayout.allCases, id: \.rawValue) { layout in
                                Text(layout.displayName).tag(layout.rawValue)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    if !useWhiteBackground {
                        Toggle("Light commentary panel", isOn: $sidePanelContrast)
                    }
                    Toggle("Rashi script for Rashi commentary", isOn: $useRashiFont)
                }
            }
            .scrollContentBackground(.hidden)
            .background(appBg.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(appBg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(appFg)
                }
            }
        }
        .preferredColorScheme(useWhiteBackground ? .light : .dark)
    }
}
