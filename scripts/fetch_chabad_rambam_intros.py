#!/usr/bin/env python3
"""
fetch_chabad_rambam_intros.py

Scrapes the introductory mitzvot-listing section that precedes chapter 1
of each Hilkhot (sub-book) in Rambam's Mishneh Torah from chabad.org.

Uses Playwright (headless Chromium) to handle Cloudflare JS challenges.

Output:  scripts/rambam_intros.json   (intermediate; resumable)
         AnyTorah/Models/RambamIntroductions.swift
         AnyTorahAndroid/.../models/RambamIntroductions.kt

Usage:
    pip install playwright && playwright install chromium
    python3 scripts/fetch_chabad_rambam_intros.py
"""

import json
import re
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("Missing dependency.  Run:  pip install playwright && playwright install chromium")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Mapping: app work ID → Chabad Halakhot *index* page article ID
# ---------------------------------------------------------------------------
CHABAD_INDEX_IDS: dict[int, int] = {
    0:  904959,   # Yesodei HaTorah
    1:  910314,   # De'ot
    2:  910970,   # Talmud Torah
    3:  912348,   # Avodat Kochavim / Avodah Zarah
    4:  911887,   # Teshuvah
    5:  912951,   # Keri'at Shema
    6:  920153,   # Tefilah
    7:  925369,   # Tefillin
    8:  936340,   # Tzitzit
    9:  927647,   # Berakhot
    10: 932220,   # Milah
    11: 935196,   # Shabbat
    12: 935286,   # Eruvin
    13: 937298,   # Chametz uMatzah
    14: 946093,   # Shofar, Sukkah veLulav
    15: 951993,   # Ta'aniyot
    16: 952005,   # Megillah vaChanukah
    17: 952873,   # Ishut
    18: 957704,   # Gerushin
    19: 960618,   # Yibbum vChalitzah
    20: 960632,   # Na'arah Betulah
    21: 960637,   # Sotah
    22: 960644,   # Issurei Bi'ah
    23: 968255,   # Ma'akhalot Asurot
    24: 971824,   # Shechitah
    25: 973861,   # Shevuot
    26: 973879,   # Nedarim
    27: 983584,   # Nezirut
    28: 983595,   # Arakhin vaCharamin
    29: 992025,   # Terumot
    30: 997069,   # Ma'asrot
    31: 997071,   # Ma'aser Sheni
    32: 1002526,  # Bikkurim
    33: 1007157,  # Shemitah veYovel
    34: 1007192,  # Beit HaBechirah
    35: 1008222,  # Klei HaMikdash
    36: 1008236,  # Bi'at HaMikdash
    37: 1008239,  # Issurei HaMizbeach
    38: 1062865,  # Korban Pesach
    39: 1062866,  # Chagigah
    40: 1062867,  # Bekhorot
    41: 1017009,  # Ma'aseh HaKorbanot
    42: 1013252,  # Temidim uMusafim
    43: 1020844,  # Pesulei HaMukdashim
    44: 1517144,  # Tum'at Met
    45: 1517250,  # Parah Adumah
    46: 1525214,  # She'ar Avot HaTum'ot
    47: 1526062,  # Mikva'ot
    48: 682965,   # Nizkei Mamon
    49: 1088854,  # Genevah
    50: 1088884,  # Gezelah vaAvedah
    51: 1088906,  # Chovel uMazzik
    52: 1088916,  # Rotze'ach uShmirat HaNefesh
    53: 1362849,  # Mekhirah
    54: 1362850,  # Zechiyah uMattanah
    55: 1362851,  # Shekhenim
    56: 1362852,  # Sheluhin veShuttafin
    57: 1362853,  # Avadim
    58: 1368657,  # Sekhirut
    59: 1152077,  # She'elah uFikkadon
    60: 1159433,  # Malveh veLoveh
    61: 1152032,  # To'en veNit'an
    62: 1170529,  # Nachalot
    63: 1172721,  # Sanhedrin
    64: 1172722,  # Edut
    65: 1181843,  # Mamrim
    66: 1181878,  # Avel
    67: 1188343,  # Melakhim uMilchamot
}

BASE_URL = "https://www.chabad.org"


def is_hebrew(text: str) -> bool:
    he = sum(1 for c in text if "א" <= c <= "ת")
    lat = sum(1 for c in text if c.isalpha() and ord(c) < 128)
    return he > lat


def page_get_chapter1_link(page) -> str | None:
    """Navigate to an index page and return the absolute chapter-1 URL."""
    for a in page.query_selector_all("a"):
        try:
            href = a.get_attribute("href") or ""
            text = (a.inner_text() or "").strip().lower()
        except Exception:
            continue
        if "chapter 1" in text or "chapter-1" in href.lower():
            if href.startswith("/"):
                return BASE_URL + href
            if href.startswith("http"):
                return href
    return None


_HEBREW_CHAR = re.compile(r"[ְ-ת]")  # niqqud + Hebrew letters


def _split_bilingual_line(line: str) -> tuple[str, str]:
    """Split one interleaved English+Hebrew line into (english, hebrew)."""
    m = _HEBREW_CHAR.search(line)
    if not m:
        return line.strip(), ""
    en_raw = line[: m.start()].rstrip()
    en_clean = re.sub(r"\d+$", "", en_raw).rstrip()  # strip trailing footnote digits
    he_part = line[m.start() :].strip()
    return en_clean, he_part


