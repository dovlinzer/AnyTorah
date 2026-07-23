// Ported from AnyTorah/AnyTorah/Models/TextModels.swift (CommentaryType enum + logic).
// See /Users/dovlinzer/claudecode/AnyTorah/CLAUDE.md for the authoritative Sefaria-ref
// quirks table and availability tables this file implements. Keep both in sync by hand —
// there is no automated diff between the Swift/Kotlin and TS versions.

export type CommentaryType =
  // Tanakh — Torah (core)
  | "onkelos"
  | "rashiTanakh"
  | "ramban"
  // Tanakh — Torah (extended pool)
  | "ibnEzra"
  | "abarbanel"
  | "rashbam"
  | "sforno"
  | "haKtavVeHaKabalah"
  | "haamekDavar"
  | "harchevDavar"
  | "kliYakar"
  | "malbim"
  | "meshechChokhmah"
  | "orHaChaim"
  | "ravHirsch"
  | "shadal"
  | "torahTemimah"
  | "cassutoGenesis"
  | "cassutoExodus"
  | "hoffmannExodus"
  | "hoffmannLeviticus"
  | "jonathanSacks"
  | "nechamaLeibowitz"
  // Tanakh — Nakh shared (Rishonim)
  | "radak"
  | "ralbag"
  // Tanakh — Nakh shared (Acharonim)
  | "alshich"
  | "metzudatZion"
  | "rishonLeTzion"
  // Tanakh — Nevi'im
  | "targumYonatan"
  // Tanakh — Ketuvim
  | "targumKetuvim"
  | "metzudatDavid"
  // Mishnah — core
  | "rambamMishnah"
  | "bartenura"
  | "tosafotYomTov"
  // Mishnah — additional commentaries
  | "rashMiShantz"
  | "melekhetShlomo"
  | "tosafotRabbiAkivaEiger"
  | "yeshSederLaMishnah"
  | "mishnatEretzYisrael"
  | "englishExplanation"
  | "rashash"
  | "yachin"
  | "boaz"
  | "raavad"
  | "gra"
  | "rabbeinuYonah"
  | "derekhChayyim"
  | "nachalatAvot"
  // Talmud — core
  | "rashiTalmud"
  | "tosafot"
  // Talmud — Group 1: Rashi-like
  | "ranNedarim"
  | "rabbeinuChananel"
  | "rabbeinuGershom"
  | "rashbamTalmud"
  | "ran"
  | "ravNissimGaon"
  | "mefareshTamid"
  // Talmud — Group 2: Chiddushim
  | "chiddusheiRamban"
  | "rashba"
  | "ritva"
  | "meiri"
  | "shitaMekubetzet"
  | "raah"
  | "yadRamah"
  | "riMigash"
  | "chiddusheiHaRambam"
  // Talmud — Group 3: Tosafot-type
  | "tosafotHaRosh"
  | "tosafotRid"
  | "tosafotShantz"
  | "tosafotYeshanim"
  | "piskeiTosafot"
  | "commentaryOfTheRosh"
  // Talmud — Group 4: Standard Acharonim
  | "maharsha"
  | "maharam"
  | "chokhmatShlomo"
  | "rAbbiAkivaEiger"
  // Talmud — Group 5: Additional Acharonim
  | "peneiYehoshua"
  | "haflaahKetubot"
  | "tzlach"
  | "chatamSofer"
  | "arukhLaNer"
  | "reshimotShiurim"
  | "einAyah"
  // Yerushalmi
  | "peneiMoshe"
  | "mareyHaPanim"
  | "ohrLayesharim"
  // Tosefta
  | "toseftaKifshutah"
  | "briefCommentary"
  // Rambam — Main
  | "maggidMishnah"
  | "kesefMishnah"
  | "migdalOz"
  | "lochemMishnah"
  | "mishnahLaMelech"
  | "mahariKurkusRadbaz"
  // Rambam — Later Acharonim
  | "kiryatSefer"
  | "maasehRokeach"
  | "orSameach"
  | "avodatHaMelekh"
  | "evenHaAzel"
  // SA — Orach Chayim
  | "mishnahBerurah"
  | "shaareiTeshuvah"
  | "biurHalakha"
  // SA — Yoreh Deah
  | "shakh"
  | "taz"
  // SA — Even HaEzer
  | "chelkatMechokek"
  | "beitShmuel"
  // SA — Choshen Mishpat
  | "meiratEinayim"
  // SA — YD, EH, HM shared
  | "pitcheiTeshuvah"
  // SA — General (all sections)
  | "baerHetev"
  | "beurHagraSA"
  | "kafHaChaim"
  // SA — OC
  | "magenAvraham"
  | "eliyaRabbah"
  | "priMegadimOC"
  // SA — YD
  | "nekudatHaKesef"
  | "priMegadimYD"
  | "keretiUPeleti"
  | "toratHaShlamim"
  // SA — EH
  | "beitMeir"
  | "ezerMiKodesh"
  // SA — CM
  | "ktzotHaChoshen"
  | "netivotHaMishpat"
  | "urimVTumim"
  | "hagahotRAE";

// MARK: - Curated pools per context

/** All commentators available for selection in the Torah (Chumash) context. */
export const torahPool: CommentaryType[] = [
  "onkelos", "rashiTanakh", "ramban", "ibnEzra", "rashbam", "radak", "ralbag",
  "sforno", "abarbanel", "kliYakar", "orHaChaim", "haamekDavar",
  "shadal", "haKtavVeHaKabalah", "malbim", "torahTemimah",
  "cassutoGenesis", "cassutoExodus", "hoffmannExodus", "hoffmannLeviticus",
];

/** All commentators available for selection in the Nevi'im context. */
export const neviimPool: CommentaryType[] = [
  "targumYonatan", "rashiTanakh", "radak", "abarbanel", "ralbag",
  "alshich", "malbim", "metzudatDavid", "metzudatZion", "rishonLeTzion", "ibnEzra",
];

/** All commentators available for selection in the Ketuvim context. */
export const ketuvimPool: CommentaryType[] = [
  "targumKetuvim", "rashiTanakh", "radak", "ralbag",
  "alshich", "malbim", "metzudatDavid", "metzudatZion", "ibnEzra",
];

/**
 * Talmud commentary pool divided into five groups for the swap-picker UI.
 * Group 0: Rashi-like | 1: Chiddushim | 2: Tosafot-type | 3: Standard Acharonim | 4: Additional Acharonim.
 */
export const talmudGrouped: CommentaryType[][] = [
  ["ranNedarim", "rashiTalmud", "rabbeinuChananel", "rabbeinuGershom",
   "rashbamTalmud", "chiddusheiHaRambam", "ravNissimGaon", "mefareshTamid"],
  ["chiddusheiRamban", "rashba", "ritva", "ran", "meiri", "shitaMekubetzet",
   "raah", "yadRamah", "riMigash"],
  ["tosafot", "tosafotHaRosh", "tosafotRid", "tosafotShantz",
   "tosafotYeshanim", "commentaryOfTheRosh"],
  ["maharsha", "maharam", "chokhmatShlomo", "rAbbiAkivaEiger", "rashash"],
  ["peneiYehoshua", "haflaahKetubot", "tzlach", "chatamSofer", "arukhLaNer", "reshimotShiurim", "einAyah"],
];

