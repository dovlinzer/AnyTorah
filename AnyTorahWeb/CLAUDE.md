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
- **Toolbar layout — full mirror image (revised 2026-07-24)**: an earlier design (fixed macro
  cluster order, only mirroring *within* each cluster) was explicitly reversed by the user, who
  found the non-mirrored macro order confusing. The outer toolbar `<div>` now also carries
  `dir={hebrewMode ? "rtl" : "ltr"}`, on top of the same attribute already present on each
  cluster (book/chapter/amud group, Yomi-buttons group, daf-controls group) — redundant where
  values match, but it's the outer `dir` that actually reorders the *clusters themselves*, not
  just each cluster's internal items. Source order is fixed as: book/chapter/amud cluster, Yomi
  buttons, daf-image controls (show/hide + position, Talmud only), a flex spacer. In English this
  reads left-to-right in that order; in Hebrew, `dir=rtl` mirrors the whole row, so it reads
  right-to-left in that *same* source order — i.e. a true mirror image, not just flipped labels.
  Do not re-introduce a "fixed macro position" design without the user's explicit sign-off; this
  was tried once already and reversed once already, in opposite directions, both times based on
  direct user feedback. (The Text/Commentary display-mode + font-size controls that used to sit
  at the end of this toolbar have since moved to each panel's own bottom-bar footer — see
  "Font-size sliders and the display-mode pill" below — so the toolbar itself no longer has a
  Text/Commentary section to mirror.)
- **Yomi buttons cluster placement**: sits immediately after the book/chapter/amud cluster in
  source order (see `lib/yomiService.ts`/"Yomi buttons" section below for the buttons themselves).
  For Tanakh, Parsha is pushed before 929 in `Reader.tsx`'s `yomiButtons` array (source order) —
  under the toolbar's mirroring above, this reads "Parsha, then 929" left-to-right in English and
  right-to-left in Hebrew (Parsha sits closer to the selector boxes in both directions), matching
  explicit user request.
  A third `VerticalDivider` (Hebrew-mode only) separates the book/chapter/amud cluster from the
  daf-controls cluster, present only when both clusters actually render content
  (`category === "talmud" && dafImageAvailable`).
- **Labels**: `FontSizeSlider`'s end labels render `א` instead of `A` (`hebrewMode` prop, also
  flips the slider's own `dir`), and the panel-footer bar itself flips `dir` too so
  `DisplayModePill` and the slider swap sides — see "Font-size sliders and the display-mode pill"
  below.
- **Auto-defaults on toggle**: `setHebrewMode` (`Reader.tsx`) also resets Reverse Navigation
  Direction and both Text/Commentary display modes to that direction's default — ON → reverse
  nav + Hebrew-only (`"source"`) for both; OFF → standard nav + both-language (`"both"`) for
  both. Just defaults: each of the three can still be changed independently afterward without
  the next `hebrewMode` toggle silently overwriting the user's choice — only toggling
  `hebrewMode` itself resets them.