def extract_intro_from_page(page) -> tuple[str, str]:
    """
    Given a loaded Chabad chapter-1 page, extract the intro mitzvot-listing
    section (everything before the first numbered Halacha).

    The bilingual text (Hebrew + English interleaved per line) lives in
    div.article-body.  The intro ends just before a bare "1" line that opens
    the first actual halacha.

    Splits each line into Hebrew and English parts so the two display modes
    show only their respective language.
    """
    try:
        page.wait_for_selector(".article-body", timeout=10000)
    except PWTimeout:
        pass

    el = page.query_selector(".article-body")
    if not el:
        return "", ""

    full_text = (el.inner_text() or "").strip()
    he_lines: list[str] = []
    en_lines: list[str] = []

    for line in full_text.split("\n"):
        stripped = line.strip()
        # A bare digit marks the start of the first halacha — stop here.
        if re.match(r"^\d+$", stripped):
            break
        if stripped:
            en, he = _split_bilingual_line(stripped)
            if en:
                en_lines.append(en)
            if he:
                he_lines.append(he)

    return "\n".join(he_lines), "\n".join(en_lines)


def swift_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def kotlin_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def write_swift(intros: dict[int, dict], out_path: Path) -> None:
    lines = [
        "// RambamIntroductions.swift",
        "// Auto-generated by scripts/fetch_chabad_rambam_intros.py — do not edit manually.",
        "// Source: chabad.org (Mishneh Torah, Eliyahu Touger translation)",
        "",
        "import Foundation",
        "",
        "struct RambamIntro {",
        "    let he: String",
        "    let en: String",
        "}",
        "",
        "// keyed by RambamWork.id",
        "let rambamIntroductions: [Int: RambamIntro] = [",
    ]
    for work_id in sorted(intros.keys()):
        d = intros[work_id]
        he = swift_escape(d.get("he", ""))
        en = swift_escape(d.get("en", ""))
        if not he and not en:
            continue
        lines.append(f'    {work_id}: RambamIntro(he: "{he}", en: "{en}"),')
    lines += ["]", ""]
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out_path}")


def write_kotlin(intros: dict[int, dict], out_path: Path) -> None:
    lines = [
        "// RambamIntroductions.kt",
        "// Auto-generated by scripts/fetch_chabad_rambam_intros.py — do not edit manually.",
        "// Source: chabad.org (Mishneh Torah, Eliyahu Touger translation)",
        "",
        "package com.anytorah.models",
        "",
        "data class RambamIntro(val he: String, val en: String)",
        "",
        "// keyed by RambamWork.id",
        "val rambamIntroductions: Map<Int, RambamIntro> = mapOf(",
    ]
    for work_id in sorted(intros.keys()):
        d = intros[work_id]
        he = kotlin_escape(d.get("he", ""))
        en = kotlin_escape(d.get("en", ""))
        if not he and not en:
            continue
        lines.append(f'    {work_id} to RambamIntro(he = "{he}", en = "{en}"),')
    lines += [")", ""]
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out_path}")


def main() -> None:
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    json_out = script_dir / "rambam_intros.json"
    swift_out = project_root / "AnyTorah" / "Models" / "RambamIntroductions.swift"
    kotlin_out = (
        project_root
        / "AnyTorahAndroid"
        / "app"
        / "src"
        / "main"
        / "java"
        / "com"
        / "anytorah"
        / "models"
        / "RambamIntroductions.kt"
    )

    # Load existing partial results (resumable)
    intros: dict[int, dict] = {}
    if json_out.exists():
        raw = json.loads(json_out.read_text())
        # Only keep entries that have real content (not CF challenge garbage)
        intros = {int(k): v for k, v in raw.items()
                  if v.get("he") or v.get("en")}
        print(f"Resuming — loaded {len(intros)} entries with content.")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = context.new_page()

        for work_id in sorted(CHABAD_INDEX_IDS.keys()):
            # Skip if already have good data
            if work_id in intros and (intros[work_id].get("he") or intros[work_id].get("en")):
                continue

            index_aid = CHABAD_INDEX_IDS[work_id]
            index_url = f"{BASE_URL}/library/article_cdo/aid/{index_aid}/"
            print(f"\nWork {work_id}: {index_url}")

            try:
                page.goto(index_url, wait_until="networkidle", timeout=30000)
                time.sleep(2)  # let CF challenge resolve if any

                ch1_url = page_get_chapter1_link(page)
                if not ch1_url:
                    print(f"  WARNING: no chapter-1 link found")
                    intros[work_id] = {"he": "", "en": "", "error": "no ch1 link"}
                    continue

                print(f"  Chapter-1: {ch1_url}")
                page.goto(ch1_url, wait_until="networkidle", timeout=30000)
                time.sleep(2)

                he, en = extract_intro_from_page(page)
                print(f"  He: {len(he)} chars  En: {len(en)} chars")
                intros[work_id] = {"he": he, "en": en, "ch1_url": ch1_url}

            except Exception as exc:
                print(f"  ERROR: {exc}")
                intros[work_id] = {"he": "", "en": "", "error": str(exc)}

            # Save after every entry
            json_out.write_text(json.dumps(intros, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(1)

        browser.close()

    print(f"\nDone. Total: {len(intros)} entries.")
    json_out.write_text(json.dumps(intros, ensure_ascii=False, indent=2), encoding="utf-8")
    write_swift(intros, swift_out)
    write_kotlin(intros, kotlin_out)


if __name__ == "__main__":
    main()
