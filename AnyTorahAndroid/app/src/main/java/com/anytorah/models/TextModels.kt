package com.anytorah.models

import java.util.UUID

// MARK: - Category

enum class TextCategory(val displayName: String, val hebrewName: String) {
    TANAKH("Tanakh", "תנ״ך"),
    MISHNAH("Mishnah", "משנה"),
    TALMUD("Talmud", "תלמוד"),
    RAMBAM("Rambam", "רמב״ם"),
    SHULCHAN_ARUKH("Shulkhan Arukh", "שולחן ערוך"),
    MIDRASH("Midrash", "מדרש");

    val segmentLabelStyle: SegmentLabelStyle get() = when (this) {
        TANAKH -> SegmentLabelStyle.VERSE
        MISHNAH -> SegmentLabelStyle.MISHNAH
        TALMUD -> SegmentLabelStyle.NONE
        RAMBAM -> SegmentLabelStyle.HALAKHA
        SHULCHAN_ARUKH -> SegmentLabelStyle.SIF
        MIDRASH -> SegmentLabelStyle.NONE
    }
}

enum class TextDisplayMode(val raw: String) {
    SOURCE("source"),
    TRANSLATION("translation"),
    BOTH("both")
}

enum class SegmentLabelStyle {
    VERSE, MISHNAH, HALAKHA, SIF, NONE
}

// MARK: - TextSegment

data class TextSegment(
    val id: String = UUID.randomUUID().toString(),
    val index: Int,
    val hebrewHTML: String,
    val englishHTML: String,
    val label: String? = null,
    val isAmudBMarker: Boolean = false,
    val markerDaf: Int = 0,
    val raavadHe: String? = null,   // plain-text Ra'avad Hasagot (Hebrew), null = no comment
    val raavadEn: String? = null    // plain-text Ra'avad Hasagot (English), null = no comment
) {
    companion object {
        fun content(index: Int, he: String, en: String, label: String? = null,
                    raavadHe: String? = null, raavadEn: String? = null) = TextSegment(
            index = index,
            hebrewHTML = he,
            englishHTML = en,
            label = label,
            isAmudBMarker = false,
            markerDaf = 0,
            raavadHe = raavadHe,
            raavadEn = raavadEn
        )

        fun amudBMarker(daf: Int) = TextSegment(
            index = -1,
            hebrewHTML = "",
            englishHTML = "",
            label = null,
            isAmudBMarker = true,
            markerDaf = daf
        )
    }
}

// MARK: - Subcategories

enum class MishnahSubcategory(val id: String, val displayName: String, val hebrewName: String) {
    MISHNAH("mishnah", "Mishnah", "משנה"),
    TOSEFTA("tosefta", "Tosefta", "תוספתא");

    companion object {
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: MISHNAH
    }
}

enum class TalmudSubcategory(val id: String, val displayName: String, val hebrewName: String) {
    BAVLI("bavli", "Bavli", "בבלי"),
    YERUSHALMI("yerushalmi", "Yerushalmi", "ירושלמי");

    companion object {
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: BAVLI
    }
}

enum class MidrashSubcategory(val id: String, val displayName: String, val hebrewName: String) {
    HALAKHA("halakha", "Midrash Halakha", "מדרש הלכה"),
    AGGADA("aggada", "Midrash Aggada", "מדרש אגדה");

    companion object {
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: HALAKHA
    }
}

enum class MidrashWork(
    val id: String,
    val subcategory: MidrashSubcategory,
    val displayName: String,
    val hebrewName: String,
    val applicableBookIndices: List<Int>,
    val sefariaIndexTitle: String
) {
    // Midrash Halakha (5 works)
    MEKHILTA_YISHMAEL("mekhiltaYishmael", MidrashSubcategory.HALAKHA, "Mekhilta (R. Yishmael)", "מכילתא דרבי ישמעאל", listOf(1), "Mekhilta DeRabbi Yishmael"),
    MEKHILTA_SHIMON("mekhiltaShimon", MidrashSubcategory.HALAKHA, "Mekhilta (R. Shimon b. Yochai)", "מכילתא דרבי שמעון", listOf(1), "Mekhilta DeRabbi Shimon Ben Yochai"),
    SIFRA("sifra", MidrashSubcategory.HALAKHA, "Sifra", "ספרא", listOf(2), "Sifra"),
    SIFREI_BAMIDBAR("sifreiBamidbar", MidrashSubcategory.HALAKHA, "Sifrei Bamidbar", "ספרי במדבר", listOf(3), "Sifrei Bamidbar"),
    SIFREI_DEVARIM("sifreiDevarim", MidrashSubcategory.HALAKHA, "Sifrei Devarim", "ספרי דברים", listOf(4), "Sifrei Devarim"),
    // Midrash Aggada (7 works)
    BEREISHIT_RABBAH("bereishitRabbah", MidrashSubcategory.AGGADA, "Bereishit Rabbah", "בראשית רבה", listOf(0), "Bereshit Rabbah"),
    SHEMOT_RABBAH("shemotRabbah", MidrashSubcategory.AGGADA, "Shemot Rabbah", "שמות רבה", listOf(1), "Shemot Rabbah"),
    VAYIKRA_RABBAH("vayikraRabbah", MidrashSubcategory.AGGADA, "Vayikra Rabbah", "ויקרא רבה", listOf(2), "Vayikra Rabbah"),
    BAMIDBAR_RABBAH("bamidbarRabbah", MidrashSubcategory.AGGADA, "Bamidbar Rabbah", "במדבר רבה", listOf(3), "Bamidbar Rabbah"),
    DEVARIM_RABBAH("devarimRabbah", MidrashSubcategory.AGGADA, "Devarim Rabbah", "דברים רבה", listOf(4), "Devarim Rabbah"),
    TANCHUMA_STANDARD("tanchumaStandard", MidrashSubcategory.AGGADA, "Midrash Tanchuma", "מדרש תנחומא", listOf(0, 1, 2, 3, 4), "Midrash Tanchuma"),
    TANCHUMA_BUBER("tanchumaBuber", MidrashSubcategory.AGGADA, "Midrash Tanchuma (Buber)", "מדרש תנחומא (בובר)", listOf(0, 1, 2, 3, 4), "Midrash Tanchuma Buber");

    // Native navigation style
    sealed class NativeStyle {
        data class NumericTwo(val maxChapters: Int) : NativeStyle()
        data class NumericOne(val maxSections: Int) : NativeStyle()
        data class NamedTwo(val names: List<String>) : NativeStyle()
        data class NamedTractate(val names: List<String>) : NativeStyle()
        data class NamedSection(val names: List<String>) : NativeStyle()
    }

    val nativeStyle: NativeStyle get() = when (this) {
        BEREISHIT_RABBAH   -> NativeStyle.NumericTwo(100)
        SHEMOT_RABBAH      -> NativeStyle.NumericTwo(52)
        VAYIKRA_RABBAH     -> NativeStyle.NumericTwo(37)
        BAMIDBAR_RABBAH    -> NativeStyle.NumericTwo(23)
        DEVARIM_RABBAH     -> NativeStyle.NumericTwo(11)
        SIFREI_BAMIDBAR    -> NativeStyle.NumericOne(161)
        SIFREI_DEVARIM     -> NativeStyle.NumericOne(357)
        TANCHUMA_STANDARD  -> NativeStyle.NamedTwo(tanchumaParashas)
        TANCHUMA_BUBER     -> NativeStyle.NamedTwo(tanchumaBuberParashas)
        MEKHILTA_YISHMAEL  -> NativeStyle.NamedTractate(mekhiltaYishmaelTractates)
        MEKHILTA_SHIMON    -> NativeStyle.NumericTwo(50)
        SIFRA              -> NativeStyle.NamedSection(sifraParashas)
    }

    val nativeIsOneLevel: Boolean get() = nativeStyle is NativeStyle.NumericOne

    val nativeMaxChapters: Int get() = when (val s = nativeStyle) {
        is NativeStyle.NumericTwo    -> s.maxChapters
        is NativeStyle.NumericOne    -> s.maxSections
        is NativeStyle.NamedTwo      -> s.names.size
        is NativeStyle.NamedTractate -> s.names.size
        is NativeStyle.NamedSection  -> s.names.size
    }

    val nativeChapterLabel: String get() = when (nativeStyle) {
        is NativeStyle.NumericTwo, is NativeStyle.NumericOne -> "Chapter"
        is NativeStyle.NamedTwo      -> "Parasha"
        is NativeStyle.NamedTractate -> "Tractate"
        is NativeStyle.NamedSection  -> "Section"
    }

    val nativeChapterLabels: List<String> get() = when (val s = nativeStyle) {
        is NativeStyle.NumericTwo    -> (1..s.maxChapters).map { "$it" }
        is NativeStyle.NumericOne    -> (1..s.maxSections).map { "$it" }
        is NativeStyle.NamedTwo      -> s.names
        is NativeStyle.NamedTractate -> s.names
        is NativeStyle.NamedSection  -> s.names
    }

    fun nativeRef(chapter: Int, section: Int): String {
        val base = sefariaIndexTitle
        return when (val s = nativeStyle) {
            is NativeStyle.NumericTwo    -> "$base $chapter:$section"
            is NativeStyle.NumericOne    -> "$base $chapter"
            is NativeStyle.NamedTwo      -> if (chapter in 1..s.names.size) "$base, ${s.names[chapter-1]} $section" else ""
            is NativeStyle.NamedTractate -> if (chapter in 1..s.names.size) "$base, Tractate ${s.names[chapter-1]} $section" else ""
            is NativeStyle.NamedSection  -> if (chapter in 1..s.names.size) "$base, ${s.names[chapter-1]} $section" else ""
        }
    }

    companion object {
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: MEKHILTA_YISHMAEL
        fun worksFor(subcategory: MidrashSubcategory) = values().filter { it.subcategory == subcategory }

        val tanchumaParashas = listOf(
            "Bereshit","Noach","Lech Lecha","Vayera","Chayei Sara","Toldot","Vayetzei",
            "Vayishlach","Vayeshev","Miketz","Vayigash","Vayechi","Shemot","Vaera","Bo",
            "Beshalach","Yitro","Mishpatim","Terumah","Tetzaveh","Ki Tisa","Vayakhel",
            "Pekudei","Vayikra","Tzav","Shmini","Tazria","Metzora","Achrei Mot","Kedoshim",
            "Emor","Behar","Bechukotai","Bamidbar","Nasso","Beha'alotcha","Sh'lach",
            "Korach","Chukat","Balak","Pinchas","Matot","Masei","Devarim","Vaetchanan",
            "Eikev","Re'eh","Shoftim","Ki Teitzei","Ki Tavo","Nitzavim","Vayeilech",
            "Ha'Azinu","V'Zot HaBerachah"
        )

        val tanchumaBuberParashas = listOf(
            "Bereshit","Noach","Lech Lecha","Vayera","Chayei Sara","Toldot","Vayetzei",
            "Vayishlach","Vayeshev","Miketz","Vayigash","Vayechi","Shemot","Vaera","Bo",
            "Beshalach","Yitro","Mishpatim","Terumah","Tetzaveh","Ki Tisa","Vayakhel",
            "Pekudei","Vayikra","Tzav","Shmini","Tazria","Metzora","Achrei Mot","Kedoshim",
            "Emor","Behar","Bechukotai","Bamidbar","Nasso","Beha'alotcha","Sh'lach",
            "Appendix to Sh'lach","Korach","Appendix to Korach","Chukat","Appendix to Chukat",
            "Balak","Pinchas","Matot","Masei","Devarim","Appendix to Devarim","Vaetchanan",
            "Appendix to Vaetchanan","Eikev","Re'eh","Appendix to Re'eh","Shoftim",
            "Ki Teitzei","Ki Tavo","Nitzavim","Ha'Azinu","V'Zot HaBerachah"
        )

        val mekhiltaYishmaelTractates = listOf(
            "Pischa","Vayehi Beshalach","Shirah","Vayassa","Amalek",
            "Bachodesh","Nezikin","Kaspa","Shabbata"
        )

        val sifraParashas = listOf(
            "Baraita DeRabbi Yishmael","Vayikra Dibbura DeNedavah","Vayikra Dibbura DeChovah",
            "Tzav","Shemini","Tazria Parashat Yoledet","Tazria Parashat Negaim","Metzora",
            "Metzora Parashat Zavim","Acharei Mot","Kedoshim","Emor","Behar","Bechukotai"
        )
    }
}