/** Two curated groups for the Rambam picker: Main (classic commentaries) + Later Acharonim. */
export const rambamGrouped: CommentaryType[][] = [
  ["maggidMishnah", "kesefMishnah", "migdalOz", "lochemMishnah", "mishnahLaMelech", "mahariKurkusRadbaz"],
  ["kiryatSefer", "maasehRokeach", "orSameach", "avodatHaMelekh", "evenHaAzel"],
];

/** Commentators available for the Yerushalmi context. */
export const yerushalmiPool: CommentaryType[] = ["peneiMoshe", "mareyHaPanim", "ohrLayesharim"];

/** Commentators available for the Tosefta context. */
export const toseftaPool: CommentaryType[] = ["toseftaKifshutah", "briefCommentary"];

/**
 * All commentators available for selection in the Mishnah context.
 * Order matches the user-specified canonical display order.
 */
export const mishnahPool: CommentaryType[] = [
  "rambamMishnah", "rashMiShantz", "raavad", "rabbeinuYonah", "bartenura",
  "tosafotYomTov", "yachin", "melekhetShlomo", "tosafotRabbiAkivaEiger", "gra",
  "rashash", "derekhChayyim", "nachalatAvot", "yeshSederLaMishnah",
  "mishnatEretzYisrael", "englishExplanation",
];

/** Full curated pool of SA commentators for the given section (0=OC, 1=YD, 2=EH, 3=CM). */
export function saPool(section: number): CommentaryType[] {
  switch (section) {
    case 0: // Orach Chayim
      return ["mishnahBerurah", "biurHalakha", "magenAvraham", "taz", "eliyaRabbah",
              "shaareiTeshuvah", "priMegadimOC", "baerHetev", "beurHagraSA", "kafHaChaim",
              "chokhmatShlomo"];
    case 1: // Yoreh De'ah
      return ["taz", "shakh", "nekudatHaKesef", "priMegadimYD", "keretiUPeleti",
              "toratHaShlamim", "baerHetev", "beurHagraSA", "pitcheiTeshuvah", "kafHaChaim"];
    case 2: // Even HaEzer
      return ["chelkatMechokek", "beitShmuel", "taz", "beitMeir", "ezerMiKodesh",
              "baerHetev", "beurHagraSA", "pitcheiTeshuvah", "chokhmatShlomo"];
    case 3: // Choshen Mishpat
      return ["meiratEinayim", "shakh", "taz", "ktzotHaChoshen",
              "netivotHaMishpat", "urimVTumim", "hagahotRAE", "baerHetev", "beurHagraSA",
              "pitcheiTeshuvah", "chokhmatShlomo"];
    default:
      return [];
  }
}

/**
 * Returns the Sefaria `data-commentator` attribute value used in SA text for this
 * commentary's sequential inline markers in the given section (0=OC, 1=YD, 2=EH, 3=CM).
 * Returns null if this commentary has no inline markers in that section.
 */
export function saCommentatorDataName(type: CommentaryType, section: number): string | null {
  switch (section) {
    case 0: // Orach Chayim
      switch (type) {
        case "taz": return "Turei Zahav";
        case "magenAvraham": return "Magen Avraham";
        case "shaareiTeshuvah": return "Sha'arei Teshuvah";
        default: return null;
      }
    case 1: // Yoreh De'ah
      switch (type) {
        case "taz": return "Turei Zahav";
        case "shakh": return "Siftei Kohen";
        case "pitcheiTeshuvah": return "Pithei Teshuva";
        default: return null;
      }
    case 2: // Even HaEzer
      switch (type) {
        case "taz": return "Turei Zahav";
        case "chelkatMechokek": return "Chelkat Mechokek";
        case "beitShmuel": return "Beit Shmuel";
        case "pitcheiTeshuvah": return "Pithei Teshuva";
        default: return null;
      }
    case 3: // Choshen Mishpat
      switch (type) {
        case "meiratEinayim": return "Me'irat Einayim";
        case "shakh": return "Siftei Kohen";
        case "pitcheiTeshuvah": return "Pithei Teshuva";
        default: return null;
      }
    default:
      return null;
  }
}

/**
 * True when this commentary has any inline markers in the SA text for the given section.
 * Covers both data-commentator markers (saCommentatorDataName) and Mishnah Berurah's
 * data-label markers in OC (section 0).
 */
export function hasInlineSAMarkers(type: CommentaryType, section: number): boolean {
  if (saCommentatorDataName(type, section) !== null) return true;
  return type === "mishnahBerurah" && section === 0;
}

// MARK: - Display names

