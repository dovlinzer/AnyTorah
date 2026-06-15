import Foundation
import SwiftUI

// MARK: - Category

enum TextCategory: String, CaseIterable, Identifiable, Codable {
    case tanakh, mishnah, talmud, rambam, shulchanArukh, midrash

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .tanakh:        return "Tanakh"
        case .mishnah:       return "Mishnah"
        case .talmud:        return "Talmud"
        case .rambam:        return "Rambam"
        case .shulchanArukh: return "Shulkhan Arukh"
        case .midrash:       return "Midrash"
        }
    }

    var hebrewName: String {
        switch self {
        case .tanakh:        return "תנ״ך"
        case .mishnah:       return "משנה"
        case .talmud:        return "תלמוד"
        case .rambam:        return "רמב״ם"
        case .shulchanArukh: return "שולחן ערוך"
        case .midrash:       return "מדרש"
        }
    }

    var icon: String {
        switch self {
        case .tanakh:        return "book.closed"
        case .mishnah:       return "books.vertical"
        case .talmud:        return "scroll"
        case .rambam:        return "star.circle"
        case .shulchanArukh: return "list.bullet.rectangle"
        case .midrash:       return "text.book.closed"
        }
    }

    /// Fallback list used when no context-specific override applies.
    /// The ViewModel's `availableCommentaries` is the authoritative source at runtime.
    var defaultCommentaries: [CommentaryType] {
        switch self {
        case .tanakh:        return [.onkelos, .rashiTanakh, .ramban]
        case .mishnah:       return [.rambamMishnah, .bartenura, .tosafotYomTov]
        case .talmud:        return [.rashiTalmud, .tosafot]
        case .rambam:        return [.maggidMishnah, .kesefMishnah]
        case .shulchanArukh: return [.mishnahBerurah, .biurHalakha]
        case .midrash:       return []
        }
    }

    /// Segment label style used in the text view.
    var segmentLabelStyle: SegmentLabelStyle {
        switch self {
        case .tanakh:        return .verse
        case .mishnah:       return .mishnah
        case .talmud:        return .none
        case .rambam:        return .halakha
        case .shulchanArukh: return .sif
        case .midrash:       return .none
        }
    }
}

// MARK: - Subcategories

enum MishnahSubcategory: String, CaseIterable {
    case mishnah = "mishnah"
    case tosefta = "tosefta"

    var displayName: String {
        switch self {
        case .mishnah: return "Mishnah"
        case .tosefta: return "Tosefta"
        }
    }
    var hebrewName: String {
        switch self {
        case .mishnah: return "משנה"
        case .tosefta: return "תוספתא"
        }
    }
}

enum TalmudSubcategory: String, CaseIterable {
    case bavli     = "bavli"
    case yerushalmi = "yerushalmi"

    var displayName: String {
        switch self {
        case .bavli:      return "Bavli"
        case .yerushalmi: return "Yerushalmi"
        }
    }
    var hebrewName: String {
        switch self {
        case .bavli:      return "בבלי"
        case .yerushalmi: return "ירושלמי"
        }
    }
}

enum MidrashSubcategory: String, CaseIterable {
    case halakha = "halakha"
    case aggada  = "aggada"

    var displayName: String {
        switch self {
        case .halakha: return "Midrash Halakha"
        case .aggada:  return "Midrash Aggada"
        }
    }
    var hebrewName: String {
        switch self {
        case .halakha: return "מדרש הלכה"
        case .aggada:  return "מדרש אגדה"
        }
    }
}

enum MidrashWork: String, CaseIterable, Identifiable {
    // Midrash Halakha
    case mekhiltaYishmael = "mekhiltaYishmael"
    case mekhiltaShimon   = "mekhiltaShimon"
    case sifra            = "sifra"
    case sifreiBamidbar   = "sifreiBamidbar"
    case sifreiDevarim    = "sifreiDevarim"
    // Midrash Aggada — Rabbah
    case bereishitRabbah  = "bereishitRabbah"
    case shemotRabbah     = "shemotRabbah"
    case vayikraRabbah    = "vayikraRabbah"
    case bamidbarRabbah   = "bamidbarRabbah"
    case devarimRabbah    = "devarimRabbah"
    // Midrash Aggada — Tanchuma
    case tanchumaStandard = "tanchumaStandard"
    case tanchumaBuber    = "tanchumaBuber"

    var id: String { rawValue }

    var subcategory: MidrashSubcategory {
        switch self {
        case .mekhiltaYishmael, .mekhiltaShimon, .sifra,
             .sifreiBamidbar, .sifreiDevarim:
            return .halakha
        default:
            return .aggada
        }
    }

    var displayName: String {
        switch self {
        case .mekhiltaYishmael: return "Mekhilta (R. Yishmael)"
        case .mekhiltaShimon:   return "Mekhilta (R. Shimon)"
        case .sifra:            return "Sifra"
        case .sifreiBamidbar:   return "Sifrei Bamidbar"
        case .sifreiDevarim:    return "Sifrei Devarim"
        case .bereishitRabbah:  return "Bereishit Rabbah"
        case .shemotRabbah:     return "Shemot Rabbah"
        case .vayikraRabbah:    return "Vayikra Rabbah"
        case .bamidbarRabbah:   return "Bamidbar Rabbah"
        case .devarimRabbah:    return "Devarim Rabbah"
        case .tanchumaStandard: return "Midrash Tanchuma"
        case .tanchumaBuber:    return "Tanchuma (Buber)"
        }
    }

    var hebrewName: String {
        switch self {
        case .mekhiltaYishmael: return "מכילתא דר׳ ישמעאל"
        case .mekhiltaShimon:   return "מכילתא דרשב״י"
        case .sifra:            return "ספרא"
        case .sifreiBamidbar:   return "ספרי במדבר"
        case .sifreiDevarim:    return "ספרי דברים"
        case .bereishitRabbah:  return "בראשית רבה"
        case .shemotRabbah:     return "שמות רבה"
        case .vayikraRabbah:    return "ויקרא רבה"
        case .bamidbarRabbah:   return "במדבר רבה"
        case .devarimRabbah:    return "דברים רבה"
        case .tanchumaStandard: return "מדרש תנחומא"
        case .tanchumaBuber:    return "תנחומא (בובר)"
        }
    }

    /// Torah book indices this work covers (0=Gen, 1=Exod, 2=Lev, 3=Num, 4=Deut).
    var applicableBookIndices: [Int] {
        switch self {
        case .mekhiltaYishmael, .mekhiltaShimon, .shemotRabbah: return [1]
        case .sifra, .vayikraRabbah:           return [2]
        case .sifreiBamidbar, .bamidbarRabbah: return [3]
        case .sifreiDevarim, .devarimRabbah:   return [4]
        case .bereishitRabbah:                 return [0]
        case .tanchumaStandard, .tanchumaBuber: return [0, 1, 2, 3, 4]
        }
    }

    /// Exact Sefaria index_title for this work — used to match links API results.
    var sefariaIndexTitle: String {
        switch self {
        case .mekhiltaYishmael: return "Mekhilta DeRabbi Yishmael"
        case .mekhiltaShimon:   return "Mekhilta DeRabbi Shimon Ben Yochai"
        case .sifra:            return "Sifra"
        case .sifreiBamidbar:   return "Sifrei Bamidbar"
        case .sifreiDevarim:    return "Sifrei Devarim"
        case .bereishitRabbah:  return "Bereshit Rabbah"
        case .shemotRabbah:     return "Shemot Rabbah"
        case .vayikraRabbah:    return "Vayikra Rabbah"
        case .bamidbarRabbah:   return "Bamidbar Rabbah"
        case .devarimRabbah:    return "Devarim Rabbah"
        case .tanchumaStandard: return "Midrash Tanchuma"
        case .tanchumaBuber:    return "Midrash Tanchuma Buber"
        }
    }

    /// All works for a given subcategory.
    static func works(for subcategory: MidrashSubcategory) -> [MidrashWork] {
        allCases.filter { $0.subcategory == subcategory }
    }

    // MARK: - Native navigation

    enum NativeStyle {
        case numericTwo(maxChapters: Int)   // "{title} {ch}:{sec}" — Rabbah, Mekhilta Shimon
        case numericOne(maxSections: Int)   // "{title} {sec}" — Sifrei
        case namedTwo(names: [String])      // "{title}, {name} {sec}" — Tanchuma
        case namedTractate(names: [String]) // "{title}, Tractate {name} {sec}" — Mekhilta Yishmael
        case namedSection(names: [String])  // "{title}, {name} {sec}" — Sifra
    }

    var nativeStyle: NativeStyle {
        switch self {
        case .bereishitRabbah:   return .numericTwo(maxChapters: 100)
        case .shemotRabbah:      return .numericTwo(maxChapters: 52)
        case .vayikraRabbah:     return .numericTwo(maxChapters: 37)
        case .bamidbarRabbah:    return .numericTwo(maxChapters: 23)
        case .devarimRabbah:     return .numericTwo(maxChapters: 11)
        case .sifreiBamidbar:    return .numericOne(maxSections: 161)
        case .sifreiDevarim:     return .numericOne(maxSections: 357)
        case .tanchumaStandard:  return .namedTwo(names: MidrashWork.tanchumaParashas)
        case .tanchumaBuber:     return .namedTwo(names: MidrashWork.tanchumaBuberParashas)
        case .mekhiltaYishmael:  return .namedTractate(names: MidrashWork.mekhiltaYishmaelTractates)
        case .mekhiltaShimon:    return .numericTwo(maxChapters: 50)
        case .sifra:             return .namedSection(names: MidrashWork.sifraParashas)
        }
    }

    var nativeIsOneLevel: Bool {
        if case .numericOne = nativeStyle { return true }
        return false
    }

    var nativeMaxChapters: Int {
        switch nativeStyle {
        case .numericTwo(let max):   return max
        case .numericOne(let max):   return max
        case .namedTwo(let names):   return names.count
        case .namedTractate(let names): return names.count
        case .namedSection(let names):  return names.count
        }
    }

    var nativeChapterLabel: String {
        switch nativeStyle {
        case .numericTwo, .numericOne: return "Chapter"
        case .namedTwo:                return "Parasha"
        case .namedTractate:           return "Tractate"
        case .namedSection:            return "Section"
        }
    }

    var nativeChapterLabels: [String] {
        switch nativeStyle {
        case .numericTwo(let max):   return (1...max).map { "\($0)" }
        case .numericOne(let max):   return (1...max).map { "\($0)" }
        case .namedTwo(let names):   return names
        case .namedTractate(let names): return names
        case .namedSection(let names):  return names
        }
    }

    func nativeRef(chapter: Int, section: Int) -> String {
        let base = sefariaIndexTitle
        switch nativeStyle {
        case .numericTwo:
            return "\(base) \(chapter):\(section)"
        case .numericOne:
            return "\(base) \(chapter)"
        case .namedTwo(let names):
            guard chapter >= 1, chapter <= names.count else { return "" }
            return "\(base), \(names[chapter - 1]) \(section)"
        case .namedTractate(let names):
            guard chapter >= 1, chapter <= names.count else { return "" }
            return "\(base), Tractate \(names[chapter - 1]) \(section)"
        case .namedSection(let names):
            guard chapter >= 1, chapter <= names.count else { return "" }
            return "\(base), \(names[chapter - 1]) \(section)"
        }
    }