enum class MidrashNavigationMode(val id: String) {
    BY_VERSE("byVerse"),
    NATIVE("native");

    companion object {
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: BY_VERSE
    }
}

fun torahVerseCount(bookIndex: Int, chapter: Int): Int {
    val counts = listOf(
        // Genesis (50 chapters)
        listOf(31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,33,20,31,22,43,36,38,23,23,57,38,34,34,28,34,31,22,33,26),
        // Exodus (40 chapters)
        listOf(22,25,22,31,23,30,25,28,35,29,10,51,22,31,27,36,16,27,25,26,36,30,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38),
        // Leviticus (27 chapters)
        listOf(17,16,17,35,26,23,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34),
        // Numbers (36 chapters)
        listOf(54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13),
        // Deuteronomy (34 chapters)
        listOf(46,37,29,49,30,25,26,20,29,22,32,32,19,29,23,22,20,22,21,20,23,30,26,22,19,19,26,68,29,20,30,52,29,12)
    )
    if (bookIndex < 0 || bookIndex >= counts.size) return 50
    val book = counts[bookIndex]
    if (chapter < 1 || chapter > book.size) return 50
    return book[chapter - 1]
}

// MARK: - CommentaryType

enum class CommentaryType(val id: String, val displayName: String) {
    // Tanakh — Torah core
    ONKELOS("onkelos", "Onkelos"),
    RASHI_TANAKH("rashiTanakh", "Rashi"),
    RAMBAN("ramban", "Ramban"),
    // Tanakh — Torah extended pool
    IBN_EZRA("ibnEzra", "Ibn Ezra"),
    ABARBANEL("abarbanel", "Abarbanel"),
    RASHBAM("rashbam", "Rashbam"),
    SFORNO("sforno", "Sforno"),
    HA_KTAV_VE_HA_KABALAH("haKtavVeHaKabalah", "HaKtav VeHaKabalah"),
    HAAMEK_DAVAR("haamekDavar", "Ha'amek Davar + Harchev Davar"),
    HARCHEV_DAVAR("harchevDavar", "Harchev Davar"),
    KLI_YAKAR("kliYakar", "Kli Yakar"),
    MALBIM("malbim", "Malbim"),
    MESHECH_CHOKHMAH("meshechChokhmah", "Meshekh Chokhmah"),
    OR_HA_CHAIM("orHaChaim", "Or HaChaim"),
    RAV_HIRSCH("ravHirsch", "Rav Hirsch"),
    SHADAL("shadal", "Shadal"),
    TORAH_TEMIMAH("torahTemimah", "Torah Temimah"),
    CASSUTO_GENESIS("cassutoGenesis", "Cassuto (Genesis)"),
    CASSUTO_EXODUS("cassutoExodus", "Cassuto (Exodus)"),
    HOFFMANN_EXODUS("hoffmannExodus", "Hoffmann (Exodus)"),
    HOFFMANN_LEVITICUS("hoffmannLeviticus", "Hoffmann (Leviticus)"),
    JONATHAN_SACKS("jonathanSacks", "Jonathan Sacks"),
    NECHAMA_LEIBOWITZ("nechamaLeibowitz", "Nechama Leibowitz"),
    // Tanakh — Nakh shared (Rishonim)
    RADAK("radak", "Radak"),
    RALBAG("ralbag", "Ralbag"),
    // Tanakh — Nakh shared (Acharonim)
    ALSHICH("alshich", "Alshich"),
    METZUDAT_ZION("metzudatZion", "Metzudat Zion"),
    RISHON_LETZION("rishonLeTzion", "Or HaChaim"),  // R. Chaim ibn Attar's Nakh work; titled "Rishon LeTzion" on Sefaria
    // Tanakh — Nevi'im
    TARGUM_YONATAN("targumYonatan", "Targum Yonatan"),
    // Tanakh — Ketuvim
    TARGUM_KETUVIM("targumKetuvim", "Targum"),
    METZUDAT_DAVID("metzudatDavid", "Metzudat David"),
    // Mishnah — core
    RAMBAM_MISHNAH("rambamMishnah", "Rambam"),
    BARTENURA("bartenura", "Bartenura"),
    TOSAFOT_YOM_TOV("tosafotYomTov", "Tosafot Yom Tov"),
    // Mishnah — additional commentaries
    RASH_MI_SHANTZ("rashMiShantz", "Rash MiShantz"),
    MELEKHET_SHLOMO("melekhetShlomo", "Melekhet Shlomo"),
    TOSAFOT_RABBI_AKIVA_EIGER("tosafotRabbiAkivaEiger", "Tosafot R. Akiva Eiger"),
    YESH_SEDER_LA_MISHNAH("yeshSederLaMishnah", "Yesh Seder LaMishnah"),
    MISHNAT_ERETZ_YISRAEL("mishnatEretzYisrael", "Mishnat Eretz Yisrael (Safrai)"),
    ENGLISH_EXPLANATION("englishExplanation", "Kulp (English)"),
    RASHASH("rashash", "Rashash"),
    YACHIN("yachin", "Yachin + Boaz"),
    BOAZ("boaz", "Boaz"),
    RAAVAD("raavad", "Ra'avad"),
    GRA("gra", "Eliyahu Rabbah (Gra)"),
    RABBEINU_YONAH("rabbeinuYonah", "Rabbeinu Yonah"),
    DEREKH_CHAYYIM("derekhChayyim", "Derekh Chayyim (Maharal)"),
    NACHALAT_AVOT("nachalatAvot", "Nachalat Avot (Abarbanel)"),
    // Talmud — core
    RASHI_TALMUD("rashiTalmud", "Rashi"),
    TOSAFOT("tosafot", "Tosafot"),
    // Talmud — Group 1: Rashi-like
    RAN_NEDARIM("ranNedarim", "Ran"),
    RABBEINU_CHANANEL("rabbeinuChananel", "Rabbeinu Chananel"),
    RABBEINU_GERSHOM("rabbeinuGershom", "Rabbeinu Gershom"),
    RASHBAM_TALMUD("rashbamTalmud", "Rashbam"),
    RAN("ran", "Ran (Chiddushim)"),
    RAV_NISSIM_GAON("ravNissimGaon", "Rav Nissim Gaon"),
    MEFARESH_TAMID("mefareshTamid", "Pseudo-Rashi (Tamid)"),
    // Talmud — Group 2: Chiddushim
    CHIDDUSHEI_RAMBAN("chiddusheiRamban", "Ramban"),
    RASHBA("rashba", "Rashba"),
    RITVA("ritva", "Ritva"),
    MEIRI("meiri", "Meiri"),
    SHITA_MEKUBETZET("shitaMekubetzet", "Shita Mekubbetzet"),
    RAAH("raah", "Ra'ah"),
    YAD_RAMAH("yadRamah", "Yad Ramah"),
    RI_MIGASH("riMigash", "Ri Migash"),
    CHIDDUSHEI_HA_RAMBAM("chiddusheiHaRambam", "Rambam"),
    // Talmud — Group 3: Tosafot-type
    TOSAFOT_HA_ROSH("tosafotHaRosh", "Tosafot HaRosh"),
    TOSAFOT_RID("tosafotRid", "Tosafot Rid"),
    TOSAFOT_SHANTZ("tosafotShantz", "Tosafot Shantz"),
    TOSAFOT_YESHANIM("tosafotYeshanim", "Tosafot Yeshanim"),
    PISKEI_TOSAFOT("piskeiTosafot", "Piskei Tosafot"),
    COMMENTARY_OF_THE_ROSH("commentaryOfTheRosh", "Commentary of the Rosh"),
    // Talmud — Group 4: Standard Acharonim
    MAHARSHA("maharsha", "Maharsha"),
    MAHARAM("maharam", "Maharam"),
    CHOKHMAT_SHLOMO("chokhmatShlomo", "Chokhmat Shlomo"),
    R_AKIVA_EIGER("rAbbiAkivaEiger", "R. Akiva Eiger"),
    // Talmud — Group 5: Additional Acharonim
    PENEI_YEHOSHUA("peneiYehoshua", "Penei Yehoshua"),
    HAFLAAH_KETUBOT("haflaahKetubot", "Haflaah"),
    TZLACH("tzlach", "Tzelach"),
    CHATAM_SOFER("chatamSofer", "Chatam Sofer"),
    ARUKH_LA_NER("arukhLaNer", "Arukh LaNer"),
    RESHIMOT_SHIURIM("reshimotShiurim", "Reshimot Shiurim (Rav Soloveitchik)"),
    EIN_AYAH("einAyah", "Ein Ayah (Rav Kook)"),
    // Yerushalmi
    PENEI_MOSHE("peneiMoshe", "Penei Moshe"),
    MAREY_HA_PANIM("mareyHaPanim", "Mareh HaPanim"),
    OHR_LAYESHARIM("ohrLayesharim", "Ohr LaYesharim"),
    // Tosefta
    TOSEFTA_KIFSHUTAH("toseftaKifshutah", "Tosefta Kifshutah"),
    BRIEF_COMMENTARY("briefCommentary", "Brief Commentary (Lieberman)"),
    // Rambam — Main
    MAGGID_MISHNAH("maggidMishnah", "Maggid Mishneh"),
    KESEF_MISHNAH("kesefMishnah", "Kesef Mishneh"),
    MIGDAL_OZ("migdalOz", "Migdal Oz"),
    LECHEM_MISHNEH("lochemMishnah", "Lechem Mishneh"),
    MISHNEH_LA_MELECH("mishnahLaMelech", "Mishneh LaMelech"),
    MAHARI_KURKUS_RADBAZ("mahariKurkusRadbaz", "Mahari Kurkus & Radbaz"),
    // Rambam — Later Acharonim
    KIRYAT_SEFER("kiryatSefer", "Kiryat Sefer"),
    MAASEH_ROKEACH("maasehRokeach", "Maaseh Rokeach"),
    OR_SAMEACH("orSameach", "Or Sameach"),
    AVODAT_HA_MELEKH("avodatHaMelekh", "Avodat HaMelekh"),
    EVEN_HA_AZEL("evenHaAzel", "Even HaAzel"),
    // SA — Orach Chayim
    MISHNAH_BERURAH("mishnahBerurah", "Mishnah Berurah"),
    SHAAREI_TESHUVAH("shaareiTeshuvah", "Shaarei Teshuvah"),
    BIUR_HALAKHA("biurHalakha", "Biur Halakha"),
    // SA — Yoreh Deah
    SHAKH("shakh", "Shakh"),
    TAZ("taz", "Taz"),
    // SA — Even HaEzer
    CHELKAT_MECHOKEK("chelkatMechokek", "Chelkat Mechokek"),
    BEIT_SHMUEL("beitShmuel", "Beit Shmuel"),
    // SA — Choshen Mishpat
    MEIRAT_EINAYIM("meiratEinayim", "Me’irat Einayim"),
    // SA — YD, EH, HM shared
    PITCHEI_TESHUVAH("pitcheiTeshuvah", "Pitchei Teshuvah"),
    // SA — General (all sections)
    BAER_HETEV("baerHetev", "Ba'er Hetev"),
    BEUR_HAGRA_SA("beurHagraSA", "Beur HaGra"),
    KAF_HA_CHAIM("kafHaChaim", "Kaf HaChayim"),
    // SA — OC
    MAGEN_AVRAHAM("magenAvraham", "Magen Avraham"),
    ELIYA_RABBAH("eliyaRabbah", "Eliyah Rabbah"),
    PRI_MEGADIM_OC("priMegadimOC", "Peri Megadim"),
    // SA — YD
    NEKUDAT_HA_KESEF("nekudatHaKesef", "Nekudat HaKesef"),
    PRI_MEGADIM_YD("priMegadimYD", "Peri Megadim"),
    KERETI_U_PELETI("keretiUPeleti", "Kereti u'Peleti"),
    TORAT_HA_SHLAMIM("toratHaShlamim", "Torat HaShlamim"),
    // SA — EH
    BEIT_MEIR("beitMeir", "Beit Meir"),
    EZER_MI_KODESH("ezerMiKodesh", "Ezer MiKodesh"),
    // SA — CM
    KTZOT_HA_CHOSHEN("ktzotHaChoshen", "Ktzot HaChoshen"),
    NETIVOT_HA_MISHPAT("netivotHaMishpat", "Netivot HaMishpat"),
    URIM_V_TUMIM("urimVTumim", "Urim v'Tumim"),
    HAGAHOT_RAE("hagahotRAE", "Hagahot R. Akiva Eiger");