export const displayName: Record<CommentaryType, string> = {
  onkelos: "Onkelos",
  rashiTanakh: "Rashi",
  rashiTalmud: "Rashi",
  ramban: "Ramban",
  ibnEzra: "Ibn Ezra",
  abarbanel: "Abarbanel",
  rashbam: "Rashbam",
  sforno: "Sforno",
  haKtavVeHaKabalah: "HaKtav VeHaKabalah",
  haamekDavar: "Ha'amek Davar + Harchev Davar",
  harchevDavar: "Harchev Davar",
  kliYakar: "Kli Yakar",
  malbim: "Malbim",
  meshechChokhmah: "Meshekh Chokhmah",
  orHaChaim: "Or HaChaim",
  ravHirsch: "Rav Hirsch",
  shadal: "Shadal",
  torahTemimah: "Torah Temimah",
  cassutoGenesis: "Cassuto (Genesis)",
  cassutoExodus: "Cassuto (Exodus)",
  hoffmannExodus: "Hoffmann (Exodus)",
  hoffmannLeviticus: "Hoffmann (Leviticus)",
  jonathanSacks: "Jonathan Sacks",
  nechamaLeibowitz: "Nechama Leibowitz",
  radak: "Radak",
  ralbag: "Ralbag",
  alshich: "Alshich",
  metzudatZion: "Metzudat Zion",
  rishonLeTzion: "Or HaChaim", // R. Chaim ibn Attar's Nakh work; titled "Rishon LeTzion" on Sefaria
  targumYonatan: "Targum Yonatan",
  targumKetuvim: "Targum",
  metzudatDavid: "Metzudat David",
  rambamMishnah: "Rambam",
  bartenura: "Bartenura",
  tosafotYomTov: "Tosafot Yom Tov",
  rashMiShantz: "Rash MiShantz",
  melekhetShlomo: "Melekhet Shlomo",
  tosafotRabbiAkivaEiger: "Tosafot R. Akiva Eiger",
  yeshSederLaMishnah: "Yesh Seder LaMishnah",
  mishnatEretzYisrael: "Mishnat Eretz Yisrael (Safrai)",
  englishExplanation: "Kulp (English)",
  rashash: "Rashash",
  yachin: "Yachin + Boaz",
  boaz: "Boaz",
  raavad: "Ra'avad",
  gra: "Eliyahu Rabbah (Gra)",
  rabbeinuYonah: "Rabbeinu Yonah",
  derekhChayyim: "Derekh Chayyim (Maharal)",
  nachalatAvot: "Nachalat Avot (Abarbanel)",
  ranNedarim: "Ran",
  rabbeinuChananel: "Rabbeinu Chananel",
  rabbeinuGershom: "Rabbeinu Gershom",
  rashbamTalmud: "Rashbam",
  ran: "Ran (Chiddushim)",
  ravNissimGaon: "Rav Nissim Gaon",
  mefareshTamid: "Pseudo-Rashi (Tamid)",
  chiddusheiRamban: "Ramban",
  rashba: "Rashba",
  ritva: "Ritva",
  meiri: "Meiri",
  shitaMekubetzet: "Shita Mekubbetzet",
  raah: "Ra'ah",
  yadRamah: "Yad Ramah",
  riMigash: "Ri Migash",
  chiddusheiHaRambam: "Rambam",
  tosafotHaRosh: "Tosafot HaRosh",
  tosafotRid: "Tosafot Rid",
  tosafotShantz: "Tosafot Shantz",
  tosafotYeshanim: "Tosafot Yeshanim",
  piskeiTosafot: "Piskei Tosafot",
  commentaryOfTheRosh: "Commentary of the Rosh",
  maharsha: "Maharsha",
  maharam: "Maharam",
  chokhmatShlomo: "Chokhmat Shlomo",
  rAbbiAkivaEiger: "R. Akiva Eiger",
  peneiYehoshua: "Penei Yehoshua",
  haflaahKetubot: "Haflaah",
  tzlach: "Tzelach",
  chatamSofer: "Chatam Sofer",
  arukhLaNer: "Arukh LaNer",
  reshimotShiurim: "Reshimot Shiurim (Rav Soloveitchik)",
  einAyah: "Ein Ayah (Rav Kook)",
  peneiMoshe: "Penei Moshe",
  mareyHaPanim: "Mareh HaPanim",
  ohrLayesharim: "Ohr LaYesharim",
  toseftaKifshutah: "Tosefta Kifshutah",
  briefCommentary: "Brief Commentary (Lieberman)",
  tosafot: "Tosafot",
  maggidMishnah: "Maggid Mishneh",
  kesefMishnah: "Kesef Mishneh",
  migdalOz: "Migdal Oz",
  lochemMishnah: "Lechem Mishneh",
  mishnahLaMelech: "Mishneh LaMelech",
  mahariKurkusRadbaz: "Mahari Kurkus & Radbaz",
  kiryatSefer: "Kiryat Sefer",
  maasehRokeach: "Maaseh Rokeach",
  orSameach: "Or Sameach",
  avodatHaMelekh: "Avodat HaMelekh",
  evenHaAzel: "Even HaAzel",
  mishnahBerurah: "Mishnah Berurah",
  shaareiTeshuvah: "Shaarei Teshuvah",
  biurHalakha: "Biur Halakha",
  shakh: "Shakh",
  taz: "Taz",
  chelkatMechokek: "Chelkat Mechokek",
  beitShmuel: "Beit Shmuel",
  meiratEinayim: "Me'irat Einayim",
  pitcheiTeshuvah: "Pitchei Teshuvah",
  baerHetev: "Ba'er Hetev",
  beurHagraSA: "Beur HaGra",
  kafHaChaim: "Kaf HaChayim",
  magenAvraham: "Magen Avraham",
  eliyaRabbah: "Eliyah Rabbah",
  priMegadimOC: "Peri Megadim",
  priMegadimYD: "Peri Megadim",
  nekudatHaKesef: "Nekudat HaKesef",
  keretiUPeleti: "Kereti u'Peleti",
  toratHaShlamim: "Torat HaShlamim",
  beitMeir: "Beit Meir",
  ezerMiKodesh: "Ezer MiKodesh",
  ktzotHaChoshen: "Ktzot HaChoshen",
  netivotHaMishpat: "Netivot HaMishpat",
  urimVTumim: "Urim v'Tumim",
  hagahotRAE: "Hagahot R. Akiva Eiger",
};

