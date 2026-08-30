import SwiftUI

/// Displays a single Contemporary Teshuvot page image (Iggros Moshe, etc.) fetched from Google
/// Drive. Same pinch-to-zoom/pan/double-tap mechanism as `DafPageView` (Talmud daf images) —
/// deliberately not shared as one generic component, since the two evolved from genuinely
/// different call sites (tractate/daf/side vs. volume/page) and forcing a shared abstraction
/// now would cost more than the ~80 lines of duplication it'd save.
struct ContemporaryTeshuvotPageView: View {
    let volume: String
    let page: Int
    let fg: Color

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private var imageURL: URL? {
        TeshuvotPageManager.shared.imageURL(volume: volume, page: page)
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
                // Forces AsyncImage to reload (rather than keep showing the previous page's
                // image mid-transition) when the page changes — same reset the pinch/pan state
                // below needs, since otherwise a zoomed-in page carries its zoom to the next one.
                .id(url)
                .onChange(of: url) { _, _ in
                    scale = 1.0; lastScale = 1.0
                    offset = .zero; lastOffset = .zero
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text")
                        .font(.largeTitle)
                        .foregroundStyle(fg.opacity(0.3))
                    Text("No image for page \(page)")
                        .font(.caption)
                        .foregroundStyle(fg.opacity(0.4))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