    val hebrewDisplayName: String get() = when (this) {
        // Tanakh — Torah core
        ONKELOS              -> "אונקלוס"
        RASHI_TANAKH         -> "רש״י"
        RAMBAN               -> "רמב״ן"
        // Tanakh — Torah extended
        IBN_EZRA             -> "אבן עזרא"
        ABARBANEL            -> "אברבנאל"
        RASHBAM              -> "רשב״ם"
        SFORNO               -> "ספורנו"
        HA_KTAV_VE_HA_KABALAH -> "הכתב והקבלה"
        HAAMEK_DAVAR         -> "העמק דבר + הרחב דבר"
        HARCHEV_DAVAR        -> "הרחב דבר"
        KLI_YAKAR            -> "כלי יקר"
        MALBIM               -> "מלבי״ם"
        MESHECH_CHOKHMAH     -> "משך חכמה"
        OR_HA_CHAIM          -> "אור החיים"
        RAV_HIRSCH           -> "רב הירש"
        SHADAL               -> "שד״ל"
        TORAH_TEMIMAH        -> "תורה תמימה"
        CASSUTO_GENESIS      -> "קסוטו (בראשית)"
        CASSUTO_EXODUS       -> "קסוטו (שמות)"
        HOFFMANN_EXODUS      -> "הופמן (שמות)"
        HOFFMANN_LEVITICUS   -> "הופמן (ויקרא)"
        JONATHAN_SACKS       -> "הרב סאקס"
        NECHAMA_LEIBOWITZ    -> "נחמה ליבוביץ"
        // Tanakh — Nakh shared Rishonim
        RADAK                -> "רד״ק"
        RALBAG               -> "רלב״ג"
        // Tanakh — Nakh shared Acharonim
        ALSHICH              -> "אלשיך"
        METZUDAT_ZION        -> "מצודת ציון"
        RISHON_LETZION       -> "אור החיים"
        // Tanakh — Nevi'im
        TARGUM_YONATAN       -> "תרגום יונתן"
        // Tanakh — Ketuvim
        TARGUM_KETUVIM       -> "תרגום"
        METZUDAT_DAVID       -> "מצודת דוד"
        // Mishnah
        RAMBAM_MISHNAH       -> "רמב״ם"
        BARTENURA            -> "ברטנורא"
        TOSAFOT_YOM_TOV      -> "תוספות יום טוב"
        RASH_MI_SHANTZ       -> "רא״ש משאנץ"
        MELEKHET_SHLOMO      -> "מלאכת שלמה"
        TOSAFOT_RABBI_AKIVA_EIGER -> "תוספות ר׳ עקיבא איגר"
        YESH_SEDER_LA_MISHNAH -> "יש סדר למשנה"
        MISHNAT_ERETZ_YISRAEL -> "משנת ארץ ישראל"
        ENGLISH_EXPLANATION  -> "קולפ (אנגלית)"
        RASHASH              -> "רש״ש"
        YACHIN               -> "יכין + בועז"
        BOAZ                 -> "בועז"
        RAAVAD               -> "ראב״ד"
        GRA                  -> "אליהו רבה (גר״א)"
        RABBEINU_YONAH       -> "רבינו יונה"
        DEREKH_CHAYYIM       -> "דרך חיים (מהר״ל)"
        NACHALAT_AVOT        -> "נחלת אבות (אברבנאל)"
        // Talmud
        RASHI_TALMUD         -> "רש״י"
        TOSAFOT              -> "תוספות"
        RAN_NEDARIM          -> "ר״ן"
        RABBEINU_CHANANEL     -> "רבינו חננאל"
        RABBEINU_GERSHOM      -> "רבינו גרשום"
        RASHBAM_TALMUD       -> "רשב״ם"
        RAN                  -> "ר״ן (חידושים)"
        RAV_NISSIM_GAON      -> "רב ניסים גאון"
        MEFARESH_TAMID       -> "מפרש תמיד"
        CHIDDUSHEI_RAMBAN    -> "רמב״ן"
        RASHBA               -> "רשב״א"
        RITVA                -> "ריטב״א"
        MEIRI                -> "מאירי"
        SHITA_MEKUBETZET     -> "שיטה מקובצת"
        RAAH                 -> "ר״ה"
        YAD_RAMAH            -> "יד רמ״ה"
        RI_MIGASH            -> "רי מיגש"
        CHIDDUSHEI_HA_RAMBAM -> "רמב״ם"
        TOSAFOT_HA_ROSH      -> "תוספות הרא״ש"
        TOSAFOT_RID          -> "תוספות רי״ד"
        TOSAFOT_SHANTZ       -> "תוספות שאנץ"
        TOSAFOT_YESHANIM     -> "תוספות ישנים"
        PISKEI_TOSAFOT       -> "פסקי תוספות"
        COMMENTARY_OF_THE_ROSH -> "פירוש הרא״ש"
        MAHARSHA             -> "מהרש״א"
        MAHARAM              -> "מהר״ם"
        CHOKHMAT_SHLOMO      -> "חכמת שלמה"
        R_AKIVA_EIGER        -> "ר׳ עקיבא איגר"
        PENEI_YEHOSHUA       -> "פני יהושע"
        HAFLAAH_KETUBOT      -> "האפלה"
        TZLACH               -> "צל״ח"
        CHATAM_SOFER         -> "חתם סופר"
        ARUKH_LA_NER         -> "ערוך לנר"
        RESHIMOT_SHIURIM     -> "רשימות שיעורים (הגרי״ד)"
        EIN_AYAH             -> "עין איה (הראי״ה)"
        PENEI_MOSHE          -> "פני משה"
        MAREY_HA_PANIM       -> "מראה הפנים"
        OHR_LAYESHARIM       -> "אור לישרים"
        TOSEFTA_KIFSHUTAH    -> "תוספתא כפשוטה"
        BRIEF_COMMENTARY     -> "פירוש קצר (ליברמן)"
        // Rambam
        MAGGID_MISHNAH       -> "מגיד משנה"
        KESEF_MISHNAH        -> "כסף משנה"
        MIGDAL_OZ            -> "מגדל עוז"
        LECHEM_MISHNEH       -> "לחם משנה"
        MISHNEH_LA_MELECH    -> "משנה למלך"
        MAHARI_KURKUS_RADBAZ -> "מהרי קורקוס ורדב״ז"
        KIRYAT_SEFER         -> "קרית ספר"
        MAASEH_ROKEACH       -> "מעשה רוקח"
        OR_SAMEACH           -> "אור שמח"
        AVODAT_HA_MELEKH     -> "עבודת המלך"
        EVEN_HA_AZEL         -> "אבן האזל"
        // SA
        MISHNAH_BERURAH      -> "משנה ברורה"
        SHAAREI_TESHUVAH     -> "שערי תשובה"
        BIUR_HALAKHA         -> "ביאור הלכה"
        SHAKH                -> "ש״ך"
        TAZ                  -> "ט״ז"
        CHELKAT_MECHOKEK     -> "חלקת מחוקק"
        BEIT_SHMUEL          -> "בית שמואל"
        MEIRAT_EINAYIM       -> "מאירת עיניים"
        PITCHEI_TESHUVAH     -> "פתחי תשובה"
        BAER_HETEV           -> "באר היטב"
        BEUR_HAGRA_SA        -> "ביאור הגר״א"
        KAF_HA_CHAIM         -> "כף החיים"
        MAGEN_AVRAHAM        -> "מגן אברהם"
        ELIYA_RABBAH         -> "אליה רבה"
        PRI_MEGADIM_OC       -> "פרי מגדים"
        NEKUDAT_HA_KESEF     -> "נקודת הכסף"
        PRI_MEGADIM_YD       -> "פרי מגדים"
        KERETI_U_PELETI      -> "כרתי ופלתי"
        TORAT_HA_SHLAMIM     -> "תורת השלמים"
        BEIT_MEIR            -> "בית מאיר"
        EZER_MI_KODESH       -> "עזר מקדש"
        KTZOT_HA_CHOSHEN     -> "קצות החושן"
        NETIVOT_HA_MISHPAT   -> "נתיבות המשפט"
        URIM_V_TUMIM         -> "אורים ותומים"
        HAGAHOT_RAE          -> "הגהות ר׳ עקיבא איגר"
    }