export const hebrewDisplayName: Record<CommentaryType, string> = {
  onkelos: "אונקלוס",
  rashiTanakh: "רש״י",
  rashiTalmud: "רש״י",
  ramban: "רמב״ן",
  ibnEzra: "אבן עזרא",
  abarbanel: "אברבנאל",
  rashbam: "רשב״ם",
  rashbamTalmud: "רשב״ם",
  sforno: "ספורנו",
  haKtavVeHaKabalah: "הכתב והקבלה",
  haamekDavar: "העמק דבר + הרחב דבר",
  harchevDavar: "הרחב דבר",
  kliYakar: "כלי יקר",
  malbim: "מלבי״ם",
  meshechChokhmah: "משך חכמה",
  orHaChaim: "אור החיים",
  ravHirsch: "רב הירש",
  shadal: "שד״ל",
  torahTemimah: "תורה תמימה",
  cassutoGenesis: "קאסוטו (בראשית)",
  cassutoExodus: "קאסוטו (שמות)",
  hoffmannExodus: "הופמן (שמות)",
  hoffmannLeviticus: "הופמן (ויקרא)",
  jonathanSacks: "הרב סקס",
  nechamaLeibowitz: "נחמה ליבוביץ",
  radak: "רד״ק",
  ralbag: "רלב״ג",
  alshich: "אלשיך",
  metzudatZion: "מצודת ציון",
  rishonLeTzion: "אור החיים",
  targumYonatan: "תרגום יונתן",
  targumKetuvim: "תרגום",
  metzudatDavid: "מצודת דוד",
  rambamMishnah: "רמב״ם",
  bartenura: "ברטנורא",
  tosafotYomTov: "תוספות יו״ט",
  rashMiShantz: "ר״ש מסנץ",
  melekhetShlomo: "מלאכת שלמה",
  tosafotRabbiAkivaEiger: "תוספות ר׳ עקיבא איגר",
  yeshSederLaMishnah: "יש סדר למשנה",
  mishnatEretzYisrael: "משנת ארץ ישראל",
  englishExplanation: "קולפ (אנגלית)",
  rashash: "רש״ש",
  yachin: "יכין + בועז",
  boaz: "בועז",
  raavad: "ראב״ד",
  gra: "אליהו רבה (גר״א)",
  rabbeinuYonah: "רבינו יונה",
  derekhChayyim: "דרך חיים (מהר״ל)",
  nachalatAvot: "נחלת אבות (אברבנאל)",
  ranNedarim: "ר״ן",
  rabbeinuChananel: "רבינו חננאל",
  rabbeinuGershom: "רבינו גרשם",
  ran: "ר״ן (חידושים)",
  ravNissimGaon: "רב ניסים גאון",
  mefareshTamid: "פסאודו-רש״י (תמיד)",
  chiddusheiRamban: "רמב״ן",
  rashba: "רשב״א",
  ritva: "ריטב״א",
  meiri: "מאירי",
  shitaMekubetzet: "שיטה מקובצת",
  raah: "ר״אה",
  yadRamah: "יד רמה",
  riMigash: "ר״י מיגאש",
  chiddusheiHaRambam: "רמב״ם",
  tosafotHaRosh: "תוספות הרא״ש",
  tosafotRid: "תוספות ר״י",
  tosafotShantz: "תוספות שאנץ",
  tosafotYeshanim: "תוספות ישנים",
  piskeiTosafot: "פסקי תוספות",
  commentaryOfTheRosh: "פירוש הרא״ש",
  tosafot: "תוספות",
  maharsha: "מהרש״א",
  maharam: "מהר״ם",
  chokhmatShlomo: "חכמת שלמה",
  rAbbiAkivaEiger: "ר׳ עקיבא איגר",
  peneiYehoshua: "פני יהושע",
  haflaahKetubot: "האפלה",
  tzlach: "צל״ח",
  chatamSofer: "חתם סופר",
  arukhLaNer: "ערוך לנר",
  reshimotShiurim: "רשימות שיעורים (הגרי״ד)",
  einAyah: "עין איה (הראי״ה קוק)",
  peneiMoshe: "פני משה",
  mareyHaPanim: "מראה הפנים",
  ohrLayesharim: "אור לישרים",
  toseftaKifshutah: "תוספתא כפשוטה",
  briefCommentary: "פירוש קצר (ליברמן)",
  maggidMishnah: "מגיד משנה",
  kesefMishnah: "כסף משנה",
  migdalOz: "מגדל עוז",
  lochemMishnah: "לחם משנה",
  mishnahLaMelech: "משנה למלך",
  mahariKurkusRadbaz: "מהרי קורקוס ורדב״ז",
  kiryatSefer: "קרית ספר",
  maasehRokeach: "מעשה רוקח",
  orSameach: "אור שמח",
  avodatHaMelekh: "עבודת המלך",
  evenHaAzel: "אבן האזל",
  mishnahBerurah: "משנה ברורה",
  shaareiTeshuvah: "שערי תשובה",
  biurHalakha: "ביאור הלכה",
  shakh: "ש״ך",
  taz: "ט״ז",
  chelkatMechokek: "חלקת מחוקק",
  beitShmuel: "בית שמואל",
  meiratEinayim: "מאירת עיניים (סמ״ע)",
  pitcheiTeshuvah: "פתחי תשובה",
  baerHetev: "באר היטב",
  beurHagraSA: "ביאור הגר״א",
  kafHaChaim: "כף החיים",
  magenAvraham: "מגן אברהם",
  eliyaRabbah: "אליה רבה",
  priMegadimOC: "פרי מגדים",
  priMegadimYD: "פרי מגדים",
  nekudatHaKesef: "נקודת הכסף",
  keretiUPeleti: "כרתי ופלתי",
  toratHaShlamim: "תורת השלמים",
  beitMeir: "בית מאיר",
  ezerMiKodesh: "עזר מקודש",
  ktzotHaChoshen: "קצות החושן",
  netivotHaMishpat: "נתיבות המשפט",
  urimVTumim: "אורים ותומים",
  hagahotRAE: "הגהות ר׳ עקיבא איגר",
};

// MARK: - Sefaria ref building

