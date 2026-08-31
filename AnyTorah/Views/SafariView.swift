import SwiftUI
import SafariServices

/// Wraps `SFSafariViewController` for opening an external article link in-app (its own nav bar,
/// Done button, reader mode) — used by the Related YCT Articles sheet. No other web-view
/// precedent exists in this app; kept deliberately minimal rather than a full `WKWebView` reader.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}
}