    companion object {
        fun fromId(id: String): CommentaryType? = values().find { it.id == id }

        val torahPool: List<CommentaryType> = listOf(
            ONKELOS, RASHI_TANAKH, RAMBAN, IBN_EZRA, RASHBAM, RADAK, RALBAG,
            SFORNO, ABARBANEL, KLI_YAKAR, OR_HA_CHAIM, HAAMEK_DAVAR,
            SHADAL, HA_KTAV_VE_HA_KABALAH, MALBIM, TORAH_TEMIMAH,
            CASSUTO_GENESIS, CASSUTO_EXODUS, HOFFMANN_EXODUS, HOFFMANN_LEVITICUS
        )

        val neviimPool: List<CommentaryType> = listOf(
            TARGUM_YONATAN, RASHI_TANAKH, RADAK, ABARBANEL, RALBAG,
            ALSHICH, MALBIM, METZUDAT_DAVID, METZUDAT_ZION, RISHON_LETZION, IBN_EZRA
        )

        val ketuvimPool: List<CommentaryType> = listOf(
            TARGUM_KETUVIM, RASHI_TANAKH, RADAK, RALBAG,
            ALSHICH, MALBIM, METZUDAT_DAVID, METZUDAT_ZION, IBN_EZRA
        )

        /** Five curated groups for the Talmud picker: Rashi-like / Chiddushim / Tosafot-type / Standard Acharonim / Additional Acharonim. */
        val talmudGrouped: List<List<CommentaryType>> = listOf(
            listOf(RAN_NEDARIM, RASHI_TALMUD, RABBEINU_CHANANEL, RABBEINU_GERSHOM,
                   RASHBAM_TALMUD, CHIDDUSHEI_HA_RAMBAM, RAV_NISSIM_GAON, MEFARESH_TAMID),
            listOf(CHIDDUSHEI_RAMBAN, RASHBA, RITVA, RAN, MEIRI, SHITA_MEKUBETZET,
                   RAAH, YAD_RAMAH, RI_MIGASH),
            listOf(TOSAFOT, TOSAFOT_HA_ROSH, TOSAFOT_RID, TOSAFOT_SHANTZ,
                   TOSAFOT_YESHANIM, COMMENTARY_OF_THE_ROSH),
            listOf(MAHARSHA, MAHARAM, CHOKHMAT_SHLOMO, R_AKIVA_EIGER, RASHASH),
            listOf(PENEI_YEHOSHUA, HAFLAAH_KETUBOT, TZLACH, CHATAM_SOFER, ARUKH_LA_NER, RESHIMOT_SHIURIM, EIN_AYAH)
        )

        /** Two curated groups for the Rambam picker: Main (classic) + Later Acharonim. */
        val rambamGrouped: List<List<CommentaryType>> = listOf(
            listOf(MAGGID_MISHNAH, KESEF_MISHNAH, MIGDAL_OZ, LECHEM_MISHNEH, MISHNEH_LA_MELECH, MAHARI_KURKUS_RADBAZ),
            listOf(KIRYAT_SEFER, MAASEH_ROKEACH, OR_SAMEACH, AVODAT_HA_MELEKH, EVEN_HA_AZEL)
        )

        val yerushalmiPool: List<CommentaryType> = listOf(PENEI_MOSHE, MAREY_HA_PANIM, OHR_LAYESHARIM)
        val toseftaPool: List<CommentaryType> = listOf(TOSEFTA_KIFSHUTAH, BRIEF_COMMENTARY)

        val mishnahPool: List<CommentaryType> = listOf(
            RAMBAM_MISHNAH,
            RASH_MI_SHANTZ,
            RAAVAD,
            RABBEINU_YONAH,
            BARTENURA,
            TOSAFOT_YOM_TOV,
            YACHIN,
            MELEKHET_SHLOMO,
            TOSAFOT_RABBI_AKIVA_EIGER,
            GRA,
            RASHASH,
            DEREKH_CHAYYIM,
            NACHALAT_AVOT,
            YESH_SEDER_LA_MISHNAH,
            MISHNAT_ERETZ_YISRAEL,
            ENGLISH_EXPLANATION
        )

        /** Full curated pool of SA commentators for the given section (0=OC, 1=YD, 2=EH, 3=CM). */
        fun saPool(section: Int): List<CommentaryType> = when (section) {
            0 -> listOf( // Orach Chayim
                MISHNAH_BERURAH, BIUR_HALAKHA, MAGEN_AVRAHAM, TAZ, ELIYA_RABBAH,
                SHAAREI_TESHUVAH, PRI_MEGADIM_OC, BAER_HETEV, BEUR_HAGRA_SA, KAF_HA_CHAIM,
                CHOKHMAT_SHLOMO
            )
            1 -> listOf( // Yoreh De'ah
                TAZ, SHAKH, NEKUDAT_HA_KESEF, PRI_MEGADIM_YD, KERETI_U_PELETI,
                TORAT_HA_SHLAMIM, BAER_HETEV, BEUR_HAGRA_SA, PITCHEI_TESHUVAH, KAF_HA_CHAIM
            )
            2 -> listOf( // Even HaEzer
                CHELKAT_MECHOKEK, BEIT_SHMUEL, TAZ, BEIT_MEIR, EZER_MI_KODESH,
                BAER_HETEV, BEUR_HAGRA_SA, PITCHEI_TESHUVAH, CHOKHMAT_SHLOMO
            )
            3 -> listOf( // Choshen Mishpat
                MEIRAT_EINAYIM, SHAKH, TAZ, KTZOT_HA_CHOSHEN,
                NETIVOT_HA_MISHPAT, URIM_V_TUMIM, HAGAHOT_RAE, BAER_HETEV, BEUR_HAGRA_SA,
                PITCHEI_TESHUVAH, CHOKHMAT_SHLOMO
            )
            else -> emptyList()
        }
    }