- **Geo default on first visit (`app/api/geo/route.ts`)**: a first-time visitor (no
  `anytorah:hebrewMode` key in `localStorage` yet — `loadStoredHebrewMode()` returns `null`,
  distinct from an explicit stored `false`) gets Hebrew/RTL mode defaulted on when Vercel's edge
  network reports their IP as Israel. Reads the `x-vercel-ip-country` request header Vercel
  stamps on every request server-side — no browser Geolocation permission prompt, no third-party
  IP-lookup service. Route returns `{country: string | null}`; `null` in local dev or any
  non-Vercel host, which the client (`Reader.tsx`'s mount effect) treats the same as "not
  Israel" and just leaves the existing English/LTR default. Fires through the same
  `setHebrewMode(true)` the toggle itself uses, so reverse-nav/display-mode defaults come along
  with it. Once *any* explicit choice exists (toggling it, or this default itself, since
  `setHebrewMode` persists) the stored value always wins on later loads — this only ever fires
  once, before any preference exists.

## Font-size sliders and the display-mode pill

Both the font-size control and the Hebrew/English/both display-mode toggle live in a shared
bottom-bar footer inside each panel (main text and commentary), not in the top toolbar — moved
there 2026-07-26 per explicit user request, off of the toolbar's old end-of-row
`ControlGroup`/`DisplayModePill` pairing.

- `components/FontSizeSlider.tsx` — a shared `<input type="range">` control, one instance in each
  panel's footer, each driving its own independent `fontSizeLevel` in `Reader.tsx`
  (`mainFontSizeLevel`/`commentaryFontSizeLevel`, `lib/fontSizeLevels.ts` scheme). Bare (no
  border/padding of its own) — the footer row it sits in owns that styling, since the row also
  contains `DisplayModePill`. The slider's own `value`/`max` are just an index into
  `FONT_SIZE_LEVELS` (levels are non-contiguous — see that file), converted back to a real level
  on `onChange`.
- `components/DisplayModePill.tsx` — the `א`/`אA`/`A` toggle, extracted out of `Reader.tsx` (where
  it used to be a local-only component only the main text panel's toolbar group could reach) so
  `CommentaryPanel.tsx` can render its own instance too. `CommentaryPanel` takes `displayMode` +
  a new `onDisplayModeChange` prop (`Reader.tsx` passes `setCommentaryDisplayMode`) rather than
  owning the state itself — same pattern as `fontSizeLevel`/`onFontSizeLevelChange`.
- Each footer is `<div dir={hebrewMode ? "rtl" : "ltr"} className="flex ... justify-between ...">`
  with `DisplayModePill` first in source order and `FontSizeSlider` second — `justify-between`
  spreads them to opposite ends of the panel width. The shared `dir` flip (not just the slider's
  own, see below) is what actually swaps which one visually sits on which side in Hebrew mode,
  matching the toolbar's own mirror-image convention (see "Toolbar layout" above).
- `dir={hebrewMode ? "rtl" : "ltr"}` on the slider's own wrapper (independent of the footer row's)
  flips its internal `א`/`א` end-labels for free, since they're just the first/last child in
  source order.
- The footer sits inside each panel's own scroll container as a `shrink-0` row below the `flex-1
  overflow-y-auto` content — in `Reader.tsx`'s text panel this required splitting what used to be
  one `relative` wrapper (scroll area + `NavChevrons`) into an outer `flex flex-col`
  (scroll-wrapper + footer) with the `relative`/chevron positioning moved to an inner `min-h-0
  flex-1` div, so the chevrons' `top-1/2` still centers on just the scrollable text, not the panel
  including the footer.

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

## Highlights — shipped

The bigger vision referenced above split into two separate features (design session 2026-07-25):
**Highlights** (this section — a color mark + optional short note anchored to one paragraph,
Kindle/book-margin style) and the **Notebook** (a long-form rich-text document per book/
commentary with embedded navigation anchors — designed but **not yet built**, see the note at the
end of this section). A first version of "anchored notes" as a single combined feature was built
and committed (`40ce5e4`) on 2026-07-24, then scrapped on 2026-07-25 before this split was even
decided; that commit is preserved, unpushed, on `backup/anchored-notes-v1` but is no longer a
useful reference — the shipped implementation below replaced its data model, its dot-indicator UI,
*and* its 6-color category scheme, all per direct user feedback during the rebuild.

**Data model:** `lib/textAnchor.ts` — `TextAnchor` (category/index/chapter/halakha + source
`"main"|"commentary"` + `segmentIndex` + optional `paragraphIndex` for a sub-paragraph within a
multi-paragraph commentary entry), `anchorKey()` (chapter-scoped lookup key), `splitParagraphs()`,
`formatAnchorLabel()` (reuses `buildDisplayTitle` from `lib/bookmarks.ts`). `lib/highlights.ts` —
`Highlight` (anchor + `colorIndex` 0-3 + optional plain-text `note` + `tags` + auto-captured
`anchorQuoteHe`/`En`), localStorage key `anytorah:highlights`, CRUD mirroring `lib/bookmarks.ts`.
`lib/highlightCategories.ts` — 4 fixed colors (`HIGHLIGHT_CATEGORY_COUNT`), user-editable labels
(`anytorah:highlightCategoryLabels`), colors are yellow/green/blue/pink (`--highlight-color-0..3`,
`globals.css`) — yellow (`DEFAULT_HIGHLIGHT_COLOR_INDEX`) is Apple's system yellow (`#FFCC00`
light / `#FFD60A` dark, matching the Notes app icon per explicit user request) and is the default
color for a fresh highlight.

