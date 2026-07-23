import Foundation

// MARK: - Tanakh

struct TanakhSection {
    let name: String
    let hebrewName: String
    let books: [TanakhBook]
}

struct TanakhBook: Identifiable {
    let id: Int             // global index (0–38)
    let name: String        // Hebrew transliterated display name
    let hebrewName: String
    let sefariaName: String // exact title used in Sefaria API refs (English)
    let chapters: Int
}

// MARK: - Mishnah

struct MishnahSeder: Identifiable {
    let id: Int
    let name: String
    let hebrewName: String
    let tractates: [MishnahTractate]
}

struct MishnahTractate: Identifiable {
    let id: Int
    let name: String
    let hebrewName: String
    let sefariaName: String
    let chapters: Int
    let toseftaChapters: Int   // 0 = no Tosefta on Sefaria
    let yerushalmiChapters: Int // 0 = not in Yerushalmi
}

// MARK: - Talmud

struct TalmudSeder: Identifiable {
    let id: Int
    let name: String
    let hebrewName: String
    let tractates: [TalmudTractate]
}

struct TalmudTractate: Identifiable {
    let id: Int
    let name: String
    let hebrewName: String
    let sefariaName: String
    let startDaf: Int
    let endDaf: Int
    let mishnahOnly: Bool
    let isYerushalmi: Bool
}

// MARK: - Rambam (Mishneh Torah)

struct RambamSefer: Identifiable {
    let id: Int
    let name: String
    let hebrewName: String
    let works: [RambamWork]
}

struct RambamWork: Identifiable {
    let id: Int
    let name: String        // Hebrew transliterated display name
    let hebrewName: String
    let sefariaName: String // exact Sefaria title, e.g. "Mishneh Torah, Sabbath"
    let chapters: Int
}

// MARK: - Shulkhan Arukh

struct ShulchanArukh_Section: Identifiable {
    let id: Int
    let name: String
    let hebrewName: String
    let sefariaName: String
    let simanim: Int
}

// MARK: - TextCatalog

enum TextCatalog {

    // MARK: Tanakh

    static let tanakhSections: [TanakhSection] = [torahSection, neviiimSection, ketuvimSection]

    static let allTanakhBooks: [TanakhBook] =
        torahSection.books + neviiimSection.books + ketuvimSection.books

    private static let torahSection = TanakhSection(
        name: "Torah", hebrewName: "תורה",
        books: [
            book(0,  "Bereshit",          "בְּרֵאשִׁית",            "Genesis",         50),
            book(1,  "Shemot",            "שְׁמוֹת",                "Exodus",          40),
            book(2,  "Vayikra",           "וַיִּקְרָא",             "Leviticus",       27),
            book(3,  "Bamidbar",          "בְּמִדְבַּר",            "Numbers",         36),
            book(4,  "Devarim",           "דְּבָרִים",              "Deuteronomy",     34),
        ])

    private static let neviiimSection = TanakhSection(
        name: "Nevi'im", hebrewName: "נְבִיאִים",
        books: [
            book(5,  "Yehoshua",          "יְהוֹשֻׁעַ",             "Joshua",          24),
            book(6,  "Shoftim",           "שׁוֹפְטִים",             "Judges",          21),
            book(7,  "Shmuel I",          "שְׁמוּאֵל א",            "I Samuel",        31),
            book(8,  "Shmuel II",         "שְׁמוּאֵל ב",            "II Samuel",       24),
            book(9,  "Melakhim I",        "מְלָכִים א",             "I Kings",         22),
            book(10, "Melakhim II",       "מְלָכִים ב",             "II Kings",        25),
            book(11, "Yeshayahu",         "יְשַׁעְיָהוּ",           "Isaiah",          66),
            book(12, "Yirmiyahu",         "יִרְמְיָהוּ",            "Jeremiah",        52),
            book(13, "Yechezkel",         "יְחֶזְקֵאל",            "Ezekiel",         48),
            book(14, "Hoshea",            "הוֹשֵׁעַ",               "Hosea",           14),
            book(15, "Yoel",              "יוֹאֵל",                 "Joel",             4),
            book(16, "Amos",              "עָמוֹס",                 "Amos",             9),
            book(17, "Ovadiah",           "עוֹבַדְיָה",             "Obadiah",          1),
            book(18, "Yonah",             "יוֹנָה",                 "Jonah",            4),
            book(19, "Mikhah",            "מִיכָה",                 "Micah",            7),
            book(20, "Nachum",            "נַחוּם",                 "Nahum",            3),
            book(21, "Chavakuk",          "חֲבַקּוּק",              "Habakkuk",         3),
            book(22, "Tzefaniah",         "צְפַנְיָה",              "Zephaniah",        3),
            book(23, "Chaggai",           "חַגַּי",                 "Haggai",           2),
            book(24, "Zekharyah",         "זְכַרְיָה",              "Zechariah",       14),
            book(25, "Malakhi",           "מַלְאָכִי",              "Malachi",          3),
        ])