    /**
     * Returns the bracket style (open, close) for this commentator's sequential inline markers
     * in the SA text for the given section (0=OC, 1=YD, 2=EH, 3=CM).
     * Returns null if this commentator does not use sequential markers in that section.
     */

    /**
     * Returns the Sefaria `data-commentator` attribute value used in SA text for this
     * commentary's sequential inline markers in the given section (0=OC, 1=YD, 2=EH, 3=CM).
     * Returns null if this commentary has no inline markers in that section.
     */
    fun saCommentatorDataName(section: Int): String? = when (section) {
        0 -> when (this) { // Orach Chayim
            TAZ              -> "Turei Zahav"
            MAGEN_AVRAHAM    -> "Magen Avraham"
            SHAAREI_TESHUVAH -> "Shaarei Teshuva"
            else             -> null
        }
        1 -> when (this) { // Yoreh De'ah
            TAZ              -> "Turei Zahav"
            SHAKH            -> "Siftei Kohen"
            PITCHEI_TESHUVAH -> "Pithei Teshuva"
            else             -> null
        }
        2 -> when (this) { // Even HaEzer
            CHELKAT_MECHOKEK -> "Chelkat Mechokek"
            BEIT_SHMUEL      -> "Beit Shmuel"
            PITCHEI_TESHUVAH -> "Pithei Teshuva"
            else             -> null
        }
        3 -> when (this) { // Choshen Mishpat
            MEIRAT_EINAYIM   -> "Sema"
            SHAKH            -> "Siftei Kohen"
            PITCHEI_TESHUVAH -> "Pithei Teshuva"
            else             -> null
        }
        else -> null
    }

    /**
     * True when this commentary has any inline markers in the SA text for the given section.
     * Covers both data-commentator markers (saCommentatorDataName) and Mishnah Berurah's
     * data-label markers in OC (section 0).
     */
    fun hasInlineSAMarkers(section: Int): Boolean =
        saCommentatorDataName(section) != null ||
        (this == MISHNAH_BERURAH && section == 0)

    fun sefariaRef(mainRef: String): String {
        val chapter = mainRef.split(" ").lastOrNull() ?: "1"
        return when (this) {
            ONKELOS -> "Onkelos $mainRef"
            RASHI_TANAKH, RASHI_TALMUD -> "Rashi on $mainRef"
            RAMBAN -> "Ramban on $mainRef"
            IBN_EZRA -> "Ibn Ezra on $mainRef"
            ABARBANEL -> abarbanalRef(mainRef)
            RASHBAM -> "Rashbam on $mainRef"
            SFORNO -> "Sforno on $mainRef"
            HA_KTAV_VE_HA_KABALAH -> "HaKtav VeHaKabalah, $mainRef"
            HAAMEK_DAVAR -> "Haamek Davar on $mainRef"
            HARCHEV_DAVAR -> "Harchev Davar on $mainRef"
            KLI_YAKAR -> "Kli Yakar on $mainRef"
            MALBIM -> "Malbim on $mainRef"
            MESHECH_CHOKHMAH -> meshechChokhmahRef(mainRef)
            OR_HA_CHAIM -> "Or HaChaim on $mainRef"
            RAV_HIRSCH -> "Rav Hirsch on Torah, $mainRef"
            SHADAL -> "Shadal on $mainRef"
            TORAH_TEMIMAH -> "Torah Temimah on Torah, $mainRef"
            CASSUTO_GENESIS -> cassutoGenesisRef(mainRef)
            CASSUTO_EXODUS -> "Cassuto on Exodus $chapter"
            HOFFMANN_EXODUS -> "David Zvi Hoffmann on Exodus $chapter"
            HOFFMANN_LEVITICUS -> "David Zvi Hoffmann on Leviticus $chapter"
            JONATHAN_SACKS -> "Jonathan Sacks Torah Commentary on $mainRef"
            NECHAMA_LEIBOWITZ -> "Nechama Leibowitz on $mainRef"
            RADAK -> "Radak on $mainRef"
            RALBAG -> ralbagRef(mainRef)
            ALSHICH -> alshichRef(mainRef)
            METZUDAT_ZION -> "Metzudat Zion on $mainRef"
            RISHON_LETZION -> "Rishon LeTzion on $mainRef"
            TARGUM_YONATAN -> "Targum Jonathan on $mainRef"
            TARGUM_KETUVIM -> "Targum $mainRef"
            METZUDAT_DAVID -> "Metzudat David on $mainRef"
            RAMBAM_MISHNAH -> "Rambam on $mainRef"
            BARTENURA -> "Bartenura on $mainRef"
            TOSAFOT_YOM_TOV -> "Tosafot Yom Tov on $mainRef"
            RASH_MI_SHANTZ -> "Rash MiShantz on $mainRef"
            MELEKHET_SHLOMO -> "Melekhet Shelomoh on $mainRef"
            TOSAFOT_RABBI_AKIVA_EIGER -> "Tosafot Rabbi Akiva Eiger on $mainRef"
            YESH_SEDER_LA_MISHNAH -> "Yesh Seder LaMishnah on $mainRef"
            MISHNAT_ERETZ_YISRAEL -> "Mishnat Eretz Yisrael on $mainRef"
            ENGLISH_EXPLANATION -> "English Explanation of $mainRef"
            RASHASH -> "Rashash on $mainRef"
            YACHIN -> "Yachin on $mainRef"
            BOAZ -> "Boaz on $mainRef"
            RAAVAD -> "Ra'avad on $mainRef"
            GRA -> if (mainRef.startsWith("Pirkei Avot")) "Gra on $mainRef"
                   else "Eliyahu Rabbah on $mainRef"
            RABBEINU_YONAH -> "Rabbeinu Yonah on $mainRef"
            DEREKH_CHAYYIM -> "Derekh Chayyim $chapter"
            NACHALAT_AVOT -> "Nachalat Avot on Avot $chapter"
            RAN_NEDARIM -> "Ran on $mainRef"
            RABBEINU_CHANANEL -> "Rabbeinu Chananel on $mainRef"
            RABBEINU_GERSHOM -> "Rabbeinu Gershom on $mainRef"
            RASHBAM_TALMUD -> "Rashbam on $mainRef"
            RAN -> "Ran on $mainRef"
            RAV_NISSIM_GAON -> "Rav Nissim Gaon on $mainRef"
            MEFARESH_TAMID -> "Mefaresh on $mainRef"
            CHIDDUSHEI_RAMBAN -> "Chiddushei Ramban on $mainRef"
            RASHBA -> "Rashba on $mainRef"
            RITVA -> "Ritva on $mainRef"
            MEIRI -> "Meiri on $mainRef"
            SHITA_MEKUBETZET -> if (mainRef.startsWith("Nedarim")) "Shita Mekubbetzet on $mainRef"
                                 else "Shita Mekubetzet on $mainRef"
            RAAH -> "Chiddushei HaRa'ah on $mainRef"
            YAD_RAMAH -> "Yad Ramah on $mainRef"
            RI_MIGASH -> "Ri Migash on $mainRef"
            CHIDDUSHEI_HA_RAMBAM -> "Chiddushei HaRambam on $mainRef"
            TOSAFOT_HA_ROSH -> "Tosafot HaRosh on $mainRef"
            TOSAFOT_RID -> "Tosafot Rid on $mainRef"
            TOSAFOT_SHANTZ -> "Tosafot Shantz on $mainRef"
            TOSAFOT_YESHANIM -> "Tosafot Yeshanim on $mainRef"
            PISKEI_TOSAFOT -> "Piskei Tosafot on $mainRef"
            COMMENTARY_OF_THE_ROSH -> "Commentary of the Rosh on $mainRef"
            MAHARSHA       -> "Chidushei Halachot on $mainRef"
            MAHARAM -> "Maharam on $mainRef"
            CHOKHMAT_SHLOMO -> "Chokhmat Shlomo on $mainRef"
            R_AKIVA_EIGER  -> "Gilyon HaShas on $mainRef"
            PENEI_YEHOSHUA -> "Penei Yehoshua on $mainRef"
            HAFLAAH_KETUBOT -> "Haflaah on $mainRef"
            TZLACH         -> "Tziyyun LeNefesh Chayyah on $mainRef"
            CHATAM_SOFER   -> "Chidushei Chatam Sofer on $mainRef"
            ARUKH_LA_NER   -> "Arukh LaNer on $mainRef"
            RESHIMOT_SHIURIM -> "Reshimot Shiurim on $mainRef"
            EIN_AYAH -> ""   // bundled — never fetched from Sefaria
            PENEI_MOSHE -> "Penei Moshe on $mainRef"
            MAREY_HA_PANIM -> "Mareh HaPanim on $mainRef"
            OHR_LAYESHARIM -> "Ohr LaYesharim on $mainRef"
            TOSEFTA_KIFSHUTAH -> {
                // Sefaria ref omits "Tosefta " prefix: "Tosefta Kifshutah on Berakhot 1"
                val r = if (mainRef.startsWith("Tosefta ")) mainRef.removePrefix("Tosefta ") else mainRef
                "Tosefta Kifshutah on $r"
            }
            BRIEF_COMMENTARY -> {
                val r = if (mainRef.startsWith("Tosefta ")) mainRef.removePrefix("Tosefta ") else mainRef
                "Brief Commentary on $r"
            }
            TOSAFOT -> "Tosafot on $mainRef"
            MAGGID_MISHNAH -> "Maggid Mishneh on $mainRef"
            KESEF_MISHNAH -> "Kessef Mishneh on $mainRef"
            MIGDAL_OZ -> "Migdal Oz on $mainRef"
            LECHEM_MISHNEH -> "Lechem Mishneh on $mainRef"
            MISHNEH_LA_MELECH -> "Mishneh LaMelech on $mainRef"
            MAHARI_KURKUS_RADBAZ -> "Commentary of Mahari Kurkus and Radbaz on $mainRef"
            KIRYAT_SEFER -> "Kiryat Sefer on $mainRef"
            MAASEH_ROKEACH -> maasehRokeachRef(mainRef)
            OR_SAMEACH -> "Ohr Sameach on $mainRef"
            AVODAT_HA_MELEKH -> "Avodat HaMelekh on $mainRef"
            EVEN_HA_AZEL -> "Even Ha'azel on $mainRef"
            MISHNAH_BERURAH -> mishnahBerurahRef(mainRef)
            SHAAREI_TESHUVAH -> "Sha'arei Teshuvah on $mainRef"
            BIUR_HALAKHA -> biurHalakhaRef(mainRef)
            SHAKH -> "Siftei Kohen on $mainRef"
            TAZ -> "Turei Zahav on $mainRef"
            CHELKAT_MECHOKEK -> "Chelkat Mechokek on $mainRef"
            BEIT_SHMUEL -> "Beit Shmuel on $mainRef"
            MEIRAT_EINAYIM -> "Me’irat Einayim on $mainRef"
            PITCHEI_TESHUVAH -> "Pitchei Teshuva on $mainRef"
            BAER_HETEV -> "Ba’er Hetev on $mainRef"
            BEUR_HAGRA_SA -> "Beur HaGra on $mainRef"
            KAF_HA_CHAIM -> "Kaf HaChayim on $mainRef"
            MAGEN_AVRAHAM -> magenAvrahamRef(mainRef)
            ELIYA_RABBAH -> "Eliyah Rabbah on $mainRef"
            PRI_MEGADIM_OC -> "Peri Megadim on Orach Chayim, Mishbezot Zahav $chapter"
            NEKUDAT_HA_KESEF -> "Nekudot HaKesef on $mainRef"
            PRI_MEGADIM_YD -> "Peri Megadim on Yoreh De’ah, Mishbezot Zahav $chapter"
            KERETI_U_PELETI -> "Kereti on $mainRef"
            TORAT_HA_SHLAMIM -> "Torat HaShlamim on $mainRef"
            BEIT_MEIR -> "Beit Meir on $mainRef"
            EZER_MI_KODESH -> "Ezer MiKodesh on $mainRef"
            KTZOT_HA_CHOSHEN -> "Ketzot HaChoshen on $mainRef"
            NETIVOT_HA_MISHPAT -> "Netivot HaMishpat, Hidushim on Shulchan Arukh, Choshen Mishpat $chapter"
            URIM_V_TUMIM -> "Urim VeTumim, Urim $chapter"
            HAGAHOT_RAE -> "Rabbi Akiva Eiger on $mainRef"
        }
    }