    // MARK: - Static section catalogs (from Sefaria index API)

    static let tanchumaParashas = [
        "Bereshit","Noach","Lech Lecha","Vayera","Chayei Sara","Toldot","Vayetzei",
        "Vayishlach","Vayeshev","Miketz","Vayigash","Vayechi","Shemot","Vaera","Bo",
        "Beshalach","Yitro","Mishpatim","Terumah","Tetzaveh","Ki Tisa","Vayakhel",
        "Pekudei","Vayikra","Tzav","Shmini","Tazria","Metzora","Achrei Mot","Kedoshim",
        "Emor","Behar","Bechukotai","Bamidbar","Nasso","Beha'alotcha","Sh'lach",
        "Korach","Chukat","Balak","Pinchas","Matot","Masei","Devarim","Vaetchanan",
        "Eikev","Re'eh","Shoftim","Ki Teitzei","Ki Tavo","Nitzavim","Vayeilech",
        "Ha'Azinu","V'Zot HaBerachah"
    ]

    static let tanchumaBuberParashas = [
        "Bereshit","Noach","Lech Lecha","Vayera","Chayei Sara","Toldot","Vayetzei",
        "Vayishlach","Vayeshev","Miketz","Vayigash","Vayechi","Shemot","Vaera","Bo",
        "Beshalach","Yitro","Mishpatim","Terumah","Tetzaveh","Ki Tisa","Vayakhel",
        "Pekudei","Vayikra","Tzav","Shmini","Tazria","Metzora","Achrei Mot","Kedoshim",
        "Emor","Behar","Bechukotai","Bamidbar","Nasso","Beha'alotcha","Sh'lach",
        "Appendix to Sh'lach","Korach","Appendix to Korach","Chukat","Appendix to Chukat",
        "Balak","Pinchas","Matot","Masei","Devarim","Appendix to Devarim","Vaetchanan",
        "Appendix to Vaetchanan","Eikev","Re'eh","Appendix to Re'eh","Shoftim",
        "Ki Teitzei","Ki Tavo","Nitzavim","Ha'Azinu","V'Zot HaBerachah"
    ]

    static let mekhiltaYishmaelTractates = [
        "Pischa","Vayehi Beshalach","Shirah","Vayassa","Amalek",
        "Bachodesh","Nezikin","Kaspa","Shabbata"
    ]

    static let sifraParashas = [
        "Baraita DeRabbi Yishmael","Vayikra Dibbura DeNedavah","Vayikra Dibbura DeChovah",
        "Tzav","Shemini","Tazria Parashat Yoledet","Tazria Parashat Negaim","Metzora",
        "Metzora Parashat Zavim","Acharei Mot","Kedoshim","Emor","Behar","Bechukotai"
    ]
}

enum MidrashNavigationMode: String, Codable {
    case byVerse = "byVerse"
    case native  = "native"
}

enum SegmentLabelStyle {
    case verse     // "1", "2", "3"
    case mishnah   // ":א", ":ב"
    case halakha   // "א:", "ב:"
    case sif       // "א", "ב"
    case none
}

// MARK: - Display Mode

enum TextDisplayMode: String, CaseIterable {
    case source      = "source"
    case translation = "translation"
    case both        = "both"
}

// MARK: - Commentary

enum CommentaryType: String, CaseIterable, Identifiable {
    // Tanakh — Torah (core)
    case onkelos         = "onkelos"
    case rashiTanakh     = "rashiTanakh"
    case ramban          = "ramban"
    // Tanakh — Torah (extended pool)
    case ibnEzra          = "ibnEzra"
    case abarbanel        = "abarbanel"
    case rashbam          = "rashbam"
    case sforno           = "sforno"
    case haKtavVeHaKabalah = "haKtavVeHaKabalah"
    case haamekDavar      = "haamekDavar"
    case harchevDavar     = "harchevDavar"
    case kliYakar         = "kliYakar"
    case malbim           = "malbim"
    case meshechChokhmah  = "meshechChokhmah"
    case orHaChaim        = "orHaChaim"
    case ravHirsch        = "ravHirsch"
    case shadal           = "shadal"
    case torahTemimah     = "torahTemimah"
    case cassutoGenesis   = "cassutoGenesis"
    case cassutoExodus    = "cassutoExodus"
    case hoffmannExodus   = "hoffmannExodus"
    case hoffmannLeviticus = "hoffmannLeviticus"
    case jonathanSacks    = "jonathanSacks"
    case nechamaLeibowitz = "nechamaLeibowitz"
    // Tanakh — Nakh shared (Rishonim)
    case radak           = "radak"
    case ralbag          = "ralbag"
    // Tanakh — Nakh shared (Acharonim)
    case alshich         = "alshich"
    case metzudatZion    = "metzudatZion"
    case rishonLeTzion   = "rishonLeTzion"
    // Tanakh — Nevi'im
    case targumYonatan   = "targumYonatan"
    // Tanakh — Ketuvim (different Targum family; Sefaria refs are "Targum [Book] [ch]")
    case targumKetuvim   = "targumKetuvim"
    case metzudatDavid   = "metzudatDavid"
    // Mishnah — core
    case rambamMishnah          = "rambamMishnah"
    case bartenura              = "bartenura"
    case tosafotYomTov          = "tosafotYomTov"
    // Mishnah — additional commentaries
    case rashMiShantz           = "rashMiShantz"
    case melekhetShlomo         = "melekhetShlomo"
    case tosafotRabbiAkivaEiger = "tosafotRabbiAkivaEiger"
    case yeshSederLaMishnah     = "yeshSederLaMishnah"
    case mishnatEretzYisrael    = "mishnatEretzYisrael"
    case englishExplanation     = "englishExplanation"
    case rashash                = "rashash"
    case yachin                 = "yachin"
    case boaz                   = "boaz"
    case raavad                 = "raavad"
    case gra                    = "gra"
    case rabbeinuYonah          = "rabbeinuYonah"
    case derekhChayyim          = "derekhChayyim"
    case nachalatAvot           = "nachalatAvot"
    // Talmud — core
    case rashiTalmud              = "rashiTalmud"
    case tosafot                  = "tosafot"
    // Talmud — Group 1: Rashi-like
    case ranNedarim               = "ranNedarim"
    case rabbeinuChananel         = "rabbeinuChananel"
    case rabbeinuGershom          = "rabbeinuGershom"
    case rashbamTalmud            = "rashbamTalmud"
    case ran                      = "ran"
    case ravNissimGaon            = "ravNissimGaon"
    case mefareshTamid            = "mefareshTamid"
    // Talmud — Group 2: Chiddushim
    case chiddusheiRamban         = "chiddusheiRamban"
    case rashba                   = "rashba"
    case ritva                    = "ritva"
    case meiri                    = "meiri"
    case shitaMekubetzet          = "shitaMekubetzet"
    case raah                     = "raah"
    case yadRamah                 = "yadRamah"
    case riMigash                 = "riMigash"
    case chiddusheiHaRambam       = "chiddusheiHaRambam"
    // Talmud — Group 3: Tosafot-type
    case tosafotHaRosh            = "tosafotHaRosh"
    case tosafotRid               = "tosafotRid"
    case tosafotShantz            = "tosafotShantz"
    case tosafotYeshanim          = "tosafotYeshanim"
    case piskeiTosafot            = "piskeiTosafot"
    case commentaryOfTheRosh      = "commentaryOfTheRosh"
    // Talmud — Group 4: Standard Acharonim
    case maharsha          = "maharsha"
    case maharam           = "maharam"
    case chokhmatShlomo    = "chokhmatShlomo"
    case rAbbiAkivaEiger   = "rAbbiAkivaEiger"
    // Talmud — Group 5: Additional Acharonim
    case peneiYehoshua     = "peneiYehoshua"
    case haflaahKetubot    = "haflaahKetubot"
    case tzlach            = "tzlach"
    case chatamSofer       = "chatamSofer"
    case arukhLaNer        = "arukhLaNer"
    case reshimotShiurim   = "reshimotShiurim"
    case einAyah           = "einAyah"
    // Yerushalmi
    case peneiMoshe        = "peneiMoshe"
    case mareyHaPanim      = "mareyHaPanim"
    case ohrLayesharim     = "ohrLayesharim"
    // Tosefta
    case toseftaKifshutah  = "toseftaKifshutah"
    case briefCommentary   = "briefCommentary"
    // Rambam — Main
    case maggidMishnah        = "maggidMishnah"
    case kesefMishnah         = "kesefMishnah"
    case migdalOz             = "migdalOz"
    case lochemMishnah        = "lochemMishnah"
    case mishnahLaMelech      = "mishnahLaMelech"
    case mahariKurkusRadbaz   = "mahariKurkusRadbaz"
    // Rambam — Later Acharonim
    case kiryatSefer          = "kiryatSefer"
    case maasehRokeach        = "maasehRokeach"
    case orSameach            = "orSameach"
    case avodatHaMelekh       = "avodatHaMelekh"
    case evenHaAzel           = "evenHaAzel"
    // SA — Orach Chayim
    case mishnahBerurah  = "mishnahBerurah"
    case shaareiTeshuvah = "shaareiTeshuvah"
    case biurHalakha     = "biurHalakha"
    // SA — Yoreh Deah
    case shakh           = "shakh"
    case taz             = "taz"
    // SA — Even HaEzer
    case chelkatMechokek = "chelkatMechokek"
    case beitShmuel      = "beitShmuel"
    // SA — Choshen Mishpat
    case meiratEinayim   = "meiratEinayim"
    // SA — YD, EH, HM shared
    case pitcheiTeshuvah  = "pitcheiTeshuvah"
    // SA — General (all sections)
    case baerHetev        = "baerHetev"
    case beurHagraSA      = "beurHagraSA"
    case kafHaChaim       = "kafHaChaim"
    // SA — OC
    case magenAvraham     = "magenAvraham"
    case eliyaRabbah      = "eliyaRabbah"
    case priMegadimOC     = "priMegadimOC"
    // SA — YD
    case nekudatHaKesef   = "nekudatHaKesef"
    case priMegadimYD     = "priMegadimYD"
    case keretiUPeleti    = "keretiUPeleti"
    case toratHaShlamim   = "toratHaShlamim"
    // SA — EH
    case beitMeir         = "beitMeir"
    case ezerMiKodesh     = "ezerMiKodesh"
    // SA — CM
    case ktzotHaChoshen   = "ktzotHaChoshen"
    case netivotHaMishpat = "netivotHaMishpat"
    case urimVTumim       = "urimVTumim"
    case hagahotRAE       = "hagahotRAE"

    var id: String { rawValue }

    // MARK: - Curated pools per context

    /// All commentators available for selection in the Torah (Chumash) context.
    static let torahPool: [CommentaryType] = [
        .onkelos, .rashiTanakh, .ramban, .ibnEzra, .rashbam, .radak, .ralbag,
        .sforno, .abarbanel, .kliYakar, .orHaChaim, .haamekDavar,
        .shadal, .haKtavVeHaKabalah, .malbim, .torahTemimah,
        .cassutoGenesis, .cassutoExodus, .hoffmannExodus, .hoffmannLeviticus,
    ]

