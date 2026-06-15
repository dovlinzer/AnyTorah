#!/usr/bin/env python3
"""
Patch the 5 MISSING Ein Ayah entries into ein_ayah.json.

These pages were skipped by the original fetch because they use non-standard
{{צתב}} template syntax (nested templates or named params). Daf placements are
known from the diagnostic + manual wikitext inspection.

After patching, copies the updated JSON to both platform asset locations.
"""

import json
import re
import shutil
import time
import urllib.request
import urllib.error
from urllib.parse import quote

API = "https://he.wikisource.org/w/api.php"
UA  = "AnyTorah/1.0 (dlinzer@yctorah.org; Torah study app; patching missing entries)"

JSON_PATH    = "../ein_ayah.json"
IOS_PATH     = "../AnyTorah/ein_ayah.json"
ANDROID_PATH = "../AnyTorahAndroid/app/src/main/assets/ein_ayah.json"

# (title, tractate_key, daf_key, citation)
MISSING = [
    ("עין איה על ברכות ה עג",   "berakhot", "32b", "ה עג"),
    ("עין איה על ברכות ז כב",   "berakhot", "47b", "ז כב"),
    ("עין איה על ברכות ט שדמ",  "berakhot", "63b", "ט שדמ"),
    ("עין איה על שבת א לג",     "shabbat",  "11a", "א לג"),
    ("עין איה על שבת ד ט",      "shabbat",  "50b", "ד ט"),
]

# ── Hebrew numeral helpers (same as fetch script) ─────────────────────────────

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


def citation_sort_key(entry: dict) -> tuple:
    cit = entry.get("citation", "")
    parts = cit.strip().split()
    ch  = he_to_int(parts[0]) if len(parts) > 0 else 0
    sec = he_to_int(parts[1]) if len(parts) > 1 else 0
    return (ch, sec)


# ── Wikisource fetch ──────────────────────────────────────────────────────────

def fetch_wikitext(title: str) -> str:
    params = (
        f"action=query&titles={quote(title, safe='')}"
        f"&prop=revisions&rvprop=content&rvslots=main&format=json"
    )
    req = urllib.request.Request(f"{API}?{params}", headers={"User-Agent": UA})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})
            for page in pages.values():
                revs = page.get("revisions", [])
                if revs:
                    return revs[0]["slots"]["main"]["*"]
            return ""
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry = e.headers.get("Retry-After", "")
                wait = int(retry) if retry.isdigit() else 30 * (attempt + 1)
                print(f"  [429] waiting {wait}s …")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Failed after 5 retries for: {title}")


# ── Wikitext → plain text ─────────────────────────────────────────────────────

# Patterns that appear in Ein Ayah pages we want to strip
_STRIP_TEMPLATES = re.compile(
    r'\{\{(?:צתב|שולי הגליון|ניווט עין איה|הערות שוליים)[^}]*\}\}',
    re.UNICODE | re.DOTALL,
)
_INNER_TEMPLATES = re.compile(r'\{\{[^{}]*\}\}', re.UNICODE)
_WIKI_LINK       = re.compile(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', re.UNICODE)
_BOLD_ITALIC     = re.compile(r"'{2,3}", re.UNICODE)
_MULTI_NL        = re.compile(r'\n{3,}', re.UNICODE)
_CATEGORY        = re.compile(r'\[\[קטגוריה:[^\]]*\]\]', re.UNICODE)
_REFBLOCK        = re.compile(r'<ref[^>]*>.*?</ref>', re.UNICODE | re.DOTALL)
_REFERENCES_TAG  = re.compile(r'<references\s*/>', re.UNICODE)


def wikitext_to_plain(wikitext: str) -> str:
    text = wikitext
    text = _CATEGORY.sub('', text)
    text = _REFBLOCK.sub('', text)
    text = _REFERENCES_TAG.sub('', text)
    # Strip inner templates first (iteratively, innermost first) so that outer
    # {{צתב|...{{צמ|...}}...|tractate|daf|amud}} becomes matchable as a unit.
    for _ in range(8):
        prev = text
        text = _INNER_TEMPLATES.sub('', text)
        if text == prev:
            break
    # Now strip the daf-ref template and nav templates (no nested content left)
    text = _STRIP_TEMPLATES.sub('', text)
    # Catch any remaining {{...}} not matched above
    text = re.sub(r'\{\{[^}]*\}\}', '', text)
    # Clean up leftover pipe-parameter fragments from partially-consumed templates
    # e.g. "|ברכות|לב|ב}}" or just "}}" floating at line start
    text = re.sub(r'\|[^|\n{}\]]*\|[^|\n{}\]]*\}\}', '', text)
    text = re.sub(r'\}\}', '', text)
    text = _WIKI_LINK.sub(r'\1', text)
    text = _BOLD_ITALIC.sub('', text)
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    text = _MULTI_NL.sub('\n\n', text)
    # Remove lines that are only punctuation/whitespace (template residue)
    text = re.sub(r'(?m)^[.,:;·•\s]+$', '', text)
    text = _MULTI_NL.sub('\n\n', text)
    return text.strip()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    patched = 0
    for title, tractate_key, daf_key, citation in MISSING:
        print(f"\nFetching: {title}")
        wikitext = fetch_wikitext(title)
        if not wikitext:
            print(f"  ERROR: empty wikitext — skipping")
            continue

        text = wikitext_to_plain(wikitext)
        if not text:
            print(f"  ERROR: empty after stripping — skipping")
            print(f"  Raw wikitext preview: {wikitext[:200]!r}")
            continue

        entry = {"citation": citation, "text": text}
        print(f"  → {tractate_key} {daf_key}, citation={citation!r}")
        print(f"  text preview: {text[:120]!r}")

        # Insert into JSON, then re-sort that daf's entries
        daf_list = data.setdefault(tractate_key, {}).setdefault(daf_key, [])
        # Remove any stale version of this citation (re-patch with clean text)
        daf_list[:] = [e for e in daf_list if e.get("citation") != citation]

        daf_list.append(entry)
        daf_list.sort(key=citation_sort_key)
        patched += 1
        time.sleep(2)

    print(f"\nPatched {patched} entries.")

    if patched == 0:
        print("Nothing changed — not writing files.")
        return

    # Write master JSON
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Written: {JSON_PATH}")

    # Copy to platform assets
    shutil.copy2(JSON_PATH, IOS_PATH)
    print(f"Copied:  {IOS_PATH}")
    shutil.copy2(JSON_PATH, ANDROID_PATH)
    print(f"Copied:  {ANDROID_PATH}")

    print("\nDone — rebuild both apps to pick up the updated JSON.")


if __name__ == "__main__":
    main()