    private fun meshechChokhmahRef(mainRef: String): String {
        val hebrewNames = mapOf(
            "Genesis" to "Bereshit", "Exodus" to "Shemot", "Leviticus" to "Vayikra",
            "Numbers" to "Bamidbar", "Deuteronomy" to "Devarim"
        )
        val parts = mainRef.split(" ")
        val heBook = hebrewNames[parts[0]] ?: return "Meshekh Chokhmah, $mainRef"
        val rest = parts.drop(1).joinToString(" ")
        return "Meshekh Chokhmah, $heBook $rest"
    }

    private fun cassutoGenesisRef(mainRef: String): String {
        val chapterStr = mainRef.split(" ").lastOrNull() ?: "1"
        val chapter = chapterStr.toIntOrNull() ?: 1
        val section = if (chapter <= 11) "From Adam to Noah" else "From Noah to Abraham"
        return "Cassuto on Genesis, $section $chapter"
    }

    private fun mishnahBerurahRef(mainRef: String): String {
        val num = Regex("""\d+$""").find(mainRef)?.value ?: "1"
        return "Mishnah Berurah $num"
    }

    private fun magenAvrahamRef(mainRef: String): String {
        // Magen Avraham is indexed by siman number on Sefaria, like Mishnah Berurah.
        // "Shulchan Arukh, Orach Chayim 12" → "Magen Avraham 12"
        val num = Regex("""\d+$""").find(mainRef)?.value ?: "1"
        return "Magen Avraham $num"
    }

    private fun extractBookName(mainRef: String): String =
        mainRef.split(" ").dropLast(1).joinToString(" ")

    private val torahBookNames = setOf("Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy")

    private fun abarbanalRef(mainRef: String): String {
        val book = extractBookName(mainRef)
        return if (torahBookNames.contains(book)) "Abarbanel on Torah, $mainRef"
        else "Abarbanel on $mainRef"
    }

    private fun ralbagRef(mainRef: String): String {
        val book = extractBookName(mainRef)
        return when {
            torahBookNames.contains(book) -> "Ralbag on Torah, $mainRef"
            book == "Ruth" || book == "Esther" -> "Ralbag $mainRef"
            else -> "Ralbag on $mainRef"
        }
    }

    private fun alshichRef(mainRef: String): String {
        val book = extractBookName(mainRef)
        val chapter = mainRef.split(" ").lastOrNull() ?: "1"
        val titleMap = mapOf(
            "Joshua" to "Marot HaTzoveot on Joshua",
            "Judges" to "Marot HaTzoveot on Judges",
            "I Samuel" to "Marot HaTzoveot on I Samuel",
            "II Samuel" to "Marot HaTzoveot on II Samuel",
            "I Kings" to "Marot HaTzoveot on I Kings",
            "II Kings" to "Marot HaTzoveot on II Kings",
            "Psalms" to "Romemot El on Psalms",
            "Proverbs" to "Rav Peninim on Proverbs",
            "Job" to "Chelkat Mechokek on Job",
            "Song of Songs" to "Shoshanat HaAmakim on Song of Songs",
            "Ruth" to "Einei Moshe on Ruth",
            "Lamentations" to "Devarim Nichumim on Lamentations",
            "Ecclesiastes" to "Devarim Tovim on Ecclesiastes",
            "Esther" to "Masat Moshe on Esther",
            "Daniel" to "Chavatzelet HaSharon on Daniel"
        )
        return titleMap[book]?.let { "$it $chapter" } ?: "Alshich on $mainRef"
    }

    /** Maaseh Rokeach omits "Mishneh Torah, " from its Sefaria prefix. */
    private fun maasehRokeachRef(mainRef: String): String =
        "Maaseh Rokeach on ${mainRef.removePrefix("Mishneh Torah, ")}"

    // MARK: - Rambam availability

    /** Returns whether this commentary has content for the given Rambam work ID (0-based). */
    fun isAvailableForRambam(workId: Int): Boolean = when (this) {
        MIGDAL_OZ ->
            // Covers Madda–Haflaah (0–28) + Nezikin–Shoftim (48–67).
            // No content for Zeraim, Avodah, Korbanot, Taharah (29–47 + 68–72).
            workId < 29 || (workId in 48..67)
        MAHARI_KURKUS_RADBAZ ->
            // Sefer Avodah only: Beit HaBechirah (34), Klei HaMikdash (35), Bi'at HaMikdash (36)
            workId == 34 || workId == 35 || workId == 36
        AVODAT_HA_MELEKH ->
            // Sefer HaMadda only (0–4)
            workId <= 4
        EVEN_HA_AZEL ->
            // Missing: Torah Study (2), Repentance (4), Circumcision (10),
            // Haflaah: Oaths/Vows/Nazariteship/Appraisals (25–28),
            // Zeraim except Heave Offerings (30–33)
            workId !in setOf(2, 4, 10, 25, 26, 27, 28, 30, 31, 32, 33)
        else -> true
    }