    /// All commentators available for selection in the Nevi'im context.
    static let neviimPool: [CommentaryType] = [
        .targumYonatan, .rashiTanakh, .radak, .abarbanel, .ralbag,
        .alshich, .malbim, .metzudatDavid, .metzudatZion, .rishonLeTzion, .ibnEzra,
    ]

    /// All commentators available for selection in the Ketuvim context.
    static let ketuvimPool: [CommentaryType] = [
        .targumKetuvim, .rashiTanakh, .radak, .ralbag,
        .alshich, .malbim, .metzudatDavid, .metzudatZion, .ibnEzra,
    ]

    /// Talmud commentary pool divided into three groups for the swap-picker UI.
    /// Group 0: Rashi-like | Group 1: Chiddushim | Group 2: Tosafot-type.
    static let talmudGrouped: [[CommentaryType]] = [
        [.ranNedarim, .rashiTalmud, .rabbeinuChananel, .rabbeinuGershom,
         .rashbamTalmud, .chiddusheiHaRambam, .ravNissimGaon, .mefareshTamid],
        [.chiddusheiRamban, .rashba, .ritva, .ran, .meiri, .shitaMekubetzet,
         .raah, .yadRamah, .riMigash],
        [.tosafot, .tosafotHaRosh, .tosafotRid, .tosafotShantz,
         .tosafotYeshanim, .commentaryOfTheRosh],
        [.maharsha, .maharam, .chokhmatShlomo, .rAbbiAkivaEiger, .rashash],
        [.peneiYehoshua, .haflaahKetubot, .tzlach, .chatamSofer, .arukhLaNer, .reshimotShiurim, .einAyah],
    ]

    /// Two curated groups for the Rambam picker: Main (classic commentaries) + Later Acharonim.
    static let rambamGrouped: [[CommentaryType]] = [
        [.maggidMishnah, .kesefMishnah, .migdalOz, .lochemMishnah, .mishnahLaMelech, .mahariKurkusRadbaz],
        [.kiryatSefer, .maasehRokeach, .orSameach, .avodatHaMelekh, .evenHaAzel],
    ]

    /// Commentators available for the Yerushalmi context.
    static let yerushalmiPool: [CommentaryType] = [
        .peneiMoshe, .mareyHaPanim, .ohrLayesharim,
    ]

    /// Commentators available for the Tosefta context.
    static let toseftaPool: [CommentaryType] = [
        .toseftaKifshutah, .briefCommentary,
    ]

    /// All commentators available for selection in the Mishnah context.
    /// Order matches the user-specified canonical display order.
    static let mishnahPool: [CommentaryType] = [
        .rambamMishnah,
        .rashMiShantz,
        .raavad,
        .rabbeinuYonah,
        .bartenura,
        .tosafotYomTov,
        .yachin,
        .melekhetShlomo,
        .tosafotRabbiAkivaEiger,
        .gra,
        .rashash,
        .derekhChayyim,
        .nachalatAvot,
        .yeshSederLaMishnah,
        .mishnatEretzYisrael,
        .englishExplanation,
    ]

    /// Full curated pool of SA commentators for the given section (0=OC, 1=YD, 2=EH, 3=CM).
    static func saPool(forSection section: Int) -> [CommentaryType] {
        switch section {
        case 0: // Orach Chayim
            return [.mishnahBerurah, .biurHalakha, .magenAvraham, .taz, .eliyaRabbah,
                    .shaareiTeshuvah, .priMegadimOC, .baerHetev, .beurHagraSA, .kafHaChaim,
                    .chokhmatShlomo]
        case 1: // Yoreh De'ah
            return [.taz, .shakh, .nekudatHaKesef, .priMegadimYD, .keretiUPeleti,
                    .toratHaShlamim, .baerHetev, .beurHagraSA, .pitcheiTeshuvah, .kafHaChaim]
        case 2: // Even HaEzer
            return [.chelkatMechokek, .beitShmuel, .taz, .beitMeir, .ezerMiKodesh,
                    .baerHetev, .beurHagraSA, .pitcheiTeshuvah, .chokhmatShlomo]
        case 3: // Choshen Mishpat
            return [.meiratEinayim, .shakh, .taz, .ktzotHaChoshen,
                    .netivotHaMishpat, .urimVTumim, .hagahotRAE, .baerHetev, .beurHagraSA,
                    .pitcheiTeshuvah, .chokhmatShlomo]
        default:
            return []
        }
    }

    /// Returns the Sefaria `data-commentator` attribute value used in SA text for this
    /// commentary's sequential inline markers in the given section (0=OC, 1=YD, 2=EH, 3=CM).
    /// Returns nil if this commentary has no inline markers in that section.
    func saCommentatorDataName(forSection section: Int) -> String? {
        switch section {
        case 0: // Orach Chayim
            switch self {
            case .taz:             return "Turei Zahav"
            case .magenAvraham:    return "Magen Avraham"
            case .shaareiTeshuvah: return "Shaarei Teshuva"
            default:               return nil
            }
        case 1: // Yoreh De'ah
            switch self {
            case .taz:             return "Turei Zahav"
            case .shakh:           return "Siftei Kohen"
            case .pitcheiTeshuvah: return "Pithei Teshuva"
            default:               return nil
            }
        case 2: // Even HaEzer
            switch self {
            case .chelkatMechokek: return "Chelkat Mechokek"
            case .beitShmuel:      return "Beit Shmuel"
            case .pitcheiTeshuvah: return "Pithei Teshuva"
            default:               return nil
            }
        case 3: // Choshen Mishpat
            switch self {
            case .meiratEinayim:   return "Sema"
            case .shakh:           return "Siftei Kohen"
            case .pitcheiTeshuvah: return "Pithei Teshuva"
            default:               return nil
            }
        default:
            return nil
        }
    }

    /// True when this commentary has any inline markers in the SA text for the given section.
    /// Covers both data-commentator markers (saCommentatorDataName) and Mishnah Berurah's
    /// data-label markers in OC (section 0).
    func hasInlineSAMarkers(forSection section: Int) -> Bool {
        if saCommentatorDataName(forSection: section) != nil { return true }
        return self == .mishnahBerurah && section == 0
    }

    var displayName: String {
        switch self {
        case .onkelos:           return "Onkelos"
        case .rashiTanakh,
             .rashiTalmud:      return "Rashi"
        case .ramban:            return "Ramban"
        case .ibnEzra:           return "Ibn Ezra"
        case .abarbanel:         return "Abarbanel"
        case .rashbam:           return "Rashbam"
        case .sforno:            return "Sforno"
        case .haKtavVeHaKabalah: return "HaKtav VeHaKabalah"
        case .haamekDavar:       return "Ha'amek Davar + Harchev Davar"
        case .harchevDavar:      return "Harchev Davar"
        case .kliYakar:          return "Kli Yakar"
        case .malbim:            return "Malbim"
        case .meshechChokhmah:   return "Meshekh Chokhmah"
        case .orHaChaim:         return "Or HaChaim"
        case .ravHirsch:         return "Rav Hirsch"
        case .shadal:            return "Shadal"
        case .torahTemimah:      return "Torah Temimah"
        case .cassutoGenesis:    return "Cassuto (Genesis)"
        case .cassutoExodus:     return "Cassuto (Exodus)"
        case .hoffmannExodus:    return "Hoffmann (Exodus)"
        case .hoffmannLeviticus: return "Hoffmann (Leviticus)"
        case .jonathanSacks:     return "Jonathan Sacks"
        case .nechamaLeibowitz:  return "Nechama Leibowitz"
        case .radak:             return "Radak"
        case .ralbag:            return "Ralbag"
        case .alshich:           return "Alshich"
        case .metzudatZion:      return "Metzudat Zion"
        case .rishonLeTzion:     return "Or HaChaim"  // R. Chaim ibn Attar's Nakh work; titled "Rishon LeTzion" on Sefaria
        case .targumYonatan:     return "Targum Yonatan"
        case .targumKetuvim:     return "Targum"
        case .metzudatDavid:     return "Metzudat David"
        case .rambamMishnah:          return "Rambam"
        case .bartenura:              return "Bartenura"
        case .tosafotYomTov:          return "Tosafot Yom Tov"
        case .rashMiShantz:           return "Rash MiShantz"
        case .melekhetShlomo:         return "Melekhet Shlomo"
        case .tosafotRabbiAkivaEiger: return "Tosafot R. Akiva Eiger"
        case .yeshSederLaMishnah:     return "Yesh Seder LaMishnah"
        case .mishnatEretzYisrael:    return "Mishnat Eretz Yisrael (Safrai)"
        case .englishExplanation:     return "Kulp (English)"
        case .rashash:                return "Rashash"
        case .yachin:                 return "Yachin + Boaz"
        case .boaz:                   return "Boaz"
        case .raavad:                 return "Ra'avad"
        case .gra:                    return "Eliyahu Rabbah (Gra)"
        case .rabbeinuYonah:          return "Rabbeinu Yonah"
        case .derekhChayyim:          return "Derekh Chayyim (Maharal)"
        case .nachalatAvot:           return "Nachalat Avot (Abarbanel)"
        case .ranNedarim:             return "Ran"
        case .rabbeinuChananel:       return "Rabbeinu Chananel"
        case .rabbeinuGershom:        return "Rabbeinu Gershom"
        case .rashbamTalmud:          return "Rashbam"
        case .ran:                    return "Ran (Chiddushim)"
        case .ravNissimGaon:          return "Rav Nissim Gaon"
        case .mefareshTamid:          return "Pseudo-Rashi (Tamid)"
        case .chiddusheiRamban:       return "Ramban"
        case .rashba:                 return "Rashba"
        case .ritva:                  return "Ritva"
        case .meiri:                  return "Meiri"
        case .shitaMekubetzet:        return "Shita Mekubbetzet"
        case .raah:                   return "Ra'ah"
        case .yadRamah:               return "Yad Ramah"
        case .riMigash:               return "Ri Migash"
        case .chiddusheiHaRambam:     return "Rambam"
        case .tosafotHaRosh:          return "Tosafot HaRosh"
        case .tosafotRid:             return "Tosafot Rid"
        case .tosafotShantz:          return "Tosafot Shantz"
        case .tosafotYeshanim:        return "Tosafot Yeshanim"
        case .piskeiTosafot:          return "Piskei Tosafot"
        case .commentaryOfTheRosh:    return "Commentary of the Rosh"
        case .maharsha:          return "Maharsha"
        case .maharam:           return "Maharam"
        case .chokhmatShlomo:    return "Chokhmat Shlomo"
        case .rAbbiAkivaEiger:   return "R. Akiva Eiger"
        case .peneiYehoshua:     return "Penei Yehoshua"
        case .haflaahKetubot:    return "Haflaah"
        case .tzlach:            return "Tzelach"
        case .chatamSofer:       return "Chatam Sofer"
        case .arukhLaNer:        return "Arukh LaNer"
        case .reshimotShiurim:   return "Reshimot Shiurim (Rav Soloveitchik)"
        case .einAyah:           return "Ein Ayah (Rav Kook)"
        case .peneiMoshe:        return "Penei Moshe"
        case .mareyHaPanim:      return "Mareh HaPanim"
        case .ohrLayesharim:     return "Ohr LaYesharim"
        case .toseftaKifshutah:  return "Tosefta Kifshutah"
        case .briefCommentary:   return "Brief Commentary (Lieberman)"
        case .tosafot:                return "Tosafot"
        case .maggidMishnah:        return "Maggid Mishneh"
        case .kesefMishnah:         return "Kesef Mishneh"
        case .migdalOz:             return "Migdal Oz"
        case .lochemMishnah:        return "Lechem Mishneh"
        case .mishnahLaMelech:      return "Mishneh LaMelech"
        case .mahariKurkusRadbaz:   return "Mahari Kurkus & Radbaz"
        case .kiryatSefer:          return "Kiryat Sefer"
        case .maasehRokeach:        return "Maaseh Rokeach"
        case .orSameach:            return "Or Sameach"
        case .avodatHaMelekh:       return "Avodat HaMelekh"
        case .evenHaAzel:           return "Even HaAzel"
        case .mishnahBerurah:    return "Mishnah Berurah"
        case .shaareiTeshuvah:   return "Shaarei Teshuvah"
        case .biurHalakha:       return "Biur Halakha"
        case .shakh:             return "Shakh"
        case .taz:               return "Taz"
        case .chelkatMechokek:   return "Chelkat Mechokek"
        case .beitShmuel:        return "Beit Shmuel"
        case .meiratEinayim:     return "Me'irat Einayim"
        case .pitcheiTeshuvah:   return "Pitchei Teshuvah"
        case .baerHetev:                return "Ba'er Hetev"
        case .beurHagraSA:              return "Beur HaGra"
        case .kafHaChaim:               return "Kaf HaChayim"
        case .magenAvraham:             return "Magen Avraham"
        case .eliyaRabbah:              return "Eliyah Rabbah"
        case .priMegadimOC, .priMegadimYD: return "Peri Megadim"
        case .nekudatHaKesef:           return "Nekudat HaKesef"
        case .keretiUPeleti:            return "Kereti u'Peleti"
        case .toratHaShlamim:           return "Torat HaShlamim"
        case .beitMeir:                 return "Beit Meir"
        case .ezerMiKodesh:             return "Ezer MiKodesh"
        case .ktzotHaChoshen:           return "Ktzot HaChoshen"
        case .netivotHaMishpat:         return "Netivot HaMishpat"
        case .urimVTumim:               return "Urim v'Tumim"
        case .hagahotRAE:               return "Hagahot R. Akiva Eiger"
        }
    }

