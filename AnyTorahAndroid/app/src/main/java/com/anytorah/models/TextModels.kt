package com.anytorah.models

import java.util.UUID

// MARK: - Category

enum class TextCategory(val displayName: String, val hebrewName: String) {
    TANAKH("Tanakh", "תנ״ך"),
    MISHNAH("Mishnah", "משנה"),
    TALMUD("Talmud", "תלמוד"),
    RAMBAM("Rambam", "רמב״ם"),
    TUR("Tur", "טור"),
    SHULCHAN_ARUKH("Shulkhan Arukh", "שולחן ערוך"),
    MIDRASH("Midrash", "מדרש"),
    TESHUVOT("Teshuvot", "שו״ת");

    val segmentLabelStyle: SegmentLabelStyle get() = when (this) {
        TANAKH -> SegmentLabelStyle.VERSE
        MISHNAH -> SegmentLabelStyle.MISHNAH
        TALMUD -> SegmentLabelStyle.NONE
        RAMBAM -> SegmentLabelStyle.HALAKHA
        TUR -> SegmentLabelStyle.SIF
        SHULCHAN_ARUKH -> SegmentLabelStyle.SIF
        MIDRASH -> SegmentLabelStyle.NONE
        TESHUVOT -> SegmentLabelStyle.NONE
    }
}

enum class TextDisplayMode(val raw: String) {
    SOURCE("source"),
    TRANSLATION("translation"),
    BOTH("both")
}

/**
 * Shulchan Arukh main-text edition. Sefaria has no single edition carrying both nikud and the
 * inline commentary-marker tags (`data-commentator`) our bracket system depends on — confirmed
 * directly against the API, not assumed — so this is a user choice between two different complete
 * digitizations, not a rendering option on one shared text:
 * - [COMMENTARY]: the current default edition — carries every inline marker (Mishnah Berurah
 *   labels, Shakh/Taz/etc. sequential letters) but no nikud.
 * - [NIKUD]: the vocalized Torat Emet edition — no inline markers at all (the leading-`<b>`
 *   siman-title block splitSimanHeader looks for is also absent from it), but full nikud.
 * Rema's `<small>`-tagged glosses exist in both editions independently of this choice, so the
 * Rema-font distinction (processRemaGlosses) applies either way.
 * A future phase may blend the two (splicing marker positions into the vocalized text via word
 * alignment, run as a durable, correctable batch job) — this is the interim, simpler either/or.
 */
enum class SATextMode(val raw: String) {
    COMMENTARY("commentary"),
    NIKUD("nikud");

    companion object {
        fun fromRaw(raw: String?): SATextMode = entries.find { it.raw == raw } ?: COMMENTARY
    }
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

// MARK: - Teshuvot (Responsa)

enum class TeshuvotSubcategory(val id: String, val displayName: String, val hebrewName: String) {
    RISHONIM("rishonim", "Teshuvot Rishonim", "שו״ת ראשונים"),
    ACHARONIM("acharonim", "Teshuvot Acharonim", "שו״ת אחרונים"),
    // PDF/scanned-page based, not Sefaria-based -- see ContemporaryTeshuvotWork. The reader
    // takes a completely different rendering path for this subcategory (an image pager, like
    // Talmud's daf-image mode on iOS) rather than the Sefaria text pipeline every other
    // subcategory shares -- see TextReaderScreen's main-content branch.
    CONTEMPORARY("contemporary", "Teshuvot Contemporary", "שו״ת בני זמננו");