    // Returns whether this Talmud commentary exists on Sefaria for the given tractate.
    // tractateId matches the id field in TextCatalog (0=Berakhot, 1=Shabbat, …)
    fun isAvailableForTalmud(tractateId: Int): Boolean = when (this) {
        RABBEINU_CHANANEL -> tractateId in setOf(1, 3, 5, 6, 8, 9, 11, 20, 21, 23, 24, 26)
        RABBEINU_GERSHOM  -> tractateId == 22 || tractateId == 24  // Bava Batra, Makkot
        RASHBAM_TALMUD    -> tractateId == 3  || tractateId == 22  // Pesachim, Bava Batra
        RAN_NEDARIM       -> tractateId == 15  // Nedarim only (the peirush)
        RAN               -> tractateId in setOf(1, 3, 8, 14, 18, 19) // Shabbat, Pesachim, RH, Ketubot, Gittin, Kiddushin
        RAV_NISSIM_GAON   -> tractateId == 0  || tractateId == 1   // Berakhot, Shabbat
        MEFARESH_TAMID    -> tractateId == 36                       // Tamid only
        RAAH              -> tractateId == 14                       // Ketubot only
        YAD_RAMAH         -> tractateId == 22 || tractateId == 23  // Bava Batra, Sanhedrin
        RI_MIGASH         -> tractateId == 22 || tractateId == 25  // Bava Batra, Shevuot
        CHIDDUSHEI_HA_RAMBAM -> tractateId == 8                    // Rosh Hashanah only
        TOSAFOT_HA_ROSH   -> tractateId == 0                       // Berakhot only (Sefaria)
        TOSAFOT_RID       -> tractateId in setOf(
            1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,18,19,20,21,22,26,39
        ) // Single + multi-recension tractates; excludes Berakhot
        TOSAFOT_SHANTZ    -> tractateId == 17                      // Sotah only
        TOSAFOT_YESHANIM  -> tractateId in setOf(5, 13, 34)        // Yoma, Yevamot, Keritot
        COMMENTARY_OF_THE_ROSH -> tractateId in setOf(15, 16, 36) // Nedarim, Nazir, Tamid
        // Broad rishonim — verified from Sefaria category index
        CHIDDUSHEI_RAMBAN -> tractateId in setOf(
            0,1,2,3,5,6,7,8,9,10,11,12,13,14,16,17,18,19,21,22,23,24,25,26,30,39
        ) // Berakhot–Chagigah, Yevamot–Kiddushin(excl.BK), BM–AZ, Chullin, Niddah
        RASHBA -> tractateId in setOf(
            0,1,2,7,8,10,13,14,15,18,19,20,21,22,25,26,29,30,39
        ) // Berakhot, Shabbat, Eruvin, Beitzah, RH, Megillah, Yevamot–Kiddushin(excl.Nazir/Sotah), BK–BB, Shevuot, AZ, Menachot, Chullin, Niddah
        RITVA -> tractateId in setOf(
            0,2,3,5,6,8,9,10,11,13,14,15,19,24,25,26,30,39
        ) // Berakhot, Eruvin, Pesachim, Yoma, Sukkah, RH, Taanit, Megillah, MK, Yevamot, Ketubot, Nedarim, Kiddushin, Makkot, Shevuot, AZ, Chullin, Niddah
        MEIRI -> tractateId in setOf(
            0,1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,30,36,39
        ) // All major tractates + Horayot(27) + Tamid(36); missing Shekalim, Kodashim(excl.Chullin/Tamid)
        SHITA_MEKUBETZET -> tractateId in setOf(
            0,7,14,15,16,17,20,21,22
        ) // Berakhot, Beitzah, Ketubot, Nedarim, Nazir, Sotah, BK, BM, BB
        PISKEI_TOSAFOT -> tractateId in setOf(
            0,1,2,3,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,26,28,29,30,31,32,33,34,35,36,39
        ) // Broad coverage; missing: Nazir(16), Horayot(27)
        // ── Standard Acharonim ──────────────────────────────────────────────────
        MAHARSHA ->
            // All Bavli except Shekalim (4, Yerushalmi only)
            tractateId != 4
        MAHARAM ->
            // Shabbat(1) Eruvin(2) Pesachim(3) Sukkah(6) Beitzah(7)
            // Yevamot(13) Ketubot(14) Gittin(18) Kiddushin(19)
            // BK(20) BM(21) BB(22) Sanhedrin(23) Makkot(24) AZ(26) Chullin(30) Niddah(39)
            tractateId in setOf(1,2,3,6,7,13,14,18,19,20,21,22,23,24,26,30,39)
        R_AKIVA_EIGER ->
            // All Bavli except Shekalim (4, Yerushalmi) and Tamid (36, mishnahOnly)
            tractateId != 4 && tractateId != 36
        RASHASH ->
            // Talmud context: all Bavli except Shekalim (4) and Tamid (36)
            tractateId != 4 && tractateId != 36
        // ── Additional Acharonim ────────────────────────────────────────────────
        PENEI_YEHOSHUA ->
            // Berakhot(0) Shabbat(1) Pesachim(3) Yoma(5) Sukkah(6) Beitzah(7) RH(8)
            // Megillah(10) Ketubot(14) Gittin(18) Kiddushin(19) BK(20) BM(21)
            // Makkot(24) Shevuot(25) Chullin(30)
            tractateId in setOf(0,1,3,5,6,7,8,10,14,18,19,20,21,24,25,30)
        HAFLAAH_KETUBOT ->
            tractateId == 14  // Ketubot only
        TZLACH ->
            // Berakhot(0) Shabbat(1) Eruvin(2) RH(8) Taanit(9) Megillah(10)
            // Chagigah(12) Zevachim(28) Menachot(29) Chullin(30)
            tractateId in setOf(0,1,2,8,9,10,12,28,29,30)
        CHATAM_SOFER ->
            // Shabbat(1) Pesachim(3) Sukkah(6) Beitzah(7) Megillah(10)
            // Ketubot(14) Nedarim(15) Gittin(18) BK(20) BM(21) BB(22)
            // Sanhedrin(23) Shevuot(25) AZ(26) Chullin(30) Niddah(39)
            tractateId in setOf(1,3,6,7,10,14,15,18,20,21,22,23,25,26,30,39)
        ARUKH_LA_NER ->
            tractateId == 8 || tractateId == 23  // RH, Sanhedrin
        RESHIMOT_SHIURIM ->
            // Berakhot(0) Sukkah(6) Yevamot(13) Nedarim(15) Kiddushin(19)
            // BK(20) BM(21) Sanhedrin(23) Shevuot(25) Horayot(27)
            tractateId in setOf(0,6,13,15,19,20,21,23,25,27)
        EIN_AYAH ->
            tractateId == 0 || tractateId == 1   // Berakhot, Shabbat
        else -> true
    }

    // Returns whether this Mishnah commentary has content for the given tractate.
    // sederIndex: 0=Zeraim, 1=Moed, 2=Nashim, 3=Nezikin, 4=Kodashim, 5=Taharot
    // globalTractateId: the tractate's id field from TextCatalog (0–62)
    fun isAvailableForMishnah(sederIndex: Int, globalTractateId: Int): Boolean = when (this) {
        RASH_MI_SHANTZ -> (sederIndex == 0 && globalTractateId != 0) || sederIndex == 5 // Zeraim (excl. Berakhot) + Taharot
        YESH_SEDER_LA_MISHNAH -> sederIndex == 0 || sederIndex == 1 // Zeraim + Moed
        RAAVAD -> globalTractateId == 2 || globalTractateId == 36 || globalTractateId == 50 // Demai, Eduyot, Kinnim
        GRA -> globalTractateId == 38 || sederIndex == 5  // Avot + all Taharot
        RABBEINU_YONAH, DEREKH_CHAYYIM, NACHALAT_AVOT -> globalTractateId == 38 // Pirkei Avot
        else -> true
    }

    fun isAvailableForYerushalmi(tractateId: Int): Boolean = when (this) {
        PENEI_MOSHE    -> true
        MAREY_HA_PANIM -> tractateId !in setOf(1, 15, 26, 27, 29) // missing: Peah, Yoma, Nazir, Sotah, Kiddushin
        OHR_LAYESHARIM -> tractateId in setOf(0, 1, 14, 15, 16, 17, 18, 19, 20, 21, 22, 33)
            // Berakhot, Peah, Shekalim, Yoma, Sukkah, Beitzah, RH, Taanit, Megillah, Moed Katan, Chagigah, Sanhedrin
        else -> false
    }

    fun isAvailableForTosefta(tractateId: Int): Boolean = when (this) {
        TOSEFTA_KIFSHUTAH -> tractateId <= 32  // Zeraim(0-10), Moed(11-22), Nashim(23-29), BK/BM/BB(30-32)
        BRIEF_COMMENTARY  -> tractateId <= 32 && tractateId !in setOf(13, 16, 29) // minus Pesachim, Sukkah, Kiddushin
        else -> false
    }

    // Returns whether this commentary has known content for the given Tanakh book index.
    // Used to filter the picker so only relevant options are shown for the current book.
    fun isAvailable(bookIndex: Int): Boolean = when (this) {
        // Torah-only
        ONKELOS, RASHBAM, SFORNO, HA_KTAV_VE_HA_KABALAH, HAAMEK_DAVAR,
        HARCHEV_DAVAR, KLI_YAKAR, MESHECH_CHOKHMAH, OR_HA_CHAIM, RAV_HIRSCH,
        SHADAL, TORAH_TEMIMAH, NECHAMA_LEIBOWITZ, JONATHAN_SACKS ->
            bookIndex <= 4
        // Book-specific Torah
        CASSUTO_GENESIS -> bookIndex == 0
        CASSUTO_EXODUS, HOFFMANN_EXODUS -> bookIndex == 1
        HOFFMANN_LEVITICUS -> bookIndex == 2
        MALBIM -> bookIndex != 2  // all Tanakh except Leviticus (not chapter-verse there)
        // Nakh-only
        RISHON_LETZION -> bookIndex >= 5
        TARGUM_YONATAN -> bookIndex in 5..25
        METZUDAT_DAVID, METZUDAT_ZION -> bookIndex >= 5
        TARGUM_KETUVIM -> bookIndex >= 26
        // Ibn Ezra: Torah + Isaiah + 12 Minor Prophets + select Ketuvim
        IBN_EZRA -> bookIndex in setOf(
            0, 1, 2, 3, 4,
            11,
            14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
            26, 28, 29, 32, 33
        )
        // Ralbag: Torah + Early Prophets + select Ketuvim
        RALBAG -> bookIndex in setOf(
            0, 1, 2, 3, 4,
            5, 6, 7, 8, 9, 10,
            27, 28, 29, 30, 32, 33
        )
        // Alshich: Early Prophets + select Ketuvim
        ALSHICH -> bookIndex in setOf(
            5, 6, 7, 8, 9, 10,
            26, 27, 28, 29, 30, 31, 32, 33, 34
        )
        else -> true
    }

