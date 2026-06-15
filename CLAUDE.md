# AnyTorah — CLAUDE.md

**iOS project:** `/Users/dovlinzer/claudecode/AnyTorah/AnyTorah/` (Xcode project at root)
**Android project:** `/Users/dovlinzer/claudecode/AnyTorah/AnyTorahAndroid/`

> **Both platforms:** Unless explicitly told otherwise, every feature, bug fix, and improvement must be applied to **both** the iOS and Android projects.

iOS app (Swift/SwiftUI, iOS 17+) for browsing Torah texts via the Sefaria public API. Built with `@Observable`, `@Bindable`, and `@MainActor` throughout — no Combine, no StateObject. Android is Kotlin/Compose with an `@HiltViewModel`-based architecture.

## Build & Run

**iOS:** Open `AnyTorah.xcodeproj` in Xcode and run on simulator or device. No package dependencies. `project.yml` is a XcodeGen spec (not normally needed unless regenerating).

**Android:** Open `AnyTorahAndroid/` in Android Studio. Standard Gradle build.

---

## Architecture

```
ContentView  (owns all top-level @State)
  ├── SplashView          (2.5s intro, fades out)
  ├── CategoryMenuView    (pick one of 5 categories)
  ├── TextSelectorView    (wheel-picker selector per category)
  └── TextReaderView      (main reading + commentary + audio)
        ├── TextContentView       (scrollable VStack of segments)
        ├── CommentaryPanelView   (bottom slide-up panel)
        ├── BookmarkListView      (sheet — searchable list)
        └── BookmarkEditSheet     (sheet — add/edit one bookmark)
```

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
| `AudioPlayer.swift` | `AVPlayer` + Now Playing + speed control |
| `Views/TextSelectorView.swift` | Wheel pickers + Yomi buttons |
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
| `ui/screens/TextReaderScreen.kt` | Main reading screen composable + all picker sheets |
| `ui/screens/TextSelectorScreen.kt` | Category selector composable |

---

## Categories & Commentaries

Five categories, each with its own selector UI and default commentaries:

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

**Critical:** `introRef` (prepend intro text at chapter 1) is only attempted when `versions.count == 1` (iOS) / `versions.size == 1` (Android) **and `category != .shulchanArukh`**. Multi-version commentaries AND all SA commentaries skip the intro fetch. Sefaria interprets "Commentary on Shulchan Arukh, Section, Introduction" as returning siman-1 content — calling `introRef` for SA doubles the first siman's commentary entries.

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

**Intro fetch:** `loadCommentary()` prepends an intro section at the first chapter/daf. Only triggered when `isAtFirstSection == true` AND `versions.count == 1` (single-version commentaries) AND `category != .shulchanArukh`. Multi-version and SA commentaries are explicitly excluded.

**Slot persistence (Android):** Commentary slot assignments are persisted as a comma-separated `String` keyed `"commentarySlots_$contextKey"` in SharedPreferences — **not** as a `StringSet`. `StringSet` is unordered and silently shuffles slot positions on restart. Read with `getString`; split on `","` and map through `CommentaryType.fromId()`.

**`replaceSlot` for SA:** When `category == .shulchanArukh`, `replaceSlot` must call `load()` (not just `loadCommentary()`). SA inline text markers are baked into `TextSegment` HTML during `fetchChapter`; changing slot assignments requires re-fetching and reprocessing the main text with the new `selectedCommentaries` order.

### `CommentaryEntry` enum

```swift
enum CommentaryEntry {
    case text(index: Int, he: String, en: String)
    case recensionHeader(String)  // e.g. "מהדורא קמא" — visual divider between Tosafot Rid recensions
    case bookDivider(String)      // prominent separator when one commentator combines two distinct books
}
```

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

Applied to:
- `hebrewView` and `englishView` in `SegmentRow` (`TextContentView.swift`)
- `hebrewContentView()` and all English `SelectableTextView` calls in `CommentarySegmentView` (`CommentaryPanelView.swift`)

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