    private static let ketuvimSection = TanakhSection(
        name: "Ketuvim", hebrewName: "כְּתוּבִים",
        books: [
            book(26, "Tehillim",          "תְּהִלִּים",              "Psalms",         150),
            book(27, "Mishlei",           "מִשְׁלֵי",                "Proverbs",        31),
            book(28, "Iyov",              "אִיּוֹב",                 "Job",             42),
            book(29, "Shir HaShirim",    "שִׁיר הַשִּׁירִים",       "Song of Songs",    8),
            book(30, "Rut",               "רוּת",                    "Ruth",             4),
            book(31, "Eikha",             "אֵיכָה",                  "Lamentations",     5),
            book(32, "Kohelet",           "קֹהֶלֶת",                 "Ecclesiastes",    12),
            book(33, "Esther",            "אֶסְתֵּר",                "Esther",          10),
            book(34, "Daniel",            "דָּנִיֵּאל",              "Daniel",          12),
            book(35, "Ezra",              "עֶזְרָא",                 "Ezra",            10),
            book(36, "Nechemiah",         "נְחֶמְיָה",               "Nehemiah",        13),
            book(37, "Divrei HaYamim I",  "דִּבְרֵי הַיָּמִים א",    "I Chronicles",   29),
            book(38, "Divrei HaYamim II", "דִּבְרֵי הַיָּמִים ב",    "II Chronicles",  36),
        ])

    private static func book(_ id: Int, _ name: String, _ he: String, _ sefaria: String, _ ch: Int) -> TanakhBook {
        TanakhBook(id: id, name: name, hebrewName: he, sefariaName: sefaria, chapters: ch)
    }

    // MARK: Mishnah

    static let mishnahSedarim: [MishnahSeder] =
        zeraim_seder + moed_seder + nashim_seder + nezikin_seder + kodashim_seder + taharot_seder

    static let allMishnahTractates: [MishnahTractate] = mishnahSedarim.flatMap { $0.tractates }

    private static let zeraim_seder = [MishnahSeder(id: 0, name: "Zeraim", hebrewName: "זְרָעִים", tractates: [
        mt(0,  "Berakhot",    "בְּרָכוֹת",   "Mishnah Berakhot",     9, tosefta:  7, yerushalmi:  9),
        mt(1,  "Peah",        "פֵּאָה",       "Mishnah Peah",         8, tosefta:  4, yerushalmi:  8),
        mt(2,  "Demai",       "דְּמַאי",      "Mishnah Demai",        7, tosefta:  8, yerushalmi:  7),
        mt(3,  "Kilayim",     "כִּלְאַיִם",  "Mishnah Kilayim",      9, tosefta:  5, yerushalmi:  9),
        mt(4,  "Sheviit",     "שְׁבִיעִית",  "Mishnah Sheviit",     10, tosefta:  8, yerushalmi: 10),
        mt(5,  "Terumot",     "תְּרוּמוֹת",  "Mishnah Terumot",     11, tosefta: 10, yerushalmi: 11),
        mt(6,  "Maasrot",     "מַעַשְׂרוֹת", "Mishnah Maasrot",      5, tosefta:  3, yerushalmi:  5),
        mt(7,  "Maaser Sheni","מַעֲשֵׂר שֵׁנִי","Mishnah Maaser Sheni",5, tosefta:  5, yerushalmi:  5),
        mt(8,  "Challah",     "חַלָּה",      "Mishnah Challah",      4, tosefta:  2, yerushalmi:  4),
        mt(9,  "Orlah",       "עָרְלָה",     "Mishnah Orlah",        3, tosefta:  1, yerushalmi:  3),
        mt(10, "Bikkurim",    "בִּכּוּרִים", "Mishnah Bikkurim",     4, tosefta:  2, yerushalmi:  3),
    ])]