**Visual design — the highlight is the text, not an indicator next to it:** an early build in
this same session used a small colored dot next to each paragraph (mirroring the scrapped v1's
pattern); the user explicitly rejected this — "I want the user to be able to actually highlight
the verse... just like they would in a book." The shipped design has two layered pieces:
- `components/HighlightMark.tsx` wraps the whole clickable block (a paragraph, or a main-text
  segment) but paints **no background of its own** — only a faint hover tint on unhighlighted
  text as a discovery hint (`.highlight-mark:hover`, `globals.css`). Click routes one of two ways:
  unhighlighted → opens a small color-swatch popover to create the highlight; already highlighted
  → opens `HighlightEditModal` directly (color/note/tags/delete).
- The actual color wash is a separate inline `<span className="highlight-text highlight-text-N">`
  wrapped around *just the anchored text* at each call site (`Reader.tsx`'s main-text segments,
  `CommentaryPanel.tsx`'s per-paragraph rendering) — inline elements hug their content and wrap
  per line like a real highlighter, rather than stretching to the reading column's full width the
  way painting the outer block would. When main text carries raw HTML (SA inline markers, bold-
  editorial spans), the `dangerouslySetInnerHTML` moved from the `<p>` onto this inner `<span>` so
  the highlight class can still wrap it.
- A small 📝 (`.highlight-note-indicator`) renders once per highlighted block, only when
  `highlight.note` is non-empty — the color wash alone doesn't distinguish "colored, no note" from
  "colored, has a note to read."

**Popover positioning gotcha:** the reading/commentary panels are `overflow-y-auto` columns: a
normal `position: absolute` popover anchored under the clicked paragraph gets clipped by that
ancestor whenever the paragraph is near the bottom (or, as hit during testing, when a single
unsplit Hebrew paragraph is taller than the viewport itself) of the visible scrolled area.
`HighlightMark` instead computes `position: fixed` coordinates from the trigger's
`getBoundingClientRect()` in a `useLayoutEffect`, flipping above vs. below based on actual
remaining viewport space — `position: fixed` isn't clipped by ancestor `overflow`, so this stays
visible regardless of where in the panel the click happened. Closes on scroll/resize/outside-
click/Escape.

**Paragraph-splitting gotcha (real bug, found and fixed during testing, not just a design note):**
`CommentaryPanel.tsx` splits a multi-paragraph commentary entry's Hebrew and English independently
via `splitParagraphs()`, since they're separate Sefaria fields — but the Hebrew original
frequently has **no internal paragraph breaks at all** even when the English translation does
(confirmed live: Ramban on Genesis 1:1 — the English splits into several paragraphs, the Hebrew is
one unbroken block). Pairing `heParagraphs[i]`/`enParagraphs[i]` by index unconditionally, sized
off `Math.max()` of both counts, produced one giant mark containing the entire unsplit Hebrew text
plus several invisible zero-height "phantom" marks for the extra English-only paragraph indices —
only surfaced by inspecting rendered DOM rects directly, not by `tsc`/`eslint`/build. Fixed by
only splitting whichever language(s) the current `displayMode` actually shows (`showHe`/`showEn`
gates before calling `splitParagraphs`) — a hidden language's split count must never manufacture
rows for the visible one. The same `displayMode`-gating applies to the auto-captured
`anchorQuoteHe`/`En` snapshot (both `Reader.tsx` and `CommentaryPanel.tsx`) — it used to capture
both languages unconditionally, so a highlight created while reading Hebrew-only would still show
an English quote line in the note editor; now it only captures whichever language(s) were actually
on screen at creation time.

**Label discoverability:** `HighlightColorPicker.tsx`'s per-swatch ✎ rename button (shared by
`HighlightEditModal`'s color section and `HighlightsListModal`'s filter row) is the only place to
rename what a color means to you — raised by the user as hard to find; addressed by bumping the
pencil's default opacity/size and adding an explicit label above the swatch row in the edit modal
("tap ✎ to assign a label or category name to the color"), rather than adding a separate settings
surface.

**A real lesson from the original build-and-revert, still true today:** an empty-state discovery
affordance that only differs by a few percent of opacity against the theme background can be
functionally invisible in dark mode, and neither `tsc`/`eslint`/build nor ref-based click-testing
catches this (refs resolve and click regardless of visual contrast) — only an actual screenshot at
rest does. Verified this way for both the (now-removed) dot design and the current inline-mark
design, in both themes, before calling either done.

