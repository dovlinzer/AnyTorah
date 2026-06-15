#!/usr/bin/env python3
"""
Fetch Ein Ayah (Rav Kook) from Wikisource and build ein_ayah.json for AnyTorah.

Uses generator=allpages with prop=revisions to fetch titles + wikitext together
in ~40 paginated batches instead of ~1932 individual requests.

Output: ../ein_ayah.json
Structure: {"berakhot": {"2a": [{"citation": "...", "text": "..."}], ...}, "shabbat": {...}}

Usage:
    python3 fetch_ein_ayah.py
"""

import json
import re
import time
import urllib.request
import urllib.error
from collections import defaultdict
from urllib.parse import quote

API = "https://he.wikisource.org/w/api.php"
# Wikimedia requires descriptive User-Agent with contact info
UA = "AnyTorah/1.0 (dlinzer@yctorah.org; Torah study app; fetching public domain text)"
# Pause between paginated batch requests
SLEEP = 3.0

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
    amud = amud.strip()
    side = 'a' if amud in ('א', 'a', '1') else 'b'
    return f"{daf_int}{side}"


# ── Wikisource API ─────────────────────────────────────────────────────────────

def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            retry_after = e.headers.get("Retry-After", "")
            if e.code == 429:
                wait = int(retry_after) if retry_after.isdigit() else 30 * (attempt + 1)
                print(f"  [429] waiting {wait}s (attempt {attempt + 1}/6)...")
                time.sleep(wait)
            else:
                raise RuntimeError(f"HTTP {e.code} for {url[:100]}") from e
    raise RuntimeError(f"Failed after 6 retries: {url[:100]}")


def fetch_pages_with_content(prefix: str) -> list[tuple[str, str]]:
    """
    Yield (title, wikitext) for all pages under `prefix` using a single
    generator=allpages query that returns titles + content together.
    Returns ~50 pages per API call instead of one call per page.
    """
    results = []
    gapcontinue = None
    page_num = 0

    while True:
        page_num += 1
        params = (
            f"action=query"
            f"&generator=allpages"
            f"&gapprefix={quote(prefix)}"
            f"&gapnamespace=0"
            f"&gaplimit=50"
            f"&prop=revisions"
            f"&rvprop=content"
            f"&rvslots=main"
            f"&format=json"
        )
        if gapcontinue:
            params += f"&gapcontinue={quote(gapcontinue)}"

        url = f"{API}?{params}"
        cont_label = repr(gapcontinue[:30]) if gapcontinue else 'start'
        print(f"  batch {page_num} (gapcontinue={cont_label})...")
        data = fetch_json(url)

        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            title = page.get("title", "")
            revs = page.get("revisions", [])
            if revs:
                wikitext = revs[0].get("slots", {}).get("main", {}).get("*", "")
            else:
                wikitext = ""
            results.append((title, wikitext))

        cont = data.get("continue", {})
        gapcontinue = cont.get("gapcontinue")
        if not gapcontinue:
            break

        time.sleep(SLEEP)

    return results


# ── Wikitext parsing ───────────────────────────────────────────────────────────

_TZITB_RE = re.compile(
    r'\{\{צתב\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^}|]*)\}\}',
    re.UNICODE
)
_TRACTATE_MAP = {'ברכות': 'berakhot', 'שבת': 'shabbat'}


def extract_daf_ref(wikitext: str) -> tuple[str, str] | None:
    m = _TZITB_RE.search(wikitext)
    if not m:
        return None
    tractate_he = m.group(2).strip()
    daf_he = m.group(3).strip()
    amud = m.group(4).strip()
    daf_int = he_to_int(daf_he)
    if daf_int == 0:
        return None
    return daf_str(daf_int, amud), tractate_he


def clean_wikitext(text: str) -> str:
    text = re.sub(r'<noinclude>.*?</noinclude>', '', text, flags=re.DOTALL)
    text = re.sub(r'\{\{צתב[^}]*\}\}', '', text)
    for _ in range(5):
        text = re.sub(r'\{\{[^{}]*\}\}', '', text)
    text = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', text)
    text = re.sub(r'\[https?://\S+\s+([^\]]+)\]', r'\1', text)
    text = re.sub(r'\[https?://\S+\]', '', text)
    text = re.sub(r"'{2,3}", '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'^=+[^=]+=+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def section_citation(title: str, prefix: str) -> str:
    if title.startswith(prefix + ' '):
        return title[len(prefix) + 1:]
    return title


# ── Main ───────────────────────────────────────────────────────────────────────

TRACTATES = [
    ('עין איה על ברכות', 'berakhot'),
    ('עין איה על שבת',   'shabbat'),
]


def main():
    output: dict[str, dict[str, list]] = {
        'berakhot': defaultdict(list),
        'shabbat':  defaultdict(list),
    }
    total_placed = 0
    total_skipped = 0

    for prefix, tractate_key in TRACTATES:
        print(f"\n=== {prefix} ===")
        pages = fetch_pages_with_content(prefix)
        # Filter out the root index page (exact title match)
        pages = [(t, w) for t, w in pages if t != prefix]
        print(f"  {len(pages)} section pages retrieved")

        expected_he = 'ברכות' if tractate_key == 'berakhot' else 'שבת'

        for title, wikitext in pages:
            if not wikitext:
                total_skipped += 1
                continue

            ref = extract_daf_ref(wikitext)
            if ref is None:
                total_skipped += 1
                continue

            daf, tractate_he = ref

            if tractate_he == expected_he:
                target = tractate_key
            else:
                target = _TRACTATE_MAP.get(tractate_he)
                if not target:
                    total_skipped += 1
                    continue

            text = clean_wikitext(wikitext)
            if text:
                citation = section_citation(title, prefix)
                output[target][daf].append({"citation": citation, "text": text})
                total_placed += 1
            else:
                total_skipped += 1

        print(f"  placed: {total_placed}  skipped so far: {total_skipped}")

    # Sort dafim numerically
    def daf_sort_key(d: str):
        return (int(d[:-1]), 0 if d[-1] == 'a' else 1)

    final = {}
    for key in ('berakhot', 'shabbat'):
        final[key] = {
            d: output[key][d]
            for d in sorted(output[key].keys(), key=daf_sort_key)
        }

    out_path = "../ein_ayah.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Wrote {out_path}")
    print(f"  Total placed: {total_placed}  skipped: {total_skipped}")
    print(f"  Berakhot dafim: {len(final['berakhot'])}")
    print(f"  Shabbat dafim:  {len(final['shabbat'])}")


if __name__ == "__main__":
    main()