    var hebrewDisplayName: String {
        switch self {
        case .onkelos:                return "אונקלוס"
        case .rashiTanakh,
             .rashiTalmud:           return "רש״י"
        case .ramban:                 return "רמב״ן"
        case .ibnEzra:                return "אבן עזרא"
        case .abarbanel:              return "אברבנאל"
        case .rashbam,
             .rashbamTalmud:         return "רשב״ם"
        case .sforno:                 return "ספורנו"
        case .haKtavVeHaKabalah:     return "הכתב והקבלה"
        case .haamekDavar:            return "העמק דבר + הרחב דבר"
        case .harchevDavar:           return "הרחב דבר"
        case .kliYakar:               return "כלי יקר"
        case .malbim:                 return "מלבי״ם"
        case .meshechChokhmah:        return "משך חכמה"
        case .orHaChaim:              return "אור החיים"
        case .ravHirsch:              return "רב הירש"
        case .shadal:                 return "שד״ל"
        case .torahTemimah:           return "תורה תמימה"
        case .cassutoGenesis:         return "קאסוטו (בראשית)"
        case .cassutoExodus:          return "קאסוטו (שמות)"
        case .hoffmannExodus:         return "הופמן (שמות)"
        case .hoffmannLeviticus:      return "הופמן (ויקרא)"
        case .jonathanSacks:          return "הרב סקס"
        case .nechamaLeibowitz:       return "נחמה ליבוביץ"
        case .radak:                  return "רד״ק"
        case .ralbag:                 return "רלב״ג"
        case .alshich:                return "אלשיך"
        case .metzudatZion:           return "מצודת ציון"
        case .rishonLeTzion:          return "אור החיים"
        case .targumYonatan:          return "תרגום יונתן"
        case .targumKetuvim:          return "תרגום"
        case .metzudatDavid:          return "מצודת דוד"
        case .rambamMishnah:          return "רמב״ם"
        case .bartenura:              return "ברטנורא"
        case .tosafotYomTov:          return "תוספות יו״ט"
        case .rashMiShantz:           return "ר״ש מסנץ"
        case .melekhetShlomo:         return "מלאכת שלמה"
        case .tosafotRabbiAkivaEiger: return "תוספות ר׳ עקיבא איגר"
        case .yeshSederLaMishnah:     return "יש סדר למשנה"
        case .mishnatEretzYisrael:    return "משנת ארץ ישראל"
        case .englishExplanation:     return "קולפ (אנגלית)"
        case .rashash:                return "רש״ש"
        case .yachin:                 return "יכין + בועז"
        case .boaz:                   return "בועז"
        case .raavad:                 return "ראב״ד"
        case .gra:                    return "אליהו רבה (גר״א)"
        case .rabbeinuYonah:          return "רבינו יונה"
        case .derekhChayyim:          return "דרך חיים (מהר״ל)"
        case .nachalatAvot:           return "נחלת אבות (אברבנאל)"
        case .ranNedarim:             return "ר״ן"
        case .rabbeinuChananel:       return "רבינו חננאל"
        case .rabbeinuGershom:        return "רבינו גרשם"
        case .ran:                    return "ר״ן (חידושים)"
        case .ravNissimGaon:          return "רב ניסים גאון"
        case .mefareshTamid:          return "פסאודו-רש״י (תמיד)"
        case .chiddusheiRamban:       return "רמב״ן"
        case .rashba:                 return "רשב״א"
        case .ritva:                  return "ריטב״א"
        case .meiri:                  return "מאירי"
        case .shitaMekubetzet:        return "שיטה מקובצת"
        case .raah:                   return "ר״אה"
        case .yadRamah:               return "יד רמה"
        case .riMigash:               return "ר״י מיגאש"
        case .chiddusheiHaRambam:     return "רמב״ם"
        case .tosafotHaRosh:          return "תוספות הרא״ש"
        case .tosafotRid:             return "תוספות ר״י"
        case .tosafotShantz:          return "תוספות שאנץ"
        case .tosafotYeshanim:        return "תוספות ישנים"
        case .piskeiTosafot:          return "פסקי תוספות"
        case .commentaryOfTheRosh:    return "פירוש הרא״ש"
        case .tosafot:                return "תוספות"
        case .maharsha:               return "מהרש״א"
        case .maharam:                return "מהר״ם"
        case .chokhmatShlomo:         return "חכמת שלמה"
        case .rAbbiAkivaEiger:        return "ר׳ עקיבא איגר"
        case .peneiYehoshua:          return "פני יהושע"
        case .haflaahKetubot:         return "האפלה"
        case .tzlach:                 return "צל״ח"
        case .chatamSofer:            return "חתם סופר"
        case .arukhLaNer:             return "ערוך לנר"
        case .reshimotShiurim:        return "רשימות שיעורים (הגרי״ד)"
        case .einAyah:                return "עין איה (הראי״ה קוק)"
        case .peneiMoshe:             return "פני משה"
        case .mareyHaPanim:           return "מראה הפנים"
        case .ohrLayesharim:          return "אור לישרים"
        case .toseftaKifshutah:       return "תוספתא כפשוטה"
        case .briefCommentary:        return "פירוש קצר (ליברמן)"
        case .maggidMishnah:          return "מגיד משנה"
        case .kesefMishnah:           return "כסף משנה"
        case .migdalOz:               return "מגדל עוז"
        case .lochemMishnah:          return "לחם משנה"
        case .mishnahLaMelech:        return "משנה למלך"
        case .mahariKurkusRadbaz:     return "מהרי קורקוס ורדב״ז"
        case .kiryatSefer:            return "קרית ספר"
        case .maasehRokeach:          return "מעשה רוקח"
        case .orSameach:              return "אור שמח"
        case .avodatHaMelekh:         return "עבודת המלך"
        case .evenHaAzel:             return "אבן האזל"
        case .mishnahBerurah:         return "משנה ברורה"
        case .shaareiTeshuvah:        return "שערי תשובה"
        case .biurHalakha:            return "ביאור הלכה"
        case .shakh:                  return "ש״ך"
        case .taz:                    return "ט״ז"
        case .chelkatMechokek:        return "חלקת מחוקק"
        case .beitShmuel:             return "בית שמואל"
        case .meiratEinayim:          return "מאירת עיניים (סמ״ע)"
        case .pitcheiTeshuvah:        return "פתחי תשובה"
        case .baerHetev:              return "באר היטב"
        case .beurHagraSA:            return "ביאור הגר״א"
        case .kafHaChaim:             return "כף החיים"
        case .magenAvraham:           return "מגן אברהם"
        case .eliyaRabbah:            return "אליה רבה"
        case .priMegadimOC,
             .priMegadimYD:          return "פרי מגדים"
        case .nekudatHaKesef:         return "נקודת הכסף"
        case .keretiUPeleti:          return "כרתי ופלתי"
        case .toratHaShlamim:         return "תורת השלמים"
        case .beitMeir:               return "בית מאיר"
        case .ezerMiKodesh:           return "עזר מקודש"
        case .ktzotHaChoshen:         return "קצות החושן"
        case .netivotHaMishpat:       return "נתיבות המשפט"
        case .urimVTumim:             return "אורים ותומים"
        case .hagahotRAE:             return "הגהות ר׳ עקיבא איגר"
        }
    }