**Not yet built — the Notebook:** a separate, long-form rich-text document per book/commentary
(e.g. "notes on Gittin" or "notes on Ramban on Bereishit"), with embedded clickable anchors that
jump the reader to a specific location and, in reverse, scroll the notebook to the anchor matching
wherever the reader currently is. `lib/notebooks.ts` (the data layer — `Notebook`/`NotebookScope`
types, Tiptap/ProseMirror JSON storage, `extractAnchors`/`extractPlainText`) and the `@tiptap/*`
dependencies are already in `package.json`, but no editor UI, no `AnchorNode` Tiptap extension, no
panel, and no navigation wiring exist yet — this is the next phase, intentionally picked up in a
separate session.

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

## Yomi buttons — shipped

Ports native's `YomiService.swift` (see `AnyTorah/CLAUDE.md`'s "Yomi" section), adapted for this
catalog's flat `{category, index, chapter}` selection shape instead of native's seder/
tractateIndexInSeder pairs — `lib/yomiService.ts`'s parsers look tractates/works/books up directly
via `TextCatalog.allXTractates.find(sefariaName === ...)`, no nested seder loop needed.

`app/api/yomi/route.ts` fetches `https://www.sefaria.org/api/calendars` server-side (1hr
`revalidate`, same pattern as the other API routes — Sefaria's calendar only rolls over once a
day) and returns `parseCalendarItems`'s output directly. `Reader.tsx` fetches `/api/yomi` once on
mount (unlike native, which re-fetches per category-tab visit — the data itself isn't
category-scoped, that was only ever a lazy-trigger quirk of native's per-tab selector screen) into
a `yomi: YomiToday | null` state, and computes a `yomiButtons` array each render (one entry for
whichever of Daf Yomi/Mishnah Yomi/Rambam Yomi/929/Parsha is relevant to the current `category`;
tosefta/yerushalmi/shulchanArukh get none, matching native exactly). Rendered as a `YomiButton`
pill cluster in the toolbar — see "Toolbar layout" above for its placement relative to the other
clusters — only when `yomiButtons.length > 0` (so no empty divider shows for categories with no
Yomi jump). `jumpToYomi(r: YomiResult)` sets `category` + that category's `selection` entry
directly — no scroll-to-verse (native scrolls Parsha to its opening verse; this port has no
verse-scroll infrastructure yet, so Parsha just lands on the chapter, same as how 929 already
works here).

**Button label content, revised 2026-07-24 per explicit user feedback:** only Daf Yomi and Parsha
show what they actually point to; Mishnah Yomi, Rambam Yomi, and 929 are plain titles with no
chapter/section reference (`"Mishnah Yomi"` / `"Rambam Yomi"` / `"Today's 929"`, not `"Mishnah
Yomi: Keilim ch. 19"` etc.). Daf Yomi shows `"Daf Yomi: {tractate} {daf}"`; Parsha shows `"Parsha:
{name}"`. Names switch to Hebrew under `hebrewMode`: the Daf Yomi tractate name comes from
`findCategoryItemName("talmud", index, hebrewMode)` — a small helper (top of `Reader.tsx`) that
looks up a catalog item's display name via `getCategoryGroups`, since the Daf Yomi tractate is
usually *not* the currently-selected one and so isn't available from the component's own
`groups`/`index` state — and the daf number itself switches to `toHebrewNumeral` in Hebrew mode
(re-imported into `Reader.tsx` specifically for this; the inline chapter/daf input box stays
Arabic-numeral-only for typability, per the "Numerals" note above, but this is a display-only
label, not an input, so a Hebrew numeral is fine here). Parsha's Hebrew name comes straight from
Sefaria's calendar response (`ParshaResult.hebrewName`, populated from `displayValue.he` in
`lib/yomiService.ts`) rather than any catalog lookup — there's no catalog concept of parasha
names elsewhere in this app to reuse.

**Name-map verification, not a blind port:** native's own `talmudNameMap`/`mishnahNameMap`/
`rambamNameMap` don't transfer as-is, because this catalog's `sefariaName` spellings sometimes
differ from native's own catalog (each was independently transcribed). Verified directly against
Sefaria's live `/api/index` + `/api/calendars` output (see
[[feedback_verify_against_source_not_spotchecks]]) rather than assumed:
- **Talmud**: no map needed — every real Bavli tractate title (confirmed via `/api/index`) matches
  this catalog's `sefariaName` exactly, including "Taanit" with no apostrophe (native's catalog
  spells it "Ta'anit" and needs a map entry for exactly this reason; this one doesn't).