    private static let moed_seder = [MishnahSeder(id: 1, name: "Moed", hebrewName: "מוֹעֵד", tractates: [
        mt(11, "Shabbat",      "שַׁבָּת",     "Mishnah Shabbat",     24, tosefta: 18, yerushalmi: 24),
        mt(12, "Eruvin",       "עֵרוּבִין",   "Mishnah Eruvin",      10, tosefta:  8, yerushalmi: 10),
        mt(13, "Pesachim",     "פְּסָחִים",   "Mishnah Pesachim",    10, tosefta: 10, yerushalmi: 10),
        mt(14, "Shekalim",     "שְׁקָלִים",   "Mishnah Shekalim",     8, tosefta:  3, yerushalmi:  8),
        mt(15, "Yoma",         "יוֹמָא",      "Mishnah Yoma",         8, tosefta:  4, yerushalmi:  8),
        mt(16, "Sukkah",       "סוּכָּה",      "Mishnah Sukkah",       5, tosefta:  4, yerushalmi:  5),
        mt(17, "Beitzah",      "בֵּיצָה",     "Mishnah Beitzah",      5, tosefta:  4, yerushalmi:  5),
        mt(18, "Rosh Hashanah","רֹאשׁ הַשָּׁנָה","Mishnah Rosh Hashanah",4, tosefta: 2, yerushalmi:  4),
        mt(19, "Taanit",       "תַּעֲנִית",   "Mishnah Taanit",       4, tosefta:  3, yerushalmi:  4),
        mt(20, "Megillah",     "מְגִלָּה",    "Mishnah Megillah",     4, tosefta:  3, yerushalmi:  4),
        mt(21, "Moed Katan",   "מוֹעֵד קָטָן","Mishnah Moed Katan",   3, tosefta:  2, yerushalmi:  3),
        mt(22, "Chagigah",     "חֲגִיגָה",    "Mishnah Chagigah",     3, tosefta:  3, yerushalmi:  3),
    ])]

    private static let nashim_seder = [MishnahSeder(id: 2, name: "Nashim", hebrewName: "נָשִׁים", tractates: [
        mt(23, "Yevamot",    "יְבָמוֹת",    "Mishnah Yevamot",    16, tosefta: 14, yerushalmi: 16),
        mt(24, "Ketubot",    "כְּתֻבּוֹת",   "Mishnah Ketubot",    13, tosefta: 12, yerushalmi: 13),
        mt(25, "Nedarim",    "נְדָרִים",     "Mishnah Nedarim",    11, tosefta:  7, yerushalmi: 11),
        mt(26, "Nazir",      "נָזִיר",       "Mishnah Nazir",       9, tosefta:  6, yerushalmi:  9),
        mt(27, "Sotah",      "סוֹטָה",       "Mishnah Sotah",       9, tosefta: 15, yerushalmi:  9),
        mt(28, "Gittin",     "גִּיטִּין",    "Mishnah Gittin",      9, tosefta:  7, yerushalmi:  9),
        mt(29, "Kiddushin",  "קִדּוּשִׁין",  "Mishnah Kiddushin",   4, tosefta:  5, yerushalmi:  4),
    ])]

    private static let nezikin_seder = [MishnahSeder(id: 3, name: "Nezikin", hebrewName: "נְזִיקִין", tractates: [
        mt(30, "Bava Kamma",   "בָּבָא קַמָּא",  "Mishnah Bava Kamma",   10, tosefta: 11, yerushalmi: 10),
        mt(31, "Bava Metzia",  "בָּבָא מְצִיעָא","Mishnah Bava Metzia",  10, tosefta: 11, yerushalmi: 10),
        mt(32, "Bava Batra",   "בָּבָא בַּתְרָא", "Mishnah Bava Batra",   10, tosefta: 11, yerushalmi: 10),
        mt(33, "Sanhedrin",    "סַנְהֶדְרִין",    "Mishnah Sanhedrin",    11, tosefta: 14, yerushalmi: 11),
        mt(34, "Makkot",       "מַכּוֹת",         "Mishnah Makkot",        3, tosefta:  4, yerushalmi:  3),
        mt(35, "Shevuot",      "שְׁבוּעוֹת",      "Mishnah Shevuot",       8, tosefta:  6, yerushalmi:  8),
        mt(36, "Eduyot",       "עֵדֻיּוֹת",       "Mishnah Eduyot",        8, tosefta:  3, yerushalmi:  0),
        mt(37, "Avodah Zarah", "עֲבוֹדָה זָרָה",  "Mishnah Avodah Zarah",  5, tosefta:  9, yerushalmi:  5),
        mt(38, "Pirkei Avot",  "פִּרְקֵי אָבוֹת", "Pirkei Avot",           6, tosefta:  0, yerushalmi:  0),
        mt(39, "Horayot",      "הוֹרָיּוֹת",      "Mishnah Horayot",        3, tosefta:  2, yerushalmi:  3),
    ])]