const torahBookNames = new Set(["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]);

/** Extracts the trailing chapter/number from a ref like "Genesis 5" -> "5". */
function extractChapter(ref: string): string {
  const parts = ref.split(" ");
  return parts[parts.length - 1] ?? "1";
}

/** Extracts just the book name from a ref like "Song of Songs 3" -> "Song of Songs". */
function extractBookName(ref: string): string {
  return ref.split(" ").slice(0, -1).join(" ");
}

/**
 * Abarbanel on Torah uses the combined title "Abarbanel on Torah, Genesis 1";
 * Abarbanel on Nakh books uses individual titles "Abarbanel on Joshua 1".
 */
function abarbanalRef(mainRef: string): string {
  const book = extractBookName(mainRef);
  if (torahBookNames.has(book)) return `Abarbanel on Torah, ${mainRef}`;
  return `Abarbanel on ${mainRef}`;
}

/**
 * Ralbag on Torah uses the combined title "Ralbag on Torah, Genesis 1".
 * Nakh books use "Ralbag on Joshua 1" etc., except Ruth and Esther which
 * drop the "on": "Ralbag Ruth 1" / "Ralbag Esther 1".
 */
function ralbagRef(mainRef: string): string {
  const book = extractBookName(mainRef);
  if (torahBookNames.has(book)) return `Ralbag on Torah, ${mainRef}`;
  if (book === "Ruth" || book === "Esther") return `Ralbag ${mainRef}`;
  return `Ralbag on ${mainRef}`;
}

/** Alshich's Nakh commentaries each have a unique Hebrew title per book. */
function alshichRef(mainRef: string): string {
  const book = extractBookName(mainRef);
  const parts = mainRef.split(" ");
  const chapter = parts[parts.length - 1] ?? "1";
  const titleMap: Record<string, string> = {
    Joshua: "Marot HaTzoveot on Joshua",
    Judges: "Marot HaTzoveot on Judges",
    "I Samuel": "Marot HaTzoveot on I Samuel",
    "II Samuel": "Marot HaTzoveot on II Samuel",
    "I Kings": "Marot HaTzoveot on I Kings",
    "II Kings": "Marot HaTzoveot on II Kings",
    Psalms: "Romemot El on Psalms",
    Proverbs: "Rav Peninim on Proverbs",
    Job: "Chelkat Mechokek on Job",
    "Song of Songs": "Shoshanat HaAmakim on Song of Songs",
    Ruth: "Einei Moshe on Ruth",
    Lamentations: "Devarim Nichumim on Lamentations",
    Ecclesiastes: "Devarim Tovim on Ecclesiastes",
    Esther: "Masat Moshe on Esther",
    Daniel: "Chavatzelet HaSharon on Daniel",
  };
  const title = titleMap[book];
  if (title) return `${title} ${chapter}`;
  return `Alshich on ${mainRef}`; // fallback (e.g. Torah if ever added)
}

/**
 * Meshekh Chokhmah uses Hebrew parasha names instead of English book names.
 * mainRef is like "Genesis 1"; result is like "Meshekh Chokhmah, Bereshit 1".
 */
function meshechChokhmahRef(mainRef: string): string {
  const hebrewNames: Record<string, string> = {
    Genesis: "Bereshit", Exodus: "Shemot", Leviticus: "Vayikra",
    Numbers: "Bamidbar", Deuteronomy: "Devarim",
  };
  const parts = mainRef.split(" ");
  const heBook = parts.length >= 2 ? hebrewNames[parts[0]] : undefined;
  if (!heBook) return `Meshekh Chokhmah, ${mainRef}`;
  const chapter = parts.slice(1).join(" ");
  return `Meshekh Chokhmah, ${heBook} ${chapter}`;
}

/** Maaseh Rokeach omits "Mishneh Torah, " from its prefix on Sefaria. */
function maasehRokeachRef(mainRef: string): string {
  const stripped = mainRef.replace("Mishneh Torah, ", "");
  return `Maaseh Rokeach on ${stripped}`;
}

/** Cassuto on Genesis is split by chapter range into two sub-books. */
function cassutoGenesisRef(mainRef: string): string {
  const chapter = parseInt(extractChapter(mainRef), 10) || 1;
  const section = chapter <= 11 ? "From Adam to Noah" : "From Noah to Abraham";
  return `Cassuto on Genesis, ${section} ${chapter}`;
}

/** Shita Mekubbetzet on Nedarim uses double-b spelling on Sefaria; all others use single-b. */
function shitaMekubetzetRef(mainRef: string): string {
  return mainRef.startsWith("Nedarim")
    ? `Shita Mekubbetzet on ${mainRef}`
    : `Shita Mekubetzet on ${mainRef}`;
}

function mishnahBerurahRef(mainRef: string): string {
  const m = mainRef.match(/(\d+)$/);
  return m ? `Mishnah Berurah ${m[1]}` : "Mishnah Berurah 1";
}

function magenAvrahamRef(mainRef: string): string {
  const m = mainRef.match(/(\d+)$/);
  return m ? `Magen Avraham ${m[1]}` : "Magen Avraham 1";
}

function biurHalakhaRef(mainRef: string): string {
  const m = mainRef.match(/(\d+)$/);
  // Biur Halakha is depth-3 (Siman -> Seif -> Comment); bare siman ref returns only seif 1.
  return m ? `Biur Halakha ${m[1]}:1-50` : "Biur Halakha 1:1-50";
}

/** Returns the Sefaria ref for this commentary given the main text ref. */
export function sefariaRef(type: CommentaryType, mainRef: string): string {
  switch (type) {
    case "onkelos": return `Onkelos ${mainRef}`;
    case "rashiTanakh":
    case "rashiTalmud": return `Rashi on ${mainRef}`;
    case "ramban": return `Ramban on ${mainRef}`;
    case "ibnEzra": return `Ibn Ezra on ${mainRef}`;
    case "abarbanel": return abarbanalRef(mainRef);
    case "rashbam": return `Rashbam on ${mainRef}`;
    case "sforno": return `Sforno on ${mainRef}`;
    case "haKtavVeHaKabalah": return `HaKtav VeHaKabalah, ${mainRef}`;
    case "haamekDavar": return `Haamek Davar on ${mainRef}`;
    case "harchevDavar": return `Harchev Davar on ${mainRef}`;
    case "kliYakar": return `Kli Yakar on ${mainRef}`;
    case "malbim": return `Malbim on ${mainRef}`;
    case "meshechChokhmah": return meshechChokhmahRef(mainRef);
    case "orHaChaim": return `Or HaChaim on ${mainRef}`;
    case "ravHirsch": return `Rav Hirsch on Torah, ${mainRef}`;
    case "shadal": return `Shadal on ${mainRef}`;
    case "torahTemimah": return `Torah Temimah on Torah, ${mainRef}`;
    case "cassutoGenesis": return cassutoGenesisRef(mainRef);
    case "cassutoExodus": return `Cassuto on Exodus ${extractChapter(mainRef)}`;
    case "hoffmannExodus": return `David Zvi Hoffmann on Exodus ${extractChapter(mainRef)}`;
    case "hoffmannLeviticus": return `David Zvi Hoffmann on Leviticus ${extractChapter(mainRef)}`;
    case "jonathanSacks": return `Jonathan Sacks Torah Commentary on ${mainRef}`;
    case "nechamaLeibowitz": return `Nechama Leibowitz on ${mainRef}`;
    case "radak": return `Radak on ${mainRef}`;
    case "ralbag": return ralbagRef(mainRef);
    case "alshich": return alshichRef(mainRef);
    case "metzudatZion": return `Metzudat Zion on ${mainRef}`;
    case "rishonLeTzion": return `Rishon LeTzion on ${mainRef}`;
    case "targumYonatan": return `Targum Jonathan on ${mainRef}`;
    case "targumKetuvim": return `Targum ${mainRef}`;
    case "metzudatDavid": return `Metzudat David on ${mainRef}`;
    case "rambamMishnah": return `Rambam on ${mainRef}`;
    case "bartenura": return `Bartenura on ${mainRef}`;
    case "tosafotYomTov": return `Tosafot Yom Tov on ${mainRef}`;
    case "rashMiShantz": return `Rash MiShantz on ${mainRef}`;
    case "melekhetShlomo": return `Melekhet Shelomoh on ${mainRef}`;
    case "tosafotRabbiAkivaEiger": return `Tosafot Rabbi Akiva Eiger on ${mainRef}`;
    case "yeshSederLaMishnah": return `Yesh Seder LaMishnah on ${mainRef}`;
    case "mishnatEretzYisrael": return `Mishnat Eretz Yisrael on ${mainRef}`;
    case "englishExplanation": return `English Explanation of ${mainRef}`;
    case "rashash": return `Rashash on ${mainRef}`;
    case "yachin": return `Yachin on ${mainRef}`;
    case "boaz": return `Boaz on ${mainRef}`;
    case "raavad": return `Ra'avad on ${mainRef}`;
    // Gra on Avot: "Gra on Pirkei Avot X"; on Taharot: "Eliyahu Rabbah on Mishnah X Y"
    case "gra":
      return mainRef.startsWith("Pirkei Avot")
        ? `Gra on ${mainRef}`
        : `Eliyahu Rabbah on ${mainRef}`;
    case "rabbeinuYonah": return `Rabbeinu Yonah on ${mainRef}`;
    case "derekhChayyim": return `Derekh Chayyim ${extractChapter(mainRef)}`;
    case "nachalatAvot": return `Nachalat Avot on Avot ${extractChapter(mainRef)}`;
    case "ranNedarim": return `Ran on ${mainRef}`;
    case "rabbeinuChananel": return `Rabbeinu Chananel on ${mainRef}`;
    case "rabbeinuGershom": return `Rabbeinu Gershom on ${mainRef}`;
    case "rashbamTalmud": return `Rashbam on ${mainRef}`;
    case "ran": return `Ran on ${mainRef}`;
    case "ravNissimGaon": return `Rav Nissim Gaon on ${mainRef}`;
    case "mefareshTamid": return `Mefaresh on ${mainRef}`;
    case "chiddusheiRamban": return `Chiddushei Ramban on ${mainRef}`;
    case "rashba": return `Rashba on ${mainRef}`;
    case "ritva": return `Ritva on ${mainRef}`;
    case "meiri": return `Meiri on ${mainRef}`;
    case "shitaMekubetzet": return shitaMekubetzetRef(mainRef);
    case "raah": return `Chiddushei HaRa'ah on ${mainRef}`;
    case "yadRamah": return `Yad Ramah on ${mainRef}`;
    case "riMigash": return `Ri Migash on ${mainRef}`;
    case "chiddusheiHaRambam": return `Chiddushei HaRambam on ${mainRef}`;
    case "tosafotHaRosh": return `Tosafot HaRosh on ${mainRef}`;
    case "tosafotRid": return `Tosafot Rid on ${mainRef}`;
    case "tosafotShantz": return `Tosafot Shantz on ${mainRef}`;
    case "tosafotYeshanim": return `Tosafot Yeshanim on ${mainRef}`;
    case "piskeiTosafot": return `Piskei Tosafot on ${mainRef}`;
    case "commentaryOfTheRosh": return `Commentary of the Rosh on ${mainRef}`;
    case "maharsha": return `Chidushei Halachot on ${mainRef}`;
    case "maharam": return `Maharam on ${mainRef}`;
    case "chokhmatShlomo": return `Chokhmat Shlomo on ${mainRef}`;
    case "rAbbiAkivaEiger": return `Gilyon HaShas on ${mainRef}`;
    case "peneiYehoshua": return `Penei Yehoshua on ${mainRef}`;
    case "haflaahKetubot": return `Haflaah on ${mainRef}`;
    case "tzlach": return `Tziyyun LeNefesh Chayyah on ${mainRef}`;
    case "chatamSofer": return `Chidushei Chatam Sofer on ${mainRef}`;
    case "arukhLaNer": return `Arukh LaNer on ${mainRef}`;
    case "reshimotShiurim": return `Reshimot Shiurim on ${mainRef}`;
    case "einAyah": return ""; // bundled — never fetched from Sefaria
    case "peneiMoshe": return `Penei Moshe on ${mainRef}`;
    case "mareyHaPanim": return `Mareh HaPanim on ${mainRef}`;
    case "ohrLayesharim": return `Ohr LaYesharim on ${mainRef}`;
    case "toseftaKifshutah": {
      // Sefaria ref omits "Tosefta " prefix: "Tosefta Kifshutah on Berakhot 1"
      const r = mainRef.startsWith("Tosefta ") ? mainRef.slice("Tosefta ".length) : mainRef;
      return `Tosefta Kifshutah on ${r}`;
    }
    case "briefCommentary": {
      const r = mainRef.startsWith("Tosefta ") ? mainRef.slice("Tosefta ".length) : mainRef;
      return `Brief Commentary on ${r}`;
    }
    case "tosafot": return `Tosafot on ${mainRef}`;
    case "maggidMishnah": return `Maggid Mishneh on ${mainRef}`;
    case "kesefMishnah": return `Kessef Mishneh on ${mainRef}`;
    case "migdalOz": return `Migdal Oz on ${mainRef}`;
    case "lochemMishnah": return `Lechem Mishneh on ${mainRef}`;
    case "mishnahLaMelech": return `Mishneh LaMelech on ${mainRef}`;
    case "mahariKurkusRadbaz": return `Commentary of Mahari Kurkus and Radbaz on ${mainRef}`;
    case "kiryatSefer": return `Kiryat Sefer on ${mainRef}`;
    case "maasehRokeach": return maasehRokeachRef(mainRef);
    case "orSameach": return `Ohr Sameach on ${mainRef}`;
    case "avodatHaMelekh": return `Avodat HaMelekh on ${mainRef}`;
    case "evenHaAzel": return `Even Ha'azel on ${mainRef}`;
    case "mishnahBerurah": return mishnahBerurahRef(mainRef);
    case "shaareiTeshuvah": return `Sha'arei Teshuvah on ${mainRef}`;
    case "biurHalakha": return biurHalakhaRef(mainRef);
    case "shakh": return `Siftei Kohen on ${mainRef}`;
    case "taz": return `Turei Zahav on ${mainRef}`;
    case "chelkatMechokek": return `Chelkat Mechokek on ${mainRef}`;
    case "beitShmuel": return `Beit Shmuel on ${mainRef}`;
    case "meiratEinayim": return `Me'irat Einayim on ${mainRef}`;
    case "pitcheiTeshuvah": return `Pitchei Teshuva on ${mainRef}`;
    case "baerHetev": return `Ba'er Hetev on ${mainRef}`;
    case "beurHagraSA": return `Beur HaGra on ${mainRef}`;
    case "kafHaChaim": return `Kaf HaChayim on ${mainRef}`;
    case "magenAvraham": return magenAvrahamRef(mainRef);
    case "eliyaRabbah": return `Eliyah Rabbah on ${mainRef}`;
    case "priMegadimOC": return `Peri Megadim on Orach Chayim, Mishbezot Zahav ${extractChapter(mainRef)}`;
    case "nekudatHaKesef": return `Nekudot HaKesef on ${mainRef}`;
    case "priMegadimYD": return `Peri Megadim on Yoreh De'ah, Mishbezot Zahav ${extractChapter(mainRef)}`;
    case "keretiUPeleti": return `Kereti on ${mainRef}`;
    case "toratHaShlamim": return `Torat HaShlamim on ${mainRef}`;
    case "beitMeir": return `Beit Meir on ${mainRef}`;
    case "ezerMiKodesh": return `Ezer MiKodesh on ${mainRef}`;
    case "ktzotHaChoshen": return `Ketzot HaChoshen on ${mainRef}`;
    case "netivotHaMishpat":
      return `Netivot HaMishpat, Hidushim on Shulchan Arukh, Choshen Mishpat ${extractChapter(mainRef)}`;
    case "urimVTumim": return `Urim VeTumim, Urim ${extractChapter(mainRef)}`;
    case "hagahotRAE": return `Rabbi Akiva Eiger on ${mainRef}`;
  }
}

// MARK: - Multi-version refs

/**
 * True when this commentator combines two different books in one screen.
 * These get the prominent bookDivider separator; Tosafot Rid (different recensions
 * of the same book) uses the subtler recensionHeader instead.
 */
export function usesBookDivider(type: CommentaryType): boolean {
  switch (type) {
    case "haamekDavar":
    case "yachin":
    case "maharsha":
    case "rAbbiAkivaEiger":
    case "priMegadimOC":
    case "priMegadimYD":
    case "keretiUPeleti":
    case "netivotHaMishpat":
    case "urimVTumim":
      return true;
    default:
      return false;
  }
}

export interface RefVersion {
  ref: string;
  label: string | null;
}

/**
 * Returns all (ref, optionalLabel) pairs needed to fetch this commentary for the given
 * main ref. For most commentaries this is a single pair with a null label. For commentators
 * that combine multiple sub-works (Tosafot Rid recensions, Maharsha Halachot+Agadot, etc.)
 * multiple pairs are returned; label carries the Hebrew header the UI inserts as a separator.
 */
export function sefariaRefVersions(type: CommentaryType, mainRef: string): RefVersion[] {
  switch (type) {
    case "tosafotRid": return tosafotRidRefs(mainRef);
    case "haamekDavar": return [
      { ref: `Haamek Davar on ${mainRef}`, label: "Ha'amek Davar" },
      { ref: `Harchev Davar on ${mainRef}`, label: "Harchev Davar" },
    ];
    case "yachin": return [
      { ref: `Yachin on ${mainRef}`, label: "Yachin" },
      { ref: `Boaz on ${mainRef}`, label: "Boaz" },
    ];
    case "maharsha": return maharshaRefs(mainRef);
    case "rAbbiAkivaEiger": return rAbbiAkivaEigerRefs(mainRef);
    case "priMegadimOC": {
      const siman = extractChapter(mainRef);
      return [
        { ref: `Peri Megadim on Orach Chayim, Mishbezot Zahav ${siman}`, label: "משבצות זהב" },
        { ref: `Peri Megadim on Orach Chayim, Eshel Avraham ${siman}`, label: "אשל אברהם" },
      ];
    }
    case "priMegadimYD": {
      const siman = extractChapter(mainRef);
      return [
        { ref: `Peri Megadim on Yoreh De'ah, Mishbezot Zahav ${siman}`, label: "משבצות זהב" },
        { ref: `Peri Megadim on Yoreh De'ah, Siftei Da'at ${siman}`, label: "שפתי דעת" },
      ];
    }
    case "keretiUPeleti": return [
      { ref: `Kereti on ${mainRef}`, label: "כרתי" },
      { ref: `Peleti on ${mainRef}`, label: "פלתי" },
    ];
    case "netivotHaMishpat": {
      const siman = extractChapter(mainRef);
      return [
        { ref: `Netivot HaMishpat, Hidushim on Shulchan Arukh, Choshen Mishpat ${siman}`, label: "חידושים" },
        { ref: `Netivot HaMishpat, Beurim on Shulchan Arukh, Choshen Mishpat ${siman}`, label: "ביאורים" },
      ];
    }
    case "urimVTumim": {
      const siman = extractChapter(mainRef);
      return [
        { ref: `Urim VeTumim, Urim ${siman}`, label: "אורים" },
        { ref: `Urim VeTumim, Tumim ${siman}`, label: "תומים" },
      ];
    }
    default:
      return [{ ref: sefariaRef(type, mainRef), label: null }];
  }
}

/** Maharsha: Chiddushei Halachot + Chiddushei Agadot, interleaved with Hebrew headers. */
function maharshaRefs(mainRef: string): RefVersion[] {
  const book = extractBookName(mainRef);
  const agadotOnly = new Set(["Nazir", "Zevachim", "Arakhin", "Temurah", "Keritot", "Meilah", "Tamid"]);
  if (agadotOnly.has(book)) return [{ ref: `Chidushei Agadot on ${mainRef}`, label: null }];
  return [
    { ref: `Chidushei Halachot on ${mainRef}`, label: "חידושי הלכות" },
    { ref: `Chidushei Agadot on ${mainRef}`, label: "חידושי אגדות" },
  ];
}

/** R. Akiva Eiger: Gilyon HaShas + Chiddushim, interleaved with Hebrew headers. */
function rAbbiAkivaEigerRefs(mainRef: string): RefVersion[] {
  const book = extractBookName(mainRef);
  const chiddusheiMissing = new Set([
    "Sotah", "Sanhedrin", "Horayot", "Menachot",
    "Bekhorot", "Arakhin", "Keritot", "Meilah", "Niddah",
  ]);
  if (chiddusheiMissing.has(book)) return [{ ref: `Gilyon HaShas on ${mainRef}`, label: null }];
  return [
    { ref: `Gilyon HaShas on ${mainRef}`, label: "גליון הש\"ס" },
    { ref: `Chiddushei Rabbi Akiva Eiger on ${mainRef}`, label: "חידושי ר' עקיבא איגר" },
  ];
}

/**
 * Builds the ordered list of (ref, label) pairs for Tosafot Rid.
 * mainRef for Talmud has the form "{tractate} {daf}", e.g. "Avodah Zarah 5".
 */
function tosafotRidRefs(mainRef: string): RefVersion[] {
  if (mainRef.startsWith("Avodah Zarah")) {
    const daf = mainRef.slice("Avodah Zarah".length); // " 5"
    return [
      { ref: `Tosafot Rid on Avodah Zarah First Recension${daf}`, label: "מהדורא קמא" },
      { ref: `Tosafot Rid on Avodah Zarah Second Recension${daf}`, label: "מהדורא תניינא" },
      { ref: `Tosafot Rid on Avodah Zarah Third Recension${daf}`, label: "מהדורא תליתא" },
    ];
  } else if (mainRef.startsWith("Megillah")) {
    const daf = mainRef.slice("Megillah".length);
    return [
      { ref: `Tosafot Rid on Megillah First Recension${daf}`, label: "מהדורא קמא" },
      { ref: `Tosafot Rid on Megillah Second Recension${daf}`, label: "מהדורא תניינא" },
    ];
  } else if (mainRef.startsWith("Eruvin")) {
    const daf = mainRef.slice("Eruvin".length);
    // Only Second Recension exists on Sefaria for Eruvin
    return [{ ref: `Tosafot Rid on Eruvin Second Recension${daf}`, label: null }];
  }
  return [{ ref: `Tosafot Rid on ${mainRef}`, label: null }];
}

// MARK: - Availability filters

/** Returns whether this commentary has known content for the given Rambam work ID (0-based). */
export function isAvailableForRambam(type: CommentaryType, workId: number): boolean {
  switch (type) {
    case "migdalOz":
      // Covers Madda-Haflaah (0-28) + Nezikin-Shoftim (48-67).
      return workId < 29 || (workId >= 48 && workId <= 67);
    case "mahariKurkusRadbaz":
      // Sefer Avodah only: Beit HaBechirah (34), Klei HaMikdash (35), Bi'at HaMikdash (36)
      return workId === 34 || workId === 35 || workId === 36;
    case "avodatHaMelekh":
      return workId <= 4; // Sefer HaMadda only
    case "evenHaAzel": {
      const missing = new Set([2, 4, 10, 25, 26, 27, 28, 30, 31, 32, 33]);
      return !missing.has(workId);
    }
    default:
      return true;
  }
}

/**
 * Returns whether this commentary has known content for the given Tanakh book index.
 * Used to filter the picker so only relevant options are shown for the current book.
 */
export function isAvailableForTanakhBook(type: CommentaryType, bookIndex: number): boolean {
  switch (type) {
    // Torah-only commentaries
    case "onkelos": case "rashbam": case "sforno": case "haKtavVeHaKabalah":
    case "haamekDavar": case "harchevDavar": case "kliYakar": case "meshechChokhmah":
    case "orHaChaim": case "ravHirsch": case "shadal": case "torahTemimah":
    case "nechamaLeibowitz": case "jonathanSacks":
      return bookIndex <= 4;

    case "cassutoGenesis": return bookIndex === 0;
    case "cassutoExodus":
    case "hoffmannExodus": return bookIndex === 1;
    case "hoffmannLeviticus": return bookIndex === 2;
    case "malbim": return bookIndex !== 2;

    case "rishonLeTzion": return bookIndex >= 5;
    case "targumYonatan": return bookIndex >= 5 && bookIndex <= 25;
    case "metzudatDavid":
    case "metzudatZion": return bookIndex >= 5;
    case "targumKetuvim": return bookIndex >= 26;

    case "ibnEzra": {
      const covered = new Set([
        0, 1, 2, 3, 4, // Torah
        11, // Isaiah
        14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, // 12 Minor Prophets
        26, 28, 29, 32, 33, // Psalms, Job, Song, Ecclesiastes, Esther
      ]);
      return covered.has(bookIndex);
    }
    case "ralbag": {
      const covered = new Set([
        0, 1, 2, 3, 4,
        5, 6, 7, 8, 9, 10,
        27, 28, 29, 30, 32, 33,
      ]);
      return covered.has(bookIndex);
    }
    case "alshich": {
      const covered = new Set([
        5, 6, 7, 8, 9, 10,
        26, 27, 28, 29, 30, 31, 32, 33, 34,
      ]);
      return covered.has(bookIndex);
    }
    default:
      return true;
  }
}

/** Returns whether this commentary has known content on Sefaria for the given tractate. */
export function isAvailableForTalmud(type: CommentaryType, tractateId: number): boolean {
  switch (type) {
    case "rabbeinuChananel":
      return new Set([1, 3, 5, 6, 8, 9, 11, 20, 21, 23, 24, 26]).has(tractateId);
    case "rabbeinuGershom":
      return tractateId === 22 || tractateId === 24;
    case "rashbamTalmud":
      return tractateId === 3 || tractateId === 22;
    case "ranNedarim":
      return tractateId === 15;
    case "ran":
      return new Set([1, 3, 8, 14, 18, 19]).has(tractateId);
    case "ravNissimGaon":
      return tractateId === 0 || tractateId === 1;
    case "mefareshTamid":
      return tractateId === 36;
    case "raah":
      return tractateId === 14;
    case "yadRamah":
      return tractateId === 22 || tractateId === 23;
    case "riMigash":
      return tractateId === 22 || tractateId === 25;
    case "chiddusheiHaRambam":
      return tractateId === 8;
    case "tosafotHaRosh":
      return tractateId === 0;
    case "tosafotRid":
      return new Set([1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,18,19,20,21,22,26,39]).has(tractateId);
    case "tosafotShantz":
      return tractateId === 17;
    case "tosafotYeshanim":
      return new Set([5, 13, 34]).has(tractateId);
    case "commentaryOfTheRosh":
      return new Set([15, 16, 36]).has(tractateId);
    case "chiddusheiRamban":
      return new Set([0,1,2,3,5,6,7,8,9,10,11,12,13,14,16,17,18,19,21,22,23,24,25,26,30,39]).has(tractateId);
    case "rashba":
      return new Set([0,1,2,7,8,10,13,14,15,18,19,20,21,22,25,26,29,30,39]).has(tractateId);
    case "ritva":
      return new Set([0,2,3,5,6,8,9,10,11,13,14,15,19,24,25,26,30,39]).has(tractateId);
    case "meiri":
      return new Set([0,1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,30,36,39]).has(tractateId);
    case "shitaMekubetzet":
      return new Set([0,7,14,15,16,17,20,21,22]).has(tractateId);
    case "piskeiTosafot":
      return new Set([0,1,2,3,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,26,28,29,30,31,32,33,34,35,36,39]).has(tractateId);
    // Standard Acharonim
    case "maharsha":
      return tractateId !== 4; // all Bavli except Shekalim (Yerushalmi only)
    case "maharam":
      return new Set([1,2,3,6,7,13,14,18,19,20,21,22,23,24,26,30,39]).has(tractateId);
    case "rAbbiAkivaEiger":
      return tractateId !== 4 && tractateId !== 36;
    case "rashash":
      return tractateId !== 4 && tractateId !== 36;
    // Additional Acharonim
    case "peneiYehoshua":
      return new Set([0,1,3,5,6,7,8,10,14,18,19,20,21,24,25,30]).has(tractateId);
    case "haflaahKetubot":
      return tractateId === 14;
    case "tzlach":
      return new Set([0,1,2,8,9,10,12,28,29,30]).has(tractateId);
    case "chatamSofer":
      return new Set([1,3,6,7,10,14,15,18,20,21,22,23,25,26,30,39]).has(tractateId);
    case "arukhLaNer":
      return tractateId === 8 || tractateId === 23;
    case "reshimotShiurim":
      return new Set([0,6,13,15,19,20,21,23,25,27]).has(tractateId);
    case "einAyah":
      return tractateId === 0 || tractateId === 1;
    default:
      return true;
  }
}

/**
 * Returns whether this commentary has known content for the given Mishnah tractate.
 * sederIndex: 0=Zeraim, 1=Moed, 2=Nashim, 3=Nezikin, 4=Kodashim, 5=Taharot.
 * globalTractateId: the tractate's global id (0-62 matching TextCatalog).
 */
export function isAvailableForMishnah(
  type: CommentaryType,
  sederIndex: number,
  globalTractateId: number,
): boolean {
  switch (type) {
    case "rashMiShantz":
      return (sederIndex === 0 && globalTractateId !== 0) || sederIndex === 5;
    case "yeshSederLaMishnah":
      return sederIndex === 0 || sederIndex === 1;
    case "raavad":
      return globalTractateId === 2 || globalTractateId === 36 || globalTractateId === 50;
    case "gra":
      return globalTractateId === 38 || sederIndex === 5;
    case "rabbeinuYonah":
    case "derekhChayyim":
    case "nachalatAvot":
      return globalTractateId === 38;
    default:
      return true;
  }
}

/** Returns whether this commentary has content for the given Yerushalmi tractate (MishnahTractate.id). */
export function isAvailableForYerushalmi(type: CommentaryType, tractateId: number): boolean {
  switch (type) {
    case "peneiMoshe": return true;
    case "mareyHaPanim": return ![1, 15, 26, 27, 29].includes(tractateId);
    case "ohrLayesharim": return [0, 1, 14, 15, 16, 17, 18, 19, 20, 21, 22, 33].includes(tractateId);
    default: return false;
  }
}

/** Returns whether this commentary has content for the given Tosefta tractate (MishnahTractate.id). */
export function isAvailableForTosefta(type: CommentaryType, tractateId: number): boolean {
  switch (type) {
    case "toseftaKifshutah": return tractateId <= 32;
    case "briefCommentary": return tractateId <= 32 && ![13, 16, 29].includes(tractateId);
    default: return false;
  }
}