    companion object {
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: RISHONIM
    }
}

/** Which community's rite this posek's teshuvot are associated with — informational only
 *  (shown as a small badge in the work picker), not used in any navigation/fetch logic. */
enum class TeshuvotEdah(val abbreviation: String, val hebrewAbbreviation: String) {
    ASHKENAZ("A", "א"), SEFARAD("S", "ס")
}

/** One selectable entry in a Teshuvot work's second-level ("volume") picker. Introduced
 *  2026-08-28 alongside the Acharonim work list, generalizing the original numeral-only
 *  volumeCount/volumeDisplayLabel scheme (the 13 Rishonim works are re-expressed in this same
 *  shape, unchanged in behavior) — needed because several Acharonim works are structured by
 *  Sefaria as *named* Tur-order sections (Orach Chayim/Yoreh Deah/Even HaEzer/Choshen Mishpat),
 *  not sequential numbered volumes, and a few (Rav Pealim, Shoel uMeshiv) are three levels deep
 *  on Sefaria (Volume → Section → Siman, or Mahadura → Sub-volume → Siman) with no natural way
 *  to add a third wheel to this app's existing Work→Volume→Siman picker shape — those are
 *  flattened into one "volume" list of combined-label entries instead (e.g. "I, Orach Chayim").
 *  [volumes] is never empty — a flat work (no real volume level) is still exactly one
 *  [TeshuvotVolume] entry; `volumeLabel == null` is what actually hides the volume pill/sheet
 *  in the UI. */
data class TeshuvotVolume(
    val label: String,
    /** Hebrew display label, shown when Hebrew mode is on -- used for the nav volume PILL. */
    val hebrewLabel: String,
    /** Sefaria ref with the literal placeholder `{siman}` substituted for the actual number. */
    val refTemplate: String,
    val maxSiman: Int,
    /** Un-abbreviated Hebrew label for the volume-PICKER sheet only -- null falls back to
     *  [hebrewLabel]. Standing policy (2026-08-30): abbreviations like או״ח/יו״ד/אה״ע/חו״מ are
     *  fine for the compact nav pill, but the picker list has no space constraint and should
     *  spell the section name out in full -- set this whenever [hebrewLabel] is an abbreviation.
     *  Only retrofitted onto Mishpetei Uziel so far -- the ~40 pre-existing Rishonim/Acharonim
     *  works with abbreviated Hebrew volume/section labels still show their abbreviation in the
     *  picker too, flagged to the user as a separate, much larger follow-up, not done here.
     *  Trailing param with a default so existing call sites (positional or named) don't need to
     *  change -- unlike Swift, Kotlin data classes DO synthesize this correctly. */
    val pickerHebrewLabel: String? = null
) {
    fun ref(siman: Int): String = refTemplate.replace("{siman}", "$siman")
}

/** One responsum entry in Nishmat HaBayit's picker -- this work has no numeric Siman address
 *  type on Sefaria (each responsum is an individually-titled complex-schema node, per-Part), so
 *  it needs a bespoke titled-list picker instead of [TeshuvotVolume]'s numeric wheel. Verified
 *  against the live Sefaria raw-index + a per-siman /api/texts check, 2026-08-30 -- see
 *  CLAUDE.md's Contemporary Teshuvot section. [number] is a synthetic 1-63 sequential index
 *  (not part of Sefaria's own data) used as this work's teshuvotSiman value so the existing
 *  selection-state plumbing (persistence, nav pill, etc.) needs no new type. [ref] is the
 *  complete, literal Sefaria ref string (embeds the full node title) -- unlike [TeshuvotVolume],
 *  there is no {siman}-substitution template, since the ref isn't formulaic here. */
data class NishmatHaBayitSiman(
    val number: Int,
    val partEnglish: String,
    val partHebrew: String,
    val titleEnglish: String,
    val titleHebrew: String,
    val ref: String
) {
    companion object {
        /** All 63 real responsa, across Nishmat HaBayit's 5 Parts (Pregnancy/Birth/Pregnancy
         *  Loss/Nursing/Contraception) -- front matter (Foreword/Preface/Introduction) and back
         *  matter (Medical Appendices, Bibliography, Halakhic References) are ancillary and
         *  intentionally excluded, per the same policy used for other works' non-responsa sections. */
        val all: List<NishmatHaBayitSiman> = listOf(
        NishmatHaBayitSiman(1, "Pregnancy", "היריון", "Panty Liners during the Seven Neki'im When Trying to Conceive", "תחתונית בז' נקיים באישה המנסה להרות", "Nishmat HaBayit, Part I; Pregnancy, Siman 1; Panty Liners during the Seven Neki'im When Trying to Conceive"),
        NishmatHaBayitSiman(2, "Pregnancy", "היריון", "Onot Perishah at the Beginning of Pregnancy", "עונות פרישה בהתחלת היריון", "Nishmat HaBayit, Part I; Pregnancy, Siman 2; Onot Perishah at the Beginning of Pregnancy"),
        NishmatHaBayitSiman(3, "Pregnancy", "היריון", "Blood in Urine during Pregnancy", "דם בשתן בזמן ההיריון", "Nishmat HaBayit, Part I; Pregnancy, Siman 3; Blood in Urine during Pregnancy"),
        NishmatHaBayitSiman(4, "Pregnancy", "היריון", "Spotting and Bleeding during Pregnancy", "כתמים ודימומים בזמן היריון", "Nishmat HaBayit, Part I; Pregnancy, Siman 4; Spotting and Bleeding during Pregnancy"),
        NishmatHaBayitSiman(5, "Pregnancy", "היריון", "Blood on an Ultrasound Transducer", "דם במכשיר אולטרסאונד", "Nishmat HaBayit, Part I; Pregnancy, Siman 5; Blood on an Ultrasound Transducer"),
        NishmatHaBayitSiman(6, "Pregnancy", "היריון", "Bleeding from Placenta Previa", "דימומים בהיריון בסיכון בעקבות שליית פתח", "Nishmat HaBayit, Part I; Pregnancy, Siman 6; Bleeding from Placenta Previa"),
        NishmatHaBayitSiman(7, "Pregnancy", "היריון", "Bleeding after Cervical Cerclage", "ראיית דם לאחר תפירת צוואר הרחם", "Nishmat HaBayit, Part I; Pregnancy, Siman 7; Bleeding after Cervical Cerclage"),
        NishmatHaBayitSiman(8, "Pregnancy", "היריון", "Mikveh Immersion during Pregnancy", "טבילה בהיריון", "Nishmat HaBayit, Part I; Pregnancy, Siman 8; Mikveh Immersion during Pregnancy"),
        NishmatHaBayitSiman(9, "Birth", "לידה", "Cervical Dilation and the Onset of Labor", "דין פתיחת צוואר הרחם כהתחלת לידה", "Nishmat HaBayit, Part II; Birth, Siman 9; Cervical Dilation and the Onset of Labor"),
        NishmatHaBayitSiman(10, "Birth", "לידה", "Does Expulsion of the Mucus Plug Render a Woman Niddah?", "האם יציאת הפקק הרירי אוסרת?", "Nishmat HaBayit, Part II; Birth, Siman 10; Does Expulsion of the Mucus Plug Render a Woman Niddah?"),
        NishmatHaBayitSiman(11, "Birth", "לידה", "Does Membrane Stripping Render a Woman Niddah?", "האם פעולת הפרדת קרומים ('סטריפינג') אוסרת?", "Nishmat HaBayit, Part II; Birth, Siman 11; Does Membrane Stripping Render a Woman Niddah?"),
        NishmatHaBayitSiman(12, "Birth", "לידה", "Does the Rupture of Membranes Render a Woman Niddah?", "האם ירידת מים אוסרת?", "Nishmat HaBayit, Part II; Birth, Siman 12; Does the Rupture of Membranes Render a Woman Niddah?"),
        NishmatHaBayitSiman(13, "Birth", "לידה", "Assistance of the Husband in the Delivery Room", "סיוע הבעל בחדר לידה", "Nishmat HaBayit, Part II; Birth, Siman 13; Assistance of the Husband in the Delivery Room"),
        NishmatHaBayitSiman(14, "Birth", "לידה", "Mokh Dahuk and Bedikot following Birth", "מוך דחוק ובדיקות ז' נקיים לאחר לידה", "Nishmat HaBayit, Part II; Birth, Siman 14; Mokh Dahuk and Bedikot following Birth"),
        NishmatHaBayitSiman(15, "Birth", "לידה", "Counting Seven Neki'im following a Caesarean Section", "ספירת ז' נקיים לאחר ניתוח קיסרי", "Nishmat HaBayit, Part II; Birth, Siman 15; Counting Seven Neki'im following a Caesarean Section"),
        NishmatHaBayitSiman(16, "Birth", "לידה", "Observation of Blood by a Physician during the Postpartum Examination", "ראיית דם על ידי רופא בבדיקה לאחר הלידה", "Nishmat HaBayit, Part II; Birth, Siman 16; Observation of Blood by a Physician during the Postpartum Examination"),
        NishmatHaBayitSiman(17, "Birth", "לידה", "Attributing Bleeding to Hemorrhoids, Postpartum", "תלייה בטחורים בז' נקיים לאחר לידה", "Nishmat HaBayit, Part II; Birth, Siman 17; Attributing Bleeding to Hemorrhoids, Postpartum"),
        NishmatHaBayitSiman(18, "Birth", "לידה", "Hefsek Taharah after Sunset, Postpartum", "הפסק טהרה ביולדת לאחר שקיעה", "Nishmat HaBayit, Part II; Birth, Siman 18; Hefsek Taharah after Sunset, Postpartum"),
        NishmatHaBayitSiman(19, "Birth", "לידה", "Onot Perishah and Establishing a Veset, Postpartum", "עונות פרישה וקביעת וסת בכ\"ד חודש לאחר לידה", "Nishmat HaBayit, Part II; Birth, Siman 19; Onot Perishah and Establishing a Veset, Postpartum"),
        NishmatHaBayitSiman(20, "Birth", "לידה", "Bedikot with Uterine Prolapse", "בדיקות ז' נקיים במצב צניחת רחם", "Nishmat HaBayit, Part II; Birth, Siman 20; Bedikot with Uterine Prolapse"),
        NishmatHaBayitSiman(21, "Birth", "לידה", "Attributing Blood to a Petza during the Seven Neki'im", "תלייה בפצע בז' נקיים", "Nishmat HaBayit, Part II; Birth, Siman 21; Attributing Blood to a Petza during the Seven Neki'im"),
        NishmatHaBayitSiman(22, "Pregnancy Loss", "אובדן היריון", "Counting Seven Neki'im following D&C", "ספירת ז' נקיים לאחר גרידה", "Nishmat HaBayit, Part III; Pregnancy Loss, Siman 22; Counting Seven Neki'im following D&C"),
        NishmatHaBayitSiman(23, "Pregnancy Loss", "אובדן היריון", "Onot Perishah following a Miscarriage", "עונות פרישה לאחר הפלה", "Nishmat HaBayit, Part III; Pregnancy Loss, Siman 23; Onot Perishah following a Miscarriage"),
        NishmatHaBayitSiman(24, "Pregnancy Loss", "אובדן היריון", "Reducing Bedikot following a Miscarriage", "הפחתת בדיקות באישה שעברה הפלה", "Nishmat HaBayit, Part III; Pregnancy Loss, Siman 24; Reducing Bedikot following a Miscarriage"),
        NishmatHaBayitSiman(25, "Nursing", "הנקה", "The Law of Hargashah (Sensation of Menses)", "בדין הרגשה", "Nishmat HaBayit, Part IV; Nursing, Siman 25; The Law of Hargashah (Sensation of Menses)"),
        NishmatHaBayitSiman(26, "Nursing", "הנקה", "Pain and Reduced Libido", "כאב וחוסר עניין ביחסים", "Nishmat HaBayit, Part IV; Nursing, Siman 26; Pain and Reduced Libido"),
        NishmatHaBayitSiman(27, "Nursing", "הנקה", "Blood on Toilet Paper", "דם על נייר קינוח", "Nishmat HaBayit, Part IV; Nursing, Siman 27; Blood on Toilet Paper"),
        NishmatHaBayitSiman(28, "Nursing", "הנקה", "Breastfeeding a Toddler after an Interruption", "המשך הנקה לאחר הפסקה בפעוט", "Nishmat HaBayit, Part IV; Nursing, Siman 28; Breastfeeding a Toddler after an Interruption"),
        NishmatHaBayitSiman(29, "Nursing", "הנקה", "Passing a Baby between Parents during Niddut", "העברת תינוק בין ההורים בימי הנידות", "Nishmat HaBayit, Part IV; Nursing, Siman 29; Passing a Baby between Parents during Niddut"),
        NishmatHaBayitSiman(30, "Contraception", "אמצעי מניעה", "Family Planning following Childbirth", "בדין דחיית היריון אחר לידה", "Nishmat HaBayit, Part V; Contraception, Siman 30; Family Planning following Childbirth"),
        NishmatHaBayitSiman(31, "Contraception", "אמצעי מניעה", "Contraception after Several Births", "מניעת היריון לאחר כמה לידות", "Nishmat HaBayit, Part V; Contraception, Siman 31; Contraception after Several Births"),
        NishmatHaBayitSiman(32, "Contraception", "אמצעי מניעה", "IUD Use and the Ranking of Contraceptive Options", "שימוש בהתקן תוך רחמי ודירוג אמצעי מניעה", "Nishmat HaBayit, Part V; Contraception, Siman 32; IUD Use and the Ranking of Contraceptive Options"),
        NishmatHaBayitSiman(33, "Contraception", "אמצעי מניעה", "Condom Use When Pregnancy Is Contra Indicated", "שימוש בקונדום במקרה של סכנה להרות", "Nishmat HaBayit, Part V; Contraception, Siman 33; Condom Use When Pregnancy Is Contra Indicated"),
        NishmatHaBayitSiman(34, "Contraception", "אמצעי מניעה", "Spermicide Use", "שימוש בקוטל זרע", "Nishmat HaBayit, Part V; Contraception, Siman 34; Spermicide Use"),
        NishmatHaBayitSiman(35, "Contraception", "אמצעי מניעה", "Diaphragm Use", "שימוש בדיאפרגמה", "Nishmat HaBayit, Part V; Contraception, Siman 35; Diaphragm Use"),
        NishmatHaBayitSiman(36, "Contraception", "אמצעי מניעה", "Emergency Contraception; The \"Morning After\" Pill", "בדין גלולת 'היום שאחרי'", "Nishmat HaBayit, Part V; Contraception, Siman 36; Emergency Contraception; The \"Morning After\" Pill"),
        NishmatHaBayitSiman(37, "Contraception", "אמצעי מניעה", "Depo Provera (Progesterone Injection)", "שימוש בזריקת פרוגסטרון", "Nishmat HaBayit, Part V; Contraception, Siman 37; Depo Provera (Progesterone Injection)"),
        NishmatHaBayitSiman(38, "Contraception", "אמצעי מניעה", "Onot Perishah with Hormonal Contraception", "עונת פרישה וסילוק דמים בעת נטילת גלולות", "Nishmat HaBayit, Part V; Contraception, Siman 38; Onot Perishah with Hormonal Contraception"),
        NishmatHaBayitSiman(39, "Contraception", "אמצעי מניעה", "Establishing a Veset with Hormonal Contraception", "קביעת וסת לגלולות", "Nishmat HaBayit, Part V; Contraception, Siman 39; Establishing a Veset with Hormonal Contraception"),
        NishmatHaBayitSiman(40, "Contraception", "אמצעי מניעה", "Onot Perishah When Stopping Hormonal Contraception", "עונת פרישה בתום השימוש בגלולות", "Nishmat HaBayit, Part V; Contraception, Siman 40; Onot Perishah When Stopping Hormonal Contraception"),
        NishmatHaBayitSiman(41, "Contraception", "אמצעי מניעה", "Extending the Cycle via Hormonal Contraception", "נטילת גלולות ברצף", "Nishmat HaBayit, Part V; Contraception, Siman 41; Extending the Cycle via Hormonal Contraception"),
        NishmatHaBayitSiman(42, "Contraception", "אמצעי מניעה", "When Staining Renders a Woman Niddah", "מתי הופכים כתמים למחזור?", "Nishmat HaBayit, Part V; Contraception, Siman 42; When Staining Renders a Woman Niddah"),
        NishmatHaBayitSiman(43, "Contraception", "אמצעי מניעה", "Post Coital Bleeding with Hormonal Contraception", "דם לאחר תשמיש בנוטלת גלולות", "Nishmat HaBayit, Part V; Contraception, Siman 43; Post Coital Bleeding with Hormonal Contraception"),
        NishmatHaBayitSiman(44, "Contraception", "אמצעי מניעה", "Staining on a Panty Liner or Synthetic Clothing", "כתמים על תחתונית ובגד סינתטי", "Nishmat HaBayit, Part V; Contraception, Siman 44; Staining on a Panty Liner or Synthetic Clothing"),
        NishmatHaBayitSiman(45, "Contraception", "אמצעי מניעה", "A Suspected Lesion and Stain Location on a Bedikah Cloth", "חשש לפצע ומיקום הדם על העד", "Nishmat HaBayit, Part V; Contraception, Siman 45; A Suspected Lesion and Stain Location on a Bedikah Cloth"),
        NishmatHaBayitSiman(46, "Contraception", "אמצעי מניעה", "When a Contraceptive Pill Is Not Absorbed, Recommendations", "המלצה בעקבות אי ספיגת גלולה", "Nishmat HaBayit, Part V; Contraception, Siman 46; When a Contraceptive Pill Is Not Absorbed, Recommendations"),
        NishmatHaBayitSiman(47, "Contraception", "אמצעי מניעה", "Mikveh Immersion with a Hormonal Patch", "טבילה עם מדבקה הורמונלית", "Nishmat HaBayit, Part V; Contraception, Siman 47; Mikveh Immersion with a Hormonal Patch"),
        NishmatHaBayitSiman(48, "Contraception", "אמצעי מניעה", "Bedikot with a Contraceptive Ring", "בדיקות ז' נקיים עם נובה רינג", "Nishmat HaBayit, Part V; Contraception, Siman 48; Bedikot with a Contraceptive Ring"),
        NishmatHaBayitSiman(49, "Contraception", "אמצעי מניעה", "Immersion with a Contraceptive Ring", "טבילה עם נובה רינג", "Nishmat HaBayit, Part V; Contraception, Siman 49; Immersion with a Contraceptive Ring"),
        NishmatHaBayitSiman(50, "Contraception", "אמצעי מניעה", "Insertion of an IUD during the Seven Neki'im", "הכנסת התקן תוך רחמי בז' נקיים", "Nishmat HaBayit, Part V; Contraception, Siman 50; Insertion of an IUD during the Seven Neki'im"),
        NishmatHaBayitSiman(51, "Contraception", "אמצעי מניעה", "Does Removal of an IUD Render a Woman Niddah?", "האם הוצאת התקן תוך רחמי מטמאת?", "Nishmat HaBayit, Part V; Contraception, Siman 51; Does Removal of an IUD Render a Woman Niddah?"),
        NishmatHaBayitSiman(52, "Contraception", "אמצעי מניעה", "Bleeding from an Abrasion Caused by an IUD", "דימום מפצע הנגרם ע\"י התקן תוך רחמי", "Nishmat HaBayit, Part V; Contraception, Siman 52; Bleeding from an Abrasion Caused by an IUD"),
        NishmatHaBayitSiman(53, "Contraception", "אמצעי מניעה", "Premenstrual Staining", "בדין כתמים המקדימים את המחזור", "Nishmat HaBayit, Part V; Contraception, Siman 53; Premenstrual Staining"),
        NishmatHaBayitSiman(54, "Contraception", "אמצעי מניעה", "Colors on Bedikah Cloths", "צבעים בעדי בדיקה", "Nishmat HaBayit, Part V; Contraception, Siman 54; Colors on Bedikah Cloths"),
        NishmatHaBayitSiman(55, "Contraception", "אמצעי מניעה", "Bedikot of Onot Perishah When a Woman Experiences Spotting", "בדיקות בעונת פרישה באישה המרבה להכתים", "Nishmat HaBayit, Part V; Contraception, Siman 55; Bedikot of Onot Perishah When a Woman Experiences Spotting"),
        NishmatHaBayitSiman(56, "Contraception", "אמצעי מניעה", "Minor Monthly Spotting", "כתמים מזעריים פעם בחודש", "Nishmat HaBayit, Part V; Contraception, Siman 56; Minor Monthly Spotting"),
        NishmatHaBayitSiman(57, "Contraception", "אמצעי מניעה", "Waiting before the Seven Neki'im", "המתנה לפני ספירת ז' נקיים בכתם המטמא", "Nishmat HaBayit, Part V; Contraception, Siman 57; Waiting before the Seven Neki'im"),
        NishmatHaBayitSiman(58, "Contraception", "אמצעי מניעה", "Douching before Internal Bedikot", "שטיפה לפני בדיקת ז' נקיים", "Nishmat HaBayit, Part V; Contraception, Siman 58; Douching before Internal Bedikot"),
        NishmatHaBayitSiman(59, "Contraception", "אמצעי מניעה", "A Spot on a Tampon", "נקודה על טמפון", "Nishmat HaBayit, Part V; Contraception, Siman 59; A Spot on a Tampon"),
        NishmatHaBayitSiman(60, "Contraception", "אמצעי מניעה", "Finding Blood on a Diaphragm", "מציאת דם בדיאפרגמה", "Nishmat HaBayit, Part V; Contraception, Siman 60; Finding Blood on a Diaphragm"),
        NishmatHaBayitSiman(61, "Contraception", "אמצעי מניעה", "Onot Perishah with Fertility Awareness Method (FAM)", "עונת פרישה בשיטת המודעות לפוריות", "Nishmat HaBayit, Part V; Contraception, Siman 61; Onot Perishah with Fertility Awareness Method (FAM)"),
        NishmatHaBayitSiman(62, "Contraception", "אמצעי מניעה", "Checking for Secretions with Fertility Awareness Method (FAM)", "בדיקת הפרשות בשיטת המודעות לפוריות", "Nishmat HaBayit, Part V; Contraception, Siman 62; Checking for Secretions with Fertility Awareness Method (FAM)"),
        NishmatHaBayitSiman(63, "Contraception", "אמצעי מניעה", "The Mitzvah of Onah on Mikveh Night with Fertility Awareness Method (FAM)", "מצוות עונה בליל טבילה בשיטת מודעות הפוריות", "Nishmat HaBayit, Part V; Contraception, Siman 63; The Mitzvah of Onah on Mikveh Night with Fertility Awareness Method (FAM)"),
        )

        fun entry(number: Int): NishmatHaBayitSiman? = all.firstOrNull { it.number == number }
    }
}

// MARK: - Contemporary Teshuvot (PDF/scanned-page based, not Sefaria)
// Mirrors TextModels.swift's copy exactly -- see its doc comments (kept in sync) and
// CLAUDE.md's Contemporary Teshuvot section for the indexing methodology and accuracy caveats.

/** One volume of a Contemporary Teshuvot work -- e.g. "Iggros Moshe, EH II". Unlike
 *  [TeshuvotVolume] (Sefaria refs), navigation here is entirely page-image based: a siman
 *  resolves to a raw page NUMBER within that volume's page-image set (see
 *  `TeshuvotPageManager`), hand-indexed from the volume's own printed table of contents. */
// Deliberately no page(siman)/imageUrl(page) convenience methods here, unlike the Swift copy
// -- TeshuvotPageManager needs an Android Context to read the bundled asset (see its own doc
// comment), and this model layer stays plain-data / framework-free. Call
// TeshuvotPageManager.page(context, volume.id, siman) directly at the Composable/ViewModel call
// site instead, where LocalContext.current is already available.
data class ContemporaryTeshuvotVolume(
    /** Matches both the Drive folder name and the key in teshuvot_pages.json/
     *  teshuvot_siman_index.json, e.g. "IggrotMosheEH2". */
    val id: String,
    val label: String,
    val hebrewLabel: String,
    val simanCount: Int
)

/** A Contemporary Teshuvot work, e.g. Iggros Moshe. Parallel to [TeshuvotWork] but for
 *  PDF/scanned-page content rather than Sefaria-digitized text. */
data class ContemporaryTeshuvotWork(
    val id: String,
    val name: String,
    val hebrewName: String,
    /** Common Hebrew abbreviation (e.g. "אג״מ" for אגרות משה) -- see the Swift copy's doc
     *  comment for why this exists and why English names aren't abbreviated. Null falls back
     *  to [hebrewName]. */
    val hebrewAbbreviation: String?,
    val volumes: List<ContemporaryTeshuvotVolume>
) {
    val hebrewDisplayName: String get() = hebrewAbbreviation ?: hebrewName

    companion object {
        /** Iggros Moshe is the pilot work (2026-08-29) -- see the Swift copy's doc comment for
         *  the full status (14 of 15 volumes downloadable, indexing methodology, etc.). Add
         *  volumes here as their page images are uploaded to Drive and their siman index is
         *  built -- see tools/build_teshuvot_pages.py and CLAUDE.md. */
        val works: List<ContemporaryTeshuvotWork> = listOf(
            ContemporaryTeshuvotWork(
                id = "iggrosMoshe",
                name = "Iggros Moshe",
                hebrewName = "אגרות משה",
                hebrewAbbreviation = "אג״מ",
                volumes = listOf(
                    ContemporaryTeshuvotVolume(
                        id = "IggrotMosheEH2",
                        label = "EH II",
                        hebrewLabel = "אה״ע ב",
                        simanCount = 26
                    )
                )
            )
        )
    }
}

/** **Rishonim verified against live Sefaria content, 2026-08-24**; **Acharonim added
 *  2026-08-28**, verified the same way. See `TextModels.swift`'s copy of this doc comment (kept
 *  in sync) and CLAUDE.md's Teshuvot section for the full research trail, title corrections,
 *  and the list of dropped near-empty works/volumes (Ritva/Mahari Weil/Mahari Bruna/HaRashbash/
 *  Rashba-part-I among Rishonim; Mateh Levi/Bach's Kuntres Acharon/Meshiv Davar's Volumes III–IV/
 *  Maharit's Part II Even HaEzer among Acharonim).
 *
 *  `maxSiman(volume)` returns Sefaria-confirmed ceilings where available and a generous
 *  placeholder (`PLACEHOLDER_MAX_SIMAN`) elsewhere — same "generous range + graceful failure on
 *  overshoot" pattern already used for Midrash's native section wheel. */
enum class TeshuvotWork(
    val id: String,
    val displayName: String,
    val hebrewName: String,
    val edah: TeshuvotEdah,
    val century: String
) {
    // Rishonim — 11th–12th century
    RASHI("rashi", "Rashi", "רש״י", TeshuvotEdah.ASHKENAZ, "11th–12th Century"),
    RI_MIGASH("riMigash", "Ri Migash", "ר״י מיגאש", TeshuvotEdah.SEFARAD, "11th–12th Century"),
    RAMBAM("rambamTeshuvot", "Rambam", "רמב״ם", TeshuvotEdah.SEFARAD, "11th–12th Century"),
    // Rishonim — 13th century
    RASHBA("rashba", "Rashba", "רשב״א", TeshuvotEdah.SEFARAD, "13th Century"),
    MAHARAM("maharam", "Maharam", "מהר״ם מרוטנבורג", TeshuvotEdah.ASHKENAZ, "13th Century"),
    MAHARACH_OR_ZARUA("maharachOrZarua", "Maharach Or Zarua", "מהר״ח אור זרוע", TeshuvotEdah.ASHKENAZ, "13th Century"),
    // Rishonim — 14th century
    ROSH("rosh", "Rosh", "רא״ש", TeshuvotEdah.SEFARAD, "14th Century"),
    RAN("ran", "Ran", "ר״ן", TeshuvotEdah.SEFARAD, "14th Century"),
    RIVASH("rivash", "Rivash", "ריב״ש", TeshuvotEdah.SEFARAD, "14th Century"),
    // Rishonim — 15th century
    MAHARIL("maharil", "Maharil", "מהרי״ל", TeshuvotEdah.ASHKENAZ, "15th Century"),
    TERUMAT_HA_DESHEN("terumatHaDeshen", "Terumat HaDeshen", "תרומת הדשן", TeshuvotEdah.ASHKENAZ, "15th Century"),
    MAHARIK("maharik", "Maharik", "מהרי״ק", TeshuvotEdah.ASHKENAZ, "15th Century"),
    SEFER_HA_TASHBETZ("seferHaTashbetz", "Sefer HaTashbetz", "תשב״ץ", TeshuvotEdah.SEFARAD, "15th Century"),

    // Acharonim — 16th century
    AVKAT_ROKHEL("avkatRokhel", "Avkat Rokhel", "אבקת רוכל", TeshuvotEdah.SEFARAD, "16th Century"),
    DIVREI_RIVOT("divreiRivot", "Divrei Rivot", "דברי ריבות", TeshuvotEdah.SEFARAD, "16th Century"),
    RADBAZ("radbaz", "Radbaz", "רדב״ז", TeshuvotEdah.SEFARAD, "16th Century"),
    MAHARAM_MI_PADUA("maharamMiPadua", "Maharam miPadua", "מהר״ם מפדובה", TeshuvotEdah.ASHKENAZ, "16th Century"),
    MAHARSHAL("maharshal", "Maharshal", "מהרש״ל", TeshuvotEdah.ASHKENAZ, "16th Century"),
    MAHARSHDAM("maharshdam", "Maharshdam", "מהרשד״ם", TeshuvotEdah.SEFARAD, "16th Century"),
    REMA("rema", "Rema", "רמ״א", TeshuvotEdah.ASHKENAZ, "16th Century"),
    // Acharonim — 17th century
    BACH("bach", "Bach", "ב״ח", TeshuvotEdah.ASHKENAZ, "17th Century"),
    BEER_SHEVA("beerSheva", "Be'er Sheva", "באר שבע", TeshuvotEdah.ASHKENAZ, "17th Century"),
    CHAKHAM_TZVI("chakhamTzvi", "Chakham Tzvi", "חכם צבי", TeshuvotEdah.ASHKENAZ, "17th Century"),
    HALAKHOT_KETANOT("halakhotKetanot", "Halakhot Ketanot", "הלכות קטנות", TeshuvotEdah.SEFARAD, "17th Century"),
    HAVOT_YAIR("havotYair", "Havot Yair", "חוות יאיר", TeshuvotEdah.ASHKENAZ, "17th Century"),
    MAHARIT("maharit", "Maharit", "מהרי״ט", TeshuvotEdah.SEFARAD, "17th Century"),
    // Acharonim — 18th century
    ADMAT_KODESH("admatKodesh", "Admat Kodesh", "אדמת קודש", TeshuvotEdah.SEFARAD, "18th Century"),
    NODA_BIYEHUDAH("nodaBiyehudah", "Noda BiYehudah", "נודע ביהודה", TeshuvotEdah.ASHKENAZ, "18th Century"),
    RABBI_AKIVA_EIGER("rabbiAkivaEiger", "Rabbi Akiva Eiger", "רבי עקיבא איגר", TeshuvotEdah.ASHKENAZ, "18th Century"),
    SHEILAT_YAAVETZ("sheilatYaavetz", "Sheilat Yaavetz", "שאילת יעב״ץ", TeshuvotEdah.ASHKENAZ, "18th Century"),
    TORAT_NETANEL("toratNetanel", "Torat Netanel", "תורת נתנאל", TeshuvotEdah.ASHKENAZ, "18th Century"),
    // Acharonim — 19th century
    BEER_YITZCHAK("beerYitzchak", "Be'er Yitzchak", "באר יצחק", TeshuvotEdah.ASHKENAZ, "19th Century"),
    BINYAN_OLAM("binyanOlam", "Binyan Olam", "בנין עולם", TeshuvotEdah.ASHKENAZ, "19th Century"),
    BINYAN_TZIYON("binyanTziyon", "Binyan Tziyon", "בנין ציון", TeshuvotEdah.ASHKENAZ, "19th Century"),
    CHATAM_SOFER("chatamSofer", "Chatam Sofer", "חתם סופר", TeshuvotEdah.ASHKENAZ, "19th Century"),
    CHIDUSHEI_HA_RIM("chidusheiHaRim", "Chidushei HaRim", "חידושי הרי״ם", TeshuvotEdah.ASHKENAZ, "19th Century"),
    HA_ELEF_LEKHA_SHLOMO("haElefLekhaShlomo", "HaElef Lekha Shlomo", "האלף לך שלמה", TeshuvotEdah.ASHKENAZ, "19th Century"),
    KERAKH_SHEL_ROMI("kerakhShelRomi", "Kerakh shel Romi", "כרך של רומי", TeshuvotEdah.SEFARAD, "19th Century"),
    MAHARSHAM("maharsham", "Maharsham", "מהרש״ם", TeshuvotEdah.ASHKENAZ, "19th Century"),
    MESHIV_DAVAR("meshivDavar", "Meshiv Davar", "משיב דבר", TeshuvotEdah.ASHKENAZ, "19th Century"),
    MELAMMED_LEHOIL("melammedLehoil", "Melammed Lehoil", "מלמד להועיל", TeshuvotEdah.ASHKENAZ, "19th Century"),
    RAV_PEALIM("ravPealim", "Rav Pealim", "רב פעלים", TeshuvotEdah.SEFARAD, "19th Century"),
    SHOEL_UMESHIV("shoelUmeshiv", "Shoel uMeshiv", "שואל ומשיב", TeshuvotEdah.ASHKENAZ, "19th Century"),
    TESHUVA_MEAHAVA("teshuvaMeahava", "Teshuva MeAhava", "תשובה מאהבה", TeshuvotEdah.ASHKENAZ, "19th Century"),

    // Contemporary — Sefaria-digitized modern responsa, shown alongside the page-image-based
    // Iggros Moshe under the same "Contemporary" subcategory (see ContemporaryTeshuvotWork and
    // TextReaderViewModel.contemporaryUsesSefaria). Declaration order is the order they appear
    // in the Contemporary book picker, after Iggros Moshe — per explicit request. `century` is
    // unused for these (Contemporary is a flat list, never century-grouped) — placeholder only.
    MISHPETEI_UZIEL("mishpeteiUziel", "Mishpetei Uziel", "משפטי עוזיאל", TeshuvotEdah.SEFARAD, "Contemporary"),
    BENEI_BANIM("beneiBanim", "Benei Banim", "בני בנים", TeshuvotEdah.ASHKENAZ, "Contemporary"),
    BMAREH_HABAZAK("bmarehHabazak", "B'mareh HaBazak", "במראה הבזק", TeshuvotEdah.SEFARAD, "Contemporary"),
    // No numeric Siman address type on Sefaria (see NishmatHaBayitSiman's doc comment) -- uses a
    // bespoke titled-list siman picker instead of the ordinary numeric wheel.
    NISHMAT_HA_BAYIT("nishmatHaBayit", "Nishmat HaBayit", "נשמת הבית", TeshuvotEdah.SEFARAD, "Contemporary");

    val subcategory: TeshuvotSubcategory get() = when (this) {
        RASHI, RI_MIGASH, RAMBAM, RASHBA, MAHARAM, MAHARACH_OR_ZARUA, ROSH, RAN, RIVASH,
        MAHARIL, TERUMAT_HA_DESHEN, MAHARIK, SEFER_HA_TASHBETZ -> TeshuvotSubcategory.RISHONIM
        MISHPETEI_UZIEL, BENEI_BANIM, BMAREH_HABAZAK, NISHMAT_HA_BAYIT -> TeshuvotSubcategory.CONTEMPORARY
        else -> TeshuvotSubcategory.ACHARONIM
    }

    /** Label for the second-level ("volume") picker; null when the work is really just one
     *  continuously-numbered collection (no separate volume wheel shown) — i.e. [volumes] has
     *  exactly one entry. */
    val volumeLabel: String? get() = when (this) {
        RASHBA, TERUMAT_HA_DESHEN, BACH, HALAKHOT_KETANOT, MAHARIT, MELAMMED_LEHOIL -> "Part"
        ROSH -> "Klal"
        SEFER_HA_TASHBETZ -> "Chelek"
        RADBAZ, MAHARSHAM, SHEILAT_YAAVETZ, MESHIV_DAVAR, RABBI_AKIVA_EIGER, NODA_BIYEHUDAH, RAV_PEALIM,
        MISHPETEI_UZIEL, BENEI_BANIM, BMAREH_HABAZAK -> "Volume"
        MAHARSHDAM, ADMAT_KODESH, BEER_YITZCHAK, BINYAN_OLAM, CHATAM_SOFER, CHIDUSHEI_HA_RIM, HA_ELEF_LEKHA_SHLOMO -> "Section"
        SHOEL_UMESHIV -> "Mahadura"
        else -> null
    }

    /** Hebrew word for the volume-level label, shown in place of [volumeLabel] when
     *  saHebrewMode is on. Mirrors [volumeLabel]'s cases exactly (null in the same places). */
    val volumeLabelHebrew: String? get() = when (this) {
        ROSH -> "כלל"
        SHOEL_UMESHIV -> "מהדורא"
        else -> if (volumeLabel == null) null else "חלק"
    }

    /** The second-level picker's entries — see [TeshuvotVolume]'s own doc comment. Never empty:
     *  a flat work ([volumeLabel] null) is still exactly one entry, so [maxSiman]/[sefariaRef]/
     *  [volumeDisplayLabel] can all index into this unconditionally. */
    val volumes: List<TeshuvotVolume> get() = when (this) {
        // Rishonim — flat works (single dummy entry)
        RASHI -> listOf(TeshuvotVolume("1", "1", "Teshuvot Rashi {siman}", 382))
        RI_MIGASH -> listOf(TeshuvotVolume("1", "1", "Teshuvot HaRi Migash {siman}", 214))
        RAMBAM -> listOf(TeshuvotVolume("1", "1", "Teshuvot HaRambam {siman}", 293))
        MAHARAM -> listOf(TeshuvotVolume("1", "1", "Teshuvot Maharam, Cremona Edition {siman}", PLACEHOLDER_MAX_SIMAN))
        MAHARACH_OR_ZARUA -> listOf(TeshuvotVolume("1", "1", "Maharach Or Zarua Responsa {siman}", 261))
        RAN -> listOf(TeshuvotVolume("1", "1", "Teshuvot HaRan {siman}", 77))
        RIVASH -> listOf(TeshuvotVolume("1", "1", "Teshuvot HaRivash {siman}", 518))
        MAHARIL -> listOf(TeshuvotVolume("1", "1", "Teshuvot Maharil {siman}", PLACEHOLDER_MAX_SIMAN))
        MAHARIK -> listOf(TeshuvotVolume("1", "1", "Teshuvot Maharik {siman}", 197))

        // Rishonim — multi-volume works
        RASHBA -> {
            // Wheel positions 1-4 map to Sefaria parts IV-VII (I-III excluded — see enum doc).
            val numerals = listOf("IV", "V", "VI", "VII")
            val counts = listOf(330, 293, 286, 540)
            (0..3).map { i ->
                TeshuvotVolume(numerals[i], toHebrewNumeral(i + 4), "Teshuvot haRashba part ${numerals[i]} {siman}", counts[i])
            }
        }
        ROSH -> (1..108).map { n -> TeshuvotVolume("$n", toHebrewNumeral(n), "Teshuvot HaRosh $n:{siman}", PLACEHOLDER_MAX_SIMAN) }
        TERUMAT_HA_DESHEN -> {
            val counts = listOf(354, PLACEHOLDER_MAX_SIMAN)
            (0..1).map { i ->
                val numeral = listOf("I", "II")[i]
                TeshuvotVolume(numeral, toHebrewNumeral(i + 1), "Terumat HaDeshen, Part $numeral {siman}", counts[i])
            }
        }
        SEFER_HA_TASHBETZ -> (0..3).map { i ->
            val numeral = listOf("I", "II", "III", "IV")[i]
            TeshuvotVolume(numeral, toHebrewNumeral(i + 1), "Sefer HaTashbetz, Part $numeral {siman}", PLACEHOLDER_MAX_SIMAN)
        }

        // Acharonim — 16th century
        AVKAT_ROKHEL -> listOf(TeshuvotVolume("1", "1", "Avkat Rokhel {siman}", 217))
        DIVREI_RIVOT -> listOf(TeshuvotVolume("1", "1", "Divrei Rivot {siman}", 430))
        RADBAZ -> {
            val counts = listOf(588, 842, 1571, 1372, 1700, 2341)
            (1..6).map { n -> TeshuvotVolume("$n", toHebrewNumeral(n), "Teshuvot HaRadbaz Volume $n {siman}", counts[n - 1]) }
        }
        // NOT "Teshuvot Maharam" — that title is the unrelated Rishon Meir of Rothenburg.
        MAHARAM_MI_PADUA -> listOf(TeshuvotVolume("1", "1", "Responsa Maharam of Padua {siman}", 90))
        MAHARSHAL -> listOf(TeshuvotVolume("1", "1", "Teshuvot Maharshal {siman}", 101))
        MAHARSHDAM -> listOf(
            TeshuvotVolume("OC", "או״ח", "Responsa Maharashdam, Orach Chayim {siman}", 37),
            TeshuvotVolume("YD", "יו״ד", "Responsa Maharashdam, Yoreh Deah {siman}", 255),
            TeshuvotVolume("EH", "אה״ע", "Responsa Maharashdam, Even HaEzer {siman}", 244),
            TeshuvotVolume("CM", "חו״מ", "Responsa Maharashdam, Choshen Mishpat {siman}", 385)
        )
        REMA -> listOf(TeshuvotVolume("1", "1", "Responsa of Rema {siman}", 133))

        // Acharonim — 17th century
        // Third Sefaria part, "Kuntres Acharon", dropped — see enum doc comment.
        BACH -> listOf(
            TeshuvotVolume("HaYeshanot", "הישנות", "Teshuvot Bayit Chadash, HaYeshanot {siman}", 158),
            TeshuvotVolume("HaChadashot", "החדשות", "Teshuvot Bayit Chadash, HaChadashot {siman}", 96)
        )
        BEER_SHEVA -> listOf(TeshuvotVolume("1", "1", "Be'er Sheva {siman}", 75))
        CHAKHAM_TZVI -> listOf(TeshuvotVolume("1", "1", "Chakham Tzvi {siman}", 169))
        HALAKHOT_KETANOT -> listOf(
            TeshuvotVolume("I", "א", "Halakhot Ketanot, Part I {siman}", 295),
            TeshuvotVolume("II", "ב", "Halakhot Ketanot, Part II {siman}", 318)
        )
        HAVOT_YAIR -> listOf(TeshuvotVolume("1", "1", "Havot Yair {siman}", 238))
        // Part II's Even HaEzer sub-section dropped — empty stub, see enum doc comment.
        MAHARIT -> listOf(
            TeshuvotVolume("I", "א", "Teshuvot Maharit, I {siman}", 152),
            TeshuvotVolume("II, OC", "ב, או״ח", "Teshuvot Maharit, II, Orach Chayim {siman}", 8),
            TeshuvotVolume("II, YD", "ב, יו״ד", "Teshuvot Maharit, II, Yoreh Deah {siman}", 55),
            TeshuvotVolume("II, CM", "ב, חו״מ", "Teshuvot Maharit, II, Choshen Mishpat {siman}", 125)
        )

        // Acharonim — 18th century
        ADMAT_KODESH -> listOf(
            TeshuvotVolume("OC", "או״ח", "Admat Kodesh, Orach Chayim {siman}", 15),
            TeshuvotVolume("YD", "יו״ד", "Admat Kodesh, Yoreh Deah {siman}", 23),
            TeshuvotVolume("EH", "אה״ע", "Admat Kodesh, Even HaEzer {siman}", 54),
            TeshuvotVolume("CM", "חו״מ", "Admat Kodesh, Choshen Mishpat {siman}", 76)
        )
        // User-requested display labels "Kamma"/"Tinyana" — Sefaria's own titles are the bare
        // "Noda BiYehudah I"/"II"; that real title still drives the ref.
        NODA_BIYEHUDAH -> {
            val volDisp = listOf("Kamma", "Tinyana")
            val volDispHe = listOf("קמא", "תניינא")
            val volTitle = listOf("Noda BiYehudah I", "Noda BiYehudah II")
            val secDisp = listOf("OC", "YD", "EH", "CM")
            val secDispHe = listOf("או״ח", "יו״ד", "אה״ע", "חו״מ")
            val secName = listOf("Orach Chayim", "Yoreh Deah", "Even HaEzer", "Choshen Mishpat")
            val secCounts = listOf(listOf(42, 141), listOf(100, 215), listOf(95, 161), listOf(39, 62))
            volDisp.indices.flatMap { vi ->
                secDisp.indices.map { si ->
                    TeshuvotVolume(
                        "${volDisp[vi]}, ${secDisp[si]}", "${volDispHe[vi]}, ${secDispHe[si]}",
                        "${volTitle[vi]}, ${secName[si]} {siman}", secCounts[si][vi]
                    )
                }
            }
        }
        RABBI_AKIVA_EIGER -> listOf(
            TeshuvotVolume("Kamma", "קמא", "Teshuvot Rabbi Akiva Eiger {siman}", 222),
            TeshuvotVolume("Tinyana", "תניינא", "Teshuvot Rabbi Akiva Eiger Tinyana {siman}", 153),
            TeshuvotVolume("Chadashot", "חדשות", "Teshuvot Rabbi Akiva Eiger HaChadashot {siman}", 95)
        )
        SHEILAT_YAAVETZ -> listOf(
            TeshuvotVolume("I", "א", "Sheilat Yaavetz, Volume I {siman}", 172),
            TeshuvotVolume("II", "ב", "Sheilat Yaavetz, Volume II {siman}", 200)
        )
        TORAT_NETANEL -> listOf(TeshuvotVolume("1", "1", "Torat Netanel {siman}", 39))

        // Acharonim — 19th century
        BEER_YITZCHAK -> listOf(
            TeshuvotVolume("OC", "או״ח", "Be'er Yitzchak, Orach Chayim {siman}", 30),
            TeshuvotVolume("YD", "יו״ד", "Be'er Yitzchak, Yoreh Deah {siman}", 32),
            TeshuvotVolume("EH", "אה״ע", "Be'er Yitzchak, Even HaEzer {siman}", 18),
            TeshuvotVolume("CM", "חו״מ", "Be'er Yitzchak, Choshen Mishpat {siman}", 6)
        )
        BINYAN_OLAM -> listOf(
            TeshuvotVolume("OC", "או״ח", "Binyan Olam, Orach Chayim {siman}", 36),
            TeshuvotVolume("YD", "יו״ד", "Binyan Olam, Yoreh Deah {siman}", 66)
        )
        BINYAN_TZIYON -> listOf(TeshuvotVolume("1", "1", "Binyan Tziyon {siman}", 182))
        CHATAM_SOFER -> listOf(
            TeshuvotVolume("OC", "או״ח", "Responsa Chatam Sofer, Orach Chayim {siman}", 208),
            TeshuvotVolume("YD", "יו״ד", "Responsa Chatam Sofer, Yoreh Deah {siman}", 356),
            TeshuvotVolume("EH I", "אה״ע א", "Responsa Chatam Sofer, Even HaEzer 1:{siman}", 152),
            TeshuvotVolume("EH II", "אה״ע ב", "Responsa Chatam Sofer, Even HaEzer 2:{siman}", 175),
            TeshuvotVolume("CM", "חו״מ", "Responsa Chatam Sofer, Choshen Mishpat {siman}", 207),
            TeshuvotVolume("Collected", "קובץ תשובות", "Responsa Chatam Sofer, Collected Responsa {siman}", 104)
        )
        CHIDUSHEI_HA_RIM -> listOf(
            TeshuvotVolume("OC", "או״ח", "Chiddushei HaRim Responsa, Orach Chayim {siman}", 7),
            TeshuvotVolume("YD", "יו״ד", "Chiddushei HaRim Responsa, Yoreh Deah {siman}", 20),
            TeshuvotVolume("EH", "אה״ע", "Chiddushei HaRim Responsa, Even HaEzer {siman}", 43),
            TeshuvotVolume("CM", "חו״מ", "Chiddushei HaRim Responsa, Choshen Mishpat {siman}", 7)
        )
        HA_ELEF_LEKHA_SHLOMO -> listOf(
            TeshuvotVolume("OC", "או״ח", "HaElef Lekha Shlomo, Orach Chayim {siman}", 400),
            TeshuvotVolume("YD", "יו״ד", "HaElef Lekha Shlomo, Yoreh Deah {siman}", 342),
            TeshuvotVolume("EH", "אה״ע", "HaElef Lekha Shlomo, Even HaEzer {siman}", 226),
            TeshuvotVolume("CM", "חו״מ", "HaElef Lekha Shlomo, Choshen Mishpat {siman}", 23)
        )
        KERAKH_SHEL_ROMI -> listOf(TeshuvotVolume("1", "1", "Kerakh shel Romi {siman}", 26))
        MAHARSHAM -> {
            val numerals = listOf("I", "II", "III")
            val counts = listOf(230, 270, 378)
            (0..2).map { i -> TeshuvotVolume(numerals[i], toHebrewNumeral(i + 1), "Teshuvot Maharsham Volume ${numerals[i]} {siman}", counts[i]) }
        }
        // Volumes III and IV dropped — empty on Sefaria, see enum doc comment.
        MESHIV_DAVAR -> {
            val numerals = listOf("I", "II")
            val counts = listOf(47, 108)
            (0..1).map { i -> TeshuvotVolume(numerals[i], toHebrewNumeral(i + 1), "Teshuvot Meshiv Davar, Volume ${numerals[i]} {siman}", counts[i]) }
        }
        MELAMMED_LEHOIL -> {
            val numerals = listOf("I", "II", "III")
            val counts = listOf(122, 148, 103)
            (0..2).map { i -> TeshuvotVolume(numerals[i], toHebrewNumeral(i + 1), "Melammed Lehoil Part ${numerals[i]} {siman}", counts[i]) }
        }
        // 4 volumes x Tur order + a kabbalistic "Sod Yesharim" section, flattened — Volume I has
        // no Choshen Mishpat on Sefaria, so its combo is simply omitted below.
        RAV_PEALIM -> {
            val volumeNames = listOf("I", "II", "III", "IV")
            val volumeNamesHe = listOf("א", "ב", "ג", "ד")
            val secDisp = listOf("OC", "YD", "EH", "CM", "Sod Yesharim")
            val secDispHe = listOf("או״ח", "יו״ד", "אה״ע", "חו״מ", "סוד ישרים")
            val secName = listOf("Orach Chayim", "Yoreh Deah", "Even HaEzer", "Choshen Mishpat", "Sod Yesharim")
            val counts = mapOf(
                "I-OC" to 35, "I-YD" to 57, "I-EH" to 13, "I-Sod Yesharim" to 17,
                "II-OC" to 65, "II-YD" to 41, "II-EH" to 34, "II-CM" to 15, "II-Sod Yesharim" to 14,
                "III-OC" to 45, "III-YD" to 32, "III-EH" to 12, "III-CM" to 8, "III-Sod Yesharim" to 13,
                "IV-OC" to 43, "IV-YD" to 39, "IV-EH" to 13, "IV-CM" to 8, "IV-Sod Yesharim" to 20
            )
            volumeNames.indices.flatMap { vi ->
                secDisp.indices.mapNotNull { si ->
                    val maxS = counts["${volumeNames[vi]}-${secDisp[si]}"] ?: return@mapNotNull null
                    TeshuvotVolume(
                        "${volumeNames[vi]}, ${secDisp[si]}", "${volumeNamesHe[vi]}, ${secDispHe[si]}",
                        "Responsa Rav Pealim, Volume ${volumeNames[vi]}, ${secName[si]} {siman}", maxS
                    )
                }
            }
        }
        // 6 Mahadura (printed-edition) volumes; I-IV are further subdivided into 3-4 sub-volumes
        // each on Sefaria — flattened here into one combined-label list, same trick as Rav
        // Pealim/Noda BiYehudah above.
        SHOEL_UMESHIV -> {
            val subCounts = listOf(listOf(313, 194, 223), listOf(97, 86, 137, 190), listOf(473, 203, 165), listOf(61, 226, 153))
            val mahaduraNumerals = listOf("I", "II", "III", "IV")
            val mahaduraHe = listOf("א", "ב", "ג", "ד")
            val vols = mutableListOf<TeshuvotVolume>()
            for (m in 0..3) {
                for ((si, maxS) in subCounts[m].withIndex()) {
                    val sub = si + 1
                    vols.add(TeshuvotVolume(
                        "${mahaduraNumerals[m]}.$sub", "${mahaduraHe[m]}.$sub",
                        "Shoel uMeshiv Mahadura ${mahaduraNumerals[m]} $sub:{siman}", maxS
                    ))
                }
            }
            vols.add(TeshuvotVolume("V", "ה", "Shoel uMeshiv Mahadura V {siman}", 92))
            vols.add(TeshuvotVolume("VI", "ו", "Shoel uMeshiv Mahadura VI {siman}", 63))
            vols
        }
        // Only Part I exists on Sefaria — Parts II/III were never digitized.
        TESHUVA_MEAHAVA -> listOf(TeshuvotVolume("1", "1", "Teshuva MeAhava Part I {siman}", 211))

        // Contemporary — Sefaria-verified 2026-08-30 (live /api/v2/raw/index + /api/shape).
        // Volume x Tur-order section, flattened exactly like Rav Pealim above — Sefaria splits
        // each of Rav Uziel's 9 printed volumes into 1-5 named sections rather than one
        // continuous siman count per volume.
        MISHPETEI_UZIEL -> {
            data class Entry(val vol: String, val volHe: String, val disp: String, val dispHe: String, val name: String, val count: Int)
            val entries = listOf(
                Entry("I", "א", "OC", "או״ח", "Orach Chayim", 26),
                Entry("I", "א", "YD", "יו״ד", "Yoreh De'ah", 30),
                Entry("I", "א", "Omissions", "השמטות", "Omissions", 5),
                Entry("II", "ב", "YD", "יו״ד", "Yoreh De'ah", 66),
                Entry("III", "ג", "OC", "או״ח", "Orach Chayim", 81),
                Entry("III", "ג", "Addenda", "מלואים", "Addenda", 8),
                Entry("IV", "ד", "CM", "חו״מ", "Choshen Mishpat", 47),
                Entry("IV", "ד", "General Topics", "ענינים כלליים", "General Topics", 19),
                Entry("V", "ה", "EH", "אה״ע", "Even HaEzer", 89),
                Entry("VI", "ו", "YD", "יו״ד", "Yoreh De'ah", 131),
                Entry("VI", "ו", "Addenda", "מלואים", "Addenda", 6),
                Entry("VII", "ז", "EH", "אה״ע", "Even HaEzer", 49),
                Entry("VIII", "ח", "OC", "או״ח", "Orach Chayim", 62),
                Entry("IX", "ט", "OC", "או״ח", "Orach Chayim", 9),
                Entry("IX", "ט", "YD", "יו״ד", "Yoreh De'ah", 49),
                Entry("IX", "ט", "EH", "אה״ע", "Even HaEzer", 2),
                Entry("IX", "ט", "CM", "חו״מ", "Choshen Mishpat", 3),
                Entry("IX", "ט", "General Topics", "ענינים כלליים", "General Topics", 3)
            )
            // Un-abbreviated Hebrew for the volume-PICKER sheet only (`pickerHebrewLabel`) — the
            // nav pill keeps the standard Tur-order abbreviation (`hebrewLabel`) unchanged.
            val fullSectionHe = mapOf(
                "או״ח" to "אורח חיים", "יו״ד" to "יורה דעה", "אה״ע" to "אבן העזר", "חו״מ" to "חושן משפט"
            )
            entries.map { e ->
                val pickerHe = fullSectionHe[e.dispHe]?.let { "${e.volHe}, $it" }
                TeshuvotVolume("${e.vol}, ${e.disp}", "${e.volHe}, ${e.dispHe}",
                    "Mishpetei Uziel, Volume ${e.vol}, ${e.name} {siman}", e.count,
                    pickerHebrewLabel = pickerHe)
            }
        }
        // Each volume's main responsa live in an unnamed ("default") sub-node alongside sibling
        // Approbations/Introduction/Essays/Miscellanea sections — only the default node's ref
        // omits any section title, so no third label is appended here (unlike Mishpetei Uziel
        // above). Essays/Miscellanea are skipped as ancillary, matching the policy already used
        // for other Acharonim works' non-responsa sections.
        BENEI_BANIM -> {
            val counts = listOf(44, 52, 45, 28)
            val numerals = listOf("I", "II", "III", "IV")
            (0..3).map { i ->
                TeshuvotVolume(numerals[i], toHebrewNumeral(i + 1), "Responsa Benei Banim, Volume ${numerals[i]} {siman}", counts[i])
            }
        }
        // 10 flat volumes (Siman/Seif, no further sub-sections) from Kollel Eretz Chemda.
        BMAREH_HABAZAK -> {
            val counts = listOf(100, 120, 156, 140, 53, 102, 114, 41, 48, 100)
            val numerals = listOf("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")
            (0..9).map { i ->
                TeshuvotVolume(numerals[i], toHebrewNumeral(i + 1), "B'Mareh HaBazak Volume ${numerals[i]} {siman}", counts[i])
            }
        }
        // Flat -- no real volume level (volumeLabel is null for this work), so this is the one
        // dummy entry every TeshuvotWork needs. refTemplate/ref(siman) are never actually used --
        // sefariaRef(volume:siman:) below special-cases NISHMAT_HA_BAYIT to look up the real ref
        // from NishmatHaBayitSiman.all instead, since the ref embeds each responsum's full title
        // and isn't {siman}-formulaic.
        NISHMAT_HA_BAYIT -> listOf(TeshuvotVolume("1", "1", "", NishmatHaBayitSiman.all.size))
    }

    val volumeCount: Int get() = volumes.size

    /** True when every volume's `label` is a plain number/roman numeral (e.g. Radbaz's "1"-"6",
     *  Rosh's "1"-"108", Rashba's "IV"-"VII") rather than a name/abbreviation (e.g. Rabbi Akiva
     *  Eiger's "Kamma"/"Tinyana"/"Chadashot", or "OC"/"EH I"). Per explicit user direction, the
     *  volume-picker wheel row only shows the generic word ("Part"/"Volume"/"Klal"/"Chelek")
     *  alongside a bare number — a named label already reads fine on its own. Computed from
     *  [volumes] itself (not a separate per-work switch) so it can't drift out of sync with the
     *  label data. */
    val volumeLabelIsNumeric: Boolean get() {
        val romanDigits = setOf('I', 'V', 'X', 'L', 'C', 'D', 'M')
        fun isNumeric(s: String) = s.isNotEmpty() && s.all { it.isDigit() || it in romanDigits }
        return volumes.all { isNumeric(it.label) }
    }

    /** Verified per-work/per-volume siman ceiling where Sefaria's index reports an exact count;
     *  a generous placeholder is retained elsewhere. See the enum's own doc comment. */
    fun maxSiman(volume: Int): Int {
        val vols = volumes
        val idx = (volume - 1).coerceIn(0, vols.size - 1)
        return vols[idx].maxSiman
    }

    /** Display label for a 1-based volume-wheel position. */
    fun volumeDisplayLabel(volume: Int): String {
        val vols = volumes
        val idx = (volume - 1).coerceIn(0, vols.size - 1)
        return vols[idx].label
    }

    /** Hebrew-mode display label for a 1-based volume-wheel position. Never used for
     *  [sefariaRef] — that must stay in Sefaria's own form. */
    fun volumeDisplayLabelHebrew(volume: Int): String {
        val vols = volumes
        val idx = (volume - 1).coerceIn(0, vols.size - 1)
        return vols[idx].hebrewLabel
    }

    /** Hebrew-mode display label for the volume-PICKER wheel only -- prefers the un-abbreviated
     *  [TeshuvotVolume.pickerHebrewLabel] when a volume has one, falling back to the (possibly
     *  abbreviated) [TeshuvotVolume.hebrewLabel] otherwise. The nav pill keeps using
     *  [volumeDisplayLabelHebrew] above. */
    fun volumePickerDisplayLabelHebrew(volume: Int): String {
        val vols = volumes
        val idx = (volume - 1).coerceIn(0, vols.size - 1)
        return vols[idx].pickerHebrewLabel ?: vols[idx].hebrewLabel
    }

    /** Builds the real Sefaria ref for a 1-based volume position and siman number. */
    fun sefariaRef(volume: Int, siman: Int): String {
        // Nishmat HaBayit's ref isn't {siman}-formulaic (see NishmatHaBayitSiman's doc comment)
        // -- `siman` here is really the synthetic 1-63 NishmatHaBayitSiman.number.
        if (this == NISHMAT_HA_BAYIT) {
            return NishmatHaBayitSiman.entry(siman)?.ref ?: NishmatHaBayitSiman.all[0].ref
        }
        val vols = volumes
        val idx = (volume - 1).coerceIn(0, vols.size - 1)
        return vols[idx].ref(siman)
    }

    companion object {
        /** Legacy display-only fallback ceiling for volumes without an individually-verified count. */
        const val PLACEHOLDER_MAX_SIMAN = 400
        fun fromId(id: String?) = values().firstOrNull { it.id == id } ?: RASHI
        fun worksFor(subcategory: TeshuvotSubcategory) = values().filter { it.subcategory == subcategory }
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
    HAGAHOT_RAE("hagahotRAE", "Hagahot R. Akiva Eiger"),
    // Tur
    BEIT_YOSEF("beitYosef", "Beit Yosef"),
    BACH("bach", "Bach"),
    DARKHEI_MOSHE("darkheiMoshe", "Darkhei Moshe"),
    PRISHA_DRISHA("prishaDrisha", "Prisha + Drisha");

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
        // Tur
        BEIT_YOSEF           -> "בית יוסף"
        BACH                 -> "ב״ח"
        DARKHEI_MOSHE        -> "דרכי משה"
        PRISHA_DRISHA        -> "פרישה + דרישה"
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

        /** Fixed commentary pool for Tur — no swap picker, always these 4 tabs. */
        val turPool: List<CommentaryType> = listOf(BEIT_YOSEF, BACH, DARKHEI_MOSHE, PRISHA_DRISHA)
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
            CHELKAT_MECHOKEK -> chelkatMechokekRef(mainRef)
            BEIT_SHMUEL -> beitShmuelRef(mainRef)
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
            // Tur — each commentary is its own top-level Sefaria title, built by stripping
            // the "Tur, " prefix off the main ref and prepending the commentary's own title.
            BEIT_YOSEF -> turCommentaryRef("Beit Yosef", mainRef)
            BACH -> turCommentaryRef("Bach", mainRef)
            DARKHEI_MOSHE -> turCommentaryRef("Darkhei Moshe", mainRef)
            // Fallback single-ref form (not actually used — sefariaRefVersions dispatches
            // Prisha+Drisha to prishaDrishaRefs instead), kept for when-exhaustiveness.
            PRISHA_DRISHA -> turCommentaryRef("Prisha", mainRef)
        }
    }

