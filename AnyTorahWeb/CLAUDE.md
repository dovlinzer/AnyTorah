@AGENTS.md

## Planned: Bookmarks + Notes (requires auth)

Not started. Design intent, captured for when this is picked up:

- A combined bookmarks + notes feature — a saved location (category/index/chapter, matching
  native's `Bookmark` struct) optionally carrying a free-text note, rather than two separate
  features.
- Unlike the native apps (bookmarks persist to on-device UserDefaults/SharedPreferences, no
  account needed), the web app needs **user accounts** to save bookmarks/notes across devices
  and browser sessions.
- Once accounts exist, **commentator slot preferences should move server-side too** — currently
  `components/Reader.tsx` persists `slots` per `contextKey` to `localStorage` only (see
  `SLOT_STORAGE_PREFIX` in `Reader.tsx`), which is per-browser, not per-user. This should become
  part of the same signed-in user's saved preferences rather than a separate system.
- No auth provider or backend chosen yet. The user's other YCT projects (see
  `project_yct_registrar` in memory) use Supabase — a reasonable default to consider, not a
  decision made yet.