    // MARK: - Multi-version refs

    /**
     * True when this commentator combines two different books in one screen.
     * These get the prominent yellow/blue BookDivider separator; Tosafot Rid
     * (different recensions of the same book) uses the subtle RecensionHeader instead.
     */
    val usesBookDivider: Boolean get() = when (this) {
        HAAMEK_DAVAR, YACHIN, MAHARSHA, R_AKIVA_EIGER,
        PRI_MEGADIM_OC, PRI_MEGADIM_YD, KERETI_U_PELETI, NETIVOT_HA_MISHPAT, URIM_V_TUMIM -> true
        else -> false
    }

    /**
     * Returns all (ref, optionalLabel) pairs for fetching this commentary on the given mainRef.
     * For most commentaries returns a single pair with a null label.
     * For Tosafot Rid on multi-recension tractates, returns multiple pairs whose labels
     * are Hebrew recension names (מהדורא קמא etc.) used as visual dividers in the UI.
     */
    fun sefariaRefVersions(mainRef: String): List<Pair<String, String?>> = when (this) {
        TOSAFOT_RID       -> tosafotRidRefs(mainRef)
        HAAMEK_DAVAR      -> haamekDavarRefs(mainRef)
        YACHIN            -> yachinBoazRefs(mainRef)
        MAHARSHA          -> maharshaRefs(mainRef)
        R_AKIVA_EIGER     -> rAbbiAkivaEigerRefs(mainRef)
        PRI_MEGADIM_OC    -> priMegadimOCRefs(mainRef)
        PRI_MEGADIM_YD    -> priMegadimYDRefs(mainRef)
        KERETI_U_PELETI   -> keretiUPeletiRefs(mainRef)
        NETIVOT_HA_MISHPAT -> netivotHaMishpatRefs(mainRef)
        URIM_V_TUMIM      -> urimVTumimRefs(mainRef)
        else              -> listOf(Pair(sefariaRef(mainRef), null))
    }

    private fun haamekDavarRefs(mainRef: String): List<Pair<String, String?>> = listOf(
        Pair("Haamek Davar on $mainRef", "Ha'amek Davar"),
        Pair("Harchev Davar on $mainRef", "Harchev Davar"),
    )

    private fun biurHalakhaRef(mainRef: String): String {
        val num = Regex("""\d+$""").find(mainRef)?.value ?: "1"
        return "Biur Halakha $num"
    }

    // MARK: - SA combined-book refs

    private fun priMegadimOCRefs(mainRef: String): List<Pair<String, String?>> {
        val siman = mainRef.split(" ").lastOrNull() ?: "1"
        return listOf(
            Pair("Peri Megadim on Orach Chayim, Mishbezot Zahav $siman", "משבצות זהב"),
            Pair("Peri Megadim on Orach Chayim, Eshel Avraham $siman",   "אשל אברהם"),
        )
    }

    private fun priMegadimYDRefs(mainRef: String): List<Pair<String, String?>> {
        val siman = mainRef.split(" ").lastOrNull() ?: "1"
        return listOf(
            Pair("Peri Megadim on Yoreh De'ah, Mishbezot Zahav $siman", "משבצות זהב"),
            Pair("Peri Megadim on Yoreh De'ah, Siftei Da'at $siman",    "שפתי דעת"),
        )
    }

    private fun keretiUPeletiRefs(mainRef: String): List<Pair<String, String?>> = listOf(
        Pair("Kereti on $mainRef", "כרתי"),
        Pair("Peleti on $mainRef", "פלתי"),
    )

    private fun netivotHaMishpatRefs(mainRef: String): List<Pair<String, String?>> {
        val siman = mainRef.split(" ").lastOrNull() ?: "1"
        return listOf(
            Pair("Netivot HaMishpat, Hidushim on Shulchan Arukh, Choshen Mishpat $siman", "חידושים"),
            Pair("Netivot HaMishpat, Beurim on Shulchan Arukh, Choshen Mishpat $siman",   "ביאורים"),
        )
    }

    private fun urimVTumimRefs(mainRef: String): List<Pair<String, String?>> {
        val siman = mainRef.split(" ").lastOrNull() ?: "1"
        return listOf(
            Pair("Urim VeTumim, Urim $siman", "אורים"),
            Pair("Urim VeTumim, Tumim $siman", "תומים"),
        )
    }

    private fun yachinBoazRefs(mainRef: String): List<Pair<String, String?>> = listOf(
        Pair("Yachin on $mainRef", "Yachin"),
        Pair("Boaz on $mainRef",   "Boaz"),
    )

    private fun maharshaRefs(mainRef: String): List<Pair<String, String?>> {
        val book = extractBookName(mainRef)
        val agadotOnly = setOf("Nazir", "Zevachim", "Arakhin", "Temurah", "Keritot", "Meilah", "Tamid")
        return if (agadotOnly.contains(book)) {
            listOf(Pair("Chidushei Agadot on $mainRef", null))
        } else {
            listOf(
                Pair("Chidushei Halachot on $mainRef", "חידושי הלכות"),
                Pair("Chidushei Agadot on $mainRef",   "חידושי אגדות"),
            )
        }
    }

    private fun rAbbiAkivaEigerRefs(mainRef: String): List<Pair<String, String?>> {
        val book = extractBookName(mainRef)
        val chiddusheiMissing = setOf(
            "Sotah", "Sanhedrin", "Horayot", "Menachot",
            "Bekhorot", "Arakhin", "Keritot", "Meilah", "Niddah",
        )
        return if (chiddusheiMissing.contains(book)) {
            listOf(Pair("Gilyon HaShas on $mainRef", null))
        } else {
            listOf(
                Pair("Gilyon HaShas on $mainRef",                 "גליון הש\"ס"),
                Pair("Chiddushei Rabbi Akiva Eiger on $mainRef",  "חידושי ר' עקיבא איגר"),
            )
        }
    }

    private fun tosafotRidRefs(mainRef: String): List<Pair<String, String?>> {
        // mainRef for Talmud: "{tractate} {daf}", e.g. "Avodah Zarah 5"
        return when {
            mainRef.startsWith("Avodah Zarah") -> {
                val daf = mainRef.removePrefix("Avodah Zarah")  // " 5"
                listOf(
                    Pair("Tosafot Rid on Avodah Zarah First Recension$daf",  "מהדורא קמא"),
                    Pair("Tosafot Rid on Avodah Zarah Second Recension$daf", "מהדורא תניינא"),
                    Pair("Tosafot Rid on Avodah Zarah Third Recension$daf",  "מהדורא תליתא"),
                )
            }
            mainRef.startsWith("Megillah") -> {
                val daf = mainRef.removePrefix("Megillah")
                listOf(
                    Pair("Tosafot Rid on Megillah First Recension$daf",  "מהדורא קמא"),
                    Pair("Tosafot Rid on Megillah Second Recension$daf", "מהדורא תניינא"),
                )
            }
            mainRef.startsWith("Eruvin") -> {
                val daf = mainRef.removePrefix("Eruvin")
                listOf(Pair("Tosafot Rid on Eruvin Second Recension$daf", null))
            }
            else -> listOf(Pair("Tosafot Rid on $mainRef", null))
        }
    }
}

// MARK: - Commentary Entry

/**
 * A single item in the displayed commentary list.
 */
sealed class CommentaryEntry {
    /** A regular commentary segment. [index] counts only text entries (skips headers). */
    data class Text(val index: Int, val he: String, val en: String) : CommentaryEntry()
    /** Subtle recension separator — used only for Tosafot Rid multi-recension dividers. */
    data class RecensionHeader(val label: String) : CommentaryEntry()
    /** Prominent book-section separator — used when a commentator combines two distinct
     *  works (e.g. Maharsha Halachot + Agadot, Mishnah Berurah + Biur Halakha). */
    data class BookDivider(val label: String) : CommentaryEntry()
}

// MARK: - Hebrew numeral helper

fun toHebrewNumeral(n: Int): String {
    if (n <= 0) return ""
    var remaining = n
    var letters = ""
    for ((v, l) in listOf(400 to "ת", 300 to "ש", 200 to "ר", 100 to "ק")) {
        while (remaining >= v) { letters += l; remaining -= v }
    }
    if (remaining == 15) { letters += "טו"; remaining = 0 }
    else if (remaining == 16) { letters += "טז"; remaining = 0 }
    else {
        for ((v, l) in listOf(90 to "צ", 80 to "פ", 70 to "ע", 60 to "ס", 50 to "נ",
            40 to "מ", 30 to "ל", 20 to "כ", 10 to "י")) {
            while (remaining >= v) { letters += l; remaining -= v }
        }
        for ((v, l) in listOf(9 to "ט", 8 to "ח", 7 to "ז", 6 to "ו", 5 to "ה",
            4 to "ד", 3 to "ג", 2 to "ב", 1 to "א")) {
            while (remaining >= v) { letters += l; remaining -= v }
        }
    }
    return if (letters.length == 1) {
        letters + "׳"
    } else {
        letters.dropLast(1) + "״" + letters.last()
    }
}
