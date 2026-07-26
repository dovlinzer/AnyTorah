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
  cluster (book/chapter/amud group, Yomi-buttons group, daf-controls group, each `ControlGroup`
  for Text/Commentary) — redundant where values match, but it's the outer `dir` that actually
  reorders the *clusters themselves*, not just each cluster's internal items. Source order is
  fixed as: book/chapter/amud cluster, Yomi buttons, daf-image controls (show/hide + position,
  Talmud only), a flex spacer, Text controls, Commentary controls. In English this reads
  left-to-right in that order; in Hebrew, `dir=rtl` mirrors the whole row, so it reads
  right-to-left in that *same* source order — i.e. a true mirror image, not just flipped labels.
  Do not re-introduce a "fixed macro position" design without the user's explicit sign-off; this
  was tried once already and reversed once already, in opposite directions, both times based on
  direct user feedback.
- **Yomi buttons cluster placement**: sits immediately after the book/chapter/amud cluster in
  source order (see `lib/yomiService.ts`/"Yomi buttons" section below for the buttons themselves).
  For Tanakh, Parsha is pushed before 929 in `Reader.tsx`'s `yomiButtons` array (source order) —
  under the toolbar's mirroring above, this reads "Parsha, then 929" left-to-right in English and
  right-to-left in Hebrew (Parsha sits closer to the selector boxes in both directions), matching
  explicit user request.
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

## Anchored Notes — design record (scrapped 2026-07-25, not in the codebase)

The bigger vision referenced above (notes tied to a specific text/commentary passage, not just a
bookmark-level field) was fully designed and a v1 was built, verified live, and committed
(`40ce5e4`) on 2026-07-24 — then **deliberately removed** from `main` on 2026-07-25 because the
user decided they want a substantially different implementation approach. The code isn't gone:
it's preserved on the `backup/anchored-notes-v1` git branch (never pushed, local-only) if it's
ever worth referencing or cherry-picking from. This section is the design record in case a future
session picks this feature back up — read it before re-deriving the plan from scratch, but don't
assume the chosen approach is still what the user wants; confirm first.

**Vision:** notes anchored directly to a specific verse/mishnah/Gemara line or commentary entry
(e.g. "this Rashi"), not just a chapter-level bookmark. Meant to serve a range of users from a
Daf Yomi listener wanting a one-tap highlight to a yeshiva student writing an extended chiddush
with formatting and links — considered the app's most likely flagship differentiator.

**Decisions reached in the scrapped design** (full rationale, app comparisons, and session-by-
session history in memory `project_anytorah_web_notes_feature`):
- Segment-level anchors only (whole verse/mishnah/commentary-entry) — no arbitrary text-range
  selection, that was judged too big a UI lift for v1.
- Tiptap WYSIWYG rich text for the note body (bold/italic/bullets/links) over markdown-lite.
- Fixed-color category swatches (6, Trello-style) with **user-editable labels** — colors are a
  stable index, labels are freeform text stored separately, so renaming never migrates data.
  Freeform tags layered on top for finer, many-per-note classification.
- **One note per anchor point** — a quick color-only highlight and a full written note are the
  same record; a highlight is just a note with an empty body until upgraded. Chosen over
  multiple-notes-per-anchor specifically to keep the indicator/popover UI simple; explicitly
  flagged as the main cost if this is ever revisited (indicator needs a stack/count, popover
  needs a list-first step).
- Local storage now, Supabase migration once account sync exists (not blocking the feature on
  that heavier-lift item).
- Build order: v1 = data model + quick highlight + full note w/ categories+tags+auto-quoted
  anchor text; v1.1 = note-count badges on pickers + export/print; later = internal deep-links
  (needs real URL routing first — this app has none today), review-resurfacing, sharing (needs
  account sync).

**A real lesson from the build-and-revert, worth keeping regardless of the next approach:** the
"click here to add a note" empty-state indicator was styled as a dashed, half-opacity ring in
`--border`, which in dark mode is nearly the same color as the page background — the *entire*
feature's discovery affordance was effectively invisible, and neither `tsc`/`eslint`/build nor
automated click-testing via accessibility-tree refs caught it (refs resolve and click regardless
of visual contrast). Only caught when the user looked at the actual rendered page. Whatever the
next indicator design looks like, verify it with an actual screenshot at rest, not just DOM
presence or successful ref-clicks.

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
