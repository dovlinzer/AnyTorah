import SwiftUI

/// Displays a single daf page image (amud aleph or bet) fetched from Google Drive.
/// Supports pinch-to-zoom and pan. Tapping the left/right edges navigates to
/// adjacent amudim via the provided callbacks.
struct DafPageView: View {
    let tractate: String      // Sefaria name, e.g. "Berakhot"
    let daf: Int
    let sideA: Bool
    let fg: Color
    let onPrevious: () -> Void
    let onNext: () -> Void

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private var imageURL: URL? {
        TalmudPageManager.shared.imageURL(tractate: tractate, daf: daf, sideA: sideA)
    }

    var body: some View {
        GeometryReader { geo in
            if let url = imageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .tint(fg)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)

                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .scaleEffect(scale)
                            .offset(offset)
                            .gesture(
                                SimultaneousGesture(
                                    MagnificationGesture()
                                        .onChanged { value in
                                            scale = max(1.0, lastScale * value)
                                        }
                                        .onEnded { value in
                                            lastScale = scale
                                            if scale < 1.05 {
                                                withAnimation(.spring()) {
                                                    scale = 1.0
                                                    lastScale = 1.0
                                                    offset = .zero
                                                    lastOffset = .zero
                                                }
                                            }
                                        },
                                    DragGesture()
                                        .onChanged { value in
                                            // Only allow panning when zoomed in
                                            guard scale > 1.05 else { return }
                                            offset = CGSize(
                                                width:  lastOffset.width  + value.translation.width,
                                                height: lastOffset.height + value.translation.height
                                            )
                                        }
                                        .onEnded { _ in
                                            lastOffset = offset
                                        }
                                )
                            )
                            .onTapGesture(count: 2) {
                                withAnimation(.spring()) {
                                    if scale > 1.05 {
                                        scale = 1.0
                                        lastScale = 1.0
                                        offset = .zero
                                        lastOffset = .zero
                                    } else {
                                        scale = 2.0
                                        lastScale = 2.0
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .clipped()

                    case .failure:
                        VStack(spacing: 12) {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.largeTitle)
                                .foregroundStyle(fg.opacity(0.4))
                            Text("Image unavailable")
                                .font(.caption)
                                .foregroundStyle(fg.opacity(0.5))
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text")
                        .font(.largeTitle)
                        .foregroundStyle(fg.opacity(0.3))
                    Text("No image for \(tractate) \(daf)")
                        .font(.caption)
                        .foregroundStyle(fg.opacity(0.4))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
