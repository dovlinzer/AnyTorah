#!/usr/bin/env python3
"""
Diagnostic: compare all Wikisource Ein Ayah pages against ein_ayah.json.

For every page in Wikisource that has a {{צתב}} daf reference, reports whether
it is present in the JSON, absent (skipped), or misplaced (mapped to wrong daf).

Output categories:
  PRESENT   — citation found in JSON on the correct daf
  WRONG DAF — citation found in JSON but on a different daf than the template says
  MISSING   — has a {{צתב}} ref but not in JSON at all
  NO REF    — no {{צתב}} template (index/intro pages — expected skip)

Usage:
    python3 diagnose_ein_ayah.py
"""

import json
import re
import time
import urllib.request
import urllib.error
from urllib.parse import quote

API = "https://he.wikisource.org/w/api.php"
UA  = "AnyTorah/1.0 (dlinzer@yctorah.org; Torah study app; diagnostic)"
SLEEP = 3.0

JSON_PATH = "../ein_ayah.json"

# ── Hebrew numeral conversion ──────────────────────────────────────────────────

_VALS = {
    'א': 1,  'ב': 2,  'ג': 3,  'ד': 4,  'ה': 5,
    'ו': 6,  'ז': 7,  'ח': 8,  'ט': 9,  'י': 10,
    'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60,
    'ע': 70, 'פ': 80, 'צ': 90, 'ק': 100, 'ר': 200,
    'ש': 300, 'ת': 400,
    'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90,
}
_OVERRIDES = {'יה': 15, 'יו': 16, 'טו': 15, 'טז': 16}


def he_to_int(s: str) -> int:
    s = s.strip().strip("'\"״׳")
    if s in _OVERRIDES:
        return _OVERRIDES[s]
    return sum(_VALS.get(c, 0) for c in s)


def daf_str(daf_int: int, amud: str) -> str:
    side = 'a' if amud.strip() in ('א', 'a', '1') else 'b'
    return f"{daf_int}{side}"


_TZITB_RE = re.compile(
    r'\{\{צתב\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^}|]*)\}\}',
    re.UNICODE
)


def extract_daf_ref(wikitext: str):
    """Returns (daf_str, tractate_he) or None."""
    m = _TZITB_RE.search(wikitext)
    if not m:
        return None
    tractate_he = m.group(2).strip()
    daf_he      = m.group(3).strip()
    amud        = m.group(4).strip()
    daf_int     = he_to_int(daf_he)
    if daf_int == 0:
        return None
    return daf_str(daf_int, amud), tractate_he


_TRACTATE_MAP = {'ברכות': 'berakhot', 'שבת': 'shabbat'}

# ── Wikisource API ─────────────────────────────────────────────────────────────

def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry = e.headers.get("Retry-After", "")
                wait = int(retry) if retry.isdigit() else 30 * (attempt + 1)
                print(f"  [429] waiting {wait}s …")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Failed after 5 retries: {url[:80]}")


def fetch_pages_with_content(prefix: str) -> list[tuple[str, str]]:
    """Returns [(title, wikitext)] for all pages under prefix."""
    results = []
    gapcontinue = None
    batch = 0
    while True:
        batch += 1
        params = (
            f"action=query&generator=allpages&gapprefix={quote(prefix)}"
            f"&gapnamespace=0&gaplimit=50&prop=revisions&rvprop=content"
            f"&rvslots=main&format=json"
        )
        if gapcontinue:
            params += f"&gapcontinue={quote(gapcontinue)}"
        data = fetch_json(f"{API}?{params}")
        for page in data.get("query", {}).get("pages", {}).values():
            title   = page.get("title", "")
            revs    = page.get("revisions", [])
            wikitext = revs[0]["slots"]["main"]["*"] if revs else ""
            results.append((title, wikitext))
        cont = data.get("continue", {})
        gapcontinue = cont.get("gapcontinue")
        print(f"  batch {batch}: {len(results)} pages so far")
        if not gapcontinue:
            break
        time.sleep(SLEEP)
    return results


# ── Build citation index from JSON ────────────────────────────────────────────

def build_citation_index(data: dict) -> dict[tuple[str, str], str]:
    """
    Returns {(tractate_key, citation): daf} for every entry in the JSON.
    e.g. ("berakhot", "א יד") → "4a"
    """
    index = {}
    for tractate_key, daf_map in data.items():
        for daf, entries in daf_map.items():
            for e in entries:
                cit = e.get("citation", "").strip()
                if cit:
                    index[(tractate_key, cit)] = daf
    return index


def section_citation(title: str, prefix: str) -> str:
    if title.startswith(prefix + " "):
        return title[len(prefix) + 1:]
    return title


# ── Main ───────────────────────────────────────────────────────────────────────

TRACTATES = [
    ("עין איה על ברכות", "berakhot", "ברכות"),
    ("עין איה על שבת",   "shabbat",  "שבת"),
]


def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    citation_index = build_citation_index(data)

    counts = {"PRESENT": 0, "WRONG_DAF": 0, "MISSING": 0, "NO_REF": 0}
    missing_lines  = []
    wrong_daf_lines = []
    no_ref_lines   = []

    for prefix, tractate_key, expected_he in TRACTATES:
        print(f"\n=== {prefix} ===")
        pages = fetch_pages_with_content(prefix)
        # Filter root index page
        pages = [(t, w) for t, w in pages if t != prefix]
        print(f"  {len(pages)} section pages")

        for title, wikitext in pages:
            cit = section_citation(title, prefix)

            if not wikitext:
                no_ref_lines.append(f"  EMPTY WIKITEXT: {title}")
                counts["NO_REF"] += 1
                continue

            ref = extract_daf_ref(wikitext)

            if ref is None:
                counts["NO_REF"] += 1
                no_ref_lines.append(f"  NO_REF:  {title}")
                continue

            expected_daf, tractate_he = ref
            actual_tractate = _TRACTATE_MAP.get(tractate_he, tractate_he)

            lookup_key = (actual_tractate, cit)
            json_daf = citation_index.get(lookup_key)

            if json_daf is None:
                counts["MISSING"] += 1
                missing_lines.append(
                    f"  MISSING: {title!r:50s}  → should be {actual_tractate} {expected_daf}"
                )
            elif json_daf != expected_daf:
                counts["WRONG_DAF"] += 1
                wrong_daf_lines.append(
                    f"  WRONG_DAF: {title!r:50s}  template={actual_tractate} {expected_daf}  json={json_daf}"
                )
            else:
                counts["PRESENT"] += 1

    # ── Report ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("SUMMARY")
    print(f"  PRESENT   {counts['PRESENT']:4d}  (in JSON on correct daf)")
    print(f"  WRONG_DAF {counts['WRONG_DAF']:4d}  (in JSON but on different daf)")
    print(f"  MISSING   {counts['MISSING']:4d}  (has {{צתב}} ref but absent from JSON)")
    print(f"  NO_REF    {counts['NO_REF']:4d}  (no {{צתב}} template — expected skips)")

    if wrong_daf_lines:
        print("\nWRONG DAF entries:")
        for l in wrong_daf_lines:
            print(l)

    if missing_lines:
        print(f"\nMISSING entries ({len(missing_lines)}):")
        for l in missing_lines:
            print(l)

    if no_ref_lines:
        print(f"\nNO_REF pages ({len(no_ref_lines)}):")
        for l in no_ref_lines:
            print(l)

    print("\nDone.")


if __name__ == "__main__":
    main()