    /// Returns the Sefaria ref for this commentary given the main text ref.
    func sefariaRef(forMainRef mainRef: String) -> String {
        switch self {
        case .onkelos:           return "Onkelos \(mainRef)"
        case .rashiTanakh,
             .rashiTalmud:      return "Rashi on \(mainRef)"
        case .ramban:            return "Ramban on \(mainRef)"
        case .ibnEzra:           return "Ibn Ezra on \(mainRef)"
        case .abarbanel:         return abarbanalRef(from: mainRef)
        case .rashbam:           return "Rashbam on \(mainRef)"
        case .sforno:            return "Sforno on \(mainRef)"
        case .haKtavVeHaKabalah: return "HaKtav VeHaKabalah, \(mainRef)"
        case .haamekDavar:       return "Haamek Davar on \(mainRef)"
        case .harchevDavar:      return "Harchev Davar on \(mainRef)"
        case .kliYakar:          return "Kli Yakar on \(mainRef)"
        case .malbim:            return "Malbim on \(mainRef)"
        case .meshechChokhmah:   return meshechChokhmahRef(from: mainRef)
        case .orHaChaim:         return "Or HaChaim on \(mainRef)"
        case .ravHirsch:         return "Rav Hirsch on Torah, \(mainRef)"
        case .shadal:            return "Shadal on \(mainRef)"
        case .torahTemimah:      return "Torah Temimah on Torah, \(mainRef)"
        // Cassuto/Hoffmann are book-specific; ref fixed to their book with current chapter.
        case .cassutoGenesis:    return cassutoGenesisRef(from: mainRef)
        case .cassutoExodus:     return "Cassuto on Exodus \(extractChapter(mainRef))"
        case .hoffmannExodus:    return "David Zvi Hoffmann on Exodus \(extractChapter(mainRef))"
        case .hoffmannLeviticus: return "David Zvi Hoffmann on Leviticus \(extractChapter(mainRef))"
        case .jonathanSacks:     return "Jonathan Sacks Torah Commentary on \(mainRef)"
        case .nechamaLeibowitz:  return "Nechama Leibowitz on \(mainRef)"
        case .radak:             return "Radak on \(mainRef)"
        case .ralbag:            return ralbagRef(from: mainRef)
        case .alshich:           return alshichRef(from: mainRef)
        case .metzudatZion:      return "Metzudat Zion on \(mainRef)"
        case .rishonLeTzion:     return "Rishon LeTzion on \(mainRef)"
        case .targumYonatan:     return "Targum Jonathan on \(mainRef)"
        case .targumKetuvim:     return "Targum \(mainRef)"
        case .metzudatDavid:     return "Metzudat David on \(mainRef)"
        case .rambamMishnah:          return "Rambam on \(mainRef)"
        case .bartenura:              return "Bartenura on \(mainRef)"
        case .tosafotYomTov:          return "Tosafot Yom Tov on \(mainRef)"
        case .rashMiShantz:           return "Rash MiShantz on \(mainRef)"
        case .melekhetShlomo:         return "Melekhet Shelomoh on \(mainRef)"
        case .tosafotRabbiAkivaEiger: return "Tosafot Rabbi Akiva Eiger on \(mainRef)"
        case .yeshSederLaMishnah:     return "Yesh Seder LaMishnah on \(mainRef)"
        case .mishnatEretzYisrael:    return "Mishnat Eretz Yisrael on \(mainRef)"
        case .englishExplanation:     return "English Explanation of \(mainRef)"
        case .rashash:                return "Rashash on \(mainRef)"
        case .yachin:                 return "Yachin on \(mainRef)"
        case .boaz:                   return "Boaz on \(mainRef)"
        case .raavad:                 return "Ra'avad on \(mainRef)"
        // Gra on Avot: "Gra on Pirkei Avot X"; on Taharot: "Eliyahu Rabbah on Mishnah X Y"
        case .gra:
            return mainRef.hasPrefix("Pirkei Avot")
                ? "Gra on \(mainRef)"
                : "Eliyahu Rabbah on \(mainRef)"
        case .rabbeinuYonah:          return "Rabbeinu Yonah on \(mainRef)"
        case .derekhChayyim:          return "Derekh Chayyim \(extractChapter(mainRef))"
        case .nachalatAvot:           return "Nachalat Avot on Avot \(extractChapter(mainRef))"
        case .ranNedarim:             return "Ran on \(mainRef)"
        case .rabbeinuChananel:       return "Rabbeinu Chananel on \(mainRef)"
        case .rabbeinuGershom:        return "Rabbeinu Gershom on \(mainRef)"
        case .rashbamTalmud:          return "Rashbam on \(mainRef)"
        case .ran:                    return "Ran on \(mainRef)"
        case .ravNissimGaon:          return "Rav Nissim Gaon on \(mainRef)"
        case .mefareshTamid:          return "Mefaresh on \(mainRef)"
        case .chiddusheiRamban:       return "Chiddushei Ramban on \(mainRef)"
        case .rashba:                 return "Rashba on \(mainRef)"
        case .ritva:                  return "Ritva on \(mainRef)"
        case .meiri:                  return "Meiri on \(mainRef)"
        case .shitaMekubetzet:        return shitaMekubetzetRef(from: mainRef)
        case .raah:                   return "Chiddushei HaRa'ah on \(mainRef)"
        case .yadRamah:               return "Yad Ramah on \(mainRef)"
        case .riMigash:               return "Ri Migash on \(mainRef)"
        case .chiddusheiHaRambam:     return "Chiddushei HaRambam on \(mainRef)"
        case .tosafotHaRosh:          return "Tosafot HaRosh on \(mainRef)"
        case .tosafotRid:             return "Tosafot Rid on \(mainRef)"
        case .tosafotShantz:          return "Tosafot Shantz on \(mainRef)"
        case .tosafotYeshanim:        return "Tosafot Yeshanim on \(mainRef)"
        case .piskeiTosafot:          return "Piskei Tosafot on \(mainRef)"
        case .commentaryOfTheRosh:    return "Commentary of the Rosh on \(mainRef)"
        case .maharsha:          return "Chidushei Halachot on \(mainRef)"
        case .maharam:           return "Maharam on \(mainRef)"
        case .chokhmatShlomo:    return "Chokhmat Shlomo on \(mainRef)"
        case .rAbbiAkivaEiger:   return "Gilyon HaShas on \(mainRef)"
        case .peneiYehoshua:     return "Penei Yehoshua on \(mainRef)"
        case .haflaahKetubot:    return "Haflaah on \(mainRef)"
        case .tzlach:            return "Tziyyun LeNefesh Chayyah on \(mainRef)"
        case .chatamSofer:       return "Chidushei Chatam Sofer on \(mainRef)"
        case .arukhLaNer:        return "Arukh LaNer on \(mainRef)"
        case .reshimotShiurim:   return "Reshimot Shiurim on \(mainRef)"
        case .einAyah:           return ""   // bundled — never fetched from Sefaria
        case .peneiMoshe:        return "Penei Moshe on \(mainRef)"
        case .mareyHaPanim:      return "Mareh HaPanim on \(mainRef)"
        case .ohrLayesharim:     return "Ohr LaYesharim on \(mainRef)"
        case .toseftaKifshutah:
            // Sefaria ref omits "Tosefta " prefix: "Tosefta Kifshutah on Berakhot 1"
            let r = mainRef.hasPrefix("Tosefta ") ? String(mainRef.dropFirst(8)) : mainRef
            return "Tosefta Kifshutah on \(r)"
        case .briefCommentary:
            let r = mainRef.hasPrefix("Tosefta ") ? String(mainRef.dropFirst(8)) : mainRef
            return "Brief Commentary on \(r)"
        case .tosafot:                return "Tosafot on \(mainRef)"
        case .maggidMishnah:      return "Maggid Mishneh on \(mainRef)"
        case .kesefMishnah:       return "Kessef Mishneh on \(mainRef)"
        case .migdalOz:           return "Migdal Oz on \(mainRef)"
        case .lochemMishnah:      return "Lechem Mishneh on \(mainRef)"
        case .mishnahLaMelech:    return "Mishneh LaMelech on \(mainRef)"
        case .mahariKurkusRadbaz: return "Commentary of Mahari Kurkus and Radbaz on \(mainRef)"
        case .kiryatSefer:        return "Kiryat Sefer on \(mainRef)"
        case .maasehRokeach:      return maasehRokeachRef(from: mainRef)
        case .orSameach:          return "Ohr Sameach on \(mainRef)"
        case .avodatHaMelekh:     return "Avodat HaMelekh on \(mainRef)"
        case .evenHaAzel:         return "Even Ha'azel on \(mainRef)"
        case .mishnahBerurah:    return mishnahBerurahRef(from: mainRef)
        case .shaareiTeshuvah:   return "Sha'arei Teshuvah on \(mainRef)"
        case .biurHalakha:       return biurHalakhaRef(from: mainRef)
        case .shakh:             return "Siftei Kohen on \(mainRef)"
        case .taz:               return "Turei Zahav on \(mainRef)"
        case .chelkatMechokek:   return "Chelkat Mechokek on \(mainRef)"
        case .beitShmuel:        return "Beit Shmuel on \(mainRef)"
        case .meiratEinayim:     return "Me'irat Einayim on \(mainRef)"
        case .pitcheiTeshuvah:   return "Pitchei Teshuva on \(mainRef)"
        case .baerHetev:        return "Ba'er Hetev on \(mainRef)"
        case .beurHagraSA:      return "Beur HaGra on \(mainRef)"
        case .kafHaChaim:       return "Kaf HaChayim on \(mainRef)"
        case .magenAvraham:     return magenAvrahamRef(from: mainRef)
        case .eliyaRabbah:      return "Eliyah Rabbah on \(mainRef)"
        case .priMegadimOC:
            return "Peri Megadim on Orach Chayim, Mishbezot Zahav \(extractChapter(mainRef))"
        case .nekudatHaKesef:   return "Nekudot HaKesef on \(mainRef)"
        case .priMegadimYD:
            return "Peri Megadim on Yoreh De'ah, Mishbezot Zahav \(extractChapter(mainRef))"
        case .keretiUPeleti:    return "Kereti on \(mainRef)"
        case .toratHaShlamim:   return "Torat HaShlamim on \(mainRef)"
        case .beitMeir:         return "Beit Meir on \(mainRef)"
        case .ezerMiKodesh:     return "Ezer MiKodesh on \(mainRef)"
        case .ktzotHaChoshen:   return "Ketzot HaChoshen on \(mainRef)"
        case .netivotHaMishpat:
            return "Netivot HaMishpat, Hidushim on Shulchan Arukh, Choshen Mishpat \(extractChapter(mainRef))"
        case .urimVTumim:       return "Urim VeTumim, Urim \(extractChapter(mainRef))"
        case .hagahotRAE:       return "Rabbi Akiva Eiger on \(mainRef)"
        }
    }

    private func mishnahBerurahRef(from mainRef: String) -> String {
        // "Shulchan Arukh, Orach Chaim 12" → "Mishnah Berurah 12"
        let pattern = #"(\d+)$"#
        if let range = mainRef.range(of: pattern, options: .regularExpression) {
            return "Mishnah Berurah \(mainRef[range])"
        }
        return "Mishnah Berurah 1"
    }

    private func magenAvrahamRef(from mainRef: String) -> String {
        // Magen Avraham is indexed by siman number on Sefaria, like Mishnah Berurah.
        // "Shulchan Arukh, Orach Chayim 12" → "Magen Avraham 12"
        let pattern = #"(\d+)$"#
        if let range = mainRef.range(of: pattern, options: .regularExpression) {
            return "Magen Avraham \(mainRef[range])"
        }
        return "Magen Avraham 1"
    }

    /// Extracts the trailing chapter/number from a ref like "Genesis 5" → "5".
    private func extractChapter(_ ref: String) -> String {
        ref.split(separator: " ").last.map(String.init) ?? "1"
    }

