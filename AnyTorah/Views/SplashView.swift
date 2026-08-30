import SwiftUI
import AVFoundation

private class _PlayerContainer: UIView {
    private var playerLayer: AVPlayerLayer?

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = bounds
    }

    func configure(url: URL) {
        let player = AVPlayer(url: url)
        player.isMuted = true
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspect
        self.layer.addSublayer(layer)
        playerLayer = layer
        player.play()
    }
}

private struct YCTLogoAnimated: UIViewRepresentable {
    func makeUIView(context: Context) -> _PlayerContainer {
        let view = _PlayerContainer()
        view.backgroundColor = .clear
        if let url = Bundle.main.url(forResource: "yct_splash", withExtension: "mp4") {
            view.configure(url: url)
        }
        return view
    }
    func updateUIView(_ uiView: _PlayerContainer, context: Context) {}
}

struct SplashView: View {
    // Splash is always blue regardless of the app-wide background preference.
    private let bg = Color(red: 0.106, green: 0.227, blue: 0.541)
    private let fg = Color.white

    // yct_splash.mp4 is cropped to the YCT logo's own proportions (836x514) so the
    // rounded box matches the logo's shape instead of leaving empty space above/below it.
    private let logoAspectRatio: CGFloat = 836.0 / 514.0

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            GeometryReader { geo in
                let isPad = sizeClass == .regular
                let short = min(geo.size.width, geo.size.height)
                // AnyTorah's own text/logo sizes read too small on iPad's larger screen —
                // match AnyDaf's splash sizing there (AnyDaf's SplashView.swift: 42/17/13pt
                // text, logo width = short * 0.42). iPhone sizing is unchanged.
                let titleFont: Font = isPad ? .system(size: 42, weight: .bold) : .largeTitle.bold()
                let subtitleFont: Font = isPad ? .system(size: 17) : .subheadline
                let poweredByFont: Font = isPad ? .system(size: 13).italic() : .caption.italic()
                let logoWidth: CGFloat = isPad ? short * 0.42 : 260

                VStack(spacing: 0) {
                    // Text block: starts at ~22% from top (moved up ~20% from previous 42%)
                    Spacer().frame(height: geo.size.height * 0.22)

                    Text("AnyTorah")
                        .font(titleFont)
                        .foregroundStyle(fg)
                        .padding(.bottom, 6)

                    Text("Access Torah, instantly")
                        .font(subtitleFont)
                        .foregroundStyle(fg.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                        .padding(.bottom, 20)

                    Text("Powered by YCT and Sefaria")
                        .font(poweredByFont)
                        .foregroundStyle(fg.opacity(0.55))

                    // Flexible spacer keeps logo pinned to its original position
                    Spacer()

                    YCTLogoAnimated()
                        .frame(width: logoWidth, height: logoWidth / logoAspectRatio)
                        .clipShape(RoundedRectangle(cornerRadius: 14))

                    Spacer().frame(height: geo.size.height * 0.12)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
