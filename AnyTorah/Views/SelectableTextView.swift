import SwiftUI
import UIKit

/// A non-editable UITextView wrapper that enables character-level text selection
/// with drag handles — so users can highlight any portion and copy it.
///
/// SwiftUI's `Text + .textSelection(.enabled)` only provides copy-all; true
/// per-character selection requires a UITextView with `isSelectable = true`.
struct SelectableTextView: UIViewRepresentable {
    let attributed: NSAttributedString

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.isEditable = false
        tv.isSelectable = true
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        return tv
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        // Don't reset text while the user has an active selection — that would
        // clear the selection handles and drop the touch back to parent gestures.
        guard !uiView.isFirstResponder else { return }
        uiView.attributedText = attributed
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let width = proposal.width.flatMap { $0 > 0 ? $0 : nil } ?? 320
        return uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    }
}

// MARK: - Scaled font helper

private extension UIFont {
    /// Returns this font offset by the user's stored text-size level (key "anyTorahFontSize",
    /// integer stored as Double, range −2 … +2, each step = 2 pt, default 0).
    var appScaled: UIFont { appScaledBy(0) }

    /// Returns this font scaled by the stored level plus an additional point offset.
    /// Use `extraPoints = 2` to render one step larger than the stored setting (e.g. main
    /// text boost when a side commentary panel is open).
    func appScaledBy(_ extraPoints: CGFloat) -> UIFont {
        let level = UserDefaults.standard.double(forKey: "anyTorahFontSize")
        let total = CGFloat(level) * 2 + extraPoints - 3
        return withSize(max(10, pointSize + total))
    }
}

// MARK: - Hebrew font

private extension UIFont {
    /// Frank Ruhl Libre at the given point size, falling back to the system font.
    static func frankRuhl(size: CGFloat) -> UIFont {
        UIFont(name: "FrankRuhlLibre-Regular", size: size) ?? .systemFont(ofSize: size)
    }
}

// MARK: - ScrollView gesture tuning

/// Walks up the UIView hierarchy from an anchor view to find the nearest UIScrollView
/// and sets `isScrollEnabled` to match `enabled`. When scrolling is disabled the scroll
/// view drops out of gesture competition entirely, allowing subview UITextViews to handle
/// long-press drag-handle text selection without interference.
struct ScrollEnabledModifier: ViewModifier {
    let enabled: Bool
    func body(content: Content) -> some View {
        content.background(ScrollEnabledTuner(enabled: enabled))
    }
}

private struct ScrollEnabledTuner: UIViewRepresentable {
    let enabled: Bool

    func makeUIView(context: Context) -> UIView {
        let v = UIView()
        v.backgroundColor = .clear
        v.isUserInteractionEnabled = false
        return v
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async {
            var responder: UIView? = uiView
            while let r = responder {
                if let sv = r as? UIScrollView {
                    sv.isScrollEnabled = enabled
                    return
                }
                responder = r.superview
            }
        }
    }
}

extension View {
    /// Toggles scrolling on the nearest ancestor UIScrollView.
    /// Pass `false` to disable scrolling and allow UITextView drag-handle selection.
    func scrollEnabled(_ enabled: Bool) -> some View {
        modifier(ScrollEnabledModifier(enabled: enabled))
    }
}

// MARK: - UIApplication first-responder helper

private extension UIResponder {
    static weak var _currentFirstResponder: UIResponder?
    @objc func _captureFirstResponder() {
        UIResponder._currentFirstResponder = self
    }
}

extension UIApplication {
    /// Returns the current first responder by walking the responder chain via `sendAction`.
    /// Returns `nil` if nothing is first responder.
    var firstResponder: UIResponder? {
        UIResponder._currentFirstResponder = nil
        sendAction(#selector(UIResponder._captureFirstResponder), to: nil, from: nil, for: nil)
        return UIResponder._currentFirstResponder
    }
}

// MARK: - NSAttributedString builders
//
// These replicate the SwiftUI styledHebrew / styledEnglish / hebrewContentView logic
// as NSAttributedString so SelectableTextView can display them.
//
// @MainActor because SefariaTextClient (which provides stripHTML) is @MainActor-isolated.
// These builders are only ever called from view rendering, which is already on the main actor.

@MainActor
extension NSAttributedString {

    // MARK: Primary text panel (body font)