    // Torah book names used in Sefaria refs — for Torah-vs-Nakh detection
    private static let torahBookNames: Set<String> =
        ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]

    /// Extracts just the book name from a ref like "Song of Songs 3" → "Song of Songs".
    private func extractBookName(_ ref: String) -> String {
        let parts = ref.components(separatedBy: " ")
        return parts.dropLast().joined(separator: " ")
    }

    /// Abarbanel on Torah uses the combined title "Abarbanel on Torah, Genesis 1";
    /// Abarbanel on Nakh books uses individual titles "Abarbanel on Joshua 1".
    private func abarbanalRef(from mainRef: String) -> String {
        let book = extractBookName(mainRef)
        if Self.torahBookNames.contains(book) {
            return "Abarbanel on Torah, \(mainRef)"
        }
        return "Abarbanel on \(mainRef)"
    }

    /// Ralbag on Torah uses the combined title "Ralbag on Torah, Genesis 1".
    /// Nakh books use "Ralbag on Joshua 1" etc., except Ruth and Esther which
    /// drop the "on": "Ralbag Ruth 1" / "Ralbag Esther 1".
    private func ralbagRef(from mainRef: String) -> String {
        let book = extractBookName(mainRef)
        if Self.torahBookNames.contains(book) {
            return "Ralbag on Torah, \(mainRef)"
        }
        if book == "Ruth" || book == "Esther" {
            return "Ralbag \(mainRef)"
        }
        return "Ralbag on \(mainRef)"
    }

    /// Alshich's Nakh commentaries each have a unique Hebrew title per book.
    private func alshichRef(from mainRef: String) -> String {
        let book = extractBookName(mainRef)
        let chapter = mainRef.components(separatedBy: " ").last ?? "1"
        let titleMap: [String: String] = [
            // Nevi'im
            "Joshua":    "Marot HaTzoveot on Joshua",
            "Judges":    "Marot HaTzoveot on Judges",
            "I Samuel":  "Marot HaTzoveot on I Samuel",
            "II Samuel": "Marot HaTzoveot on II Samuel",
            "I Kings":   "Marot HaTzoveot on I Kings",
            "II Kings":  "Marot HaTzoveot on II Kings",
            // Ketuvim
            "Psalms":        "Romemot El on Psalms",
            "Proverbs":      "Rav Peninim on Proverbs",
            "Job":           "Chelkat Mechokek on Job",
            "Song of Songs": "Shoshanat HaAmakim on Song of Songs",
            "Ruth":          "Einei Moshe on Ruth",
            "Lamentations":  "Devarim Nichumim on Lamentations",
            "Ecclesiastes":  "Devarim Tovim on Ecclesiastes",
            "Esther":        "Masat Moshe on Esther",
            "Daniel":        "Chavatzelet HaSharon on Daniel",
        ]
        if let title = titleMap[book] {
            return "\(title) \(chapter)"
        }
        return "Alshich on \(mainRef)"   // fallback (e.g. Torah if ever added)
    }

    /// Meshekh Chokhmah uses Hebrew parasha names instead of English book names.
    /// mainRef is like "Genesis 1"; result is like "Meshekh Chokhmah, Bereshit 1".
    private func meshechChokhmahRef(from mainRef: String) -> String {
        let hebrewNames: [String: String] = [
            "Genesis": "Bereshit", "Exodus": "Shemot", "Leviticus": "Vayikra",
            "Numbers": "Bamidbar", "Deuteronomy": "Devarim",
        ]
        let parts = mainRef.components(separatedBy: " ")
        guard parts.count >= 2, let heBook = hebrewNames[parts[0]] else {
            return "Meshekh Chokhmah, \(mainRef)"
        }
        let chapter = parts.dropFirst().joined(separator: " ")
        return "Meshekh Chokhmah, \(heBook) \(chapter)"
    }

    /// Maaseh Rokeach omits "Mishneh Torah, " from its prefix on Sefaria.
    private func maasehRokeachRef(from mainRef: String) -> String {
        let stripped = mainRef.replacingOccurrences(of: "Mishneh Torah, ", with: "")
        return "Maaseh Rokeach on \(stripped)"
    }

    // MARK: - Rambam availability

    /// Returns whether this commentary has known content for the given Rambam work ID (0-based).
    func isAvailableForRambam(workId: Int) -> Bool {
        switch self {
        case .migdalOz:
            // Covers Madda–Haflaah (0–28) + Nezikin–Shoftim (48–67).
            // No content for Zeraim, Avodah, Korbanot, Taharah (29–47 + 68–72).
            return workId < 29 || (workId >= 48 && workId <= 67)
        case .mahariKurkusRadbaz:
            // Sefer Avodah only: Beit HaBechirah (34), Klei HaMikdash (35), Bi'at HaMikdash (36)
            return workId == 34 || workId == 35 || workId == 36
        case .avodatHaMelekh:
            // Sefer HaMadda only (0–4)
            return workId <= 4
        case .evenHaAzel:
            // Covers most of Mishneh Torah but lacks:
            // Torah Study (2), Repentance (4), Circumcision (10),
            // Haflaah: Oaths/Vows/Nazariteship/Appraisals (25–28),
            // Zeraim except Heave Offerings (30–33)
            let missing: Set<Int> = [2, 4, 10, 25, 26, 27, 28, 30, 31, 32, 33]
            return !missing.contains(workId)
        default:
            return true
        }
    }

    // MARK: - Book availability

    /// Returns whether this commentary has known content for the given Tanakh book index.
    /// Used to filter the picker so only relevant options are shown for the current book.
    func isAvailable(forTanakhBookIndex bookIndex: Int) -> Bool {
        switch self {

        // Torah-only commentaries — no Nakh content
        case .onkelos, .rashbam, .sforno, .haKtavVeHaKabalah, .haamekDavar,
             .harchevDavar, .kliYakar, .meshechChokhmah, .orHaChaim, .ravHirsch,
             .shadal, .torahTemimah, .nechamaLeibowitz, .jonathanSacks:
            return bookIndex <= 4

        // Book-specific Torah commentaries
        case .cassutoGenesis:
            return bookIndex == 0                           // Genesis only
        case .cassutoExodus, .hoffmannExodus:
            return bookIndex == 1                           // Exodus only
        case .hoffmannLeviticus:
            return bookIndex == 2                           // Leviticus only
        case .malbim:
            return bookIndex != 2                           // all Tanakh except Leviticus (not chapter-verse there)

        // Nakh-only commentaries (not on Torah)
        case .rishonLeTzion:
            return bookIndex >= 5                           // all Nakh + Ketuvim
        case .targumYonatan:
            return bookIndex >= 5 && bookIndex <= 25        // Nevi'im only
        case .metzudatDavid, .metzudatZion:
            return bookIndex >= 5                           // all Nakh
        case .targumKetuvim:
            return bookIndex >= 26                          // Ketuvim only

        // Ibn Ezra: Torah + Isaiah + all 12 Minor Prophets + select Ketuvim
        // (No Joshua, Judges, Samuel, Kings, Jeremiah, Ezekiel, Proverbs,
        //  Ruth, Lamentations, Daniel, Ezra-Nehemiah, Chronicles)
        case .ibnEzra:
            let covered: Set<Int> = [
                0, 1, 2, 3, 4,                              // Torah
                11,                                         // Isaiah
                14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, // 12 Minor Prophets
                26, 28, 29, 32, 33,                         // Psalms, Job, Song, Ecclesiastes, Esther
            ]
            return covered.contains(bookIndex)

        // Ralbag: Torah + Early Prophets + select Ketuvim
        // (No Isaiah, Jeremiah, Ezekiel, 12 Minor Prophets, Psalms,
        //  Lamentations, Daniel, Ezra-Nehemiah, Chronicles)
        case .ralbag:
            let covered: Set<Int> = [
                0, 1, 2, 3, 4,                              // Torah
                5, 6, 7, 8, 9, 10,                          // Joshua through II Kings
                27, 28, 29, 30, 32, 33,                     // Proverbs, Job, Song, Ruth, Ecclesiastes, Esther
            ]
            return covered.contains(bookIndex)

        // Alshich: Early Prophets + select Ketuvim
        // (No Isaiah, Jeremiah, Ezekiel, 12 Minor Prophets, Ezra-Nehemiah, Chronicles)
        case .alshich:
            let covered: Set<Int> = [
                5, 6, 7, 8, 9, 10,                          // Joshua through II Kings
                26, 27, 28, 29, 30, 31, 32, 33, 34,         // Psalms through Daniel
            ]
            return covered.contains(bookIndex)

        default:
            return true
        }
    }

    // MARK: - Talmud availability

    /// Returns whether this commentary has known content on Sefaria for the given tractate.
    /// tractateId matches the `id` field in TextCatalog (0=Berakhot, 1=Shabbat, …).
    func isAvailableForTalmud(tractateId: Int) -> Bool {
        switch self {
        case .rabbeinuChananel:
            // Shabbat(1) Pesachim(3) Yoma(5) Sukkah(6) RH(8) Taanit(9) MK(11)
            // BK(20) BM(21) Sanhedrin(23) Makkot(24) AZ(26)
            let covered: Set<Int> = [1, 3, 5, 6, 8, 9, 11, 20, 21, 23, 24, 26]
            return covered.contains(tractateId)
        case .rabbeinuGershom:
            return tractateId == 22 || tractateId == 24     // Bava Batra, Makkot
        case .rashbamTalmud:
            return tractateId == 3  || tractateId == 22    // Pesachim, Bava Batra
        case .ranNedarim:
            return tractateId == 15                         // Nedarim only (the peirush)
        case .ran:
            // Shabbat(1) Pesachim(3) RH(8) Ketubot(14) Gittin(18) Kiddushin(19)
            // Nedarim(15) is the peirush, handled by .ranNedarim
            let covered: Set<Int> = [1, 3, 8, 14, 18, 19]
            return covered.contains(tractateId)
        case .ravNissimGaon:
            return tractateId == 0  || tractateId == 1     // Berakhot, Shabbat
        case .mefareshTamid:
            return tractateId == 36                         // Tamid only
        case .raah:
            return tractateId == 14                         // Ketubot only
        case .yadRamah:
            return tractateId == 22 || tractateId == 23    // Bava Batra, Sanhedrin
        case .riMigash:
            return tractateId == 22 || tractateId == 25    // Bava Batra, Shevuot
        case .chiddusheiHaRambam:
            return tractateId == 8                          // Rosh Hashanah only
        case .tosafotHaRosh:
            return tractateId == 0                          // Berakhot only (Sefaria)
        case .tosafotRid:
            // Single: Shabbat(1) Eruvin(2) Pesachim(3) Yoma(5) Sukkah(6) Beitzah(7)
            // RH(8) Taanit(9) Megillah(10) MK(11) Chagigah(12) Yevamot(13) Ketubot(14)
            // Nedarim(15) Nazir(16) Gittin(18) Kiddushin(19) BK(20) BM(21) BB(22) AZ(26) Niddah(39)
            let covered: Set<Int> = [1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,18,19,20,21,22,26,39]
            return covered.contains(tractateId)
        case .tosafotShantz:
            return tractateId == 17                         // Sotah only
        case .tosafotYeshanim:
            let covered: Set<Int> = [5, 13, 34]            // Yoma, Yevamot, Keritot
            return covered.contains(tractateId)
        case .commentaryOfTheRosh:
            let covered: Set<Int> = [15, 16, 36]           // Nedarim, Nazir, Tamid
            return covered.contains(tractateId)
        case .chiddusheiRamban:
            // Berakhot(0) Shabbat(1) Eruvin(2) Pesachim(3) Yoma(5) Sukkah(6) Beitzah(7)
            // RH(8) Taanit(9) Megillah(10) MK(11) Chagigah(12) Yevamot(13) Ketubot(14)
            // Nazir(16) Sotah(17) Gittin(18) Kiddushin(19) BM(21) BB(22)
            // Sanhedrin(23) Makkot(24) Shevuot(25) AZ(26) Chullin(30) Niddah(39)
            let covered: Set<Int> = [0,1,2,3,5,6,7,8,9,10,11,12,13,14,16,17,18,19,21,22,23,24,25,26,30,39]
            return covered.contains(tractateId)
        case .rashba:
            // Berakhot(0) Shabbat(1) Eruvin(2) Beitzah(7) RH(8) Megillah(10)
            // Yevamot(13) Ketubot(14) Nedarim(15) Gittin(18) Kiddushin(19)
            // BK(20) BM(21) BB(22) Shevuot(25) AZ(26) Menachot(29) Chullin(30) Niddah(39)
            let covered: Set<Int> = [0,1,2,7,8,10,13,14,15,18,19,20,21,22,25,26,29,30,39]
            return covered.contains(tractateId)
        case .ritva:
            // Berakhot(0) Eruvin(2) Pesachim(3) Yoma(5) Sukkah(6) RH(8) Taanit(9)
            // Megillah(10) MK(11) Yevamot(13) Ketubot(14) Nedarim(15) Kiddushin(19)
            // Makkot(24) Shevuot(25) AZ(26) Chullin(30) Niddah(39)
            let covered: Set<Int> = [0,2,3,5,6,8,9,10,11,13,14,15,19,24,25,26,30,39]
            return covered.contains(tractateId)
        case .meiri:
            // Berakhot(0) Shabbat(1) Eruvin(2) Pesachim(3) Yoma(5) Sukkah(6) Beitzah(7)
            // RH(8) Taanit(9) Megillah(10) MK(11) Chagigah(12) Yevamot(13) Ketubot(14)
            // Nedarim(15) Nazir(16) Sotah(17) Gittin(18) Kiddushin(19)
            // BK(20) BM(21) BB(22) Sanhedrin(23) Makkot(24) Shevuot(25) AZ(26) Horayot(27)
            // Chullin(30) Tamid(36) Niddah(39)
            let covered: Set<Int> = [0,1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,30,36,39]
            return covered.contains(tractateId)
        case .shitaMekubetzet:
            // Berakhot(0) Beitzah(7) Ketubot(14) Nedarim(15) Nazir(16) Sotah(17)
            // BK(20) BM(21) BB(22)
            let covered: Set<Int> = [0,7,14,15,16,17,20,21,22]
            return covered.contains(tractateId)
        case .piskeiTosafot:
            // Berakhot(0) Shabbat(1) Eruvin(2) Pesachim(3) Yoma(5) Sukkah(6) Beitzah(7)
            // RH(8) Taanit(9) Megillah(10) MK(11) Chagigah(12) Yevamot(13) Ketubot(14)
            // Nedarim(15) Sotah(17) Gittin(18) Kiddushin(19) BK(20) BM(21) BB(22)
            // Sanhedrin(23) Makkot(24) Shevuot(25) AZ(26) Zevachim(28) Menachot(29)
            // Chullin(30) Bekhorot(31) Arakhin(32) Temurah(33) Keritot(34) Meilah(35)
            // Tamid(36) Niddah(39)
            let covered: Set<Int> = [0,1,2,3,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,26,28,29,30,31,32,33,34,35,36,39]
            return covered.contains(tractateId)
        // ── Standard Acharonim ──────────────────────────────────────────────────
        case .maharsha:
            // All Bavli tractates except Shekalim (4, Yerushalmi only)
            return tractateId != 4
        case .maharam:
            // Shabbat(1) Eruvin(2) Pesachim(3) Sukkah(6) Beitzah(7)
            // Yevamot(13) Ketubot(14) Gittin(18) Kiddushin(19)
            // BK(20) BM(21) BB(22) Sanhedrin(23) Makkot(24) AZ(26) Chullin(30) Niddah(39)
            let covered: Set<Int> = [1,2,3,6,7,13,14,18,19,20,21,22,23,24,26,30,39]
            return covered.contains(tractateId)
        case .rAbbiAkivaEiger:
            // All Bavli except Shekalim (4, Yerushalmi) and Tamid (36, mishnahOnly)
            return tractateId != 4 && tractateId != 36
        case .rashash:
            // Talmud context: all Bavli except Shekalim (4) and Tamid (36)
            return tractateId != 4 && tractateId != 36
        // ── Additional Acharonim ────────────────────────────────────────────────
        case .peneiYehoshua:
            // Berakhot(0) Shabbat(1) Pesachim(3) Yoma(5) Sukkah(6) Beitzah(7) RH(8)
            // Megillah(10) Ketubot(14) Gittin(18) Kiddushin(19) BK(20) BM(21)
            // Makkot(24) Shevuot(25) Chullin(30)
            let covered: Set<Int> = [0,1,3,5,6,7,8,10,14,18,19,20,21,24,25,30]
            return covered.contains(tractateId)
        case .haflaahKetubot:
            return tractateId == 14  // Ketubot only
        case .tzlach:
            // Berakhot(0) Shabbat(1) Eruvin(2) RH(8) Taanit(9) Megillah(10)
            // Chagigah(12) Zevachim(28) Menachot(29) Chullin(30)
            let covered: Set<Int> = [0,1,2,8,9,10,12,28,29,30]
            return covered.contains(tractateId)
        case .chatamSofer:
            // Shabbat(1) Pesachim(3) Sukkah(6) Beitzah(7) Megillah(10)
            // Ketubot(14) Nedarim(15) Gittin(18) BK(20) BM(21) BB(22)
            // Sanhedrin(23) Shevuot(25) AZ(26) Chullin(30) Niddah(39)
            let covered: Set<Int> = [1,3,6,7,10,14,15,18,20,21,22,23,25,26,30,39]
            return covered.contains(tractateId)
        case .arukhLaNer:
            return tractateId == 8 || tractateId == 23  // RH, Sanhedrin
        case .reshimotShiurim:
            // Berakhot(0) Sukkah(6) Yevamot(13) Nedarim(15) Kiddushin(19)
            // BK(20) BM(21) Sanhedrin(23) Shevuot(25) Horayot(27)
            let covered: Set<Int> = [0,6,13,15,19,20,21,23,25,27]
            return covered.contains(tractateId)
        case .einAyah:
            return tractateId == 0 || tractateId == 1   // Berakhot, Shabbat
        default:
            return true
        }
    }

    // MARK: - Mishnah availability

    /// Returns whether this commentary has known content for the given Mishnah tractate.
    /// - Parameters:
    ///   - sederIndex: 0=Zeraim, 1=Moed, 2=Nashim, 3=Nezikin, 4=Kodashim, 5=Taharot
    ///   - globalTractateId: The tractate's global id (0–62 matching TextCatalog)
    func isAvailableForMishnah(sederIndex: Int, globalTractateId: Int) -> Bool {
        switch self {
        case .rashMiShantz:
            // Zeraim (except Berakhot, id=0) + Taharot (5)
            return (sederIndex == 0 && globalTractateId != 0) || sederIndex == 5
        case .yeshSederLaMishnah:
            // Zeraim (0) + Moed (1) only
            return sederIndex == 0 || sederIndex == 1
        case .raavad:
            // Only Demai (2), Eduyot (36), Kinnim (50)
            return globalTractateId == 2 || globalTractateId == 36 || globalTractateId == 50
        case .gra:
            // Avot (38) + all of Taharot (seder 5, tractate ids 51–62)
            return globalTractateId == 38 || sederIndex == 5
        case .rabbeinuYonah, .derekhChayyim, .nachalatAvot:
            // Pirkei Avot (38) only
            return globalTractateId == 38
        default:
            return true
        }
    }

    /// Returns whether this commentary has content for the given Yerushalmi tractate.
    /// tractateId matches MishnahTractate.id values.
    func isAvailableForYerushalmi(tractateId: Int) -> Bool {
        switch self {
        case .peneiMoshe:    return true
        case .mareyHaPanim:  return ![1, 15, 26, 27, 29].contains(tractateId) // missing: Peah, Yoma, Nazir, Sotah, Kiddushin
        case .ohrLayesharim: return [0, 1, 14, 15, 16, 17, 18, 19, 20, 21, 22, 33].contains(tractateId)
            // Berakhot, Peah, Shekalim, Yoma, Sukkah, Beitzah, RH, Taanit, Megillah, Moed Katan, Chagigah, Sanhedrin
        default:             return false
        }
    }

    /// Returns whether this commentary has content for the given Tosefta tractate.
    /// tractateId matches MishnahTractate.id values.
    func isAvailableForTosefta(tractateId: Int) -> Bool {
        switch self {
        case .toseftaKifshutah: return tractateId <= 32  // Zeraim(0-10), Moed(11-22), Nashim(23-29), BK/BM/BB(30-32)
        case .briefCommentary:  return tractateId <= 32 && ![13, 16, 29].contains(tractateId) // minus Pesachim, Sukkah, Kiddushin
        default:                return false
        }
    }

    /// Shita Mekubbetzet on Nedarim uses double-b spelling on Sefaria;
    /// all other tractates use single-b.
    private func shitaMekubetzetRef(from mainRef: String) -> String {
        mainRef.hasPrefix("Nedarim")
            ? "Shita Mekubbetzet on \(mainRef)"
            : "Shita Mekubetzet on \(mainRef)"
    }

    /// Cassuto on Genesis is split into two sub-books by chapter range:
    ///   Chapters 1–11  → "From Adam to Noah"
    ///   Chapters 12+   → "From Noah to Abraham"
    /// Both use the original Genesis chapter number in the ref.
    private func cassutoGenesisRef(from mainRef: String) -> String {
        let chapterStr = extractChapter(mainRef)
        let chapter = Int(chapterStr) ?? 1
        let section = chapter <= 11 ? "From Adam to Noah" : "From Noah to Abraham"
        return "Cassuto on Genesis, \(section) \(chapter)"
    }

    // MARK: - Multi-version refs

    /// True when this commentator combines two different books in one screen.
    /// These get the prominent yellow/blue `bookDivider` separator; Tosafot Rid
    /// (different recensions of the same book) uses the subtle `recensionHeader` instead.
    var usesBookDivider: Bool {
        switch self {
        case .haamekDavar, .yachin, .maharsha, .rAbbiAkivaEiger,
             .priMegadimOC, .priMegadimYD, .keretiUPeleti, .netivotHaMishpat, .urimVTumim:
            return true
        default:
            return false
        }
    }

    /// Returns all `(ref, optionalLabel)` pairs needed to fetch this commentary for the
    /// given main ref.  For most commentaries this is a single pair with a `nil` label.
    /// For Tosafot Rid on tractates that have multiple recensions, multiple pairs are
    /// returned and `label` carries the Hebrew recension name (מהדורא קמא, etc.) that
    /// the UI inserts as a visual separator between the recensions.
    func sefariaRefVersions(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        switch self {
        case .tosafotRid:       return tosafotRidRefs(forMainRef: mainRef)
        case .haamekDavar:      return haamekDavarRefs(forMainRef: mainRef)
        case .yachin:           return yachinBoazRefs(forMainRef: mainRef)
        case .maharsha:         return maharshaRefs(forMainRef: mainRef)
        case .rAbbiAkivaEiger:  return rAbbiAkivaEigerRefs(forMainRef: mainRef)
        case .priMegadimOC:     return priMegadimOCRefs(forMainRef: mainRef)
        case .priMegadimYD:     return priMegadimYDRefs(forMainRef: mainRef)
        case .keretiUPeleti:    return keretiUPeletiRefs(forMainRef: mainRef)
        case .netivotHaMishpat: return netivotHaMishpatRefs(forMainRef: mainRef)
        case .urimVTumim:       return urimVTumimRefs(forMainRef: mainRef)
        default:                return [(sefariaRef(forMainRef: mainRef), nil)]
        }
    }

    private func haamekDavarRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        [
            ("Haamek Davar on \(mainRef)", "Ha'amek Davar"),
            ("Harchev Davar on \(mainRef)", "Harchev Davar"),
        ]
    }

    private func biurHalakhaRef(from mainRef: String) -> String {
        let pattern = #"(\d+)$"#
        if let range = mainRef.range(of: pattern, options: .regularExpression) {
            return "Biur Halakha \(mainRef[range])"
        }
        return "Biur Halakha 1"
    }

    // MARK: - SA combined-book refs

    private func priMegadimOCRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        let siman = extractChapter(mainRef)
        return [
            ("Peri Megadim on Orach Chayim, Mishbezot Zahav \(siman)", "משבצות זהב"),
            ("Peri Megadim on Orach Chayim, Eshel Avraham \(siman)",   "אשל אברהם"),
        ]
    }

    private func priMegadimYDRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        let siman = extractChapter(mainRef)
        return [
            ("Peri Megadim on Yoreh De'ah, Mishbezot Zahav \(siman)", "משבצות זהב"),
            ("Peri Megadim on Yoreh De'ah, Siftei Da'at \(siman)",    "שפתי דעת"),
        ]
    }

    private func keretiUPeletiRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        [
            ("Kereti on \(mainRef)", "כרתי"),
            ("Peleti on \(mainRef)", "פלתי"),
        ]
    }

    private func netivotHaMishpatRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        let siman = extractChapter(mainRef)
        return [
            ("Netivot HaMishpat, Hidushim on Shulchan Arukh, Choshen Mishpat \(siman)", "חידושים"),
            ("Netivot HaMishpat, Beurim on Shulchan Arukh, Choshen Mishpat \(siman)",   "ביאורים"),
        ]
    }

    private func urimVTumimRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        let siman = extractChapter(mainRef)
        return [
            ("Urim VeTumim, Urim \(siman)", "אורים"),
            ("Urim VeTumim, Tumim \(siman)", "תומים"),
        ]
    }

    private func yachinBoazRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        [
            ("Yachin on \(mainRef)", "Yachin"),
            ("Boaz on \(mainRef)",   "Boaz"),
        ]
    }

    /// Maharsha: Chiddushei Halachot + Chiddushei Agadot, interleaved with Hebrew headers.
    /// For tractates where only Agadot exists, returns a single ref with no label.
    private func maharshaRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        let book = extractBookName(mainRef)
        let agadotOnly: Set<String> = ["Nazir", "Zevachim", "Arakhin", "Temurah", "Keritot", "Meilah", "Tamid"]
        if agadotOnly.contains(book) {
            return [("Chidushei Agadot on \(mainRef)", nil)]
        }
        return [
            ("Chidushei Halachot on \(mainRef)", "חידושי הלכות"),
            ("Chidushei Agadot on \(mainRef)",   "חידושי אגדות"),
        ]
    }

    /// R. Akiva Eiger: Gilyon HaShas + Chiddushim, interleaved with Hebrew headers.
    /// For tractates where only Gilyon HaShas exists, returns a single ref with no label.
    private func rAbbiAkivaEigerRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        let book = extractBookName(mainRef)
        let chiddusheiMissing: Set<String> = [
            "Sotah", "Sanhedrin", "Horayot", "Menachot",
            "Bekhorot", "Arakhin", "Keritot", "Meilah", "Niddah",
        ]
        if chiddusheiMissing.contains(book) {
            return [("Gilyon HaShas on \(mainRef)", nil)]
        }
        return [
            ("Gilyon HaShas on \(mainRef)",                    "גליון הש\"ס"),
            ("Chiddushei Rabbi Akiva Eiger on \(mainRef)",     "חידושי ר' עקיבא איגר"),
        ]
    }

    /// Builds the ordered list of (ref, label) pairs for Tosafot Rid.
    /// mainRef for Talmud has the form "{tractate} {daf}", e.g. "Avodah Zarah 5".
    /// Sefaria titles: "Tosafot Rid on {Tractate} {Recension}" then the daf appended.
    private func tosafotRidRefs(forMainRef mainRef: String) -> [(ref: String, label: String?)] {
        if mainRef.hasPrefix("Avodah Zarah") {
            let daf = String(mainRef.dropFirst("Avodah Zarah".count))  // " 5"
            return [
                ("Tosafot Rid on Avodah Zarah First Recension\(daf)",  "מהדורא קמא"),
                ("Tosafot Rid on Avodah Zarah Second Recension\(daf)", "מהדורא תניינא"),
                ("Tosafot Rid on Avodah Zarah Third Recension\(daf)",  "מהדורא תליתא"),
            ]
        } else if mainRef.hasPrefix("Megillah") {
            let daf = String(mainRef.dropFirst("Megillah".count))
            return [
                ("Tosafot Rid on Megillah First Recension\(daf)",  "מהדורא קמא"),
                ("Tosafot Rid on Megillah Second Recension\(daf)", "מהדורא תניינא"),
            ]
        } else if mainRef.hasPrefix("Eruvin") {
            let daf = String(mainRef.dropFirst("Eruvin".count))
            // Only Second Recension exists on Sefaria for Eruvin
            return [("Tosafot Rid on Eruvin Second Recension\(daf)", nil)]
        } else {
            return [("Tosafot Rid on \(mainRef)", nil)]
        }
    }
}

