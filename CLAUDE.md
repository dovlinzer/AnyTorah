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
their default commentary sets — which is a different count from the 10 home-screen category
buttons (see "Home screen — ten flat categories" above); e.g. Talmud is one `TextCategory`
here but two home buttons (Bavli/Yerushalmi), each inheriting the same default commentaries
below since Yerushalmi's commentary pool isn't yet a separate concept.

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

- **Row 1**: Gear (left) | centered title ±88pt padding (ZStack) | [bookmark][bookmarks][list] (right)
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