    /// Hebrew body text, RTL. Uses Frank Ruhl Libre. Handles `<rf>` small-marker spans.
    /// `extraPoints` adds to the scaled size — pass 2 for main-text panel boost.
    static func hebrewBody(html: String, fg: UIColor, lineSpacing: CGFloat = 7,
                           extraPoints: CGFloat = 0) -> NSAttributedString {
        let para = rtlParagraph(lineSpacing: lineSpacing)
        let baseSize = UIFont.preferredFont(forTextStyle: .body).appScaledBy(extraPoints).pointSize
        let bodyFont = UIFont.frankRuhl(size: baseSize)
        return html.contains("<rf>")
            ? rfSpans(html, normalFont: bodyFont,
                      smallFont: UIFont.frankRuhl(size: max(10, baseSize - 5)),
                      fg: fg, para: para)
            : plainRTL(html: html, font: bodyFont, fg: fg, para: para)
    }

    /// English body text, LTR. `<b>`/`<strong>` spans are rendered in `editorialColor`.
    /// `extraPoints` adds to the scaled size — pass 2 for main-text panel boost.
    static func englishBody(html: String, fg: UIColor, editorialColor: UIColor,
                            lineSpacing: CGFloat = 5, extraPoints: CGFloat = 0) -> NSAttributedString {
        boldSpans(html, font: UIFont.preferredFont(forTextStyle: .body).appScaledBy(extraPoints),
                  fg: fg, boldColor: editorialColor,
                  para: ltrParagraph(lineSpacing: lineSpacing))
    }

    // MARK: Commentary panel (callout font)