    private static let kodashim_seder = [MishnahSeder(id: 4, name: "Kodashim", hebrewName: "קֳדָשִׁים", tractates: [
        mt(40, "Zevachim",   "זְבָחִים",   "Mishnah Zevachim",  14, tosefta: 13),
        mt(41, "Menachot",   "מְנָחוֹת",   "Mishnah Menachot",  13, tosefta: 13),
        mt(42, "Chullin",    "חוּלִּין",    "Mishnah Chullin",   12, tosefta: 10),
        mt(43, "Bekhorot",   "בְּכוֹרוֹת", "Mishnah Bekhorot",   9, tosefta:  7),
        mt(44, "Arakhin",    "עֲרָכִין",   "Mishnah Arakhin",    9, tosefta:  5),
        mt(45, "Temurah",    "תְּמוּרָה",  "Mishnah Temurah",    7, tosefta:  4),
        mt(46, "Keritot",    "כְּרִיתוֹת", "Mishnah Keritot",    6, tosefta:  4),
        mt(47, "Meilah",     "מְעִילָה",   "Mishnah Meilah",     6, tosefta:  3),
        mt(48, "Tamid",      "תָּמִיד",    "Mishnah Tamid",      7),
        mt(49, "Middot",     "מִדּוֹת",    "Mishnah Middot",     5),
        mt(50, "Kinnim",     "קִנִּים",    "Mishnah Kinnim",     3),
    ])]

    private static let taharot_seder = [MishnahSeder(id: 5, name: "Taharot", hebrewName: "טָהֳרוֹת", tractates: [
        mt(51, "Keilim",     "כֵּלִים",    "Mishnah Kelim",     30),
        mt(52, "Ohalot",     "אֳהָלוֹת",   "Mishnah Ohalot",    18, tosefta: 18),
        mt(53, "Negaim",     "נְגָעִים",   "Mishnah Negaim",    14, tosefta:  9),
        mt(54, "Parah",      "פָּרָה",     "Mishnah Parah",     12, tosefta: 12),
        mt(55, "Taharot",    "טָהֳרוֹת",   "Mishnah Taharot",   10),
        mt(56, "Mikvaot",    "מִקְוָאוֹת", "Mishnah Mikvaot",   10, tosefta:  8),
        mt(57, "Niddah",     "נִדָּה",     "Mishnah Niddah",    10, tosefta:  9),
        mt(58, "Makhshirin", "מַכְשִׁירִין","Mishnah Makhshirin",  6, tosefta:  3),
        mt(59, "Zavim",      "זָבִים",     "Mishnah Zavim",      5, tosefta:  5),
        mt(60, "Tevul Yom",  "טְבוּל יוֹם","Mishnah Tevul Yom",  4, tosefta:  2),
        mt(61, "Yadayim",    "יָדַיִם",    "Mishnah Yadayim",    4, tosefta:  2),
        mt(62, "Uktzin",     "עֻקְצִין",   "Mishnah Oktzin",     3, tosefta:  3),
    ])]

    private static func mt(_ id: Int, _ name: String, _ he: String, _ sefaria: String, _ ch: Int,
                           tosefta: Int = 0, yerushalmi: Int = 0) -> MishnahTractate {
        MishnahTractate(id: id, name: name, hebrewName: he, sefariaName: sefaria, chapters: ch,
                        toseftaChapters: tosefta, yerushalmiChapters: yerushalmi)
    }

    // MARK: Talmud

    static let talmudSedarim: [TalmudSeder] = zeraim_t + moed_t + nashim_t + nezikin_t + kodashim_t + taharot_t
    static let allTalmudTractates: [TalmudTractate] = talmudSedarim.flatMap { $0.tractates }

    private static let zeraim_t = [TalmudSeder(id: 0, name: "Zeraim", hebrewName: "זְרָעִים", tractates: [
        tt(0, "Berakhot", "בְּרָכוֹת", "Berakhot", 2, 64),
    ])]

