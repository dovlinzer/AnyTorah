#!/usr/bin/env python3
"""
build_teshuvot_pages.py
------------------------
Enumerates Contemporary Teshuvot page images from public Google Drive folders
and writes teshuvot_pages.json, which maps { volume_key -> { page_number ->
drive_file_id } }.

This is the AnyTorah analog of AnyDaf's `web/build-pages.py` (same mechanism:
list a public Drive folder via the Drive API, parse "{Prefix}_Page_{N}.jpg"
filenames, write a JSON lookup) -- kept as a separate script per project
rather than modified in place, since the two apps' asset sets are unrelated.

The apps use the file IDs to construct Google Drive thumbnail URLs:
    https://drive.google.com/thumbnail?id=FILE_ID&sz=w1600

Unlike AnyDaf's daf/amud page-number math, a Teshuvot volume's page number
maps directly to that volume's own siman index (see TeshuvotWork's
per-volume siman->page index) -- no odd/even side conversion needed.

Requirements:
    - Google Drive API v3 enabled in Google Cloud Console
    - An API key (no OAuth needed -- works for any publicly shared folder)
    - Do NOT hardcode the key in this file. Pass it via --api-key or the
      GOOGLE_API_KEY environment variable.

Usage:
    cd /Users/dovlinzer/claudecode/AnyTorah/tools
    python3 build_teshuvot_pages.py --api-key YOUR_API_KEY

    # Or set the key via environment variable instead of the CLI flag:
    export GOOGLE_API_KEY=YOUR_API_KEY
    python3 build_teshuvot_pages.py

    # Add or update a single volume's folder:
    python3 build_teshuvot_pages.py --api-key YOUR_API_KEY \\
        --volume IggrosMosheEH2 --folder-id FOLDER_ID
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration -- add folder IDs here as each volume's page images are
# uploaded to Drive. One folder per volume, matching the daf-image pattern.
#
# The dict key is also the filename prefix expected in that folder, e.g. a
# folder for Iggros Moshe Even HaEzer vol. 2 should contain files named
# "IggrosMosheEH2_Page_001.jpg", "IggrosMosheEH2_Page_002.jpg", etc.
# ---------------------------------------------------------------------------

VOLUME_FOLDERS = {
    # "IggrosMosheOH1": "FOLDER_ID_HERE",
    # "IggrosMosheYD1": "FOLDER_ID_HERE",
    # "IggrosMosheEH1a": "FOLDER_ID_HERE",   # split further due to Drive's
    # "IggrosMosheEH1b": "FOLDER_ID_HERE",   # download-interstitial size limit
    # "IggrosMosheHM1": "FOLDER_ID_HERE",
    # "IggrosMosheOH2": "FOLDER_ID_HERE",
    # "IggrosMosheEH2": "FOLDER_ID_HERE",
    # ... etc, one entry per split PDF volume
}

OUTPUT = Path(__file__).parent.parent / "AnyTorah" / "teshuvot_pages.json"

# ---------------------------------------------------------------------------
# Google Drive helpers (identical mechanism to AnyDaf's build-pages.py)
# ---------------------------------------------------------------------------


def fetch(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "AnyTorah-TeshuvotBuilder/1.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"\nHTTP {e.code} {e.reason}")
            try:
                err = json.loads(body)
                msg = err.get("error", {}).get("message", body)
                print(f"Google API error: {msg}")
            except Exception:
                print(f"Response: {body[:500]}")
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def list_drive_folder(folder_id, api_key):
    """Returns list of (filename, file_id) for all non-trashed files in the folder."""
    files = []
    page_token = None

    while True:
        params = {
            "q": f"'{folder_id}' in parents and trashed=false",
            "fields": "nextPageToken,files(id,name)",
            "pageSize": 1000,
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        url = "https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode(params)
        data = json.loads(fetch(url))
        files.extend((f["name"], f["id"]) for f in data.get("files", []))

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return files


def parse_page_number(filename, volume_key):
    """
    Extract the page number XX from 'VolumeKey_Page_XX.jpg' -> int, or None.
    Handles .jpg, .jpeg, .png extensions case-insensitively.
    """
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    prefix = f"{volume_key}_Page_"
    if stem.startswith(prefix) or stem.lower().startswith(prefix.lower()):
        try:
            return int(stem[len(prefix):])
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    args = sys.argv[1:]

    api_key = os.environ.get("GOOGLE_API_KEY", "")
    if "--api-key" in args:
        idx = args.index("--api-key")
        api_key = args[idx + 1]

    if not api_key:
        print("Error: provide API key via --api-key KEY or GOOGLE_API_KEY env var")
        print()
        print("To get an API key:")
        print("  1. Go to https://console.cloud.google.com/")
        print("  2. Create a project (or select existing -- the AnyDaf one works too)")
        print("  3. Enable 'Google Drive API'")
        print("  4. Go to Credentials -> Create Credentials -> API key")
        print("  5. (Optional) Restrict the key to Google Drive API")
        sys.exit(1)

    override_volume = None
    override_folder = None
    if "--volume" in args and "--folder-id" in args:
        override_volume = args[args.index("--volume") + 1]
        override_folder = args[args.index("--folder-id") + 1]

    folders_to_process = (
        {override_volume: override_folder}
        if override_volume
        else VOLUME_FOLDERS
    )

    if not folders_to_process:
        print("No volume folders configured yet -- add entries to VOLUME_FOLDERS")
        print("in this script, or pass --volume NAME --folder-id ID for a single one.")
        sys.exit(1)

    existing = {}
    if OUTPUT.exists():
        with open(OUTPUT, encoding="utf-8") as f:
            existing = json.load(f)

    for volume_key, folder_id in folders_to_process.items():
        print(f"\n{volume_key}  (folder: {folder_id})")
        files = list_drive_folder(folder_id, api_key)
        print(f"  {len(files)} files found in folder")

        page_map = {}
        skipped = []
        for name, file_id in files:
            page_num = parse_page_number(name, volume_key)
            if page_num is not None:
                page_map[str(page_num)] = file_id
            else:
                skipped.append(name)

        if skipped:
            print(f"  Skipped {len(skipped)} unrecognised files: {skipped[:5]}")

        existing[volume_key] = page_map
        print(f"  Indexed {len(page_map)} pages for {volume_key}")

        page_numbers = sorted(int(k) for k in page_map)
        if page_numbers:
            lo, hi = page_numbers[0], page_numbers[-1]
            gaps = [n for n in range(lo, hi + 1) if n not in set(page_numbers)]
            print(f"  Coverage: pages {lo}-{hi} ({len(page_numbers)} of {hi - lo + 1})")
            if gaps:
                print(f"  WARNING: missing pages in range: {gaps[:10]}{'...' if len(gaps) > 10 else ''}")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nSaved -> {OUTPUT}")


if __name__ == "__main__":
    main()
