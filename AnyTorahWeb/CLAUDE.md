@AGENTS.md

## Planned: Bookmarks + Notes (local or account-based)

Not started. Design intent, captured for when this is picked up:

- A combined bookmarks + notes feature — a saved location (category/index/chapter, matching
  native's `Bookmark` struct) optionally carrying a free-text note, rather than two separate
  features.
- **Two storage modes, both supported:**
  1. **Local** — device/browser-only, no account required. Extends the pattern already used for
     commentary slots (`localStorage`, see `SLOT_STORAGE_PREFIX` in `components/Reader.tsx`).
     Matches native's on-device UserDefaults/SharedPreferences bookmarks — works out of the box,
     doesn't sync across devices/browsers.
  2. **Account-based** — requires signing in; syncs bookmarks/notes/commentator-slot preferences
     across devices and sessions. Commentator slot preferences should also move into this same
     signed-in store once it exists, rather than staying local-only forever.
  - Local should remain available even after accounts ship — not everyone will want to sign in
    just to save a bookmark. Signing in could offer to import existing local bookmarks.
- No auth provider or backend chosen yet. The user's other YCT projects (see
  `project_yct_registrar` in memory) use Supabase — a reasonable default to consider, not a
  decision made yet.

## Planned: Daily learning dedication banner

Not started. Native has this already (`AnyTorah/API/DedicationService.swift` +
`Views/DedicationBannerView.swift`, mirrored in `AnyTorahAndroid/.../DedicationDialog.kt`) — port
the same behavior:

- Data source: public Supabase table `dedications` (project `zewdazoijdpakugfvnzt`, readable with
  the anon key already in `DedicationService.swift`) — columns `date`, `dedicated_by`,
  `honoree_name`, `period` (`"today"`/`"week"`/`"month"`), `preposition`, `occasion`,
  `display_text` (optional override), `photo_url`, `status` (`"approved"`), `app`
  (`"anytorah"`/`"both"`). This table already has live production data — no new backend needed
  for this feature specifically, independent of the bookmarks/accounts work above.
- Native fetches once per day (checked against a stored last-checked date so it only shows once),
  picks the highest-priority active dedication (`today` > `week` > `month`), and shows it as a
  dismissible banner/sheet on launch with a photo (or fallback icon), title (e.g. "Today's
  Learning"), and a formatted message ("Today's learning with AnyTorah is dedicated by ___ in
  honor of ___ ...").
- For web: show once per browser session (or per day, via `localStorage` date-check like the
  slot/bookmark local-storage pattern) rather than gating on account state — this doesn't depend
  on the auth work above and can be built independently, sooner.