    private static let moed_t = [TalmudSeder(id: 1, name: "Moed", hebrewName: "מוֹעֵד", tractates: [
        tt(1,  "Shabbat",      "שַׁבָּת",      "Shabbat",      2, 157),
        tt(2,  "Eruvin",       "עֵרוּבִין",    "Eruvin",       2, 105),
        tt(3,  "Pesachim",     "פְּסָחִים",    "Pesachim",     2, 121),
        tt(4,  "Shekalim",     "שְׁקָלִים",    "Shekalim",     2,  22, isYerushalmi: true),
        tt(5,  "Yoma",         "יוֹמָא",       "Yoma",         2,  88),
        tt(6,  "Sukkah",       "סוּכָּה",       "Sukkah",       2,  56),
        tt(7,  "Beitzah",      "בֵּיצָה",      "Beitzah",      2,  40),
        tt(8,  "Rosh Hashanah","רֹאשׁ הַשָּׁנָה","Rosh Hashanah",2,  35),
        tt(9,  "Taanit",       "תַּעֲנִית",    "Taanit",       2,  31),
        tt(10, "Megillah",     "מְגִלָּה",     "Megillah",     2,  32),
        tt(11, "Moed Katan",   "מוֹעֵד קָטָן", "Moed Katan",   2,  29),
        tt(12, "Chagigah",     "חֲגִיגָה",     "Chagigah",     2,  27),
    ])]

    private static let nashim_t = [TalmudSeder(id: 2, name: "Nashim", hebrewName: "נָשִׁים", tractates: [
        tt(13, "Yevamot",   "יְבָמוֹת",   "Yevamot",   2, 122),
        tt(14, "Ketubot",   "כְּתֻבּוֹת",  "Ketubot",   2, 112),
        tt(15, "Nedarim",   "נְדָרִים",    "Nedarim",   2,  91),
        tt(16, "Nazir",     "נָזִיר",      "Nazir",     2,  66),
        tt(17, "Sotah",     "סוֹטָה",      "Sotah",     2,  49),
        tt(18, "Gittin",    "גִּיטִּין",   "Gittin",    2,  90),
        tt(19, "Kiddushin", "קִדּוּשִׁין", "Kiddushin", 2,  82),
    ])]

    private static let nezikin_t = [TalmudSeder(id: 3, name: "Nezikin", hebrewName: "נְזִיקִין", tractates: [
        tt(20, "Bava Kamma",   "בָּבָא קַמָּא",   "Bava Kamma",   2, 119),
        tt(21, "Bava Metzia",  "בָּבָא מְצִיעָא", "Bava Metzia",  2, 119),
        tt(22, "Bava Batra",   "בָּבָא בַּתְרָא",  "Bava Batra",   2, 176),
        tt(23, "Sanhedrin",    "סַנְהֶדְרִין",     "Sanhedrin",    2, 113),
        tt(24, "Makkot",       "מַכּוֹת",          "Makkot",       2,  24),
        tt(25, "Shevuot",      "שְׁבוּעוֹת",       "Shevuot",      2,  49),
        tt(26, "Avodah Zarah", "עֲבוֹדָה זָרָה",   "Avodah Zarah", 2,  76),
        tt(27, "Horayot",      "הוֹרָיּוֹת",       "Horayot",      2,  14),
    ])]

    private static let kodashim_t = [TalmudSeder(id: 4, name: "Kodashim", hebrewName: "קֳדָשִׁים", tractates: [
        tt(28, "Zevachim",  "זְבָחִים",    "Zevachim",  2, 120),
        tt(29, "Menachot",  "מְנָחוֹת",    "Menachot",  2, 110),
        tt(30, "Chullin",   "חוּלִּין",     "Chullin",   2, 142),
        tt(31, "Bekhorot",  "בְּכוֹרוֹת",  "Bekhorot",  2,  61),
        tt(32, "Arakhin",   "עֲרָכִין",    "Arakhin",   2,  34),
        tt(33, "Temurah",   "תְּמוּרָה",   "Temurah",   2,  34),
        tt(34, "Keritot",   "כְּרִיתוֹת",  "Keritot",   2,  28),
        tt(35, "Meilah",    "מְעִילָה",    "Meilah",    2,  22),
        tt(36, "Tamid",     "תָּמִיד",     "Tamid",    25,  33, mishnahOnly: true),
        tt(37, "Middot",    "מִדּוֹת",     "Middot",   34,  37, mishnahOnly: true),
        tt(38, "Kinnim",    "קִנִּים",     "Kinnim",   23,  25, mishnahOnly: true),
    ])]

    private static let taharot_t = [TalmudSeder(id: 5, name: "Taharot", hebrewName: "טָהֳרוֹת", tractates: [
        tt(39, "Niddah", "נִדָּה", "Niddah", 2, 73),
    ])]