// MARK: - Text Segment

/// One displayable unit of text — a verse, mishnah, Gemara sentence, or a divider marker.
struct TextSegment: Identifiable {
    let id = UUID()
    let index: Int           // position in the source array (0-based)
    let hebrewHTML: String
    let englishHTML: String
    let label: String?       // verse/mishnah number to show in margin
    let isAmudBMarker: Bool  // true for the synthetic divider between amud A and B
    let markerDaf: Int       // meaningful only when isAmudBMarker == true
    var raavadHe: String?    // plain-text Ra'avad Hasagot (Hebrew), nil = no comment
    var raavadEn: String?    // plain-text Ra'avad Hasagot (English), nil = no comment

    static func content(index: Int, he: String, en: String, label: String? = nil,
                        raavadHe: String? = nil, raavadEn: String? = nil) -> TextSegment {
        TextSegment(index: index, hebrewHTML: he, englishHTML: en,
                    label: label, isAmudBMarker: false, markerDaf: 0,
                    raavadHe: raavadHe, raavadEn: raavadEn)
    }

    static func amudBMarker(daf: Int) -> TextSegment {
        TextSegment(index: -1, hebrewHTML: "", englishHTML: "",
                    label: nil, isAmudBMarker: true, markerDaf: daf,
                    raavadHe: nil, raavadEn: nil)
    }
}

