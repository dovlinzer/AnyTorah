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
- **Auto-defaults on toggle**: `setHebrewMode` (`Reader.tsx`) also resets Reverse Navigation
  Direction and both Text/Commentary display modes to that direction's default — ON → reverse
  nav + Hebrew-only (`"source"`) for both; OFF → standard nav + both-language (`"both"`) for
  both. Just defaults: each of the three can still be changed independently afterward without
  the next `hebrewMode` toggle silently overwriting the user's choice — only toggling
  `hebrewMode` itself resets them.

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

## Tosefta / Yerushalmi (peer top-level tabs)

Top-level tabs: `Tanakh, Mishnah, Tosefta, Bavli, Yerushalmi, Rambam, Shulchan Arukh`. Tosefta and
Yerushalmi are genuine peer categories in the UI (`ReaderCategory` in `lib/commentaryPools.ts` is
now its own 7-value union, no longer derived from `TextCategory`), each with independent
`selection` state — not toggles nested inside Mishnah/Talmud the way native models them.
Displayed as "Bavli" (not "Talmud") now that Yerushalmi is its own tab.

Under the hood, Sefaria fetch mechanics still only know about 5 categories + a subcategory flag
(mirroring native's `MishnahSubcategory`/`TalmudSubcategory`). `fetchCategoryFor(category)` in
`lib/commentaryPools.ts` translates the UI category: Tosefta → `{fetchCategory: "mishnah",
subcategory: "tosefta"}`, Yerushalmi → `{fetchCategory: "talmud", subcategory: "yerushalmi"}`,
everything else → identity. **Every render decision keyed on the underlying fetch mechanism must
go through `fetchCategoryFor`, not the raw `category`** — e.g. the bold "glue word" English
styling and the Talmud-specific font-size trim use `isBoldEnglishCategory`/`fetchCategory ===
"talmud"` in `Reader.tsx`, not `category === "talmud"` directly. A real bug shipped once from
checking `category === "talmud"` directly there: it silently excluded Yerushalmi (whose
`category` is literally `"yerushalmi"`) and rendered raw `<span class="en-editorial">` tags as
visible text instead of styling them.

- **Tosefta** reuses Mishnah's tractate list unfiltered (`getCategoryGroups` case `"tosefta"` in
  `lib/categoryCatalog.ts`), with `count: Math.max(1, t.toseftaChapters)`. A tractate with 0
  Tosefta chapters is still selectable and just shows a 1-chapter range with empty content —
  deliberately not filtered out, matching native's design.
- **Yerushalmi** has its own tractate list, filtered from Mishnah's sedarim to
  `yerushalmiChapters > 0` (not Talmud's Bavli list) — mirrors native's `yerushalmiSedarim`.
  Tractate ids are global `MishnahTractate` ids, not `TalmudTractate` ids. Adds a halakha
  dimension within each chapter (`selection.yerushalmi.halakha`); `/api/chapter`'s response
  includes `halakhaCount` sized via `fetchYerushalmiHalakhaCount`, folding native's separate
  shape-lookup into the same request instead of a second round trip. No daf image, no amud
  toggle — both guards are just `category === "talmud"`, which now excludes Yerushalmi
  automatically since it's a different category value.
- Commentary pools/availability/ref-building (`toseftaPool`/`yerushalmiPool`,
  `isAvailableForTosefta`/`isAvailableForYerushalmi`, ref-building in `sefariaRef`) were already
  present in `lib/commentaryTypes.ts` since Phase 1's mechanical port of native's `CommentaryType`
  enum, unused until now. This feature only had to wire up `getPoolInfo` (`lib/commentaryPools.ts`),
  the API routes' `subcategory` query param, and `depthFixedRef`/`loadCommentaryEntries`'s
  `isTosefta`/`isYerushalmi` flags in `lib/sefariaClient.ts` (Tosefta commentary needs the same
  `:1-200` depth-3 range fix as Mishnah's depth-3 commentary list; Yerushalmi doesn't, since its
  ref already targets one specific halakha, not a whole chapter).
- **Bookmarks**: `Bookmark.halakha?` (optional, `lib/bookmarks.ts`) round-trips Yerushalmi's
  extra dimension; `findBookmark`/`buildDisplayTitle`/`buildSubtitle` all take it as a plain
  optional param now that category alone (not a subcategory flag) distinguishes Tosefta/Mishnah
  and Yerushalmi/Bavli.

## Shulchan Arukh siman header split

Sefaria bakes each siman's printed title (e.g. "הלכות ציצית ועטיפתו. ובו יז סעיפים:") into the
start of seif 1's Hebrew as a `<b>...</b>` block, with no parallel sentence in the English
translation — confirmed directly against the API, not assumed. `splitSimanHeader` in
`lib/sefariaClient.ts` (called from `fetchChapter`'s SA branch, only for `i === 0`) pulls that out
into its own `TextSegment` with `label: null` (no seif number — it isn't one), before the real
seif 1 renders normally with its usual label "1" and inline commentary markers.

## Rambam chapter 0 ("Header")

Rambam works with a bundled mitzvot-list header expose a synthetic chapter 0 (see
`getChapterMin`/`rambamIntroductions`). Chapter 0 renders as the word "Header"/"כותרת" everywhere
a chapter number would otherwise show: the toolbar's chapter box (`category === "rambam" &&
chapter === 0` special-case in `Reader.tsx`), the chapter-picker modal's row for value 0
(`NumberPickerModal`'s `labelFor` prop), and the "min–max" range caption, which for Rambam always
shows the explicit `1–N` range (never "of N") so it's clear real chapters start at 1. Using
`numeral(0)` directly for any of these would silently render as an empty string in Hebrew mode —
`toHebrewNumeral(0)` returns `""` — which is what originally exposed this as a bug.

## NumberPickerModal — no "Go" button

The quick-jump text field at the top has no separate "Go" button — Enter still commits it
(`commitJump`), and clicking a row in the list below (the far more common path) already navigates
immediately on click, no extra step. Deliberately did **not** wire `onBlur` to auto-commit as an
alternative: blur fires before a different row's own `onClick` when the user clicks it, so an
onBlur-commit would fire `onSelect` twice in a race (once with the stale jump-field value, once
from the actual row click) — Enter-to-submit avoids that entirely.

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
