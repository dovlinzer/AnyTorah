# AnyTorah — CLAUDE.md

**iOS project:** `/Users/dovlinzer/claudecode/AnyTorah/AnyTorah/` (Xcode project at root)
**Android project:** `/Users/dovlinzer/claudecode/AnyTorah/AnyTorahAndroid/`

> **Both platforms:** Unless explicitly told otherwise, every feature, bug fix, and improvement must be applied to **both** the iOS and Android projects.

iOS app (Swift/SwiftUI, iOS 17+) for browsing Torah texts via the Sefaria public API. Built with `@Observable`, `@Bindable`, and `@MainActor` throughout — no Combine, no StateObject. Android is Kotlin/Compose with an `@HiltViewModel`-based architecture.

## Build & Run

**iOS:** Open `AnyTorah.xcodeproj` in Xcode and run on simulator or device. No package dependencies. `project.yml` is a XcodeGen spec (not normally needed unless regenerating).

**Android:** Open `AnyTorahAndroid/` in Android Studio. Standard Gradle build.

### Verification workflow — user runs full builds/tests/simulator checks

Compiling and testing both platforms from the agentic CLI is slow and token-heavy: `xcodebuild`/
`./gradlew` produce large logs, native builds are much slower than `tsc`/`next build`, and the
iOS Simulator control tool needs a one-time `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
(can't be run non-interactively) — without it, simulator verification falls back to raw
`xcrun simctl`, which can install/screenshot but can't simulate taps, so interactive walkthroughs
aren't possible that way either. Confirmed with the user (2026-07-27) after a large iOS+Android
port ran ~700K tokens partly for this reason: **going forward, the user runs final builds, test
suites, and any simulator/emulator visual/interactive verification themselves and reports back
results**, rather than Claude running the full toolchain end-to-end. Claude should still do
lightweight, targeted compiles while actively iterating on a specific file's changes (fast
feedback on syntax/type errors is still worth it in the moment) — the hand-off point is *final*
verification, not every compile.

Commands to hand off (or run once for a quick incremental check):
- iOS build: `xcodebuild -project AnyTorah.xcodeproj -scheme AnyTorah -sdk iphonesimulator build`
- iOS tests: `xcodebuild test -project AnyTorah.xcodeproj -scheme AnyTorah -destination 'platform=iOS Simulator,name=<device>'` (add `-only-testing:AnyTorahTests/<ClassName>` to scope it)
- Android build: `./gradlew assembleDebug` from `AnyTorahAndroid/`
- Android tests: `./gradlew testDebugUnitTest` from `AnyTorahAndroid/`

Known local gotchas if Claude does run these directly: Android's `gradlew` wrapper jar has been
missing from the repo before — fall back to the cached distribution directly (e.g.
`~/.gradle/wrapper/dists/gradle-8.9-bin/*/gradle-8.9/bin/gradle`) with `JAVA_HOME` pointed at
Android Studio's bundled JRE (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`).
Android local unit tests (`testDebugUnitTest`) run against the Android SDK's `org.json` *stub*
jar, which throws "not mocked" for every real method — add `testImplementation("org.json:json:...")`
to pull in the real implementation for any test that parses JSON.

**The cached-gradle-distribution fallback above runs but produces unreliable results — confirmed
2026-08-28, don't trust it even when it "works".** Invoking `:app:compileDebugKotlin` directly via
the cached `gradle-8.9-bin` distribution + Android Studio's JRE (as described above) completes
without a build-system error, but silently fails to resolve any type declared in
`TextModels.kt` from *other* files (`Unresolved reference 'TeshuvotWork'`, etc.) while reporting
*zero* diagnostics against `TextModels.kt` itself — reproduced identically even against the
untouched git-HEAD version of that file (i.e. it's not a regression from any particular edit),
even after deleting both `AnyTorahAndroid/app/build` and `AnyTorahAndroid/.gradle` and running
`--no-daemon`. Root cause not identified (plausibly a version mismatch between this ad hoc
Gradle 8.9 invocation and what the project's own wrapper/AGP actually expect, given the real
wrapper jar is the thing documented as missing above) — but the practical upshot is that a
"clean" result from this fallback path is not evidence the Kotlin actually compiles. Treat
Android changes as hand-review-only in this environment, per the verification-workflow section
above, rather than trusting this fallback as a substitute for the user's real Android Studio
build.

---

## Architecture

```
ContentView  (owns all top-level @State)
  ├── SplashView          (2.5s intro, fades out)
  ├── HomeCombinedView    (home screen — category buttons ONLY; tapping one restores
  │                        that category's last-used selection and jumps straight to
  │                        TextReaderView, skipping any book/chapter picker screen)
  └── TextReaderView      (main reading + commentary + audio)
        ├── TextContentView       (scrollable VStack of segments)
        ├── CommentaryPanelView   (bottom slide-up panel)
        ├── TextSelectorView      (sheet — full wheel-picker selector + Yomi buttons,
        │                          opened via the header's list.bullet icon)
        ├── BookmarkListView      (sheet — searchable list)
        └── BookmarkEditSheet     (sheet — add/edit one bookmark)
```

Book/chapter/daf navigation always happens from pickers in `TextReaderView`'s own header
(tap the book/chapter nav pills, or the list.bullet icon for the full selector) — never from
the home screen. `CategoryMenuView.swift` is old, unreferenced dead code predating
`HomeCombinedView`; nothing instantiates it.

### Home screen — ten flat categories, gradient tiles (2026-08-24)

The home screen shows **ten** independent category buttons, not the five/seven raw
`TextCategory` cases: Tanakh, Mishnah, Tosefta, Talmud Bavli, Talmud Yerushalmi, Rambam, Tur,
Shulkhan Arukh, Midrash Halakha, Midrash Aggada. Mishnah/Tosefta, Talmud Bavli/Yerushalmi, and
Midrash Halakha/Aggada were previously exposed as a segmented **subcategory toggle** shown
*after* picking the parent category, in the old bottom-of-home-screen selector — per explicit
product direction, these are conceptually **flat, independent categories**, not sub-choices of
a shared one; the toggle only ever existed because of that old UI shape, not because the
underlying content is nested.

**Implementation — deliberately not a data-model change.** `TextCategory` still has only its
original 7 cases (`tanakh, mishnah, talmud, rambam, tur, shulchanArukh, midrash`), and
`mishnahSubcategory`/`talmudSubcategory`/`midrashSubcategory` still exist on
`TextReaderViewModel` — that's genuinely how the Sefaria data and navigation wheels are
organized (Bavli and Yerushalmi have entirely different wheel layouts and navigation state,
e.g.). Each home-screen button sets `category` + forces the one subcategory it represents, via
`vm.restoreState(for:)` (restores that category's last-used state generally) followed by a
direct subcategory assignment (`HomeCategoryEntry.applySelection` on iOS, same pattern on
Android) — safe because neither `talmudSubcategory` nor `mishnahSubcategory` has any
didSet/cascade side effect on either platform. `midrashSubcategory` **does** cascade
(iOS: a `didSet` on the property itself; Android: no cascade on the property, so
`HomeCategoryEntry`/`HomeScreen.kt`'s `applyMidrashSubcategory` replicates it by hand) —
resetting `midrashWork`/`midrashBookIndex`/`midrashChapter`/`midrashVerse` to the first work of
the new subcategory, intentionally mirroring what the old in-selector toggle already did.

**What actually changed to make this feel flat, not just relabeled buttons:**
- The old in-selector `SubcategoryToggle` (segmented Mishnah/Tosefta, Bavli/Yerushalmi,
  Halakha/Aggada control shown inside `TextSelectorView`/`TextSelectorScreen` after picking a
  category) is **removed entirely** on both platforms — switching between siblings now means
  going back to Home, exactly like switching between any two unrelated categories.
- `TextReaderViewModel.categoryDisplayName`/`categoryHebrewDisplayName` (iOS) and the Kotlin
  equivalents replace every place that used to show the bare `category.displayName` (the
  selector sheet's header, `Bookmark`'s subtitle, `BookmarkEditSheet`'s "Category" field) — so
  a bookmark or the in-reader selector header reads "Talmud Yerushalmi"/"Tosefta"/"Midrash
  Aggada", never the generic parent name.
- `TextReaderViewModel.isTalmudBavli` (`category == .talmud && talmudSubcategory == .bavli`)
  gates every Bavli-only reader feature that used to check `category == .talmud` alone: the
  amud A/B pill, the Text/Daf image toggle + daf-image content (iOS only — Android has no
  daf-image mode), and the shiur audio row + its availability check. **This was a real,
  pre-existing gap**, not something newly introduced — Yerushalmi was already reachable via
  the old toggle, it was just rarely tapped; promoting it to an equally-prominent home button
  made it likely enough to hit that this needed fixing alongside the buttons themselves.
  `vm.currentTalmudTractate`/`vm.talmudDaf` are Bavli-only state (Yerushalmi has its own
  separate `yerushalmiSederIndex`/`yerushalmiTractateIndexInSeder`/`yerushalmiChapter`/
  `yerushalmiHalakha`), so without this gate those Bavli-only UI elements would silently show
  stale/unrelated Bavli content while the user was actually reading Yerushalmi text.
- **Android fix found in the process, unrelated to the flat-categories work itself:** the
  reader's "selector" list icon called `onNavigateToSelector()` (navigating back to the "home"
  route, which used to embed the wheel picker) instead of setting
  `activeSheet = ActiveSheet.SELECTOR`. Once the picker was removed from Home, that route had
  nothing to show. Fixed to set `activeSheet = ActiveSheet.SELECTOR`, which now presents
  `TextSelectorScreen` inline as a bottom sheet — matching how iOS already presented
  `TextSelectorView` as a sheet directly from the reader. `onNavigateToSelector` was removed
  from `TextReaderScreen`'s parameters and `MainActivity`'s call site.

**Bookmark subcategory/Midrash gap — fixed 2026-08-24.** Neither platform's `Bookmark` model
used to persist `mishnahSubcategory`/`talmudSubcategory`; iOS's `Bookmark.swift` had no Midrash
fields at all. Fixed on both platforms:
- iOS: `MishnahSubcategory`/`TalmudSubcategory`/`MidrashSubcategory`/`MidrashWork` all gained
  `Codable` conformance; `Bookmark` gained `mishnahSubcategory`/`talmudSubcategory` (default
  `.mishnah`/`.bavli`) and the full Midrash quintet
  (`midrashSubcategory`/`midrashWork`/`midrashBookIndex`/`midrashChapter`/`midrashVerse`,
  defaulted to Midrash's own pre-existing fallbacks) — "by verse" navigation only, matching
  what Android already supported (Midrash's separate "Native" mode chapter/section indices
  aren't captured either, on either platform). The custom `init(from:)` decodes all of these
  with `decodeIfPresent(...) ?? default` so bookmarks saved before this fix still load. Found
  and fixed a second bug in the same file while here: `BookmarkEditSheet.swift`'s "new
  bookmark" path reconstructed a `Bookmark` by manually forwarding fields one at a time,
  silently dropping every field it forgot to list — already true for `turSection`/`turSiman`
  before this fix, now would have also been true for every new field. Fixed by mutating the
  `Bookmark.from(vm:)` result's `name`/`notes` directly (the only two `var` fields) instead of
  reconstructing, which eliminates the whole "forgot to forward field X" class of bug.
- Android: `Bookmark.kt` gained `mishnahSubcategoryId`/`talmudSubcategoryId` (Midrash was
  already complete). Found and fixed a **more severe pre-existing bug** while wiring this up:
  `BookmarkManager.kt`'s Gson `BookmarkDto` never included `turSection`/`turSiman` or any
  `midrash*` field at all — meaning every Tur or Midrash bookmark silently lost its location on
  app restart (correct for the rest of that session, since the in-memory list is untouched by
  the DTO round-trip; reset to Tur OC §1 / Midrash Halakha's first work on reload) regardless of
  what was actually bookmarked. Fixed by adding all the missing fields to `BookmarkDto`,
  declared **nullable** with an explicit `?:` fallback in `toBookmark()` rather than relying on
  `Bookmark`'s own non-null Kotlin defaults — plain Gson (no kotlin-reflect adapter registered
  here) allocates data class instances via unsafe allocation for missing JSON keys, which does
  *not* run the constructor and so does *not* apply Kotlin default parameter values; a
  non-nullable `Int` field would silently come back `0` instead of its declared default instead.
  Nullable fields don't have this trap — a missing JSON key reliably decodes to `null`.

**Midrash Halakha is always "Native" navigation, never "By Verse" — fixed 2026-08-25.**
`midrashNavigationMode` (`MidrashNavigationMode.byVerse`/`.native` on iOS,
`MidrashNavigationMode.BY_VERSE`/`.NATIVE` on Android) is a single property shared by both
Midrash subcategories, defaulting to by-verse — appropriate for Midrash Aggada (Midrash
Rabbah etc., genuinely organized around a Tanakh verse), wrong for Midrash Halakha (Mekhilta/
Sifra/Sifrei), which per explicit user direction should always use its native chapter/
halakha (or perek/pasuk) structure, never the verse association. Since there's only one
shared property, forcing it correctly required three coordinated changes, on both platforms,
so a leftover value from visiting the sibling subcategory can never leak through:
1. **Selection time** — iOS's `midrashSubcategory` `didSet` (already existed, to reset
   `midrashWork`) now also sets `midrashNavigationMode = midrashSubcategory == .halakha ?
   .native : .byVerse`. Android has no such cascade (see above), so
   `HomeScreen.kt`'s `applyMidrashSubcategory` sets it explicitly the same way.
2. **Restore time** — `TextReaderViewModel.restoreState(for:)` (iOS) /
   `restoreState(cat:)` (Android) both restore `midrashNavigationMode` from a single
   UserDefaults/SharedPreferences key not itself scoped by subcategory; both now force it back
   to native immediately afterward whenever the restored subcategory is Halakha, as a
   belt-and-suspenders against a value persisted from an earlier Aggada session.
3. **Selector UI** — `TextSelectorView.swift`'s `MidrashWheels` / `TextSelectorScreen.kt`'s
   `MidrashWheels` hide the "By Verse"/"Native" segmented toggle entirely when
   `midrashSubcategory == .halakha` (there's nothing to choose), and the wheel-picker branch
   that used to key only on `midrashNavigationMode == .native` now also treats
   `midrashSubcategory == .halakha` as native regardless of the stored mode value, so a stray
   `.byVerse` can't surface mismatched wheels even transiently. Midrash Aggada is unaffected —
   still shows the toggle, still defaults to by-verse.

### Home screen visual style — AnyYCTorah-style gradient tiles (2026-08-24, revised 2026-08-25 twice)

Borrowed directly from AnyYCTorah's `HomeView.swift`/`BrandGradients.swift`: two columns of
tiles (icon + label, `HStack`/`Row`, ~64pt min height, 16pt corner radius), each filled with a
three-stop diagonal gradient (bright tint → brand-anchor hue → deep shade of the same hue —
never a flat color or a cross-hue blend) instead of the previous flat `appFg`-tinted card.
Left column = purple family (Tanakh, Midrash Aggada, Midrash Halakha, Mishnah, Tosefta); right
column = blue family (Talmud Bavli, Talmud Yerushalmi, Tur, Shulkhan Arukh, Rambam) — same
left/purple, right/blue split AnyYCTorah uses. Column gap is 24pt/dp, tile-to-tile gap within a
column is 18pt/dp (both widened from an initial 12pt/dp — the first pass read as cramped).

`Views/BrandGradients.swift` (iOS) / `ui/theme/BrandGradients.kt` (Android) define
`BrandColorFamily`, now a **6**-case enum (3 purple, 3 blue — down from the original 10, see
below) each with a 3-color `stops` list and a `gradient`/`brush` property. `purple`, `violet`,
`blue`, `royalBlue`, and `skyBlue` reuse AnyYCTorah's exact confirmed-brand hex values. `plum`
is a new same-style extension — not claimed as a confirmed YCT brand hex, matching how
AnyYCTorah documents its own non-brand extensions (green/gold/lavender/blossom). AnyYCTorah is
iOS-only; the Android version is a fresh Compose translation of the same aesthetic
(`Brush.linearGradient`), not a port of existing Kotlin.

**Tile text is always white (2026-08-25).** The initial pass used `prefersDarkForeground` to
switch to dark text on the two palest stops (`lavender`, `blossom`) for contrast — per explicit
user direction this was dropped in favor of white everywhere, and the `prefersDarkForeground`
flag/property was deleted from `BrandColorFamily` on both platforms as dead code rather than
left unused.

**Color assignments — two rounds of changes on 2026-08-25, all per explicit user direction.**
Round 1 (swap + shift, one color per category, 10 cases):
- Midrash Halakha and Tosefta swapped colors: Midrash Halakha → `plum` (was `lavender`),
  Tosefta → `lavender` (was `plum`). Tanakh/Midrash Aggada/Mishnah unchanged
  (`purple`/`violet`/`blossom`).
- Talmud Yerushalmi took on Talmud Bavli's `blue` instead of its own shade, freeing the color
  it used to have (`royalBlue`).
- The freed blue shifted down the column: Tur → the freed `royalBlue`, Shulkhan Arukh → Tur's
  old `skyBlue`, Rambam → Shulkhan Arukh's old `teal`. Rambam's own old color (`navy`) had
  nothing left to shift onto and was deleted.

Round 2 (siblings now **share** one color instead of each having its own, 10 cases → 6):
- Midrash Aggada and Midrash Halakha both take Midrash Aggada's round-1 color, `violet`
  (Halakha drops `plum`).
- Mishnah and Tosefta both take Midrash Halakha's round-1 color, `plum` (Mishnah drops
  `blossom`, Tosefta drops `lavender`).
- Tur and Shulkhan Arukh both take Tur's round-1 color, `royalBlue` (Shulkhan Arukh drops
  `skyBlue`).
- Rambam takes Shulkhan Arukh's round-1 color, `skyBlue` (drops `teal`).
- Talmud Bavli/Yerushalmi were already sharing `blue` from round 1 — untouched.
- `lavender`, `blossom`, and `teal` all became unused by this pairing and were deleted from
  `BrandColorFamily` on both platforms (checked for other references first — none), leaving
  just `purple`/`violet`/`plum` (left column) and `blue`/`royalBlue`/`skyBlue` (right column).

**The four retired hexes (`lavender`, `blossom`, `teal`, `navy`) are gone from the enum, not
just unused — restore them from git history (`git log -- AnyTorah/Views/BrandGradients.swift`
around 2026-08-25, same commit touches the Android file) if a future category addition (the
user mentioned Responsa as a plausible example) needs its own distinct color again rather than
pairing with an existing sibling.**

**iOS project-file gotcha:** `AnyTorah.xcodeproj/project.pbxproj` uses explicit
`PBXFileReference`/`PBXBuildFile` entries (not Xcode 16's folder-synchronized groups), so a new
`Views/*.swift` file is invisible to the build until it's registered in **four** places in
`project.pbxproj`: the `PBXBuildFile` section, the `PBXFileReference` section, the `Views`
group's `children` list, and the app target's `PBXSourcesBuildPhase` `files` list. `xcodegen`
(the tool `project.yml` is written for) isn't available in every environment that edits this
repo — when it isn't, add all four entries by hand, using another `Views/*.swift` file's
existing four entries as the exact formatting template (tab-indented, 24-hex-char uppercase
UUIDs). Android has no equivalent step — Gradle discovers new `.kt` files under `src/main`
automatically by package directory.

**Settings gear moved to the top-right on iOS home screen** (was top-left) to match the
platform convention Android's `HomeScreen.kt` already followed. **Extended 2026-08-25 to the
reader screen's header too** (`TextReaderView.swift`'s `readerHeader`, `TextReaderScreen.kt`'s
Row 1) — the gear swapped places with the bookmark/bookmarks/selector icon cluster, so gear is
now top-right and that cluster is top-left on both screens, both platforms. Also added more
breathing room between the "AnyTorah" title and the tile grid on the home screen (iOS: outer
`VStack` spacing 20→32; Android: header `Box`'s `bottom` padding 12dp→24dp).

### Tanakh selector — Torah/Nevi'im/Ketuvim as a segmented row (2026-08-25)

`TanakhWheels` (iOS `TextSelectorView.swift`, Android `TextSelectorScreen.kt`) already divided
Tanakh into its three sections via `TextCatalog.tanakhSections`, but as a third scrollable
wheel column alongside Book/Chapter — easy to miss, and inconsistent with how `SAWheels`
divides Shulkhan Arukh into OH/YD/EH/CM (a segmented row of tap targets at the top, wheels for
the finer-grained picks below). Per explicit user direction, `TanakhWheels` now uses that same
pattern: a segmented row (iOS: `Picker(...).pickerStyle(.segmented)`; Android: a `Row` of
`TextButton`s in a `cardBackground`-filled rounded rect, selected one bold + full-opacity,
others dimmed — copied near-verbatim from `SAWheels`' book row) for Torah/Nevi'im/Ketuvim,
with only Book + Chapter as wheel columns underneath. Selecting a section jumps straight to its
first book (`section.books.first`), same behavior the old wheel's `onChange` already had.
Hebrew-mode ordering (reversed indices, section on the visually-right side) mirrors `SAWheels`
exactly.

### Teshuvot — new TextCategory, Rishonim (2026-08-24) + Acharonim (2026-08-28), Sefaria ref data verified

**A new top-level content type, not a subcategory of anything existing.** Unlike the Talmud/
Mishnah/Midrash home-screen splits (which reuse one `TextCategory` + a subcategory enum),
Teshuvot genuinely doesn't fit any of the other 7 categories, so this added
`TextCategory.teshuvot` itself — the more invasive path the flat-home-screen work deliberately
avoided for existing categories (see "Home screen — ten flat categories" above), unavoidable
here since there was no existing category to lean on. Touches ~15 exhaustive `switch`/`when`
sites per platform — every one of `TextCategory`'s existing `.midrash` handlers got a `.teshuvot`
sibling; grep `case \.midrash` (iOS) / `TextCategory\.MIDRASH` (Android) to re-locate all of them
if extending further.

**Data model** (`TextModels.swift` / `TextModels.kt`), mirrors `MidrashWork`'s shape:
- `TeshuvotSubcategory` — `.rishonim`/`RISHONIM` (13 works) and `.acharonim`/`ACHARONIM` (31
  works, added 2026-08-28 — see its own subsection below).
- `TeshuvotEdah` — `.ashkenaz`/`.sefarad`, informational only (shown as an "(A)"/"(S)" badge
  in the work picker), not used in any fetch/navigation logic.
- `TeshuvotVolume` (Swift `struct` / Kotlin `data class`, added 2026-08-28) — one entry in a
  work's second-level ("volume") picker: `label`/`hebrewLabel` (display), `refTemplate` (a
  Sefaria ref with a literal `{siman}` placeholder), `maxSiman`. **Every `TeshuvotWork` has a
  non-empty `volumes` list — even a flat work is one dummy entry** — so `maxSiman(forVolume:)`/
  `sefariaRef(volume:siman:)`/`volumeDisplayLabel(_:)`/`volumeDisplayLabelHebrew(_:)` all index
  into it unconditionally, with no separate flat-vs-multi-volume branch anywhere. `volumeLabel`/
  `volumeLabelHebrew` (nil for flat works) is what actually hides the volume pill/sheet in the
  UI — not `volumes.count`. This replaced an earlier numeral-only scheme (`volumeCount` +
  `volumeDisplayLabel(_:)` switching on roman numerals) that could only express sequential
  numbered volumes — insufficient once Acharonim works arrived with named Tur-order sections
  and, in a few cases, structures three levels deep on Sefaria flattened into one combined-label
  "volume" list (e.g. Rav Pealim's "I, Orach Chayim", Shoel uMeshiv's "II.3") — see the Acharonim
  subsection below for why. `sefariaRef(volume:siman:)`/`maxSiman(forVolume:)`/
  `volumeDisplayLabel(_:)`/`volumeDisplayLabelHebrew(_:)` are still the call sites everything
  else uses; only their internals changed.
- `TeshuvotWork` — 44 cases total (13 Rishonim + 31 Acharonim), in the **corrected chronological
  order** (see below — Rishonim's order was independently re-verified against birth years;
  Acharonim's preserves the order/century placement the user supplied, not independently
  re-verified), each carrying `displayName`/`hebrewName`/`edah`/`century`/`volumeLabel`/
  `volumeLabelHebrew`/`volumes`/`volumeCount`.

**Picker**: Work → Volume (shown only when `volumeLabel != nil`, labeled per-work — "Part"
for Rashba and Terumat HaDeshen, "Klal" for Rosh, "Chelek" for Sefer HaTashbetz; Maharik has
no volume level at all, see below) → Siman. `TeshuvotWheels` (iOS `TextSelectorView.swift`,
Android `TextSelectorScreen.kt`) — new struct/composable, not a variant of `MidrashWheels`,
since the work list doesn't need the Halakha/Aggada-style nav-mode toggle. `load()`'s
`.teshuvot` branch calls `SefariaTextClient.shared.fetchBoth(ref:)` directly (bypassing the
`ref(category:...)` helper entirely, which has a `.teshuvot -> ""` "shouldn't be called" stub)
— exactly the pattern Midrash's native-mode branch already uses.

**Century dividers in the Work wheel, and the "Alphabetical Order" setting (2026-08-28).** Per
explicit user request, the Work wheel (both platforms) groups its rows visually by century by
default. A native wheel picker (`UIPickerView` on iOS, the app's own `WheelPicker` on Android)
has no non-selectable section-header concept — every row must be a real, selectable item — so
each century boundary gets an inert divider row ("— 13th Century —") inserted into the flat
item list; picking one snaps forward to the next real work rather than selecting nothing. The
book-picker *sheet* reachable from the header pill (a `List`/`LazyColumn`, not a wheel) uses
real `Section`/`BookPickerSectionHeader` grouping instead, since that surface natively supports
it — same pattern already used there for Rambam's sefer grouping.

A Settings toggle, "Teshuvot Alphabetical Order" (`@AppStorage("teshuvotAlphabeticalOrder")` /
`SharedPreferences` key of the same name, default off), switches **both** the Rishonim and
Acharonim pickers — on both surfaces, both platforms — from century-grouped/chronological to a
flat alphabetical list (by `displayName`, or `hebrewName` in Hebrew mode) with no century
dividers at all. `TextReaderView.swift`'s `teshuvotAlphabeticalIndices(_:)` / Android's inline
`sortedBy` in `TextReaderScreen.kt`'s book-picker branch and `TextSelectorScreen.kt`'s
`TeshuvotWheels` all read this same flag independently — there's no shared "ordered works" helper
across the three call sites (book-picker sheet, work wheel) per platform, just the same branching
pattern repeated, mirroring how century-grouping itself was already duplicated across those same
call sites before this setting existed.

**Ref data verified against live Sefaria content (2026-08-24).** An earlier session built this
category with no network egress to `sefaria.org` and shipped best-effort bibliographic guesses
for every title/volume/count, flagged DRAFT with an explicit action item to verify on-device.
That verification happened directly against the Sefaria API (`/api/name/...`, `/api/v2/index/
...`) instead, and turned up several guesses that were wrong or structured very differently
than assumed:
- **Rashba is not one title with a numeric volume.** Sefaria carries it as five *separately
  titled* top-level indices — "Teshuvot haRashba part I/IV/V/VI/VII" — parts II and III were
  never digitized. Part I was later dropped from the app entirely (see the removed-content note
  below); `volumeCount` covers IV–VII (4 volumes), and the volume-wheel position doesn't equal
  the roman numeral (position 1 is part IV) — `volumeDisplayLabel(_:)` handles the mapping, and
  `sefariaRef` builds the whole part title rather than appending `:volume`.
- **Sefer HaTashbetz** (Rashbatz's responsa) is titled "Sefer HaTashbetz", not "Teshuvot
  HaTashbetz". It has 4 parts as guessed, but Part IV alone carries one extra depth level
  (Section → Teshuva → Paragraph, vs. the other parts' Teshuva → Paragraph) that this picker's
  two-level Work→Volume→Siman shape can't address — a known gap; Part IV's siman wheel will
  overshoot into the wrong content for some numbers, surfacing via the existing error/Retry UI.
- **Maharach Or Zarua's** responsa are titled "Maharach Or Zarua Responsa" — the original guess
  ("Teshuvot Chaim Or Zarua") collided with his father Yitzchak's unrelated `Or Zarua`, which is
  why the earlier name-search-based check missed it.
- **Maharam MiRotenburg is not a single Sefaria title.** Sefaria carries four separately-
  paginated printed editions (Cremona 1558, Prague 1608, Lemberg 1860, Berlin 1891) as sibling
  nodes under "Teshuvot Maharam", with no shared siman numbering across them and no single
  canonical one. This app defaults to Cremona (earliest, and a simple flat siman list — unlike
  Berlin, which has its own internal Part I/II/III split). Exposing edition choice as its own
  picker level is a reasonable future enhancement, not done here.
- **Maharik has no separate "Shoresh" volume level on Sefaria** — it's one flat list of 197
  simanim; the traditional "Shoresh" numbering *is* Sefaria's Siman numbering here. The
  originally-guessed `volumeLabel`/`volumeCount` (193) were removed entirely.
- Rosh's Klal/Siman two-level structure and Terumat HaDeshen's two-part split were both
  correctly guessed in the original draft; only exact siman/klal counts were refined.

`maxSiman(forVolume:)` (iOS) / `maxSiman(volume:)` (Android) returns the Sefaria-confirmed
ceiling where the index reports an exact count, and falls back to a generous placeholder (400)
elsewhere — same "generous range + graceful failure on overshoot" pattern as Midrash's native
section wheel. Per-klal siman counts for Rosh and per-part counts for Sefer HaTashbetz and
Maharam weren't individually verified (only the klal/part *counts* themselves were); those still
use the placeholder. **A wrong ref surfaces through the reader's existing error/Retry UI, not a
crash** — same deliberate tradeoff as before (see "How Sefaria ref accuracy was handled" below),
now covering only the handful of genuinely-unverified per-volume counts rather than all 17 works.

**Five works/volumes were sparsely digitized, not just individually unverified — found
2026-08-25, fixed by removal same day.** After the ref-accuracy pass above shipped, live testing
reported "No text found" for Rashba vol. 1, Ritva, Mahari Weil, Mahari Bruna, and HaRashbash
specifically. Checked against Sefaria's `/api/shape/{title}` endpoint, which reports actual
per-siman content length (unlike the index endpoint's schema, which only reports the nominal
siman *count*): these five have real digitized text at only a tiny fraction of their nominal
range — Rashba part I claims 413 simanim but only 5 have any content (98, 150, 253, 395, 413);
Ritva has exactly 1 (of 122); Mahari Weil 2 (of 151); Mahari Bruna 1 (of 111); Rashbash 2 (of
1008). Every other work in the picker — including Rashba parts IV–VII — was confirmed via the
same endpoint to be fully or near-fully digitized, so this isn't a systemic issue, just these
five specific titles/volumes on Sefaria's side.

The first fix attempt kept all 17 works and added `TeshuvotWork.availableSimanim(forVolume:)`
to constrain the siman wheel to only the handful of real simanim per sparse work. **Superseded
same day per explicit user decision**: a work (or volume) with only 1–2 real simanim out of
hundreds isn't worth surfacing at all, so `availableSimanim` and every call site that consulted
it were removed again, and instead Ritva, Mahari Weil, Mahari Bruna, and HaRashbash were deleted
from the `TeshuvotWork` enum outright (13 works remain), with Rashba's `volumeCount` dropped
from 5 to 4 (parts IV–VII only, Part I gone). If Sefaria digitizes more of these later, re-run
the same `/api/shape` check before reintroducing them — nothing suggests today's coverage is
permanent, just that it was the state as of 2026-08-25.

**Chronological ordering — corrected from the user's original list, per their own request to
verify it.** Century groupings are internally sub-grouped by edah (Sefarad-then-Ashkenaz in the
13th century, Ashkenaz-then-Sefarad in the 15th) — verify chronology *within* each edah
sub-group, not across the whole century flatly, or you'll flag false positives (an early
Ashkenazi figure can legitimately sit after a later Sefaradi one in reading order). Two real
fixes made:
- **14th century**: Ran (b. ~1320) predates Rivash (b. 1326) — reordered from Rosh→Rivash→Ran
  to **Rosh→Ran→Rivash**.
- **15th century, Ashkenaz sub-group**: Maharil (b. ~1365) is the earliest of the five, but was
  listed last — reordered from Terumat HaDeshen→Mahari Weil→Mahari Bruna→Maharik→Maharil to
  **Maharil→Terumat HaDeshen→Mahari Weil→Mahari Bruna→Maharik**.
- 11th–12th century and the rest of the 13th/15th groupings were already correct.

**Home screen — its own row below the two-column grid, not a slot inside it (2026-08-28,
same-day revision).** Briefly shipped as two tiles inside the ordinary two-column grid
(Rishonim in the blue column, Acharonim in the purple column, just to keep both columns at six
tiles each) — the user asked for this changed within the same session: Teshuvot isn't just
another sibling pair like Mishnah/Tosefta, it's conceptually a third tier below the grid
entirely. Current shape, both platforms: the two-column grid returns to its original 5/5 split
(no Teshuvot tiles in either column), followed by a `Divider`/`HorizontalDivider`, a "Teshuvot"
section label, and one row of three equal tiles — Rishonim (`.navy`/`NAVY`), Acharonim
(`.lavender`/`LAVENDER`, restored 2026-08-25 for this feature — see `BrandGradients.swift`/
`.kt`'s own doc comment), and a disabled "Contemporary" placeholder (40% opacity, non-clickable,
`isEnabled: Bool`/`Boolean` on `HomeCategoryEntry`) for a future era this app doesn't cover yet.
Both home screens are now scrollable (`ScrollView` / a `verticalScroll` `Box`) — they weren't
before, since the grid alone always fit on screen, but the added row can push total content
height past some devices' viewport.

**Kotlin gotcha hit while adding `isEnabled`**: `HomeCategoryEntry`'s Kotlin `data class` must
keep `applySelection: (TextReaderViewModel) -> Unit` as its literal LAST constructor parameter
for the existing trailing-lambda call sites (`HomeCategoryEntry(...) { vm -> ... }`) to keep
compiling — Kotlin's trailing lambda syntax binds strictly to the last declared parameter (unlike
Swift's trailing-closure resolution, which tolerates trailing defaulted non-closure parameters
after the closure one — confirmed by iOS building successfully with `isEnabled` declared *after*
`applySelection` in the equivalent Swift struct). `isEnabled: Boolean = true` was placed *before*
`applySelection` instead; the one call site needing `isEnabled = false` (Contemporary) passes it
as a named argument ahead of its own trailing lambda.

**Subcategory/work desync bug, fixed same day.** Switching between "Rishonim" and "Acharonim"
(or any future third Teshuvot tier) via these Home buttons left `teshuvotWork` pointing at
whatever work was last used under the *other* subcategory — the book-picker sheet and volume/
siman wheels correctly filtered to the new subcategory's works (since they call
`TeshuvotWork.works(for:)`/`worksFor()` fresh every render), but the reader itself kept
displaying the stale work's actual content, because nothing re-validated `teshuvotWork` against
the newly-forced `teshuvotSubcategory`. Root cause: `restoreState(for: .teshuvot)` restores
`teshuvotSubcategory` and `teshuvotWork` independently from two separately-persisted keys that
are normally kept in sync by ordinary use, but the Home button's `applySelection` closure then
overwrites *only* `teshuvotSubcategory` afterward, with nothing forcing `teshuvotWork` back into
agreement.
- iOS: `teshuvotSubcategory` gained a `didSet` (guarded by the existing `isRestoring` flag, same
  pattern as `midrashSubcategory`'s own cascade) that resets `teshuvotWork` to
  `TeshuvotWork.works(for:).first`, which in turn cascades through `teshuvotWork`'s own existing
  `didSet` to reset volume/siman to 1.
- Android: Kotlin's plain `mutableStateOf` properties have no `didSet`-equivalent cascade (same
  reason `applyMidrashSubcategory` exists as a manual helper), so a new
  `TextReaderViewModel.setTeshuvotSubcategory(sub)` method sets the subcategory and explicitly
  resets `teshuvotWork`/`teshuvotVolume`/`teshuvotSiman` together. **Always call this instead of
  assigning `teshuvotSubcategory` directly** — `HomeScreen.kt`'s `teshuvotRow` entries do.

**Teshuvot row tiles — `compact` styling + unified navy family (2026-08-28, same-day
follow-up).** Per explicit request: the three Teshuvot tiles now drop their icon entirely and
use a smaller label font (`CategoryTile`'s new `entry.compact` flag — `HomeCategoryEntry.compact`
on both platforms, defaults `false`, `true` only for `teshuvotRow`) — three tiles split one row's
width there, unlike the two-column grid above where each tile gets a full-width row, so the icon
and larger font were the first things worth giving up to fit "Contemporary" without wrapping.
Also, all three tiles moved onto the navy family (previously Acharonim was `.lavender`/
`LAVENDER`, reused from the two-column-grid era when the row still needed to visually pair with
that grid's purple/blue split — a rationale that stopped applying once Teshuvot became its own
row): `.navy`/`NAVY` (Rishonim, unchanged), `.navySteel`/`NAVY_STEEL` (Acharonim), `.navyDeep`/
`NAVY_DEEP` (Contemporary) — three shades of one hue (see `BrandGradients.swift`/`.kt`) so the
row reads as one coherent group with just enough contrast to tell the tiles apart. `LAVENDER`
itself is left defined but unused, per the file's own established retire-in-place convention
(same as `NAVY` during its own earlier retirement). The "Teshuvot" section label also went from
70%-opacity `appFg` to full-opacity, per request to make it "more white."

- Kotlin gotcha, same shape as `isEnabled`'s: `compact: Boolean = false` had to go *before*
  `applySelection` in `HomeCategoryEntry`'s constructor (not after), for the same reason —
  trailing-lambda call sites need `applySelection` to stay the literal last parameter. iOS hit an
  actual compile error here first (not just a style choice): placing `compact` *after*
  `applySelection` broke the `teshuvotRow` call sites that pass `compact: true` by name ahead of
  a trailing closure, because mixing an explicit named argument with a trailing closure defeats
  Swift's usual tolerance for defaulted params after the closure one. Moving `applySelection`
  back to the literal last position (matching Kotlin's rule) fixed it — see the struct's own
  comment.

### Reader header Row 1 — flat row instead of ZStack/Box overlay, full-width pills (2026-08-28)

The nav-pills cluster (book/volume/chapter pills) previously sat inside a `ZStack`/`Box`
overlaid with a separately-aligned left icon cluster (bookmark/bookmarks/selector) and right
gear button, centered via a **guessed fixed inset** (`.padding(.horizontal, 88)` / `.padding
(horizontal = 88.dp)`) meant to roughly clear both edge clusters. That guess didn't track the
edge clusters' real width, wasting space a long title (e.g. "Teshuvot Rabbi Akiva Eiger") could
have used. Per explicit request, Row 1 (`TextReaderView.swift`'s `readerHeader`,
`TextReaderScreen.kt`'s Row 1) is now a single flat `HStack`/`Row`: left icon cluster (fixed
width) → pills cluster → gear (fixed width, pushed to the trailing edge).

- **iOS**: the pills `HStack` originally sat at its natural (unweighted) size next to a
  `Spacer(minLength: 8)` before the gear — but `Spacer` is the *most* flexible sibling in
  SwiftUI's layout algorithm (unbounded range vs. the pills' bounded one), so it greedily
  absorbed any true leftover width itself, leaving the pills cluster stuck at a compressed size
  with a visible gap before the gear even while its own text was truncating. Fixed (2026-08-28,
  same-day follow-up) by deleting the `Spacer` and giving the pills `HStack` itself
  `.frame(maxWidth: .infinity, alignment: saHebrewMode ? .trailing : .leading)` — now *it's* the
  flexible sibling, so it receives the actual leftover width, and its children lay out (and
  truncate, via `.layoutPriority(1)` on the book pill) against that full frame. The `alignment`
  choice matters for Hebrew: the pills `HStack`'s own `layoutDirection` is already flipped RTL,
  so the book pill is its rightmost child in that flip — trailing-aligning the frame docks it
  immediately next to the gear, which is what "right-aligned, close to the gear" meant. The left
  icon cluster's internal spacing was tightened in two passes the same day: first 14pt → 10pt
  uniformly, then (once the user reported it still wasn't tight enough) split into a 4pt
  sub-`HStack` for just the bookmark-edit/bookmarks-list pair, with 10pt kept between that pair
  and the selector icon — see "Bookmark-list icon swap" under Bookmarks for why the selector
  stayed a bit further away (it's functionally unrelated, and its icon glyph changed the same
  day too).
- **Android**: `Modifier.weight(1f)` on the pills `Row` already claims all leftover width at the
  outer-Row level (no `Spacer` sibling was ever stealing it), and `Arrangement.spacedBy`'s
  default Start-packing already docks the RTL-flipped book pill next to the gear in Hebrew mode
  — so neither of those needed a change. What *was* backwards: `Modifier.weight(1f, fill=false)`
  was on the **book** pill, but Compose's `Row` measures non-weighted children *first* at their
  full natural size and only gives weighted children whatever's left — meaning the book title
  (the one thing the code comment claimed to be protecting) was actually the one getting
  squeezed, while the volume/chapter pills always rendered at full, unconstrained size. Fixed by
  moving `Modifier.weight(1f, fill = false)` (+ `TextOverflow.Ellipsis`) onto the volume and
  chapter pills instead, leaving the book pill unweighted — now book renders in full and
  volume/chapter are the ones that truncate first, matching iOS's `.layoutPriority(1)` intent.

### Teshuvot volume-picker wheel — word dropped for non-numeric labels (2026-08-28)

The volume-picker sheet's wheel rows (`volumePickerSheet` / `VolumePickerSheet`) used to always
prefix/suffix the generic word ("Part IV", "Section EH", "Volume Kamma") regardless of what kind
of label the work actually has. Per explicit request, the word is now shown only when every
volume in that work is labeled with a plain number or roman numeral (Radbaz's "1"–"6", Rosh's
"1"–"108", Rashba's "IV"–"VII", Melammed Lehoil's "I"/"II"/"III", etc.) — for everything else
(Rabbi Akiva Eiger's "Kamma"/"Tinyana"/"Chadashot", Chatam Sofer's "EH I"/"EH II", any Tur-order
"OC"/"YD"/"EH"/"CM" work), the wheel row shows the bare label with no word at all. This is a new
computed property, `TeshuvotWork.volumeLabelIsNumeric` (Swift) / `volumeLabelIsNumeric` (Kotlin)
— derived directly from `volumes`' own `label` strings (every character must be a digit or one of
`IVXLCDM`) rather than a second hand-maintained per-work switch, so it can't drift out of sync
with the label data itself if a work's `volumes` ever changes. Only the wheel row is affected —
the sheet's own "Select {word}" title and the header nav pill (already bare-numeral-only since
an earlier round) are unchanged.

### Hebrew edah abbreviations — א/ס instead of A/S in Hebrew mode (2026-08-28)

`TeshuvotEdah.hebrewAbbreviation` (א for Ashkenaz, ס for Sefarad) is shown instead of
`.abbreviation` ("A"/"S") wherever the work-picker badge is rendered in a genuinely Hebrew-mode-
aware surface — currently just the book-picker sheet's row (`teshuvotBookRow` / the `TESHUVOT`
branch of `TextReaderScreen.kt`'s book-picker `LazyColumn`). `TextSelectorView.swift`'s /
`TextSelectorScreen.kt`'s `TeshuvotWheels` (the full-selector work wheel) still shows the English
badge regardless of `saHebrewMode` — a pre-existing gap (that whole wheel is English-only, work
names included) left as-is, not newly introduced here.

**Bookmarks**: `teshuvotSubcategory`/`teshuvotWork`/`teshuvotVolume`/`teshuvotSiman` were added
to `Bookmark` on both platforms *at the same time* as the category itself (nullable DTO fields
+ `?:` fallback on Android, `decodeIfPresent(...) ?? default` on iOS) — deliberately not left
as a follow-up fix, unlike the Tur/Midrash bookmark gaps found and fixed earlier this session.

**How Sefaria ref accuracy was handled — a deliberate choice, not an oversight.** Two options
were on the table: (a) ship only the safe scaffolding (names/order/home button/work picker) and
wait for the user to supply real Sefaria conventions before wiring up fetch, or (b) build the
full picker now with draft refs, since a wrong ref just surfaces through the reader's existing
error/Retry UI rather than crashing, and the user can test on-device (real internet, unlike this
sandbox) and report back exactly which of the 17 fail. **The user explicitly chose (b)** when
asked directly — recorded here so a future session doesn't mistake the draft data for an
oversight or re-litigate the same tradeoff. That verification pass happened 2026-08-24 (see
"Ref data verified against live Sefaria content" above) — the draft-data caveat above still
applies to the handful of individually-unverified per-volume siman ceilings, not to the 17
titles/structures themselves, which are now confirmed.

### Teshuvot Acharonim — 31 works added, verified against live Sefaria (2026-08-28)

Same category, same picker shape, same verification rigor as Rishonim above — added once the
user supplied their work list (16th–19th century, 32 works originally, one dropped — see below).
Verified against `/api/name`, `/api/v2/index`, `/api/shape`, and `/api/texts` before writing any
code, the same way Rishonim's ref data was verified 2026-08-24.

**Why `TeshuvotVolume` exists.** Most Acharonim works are NOT simple numbered volumes like
Rishonim's Rashba/Rosh/Terumat HaDeshen — Sefaria structures many of them as named Tur-order
sections (Orach Chayim/Yoreh Deah/Even HaEzer/Choshen Mishpat), and a few are three levels deep
(Volume → Section → Siman, or printed-edition → Sub-volume → Siman) with no natural third wheel
in this app's Work→Volume→Siman shape. Rather than building a second, parallel mechanism
alongside the old numeral-only one, the whole `TeshuvotWork` volume system was generalized into
`TeshuvotVolume` (see the data-model bullet above) — every work, Rishonim included, now expresses
its second-level picker as a list of `TeshuvotVolume` entries, with deep structures flattened
into one combined-label list at the entry level rather than adding UI complexity. Concretely:
- **Simple named sections** (Maharshdam, Admat Kodesh, Be'er Yitzchak, Binyan Olam, Chatam Sofer,
  Chidushei HaRim, HaElef Lekha Shlomo): one `TeshuvotVolume` per Tur section, labeled with the
  standard English/Hebrew abbreviations (OC/YD/EH/CM, או״ח/יו״ד/אה״ע/חו״מ).
- **Two-dimensional flattening** — Noda BiYehudah (2 volumes × 4 sections = 8 entries, labeled
  "Kamma, OC" etc. per the user's requested Kamma/Tinyana display names, even though Sefaria's
  own titles are the bare "Noda BiYehudah I"/"II") and Rav Pealim (4 volumes × up to 5 sections
  including a kabbalistic "Sod Yesharim" = 19 entries, since Volume I has no Choshen Mishpat on
  Sefaria and that combo is simply omitted).
- **Three-dimensional flattening** — Shoel uMeshiv: 6 printed "Mahadura" editions, the first four
  further split into 3–4 sub-volumes each on Sefaria = 15 entries labeled e.g. "II.3" (Mahadura
  II, sub-volume 3); Mahadura V/VI are flat and get one entry each.
- **A ref needing an embedded colon** — Chatam Sofer's Even HaEzer is itself two levels deep on
  Sefaria (`Even HaEzer 1:{siman}` / `2:{siman}`); with the old scheme this would have needed a
  third special-cased `sefariaRef` branch. With `TeshuvotVolume`, the colon is just baked into
  that one entry's `refTemplate` string like any other — no special-casing needed anywhere in
  `sefariaRef` itself, which is now one generic `volumes[idx].ref(siman:)` call for every work.

**Sparse/empty content dropped, same policy as Rishonim's four removed works.** One entire work
and three individual volumes/sections were checked via `/api/shape` and found to have
essentially no real digitized text, so they were left out entirely rather than shipped as dead
ends:
- **Mateh Levi** — dropped whole-work. 1 of 19 nominal simanim (5.3%) has real content, only
  siman 19.
- **Teshuvot Bayit Chadash ("Bach")'s third part, "Kuntres Acharon"** — dropped; 10 of 84 nominal
  (11.9%) real, and 10 total simanim of actual text isn't worth a picker entry regardless of the
  percentage. Bach's other two parts (HaYeshanot, HaChadashot) are both 100% digitized and kept.
- **Teshuvot Meshiv Davar's Volumes III and IV** — dropped; both report 0 real content (empty
  placeholder nodes on Sefaria). Volumes I–II are fully/near-fully digitized and kept.
- **Teshuvot Maharit's Part II, Even HaEzer** — dropped; a 1-siman stub with 0 real content. The
  rest of Maharit (Part I, Part II's Orach Chayim/Yoreh Deah/Choshen Mishpat) is fine and kept.

Everything else — including works with real but visibly incomplete coverage, like Radbaz's
Volumes II–VI (12–30% of nominal simanim populated, but that's still hundreds of real simanim
each) — was kept rather than dropped, per the same "incomplete isn't the same problem as
near-empty" reasoning used for Rishonim. If Sefaria digitizes more of the four dropped
items/volumes later, re-run `/api/shape` before re-adding, same as the standing note for
Rishonim's four removed works.

**Title/spelling corrections found during verification** (the display name the user gave vs. the
actual Sefaria index title, where they differ): Maharam miPadua → `Responsa Maharam of Padua`
(NOT "Teshuvot Maharam", which is the unrelated Rishon Meir of Rothenburg — same collision
pattern as Rishonim's Maharam entry); Maharshdam → `Responsa Maharashdam` (extra "a"); Rema →
`Responsa of Rema`; Chatam Sofer → `Responsa Chatam Sofer` (bare "Chatam Sofer" collides with a
Torah commentary of the same name); Chidushei HaRim → `Chiddushei HaRim Responsa` (double-d,
"Responsa" suffix needed to disambiguate from his Torah/Talmud commentaries); Maharsham → no
comma before "Volume" (`Teshuvot Maharsham Volume I`, not "... Volume, I"); Meshiv Davar → the
user's "Meishiv" is `Teshuvot Meshiv Davar` on Sefaria (no "i" after the M); Melammed Lehoil →
double-m, no apostrophe (`Melammed Lehoil Part I`, not "Melamed Leho'il"); Rav Pealim →
`Responsa Rav Pealim` (not "Teshuvot"); Sheilat Yavetz → `Sheilat Yaavetz` (double-a); Binyan
Tzion → `Binyan Tziyon`. Rabbi Akiva Eiger's first volume ("Kamma") confirmed to have no
suffix on Sefaria at all, exactly as the user anticipated — `Teshuvot Rabbi Akiva Eiger`, vs.
`... Tinyana` / `... HaChadashot` for the other two.

**Home screen and settings**: see the "Home screen" and "Century dividers... Alphabetical Order"
paragraphs above — both were updated in place rather than duplicated here.

### Teshuvot Contemporary — PDF/scanned-page based, not Sefaria (pilot shipped 2026-08-29)

A third Teshuvot subcategory (`TeshuvotSubcategory.contemporary`), for works that exist only as
scanned PDFs with no Sefaria digitization — starting with Iggros Moshe. Fundamentally different
data shape from Rishonim/Acharonim, so it's a parallel model + a parallel reader path, not an
extension of the Sefaria-ref-based `TeshuvotWork`/`TeshuvotVolume` system above.

**Why a separate model, not a Sefaria ref.** Rishonim/Acharonim resolve a siman to a Sefaria API
call. Contemporary Teshuvot has no digitized text at all — navigation resolves a siman to a raw
**page number** within a set of page images (see the indexing pipeline below), and the reader
displays that page image directly, the same way Talmud's daf-image mode does. `ContemporaryTeshuvotWork`
→ `ContemporaryTeshuvotVolume` (`TextModels.swift`) mirrors `TeshuvotWork`/`TeshuvotVolume`'s
shape for consistency, but `ContemporaryTeshuvotVolume.page(forSiman:)` looks up a hand-maintained
index instead of building a ref string.

**Reader path — a hard branch, not scattered conditionals.** `TextReaderView.body` checks
`vm.category == .teshuvot && vm.teshuvotSubcategory == .contemporary` before `contentWithCommentary`
is ever reached, rendering `contemporaryTeshuvotContent` (an image pager, `ContemporaryTeshuvotPageView`
+ edge tap-zone paging) instead. `TextReaderViewModel.load()` early-returns for this subcategory
— there's no Sefaria fetch to make, and every other branch in `load()` assumes `teshuvotWork`,
which isn't relevant here. This was the deliberate alternative to adding a whole new `TextCategory`
case: that would have forced touching all ~25 existing `case .teshuvot:` switch sites across 5
files (most of which assume Sefaria text/commentary), for a reading experience that shares
nothing with them. The three picker sheets (book/volume/siman) each gained a `contemporary`
branch alongside their existing Sefaria-based logic instead — `chapterPickerWheel`,
`volumePickerSheet` (→ `contemporaryVolumePickerSheet`), and the `bookPickerSheet`'s `.teshuvot`
case (→ `contemporaryBookRow`). **Known gap, not yet fixed**: the separate full-selector sheet
(`.selector`, `TextSelectorView.swift`'s `TeshuvotWheels`) still calls `TeshuvotWork.works(for:)`,
which returns empty for `.contemporary` — renders an empty wheel rather than crashing, but isn't
wired up. Not blocking, since the header's own book/volume/siman pills already give full
navigation; low priority to fix.

**Page-image hosting — Google Drive, not Supabase, mirroring `TalmudPageManager`'s daf-image
mechanism exactly.** Considered and rejected: (1) bundling whole PDFs in the app (the 15-volume
set is hundreds of MB); (2) hosting whole PDFs on Supabase Storage (would exceed the user's free
tier); (3) downloading a whole PDF from Drive's direct-download link and opening it with a real
PDF viewer — **rejected after testing**: Drive's `uc?export=download` link returns an HTML
"can't scan for viruses" interstitial instead of the file for anything past roughly 25MB (Volume
3/EH1, 191MB, hit this; everything else in the 15-volume set, up to ~23MB, downloaded cleanly).
Per-page JPGs never approach that threshold regardless of the original PDF's size, and reuse
100% of the already-working, already-tested daf-image serving path
(`https://drive.google.com/thumbnail?id=FILE_ID&sz=w1600`) — no new Android PDF-rendering
dependency needed (a third-party library was tentatively approved for this, then dropped once
the image-based approach made it unnecessary). Confirms AnyDaf's own documented finding (see
its CLAUDE.md, "Daf Page Image Quality" → "Planned future improvement: PDF rendering"): PDF
rendering was tried there and rejected for both platforms (blurry on Android at zoom-out;
"PDFKit does not give the same low-level bitmap control" on iOS) — independent validation this
project reached the same conclusion for a different reason (Drive's size limit) before finding
that AnyDaf had already ruled out the PDF path itself for image-quality reasons.

Per-page JPEG conversion does **not** reduce total storage versus the original PDFs, contrary to
initial expectation — these scans use an efficient bi-level/text compression (source PDFs were
made with "Ligature OCR" / ABBYY, ~40-50KB/page average) that generic JPEG re-encoding can't beat
without hurting legibility (tested: 150dpi/quality-65 JPEGs run 150-300KB/page, larger not
smaller). Storage size was never the actual constraint though — Drive's per-file interstitial
threshold and Supabase's free-tier cost were.

**Pipeline**: `tools/build_teshuvot_pages.py` (a fork of `AnyDaf/web/build-pages.py` — kept
separate per project rather than modified in place, since the two apps' asset sets are
unrelated) enumerates a public Drive folder via the Drive API (read-only API key, no OAuth) and
writes `teshuvot_pages.json` — `{volumeKey: {page: driveFileId}}`, loaded by `TeshuvotPageManager`
(parallel to `TalmudPageManager`, same bundle-JSON-at-init pattern). One Drive folder per
volume, filenames `{VolumeKey}_Page_NNN.jpg` (same convention as daf images, confirmed — no
regex changes needed from AnyDaf's script). **PDF-to-JPG conversion and the Drive upload are
both manual, user-side steps** — no script in this repo does either (matches AnyDaf's own
daf-image pipeline, which has the identical gap per its own CLAUDE.md).

**Siman→page indexing methodology and accuracy — read before trusting or extending
`teshuvot_siman_index.json`.** These PDFs' embedded OCR text layer (2015-era "Ligature OCR")
is NOT reliable enough to parse automatically:
- Tried linear `pdftotext` + regex on the volume's own printed table of contents ("לוח
  המפתחות") — too much noise: OCR misreads "עמוד"/"סימן" labels in dozens of ways, and
  cross-references to *other* simanim inside the TOC's own subject-line prose get mistaken for
  real table entries.
- Tried PyMuPDF word-bounding-box coordinates (paired "סימן"/"עמוד" labels by 2D proximity
  instead of linearized-text character offset) — structurally sounder, still inherits the
  underlying OCR's letter-level error rate (particularly ר/ד confusion, which is a gematria
  digit — directly risks a wrong page number).
- **What actually works**: rendering the relevant page as an image (`pdftoppm`) and reading it
  directly — far more accurate than either automated approach, but inherently manual, one
  page at a time. Two efficiency findings that make this tractable at scale: (1) once a
  volume's own body pages are confirmed to have large, clear, unambiguous siman headings
  (unlike the compact TOC numerals), **counting consecutive "new teshuvah starts" is more
  reliable than reading each heading's actual gematria numeral** (per explicit user
  suggestion) — simanim are sequential with no gaps, so a wrong single-letter reading (e.g.
  misreading ד as ג) is caught immediately by the running count, whereas trusting each
  numeral's OCR reading in isolation has no self-correcting signal; (2) a "contact sheet" —
  several rendered pages tiled into one composite image via PIL, each tagged with its page
  number — lets one image read cover 9-16 pages at once for *spotting* where a new teshuvah
  starts (the visual break pattern: a horizontal rule + "משה פיינשטיין" signature line, then a
  gap, then a new heading), with a full-resolution single-page render only needed to confirm
  the exact transition point once a candidate is spotted.
- **A structural discovery that generalizes to the other split volumes**: this file's tail TOC
  (10 pages) is not specific to Even HaEzer II — it's a single combined index for the *entire*
  original Volume 4 (Choshen Mishpat + Orach Chaim + Even HaEzer together), and its page
  numbers are the ORIGINAL printed book's continuous pagination, not this split PDF file's own
  internal page count. A fixed per-file offset (`original_page - offset = pdf_internal_page`,
  established by finding one anchor page where a known siman heading's actual PDF page can be
  read directly) converts between them — confirmed empirically for this file (offset 304,
  refined from an initial 303 after cross-checking against two more anchors). **Every other
  split volume (4a/4b, 5a/5b/5c, 6a/6b, 7a/7b, 8a/8b) likely needs this same offset-discovery
  step before its TOC data is usable** — only the three never-split volumes (1, 2, 3) probably
  don't.
- `teshuvot_siman_index.json`'s entries are a **living, hand-maintained best-effort index, not
  guaranteed page-perfect** — some (currently siman 1, 2, 3, 4, 15, 16, 21 of the shipped
  EH2 volume) are directly verified against the actual page image; the rest are TOC-derived
  estimates. This is an acceptable ship state specifically *because* the reader always allows
  manual forward/back paging regardless of whether a jump lands exactly right — correct as
  encountered during use, not before shipping. See the file's sibling entries for which are
  which; there's no in-app confidence flag, just this note.
- **14 of 15 Iggros Moshe volumes downloaded cleanly** from the user's shared Drive folder;
  Volume 3 (Even HaEzer I, 191MB) hit Drive's download-interstitial and needs re-splitting by
  the user before it can be converted to page images — same threshold discussed above.

**Files**: `Models/TextModels.swift` (`ContemporaryTeshuvotWork`/`Volume`, `TeshuvotSubcategory
.contemporary`), `API/TeshuvotPageManager.swift`, `Views/ContemporaryTeshuvotPageView.swift`
(the image pager — deliberately not merged with `DafPageView` despite ~90% code overlap; the
two evolved from different call sites and a forced shared abstraction would cost more than the
duplication saves), `teshuvot_pages.json` + `teshuvot_siman_index.json` (bundled resources),
`tools/build_teshuvot_pages.py`.

#### Post-pilot fixes and Android port (2026-08-29, same-day follow-up)

Four fixes made after initial iOS testing, plus the Android port — both platforms now ship
Contemporary Teshuvot.

- **Selector sheet hidden for all of Teshuvot, not just Contemporary.** The separate combined
  book/siman selector (`.selector` sheet / `ActiveSheet.SELECTOR`, `TeshuvotWheels`) is
  redundant once the header's own book/volume/siman pills give full navigation — true for
  Rishonim/Acharonim too, not only the subcategory that motivated noticing it (Contemporary's
  `TeshuvotWheels` was never wired up and rendered empty). The selector icon in Row 1's left
  cluster is now hidden whenever `vm.category == .teshuvot`/`TextCategory.TESHUVOT`, on both
  platforms.
- **Restore-state bug, pre-existing in the already-shipped Rishonim/Acharonim feature, found
  while building Contemporary.** Tapping a Home-screen Teshuvot button always reset to the
  first work/siman, even when returning to a subcategory you'd already restored from
  persistence. Root cause: `teshuvotSubcategory`'s reset cascade (iOS's `didSet`, Android's
  `setTeshuvotSubcategory`) fired on *every* assignment, not just genuine changes — a plain
  stored property's `didSet` runs regardless of whether the new value differs from the old one,
  and `HomeCombinedView`/`HomeScreen`'s `select()` always calls `restoreState(for: .teshuvot)`
  (which correctly loads the last-used work/volume/siman) immediately followed by
  `applySelection` (which re-asserts the subcategory explicitly, even when unchanged) — so the
  reset discarded the just-restored state on every single tap. Fixed by gating the reset on
  `oldValue != teshuvotSubcategory` (iOS) / `sub != teshuvotSubcategory` computed before
  reassignment (Android, since Kotlin has no `oldValue`). **Found and fixed a second, related
  crash risk while making this Android fix**: `setTeshuvotSubcategory`'s reset branch called
  `TeshuvotWork.worksFor(sub).first()` — for `CONTEMPORARY`, `worksFor` returns an empty list
  (no `TeshuvotWork` case belongs to it), and Kotlin's `first()` throws
  `NoSuchElementException` on an empty list where Swift's `.first` just returns nil. Changed to
  `firstOrNull() ?: TeshuvotWork.RASHI` — `teshuvotWork` itself is unused whenever subcategory
  is Contemporary (the reader reads `contemporaryWork`/`Volume`/`Page` instead), so any
  harmless default is fine; this only needed to not crash.
- **Siman pill was showing the page number, not the siman — fixed with a reverse lookup.**
  Originally showed `"p. N"`/`"עמ׳ N"` (the only reliably-known value at first), but the user
  correctly pointed out this reads wrong: the pill should say what siman you're on, matching
  what the siman *picker* actually navigates by — the underlying page number is an
  implementation detail. Added `TeshuvotPageManager.siman(volume:page:)` (Swift) /
  `.siman(context, volume, page)` (Kotlin) — a **floor lookup**, not an exact match: finds the
  largest indexed siman whose own page is <= the current page, so it stays correct for every
  page within a multi-page teshuvah's span (not just its first page) and degrades gracefully
  past the last indexed siman (pins to it) rather than returning nothing. No descriptor/label
  on the pill now either, bare numeral only, per explicit request. Android-specific wrinkle:
  this lookup needs a `Context` (reads the bundled asset), and `TextReaderViewModel` here is
  plain/Context-free by established convention (see `EinAyahLoader`'s same shape) — so
  `navChapterTitle` became a function taking an optional `Context` parameter instead of a
  plain property, rather than threading Context into the ViewModel itself. Its one real call
  site (`TextReaderScreen.kt`) always has `LocalContext.current` available.
- **Abbreviations, matching the existing OC/YD/EH/CM (או״ח/יו״ד/אה״ע/חו״מ) convention already
  used throughout Acharonim** rather than inventing a new style: Iggros Moshe's Even HaEzer II
  volume is now labeled "EH II"/"אה״ע ב" (identical to Chatam Sofer's own EH II volume above,
  not a new abbreviation invented for this work). Added `hebrewAbbreviation`/
  `hebrewDisplayName` to `ContemporaryTeshuvotWork` (Swift + Kotlin) for the work name itself —
  "אג״מ" for אגרות משה — used everywhere Hebrew mode would otherwise show the full name (header
  pill, book-picker rows), per explicit request to abbreviate sefer names in Hebrew "to their
  common abbreviations when they exist." English work names are deliberately left
  unabbreviated (already short); this is a Hebrew-only convention per the request's own
  framing ("at least in Hebrew").
- **reverseNavDirection wiring, iOS only.** The existing app-wide "reverse navigation
  direction" setting (used elsewhere for Talmud's swipe handler) needed explicit handling in
  Contemporary's edge-tap paging so the left zone/chevron advances forward when the setting is
  on, matching the user's explicit requirement. **Not ported to Android** — checked, and this
  setting doesn't exist on Android at all yet (no equivalent in `AppPreferences.kt` or
  `SettingsScreen.kt`), so Android's Contemporary reader always uses the plain left=back/
  right=forward mapping. Porting the setting itself to Android is a separate, unrelated task,
  out of scope for this feature.

**Android port structure** — deliberately not a literal file-for-file mirror of iOS, since two
things didn't already exist on Android to mirror in the first place:
- **No Android daf-image viewer existed at all** (`TalmudPageManager`/`DafPageView` are
  iOS-only in this app — Talmud daf-image mode was never built for Android here). Rather than
  invent a zoom/pan gesture pattern from scratch, `ContemporaryTeshuvotPageView.kt` adapts the
  proven pattern from **AnyDaf's** `android/app/src/main/java/com/anydaf/ui/PdfDafPageView.kt`
  (a sibling app, same Coil + `detectTransformGestures`/`graphicsLayer` mechanism) — same
  reasoning as the iOS side's own note about not force-merging with `DafPageView`: adapted, not
  imported as a shared library, since the two are different projects. Swipe-to-page (at 1x
  zoom) is kept from that pattern rather than iOS's edge-tap-zones — already proven on this
  platform, and Coil/Compose gesture handling has real per-platform quirks not worth
  re-litigating for parity's sake alone.
- **`TextReaderViewModel` here is plain (no Android `Context`)** by established convention —
  asset loading happens at the Composable layer via `LocalContext.current`, the same shape
  `EinAyahLoader` already uses. `TeshuvotPageManager.kt` follows the identical shape (a
  Context-parameterized `object` with an in-memory cache), and `ContemporaryTeshuvotVolume`
  deliberately has **no** `page(siman)`/`imageUrl(page)` convenience methods (unlike the Swift
  struct, which can reach `Bundle.main` globally) — call `TeshuvotPageManager.page(context,
  volume.id, siman)` directly at the call site instead.
- State: `contemporaryWork`/`Volume`/`Page` on `TextReaderViewModel.kt`, persisted via
  `setContemporaryWork`/`setContemporaryVolume`/`setContemporaryPage` (explicit setter
  functions that also call `saveState`, since — like iOS — Contemporary's reader never calls
  `load()`, which is where every other category's state normally gets persisted; Kotlin has no
  `didSet` to hang this off of automatically).
- UI: `TextReaderScreen.kt` gates Row 2 (display-mode pill, commentary toggle) and the text
  content area behind an `isContemporary` check, rendering `ContemporaryTeshuvotContent`
  instead — same hard-branch shape as iOS's `TextReaderView.body`, not scattered conditionals
  through the existing Sefaria rendering path. `BookPickerSheet`/`VolumePickerSheet`/
  `ChapterPickerSheet` each gained a Contemporary branch alongside their existing Sefaria-based
  logic, mirroring the iOS picker-sheet split described above.

### State flow

- `TextReaderViewModel` (`@Observable @MainActor`) — single source of truth for selection, segments, commentary, display mode.
- `BookmarkManager` (`@Observable`) — persists bookmarks to UserDefaults JSON.
- `AudioPlayer` (`@Observable @MainActor`) — `AVPlayer` wrapper with Now Playing & remote controls.
- `ContentView` owns all three as `@State` and passes them down as `@Bindable`.

---

## Key Files

### iOS (`AnyTorah/`)

| File | Purpose |
|------|---------|
| `Models/TextModels.swift` | `TextCategory`, `CommentaryType`, `TextSegment`, `CommentaryEntry`, `TextDisplayMode` |
| `Models/TextCatalog.swift` | Static catalog of all books/tractates/simanim |
| `Models/HebrewUtils.swift` | `String.strippingNikud` extension |
| `Models/SASimanNames.swift` | SA siman name lookup + `toHebrewNumeral()` |
| `Models/Bookmark.swift` | `Bookmark` struct (Codable) |
| `Models/BookmarkManager.swift` | `@Observable` persistence layer |
| `ViewModels/TextReaderViewModel.swift` | All selection state, `load()`, `loadCommentary()`, navigation labels |
| `API/SefariaTextClient.swift` | Sefaria v2 API client; 100 MB disk cache |
| `API/YomiService.swift` | Fetches today's Daf/Mishnah/929/Parsha/Rambam from Sefaria calendars |
| `API/TalmudAudioService.swift` | Resolves YCT Talmud audio URLs from Supabase |
| `API/DedicationService.swift` | Fetches + decodes the daily/weekly/monthly learning dedication banner |
| `AudioPlayer.swift` | `AVPlayer` + Now Playing + speed control |
| `Views/BrandGradients.swift` | `BrandColorFamily` — the 10 home-tile gradients (5 purple, 5 blue), borrowed from AnyYCTorah's own file of the same name |
| `Views/HomeCombinedView.swift` | Home screen — 10 flat category tiles (not 7); selecting one jumps straight to `TextReaderView` |
| `Views/TextSelectorView.swift` | Wheel pickers + Yomi buttons; presented as a sheet from `TextReaderView`'s header, not shown on the home screen |
| `Views/TextReaderView.swift` | Header rows, sheet management, picker sheets, audio row |
| `Views/TextContentView.swift` | Segment rendering + scroll-to-verse |
| `Views/CommentaryPanelView.swift` | Draggable bottom panel with commentary tabs + swap picker |

### Android (`AnyTorahAndroid/.../com/anytorah/`)

| File | Purpose |
|------|---------|
| `models/TextModels.kt` | Mirrors all iOS enums/data classes |
| `models/TextCatalog.kt` | Static catalog |
| `models/SASimanNames.kt` | SA siman names + `toHebrewNumeral()` |
| `viewmodels/TextReaderViewModel.kt` | All selection state, load, commentary |
| `ui/theme/BrandGradients.kt` | `BrandColorFamily` — the 10 home-tile gradients (5 purple, 5 blue), Compose translation of the iOS file of the same purpose |
| `ui/screens/HomeScreen.kt` | Home screen — 10 flat category tiles (not 7); selecting one jumps straight to the reader |
| `ui/screens/TextReaderScreen.kt` | Main reading screen composable + all picker sheets |
| `ui/screens/TextSelectorScreen.kt` | Wheel pickers + Yomi buttons; presented as a bottom sheet from `TextReaderScreen` (`ActiveSheet.SELECTOR`), not shown on the home screen |
| `api/DedicationService.kt` | Fetches + decodes the daily/weekly/monthly learning dedication banner |

---

## Categories & Commentaries

This section is about `TextCategory`/`contextKey` — the underlying data-model categories and
their default commentary sets — which is a different count from the 12 functional home-screen
category buttons, 13 counting the disabled "Contemporary" Teshuvot placeholder (see "Home
screen — ten flat categories" above, and "Home screen — its own row below the two-column grid"
under Teshuvot for the three Teshuvot buttons); e.g. Talmud is one `TextCategory` here but two home buttons (Bavli/Yerushalmi), each inheriting
the same default commentaries below since Yerushalmi's commentary pool isn't yet a separate
concept. Midrash and Teshuvot have no commentaries at all (`defaultCommentaries` returns `[]`
for both), so neither appears in the table below.

Five `TextCategory` cases with a selector UI, each contributing one or more `contextKey`s with
their own default commentaries:

| Category | Default commentaries |
|----------|---------------------|
| Tanakh — Torah (books 0–4) | Onkelos, Rashi, Ramban |
| Tanakh — Nevi'im (5–25) | Targum Yonatan, Rashi, Metzudat David |
| Tanakh — Ketuvim (26–38) | Targum, Rashi, Metzudat David |
| Mishnah | Rambam, Bartenura, Tosafot Yom Tov |
| Talmud | Rashi, Tosafot |
| Rambam | Maggid Mishneh, Kesef Mishneh |
| SA — Orach Chaim | Mishnah Berurah+Biur Halakha (combined), Shaarei Teshuvah |
| SA — Yoreh Deah | Shakh, Taz, Pitchei Teshuvah |
| SA — Even HaEzer | Chelkat Mechokek, Beit Shmuel, Pitchei Teshuvah |
| SA — Choshen Mishpat | Shakh, Me'irat Einayim, Pitchei Teshuvah |

---

## CommentaryType Enum — Complete Case List

All cases in `TextModels.swift` / `TextModels.kt`:

**Tanakh — Torah core:** `onkelos`, `rashiTanakh`, `ramban`
**Tanakh — Torah extended:** `ibnEzra`, `abarbanel`, `rashbam`, `sforno`, `haKtavVeHaKabalah`, `haamekDavar`, `harchevDavar`, `kliYakar`, `malbim`, `meshechChokhmah`, `orHaChaim`, `ravHirsch`, `shadal`, `torahTemimah`, `cassutoGenesis`, `cassutoExodus`, `hoffmannExodus`, `hoffmannLeviticus`, `jonathanSacks`, `nechamaLeibowitz`
**Tanakh — Nakh shared Rishonim:** `radak`, `ralbag`
**Tanakh — Nakh shared Acharonim:** `alshich`, `metzudatZion`, `rishonLeTzion`
**Tanakh — Nevi'im:** `targumYonatan`
**Tanakh — Ketuvim:** `targumKetuvim`, `metzudatDavid`
**Mishnah:** `rambamMishnah`, `bartenura`, `tosafotYomTov`, `rashMiShantz`, `melekhetShlomo`, `tosafotRabbiAkivaEiger`, `yeshSederLaMishnah`, `mishnatEretzYisrael`, `englishExplanation`, `rashash`, `yachin`, `boaz`, `raavad`, `gra`, `rabbeinuYonah`, `derekhChayyim`, `nachalatAvot`
**Talmud — Group 1 (Rashi-like):** `ranNedarim`, `rashiTalmud`, `rabbeinuChananel`, `rabbeinuGershom`, `rashbamTalmud`, `chiddusheiHaRambam`, `ravNissimGaon`, `mefareshTamid`
**Talmud — Group 2 (Chiddushim):** `chiddusheiRamban`, `rashba`, `ritva`, `ran`, `meiri`, `shitaMekubetzet`, `raah`, `yadRamah`, `riMigash`
**Talmud — Group 3 (Tosafot-type):** `tosafot`, `tosafotHaRosh`, `tosafotRid`, `tosafotShantz`, `tosafotYeshanim`, `piskeiTosafot`, `commentaryOfTheRosh`
**Talmud — Group 4 (Standard Acharonim):** `maharsha`, `maharam`, `chokhmatShlomo`, `rAbbiAkivaEiger`, `rashash`
**Talmud — Group 5 (Additional Acharonim):** `peneiYehoshua`, `haflaahKetubot`, `tzlach`, `chatamSofer`, `arukhLaNer`, `reshimotShiurim`
**Rambam — Classic:** `maggidMishnah`, `kesefMishnah`, `migdalOz`, `lochemMishnah`, `mishnahLaMelech`, `mahariKurkusRadbaz`
**Rambam — Later Acharonim:** `kiryatSefer`, `maasehRokeach`, `orSameach`, `avodatHaMelekh`, `evenHaAzel`
**SA:** `mishnahBerurah`, `shaareiTeshuvah`, `biurHalakha`, `shakh`, `taz`, `chelkatMechokek`, `beitShmuel`, `meiratEinayim`, `pitcheiTeshuvah`

---

## Commentary Pools (for the swap picker)

**`torahPool`** — Torah (Chumash): all Torah+Nakh shared commentaries applicable to Torah
**`neviimPool`** — Nevi'im: targumYonatan, rashiTanakh, radak, abarbanel, ralbag, alshich, malbim, metzudatDavid, metzudatZion, rishonLeTzion, ibnEzra
**`ketuvimPool`** — Ketuvim: targumKetuvim, rashiTanakh, radak, ralbag, alshich, malbim, metzudatDavid, metzudatZion, ibnEzra
**`mishnahPool`** — all Mishnah commentaries (canonical order)
**`talmudGrouped`** — 5 groups (see above); used for the swap picker with section labels
**`rambamGrouped`** — 2 groups: Classic Commentaries, Later Acharonim

`vm.commentaryPool` = `commentaryPoolGrouped.flatMap { $0 }` — filtered by availability for the current tractate/work.
`vm.commentaryPoolGroupLabels: [String?]` — parallel array to `commentaryPoolGrouped`; `nil` means no header for that group; non-nil is displayed as a section header in the swap picker. Implemented in both `TextReaderViewModel.swift` and `TextReaderViewModel.kt`; uses `zip+compactMap`/`zip+mapNotNull` so empty filtered groups are also dropped from labels.

**Swap picker:** Tapping the already-selected commentary tab opens a "Select Commentator" sheet showing the full pool grouped with section headers. Commentaries already in other slots are filtered out (no duplicates). `vm.replaceSlot(slotIndex, option)` / `vm.replaceSlot(at:with:)` persists the change.
- iOS: `CommentarySlotPicker` in `CommentaryPanelView.swift` — `NavigationStack` + `List` with `Section` headers
- Android: `CommentarySwapPickerContent` in `CommentaryPanel.kt` — `ModalBottomSheet` + `LazyColumn` with section label items

---

## SA Inline Commentary Markers

Shulchan Arukh commentators (Shakh, Taz, etc.) embed their paragraph references directly in the SA text as HTML elements (e.g. `<span class="commentator" data-commentator="Shakh">…</span>`). These are pre-processed during `fetchChapter` and converted into styled inline labels before the segments are stored.

### `processCommentaryMarkers(html, section, selectedCommentaries, counters)`

(`SefariaTextClient.swift` / `SefariaTextClient.kt`)

Replaces inline SA commentary tags with styled bracket labels. Called for every seif in `fetchChapter`'s `for` loop. Parameters:
- `section` — the SA section index (0=OC, 1=YD, 2=EH, 3=CM); determines which commentators use inline markers
- `selectedCommentaries` — the active slot assignments; **3 items in single-panel mode, 6 items in bothPanels mode** (main panel first, then right panel). The function auto-detects which mode by `selectedCommentaries.count > 3`.
- `counters` — a **shared mutable map** threaded through all seifim of the same siman. The map persists across calls so sequential labels (א, ב, ג…) are continuous across seifim. **Never initialize `counters` inside the function** — it must be passed in from the outer loop.

**Single-panel slot bracket styles** (3 slots, legacy):
- Slot 0: `(א)` normal size
- Slot 1: `{א}` normal size
- Slot 2: `(א)` small size (rendered via `<rf>…</rf>` tag / `HebrewTextWithSmallPrefix` on Android)

**bothPanels slot bracket styles** (6 slots — `selectedCommentaries.count > 3`):

| Slot | Panel | Bracket | Size |
|------|-------|---------|------|
| 0 | Main | `(א)` | normal |
| 1 | Main | `{א}` | normal |
| 2 | Main | `[א]` | normal |
| 3 | Right | `(א)` | small |
| 4 | Right | `{א}` | small |
| 5 | Right | `[א]` | small |

All 6 bracket types are baked into the HTML at fetch time and appear simultaneously in the main text column regardless of which panel is currently visible. In `TextReaderViewModel.load()`, the SA `fetchChapter` call concatenates `availableCommentaries(for: mainPanel) + availableCommentaries(for: rightPanel)` when `commentaryLayout == .bothPanels`.

### `saHebrewLetter(n: Int) -> String`

Converts an integer to the Hebrew numeral system (additive). Special cases: 15→`טו`, 16→`טז` (to avoid divine-name fragments). Uses standard place-value logic for hundreds/tens/units. **Not** alphabetical position (כ is not 11; יא is).

### `saCommentatorDataName(forSection:)` / `saCommentatorDataName(section:)`

Returns the Sefaria `data-commentator` attribute value for a `CommentaryType` in a given SA section, or `nil` if the commentator has no inline markers in that section (e.g. Magen Avraham has no inline tags). Returns `nil` for non-SA commentaries.

### `hasInlineSAMarkers(forSection:)` / `hasInlineSAMarkers(section:)`

Returns `true` when a commentary has inline SA markers in a given section. Covers:
- `saCommentatorDataName(section) != nil` — commentators that embed `data-commentator` spans
- `self == .mishnahBerurah && section == 0` — MB in OC uses `data-label="N"` attributes, not `data-commentator`

**Important:** The commentary panel uses `hasInlineSAMarkers` to decide whether to show a slot-position prefix. Do NOT use `saCommentatorDataName != nil` alone — that misses MB.

### Commentary panel prefix rendering

`CommentaryPanelView` / `CommentaryPanel.kt` — the `CommentarySegmentView` / `CommentaryContent` function:

1. Determines the slot index of the selected commentary within the panel (`si = panelAvailable.indexOf(selectedCommentary)`)
2. Checks `hasInlineSAMarkers(saSection)` to decide whether a prefix applies
3. Looks up bracket style from the 6-slot global table using `globalSi = si + panelOffset` where `panelOffset = 0` for the main panel and `3` for the right panel. The panel identity is checked via `panel === vm.rightPanel` (iOS) — `CommentaryPanelView` reads `@AppStorage("commentaryLayout")` to detect bothPanels mode.
4. `saLabelIsSmall` is read from the global table entry (`allSlotStyles[globalSi].isSmall`) — right panel slots are always small; main panel slots 0-2 are always normal.
5. **Strips Sefaria's embedded bold label** (`stripLeadingBoldLabel`) from both Hebrew and English HTML before rendering — Sefaria's MB entries start with `<b>א</b>` which would duplicate our prefix
6. **BOTH mode:** English line **never** receives the prefix — the Hebrew line already carries the label
7. **TRANSLATION mode:** English receives the prefix only when `!saLabelIsSmall`; small-prefix slots mean the English line is unlabeled in translation mode

**Single-panel legacy scheme** (used when `commentaryLayout != .bothPanels`):
- slot 0 → `()` normal; slot 1 → `{}` normal; slot 2 → `()` small
- With MB in panel: lower-index non-MB → `{}` normal; higher-index non-MB → `()` small

### `stripLeadingBoldLabel(_ html: String) -> String`

(`SefariaTextClient.swift` / `SefariaTextClient.kt`)

Strips a leading `<b>…</b>` tag (up to 15 inner characters) from Sefaria HTML. Applied to entry HTML before rendering whenever `saStyle != nil` / `saLabelPrefix != nil`. Without this, MB entries show two labels: Sefaria's embedded `<b>א</b>` plus our slot-position prefix.

---

## Sefaria API

Base: `https://www.sefaria.org/api/texts/{ref}?lang={he|en}`

- `lang=he` → `json["he"]` (Hebrew)
- `lang=en` → `json["text"]` (English/translation)
- Both fetched in parallel with `async let`.
- Responses cached: 20 MB memory, 100 MB disk, policy `.returnCacheDataElseLoad`.

### Tanakh commentary depth-3 issue

ALL Tanakh commentaries on Sefaria have `textDepth=3` (Chapter → Verse → Comment). A bare chapter ref (e.g. `"Rashi on Genesis 1"`) returns only the comments on verse 1. Fix: for `category == .tanakh`, always append `:1-200` to the commentaryRef. Sefaria returns an array-of-arrays which `flattenTextValue` flattens correctly.

### Commentary refs — key exceptions

Most follow `"CommentatorName on MainRef"`. Exceptions:

| Commentary | Ref pattern |
|-----------|-------------|
| Onkelos | `"Onkelos Genesis 1"` — no "on" |
| Targum Ketuvim | `"Targum Psalms 1"` — no "on" |
| Abarbanel Torah | `"Abarbanel on Torah, Genesis 1"` — "Torah," prefix for Chumash |
| Rav Hirsch | `"Rav Hirsch on Torah, Genesis 1"` — same pattern; German text only, no Hebrew |
| Ralbag Torah | `"Ralbag on Torah, Genesis 1"`; Ruth/Esther: `"Ralbag Ruth 1"` (no "on") |
| Alshich | Per-book Hebrew titles (see `alshichRef()` in TextModels.swift) |
| Meshekh Chokhmah | `"Meshekh Chokhmah, Bereshit 1"` — Hebrew book name, comma separator |
| HaKtav VeHaKabalah | `"HaKtav VeHaKabalah, Genesis 1"` — comma separator, exact spelling |
| Torah Temimah | `"Torah Temimah on Torah, Genesis 1"` — all 5 books under one title; Hebrew only |
| Cassuto Genesis | Split: ch1–11 → `"Cassuto on Genesis, From Adam to Noah N"`, ch12+ → `"From Noah to Abraham N"` |
| Hoffmann | `"David Zvi Hoffmann on Exodus/Leviticus N"` |
| Derekh Chayyim | `"Derekh Chayyim {ch}"` — standalone title, chapter only |
| Nachalat Avot | `"Nachalat Avot on Avot {ch}"` — "Avot" not "Pirkei Avot" |
| Gra on Avot | `"Gra on Pirkei Avot {ch}"`; Gra on Taharot: `"Eliyahu Rabbah on Mishnah {tractate} {ch}"` |
| Mishnah Berurah | `"Mishnah Berurah {siman}"` — siman number only (regex-extracted) |
| Biur Halakha | `"Biur Halakha {siman}"` — same |
| Magen Avraham | `"Magen Avraham {siman}"` — standalone title + siman number; NOT "on Shulchan Arukh…" (Sefaria doesn't recognize that form) |
| Chelkat Mechokek | `"Chelkat Mechokek {siman}"` — standalone title + siman number, same as Magen Avraham. `"Chelkat Mechokek on Shulchan Arukh, Even HaEzer {siman}"` doesn't error — it silently resolves to siman 1 every time (confirmed against the live API), so this is a silent-wrong-content bug, not a fetch failure |
| Beit Shmuel | `"Beit Shmuel {siman}"` — standalone title + siman number, same as Magen Avraham. Same silent-fallback-to-siman-1 bug as Chelkat Mechokek if given the "on {mainRef}" form |
| Shakh | `"Siftei Kohen on ..."` + range `:1-100` appended |
| Ra'ah | `"Chiddushei HaRa'ah on ..."` |
| Shita Mekubbetzet on Nedarim | double-b: `"Shita Mekubbetzet on Nedarim"` (vs single-b elsewhere) |
| Maaseh Rokeach | strips `"Mishneh Torah, "` prefix: `"Maaseh Rokeach on Yesodei HaTorah 1"` |
| Kesef Mishneh | Sefaria spelling: `"Kessef Mishneh on ..."` (double-s) |
| Chatam Sofer | `"Chidushei Chatam Sofer on ..."` |
| Maharsha | `"Chidushei Halachot on ..."` (this is the single-ref fallback; use `sefariaRefVersions` — see below) |
| Maharam | `"Maharam on ..."` — covers: Shabbat, Eruvin, Pesachim, Sukkah, Beitzah, Yevamot, Ketubot, Gittin, Kiddushin, BK, BM, BB, Sanhedrin, Makkot, AZ, Chullin, Niddah |
| Rishon LeTzion | Display name "Or HaChaim"; Sefaria ref `"Rishon LeTzion on ..."` |
| Jonathan Sacks | Essay-based, not verse-by-verse — fetch returns empty |
| Nechama Leibowitz | Not on Sefaria in usable form — fetch returns empty |
| Rambam commentaries | Ref appended with `:1-N` (N = segments.count) |
| Ra'avad on Rambam | `"Hasagot HaRa'avad on {sefariaName} {chapter}:1-{N}"` — depth-3 (Chapter→Halakhah→Comment); fetched automatically alongside Rambam text and interleaved into each halakha as **השגות הראב״ד:** in bold. Use `fetchRaavad(rambamRef:count:)` + `applyRaavad(_:to:)`. |

### `sefariaRefVersions` — multi-version commentaries

Some commentaries map to multiple Sefaria refs that get fetched and interleaved, with optional Hebrew section headers. Always call `sefariaRefVersions(forMainRef:)` instead of `sefariaRef(forMainRef:)` in `loadCommentary()`.

| Commentary | Behaviour |
|-----------|-----------|
| `tosafotRid` | Avodah Zarah: 3 recensions (מהדורא קמא/תניינא/תליתא); Megillah: 2; Eruvin: Second Recension only; all others: single ref |
| `haamekDavar` | Two refs: "Haamek Davar on …" + "Harchev Davar on …" with Hebrew labels |
| `mishnahBerurah` | Two refs: Mishnah Berurah + Biur Halakha, labelled in Hebrew |
| `yachin` | Two refs: Yachin + Boaz |
| `maharsha` | Agadot-only tractates: single ref; all others: Chidushei Halachot + Chidushei Agadot with Hebrew headers (חידושי הלכות / חידושי אגדות). Agadot-only tractates: Nazir, Zevachim, Arakhin, Temurah, Keritot, Meilah, Tamid |
| `rAbbiAkivaEiger` | Gilyon HaShas + Chiddushei RAE with Hebrew headers, except tractates where Chiddushim is missing: Sotah, Sanhedrin, Horayot, Menachot, Bekhorot, Arakhin, Keritot, Meilah, Niddah |

**Critical:** `introRef` (prepend intro text at chapter 1) is only attempted when `versions.count == 1` (iOS) / `versions.size == 1` (Android) **and `category` is not `.shulchanArukh`, `.mishnah`, or `.rambam`**. Multi-version commentaries, SA, Mishnah, and Rambam commentaries all skip the intro fetch:
- SA: Sefaria returns siman-1 content for "Introduction" refs, duplicating the first siman.
- Mishnah: Sefaria returns ch.1 mishnah-1 content for "Introduction" refs.
- Rambam: Sefaria returns halakha-1 content for "Introduction" refs (confirmed on Maggid Mishneh / Nizkei Mamon).

### Commentary availability filtering

`CommentaryType.isAvailable(forTanakhBookIndex:)` — Torah vs Nakh availability. Key cases:
- Torah-only: onkelos, rashbam, sforno, haKtavVeHaKabalah, haamekDavar, harchevDavar, kliYakar, meshechChokhmah, orHaChaim, ravHirsch, shadal, torahTemimah, nechamaLeibowitz, jonathanSacks (bookIndex ≤ 4)
- Cassuto: Genesis (0) or Exodus (1) only
- Hoffmann: Exodus (1) or Leviticus (2) only
- Malbim: all except Leviticus (2)
- Nakh-only: rishonLeTzion, targumYonatan (Nevi'im 5–25), metzudatDavid, metzudatZion, targumKetuvim (Ketuvim 26+)
- Ibn Ezra: Torah + Isaiah + 12 Minor Prophets + select Ketuvim (no Samuel, Kings, Jer, Ezek, etc.)
- Ralbag: Torah + Early Prophets + select Ketuvim

`isAvailableForTalmud(tractateId:)` — returns false for tractates where no content exists on Sefaria. See full case list in TextModels.swift.

`isAvailableForMishnah(sederIndex:globalTractateId:)`:
- Rash MiShantz: Zeraim (except Berakhot, id=0) + Taharot (seder 5)
- Yesh Seder LaMishnah: Zeraim (0) + Moed (1)
- Ra'avad: Demai (2), Eduyot (36), Kinnim (50) only
- Gra: Avot (38) + all Taharot (seder 5)
- Rabbeinu Yonah, Derekh Chayyim, Nachalat Avot: Avot (38) only
- Yachin, Boaz, Rashash: skipped (not on Sefaria in usable form; cases exist but return empty)

`isAvailableForRambam(workId:)`:
- Migdal Oz: works 0–28 + 48–67 (skips Zeraim, Avodah, Korbanot, Taharah = 29–47)
- Mahari Kurkus+Radbaz: Beit HaBechirah (34), Klei HaMikdash (35), Bi'at HaMikdash (36) only
- Avodat HaMelekh: Sefer HaMadda only (works 0–4)
- Even HaAzel: all except works {2, 4, 10, 25, 26, 27, 28, 30, 31, 32, 33}

---

## Talmud Tractate ID Map

`tractateId` (= `id` field in `TextCatalog.talmudSedarim`):

| id | Tractate | Notes |
|----|---------|-------|
| 0 | Berakhot | |
| 1 | Shabbat | |
| 2 | Eruvin | |
| 3 | Pesachim | |
| 4 | Shekalim | **Yerushalmi only** — most Acharonim unavailable |
| 5 | Yoma | |
| 6 | Sukkah | |
| 7 | Beitzah | |
| 8 | Rosh Hashanah | |
| 9 | Taanit | |
| 10 | Megillah | |
| 11 | Moed Katan | |
| 12 | Chagigah | |
| 13 | Yevamot | |
| 14 | Ketubot | |
| 15 | Nedarim | |
| 16 | Nazir | |
| 17 | Sotah | |
| 18 | Gittin | |
| 19 | Kiddushin | |
| 20 | Bava Kamma | |
| 21 | Bava Metzia | |
| 22 | Bava Batra | |
| 23 | Sanhedrin | |
| 24 | Makkot | |
| 25 | Shevuot | |
| 26 | Avodah Zarah | |
| 27 | Horayot | |
| 28 | Zevachim | |
| 29 | Menachot | |
| 30 | Chullin | |
| 31 | Bekhorot | |
| 32 | Arakhin | |
| 33 | Temurah | |
| 34 | Keritot | |
| 35 | Meilah | |
| 36 | Tamid | mishnahOnly — no full gemara |
| 39 | Niddah | (ids 37–38 are Middot, Kinnim — mishnahOnly, skipped) |

---

## Rambam Catalog

**Important:** The Hebrew names in `TextCatalog.rambamSefarim` do **not** include the "הל׳" prefix. They are stored as e.g. `"יסודי התורה"` not `"הל׳ יסודי התורה"`. The prefix was stripped at the source (via sed); do NOT add it back at runtime.

---

## ViewModel Key Properties

### `TextReaderViewModel`

**Selection state (iOS):**
- `tanakhBookIndex`, `tanakhChapter`
- `mishnahSederIndex`, `mishnahTractateIndexInSeder`, `mishnahChapter`
- `talmudSederIndex`, `talmudTractateIndexInSeder`, `talmudDaf`
- `rambamSeferIndex`, `rambamWorkIndexInSefer`, `rambamChapter`
- `saSection` (0–3: OC/YD/EH/HM), `saSiman`

**Computed catalog lookups:**
- `currentTanakhBook`, `currentMishnahTractate`, `currentTalmudTractate`, `currentRambamWork`
- `globalTalmudTractateIndex` — linear index across all sedarim (matches `tractateId`)

**Nav labels:**
- `navBookTitle: String` — Hebrew name (nikkud-stripped) when `saHebrewMode` is on; English name otherwise
- `navChapterLabel: String` — Hebrew numeral (e.g. "פרק ג׳") when `saHebrewMode`; otherwise "ch. 3" / "§12" / just daf number

**Commentary:**
- `commentaryPool: [CommentaryType]` — flat filtered list for current context
- `commentaryPoolGrouped: [[CommentaryType]]` — filtered groups (empty groups removed)
- `commentaryPoolGroupLabels: [String?]` — parallel to `commentaryPoolGrouped`; section headers; `nil` = no header. Talmud labels: "Rishonim — Rashi-style", "Rishonim — Chiddushim", "Rishonim — Tosafot-style", "Acharonim", "Acharonim — Additional". Rambam labels: "Classic Commentaries", "Later Acharonim".
- `availableCommentaries: [CommentaryType]` — the 3 active slots

**Intro fetch:** `loadCommentary()` prepends an intro section at the first chapter/daf. Only triggered when `isAtFirstSection == true` AND `versions.count == 1` AND `category` is not `.shulchanArukh`, `.mishnah`, or `.rambam`. Sefaria's "Introduction" pseudo-ref returns chapter-1 content for Mishnah and Rambam commentaries, duplicating the first entry.

**Slot persistence (Android):** Commentary slot assignments are persisted as a comma-separated `String` keyed `"commentarySlots_$contextKey"` in SharedPreferences — **not** as a `StringSet`. `StringSet` is unordered and silently shuffles slot positions on restart. Read with `getString`; split on `","` and map through `CommentaryType.fromId()`.

**`replaceSlot` for SA:** When `category == .shulchanArukh`, `replaceSlot` must call `load()` (not just `loadCommentary()`). SA inline text markers are baked into `TextSegment` HTML during `fetchChapter`; changing slot assignments requires re-fetching and reprocessing the main text with the new `selectedCommentaries` order.

### `CommentaryEntry` enum

```swift
enum CommentaryEntry {
    case text(index: Int, label: Int?, he: String, en: String)
    case recensionHeader(String)  // e.g. "מהדורא קמא" — visual divider between Tosafot Rid recensions
    case bookDivider(String)      // prominent separator when one commentator combines two distinct books
}
```

`label` overrides the sequential display number. It is set to the `outerIndices` value (0-based outer array position) for Mishnah, Rambam, and Tanakh categories, so the displayed number matches the mishnah/halakha/verse being commented on rather than a sequential paragraph counter. `CommentarySegmentView` displays `label + 1` when `label` is non-nil. The no-label factory `CommentaryEntry.text(index:he:en:)` exists for call sites that don't need it.

**Why this matters for sparse commentaries:** Kesef Mishneh and similar commentaries skip many halakhot. Without `outerIndices` labels, a commentary on halakha 5 would display as entry "1" because the 4 preceding empty entries are filtered out. With labels, it correctly shows "5".

---

## Display & UI

### Hebrew/RTL mode (`saHebrewMode`)

Stored as `@AppStorage("saHebrewMode")` (iOS) / `UserDefaults` key `"saHebrewMode"` (Android). When true:
- All text names shown in Hebrew (nikkud-stripped)
- Nav header book pill: Hebrew name, RTL layout direction applied to the pills `HStack` via `.environment(\.layoutDirection, .rightToLeft)` (iOS) / `CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl)` (Android)
- Chapter/daf picker wheel: shows Hebrew numerals (`SASimanNames.toHebrewNumeral(n)`)
- SA siman picker sheet (`List`): RTL environment applied to the `List` view
- Book picker sheet (`List`): RTL environment applied to the `List` view
- Android `SASimanPickerContent` and `BookPickerSheet` `LazyColumn`s: wrapped in `CompositionLocalProvider` RTL

### Hebrew numerals

`SASimanNames.toHebrewNumeral(Int) -> String` — used everywhere a number needs to show as e.g. "ג׳", "יד׳", "תשובה" etc. Single-letter gets geresh (׳); multi-letter gets gershayim (״) before last letter. Handles 15→טו and 16→טז. Also available as top-level `toHebrewNumeral()` in TextModels.swift.

### App colors

```swift
// Dark theme (default)
appBg = Color(red: 0.106, green: 0.227, blue: 0.541)   // deep blue
appFg = .white
editorialColor = Color(red: 0.94, green: 0.80, blue: 0.45)  // amber

// Light theme
appBg = .white
appFg = .primary
editorialColor = Color(red: 0.10, green: 0.20, blue: 0.60)  // dark indigo
```

Toggled via `@AppStorage("useWhiteBackground")`.

### `displayMode`

`.source` (Hebrew only) | `.translation` (English only) | `.both` — persisted to UserDefaults. Toggle pill in header row 2 shows `"א"` / `"A"` / `"אA"`.

### Segment labels

- Tanakh: verse number
- Mishnah: `:א`, `:ב` …
- Rambam: `א:`, `ב:` …
- SA: `א`, `ב` …
- Talmud: none (amud-B marker inserted mid-daf as synthetic `TextSegment` with `isAmudBMarker = true`)

### Bold text in English

Bold HTML tags are rendered in amber (dark bg) or dark indigo (light bg) — used for Steinsaltz Aramaic term highlights.

---

## Settings

Settings are presented in `SettingsView.swift` (iOS, `NavigationStack`+`Form`) and `SettingsScreen.kt` (Android, `Column` bottom sheet).

### Text size (`anyTorahFontSize`)

Stored as `Double` in UserDefaults on iOS (`@AppStorage("anyTorahFontSize")`), `Int` in SharedPrefs on Android. Range: −2 to +2; each step = ±2 pt from the base size. Default: 0.

**UI**: Five growing dots between a small **A** and a large **A** (matching AnyDaf). Dot diameters 5→7→9→11→13 pt; the active level's dot is fully filled (`appFg`); inactive dots are 25% opacity. Dots are tappable for direct level selection; the A buttons step one level at a time. A centered caption shows the level name (Smallest / Small / Default / Large / Largest).

**iOS rendering**: All `SelectableTextView` (UIViewRepresentable) instances carry `.id("he-\(fontSizeLevel)")` or `.id("en-\(fontSizeLevel)")` — this forces UIKit to destroy and recreate the `UITextView` when the font level changes, which triggers a fresh `sizeThatFits` and immediate layout update. Without the `.id()`, SwiftUI caches the `sizeThatFits` result and the height doesn't update until a page navigation. `UIFont.appScaled` extension in `SelectableTextView.swift` applies the offset to the point size.

**Android rendering**: `fontSizeLevel: Int` is threaded explicitly through `TextContentPanel` and `CommentaryPanel` as parameters; base sizes + `level * 2f` sp.

### Commentary panel layout

`@AppStorage("commentaryLayout")` / SharedPrefs key `"commentaryLayout"`. Values: `"bottom"` (default), `"left"`, `"right"`, `"both"`.

**Commentary panels on iPhone**: All layout options are available on iPhone. The `.bottomPanel` layout (default) splits the screen horizontally — text above, commentary below — without overlapping. The `.move(edge: .bottom)` transition was removed from `commentaryPane` because it caused the panel to slide over the text (overlay appearance); `.opacity` is used instead so SwiftUI animates the layout split naturally. Side panel layouts (left/right/both) also work on iPhone but are narrow on small screens.

---

## Header Layout (`TextReaderView`)

- **Row 1**: [bookmark, bookmarks-list] (tight-grouped pair) [selector] (left) | nav pills, fill
  remaining width (flat `HStack`/`Row`, not a `ZStack`/`Box` overlay — see "Reader header Row 1"
  above) | Gear (right). Icons: bookmark-edit = `bookmark`/`bookmark.fill`; bookmarks-list =
  `list.bullet` (a literal list glyph, since that button opens the actual bookmarks list —
  search/tap-to-navigate/swipe-to-delete); selector = `text.book.closed`/`MenuBook` (the full
  book/chapter/volume picker — deliberately *not* a list-shaped icon, so it's not mistaken for
  the bookmarks button). See "Bookmark-list icon swap" below for why this changed.
- **Row 2**: Back (left) | language pill `א/A/אA` (center) | commentary toggle (right)
- **Row 3** (Talmud only): Audio player row

---

## Sheet Management (`TextReaderView`)

Single `ActiveSheet` enum drives all sheets:

```swift
private enum ActiveSheet: String, Identifiable {
    case selector, settings, bookmarks, bookmarkEdit, chapterPicker, bookPicker, simanPicker
    var id: String { rawValue }
}
@State private var activeSheet: ActiveSheet? = nil
```

- `.chapterPicker` → `chapterPickerWheel` (wheel picker, `.medium` detent)
- `.bookPicker` → `bookPickerSheet` (scrollable list, `.medium`/`.large` detent)
- `.simanPicker` → `saSimanPickerSheet` (full SA list with topic sections, `.large` detent)

---

## Audio (Talmud only)

`TalmudAudioService` resolves YCT shiur URLs from Supabase (`episode_audio` table). `AudioPlayer` wraps `AVPlayer` with:
- Now Playing metadata
- Remote control commands (play/pause/skip)
- Speed control (`setRate`)
- `skip(by:)` for ±15s

Audio row states: loading → unavailable → idle (▶ Play) → active (full controls).
Active layout: thin progress bar + single row `[elapsed] [⏮][⏸/▶][⏭] [■] [speed] [duration]`.

Stops automatically on daf/tractate change via `.onChange`.

---

## Bookmarks

`Bookmark` (Codable): stores category, all selection indices, display name, subtitle, notes, timestamp. `BookmarkManager` persists array to UserDefaults as JSON.

`bookmark.apply(to: vm)` restores all VM selection state; caller must then call `await vm.load()`.

`BookmarkListView`: searchable/scrollable list sheet, swipe-to-delete, tapping a row navigates and dismisses.

### Bookmark-list icon swap (2026-08-28)

`BookmarkListView`/`BookmarkListView`-equivalent (`.bookmarks` sheet) always did the right thing
— search, tap-to-navigate, swipe-to-delete — but the header's second icon (`bookmarks`, a
stacked-ribbon glyph) didn't read as "tap here for a list" to a user unfamiliar with that
specific SF Symbol/Material icon, while the *third* icon (`list.bullet`, the full book/chapter
selector) does look exactly like "a list" — so the selector kept getting tapped by mistake,
landing on "pick a passage and jump to it" instead of the bookmarks list. Fixed by swapping the
glyphs, not the sheets: bookmarks-list button → `list.bullet` (iOS) / `Icons.AutoMirrored.
Filled.List` (Android); selector button → `text.book.closed` (iOS) / `Icons.Default.MenuBook`
(Android). Also grouped the bookmark-edit and bookmarks-list icons into their own tight-spaced
sub-`HStack`/`Row` (4pt gap on iOS; 40.dp shrunk `IconButton`s on Android) since they're the
functionally-related pair, keeping the unrelated selector icon a full 10pt/48.dp away.

---

## Dedications (daily/weekly/monthly learning banner)

Shown once per day on app launch when an active row exists. Data source: public Supabase table
`dedications` (project `zewdazoijdpakugfvnzt`, readable with the anon key already embedded in
`DedicationService.swift`/`.kt`) — columns `date`, `end_date`, `dedicated_by`, `honoree_name`,
`period` (`"today"`/`"week"`/`"month"`), `preposition`, `occasion`, `display_text` (optional
override), `photo_url`, `status` (`"approved"`).

- **Date range (`date` → `end_date`)**: `end_date` (added via
  `AnyDaf/dedication-date-range-migration.sql` — run manually in the Supabase SQL editor, same
  reason as the app-targeting migration below) is the actual source of truth for whether a
  dedication is active — a plain `date <= today <= end_date` range, letting a dedication cover
  any arbitrary span, not just a calendar week/month. `period` no longer determines the active
  window — it now controls **only the display wording** ("Today's Learning" / "This Week's
  Learning" / "This Month's Learning"). `DedicationService.fetch()` filters this directly in the
  Supabase query (`date=lte.<today>&end_date=gte.<today>`) rather than fetching a lookback window
  and filtering client-side — the old `isActiveToday` calendar-window computation
  (`Calendar.current`'s `weekOfYear`/`month` granularity) is gone entirely. `end_date` is
  `NOT NULL` in the DB (defaults to `date` for a single day), asserted `>= date` by a check
  constraint.
- **Conflict handling**: multiple dedications can be simultaneously active (overlapping ranges).
  `AnyDaf/dedication-form.html` warns the admin at approval time (either via "Publish immediately"
  on submit, or the "Approve" button in the pending queue) if the row overlaps another
  already-approved row sharing an app flag — a `confirm()` dialog, not a hard block. If more than
  one ends up active regardless, `fetch()` picks deterministically: `period`'s display tier
  (today > week > month), then most recently created — unchanged from before this feature.
- **App targeting**: four independent boolean columns — `for_anytorah`, `for_anydaf`,
  `for_anytorah_web`, `for_anyyctorah` (the last added 2026-08-18) — replacing an older single
  `app` text column (`"anytorah"`/`"anydaf"`/`"both"`) that couldn't target apps independently.
  `DedicationService.swift`/`.kt` here filter `for_anytorah=eq.true`; AnyDaf's native services
  filter `for_anydaf=eq.true`; AnyTorahWeb's `app/api/dedication/route.ts` filters
  `for_anytorah_web=eq.true`; AnyYCTorah's `DedicationService.swift` filters
  `for_anyyctorah=eq.true` (see `AnyYCTorah/CLAUDE.md`'s "Dedications" section). Migrated via
  `AnyDaf/dedication-app-targeting-migration.sql` and `AnyYCTorah/dedication-anyyctorah-
  migration.sql` (both run manually in the Supabase SQL editor — no service-role key is available
  to any of these codebases to run DDL programmatically). The old `app` column is left in place,
  unused, after the migration.
- **Admin submission form**: `AnyDaf/dedication-form.html` — a standalone HTML/JS tool (not part
  of any app build) shared across all three apps, with three independent checkboxes (AnyDaf /
  AnyTorah / AnyTorah Web) instead of the old three-way radio group, plus a Start date/End date
  pair (with an "Auto-fill end date from this" convenience button driven by the Period selector —
  Sunday-start week, last day of the calendar month; the admin can always type any End date
  directly instead).
- **Known quirk (not a bug):** the `date`/`end_date` columns have no timezone, and the active-range
  query compares against local "today" (`Calendar.current`/`LocalDate.now()` — effectively local
  time — against columns with no stored offset). A dedication can roll into or out of its window
  up to a day early/late depending on the user's timezone relative to UTC. AnyTorahWeb has the
  same quirk — see its own `CLAUDE.md`.

---

## Yomi

`YomiService.swift`: fetches `https://www.sefaria.org/api/calendars`, maps calendar item refs → app catalog indices. Key mappings in static dicts (`talmudNameMap`, `rambamNameMap`). Yomi buttons appear in `TextSelectorView`.

---

## Critical SwiftUI Gotchas (hard-won)

### 1. `@State` lags one render cycle behind VM in `onChange`

When a Yomi button sets multiple VM properties at once, any computed property that reads a **local `@State`** variable (like `sederIdx`) will see the stale value during the first render. **Always compute critical range/count values from `vm.*` directly**, not from local `@State` mirrors.

Affected: `dafRange` in `TalmudWheels`, `chapterCount` in `TanakhWheels`.

### 2. Picker `set` closures vs `onChange` for reset logic

Moving reset logic into the Picker's `Binding.set` closure (not `.onChange`) means resets only fire on **user interaction**, never on external state writes (e.g. yomi jumps calling `restoreState()`). This fixed the double-tap bug for 929 and Parsha yomi buttons.

### 3. `scrollTo` requires explicit `.id()` on targets

`ScrollViewProxy.scrollTo(_:anchor:)` requires an **explicit `.id(seg.id)`** modifier. The implicit `Identifiable` id from `ForEach` is **not** sufficient.

### 4. Use `VStack`, not `LazyVStack`, when programmatic scrolling is needed

`LazyVStack` only renders on-screen items. `proxy.scrollTo` silently fails for off-screen targets. The scroll-to-verse feature for Parsha/929 requires a plain `VStack` so all rows are in the layout tree immediately.

### 5. Multiple `.sheet(isPresented:)` modifiers on the same view

Only one sheet will present correctly — others are silently ignored. **Consolidate all sheets** into a single `.sheet(item: $activeSheet)` driven by an `ActiveSheet` enum.

### 6. Multi-version intro fetch duplication

When a commentary returns multiple `(ref, label)` pairs from `sefariaRefVersions`, **never** attempt `introRef` prefetching (guard with `versions.count == 1`). Otherwise the intro content is fetched for the first ref and duplicated before the labelled loop runs.

### 7. SA `processCommentaryMarkers` counter must be shared across seifim

`processCommentaryMarkers` takes a `counters: MutableMap<String,Int>` / `inout [String:Int]` parameter. This map must be **initialized once per siman** and passed into the function for every seif in the `for` loop — never initialized inside the function. Initializing it inside would reset sequential labels (א, ב…) at each seif boundary instead of running them continuously across the whole siman.

### 8. Android `SharedPreferences.StringSet` is unordered

`putStringSet` / `getStringSet` does not preserve insertion order. Commentary slot assignments persisted as `StringSet` will be shuffled on restart. Always persist ordered data as a comma-separated `String` and split on read.

### 9. SA `replaceSlot` must reload main text, not just commentary

SA text segments have inline commentary markers baked in during `fetchChapter` based on the current slot order. After `replaceSlot`, call `load()` (which re-runs `fetchChapter` with the new slot assignments) rather than `loadCommentary()` (which only re-fetches the commentary panel). Otherwise the inline labels in the main text still reflect the old slot assignments.

### 10. `UIViewRepresentable` `sizeThatFits` is cached — use `.id()` to force recreation

When `attributedText` changes inside `updateUIView`, SwiftUI does **not** re-run `sizeThatFits` — the cached height from the previous layout pass is reused, so the view appears at the wrong size until the next page navigation forces a full rebuild.

**Fix**: attach `.id("he-\(fontSizeLevel)")` / `.id("en-\(fontSizeLevel)")` to every `SelectableTextView` call. When `fontSizeLevel` changes SwiftUI treats the view as a new identity, destroys the old `UITextView`, calls `makeUIView` + `sizeThatFits` fresh, and the layout updates immediately.

**Current status**: `SelectableTextView` (UITextView) is now only used in `SelectableTextView.swift` itself (dead code). All views use SwiftUI `Text` + Font.custom. The `.id()` trick is no longer needed and has been removed.

### 11. Commentary amud B scroll — use `@State` counter + `.task(id:)`, not `DispatchQueue`

When a commentator changes while on amud B, `panel.loadVersion` increments after entries are set. A `@State private var pendingAmudBScroll: Int` in `CommentaryPanelView` is incremented by `.onChange(of: panel.loadVersion)` when `talmudAmud == 1`. A `.task(id: pendingAmudBScroll)` inside `ScrollViewReader` then captures a fresh proxy, sleeps 150 ms for layout, and calls `scrollToAmudBHeader`. Using `DispatchQueue.main.asyncAfter` was broken because the captured `proxy` is stale by the time the closure runs.

### 12. UITextView inside SwiftUI ScrollView blocks custom Hebrew fonts AND text selection

`UITextView` silently overrides custom `NSAttributedString` font attributes for RTL runs (using system Hebrew font instead of Frank Ruhl Libre). Additionally, UITextView's long-press gesture for selection conflicts with SwiftUI's `ScrollView` gesture recognizers. **Fix**: use `SwiftUI Text + Font.custom(...)` for all Hebrew. Then `.textSelection(.enabled)` on the `ScrollView` enables drag-handle selection for both Hebrew and English automatically.

### 13. Talmud amud (א/ב) not persisted when switching via in-reader buttons (iOS)

The in-reader amud buttons (`talmudTextAmudButton`) set `vm.talmudAmud` directly without calling `load()`, so `saveState()` was never triggered. On iOS, `talmudAmud` has a `didSet { if !isRestoring { saveState(for: .talmud) } }` to persist on every change. Android is unaffected — its `talmudAmud` setter writes to SharedPreferences directly on every assignment.

### 14. Raavad block must be inside the text column, not the outer VStack/Column

`RaavadBlock` / `raavadBlock` must be placed **inside** the inner text `VStack`/`Column` (the one that holds Hebrew/English content), not in the outer container alongside the `HStack`/`Row`. Placing it outside means it spans the full width, extending past the halakha-number label. Inside the content column, it naturally aligns with the Rambam text.

---

## Ein Ayah (עין אי"ה) — SHIPPED

Rav Kook's commentary on aggadic passages of Berakhot and Shabbat. Bundled as `ein_ayah.json` (4.4 MB uncompressed, ~1 MB compressed). Available in the Talmud commentary picker only for Berakhot (tractateId 0) and Shabbat (tractateId 1), in the "Additional Acharonim" group.

- **Source:** Wikisource Hebrew, fetched with `tools/fetch_ein_ayah.py`
- **Entries:** 1,746 placed across 113 Berakhot dafim + 93 Shabbat dafim (186 index pages skipped — expected)
- **Loading:** `EinAyahLoader` reads bundled JSON; `loadCommentary()` short-circuits before any Sefaria fetch
- **Daf mapping:** app navigates whole dafim (Int), so loader combines amud-a + amud-b entries per daf

---

## Planned Feature: Chavruta Commentary (חברותא)

**Status: PAUSED — pending licensing permission from Rabbi Yaakov Shulwitz שליט"א.**

Chavruta is a running Hebrew commentary/paraphrase on the Bavli by Rabbi Yaakov Shulwitz, available at toratemetfreeware.com. If permission is granted, it would be added as a new `CommentaryType` case at the end of the Talmud Acharonim group.

### Coverage

38 of 39 tractates have Chavruta. The only missing tractate is **Eduyot** (no Bavli Gemara). Every tractate has two versions: with footnotes and without footnotes ("בלי הערות").

### Licensing

Every file carries: *"כל הזכויות שמורות (c) ל הרב יעקב שולביץ שליט"א"* — all rights reserved. "Freeware" means free to use on the web personally; bundling in a distributed app requires explicit permission. **Do not implement until permission is confirmed.**

### Site Structure

- Root Bavli index: `https://www.toratemetfreeware.com/online/d_root__030_bavli.html`
- Each tractate is a folder page: `d_root__030_bavli__NN_mas_NAME.html`
- Each folder lists files via `AddIndex(title, filename, type)` JavaScript calls
- Chavruta files are single large HTML pages — all dapim concatenated into one file
- Site uses **Windows-1255** encoding; requires `iconv -f windows-1255 -t utf-8` to decode

### HTML Structure (for parsing)

- **Daf boundaries**: `<B><U><span ...><u>דף כו - א</u></span></U></B>` — search for `דף [number] - [א|ב]`
- **Amud B midpoint**: `<img src='p_amud.bmp' title='מיקום עמוד מדויק'>` inline in the text
- **Main commentary text**: `font-size:17-20px`, black `RGB(0,0,0)` — the readable content
- **Footnote references**: small grey boxes `RGB(216,216,216)` with footnote numbers
- **Footnote text**: `font-size:14px`, blue `RGB(51,119,204)` — can be stripped or kept

### File Sizes and Bundle Strategy

Stripped plain text (HTML removed, no footnotes) per tractate:

| Example | Dapim | Stripped size |
|---------|-------|--------------|
| Shabbat / Bava Batra / Yevamot | 120-176 | ~3.1 MB each |
| Bava Metzia | 119 | ~2.9 MB |
| Berakhot | 63 | ~1.5 MB |
| Taanit | 31 | ~786 KB |
| Megillah | 32 | ~589 KB |
| Tamid | ~9 Gemara dapim | ~147 KB |

**Total across all 38 tractates: ~60–65 MB uncompressed, ~17–20 MB gzip-compressed.**

Because Chavruta is not available via Sefaria API and requires preprocessing (HTML stripping, per-amud splitting), the best delivery model is **per-tractate on-demand download + disk cache** — consistent with how `SefariaTextClient` already caches Sefaria responses. Each tractate's Chavruta would be fetched once (from a CDN hosting preprocessed JSON) and stored on disk.

### Integration Notes (for when work resumes)

- New `CommentaryType` case: `.chavruta` — placed at end of Talmud Acharonim group
- Not on Sefaria — needs its own fetch path in `SefariaTextClient` (similar to how `TalmudAudioService` uses Supabase instead of Sefaria)
- Preprocessing script needed: download HTML → strip tags → split by amud → output per-amud JSON → host on CDN
- `isAvailableForTalmud`: true for all tractates except Eduyot (tractateId 37-38 range — but Eduyot is not in the app's Talmud catalog anyway)
- The "without footnotes" version (`בלי הערות`) is the cleaner base for integration; footnotes could be offered as an optional toggle

---

## Mishnah Commentary Ref Quirks

Most: `"CommentatorName on Mishnah {tractate} {ch}"`. Exceptions:
- English Explanation: `"English Explanation of Mishnah {tractate} {ch}"` — no "on"
- Derekh Chayyim: `"Derekh Chayyim {ch}"` — standalone, no book/tractate
- Nachalat Avot: `"Nachalat Avot on Avot {ch}"` — "Avot" not "Pirkei Avot"
- Pirkei Avot's `sefariaName` is `"Pirkei Avot"` (no "Mishnah" prefix), so mainRef = `"Pirkei Avot 3"` — Gra and Rabbeinu Yonah resolve via standard "on" pattern