// MARK: - Commentary Entry

/// A single item in the displayed commentary list.
enum CommentaryEntry {
    /// A regular commentary segment. `index` counts only text entries (skips headers)
    /// so the numbered margin stays sequential.
    case text(index: Int, he: String, en: String)
    /// Subtle recension separator — used only for Tosafot Rid multi-recension dividers.
    case recensionHeader(String)
    /// Prominent book-section separator — used when a commentator combines two distinct
    /// works (e.g. Maharsha Halachot + Agadot, Mishnah Berurah + Biur Halakha).
    case bookDivider(String)
}

// MARK: - Fetched content

struct FetchedText {
    let segments: [TextSegment]
    let ref: String
}

// MARK: - Hebrew numeral helper (shared with AnyDaf convention)

func toHebrewNumeral(_ n: Int) -> String {
    guard n > 0 else { return "" }
    var remaining = n
    var letters = ""
    for (v, l) in [(400,"ת"),(300,"ש"),(200,"ר"),(100,"ק")] {
        while remaining >= v { letters += l; remaining -= v }
    }
    if remaining == 15      { letters += "טו"; remaining = 0 }
    else if remaining == 16 { letters += "טז"; remaining = 0 }
    else {
        for (v, l) in [(90,"צ"),(80,"פ"),(70,"ע"),(60,"ס"),(50,"נ"),(40,"מ"),(30,"ל"),(20,"כ"),(10,"י")] {
            while remaining >= v { letters += l; remaining -= v }
        }
        for (v, l) in [(9,"ט"),(8,"ח"),(7,"ז"),(6,"ו"),(5,"ה"),(4,"ד"),(3,"ג"),(2,"ב"),(1,"א")] {
            while remaining >= v { letters += l; remaining -= v }
        }
    }
    if letters.count == 1 { return letters + "\u{05F3}" }
    let lastIdx = letters.index(before: letters.endIndex)
    return String(letters[..<lastIdx]) + "\u{05F4}" + String(letters[lastIdx...])
}

// MARK: - Torah verse counts (for Midrash verse picker)

/// Returns the number of verses in the given Torah chapter.
/// bookIndex: 0=Genesis 1=Exodus 2=Leviticus 3=Numbers 4=Deuteronomy
func torahVerseCount(bookIndex: Int, chapter: Int) -> Int {
    let counts: [[Int]] = [
        // Genesis (50 chapters)
        [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,33,20,31,22,43,36,38,23,23,57,38,34,34,28,34,31,22,33,26],
        // Exodus (40 chapters)
        [22,25,22,31,23,30,25,28,35,29,10,51,22,31,27,36,16,27,25,26,36,30,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
        // Leviticus (27 chapters)
        [17,16,17,35,26,23,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
        // Numbers (36 chapters)
        [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],
        // Deuteronomy (34 chapters)
        [46,37,29,49,30,25,26,20,29,22,32,32,19,29,23,22,20,22,21,20,23,30,26,22,19,19,26,68,29,20,30,52,29,12],
    ]
    guard bookIndex >= 0, bookIndex < counts.count else { return 50 }
    let book = counts[bookIndex]
    guard chapter >= 1, chapter <= book.count else { return 50 }
    return book[chapter - 1]
}

// MARK: - Commentary Layout

/// Where the commentary panel(s) appear relative to the main text.
/// Stored as a raw String in UserDefaults ("commentaryLayout").
enum CommentaryLayout: String, CaseIterable {
    case bottomPanel = "bottom"
    case leftPanel   = "left"
    case rightPanel  = "right"
    case bothPanels  = "both"

    var displayName: String {
        switch self {
        case .bottomPanel: return "Panel below text"
        case .leftPanel:   return "Left-side panel"
        case .rightPanel:  return "Right-side panel"
        case .bothPanels:  return "Left and right panels"
        }
    }
}
