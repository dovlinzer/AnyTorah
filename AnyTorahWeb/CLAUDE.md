@AGENTS.md

## Hebrew/RTL Mode (saHebrewMode)

EN/עב toggle in the header (`HebrewModeToggle` in `components/Reader.tsx`), persisted to
`localStorage` under `anytorah:hebrewMode`. Matches native's `saHebrewMode` in spirit, but the
web toolbar's specific layout rules below were arrived at through direct user iteration — read
them before changing anything here.

- **Names**: book/tractate/work names and category tab labels switch to nikkud-stripped Hebrew.
  `stripNikud` (`lib/hebrewUtils.ts`) ports native's `HebrewUtils.strippingNikud` (strips
  U+0591–U+05C7); the catalog's `hebrewName` fields carry full nikud, so every display path
  needs to run through `stripNikud` — never render `hebrewName` raw. Wired through
  `getCategoryGroups`/`getCategoryDisplayName`/`getChapterUnitLabel` (`lib/categoryCatalog.ts`),
  all `hebrewMode = false` by default so existing callers don't need updating.
- **Numerals**: chapter/daf/siman numbers render via `toHebrewNumeral` (`lib/textModels.ts`,
  already existed, previously unused). The chapter/daf *input* itself stays Arabic-numeral and
  editable in both modes — only the surrounding labels/range text switch, since Hebrew numerals
  aren't practical to type into a number input.
- **Commentator names**: `hebrewDisplayName` (`lib/commentaryTypes.ts`, ported alongside
  `displayName`, keyed by the same `CommentaryType`) supplies Hebrew names for the commentary
  tab strip and swap picker in `components/CommentaryPanel.tsx`.
- **SA siman picker**: `lib/saSimanHelpers.ts`'s `getSATopicSections`/`getSASimanTitle` take a
  `hebrewMode` param and switch to the (previously unwired) `hebNamesOH/YD/EH/HM` and
  `simanNamesOH/YD/EH/HM` arrays in `lib/saSimanNames.ts`.
