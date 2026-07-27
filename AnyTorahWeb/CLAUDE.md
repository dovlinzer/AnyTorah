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

## Tur (web-only, not yet ported to native)

A top-level category between Rambam and Shulchan Arukh, siman-based like SA (`lib/textCatalog.ts`
`TurSection`: OC/YD/EH/CM, 697/403/178/426 simanim — near-identical to SA's own 697/403/178/427,
since SA closely follows Tur's own structure historically). Reuses SA's siman navigation wholesale:
the numeric `NumberPickerModal` and, since the siman/topic structure is close enough not to need a
second transcription, SA's own named siman picker (`SASimanPicker`/`lib/saSimanNames.ts`) with no
changes beyond widening `Reader.tsx`'s render-gate to include `category === "tur"`.

**Four commentary tabs, all shown by default, no swap picker:** Beit Yosef, Bach, Darkhei Moshe,
and Prisha+Drisha combined into one tab (Prisha first, `bookDivider`-separated — same pattern as
SA's Yachin+Boaz). `CommentaryPanel.tsx`'s `allowSwap = category !== "tur"` flag disables the
swap-picker affordance and the "▾" suffix entirely, and drops the `truncate` class so all 4 full
commentator names fit (only 4 tabs, more room than SA's 3-slot case). New `CommentaryType`s:
`beitYosef`, `bach`, `darkheiMoshe`, `prishaDrisha` (the combo, via `sefariaRefVersions`,
`usesBookDivider: true`). Ref pattern is `turCommentaryRef()` in `commentaryTypes.ts`: each is its
own top-level Sefaria title, not "CommentatorName on Tur, ..." — e.g. `"Beit Yosef, Orach Chayim
1"`, built by swapping the `"Tur, "` prefix off `mainRef` for the commentary's own title.

**Depth-3 range fix:** all 5 Tur commentaries (Beit Yosef, Bach, Darkhei Moshe, Prisha, Drisha) are
`Siman -> Seif Katan -> Paragraph` (Choshen Mishpat: `Siman -> Seif -> Seif Katan`) — a bare
`"Beit Yosef, Orach Chayim 1"` returns only 1 entry vs. 17 for `"...1:1-500"` (confirmed live).
`depthFixedRef` (`lib/sefariaClient.ts`) applies a blanket `:1-500` for `category === "tur"`,
same pattern as Tanakh's `:1-200`.

**Tur's own inline commentary markers are structurally different from SA's** and are *not* given
SA's bracket-matching treatment: SA wraps actual text in `<span data-commentator="Shakh">`, but Tur
uses empty position tags (`<i data-commentator="Bach" data-order="1.1"></i>`, no wrapped content)
sprinkled between words. These just fall out through the existing generic tag-stripping pass,
except for Darkhei Moshe's, which are used for real (see below). Tur *does* bake the same leading
`<b>siman-title</b>` block into seif 1's Hebrew as SA does — `splitSimanHeader` is reused as-is.

### Paragraph splitting: derived from Beit Yosef, not punctuation

A Tur paragraph is *defined* as "from one Beit Yosef comment to the next" — Beit Yosef opens each
entry with a quote of the Tur words it's discussing, so that quote's location in Tur's raw text
becomes the paragraph break. This replaced an earlier colon-based split after two real bugs: a
colon inside a citation like OC 132's "(צא:)" (amud bet of daf צא, not a paragraph break) wrongly
split there, and OC 133's seven verse-ending colons over-fragmented one topical unit (a Psalm
list) that Beit Yosef treats as a single comment.

Machinery in `lib/sefariaClient.ts`:
- `combineTurSeifim(he)` — flattens Tur's (rare) multi-seif structure into one continuous string
  first, since Tur's own seif divisions don't align with Beit Yosef's ref structure at all; also
  extracts the siman-title header via `splitSimanHeader`.
- `stripTagsWithIndexMap()` — strips tags only (keeps punctuation/nikud), recording each kept
  character's original index so a match found in the tag-free text maps back to a safe cut point
  in the real (tag-and-all) string.
- `buildHebrewWordPattern(words)` — builds a regex matching a word sequence tolerant of
  punctuation/nikud differences between independently-digitized sources, **and** of several known
  mismatch classes (each a real bug found live against actual Tur/Beit-Yosef text, not
  anticipated):
  - **Definite article**: Tur OC 3 has "בפי טבעת" where Beit Yosef quotes it "בפי הטבעת" — each
    word tries with an optional leading "ה" (`ה?word`).
  - **Hebrew abbreviations**: a word with an internal gershayim between two letters
    (`HEBREW_ABBREVIATION_RE`, e.g. "בה"כ" = "בית הכסא", "ת"ח" = "תלמידי חכמים") genuinely drops
    letters relative to its spelled-out form — no amount of punctuation normalization bridges
    that. Tur OC 43 spells out "לבית הכסא"; Beit Yosef abbreviates the same words "לבה"כ", and a
    literal-letter match on "לבהכ" could never find it, silently sliding the match to the next
    word that did line up ("קבוע"), breaking the paragraph one word too late. Such a word is
    treated as a short unconstrained gap (`[\s\S]{0,20}`) instead of requiring its own letters —
    the words immediately before/after it still must match literally.
  - **Guard against over-permissive gaps**: refuses to build a pattern at all when more than half
    its words are these gap placeholders. Citation-heavy commentary clusters abbreviations
    constantly (e.g. "ג"ז בס"פ המוציא" — two citation abbreviations plus one generic word); with 2
    of 3 tokens wildcarded, an early version of this fix matched wherever the one remaining generic
    word ("המוציא") next recurred, many paragraphs later, skipping several real breaks in between.
    `literalCount < Math.ceil(parts.length / 2)` rejects such a window, falling through to a
    different word-count/skip or failing outright rather than risking a wild match.
- `findTurBreakpoints(combinedHe, beitYosefHe)` — for each Beit Yosef entry (forward-only cursor,
  never matching back to an earlier position even if the same short phrase recurs later), tries
  matching its opening words at decreasing word counts (`[8,6,4,3]`, longer = more confident) and,
  if that fails, retries after skipping the first 1-3 words (real cases: Beit Yosef opens with a
  rhetorical connector like "ודע ד..." = "know that..." or "ומ"ש" = "ומה שכתב" = "and what [Tur]
  wrote..." that isn't part of Tur's own text at all, so the literal quote only starts 1-3 words
  later). An entry with no match at any skip/word-count contributes no break — it merges into the
  preceding paragraph — rather than leaving a gap; this is an accepted, correct outcome for a
  free-standing Beit Yosef remark with no literal anchor anywhere in Tur's text (confirmed by
  exhaustive search), not just an unhandled failure.
- `splitByBreakpoints()` — cuts at the found offsets; a resulting chunk with no real text (e.g. a
  lone marker sitting right at a break) merges forward into the next real paragraph.
- `computeTurParagraphChunks(mainRef, combinedHe)` — the shared orchestrator (fetches Beit Yosef,
  computes breakpoints, splits) used by **both** `buildTurSegments` (the main text) and
  `fetchTurParagraphPlainList` (Bach/Prisha+Drisha's matching corpus), so both always agree on
  where a paragraph begins.
- `assignTurParagraphLabels(entries, paragraphs)` — labels each Beit Yosef/Bach/Prisha-Drisha panel
  entry with the Tur paragraph (0-based) it discusses, via the same `buildHebrewWordPattern`
  search (same forward-only, skip-retry heuristic) run against the already-split `paragraphs`
  list instead of Tur's raw text. Shares the matcher with `findTurBreakpoints` rather than having
  its own separate implementation — an earlier version had its own cruder
  `normalizeForMatch`-then-substring matcher, which was a real consistency risk (a fix to one
  wouldn't reach the other) until consolidated. `entries` may contain a `bookDivider` between
  Prisha's and Drisha's own entries — each is a separate work commenting on Tur from its own
  start, so the search cursor and carried-forward label both reset there. Beit Yosef's own numbering
  is exact by construction (entry N's quote *is* where paragraph N begins); other commentaries are
  a best-effort heuristic match against the same paragraph list.
- Real, accepted trade-off: Tur's main-text load fetches Beit Yosef even when its tab isn't open
  (needed to compute paragraph breaks), and `fetchTurParagraphPlainList` independently re-fetches
  it again for the commentary route — simplicity over micro-perf, not an oversight.

### Darkhei Moshe markers — two sources, one placeholder format

Darkhei Moshe's real printed reference-number anchors are recovered from two places, not computed:

- **In Tur's own text**: Sefaria's HTML bakes in `<i data-commentator="Darkhei Moshe"
  data-order="N.M">` position markers, and the `data-order` integer already *is* the correct
  1-based sequential number matching Darkhei Moshe's own entries in fetch order — no separate
  counter needed. `processTurMarkers()`/`TUR_DM_MARKER_RE` convert these into a `<dm>N</dm>`
  placeholder; `processedHebrewWithTurMarkers()` renders survivors as `(א)`, `(ב)`, ... (parenthesized
  Hebrew numeral via `saHebrewLetter`, matching real printed Tur volumes) inline at normal
  baseline. Every other commentator's own markers in the same text, plus Sefaria's unlinked
  "Hagahot" tags (confirmed via the links API to not resolve to any real fetchable work), are left
  alone and fall out via generic tag-stripping.
- **In Beit Yosef's own text, for markers Tur's own tags miss**: Darkhei Moshe sometimes comments
  on Beit Yosef's own words rather than Tur's (user insight, verified against a printed edition at
  5 separate positions across 2 simanim, all correct). Beit Yosef's raw text carries the same kind
  of tag, spelled `"Darchei Moshe"` (with a c) vs Tur's `"Darkhei Moshe"` (with a kh) — critically,
  its `data-order` is **not** reliable (every Beit-Yosef-side tag on a given siman can say
  `data-order="1"` regardless of which comment it anchors). Method: Tur's own `data-order` values
  are trusted as-is for whichever entries they cover; the remaining ("missing") entry numbers are
  filled, in ascending order, by Beit Yosef's own `"Darchei Moshe"`-tagged entries taken in
  document order — completely ignoring Beit Yosef's own unreliable `data-order`. Any entry number
  left over once Beit Yosef's tags are exhausted gets no marker anywhere (an honest, accepted gap,
  not a guess). `computeBeitYosefDarkheiMosheMarks(mainRef, turRawHe, beitYosefEntries)` returns a
  `Map<beitYosefEntryIndex, dmNumber>`; `insertBeitYosefDarkheiMosheMark` splices the same
  `<dm>N</dm>` placeholder into that entry's raw HTML, reusing `processedHebrewWithTurMarkers` so
  Beit Yosef's markers render identically to Tur's own. Wired into `app/api/commentary/route.ts`'s
  `beitYosef` branch: `assignTurParagraphLabels` runs first (on the *original* entries), marks are
  inserted after — the inserted `<dm>` digit must never end up among the "opening words" the
  paragraph-matching heuristic searches with.

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

**Logo lives in its own left sidebar column, not the toolbar row (2026-07-26).** Several rounds
this session tried to fix the toolbar row wrapping onto a second line by shrinking the logo/title
(64px→48px, `text-2xl`→`text-xl`, tagline `text-sm`→`text-xs`) and adding buffer between it and
the tabs — all still sharing one row via `justify-between`. That approach hit a hard ceiling: the
category tabs + all the header buttons need ~1100px on their own in Hebrew mode (Hebrew's buttons
are sized a step larger than English's, see the pill-sizing note below), and the logo block was
±300px of *additional* competition for the same row — no amount of shrinking made both consistently
fit one line at normal desktop widths. Per explicit user request, the logo/title were pulled out
entirely into a permanent left sidebar column (`Reader()`'s top-level return is now `<div className="flex h-screen w-full">` containing a `shrink-0` sidebar div first, then the existing
`mx-auto max-w-7xl/max-w-[100rem]` reading column as the second, `flex-1` child) — this was a
deliberate choice over the alternative (floating the logo in the page's outer margin only on wide
screens, invisible/falling back on narrower ones): the sidebar is *always* reserved, at every
width, so the toolbar row consistently gets the reading column's full width without the logo
competing for it, rather than only working above some viewport threshold. Logo/title were then
bumped back up to a comfortable size (`.yct-logo` 64px, title `text-3xl`, tagline `text-sm`) since
they no longer cost the toolbar row anything. `mx-auto` on the reading column still centers its
capped width within whatever space remains next to the sidebar — flexbox respects `margin: auto`
on a flex-grow item for exactly this "capped-width content, centered in the leftover space"
composition. Verified live: one line in both languages at 1366px+ (most real laptop/desktop
widths); still gracefully wraps via the toolbar's own `flex-wrap` rather than overlapping anything
below that.

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

**List-button icon + header grouping (revised 2026-07-26):** the list button was a 🔖 emoji with
a bookmark count; replaced with `BookmarkListIcon` (`Reader.tsx`) — a custom outline star-with-
list-badge SVG (`currentColor` stroke so it matches the button's theme color automatically,
`var(--background)` knockout circle behind the badge) — per an explicit user reference image, and
the count suffix was dropped entirely (space-saving, same call the highlight button's count got,
see "Highlights" below). The button cluster (everything except the category tabs) is split into
three groups by `VerticalDivider` (already used elsewhere for the second toolbar row, reused as-
is): Hebrew-mode + reverse-nav toggles | bookmark star + bookmark list | notebook + notebook-
search + highlights — explicit user request to visually group "associated" controls. That trio's
order was also changed to notebook → notebook-search → highlights (was highlights, notebook,
notebook-search before) per the same request. The category tabs themselves are a separate flex
child from this whole button cluster — see the next note for how the two are positioned relative
to each other.

**Category tabs and buttons sit at opposite ends of the header (2026-07-26):** per explicit user
request, the main text picker (category tabs) and every other header button are two separate flex
children — not one cluster — inside `<header dir={hebrewMode ? "rtl" : "ltr"} className="flex
flex-wrap ... justify-between ...">` (`Reader.tsx`). `justify-between` plus the `dir` flip puts
tabs at the row's start edge and the button cluster at its end edge, tracking direction: English
reads tabs-left/buttons-right, Hebrew mirrors to tabs-right/buttons-left.
**A real layout bug, found live and fixed same session:** an earlier version of this header gave
the wrapper `min-w-0 flex-1` so it could stretch to fill the line it wrapped onto — but `min-w-0`
also tells the *page header's own* flex-wrap calculation that this item can shrink to ~0, so the
header never actually wrapped it to a new line; it just squeezed the wrapper's box smaller than
its two `shrink-0` children (tabs, buttons) needed, and they overflowed that squeezed box instead.
In Hebrew mode the button cluster sits at the wrapper's RTL "end" — physically the *left* edge —
so the overflow spilled left into whatever sat there (at the time, the logo, before it moved into
its own sidebar — see "YCT Branding" above), which is why the bug was visible in Hebrew mode but
not English (English's overflow spilled right, into open space). Fix: drop `min-w-0`, keep
`flex-1`. Without it, the header's wrap-time minimum size is the wrapper's real content width (its
`shrink-0` children can't shrink below their own size), so the header now correctly wraps the
whole row to its own line instead of crushing it — the standard flexbox trap: `min-width: auto`
(the unset default) is what makes a flex item's *own* content size count as its wrap-time minimum;
`min-w-0` deliberately opts out of that, which is right for a scrollable/truncating item but wrong
here.

**Hebrew-mode pill sizing is one step larger than English's (2026-07-26):** category tabs, the
EN/עב + ⇄ toggles, and every bookmark/notebook/highlight button size up
(`px-3 py-1.5 text-sm`→`px-4 py-2 text-base`, icons 16-17px→19-20px) when `hebrewMode` is on, vs.
English's `px-2 py-1 text-xs`→`px-3 py-1.5 text-sm` step. Rationale, confirmed by the user directly
(not assumed): Hebrew glyphs render visibly smaller than Latin ones at the same font size, and
Hebrew mode was never actually short on toolbar width the way English is — English's category
labels ("Shulchan Arukh" vs. "שו״ע") are the long pole. `tabsContainerClass`/`tabButtonClass`/
`pillButtonClass` (computed once near the top of `Reader()`'s render, `hebrewMode`-conditional)
feed every one of these buttons so the two sizing scales stay centrally defined in one place.

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

**Header button icon + quote-length cap (2026-07-26):** the header's "view highlights" button was
a 🖍️ crayon emoji with a highlight-count suffix; replaced with `HighlighterIcon` (`Reader.tsx`) — a
custom SVG built to actually look like a highlighter marker (angled barrel + felt tip + a short
highlighted stroke, fixed orange/black colors rather than `currentColor` since the marker's own
color is part of what reads as "highlighter") — per an explicit user reference image. The count
suffix was dropped (see "Bookmarks + Notes" above for the same treatment on the bookmark-list
button). Separately, `anchorQuoteHe`/`En` are now capped at 250 characters
(`truncateAnchorQuote()`, `lib/textAnchor.ts`, appended with `…` when cut) — a highlighted long
Rashi or other verbose commentary entry used to copy its entire text into the note editor
uncapped. Wired into both capture paths: `stripAnchorHTML` (main-text segments, `Reader.tsx`) now
truncates as its last step, and `CommentaryPanel.tsx`'s paragraph path (which has no HTML to
strip, so it couldn't route through `stripAnchorHTML`) calls `truncateAnchorQuote` directly on its
already-`displayMode`-gated `he`/`en` strings.

## Notebook — Phase 1 shipped (editor core + anchor creation)

A separate, long-form rich-text document per book/commentary (e.g. "notes on Gittin" or "notes on
Ramban on Bereishit"), with embedded clickable anchors that jump the reader to a specific
location. Builds on the same data layer referenced above (`lib/notebooks.ts` — `Notebook`/
`NotebookScope`, Tiptap/ProseMirror JSON storage, `extractAnchors`/`extractPlainText`), which
needed no changes for this phase — confirmed by reading it fresh rather than trusting the design
notes above, since `lib/textAnchor.ts` had gained `paragraphIndex` gating since this was designed
and the two needed to still line up (they did).

**Surface — a persistent side panel, not a modal:** deliberate choice over Bookmarks/Highlights'
modal chrome, so the user can click a paragraph in the reader while the notebook stays open. Sits
to the right of the Commentary panel as a third resizable column (`components/Reader.tsx`:
`notebookOpen`/`notebookWidth`/`adjustNotebookWidth`, mirroring the existing `commentaryWidth`
pattern exactly), toggled by a new 📓 header button. A Notebook is scoped to a whole book/
commentary, not a chapter (see `NotebookScope`) — the panel defaults to whatever the reader is
currently showing (main text) and has its own in-panel `<select>` to switch to any commentary
currently active in the Commentary panel's slots (`effectiveSlots`), each a fully separate
document.

**New files:**
- `components/notebook/AnchorNodeExtension.ts` — custom Tiptap inline atom node (`name: "anchor"`)
  storing `{anchor: TextAnchor, nodeId, label}` as plain attrs (not HTML) so it round-trips
  losslessly through `Notebook.bodyJSON`. Takes an `onNavigate` extension option wired per-editor
  instance.
- `components/notebook/AnchorPill.tsx` — the NodeView (`ReactNodeViewRenderer`): a small inline
  pill button (📍 + label) that calls `onNavigate` on click.
- `components/NotebookPanel.tsx` — the panel itself: Tiptap `useEditor` (StarterKit + Underline +
  Link + the anchor node + `IndentExtension`/`TextDirectionExtension`, see below), a toolbar
  (bold/italic/underline, H1–H3, bullet/ordered list, indent/outdent, blockquote, link via a plain
  `window.prompt`, LTR/RTL toggle), debounced (500ms) autosave through `saveNotebook`/
  `loadNotebook`, and a flush-save on unmount so switching scope or closing the panel doesn't drop
  the last few hundred ms of typing. **Mounted with `key={notebookScopeKey(scope)}` from
  `Reader.tsx`** — switching scope remounts the whole editor rather than manually resyncing
  content, deliberately simpler than fighting `useEditor` over content sync.
- `components/notebook/IndentExtension.ts` — a global `indent` attribute (margin-left steps) on
  paragraph/heading/blockquote, plus `indent`/`outdent` commands. Deliberately separate from list
  nesting: the toolbar's Indent/Outdent buttons check `editor.isActive("listItem")` first and use
  StarterKit's own `sinkListItem`/`liftListItem` there instead, only falling back to this
  extension's margin-based indent for plain blocks.
- `components/notebook/TextDirectionExtension.ts` — a global `dir` attribute (paragraph/heading/
  blockquote/listItem) so a single block can be flipped RTL for a line of Hebrew inside otherwise-
  English notes. Only supplies the attribute — `setTextDirection`/`unsetTextDirection` themselves
  are **already built into every Tiptap editor** (part of `@tiptap/core`'s always-included
  `Commands` core extension, same bundle as `focus`/`setContent`), so the toolbar button calls
  those directly. Note: `@tiptap/core` v3.29 also ships an internal `TextDirection` Extension
  class in its source, but that class itself isn't in the installed version's actual public export
  surface (confirmed absent from both the bundled `.d.ts`'s export list and the compiled `.cjs`'s
  `exports` — a real gap in that release, not a typing issue) — hence this small equivalent instead
  of importing the built-in one.

**Toolbar buttons must call `e.preventDefault()` on `onMouseDown`, not just `onClick`
(real bug, found and fixed live, not just a design note):** a plain `mousedown` on a toolbar
`<button>` blurs the editor's contentEditable and can shift its ProseMirror selection *before*
`onClick`'s command runs — confirmed live: clicking Bullet List immediately after pressing Enter
for a new line wrapped the *previous* paragraph instead of the one the cursor was actually in,
even though `.chain().focus()...run()` looked correct. `ToolbarButton` (`NotebookPanel.tsx`) now
sets `onMouseDown={(e) => e.preventDefault()}` on every toolbar button, which keeps the DOM
selection intact so the command sees the real, current selection. This is the standard, widely-
documented Tiptap/ProseMirror toolbar fix — apply it to any future toolbar button added here.

**Anchor creation — click a paragraph while the panel is open:** `HighlightMark.tsx` grew an
optional `onInsertToNotebook` prop — a small 📌 button, hidden until hover (`group`/`group-hover`),
positioned in the corner of the same click-target `HighlightMark` already wraps for highlighting.
Purely additive: the existing highlight click path is untouched, and the button only renders when
the prop is passed, which `Reader.tsx`/`CommentaryPanel.tsx` only do while `notebookOpen` is true.
Clicking it calls into the currently-open `NotebookPanel`'s `insertAnchor` via a ref
(`notebookInsertRef`) set through an `onEditorReady` callback — avoids threading the Tiptap editor
instance itself through props.

**Anchor navigation — one-directional only in this phase:** clicking a pill calls
`navigateToAnchor` (`Reader.tsx`, same shape as the existing `handleNavigateBookmark`) which lands
on the anchor's chapter/halakha. **Does not** scroll to the exact paragraph — this app has no
scroll-to-segment infrastructure yet (same documented limitation for Yomi/929 jumps in
`AnyTorah/CLAUDE.md`), so this isn't a new gap, just an existing one this feature also runs into.

**Bullet/numbered lists showed no marker (second bug behind the same symptom):** Tailwind's
preflight resets `ul`/`ol` to `list-style: none`, so even once the selection bug above was fixed,
toggling a list only indented the text with no visible bullet or number. `globals.css`'s
`.notebook-editor-content .ProseMirror ul/ol` rules now set `list-style-type` explicitly (disc/
decimal, with circle/square for nested `ul`s).

Verified live: editor persists across a full page reload (`anytorah:notebooks` in localStorage,
one entry per scope key, confirmed separate documents for main text vs. a commentary on the same
book), toolbar formatting commands, anchor-pill insertion and click-to-navigate round trip, both
themes at rest.

## Notebook — Phase 2 shipped (reverse sync, search, section colors, tags)

Builds on Phase 1 above. Four features, all in the same session per user request: reverse sync
(the piece explicitly deferred from Phase 1), in-notebook find, cross-notebook search, and a way
to color-code/tag passages within one notebook — modeled on Highlights' color/tag mechanism per
explicit user design decisions (see below).

**Design decisions locked in via AskUserQuestion before building:**
- Reverse sync auto-follow: when the reader navigates, the panel's scope snaps to "main" on any
  category/index change (new book/tractate) but **not** on a plain chapter/daf step within the
  same book — switching a commentary tab in `CommentaryPanel` sets focus to that commentary and it
  *persists* across chapter navigation, so stepping through a tractate while reading a specific
  commentary's notes keeps following that commentary instead of snapping back every daf.
- Section coloring: an inline highlight **mark** on selected text (like a real highlighter), not a
  block/divider node — reuses `lib/highlightCategories.ts`'s exact 4 colors/labels for visual
  consistency with reader Highlights.
- Tags: **per-section** (inline chips insertable at the cursor), not whole-notebook — chosen over
  the simpler whole-doc-tag option specifically so cross-notebook search can filter to a tagged
  passage, not just a tagged document.

**Reverse sync — auto-follow + scroll/flash:**
- `CommentaryPanel.tsx` gained `onActiveTypeChange?: (type) => void`, fired from a `useEffect` on
  `[activeType]` — the only place that knows which commentary tab is currently active.
- `Reader.tsx`'s `notebookFocusSource` state (`{source:"main"}` or `{source:"commentary",
  commentaryType}`) replaces the old `notebookSourceOverride`. Reset to `"main"` only on
  `[category, index]` change (not chapter/halakha — see design decision above); set from three
  places: `CommentaryPanel`'s `onActiveTypeChange`, the panel's own scope `<select>`, and
  cross-notebook search navigation (`navigateToNotebookScope`).
  **Ordering hazard, worked around:** `navigateToNotebookScope` changes `category`/`index` *and*
  wants a specific (possibly non-"main") focus in the same tick, but the `[category, index]` reset
  effect fires *after* that render regardless of call order and would stomp an explicit
  `setNotebookFocusSource` call made just before it. Fixed with `pendingNotebookFocusRef` — the
  navigate function stashes the desired focus there before triggering the category/index change,
  and the reset effect consumes (and clears) the pending value instead of defaulting to "main"
  when one is present.
- `NotebookPanel.tsx` takes `readerChapter`/`readerHalakha` props (primitives, not an object, so
  the effect's dependency array stays stable) and a `useEffect` that calls `extractAnchors` on the
  live doc, filters to matches at that chapter/halakha, `scrollIntoView`s the first match, and adds
  a `notebook-anchor-flash` class (a 1.6s CSS keyframe pulse, `globals.css`) to every match, timing
  out the class after 1.6s. Runs on every mount too (not just subsequent navigation), which is what
  makes switching scope or reopening the panel "always show the matching notebook."
- `AnchorPill.tsx`'s `NodeViewWrapper` now renders `id={node.attrs.nodeId}` so the effect above can
  `getElementById` it — this was the one missing piece Phase 1 didn't need (nothing used the id).
- Still doesn't scroll to the exact *paragraph* — chapter/halakha granularity only, same
  documented limitation as anchor navigation itself (no scroll-to-segment infrastructure).

**In-notebook find — `components/notebook/SearchExtension.ts`:** a from-scratch Tiptap `Extension`
(no official Tiptap search extension exists in this installed version) — a ProseMirror `Plugin`
with a `DecorationSet` state field decorating every case-insensitive text match, plus
`setSearchTerm`/`goToNextMatch`/`goToPreviousMatch` commands that move the editor's real selection
to the active match and call `tr.scrollIntoView()`. Toolbar 🔍 button toggles a find bar (input +
match count `"N / M"` + prev/next + close) in `NotebookPanel.tsx`; `onTransaction` mirrors
`editor.storage.notebookSearch` into React state so the count re-renders live.
**Lint gotcha worth keeping:** the natural implementation aliases `this` to a local var inside
`addProseMirrorPlugins()` (the standard pattern in Tiptap's own docs for this kind of extension) —
this repo's `@typescript-eslint/no-this-alias` rule rejects that. Fixed with a `() => this.storage`
closure instead of `const extensionThis = this`, which reads live off `this` without an alias.

**Cross-notebook search — `NotebookSearchModal.tsx`:** mirrors `HighlightsListModal.tsx`'s chrome.
Loads all notebooks via `loadNotebooks()`, searches each one's `extractPlainText` (already folds in
anchor *and* tag labels, so a search for a tag name or an anchor's book name also matches), and
shows a tag-filter chip row built from the union of every notebook's `extractTags`. New header 🔎
button ("Search all notebooks"), always available (not gated on the panel being open). Clicking a
result calls `navigateToNotebookScope(scope, query)` (Reader.tsx) which switches category/index,
sets `notebookFocusSource`, opens the panel, and seeds `NotebookPanel`'s find bar via
`initialSearchTerm`/`onInitialSearchConsumed` so the user lands on the actual hit.
**Real bug found via live testing, fixed same session:** the seed-search effect was originally
keyed on `[editor]` only ("run once when the editor becomes available"), which silently did
nothing when the search result's scope was *already* the currently-open notebook — same
`key={notebookScopeKey(scope)}`, so `NotebookPanel` doesn't remount and `editor` never changes.
Fixed by keying the effect on `[editor, initialSearchTerm]` instead, and having it explicitly
`setFindOpen(true)`/`setFindQuery(term)` rather than relying on `useState`'s mount-only initializer
for those two — covers both the fresh-mount case and the same-instance case.
`lib/notebooks.ts` gained `formatNotebookScopeLabel(scope)` (book/commentary name without a
chapter, since a Notebook is scoped to a whole book — reuses `getCategoryGroups`/
`getCategoryDisplayName` from `categoryCatalog.ts`, same data `bookmarks.ts`'s private
`getItemName` draws from) for the modal's result headers.

**Section colors — `components/notebook/SectionColorExtension.ts`:** a Tiptap `Mark` (not a node)
with one `colorIndex` attribute, rendered as `<span data-color-index="N" class="notebook-section-
color-N">`. `setSectionColor(i)` does `unsetMark().setMark(colorIndex:i)` (pick-a-color semantics,
not toggle — matches `HighlightColorPicker`'s own swatch UX) rather than a plain toggle, so
re-clicking a different color while some other color is active always switches to the new one; a
dedicated ✕ button is the only "remove" affordance. Toolbar renders 4 small `.highlight-dot-N`
swatches (same class Highlights' own color picker uses) with labels loaded from
`loadHighlightCategoryLabels()` — a label rename in the Highlights feature automatically renames
these swatches' tooltips too, since both read the same localStorage-backed labels.
CSS (`globals.css`): `.notebook-section-color-0..3`, same opacity/mix formula as `.highlight-
text-0..3` but declared separately (different DOM host, `<span data-color-index>` vs. the reader's
own highlight-mark wrapper) rather than sharing a class.

**Per-section tags — `components/notebook/TagNodeExtension.ts` + `TagChip.tsx`:** an inline atom
node (`name: "tag"`, mirrors `AnchorNodeExtension` exactly — plain JSON attrs `{tagId, label}`, not
HTML) inserted via a toolbar 🏷 button that does `window.prompt("Tag name")` (same UX as the
existing Link button, not a new pattern). `TagChip`'s `NodeViewWrapper` renders `id={tagId}` (same
scroll-target convention as `AnchorPill`) and its own inline ✕ that calls the NodeView's
`deleteNode()` — unlike the anchor pill, nothing else in the editor removes a tag chip, so it needs
its own delete affordance. `lib/notebooks.ts` gained `extractTags(doc)` (walks for `type==="tag"`
nodes, same shape as `extractAnchors`) and `extractPlainText` now also folds in tag labels
alongside anchor labels, so cross-notebook search matches by tag text without a separate index.

**Verified live** (browser preview, both themes at rest): reverse sync auto-switches the panel's
scope dropdown the instant a commentary tab is clicked, without touching the notebook at all;
scroll+flash CSS confirmed correct (`animation-name` present, computed background matches the
keyframe's end state); in-notebook find highlights all matches and steps through them with a live
"N / M" count; cross-notebook search finds a note by its prose, navigates across categories
(Tanakh → Talmud), opens the panel on the right scope, and lands with the find bar pre-seeded on
the actual hit; a section-color mark applied via toolbar persists through a full page reload; a tag
chip inserts, renders, and its ✕ deletes cleanly, leaving the surrounding prose intact.
**Automation note, not a product bug:** the browser-preview tooling used for this verification
couldn't drive native mouse-drag text selection or `window.prompt()` reliably inside the
ProseMirror `contentEditable` (selection stayed collapsed regardless of click/double-click/
triple-click/drag, and `prompt()` throws "not supported" in that harness) — real Chrome has neither
issue. Selection-dependent checks were done by programmatically constructing a `Range` +
dispatching `selectionchange` (which Tiptap's own selection sync picks up correctly, so it's
exercising the real command path) rather than skipped.
`npm run build`/`tsc --noEmit`/`npm run lint` all clean (lint's remaining `react-hooks/refs`/
`set-state-in-effect` items are pre-existing in `Reader.tsx`, confirmed against a stashed baseline
— none introduced this session).

## Notebook — Phase 3 shipped (naming, granular anchors, cross-notebook picker, outline)

Built in the same session as Phase 2 above, in response to live user testing feedback right after
Phase 2 shipped. Eight distinct fixes/features; all verified live.

**Scope naming (main text now has a real name, not "Main text"):** `formatNotebookScopeLabel`
(`lib/notebooks.ts`) now covers the main-text case too — `"Bereshit"` for Tanakh (unambiguous on
its own), `"Bavli, Gittin"` for every other category (tractate/work names repeat across
categories, e.g. Mishnah vs. Talmud Pesachim, so those get a `"CategoryName, Book"` prefix).
`Reader.tsx`'s `notebookScopeOptions` now builds every option's label through this one function
(previously hand-rolled "X on Y" inline) so the panel's dropdown, its header line, and the
cross-notebook search modal all describe a scope identically.

**Full Hebrew localization when saHebrewMode is on:** `formatNotebookScopeLabel` and
`formatAnchorLabel` (`lib/textAnchor.ts`) both take a `hebrewMode` param now — book/tractate name
via the already-Hebrew-aware `getCategoryItemName` (new shared helper, see below), commentary name
via `hebrewDisplayName`, and the connector word itself localizes ("on" → "על"). `NotebookPanel.tsx`
threads `hebrewMode` down from `Reader.tsx` for both the scope label and newly-inserted anchor
pills — existing pills keep whatever language they were created in (a snapshot, like Highlights'
anchor-quote capture, not a live-recomputed value), which is a deliberate, not accidental,
limitation.

**New shared helper — `getCategoryItemName`** (`lib/categoryCatalog.ts`): the same
`getCategoryGroups`-then-`find` book-name lookup was independently duplicated three times
(Reader.tsx's `findCategoryItemName`, `formatNotebookScopeLabel`, and now `formatAnchorLabel`) —
consolidated into one exported function; the three call sites became thin wrappers/direct callers.

**Scope picker lists every notebook ever created, not just the current book's:** the panel's
`<select>` now has two `<optgroup>`s — "This book" (the existing per-book options) and "Other
notebooks" (every notebook from `loadNotebooks()` whose scope key isn't already in the first
group, labeled via `formatNotebookScopeLabel`, alphabetized). Picking an "Other notebooks" entry
calls a new `onNavigateToOtherScope` prop — wired in `Reader.tsx` to the same
`navigateToNotebookScope` function cross-notebook search already used, reused as-is (it already
handled changing category/index and seeding a focus).

**Font-size slider**, matching the Text/Commentary panels: a self-contained `fontSizeLevel` state
in `NotebookPanel.tsx` (own localStorage key `anytorah:notebookFontSizeLevel`, same
load/clamp/store pattern Reader.tsx uses for the other two panels, just not lifted to Reader.tsx
since nothing outside this panel needs it) drives a `FontSizeSlider` in a new footer row, and an
inline `fontSize` style (via `fontSizePx(14, level)`) on `EditorContent` — the CSS's heading/list/
blockquote rules are already `em`-relative (`globals.css`), so they scale for free.

**Anchor labels went from chapter-only to granular** — this was the biggest single change.
`TextAnchor` (`lib/textAnchor.ts`) gained two optional fields, both captured once at
anchor-*creation* time (same snapshot philosophy as `Highlight.anchorQuoteHe/En` — an anchor pill
displayed later has no guarantee the source segment data is still loaded):
- `amud?: "a" | "b"` — Talmud only.
- `segmentLabel?: string` — verse/mishnah/halakha/seif number (Tanakh, Mishnah, Tosefta, Rambam,
  Shulchan Arukh — taken from `TextSegment.label`/`CommentaryEntry`'s outer-index number, colon-
  stripped) **or**, for Talmud/Yerushalmi (no per-segment numbering at all), a short "opening
  words" excerpt of the paragraph — the dibbur-hamatchil convention for a commentator, the gemara's
  own opening words for the main text. Built by the new `buildSegmentLabel(marginLabel,
  hebrewText, englishText)` helper; callers pass the *raw*, ungated segment/paragraph text (not
  the display-mode-gated `quoteHe`/`quoteEn` used for Highlights) so opening words are capturable
  regardless of which language is currently toggled — both are already fetched either way.
  `formatAnchorLabel` produces e.g. `"Bereshit 1:2"`, `"Berakhot 1:א"`, `"Gittin 2b — פתח רבי"`,
  falling back to the old chapter-only `buildDisplayTitle` format when either field is absent
  (anchors created before this shipped).
- Capture wiring: `Reader.tsx`'s `buildAnchor` gained two more optional params; the two
  `onInsertToNotebook` call sites (main text, `CommentaryPanel.tsx`) compute `segmentLabel`/`amud`
  right where the segment/entry data is already in scope. `CommentaryPanel.tsx` had to stop
  gating its Hebrew/English paragraph split on the current `displayMode` (`heParagraphsAll`/
  `enParagraphsAll` computed unconditionally now, with the existing gated `heParagraphs`/
  `enParagraphs` just a slice of those) so opening-words capture always has real text to work
  with.
- Reverse sync got amud-aware for free once the data existed: `NotebookPanel.tsx`'s matching
  filter now also checks `!a.anchor.amud || a.anchor.amud === readerAmud` — an anchor without a
  captured amud (older data) still matches on chapter alone (broader, unchanged behavior); one
  with a captured amud only flashes when the reader is actually on that amud.

**In-notebook find now matches tag chip labels, and can filter to a highlight color.**
`SearchExtension.ts`'s `findMatches` walks for `type === "tag"` nodes matching the query too (a
tag chip's whole node is "the match," same convention `extractAnchors`/`extractTags` use), and a
new `colorFilter` (`setColorFilter` command) restricts/seeds matches to text carrying a
`sectionColor` mark of a given index — with no text term, the filter alone becomes "every run of
this color." A new swatch row in the find bar (reusing the toolbar's `.highlight-dot-N` styling)
toggles it. Closing find (✕ or the toolbar button) clears both the term and the color filter.

**Cross-notebook search gained a notebook picker and a highlight-color filter.**
`lib/notebooks.ts` gained `extractColoredRuns(doc)` (every text run carrying a `sectionColor`
mark, paired with its color index — mirrors `extractTags`'s walk shape). `NotebookSearchModal.tsx`
now tracks `excludedScopeKeys` (empty = everything included, so newly-loaded notebooks default to
"in" without needing to pre-populate a positive selection set) behind a collapsible "Searching N
of M notebooks" checkbox list (All/None shortcuts), and a color-swatch filter row identical in
spirit to the in-notebook one. When a color filter is active with no text query, a result's
preview snippet is the actual colored run's text, rendered in that highlight's real
`.highlight-text-N` style rather than the generic doc-start snippet.

**Outline panel — "jump to heading" navigation**, the one item that shipped as the simpler half of
"collapsible sections and/or a navigation panel": collapsing text under headings would need a
custom fold/hide mechanism in Tiptap (hiding sibling nodes until the next same-or-higher heading)
— a materially larger, riskier build than the navigation panel alone, which already solves "find
my way around a long notebook." A new 📑 toolbar button toggles a scrollable list built from
`extractHeadings(editor)` (walks `editor.state.doc` for `heading` nodes, capturing `{level, text,
pos}` — recomputed on every `onUpdate`, not just on open, so the outline stays live while typing),
indented by level. Clicking an entry calls `editor.view.nodeDOM(pos)` to get the heading's actual
rendered DOM element, `scrollIntoView`s it, and briefly flashes it (`notebook-heading-flash`, a
1.2s CSS pulse, same convention as the anchor-flash animation) — no custom IDs or a dedicated
extension needed, since ProseMirror's own `nodeDOM` already resolves a live document position to
its rendered element.

**Verified live**, including a clean second browser tab specifically to rule out stale
console-buffer noise from the long testing session in the original tab (a `useEffect` deps-array-
size warning turned out to be leftover history from *before* this session's fixes, not a real
bug — confirmed by reproducing the exact same interaction in a fresh tab with an empty console and
seeing nothing): main-text/Hebrew-mode/Talmud-daf-amud scope labels, cross-book "Other notebooks"
navigation, the font slider, granular anchor labels in both English and Hebrew (verse-level and
Talmud-opening-words), in-notebook tag/color find, cross-notebook notebook-picker + color filter
with real-highlight-styled snippets, and the outline panel's list + indentation + scroll/flash.
`npm run build`/`tsc --noEmit`/`npm run lint` all clean throughout, lint count matching the
committed Phase 2 baseline exactly at every checkpoint (no new issues at any point in this
session).

**Phase 3 follow-up round (same session, from live-testing feedback on Phase 3 itself):**
- The panel's own chrome (header line + scope `<select>`) is now fully Hebrew/RTL, not just the
  label *text* inside it — `dir={hebrewMode ? "rtl" : "ltr"}` plus `text-align: right` on both, and
  the header word itself switches ("Notebook" → "מחברת", still an em-dash before the scope label).
  The optgroup headers localize too: `"This text"`/`"Other notebooks"` → `"הטקסט הזה"`/`"עוד
  מחברות"`. ("This book" was renamed to "This text" in English at the same time — a plain wording
  fix, unrelated to Hebrew.)
- Cross-notebook search's notebook picker (added earlier this session) turned out to be a real
  discoverability miss — collapsed-by-default behind a small `▸ Searching N of M notebooks` link
  was easy to not notice at all. Now opens expanded by default (still collapsible to save space
  once someone has many notebooks) with clearer accent-colored text ending in "— click to choose".
- In-notebook find gained a tag-chip row (mirrors the cross-notebook modal's own tag row) —
  `noteTags` state tracks `extractTags(editor.getJSON())` deduped/alphabetized, recomputed on
  every `onUpdate`/`onCreate` alongside the existing `headings` tracking. Clicking a chip sets the
  find query to that tag's label, reusing `SearchExtension`'s existing tag-matching (no new search
  logic needed — this was purely a missing *listing* of what's already searchable).
  **Not a bug, but caused real user confusion, worth flagging for next time:** this row is
  `noteTags.length > 0 &&`-gated, same convention as the cross-notebook modal's own `allTags.length
  > 0` gate — it's invisible in any notebook that has zero tag chips inserted, by design, not a
  loading/rendering issue. The user reported "not seeing" it while testing in a notebook that
  simply had no tags yet; confirmed working as soon as a tag existed. If this comes up again,
  check for an actual `.notebook-tag-chip` in that notebook's content before assuming a regression.

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