    private static func tt(_ id: Int, _ name: String, _ he: String, _ sefaria: String,
                           _ start: Int, _ end: Int,
                           mishnahOnly: Bool = false, isYerushalmi: Bool = false) -> TalmudTractate {
        TalmudTractate(id: id, name: name, hebrewName: he, sefariaName: sefaria,
                       startDaf: start, endDaf: end,
                       mishnahOnly: mishnahOnly, isYerushalmi: isYerushalmi)
    }

    // MARK: Rambam (Mishneh Torah)
    //
    // sefariaName = exact Sefaria title (format: "Mishneh Torah, [Title]" — NO "Laws of" prefix).
    // Verified against https://www.sefaria.org/api/index/
    // Work IDs must equal their 0-based position in allRambamWorks.

    static let rambamSefarim: [RambamSefer] = [
        RambamSefer(id: 0, name: "HaMadda", hebrewName: "סֵפֶר הַמַּדָּע", works: [
            rw(0,  "Yesodei HaTorah",        "יסודי התורה",      "Mishneh Torah, Foundations of the Torah",                   10),
            rw(1,  "De'ot",                  "דעות",              "Mishneh Torah, Human Dispositions",                          7),
            rw(2,  "Talmud Torah",           "תלמוד תורה",        "Mishneh Torah, Torah Study",                                 4),
            rw(3,  "Avodah Zarah",           "עבודה זרה",         "Mishneh Torah, Foreign Worship and Customs of the Nations", 12),
            rw(4,  "Teshuvah",               "תשובה",             "Mishneh Torah, Repentance",                                 10),
        ]),
        RambamSefer(id: 1, name: "Ahavah", hebrewName: "סֵפֶר אַהֲבָה", works: [
            rw(5,  "Keri'at Shema",          "קריאת שמע",         "Mishneh Torah, Reading the Shema",                           4),
            rw(6,  "Tefillah",               "תפילה",             "Mishneh Torah, Prayer and the Priestly Blessing",           15),
            rw(7,  "Tefillin",               "תפילין",            "Mishneh Torah, Tefillin, Mezuzah and the Torah Scroll",     10),
            rw(8,  "Tzitzit",                "ציצית",             "Mishneh Torah, Fringes",                                     3),
            rw(9,  "Berakhot",               "ברכות",             "Mishneh Torah, Blessings",                                  11),
            rw(10, "Milah",                  "מילה",              "Mishneh Torah, Circumcision",                                3),
        ]),
        RambamSefer(id: 2, name: "Zemanim", hebrewName: "סֵפֶר זְמַנִּים", works: [
            rw(11, "Shabbat",                "שבת",               "Mishneh Torah, Sabbath",                                    30),
            rw(12, "Eruvin",                 "עירובין",           "Mishneh Torah, Eruvin",                                      8),
            rw(13, "Chametz uMatzah",        "חמץ ומצה",          "Mishneh Torah, Leavened and Unleavened Bread",               8),
            rw(14, "Shofar, Sukkah veLulav", "שופר",              "Mishneh Torah, Shofar, Sukkah and Lulav",                    8),
            rw(15, "Ta'aniyot",              "תעניות",            "Mishneh Torah, Fasts",                                       5),
            rw(16, "Megillah vaChanukah",    "מגילה",             "Mishneh Torah, Scroll of Esther and Hanukkah",               4),
        ]),
        RambamSefer(id: 3, name: "Nashim", hebrewName: "נָשִׁים", works: [
            rw(17, "Ishut",                  "אישות",             "Mishneh Torah, Marriage",                                   25),
            rw(18, "Gerushin",               "גירושין",           "Mishneh Torah, Divorce",                                    13),
            rw(19, "Yibum vaChalizah",       "יבום וחליצה",       "Mishneh Torah, Levirate Marriage and Release",               8),
            rw(20, "Na'arah Betulah",        "נערה בתולה",        "Mishneh Torah, Virgin Maiden",                               3),
            rw(21, "Sotah",                  "סוטה",              "Mishneh Torah, Woman Suspected of Infidelity",               4),
        ]),
        RambamSefer(id: 4, name: "Kedushah", hebrewName: "סֵפֶר קְדֻשָּׁה", works: [
            rw(22, "Issurei Bi'ah",          "איסורי ביאה",       "Mishneh Torah, Forbidden Intercourse",                      22),
            rw(23, "Ma'akhalot Asurot",      "מאכלות אסורות",     "Mishneh Torah, Forbidden Foods",                            17),
            rw(24, "Shechitah",              "שחיטה",             "Mishneh Torah, Ritual Slaughter",                           14),
        ]),
        RambamSefer(id: 5, name: "Haflaah", hebrewName: "הַפְלָאָה", works: [
            rw(25, "Shevuot",                "שבועות",            "Mishneh Torah, Oaths",                                      12),
            rw(26, "Nedarim",                "נדרים",             "Mishneh Torah, Vows",                                       13),
            rw(27, "Nezirut",                "נזירות",            "Mishneh Torah, Nazariteship",                               10),
            rw(28, "Arakhin vaCharamin",     "ערכים וחרמין",      "Mishneh Torah, Appraisals and Devoted Property",             8),
        ]),
        RambamSefer(id: 6, name: "Zeraim", hebrewName: "זְרָעִים", works: [
            rw(29, "Terumot",                "תרומות",            "Mishneh Torah, Heave Offerings",                            15),
            rw(30, "Ma'asrot",               "מעשרות",            "Mishneh Torah, Tithes",                                     14),
            rw(31, "Ma'aser Sheni",          "מעשר שני",          "Mishneh Torah, Second Tithes and Fourth Year's Fruit",      11),
            rw(32, "Bikkurim",               "ביכורים",           "Mishneh Torah, First Fruits and other Gifts to Priests Outside the Sanctuary", 12),
            rw(33, "Shemitah veYovel",       "שמיטה ויובל",       "Mishneh Torah, Sabbatical Year and the Jubilee",            13),
        ]),
        RambamSefer(id: 7, name: "Avodah", hebrewName: "עֲבוֹדָה", works: [
            rw(34, "Beit HaBechirah",        "בית הבחירה",        "Mishneh Torah, The Chosen Temple",                                8),
            rw(35, "Klei HaMikdash",         "כלי המקדש",         "Mishneh Torah, Vessels of the Sanctuary and Those Who Serve Therein", 10),
            rw(36, "Bi'at HaMikdash",        "ביאת המקדש",        "Mishneh Torah, Admission into the Sanctuary",                     9),
            rw(37, "Issurei HaMizbeach",     "איסורי המזבח",      "Mishneh Torah, Things Forbidden on the Altar",                    7),
            rw(41, "Ma'aseh HaKorbanot",     "מעשה הקרבנות",      "Mishneh Torah, Sacrificial Procedure",                           19),
            rw(42, "Temidim uMusafim",       "תמידין ומוספין",    "Mishneh Torah, Daily Offerings and Additional Offerings",         10),
            rw(43, "Pesulei HaMukdashim",    "פסולי המוקדשין",    "Mishneh Torah, Sacrifices Rendered Unfit",                        19),
            rw(68, "Avodat Yom HaKippurim",  "עבודת יום הכפורים", "Mishneh Torah, Service on the Day of Atonement",                  5),
            rw(69, "Meilah",                 "מעילה",             "Mishneh Torah, Trespass",                                         8),
        ]),
        RambamSefer(id: 8, name: "Korbanot", hebrewName: "קָרְבָּנוֹת", works: [
            rw(38, "Korban Pesach",          "קרבן פסח",          "Mishneh Torah, Paschal Offering",                                10),
            rw(39, "Chagigah",               "חגיגה",             "Mishneh Torah, Festival Offering",                                3),
            rw(40, "Bekhorot",               "בכורות",            "Mishneh Torah, Firstlings",                                       8),
            rw(70, "Shegagot",               "שגגות",             "Mishneh Torah, Offerings for Unintentional Transgressions",       15),
            rw(71, "Mechussarei Kapparah",   "מחוסרי כפרה",       "Mishneh Torah, Offerings for Those with Incomplete Atonement",     5),
            rw(72, "Temurah",                "תמורה",             "Mishneh Torah, Substitution",                                     4),
        ]),
        RambamSefer(id: 9, name: "Taharah", hebrewName: "טָהֳרָה", works: [
            rw(44, "Tum'at Met",             "טומאת מת",          "Mishneh Torah, Defilement by a Corpse",                     25),
            rw(45, "Parah Adumah",           "פרה אדומה",         "Mishneh Torah, Red Heifer",                                 15),
            rw(46, "She'ar Avot HaTum'ot",   "שאר אבות הטומאות",  "Mishneh Torah, Other Sources of Defilement",                20),
            rw(47, "Mikva'ot",               "מקוואות",           "Mishneh Torah, Immersion Pools",                            11),
        ]),
        RambamSefer(id: 10, name: "Nezikin", hebrewName: "נְזִיקִין", works: [
            rw(48, "Nizkei Mamon",           "נזקי ממון",         "Mishneh Torah, Damages to Property",                        14),
            rw(49, "Genevah",                "גנבה",              "Mishneh Torah, Theft",                                       9),
            rw(50, "Gezelah vaAvedah",       "גזלה ואבדה",        "Mishneh Torah, Robbery and Lost Property",                  18),
            rw(51, "Chovel uMazzik",         "חובל ומזיק",        "Mishneh Torah, One Who Injures a Person or Property",        8),
            rw(52, "Rotze'ach uShmirat HaNefesh","רוצח",          "Mishneh Torah, Murderer and the Preservation of Life",      13),
        ]),
        RambamSefer(id: 11, name: "Kinyan", hebrewName: "קִנְיָן", works: [
            rw(53, "Mekhirah",               "מכירה",             "Mishneh Torah, Sales",                                      30),
            rw(54, "Zechiyah uMattanah",     "זכייה ומתנה",       "Mishneh Torah, Ownerless Property and Gifts",               12),
            rw(55, "Shekhenim",              "שכנים",             "Mishneh Torah, Neighbors",                                  14),
            rw(56, "Sheluhin veShuttafin",   "שלוחין ושותפין",    "Mishneh Torah, Agents and Partners",                        10),
            rw(57, "Avadim",                 "עבדים",             "Mishneh Torah, Slaves",                                      9),
        ]),
        RambamSefer(id: 12, name: "Mishpatim", hebrewName: "מִשְׁפָּטִים", works: [
            rw(58, "Sekhirut",               "שכירות",            "Mishneh Torah, Hiring",                                     13),
            rw(59, "She'elah uFikkadon",     "שאלה ופקדון",       "Mishneh Torah, Borrowing and Deposit",                       8),
            rw(60, "Malveh veLoveh",         "מלוה ולוה",         "Mishneh Torah, Creditor and Debtor",                        27),
            rw(61, "To'en veNit'an",         "טוען ונטען",        "Mishneh Torah, Plaintiff and Defendant",                    16),
            rw(62, "Nachalot",               "נחלות",             "Mishneh Torah, Inheritances",                               11),
        ]),
        RambamSefer(id: 13, name: "Shoftim", hebrewName: "שׁוֹפְטִים", works: [
            rw(63, "Sanhedrin",              "סנהדרין",           "Mishneh Torah, The Sanhedrin and the Penalties within Their Jurisdiction", 26),
            rw(64, "Edut",                   "עדות",              "Mishneh Torah, Testimony",                                  22),
            rw(65, "Mamrim",                 "ממרים",             "Mishneh Torah, Rebels",                                      7),
            rw(66, "Avel",                   "אבל",               "Mishneh Torah, Mourning",                                   14),
            rw(67, "Melakhim uMilchamot",    "מלכים ומלחמות",     "Mishneh Torah, Kings and Wars",                             12),
        ]),
    ]