- **Toolbar layout — fixed macro order, mirrored internals**: this is the one place native's
  behavior doesn't transfer directly. Applying `dir="rtl"` to the *whole* toolbar row (mirroring
  every group's position) was tried and explicitly rejected by the user as disorienting — a
  returning user expects the book/chapter selector on the left and Commentary on the right
  regardless of language. The shipped design instead applies `dir={hebrewMode ? "rtl" : "ltr"}`
  to each cluster *independently* (the book/chapter/amud group, the daf-controls group, and each
  `ControlGroup` for Text/Commentary), while the outer toolbar `<div>` never gets a `dir`
  attribute and its top-level children never reorder. Net effect: cluster *positions* are
  identical in both languages; only the *order of items within each cluster* mirrors (e.g. the
  book `<select>` moves from being the first/leftmost item in its cluster to the
  last/rightmost — CSS `direction` inheritance handles this automatically for any un-overridden
  nested flex row, so don't add a stray `dir="ltr"` inside a cluster or the mirroring breaks).
  A third `VerticalDivider` (Hebrew-mode only) separates the book/chapter/amud cluster from the
  daf-controls cluster, present only when both clusters actually render content
  (`category === "talmud" && dafImageAvailable`).
- **Labels**: `ControlGroup` label text switches to `טקסט`/`מפרשים`; `FontSizeControl`'s
  decrease/increase buttons render `א` instead of `A` (`hebrewMode` prop on both).

## Navigation: Arrow Keys, Chevrons, and Reverse Navigation Direction

`stepReading` (`components/Reader.tsx`) is the single entry point for both ← → arrow keys and
the on-page chevron buttons (`NavChevrons`). Arrow keys are ignored while focus is in the
book/chapter selector (so normal editing there isn't hijacked) or while the SA siman picker
modal is open.

- **Chevron placement**: chevrons always render on whichever box sits directly adjacent to the
  Commentary panel — normally the text column, but the daf-image column when
  `dafPosition === "middle"` (`chevronsOnDaf` flag). This follows from the layout rule that daf
  position swaps which of {text, daf-image} is narrow vs. flexible; the chevrons track the
  flexible/adjacent-to-commentary one, not a fixed side.
- **Talmud is amud-aware**: a "step" moves one amud at a time (2a→2b→3a→3b→...), not a whole daf.
  Stepping backward across a daf boundary (amud a → previous daf) must land on the *previous*
  daf's amud **b**, not its amud a — but the existing `useEffect(() => setTalmudAmud("a"), [...])`
  (fires on every category/index/chapter change, matching "a daf always opens at amud a" for
  normal jumps) would stomp that back to "a". `skipAmudResetRef` is a one-shot escape hatch:
  `stepReading` sets it before calling `handleChapterChange`, the reset effect consumes-and-skips
  it once, and every other path (typing a chapter number, switching tractate) is unaffected.
- **Reverse Navigation Direction**: a separate toggle (⇄ button in the header, `localStorage`
  key `anytorah:reverseNavigation`), independent of `hebrewMode` — native has this as its own
  setting too. `stepReading` inverts the sign of its `direction` argument once, internally, so
  every caller stays agnostic: the left chevron always passes `-1` and the right always passes
  `+1` regardless of the setting. The boundary-hiding logic (`hideLeftChevron`/`hideRightChevron`
  in `Reader.tsx`) swaps which of `atReadingStart`/`atReadingEnd` each visual side checks when
  reversed, so the correct chevron still disappears at the start/end of a book/tractate.

## YCT Branding

Header shows the full YCT lockup (mark + wordmark + tagline + Hebrew), not the mark alone or the
no-tagline version — both were tried and the user preferred the tagline version enlarged instead.
Two PNGs in `public/`: `yct-logo-color.png` (light theme) and `yct-logo-white.png` (dark theme),
both cropped tight to content (no padding) from the source files in the shared brand folder
(`YCT logo color_transparent.png` / `YCT logo white.png`). Swapped via CSS only — `.yct-logo-dark`
is `display: none` by default and shown (with `.yct-logo-light` hidden) inside
`@media (prefers-color-scheme: dark)` in `globals.css` — because the color mark's dark blue has
poor contrast against the dark theme's navy background, and there is no JS-based theme toggle to
key off of (theme follows OS `prefers-color-scheme` only). If the source brand files change, re-crop
to the content bounding box before dropping them in — the raw exports have large transparent
margins that make the logo look tiny at any reasonable `height` in `.yct-logo`.

The "Powered by YCT and Sefaria" caption under the title is copied verbatim (including
italic/55%-opacity styling) from native's `SplashView.swift`.

## Bookmarks + Notes (phase 1: local storage) — shipped

`lib/bookmarks.ts` (localStorage CRUD, key `anytorah:bookmarks`) + `components/BookmarkEditModal.tsx`
/ `BookmarkListModal.tsx`, wired into `Reader.tsx`'s header (star toggle + list button next to the
Hebrew-mode/reverse-nav toggles). Ported from native's `Bookmark.swift`/`BookmarkManager.swift`,
collapsed to the web reader's already-unified `{category, index, chapter}` selection instead of
native's separate per-category index fields. Notes are a field on the bookmark object, same as
native — this is phase 1 of a bigger anchored-notes vision (notes tied to a specific text/
commentary passage, not just a bookmark-level field); see memory `project_anytorah_web_port` for
the full staged plan.

**Not yet built:** account-based sync. Local storage works standalone and should remain available
even once accounts ship — not everyone will want to sign in just to save a bookmark.

## Daily learning dedication banner — shipped

`lib/dedicationService.ts` (types + `periodTitle`/`formattedMessage`, ported from native's
`Dedication` struct) + `app/api/dedication/route.ts` (server-side Supabase fetch) +
`app/api/dedicationPhoto/route.ts` (photo proxy, same pattern as `app/api/dafImage/route.ts` —
the storage bucket needs the anon-key auth header, a plain `<img>` src can't do that) +
`components/DedicationBanner.tsx` (shown once per browser/day via `localStorage`, mirroring
native's "only mark today as checked when a dedication was actually found" quirk).

- Data source: public Supabase table `dedications` (project `zewdazoijdpakugfvnzt`, readable with
  the anon key already in `DedicationService.swift`) — columns `date`, `dedicated_by`,
  `honoree_name`, `period` (`"today"`/`"week"`/`"month"`), `preposition`, `occasion`,
  `display_text` (optional override), `photo_url`, `status` (`"approved"`).
- **App targeting**: three independent boolean columns — `for_anytorah`, `for_anytorah_web`,
  `for_anydaf` — replacing an older single `app` text column (`"anytorah"`/`"anydaf"`/`"both"`)
  that AnyTorah Web used to just inherit from (`app=in.(anytorah,both)`), with no way to target
  the web app independently of native AnyTorah. Migrated via
  `AnyDaf/dedication-app-targeting-migration.sql` (run manually in the Supabase SQL editor — no
  service-role key is available to this codebase to run DDL programmatically). The old `app`
  column is left in place, unused, after the migration. Web's route filters
  `for_anytorah_web=eq.true`; the admin submission form (`AnyDaf/dedication-form.html`) now has
  three independent checkboxes instead of one three-way radio group.
- **Known quirk (matches native, not a bug):** the `date` column has no timezone, and the
  "is this active today" check compares in UTC. A `period: "today"` dedication can roll out of
  its window before local midnight for users west of UTC — same behavior as native.
