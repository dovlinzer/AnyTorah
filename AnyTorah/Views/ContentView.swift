import SwiftUI

private enum Screen: String {
    case home, reader
}

struct ContentView: View {
    @State private var screen: Screen = {
        let raw = UserDefaults.standard.string(forKey: "lastScreen") ?? ""
        return Screen(rawValue: raw) ?? .home
    }()
    @State private var vm = TextReaderViewModel()
    @State private var bookmarkManager = BookmarkManager()
    @State private var audioPlayer = AudioPlayer()
    @State private var showSplash = true
    @State private var dedication: Dedication? = nil
    @AppStorage("anytorahLastDedicationDateShown") private var lastDedicationDateShown: String = ""
    @Environment(\.scenePhase) private var scenePhase

    @AppStorage("useWhiteBackground") static var useWhiteBackground: Bool = false
    @AppStorage("useWhiteBackground") private var useWhiteBackground: Bool = false

    static var appBg: Color {
        if useWhiteBackground { return .white }
        return Color(red: 0.106, green: 0.227, blue: 0.541)
    }
    static var appFg: Color {
        if useWhiteBackground { return .primary }
        return .white
    }

    private var appBg: Color { ContentView.appBg }
    private var appFg: Color { ContentView.appFg }

    var body: some View {
        ZStack {
            if showSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(1)
            } else {
                mainContent
                    .transition(.opacity)
                    .zIndex(0)
            }
        }
        .animation(.easeOut(duration: 0.5), value: showSplash)
        .task {
            let today = DedicationService.todayDateString()
            let shouldCheck = today != lastDedicationDateShown
            let fetchTask = shouldCheck ? Task { await DedicationService.fetch() } : nil
            try? await Task.sleep(nanoseconds: 3_200_000_000)
            withAnimation { showSplash = false }
            if shouldCheck, let ded = await fetchTask?.value {
                lastDedicationDateShown = today
                dedication = ded
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, !showSplash else { return }
            let today = DedicationService.todayDateString()
            guard today != lastDedicationDateShown else { return }
            Task {
                if let ded = await DedicationService.fetch() {
                    lastDedicationDateShown = today
                    dedication = ded
                }
            }
        }
        .sheet(item: $dedication) { ded in
            DedicationBannerView(dedication: ded) { dedication = nil }
        }
    }

    private var mainContent: some View {
        ZStack {
            appBg.ignoresSafeArea()

            switch screen {
            case .home:
                HomeCombinedView(
                    vm: vm,
                    appBg: appBg,
                    appFg: appFg,
                    onGo: {
                        UserDefaults.standard.set(Screen.reader.rawValue, forKey: "lastScreen")
                        withAnimation(.easeInOut(duration: 0.25)) { screen = .reader }
                    }
                )
                .transition(.opacity)

            case .reader:
                TextReaderView(
                    vm: vm,
                    bookmarkManager: bookmarkManager,
                    audioPlayer: audioPlayer,
                    appBg: appBg,
                    appFg: appFg,
                    onBack: {
                        UserDefaults.standard.set(Screen.home.rawValue, forKey: "lastScreen")
                        withAnimation(.easeInOut(duration: 0.25)) { screen = .home }
                    }
                )
                .transition(.move(edge: .trailing))
            }
        }
        .preferredColorScheme(useWhiteBackground ? .light : .dark)
    }

}