- **Mishnah**: 3 real mismatches found by diffing this catalog's tractate list against Sefaria's —
  `Ta'anit`→`Mishnah Taanit`, `Oholot`→`Mishnah Ohalot`, `Tahorot`→`Mishnah Taharot` (Sefaria
  spells the Mishnah tractate "Ta'anit" with an apostrophe even though the Talmud tractate of the
  same name has none — confirmed both spellings are independently real on Sefaria, not a typo).
- **Rambam**: native's 19-entry `rambamNameMap` was kept as-is (not re-derived) — spot-checked one
  entry (`"The Order of Prayer"` → `"Mishneh Torah, Prayer and the Priestly Blessing"`) against
  Sefaria's live index and confirmed `"Mishneh Torah, The Order of Prayer"` is a genuine distinct
  historical title Sefaria's calendar sometimes emits for this work, not a guess — so the rest of
  native's table (reverse-engineered from real production calendar data over time) is trusted
  too. All 73 of this catalog's Rambam `sefariaName`s independently confirmed to already match
  Sefaria's real titles verbatim, so the map only matters on the days the calendar emits one of
  these alternate names.
- **Tanakh**: no map needed — all 39 of this catalog's book `sefariaName`s (e.g. `"I Samuel"`)
  matched Sefaria's real titles exactly.

Verified live end-to-end against the real `/api/calendars` response (not mocked): Daf Yomi →
Chullin 85, Mishnah Yomi → Keilim ch. 19, Rambam Yomi → Shofar, Sukkah veLulav ch. 6, 929 → Shmuel
I 3, Parsha → Vaetchanan (Devarim 3) — clicking each button in the browser landed on the correct
daf/chapter/tractate with the right commentary panel populated.

## MISHNA:/GEMARA: must start a new line (English Talmud text)

**The bug:** on some dafim (confirmed: Berakhot 2a, Yevamot 2a), the English translation's
opening segment bundles a tractate's introductory note together with the `MISHNA:` marker into
one Sefaria segment string, separated only by `<br><br>` — e.g. `"...appropriate time to recite
Shema: <br><br><strong>MISHNA:</strong> <b>From when,</b>..."`. `stripHTML` (`lib/sefariaClient.ts`)
used to delete `<br>` tags outright (replace with `""`), so the intro and "MISHNA:" rendered
glued onto one line/paragraph instead of the intro ending and Mishna beginning cleanly. Likely
affects other tractates too, not just the two confirmed.

**Fix, two parts (`lib/sefariaClient.ts`):**
1. `stripHTML` now converts `<br>`/`<br/>` to a literal `\n` instead of deleting it. Rendered with
   `white-space: pre-line` (already applied to every English/Hebrew paragraph in `Reader.tsx`), a
   `\n` produces a real line break. This is a general correctness fix for every `stripHTML` caller
   (Hebrew, Tanakh, Rambam, SA too) — Sefaria's `<br>` was always meant to be a line break, never
   nothing.
2. `forceNewLineBeforeStructuralMarkers` (new, called from `processedEnglishWithBold` — the
   function used for Talmud/Mishnah English, see `app/api/chapter/route.ts`'s `englishProcessor`)
   explicitly inserts `\n` immediately before any `<strong>MISHNA:</strong>` / `<strong>GEMARA:
   </strong>` that isn't already at the very start of the string or already preceded by a `<br>`/
   newline. This is deliberately **not** just relying on fix #1 — per explicit user request,
   MISHNA/GEMARA should always start a new line as a standing rule, not only when Sefaria's source
   happens to include a `<br>` before it (which isn't guaranteed to hold for every tractate; most
   of the time GEMARA already starts its own Sefaria *segment*, and thus its own `<p>` in
   `Reader.tsx`'s per-segment rendering, but MISHNA sometimes doesn't, as the confirmed cases
   show). Runs on the raw HTML before `BOLD_TAG_RE` converts `<strong>`/`<b>` into placeholder
   tokens, so the inserted `\n` ends up correctly positioned before the restored
   `<span class="en-editorial">` in the final output.

Verified against the live Sefaria API (not just synthetic input) for both confirmed dafim, and
against synthetic edge cases (marker with no preceding `<br>` at all; marker already at the very
start of its segment) to confirm no double line breaks and no spurious leading blank line.
