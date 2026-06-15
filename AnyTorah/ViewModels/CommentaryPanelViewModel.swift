import Foundation
import Observation
import SwiftUI

/// Holds the mutable per-panel state for one commentary panel instance.
///
/// `TextReaderViewModel` owns one or two of these (mainPanel, rightPanel).
/// The loading logic lives in `TextReaderViewModel` — it reads context from itself
/// and writes results into whichever panel it was asked to load.
@MainActor
@Observable
final class CommentaryPanelViewModel {

    // MARK: - Identity

    /// "main" for the primary panel; "right" for the second panel in bothPanels layout.
    let panelId: String

    // MARK: - Per-panel display state

    var selectedCommentary: CommentaryType = .rashiTalmud
    var commentaryEntries: [CommentaryEntry] = []
    var isLoadingCommentary = false
    var commentaryError: String? = nil
    /// Incremented each time `commentaryEntries` is written with a completed load result.
    /// Observers use this to react to any load completion, regardless of entry count changes.
    var loadVersion: Int = 0

    // MARK: - Slot assignments

    /// Commentary slot assignments, keyed by the VM's `contextKey`.
    /// Separate from the main panel's assignments so each panel remembers its own choices.
    private(set) var slotsByContext: [String: [CommentaryType]] = [:]

    // MARK: - Init

    init(panelId: String, defaultSlots: [String: [CommentaryType]]) {
        self.panelId = panelId
        for (key, defaults) in defaultSlots {
            let udKey = userDefaultsKey(for: key, panelId: panelId)
            if let raw = UserDefaults.standard.array(forKey: udKey) as? [String] {
                let loaded = raw.compactMap { CommentaryType(rawValue: $0) }
                if loaded.count == defaults.count { slotsByContext[key] = loaded }
            }
        }
    }

    // MARK: - Slot access

    /// Returns the stored slot assignments for `contextKey`, falling back to `fallback`.
    func slots(contextKey: String, fallback: [CommentaryType]) -> [CommentaryType] {
        slotsByContext[contextKey] ?? fallback
    }

    /// Persists new slot assignments for `contextKey` to UserDefaults.
    func setSlots(_ slots: [CommentaryType], contextKey: String) {
        slotsByContext[contextKey] = slots
        let udKey = userDefaultsKey(for: contextKey, panelId: panelId)
        UserDefaults.standard.set(slots.map { $0.rawValue }, forKey: udKey)
    }
}

// MARK: - Helpers

/// Returns the UserDefaults key for slot storage.
/// Main panel uses the existing key format for backward compatibility.
private func userDefaultsKey(for contextKey: String, panelId: String) -> String {
    panelId == "main"
        ? "commentarySlots_\(contextKey)"
        : "commentarySlots_\(contextKey)_\(panelId)"
}