    private static func rw(_ id: Int, _ name: String, _ he: String, _ sefaria: String, _ ch: Int) -> RambamWork {
        RambamWork(id: id, name: name, hebrewName: he, sefariaName: sefaria, chapters: ch)
    }

    // MARK: Shulkhan Arukh
    // Note: Sefaria spells it "Orach Chayim" (with 'y'), not "Orach Chaim".

    static let shulchanArukhSections: [ShulchanArukh_Section] = [
        ShulchanArukh_Section(id: 0, name: "Orach Chayim",   hebrewName: "אוֹרַח חַיִּים",    sefariaName: "Shulchan Arukh, Orach Chayim",   simanim: 697),
        ShulchanArukh_Section(id: 1, name: "Yoreh Deah",     hebrewName: "יוֹרֶה דֵּעָה",     sefariaName: "Shulchan Arukh, Yoreh De'ah",    simanim: 403),
        ShulchanArukh_Section(id: 2, name: "Even HaEzer",    hebrewName: "אֶבֶן הָעֵזֶר",    sefariaName: "Shulchan Arukh, Even HaEzer",    simanim: 178),
        ShulchanArukh_Section(id: 3, name: "Choshen Mishpat",hebrewName: "חֹשֶׁן מִשְׁפָּט",  sefariaName: "Shulchan Arukh, Choshen Mishpat",simanim: 427),
    ]
}