    /** Builds a Tur commentary's Sefaria ref by stripping the "Tur, " prefix off the main
     *  ref and prepending the commentary's own top-level title, e.g. mainRef
     *  "Tur, Orach Chayim 1" + title "Beit Yosef" -> "Beit Yosef, Orach Chayim 1". */
    private fun turCommentaryRef(title: String, mainRef: String): String {
        val rest = mainRef.removePrefix("Tur, ")
        return "$title, $rest"
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

    // Chelkat Mechokek and Beit Shmuel (EH's two default commentaries) are, like Magen Avraham,
    // standalone top-level Sefaria titles rather than "CommentatorName on $mainRef" — confirmed
    // directly against the API: "Beit Shmuel on Shulchan Arukh, Even HaEzer.5" silently resolves
    // to "Beit Shmuel 1" (Sefaria falls back to the section's first entry instead of erroring on
    // the unparseable "on ..." form), so every siman looked identical regardless of which was
    // selected. Bare "Beit Shmuel 5" / "Chelkat Mechokek 5" resolve correctly to the real siman.
    private fun chelkatMechokekRef(mainRef: String): String {
        val num = Regex("""\d+$""").find(mainRef)?.value ?: "1"
        return "Chelkat Mechokek $num"
    }

    private fun beitShmuelRef(mainRef: String): String {
        val num = Regex("""\d+$""").find(mainRef)?.value ?: "1"
        return "Beit Shmuel $num"
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
        PRI_MEGADIM_OC, PRI_MEGADIM_YD, KERETI_U_PELETI, NETIVOT_HA_MISHPAT, URIM_V_TUMIM,
        PRISHA_DRISHA -> true
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
        PRISHA_DRISHA     -> prishaDrishaRefs(mainRef)
        else              -> listOf(Pair(sefariaRef(mainRef), null))
    }

    private fun haamekDavarRefs(mainRef: String): List<Pair<String, String?>> = listOf(
        Pair("Haamek Davar on $mainRef", "Ha'amek Davar"),
        Pair("Harchev Davar on $mainRef", "Harchev Davar"),
    )

    private fun biurHalakhaRef(mainRef: String): String {
        val num = Regex("""\d+$""").find(mainRef)?.value ?: "1"
        // Biur Halakha is depth-3 (Siman → Seif → Comment); bare siman ref returns only seif 1.
        return "Biur Halakha $num:1-50"
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

    private fun prishaDrishaRefs(mainRef: String): List<Pair<String, String?>> = listOf(
        Pair(turCommentaryRef("Prisha", mainRef), "פרישה"),
        Pair(turCommentaryRef("Drisha", mainRef), "דרישה"),
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
    /** A regular commentary segment.
     *  [index] is the sequential position.
     *  [label] overrides the displayed number when non-null (e.g. mishnah number so all
     *  paragraphs on the same mishnah share a label). */
    data class Text(val index: Int, val label: Int? = null, val he: String, val en: String) : CommentaryEntry()
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