    /// Hebrew commentary text, RTL, callout font. Optional SA-style prefix.
    /// When `prefixIsSmall` the prefix is rendered at a smaller size (subordinate marker).
    static func hebrewCallout(html: String, prefix: String = "", prefixIsSmall: Bool = false,
                              fg: UIColor, lineSpacing: CGFloat = 4) -> NSAttributedString {
        let para    = rtlParagraph(lineSpacing: lineSpacing)
        let bodyFont = UIFont.frankRuhl(size: UIFont.preferredFont(forTextStyle: .body).appScaled.pointSize)
        let smallFont = UIFont.frankRuhl(size: UIFont.systemFont(ofSize: 13).appScaled.pointSize)

        guard !prefix.isEmpty else {
            return html.contains("<rf>")
                ? rfSpans(html, normalFont: bodyFont, smallFont: smallFont, fg: fg, para: para)
                : plainRTL(html: html, font: bodyFont, fg: fg, para: para)
        }

        // Prefix + body as a single attributed string
        let m = NSMutableAttributedString()
        let prefFont = prefixIsSmall ? smallFont : bodyFont
        // RLM at front so bidi algorithm treats the whole run as RTL
        m.append(NSAttributedString(string: "\u{200F}" + prefix,
                                    attributes: [.font: prefFont, .foregroundColor: fg]))
        let body = SefariaTextClient.processedHebrew(html)
        m.append(NSAttributedString(string: body,
                                    attributes: [.font: bodyFont, .foregroundColor: fg]))
        m.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: m.length))
        return m
    }

    /// English commentary text, LTR, callout font. Plain (no bold styling).
    static func englishCallout(text: String, fg: UIColor, lineSpacing: CGFloat = 4) -> NSAttributedString {
        NSAttributedString(string: text, attributes: [
            .font: UIFont.preferredFont(forTextStyle: .body).appScaled,
            .foregroundColor: fg,
            .paragraphStyle: ltrParagraph(lineSpacing: lineSpacing)
        ])
    }

    // MARK: Paragraph style helpers

    private static func rtlParagraph(lineSpacing: CGFloat) -> NSMutableParagraphStyle {
        let p = NSMutableParagraphStyle()
        p.lineSpacing = lineSpacing
        p.alignment = .right
        p.baseWritingDirection = .rightToLeft
        return p
    }

    private static func ltrParagraph(lineSpacing: CGFloat) -> NSMutableParagraphStyle {
        let p = NSMutableParagraphStyle()
        p.lineSpacing = lineSpacing
        return p
    }

    // MARK: Text parsers

    private static func plainRTL(html: String, font: UIFont, fg: UIColor,
                                  para: NSMutableParagraphStyle) -> NSAttributedString {
        NSAttributedString(string: "\u{200F}" + SefariaTextClient.processedHebrew(html), attributes: [
            .font: font, .foregroundColor: fg, .paragraphStyle: para
        ])
    }

    /// Parses `<rf>…</rf>` spans into mixed-font NSAttributedString.
    /// Normal text gets `normalFont`; content inside `<rf>` tags gets `smallFont`.
    private static func rfSpans(_ html: String, normalFont: UIFont, smallFont: UIFont,
                                 fg: UIColor, para: NSMutableParagraphStyle) -> NSAttributedString {
        let rfPattern = #"<rf>(.*?)</rf>"#
        guard let regex = try? NSRegularExpression(pattern: rfPattern) else {
            return plainRTL(html: html, font: normalFont, fg: fg, para: para)
        }

        let src = "\u{200F}" + html
        let ns  = src as NSString
        let matches = regex.matches(in: src, range: NSRange(location: 0, length: ns.length))
        guard !matches.isEmpty else { return plainRTL(html: html, font: normalFont, fg: fg, para: para) }

        let m = NSMutableAttributedString()
        var cursor = 0

        for match in matches {
            if match.range.location > cursor {
                let raw = ns.substring(with: NSRange(location: cursor,
                                                     length: match.range.location - cursor))
                let plain = SefariaTextClient.processedHebrew(raw)
                if !plain.isEmpty {
                    m.append(NSAttributedString(string: plain,
                                               attributes: [.font: normalFont, .foregroundColor: fg]))
                }
            }
            if let r = Range(match.range(at: 1), in: src) {
                // SA inline markers (bracket labels) are plain ASCII — strip HTML only
                let marker = SefariaTextClient.stripHTML(String(src[r]))
                if !marker.isEmpty {
                    m.append(NSAttributedString(string: marker,
                                               attributes: [.font: smallFont, .foregroundColor: fg]))
                }
            }
            cursor = match.range.location + match.range.length
        }

        if cursor < ns.length {
            let raw   = ns.substring(with: NSRange(location: cursor, length: ns.length - cursor))
            let plain = SefariaTextClient.processedHebrew(raw)
            if !plain.isEmpty {
                m.append(NSAttributedString(string: plain,
                                           attributes: [.font: normalFont, .foregroundColor: fg]))
            }
        }

        m.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: m.length))
        return m
    }

    /// Parses `<b>`/`<strong>` spans; bold content gets `boldColor`, rest gets `fg`.
    private static func boldSpans(_ html: String, font: UIFont, fg: UIColor,
                                   boldColor: UIColor, para: NSMutableParagraphStyle) -> NSAttributedString {
        let cleaned = html
            .replacingOccurrences(of: "<br/>",  with: "\n")
            .replacingOccurrences(of: "<br />", with: "\n")
            .replacingOccurrences(of: "<br>",   with: "\n")

        let pattern = #"<(?:b|strong)>(.*?)</(?:b|strong)>"#
        guard let regex = try? NSRegularExpression(pattern: pattern,
                                                    options: [.dotMatchesLineSeparators]) else {
            return NSAttributedString(string: SefariaTextClient.stripHTML(cleaned), attributes: [
                .font: font, .foregroundColor: fg, .paragraphStyle: para
            ])
        }

        let ns      = cleaned as NSString
        let matches = regex.matches(in: cleaned, range: NSRange(location: 0, length: ns.length))

        guard !matches.isEmpty else {
            return NSAttributedString(string: SefariaTextClient.stripHTML(cleaned), attributes: [
                .font: font, .foregroundColor: fg, .paragraphStyle: para
            ])
        }

        let m = NSMutableAttributedString()
        var cursor = 0

        for match in matches {
            if match.range.location > cursor {
                let raw   = ns.substring(with: NSRange(location: cursor,
                                                       length: match.range.location - cursor))
                let plain = SefariaTextClient.stripHTML(raw)
                if !plain.isEmpty {
                    m.append(NSAttributedString(string: plain,
                                               attributes: [.font: font, .foregroundColor: fg]))
                }
            }
            if let r = Range(match.range(at: 1), in: cleaned) {
                let bold = SefariaTextClient.stripHTML(String(cleaned[r]))
                if !bold.isEmpty {
                    m.append(NSAttributedString(string: bold,
                                               attributes: [.font: font, .foregroundColor: boldColor]))
                }
            }
            cursor = match.range.location + match.range.length
        }

        if cursor < ns.length {
            let raw   = ns.substring(with: NSRange(location: cursor, length: ns.length - cursor))
            let plain = SefariaTextClient.stripHTML(raw)
            if !plain.isEmpty {
                m.append(NSAttributedString(string: plain,
                                           attributes: [.font: font, .foregroundColor: fg]))
            }
        }

        m.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: m.length))
        return m
    }
}
