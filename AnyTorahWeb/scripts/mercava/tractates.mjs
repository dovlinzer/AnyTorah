// Talmud Bavli tractate list, matching Mercava's own naming (confirmed live 2026-08-15 by
// opening the site's Talmud > Talmud Bavli picker). Where Mercava's spelling differs from
// AnyTorahWeb's own catalog (lib/textCatalog.ts), `mercavaName` carries the exact string as
// rendered on the site so Playwright can find it by text; `ourName` is the sefariaName-style key
// this repo's own code will look up by. startDaf/endDaf are the real printed Vilna Shas daf
// range, ported from lib/textCatalog.ts's talmudSedarim (excluding mishnahOnly tractates: Kinnim,
// Tamid, Middot have no real Gemara and are absent from Mercava's list too). Shekalim IS included
// even though our catalog flags it isYerushalmi=true, because Mercava's own Bavli tab includes it
// (standard Vilna Shas practice of printing the Yerushalmi text as a stand-in).
//
// Real bug, not flakiness: Pesachim and Zevachim originally had mercavaName "Pesachim"/
// "Zevachim" (this repo's own spelling), but the site actually spells them "Pesahim"/"Zevahim"
// (no "c") — three straight scrape runs failed identically with a "waiting for locator" timeout
// on both before this was caught by manually walking the picker in a browser and reading the
// tractate grid directly rather than continuing to blind-retry.
export const TRACTATES = [
  { ourName: "Berakhot", mercavaName: "Brachot", startDaf: 2, endDaf: 64 },
  { ourName: "Shabbat", mercavaName: "Shabbat", startDaf: 2, endDaf: 157 },
  { ourName: "Eruvin", mercavaName: "Eruvin", startDaf: 2, endDaf: 105 },
  { ourName: "Pesachim", mercavaName: "Pesahim", startDaf: 2, endDaf: 121 },
  { ourName: "Shekalim", mercavaName: "Shekalim", startDaf: 2, endDaf: 22 },
  { ourName: "Yoma", mercavaName: "Yoma", startDaf: 2, endDaf: 88 },
  { ourName: "Sukkah", mercavaName: "Succah", startDaf: 2, endDaf: 56 },
  { ourName: "Beitzah", mercavaName: "Betzah", startDaf: 2, endDaf: 40 },
  { ourName: "Rosh Hashanah", mercavaName: "Rosh Hashanah", startDaf: 2, endDaf: 35 },
  { ourName: "Taanit", mercavaName: "Ta'anit", startDaf: 2, endDaf: 31 },
  { ourName: "Megillah", mercavaName: "Megillah", startDaf: 2, endDaf: 32 },
  { ourName: "Moed Katan", mercavaName: "Moed Katan", startDaf: 2, endDaf: 29 },
  { ourName: "Chagigah", mercavaName: "Hagigah", startDaf: 2, endDaf: 27 },
  { ourName: "Yevamot", mercavaName: "Yevamot", startDaf: 2, endDaf: 122 },
  { ourName: "Ketubot", mercavaName: "Ketubot", startDaf: 2, endDaf: 112 },
  { ourName: "Nedarim", mercavaName: "Nedarim", startDaf: 2, endDaf: 91 },
  { ourName: "Nazir", mercavaName: "Nazir", startDaf: 2, endDaf: 66 },
  { ourName: "Sotah", mercavaName: "Sotah", startDaf: 2, endDaf: 49 },
  { ourName: "Gittin", mercavaName: "Gittin", startDaf: 2, endDaf: 90 },
  { ourName: "Kiddushin", mercavaName: "Kiddushin", startDaf: 2, endDaf: 82 },
  { ourName: "Bava Kamma", mercavaName: "Bava Kamma", startDaf: 2, endDaf: 119 },
  { ourName: "Bava Metzia", mercavaName: "Bava Metzia", startDaf: 2, endDaf: 119 },
  { ourName: "Bava Batra", mercavaName: "Bava Batra", startDaf: 2, endDaf: 176 },
  { ourName: "Sanhedrin", mercavaName: "Sanhedrin", startDaf: 2, endDaf: 113 },
  { ourName: "Makkot", mercavaName: "Makkot", startDaf: 2, endDaf: 24 },
  { ourName: "Shevuot", mercavaName: "Shevuot", startDaf: 2, endDaf: 49 },
  { ourName: "Avodah Zarah", mercavaName: "Avodah Zarah", startDaf: 2, endDaf: 76 },
  { ourName: "Horayot", mercavaName: "Horayot", startDaf: 2, endDaf: 14 },
  { ourName: "Zevachim", mercavaName: "Zevahim", startDaf: 2, endDaf: 120 },
  { ourName: "Menachot", mercavaName: "Menahot", startDaf: 2, endDaf: 110 },
  { ourName: "Chullin", mercavaName: "Hullin", startDaf: 2, endDaf: 142 },
  { ourName: "Bekhorot", mercavaName: "Bekhorot", startDaf: 2, endDaf: 61 },
  { ourName: "Arakhin", mercavaName: "Arakhin", startDaf: 2, endDaf: 34 },
  { ourName: "Temurah", mercavaName: "Temurah", startDaf: 2, endDaf: 34 },
  { ourName: "Keritot", mercavaName: "Keretot", startDaf: 2, endDaf: 28 },
  { ourName: "Meilah", mercavaName: "Me'ilah", startDaf: 2, endDaf: 22 },
  { ourName: "Niddah", mercavaName: "Niddah", startDaf: 2, endDaf: 73 },
];
