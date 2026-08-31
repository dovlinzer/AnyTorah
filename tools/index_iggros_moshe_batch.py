#!/usr/bin/env python3
"""
Batch-indexes Iggros Moshe volumes' siman->page mapping using the Anthropic Messages Batch API.

Why batches, not a live loop: a batch runs entirely server-side once submitted, so it survives
this machine sleeping/closing/disconnecting, and Batch API pricing is a flat 50% discount off
regular per-token pricing. This replaces the earlier approach of running live Claude Code
subagents one page-group at a time (which worked, but was repeatedly interrupted by the Claude
Code subscription's own usage limit, unrelated to this API key).

Design, matching the manual methodology already validated by hand (see AnyTorah/CLAUDE.md's
"Siman->page indexing methodology" section) but automated:
  - One API request per page, fully independent (no conversation history between pages) --
    keeps cost linear and lets every page be judged purely on its own image.
  - Each request forces a tool call returning: which "siman N" headings start on this page (in
    top-to-bottom order, as Arabic numerals), and whether the page is back matter (blank/index/
    front matter, not a numbered responsum).
  - AFTER all results are back, a local assembly pass walks pages in order and enforces the same
    "siman numbers are strictly sequential, no gaps, no repeats" rule the manual indexing used --
    trusting the running sequence over an individual page's misread numeral, and logging every
    mismatch to "_notes" for a human spot-check, exactly like the manual runs did.

Usage:
    export ANTHROPIC_API_KEY=...          # never pass the key as a CLI arg or paste it in chat

    # See what would be submitted and the cost estimate, without spending anything:
    python3 index_iggros_moshe_batch.py plan --all-remaining

    # Submit batches (one per volume). Prompts for confirmation before spending money,
    # unless --yes is passed.
    python3 index_iggros_moshe_batch.py submit --all-remaining
    python3 index_iggros_moshe_batch.py submit --volumes OH2,OH1,EH1

    # Check on submitted batches (safe to run any time, any number of times):
    python3 index_iggros_moshe_batch.py status

    # Collect + assemble results for any batches that have finished:
    python3 index_iggros_moshe_batch.py collect
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import anthropic

REPO_ROOT = Path(__file__).resolve().parent.parent
PAGES_JSON = REPO_ROOT / "AnyTorah" / "teshuvot_pages.json"
INDEX_OUT_DIR = REPO_ROOT / "index_out"
CACHE_DIR = Path(__file__).resolve().parent / "iggros_moshe_page_cache"
STATE_FILE = Path(__file__).resolve().parent / "iggros_moshe_batch_state.json"

MODEL = "claude-sonnet-5"

# Volumes already fully hand-indexed this session -- excluded from --all-remaining by default.
ALREADY_COMPLETE = {"IggrotMosheEH2", "IggrotMosheEH3", "IggrotMosheOH2", "IggrotMosheOH3"}

TOOL_NAME = "record_page"
TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": "Record what this one page of Iggros Moshe (Rabbi Moshe Feinstein's responsa) contains.",
    "input_schema": {
        "type": "object",
        "properties": {
            "siman_headings": {
                "type": "array",
                "items": {"type": "integer"},
                "description": (
                    "The Arabic-numeral value of every 'סימן X' (siman) heading whose heading "
                    "text begins on THIS page, in top-to-bottom reading order. A heading 'begins' "
                    "on this page even if the responsum's text continues onto later pages. Most "
                    "pages have zero (mid-teshuva continuation) or one; some pages (especially "
                    "near a volume's start) have two or more short teshuvot. Read the Hebrew "
                    "letter-numeral carefully (gematria: א=1, ב=2, ..., י=10, יא=11, ..., כ=20, "
                    "ר vs ד and ה vs ח are common misread pairs -- look closely)."
                ),
            },
            "is_back_matter": {
                "type": "boolean",
                "description": (
                    "True if this page is clearly NOT a numbered responsum -- a blank page, a "
                    "title page, an approbation/haskamah letter, or an index/table of contents "
                    "(often near the very end of a volume). False for any page that is part of "
                    "the actual responsa text, even if no new siman heading starts on it."
                ),
            },
            "notes": {
                "type": "string",
                "description": (
                    "Only if something about a heading numeral on this page is genuinely hard to "
                    "read even on close inspection -- briefly say what's ambiguous. Leave empty "
                    "otherwise."
                ),
            },
        },
        "required": ["siman_headings", "is_back_matter"],
    },
}

SYSTEM_PROMPT = """You are analyzing a single scanned page from one volume of Iggros Moshe (אגרות משה), Rabbi Moshe Feinstein's published Hebrew responsa. Your only job is to report, via the record_page tool, which siman (responsum) headings begin on this exact page image, and whether the page is back matter.

A siman heading looks like "סימן א" / "סימן יד" etc. -- a Hebrew letter-numeral -- usually set off by a horizontal rule above it and/or a title/subject line beneath it, often in a larger or bolder font than the body text. A teshuva (responsum) typically ends with a horizontal rule and/or the signature "משה פיינשטיין" near the bottom of a page.

Some pages have two columns (read the physically-right column first, then the physically-left column, since Hebrew reads right-to-left). Some pages contain more than one short teshuva. Internal sub-markers like "ענף א/ב/ג" (branch/section markers within one long teshuva) are NOT new simanim -- do not report them.

Always call record_page exactly once per page."""


def load_pages_map(volume: str) -> dict[str, str]:
    all_pages = json.loads(PAGES_JSON.read_text())
    if volume not in all_pages:
        raise SystemExit(f"Unknown volume {volume!r} -- not in {PAGES_JSON}")
    return all_pages[volume]


def existing_index(volume: str) -> dict:
    path = INDEX_OUT_DIR / f"{volume}_index.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    # Guard against the one-off nesting bug a prior run produced for OH3 (already fixed there,
    # but keep this defensive in case a similar file shows up again).
    if volume in data and isinstance(data[volume], dict):
        data = data[volume]
    return data


def resume_point(volume: str) -> tuple[int, int]:
    """Returns (first_page_to_process, expected_next_siman) given whatever's already indexed."""
    idx = existing_index(volume)
    siman_keys = [int(k) for k in idx.keys() if k != "_notes"]
    if not siman_keys:
        return 1, 1
    max_siman = max(siman_keys)
    max_page = max(idx[str(k)] for k in siman_keys)
    # Start strictly after the last already-indexed page. Re-processing that page would be
    # wrong: the model would (correctly) report the same heading that's already indexed there,
    # which the assembly pass would then misread as a sequence mismatch against the now-
    # incremented expected_next, corrupting everything after it by one.
    return max_page + 1, max_siman + 1


def cache_path(volume: str, page: int) -> Path:
    return CACHE_DIR / volume / f"{page}.jpg"


def ensure_downloaded(volume: str, page: int, file_id: str) -> Path:
    path = cache_path(volume, page)
    if path.exists() and path.stat().st_size > 1000:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://drive.google.com/thumbnail?id={file_id}&sz=w1600"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = resp.read()
            if len(data) < 1000:
                raise ValueError(f"suspiciously small download ({len(data)} bytes)")
            path.write_bytes(data)
            return path
        except (urllib.error.URLError, ValueError) as e:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def build_request(volume: str, page: int, image_path: Path) -> dict:
    image_b64 = base64.standard_b64encode(image_path.read_bytes()).decode("ascii")
    return {
        "custom_id": f"{volume}__{page}",
        "params": {
            "model": MODEL,
            "max_tokens": 400,
            "system": SYSTEM_PROMPT,
            "tools": [TOOL_SCHEMA],
            "tool_choice": {"type": "tool", "name": TOOL_NAME},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Volume {volume}, page {page}. Call record_page for this page.",
                        },
                    ],
                }
            ],
        },
    }


# Rough ballpark only -- see the actual per-request usage in batch results for real numbers.
# ~1,500-1,600 input tokens/page-image (Claude downscales anything above ~1.15MP before
# tokenizing) + ~100 output tokens, at Batch API's flat 50% discount off standard Sonnet pricing.
EST_COST_PER_PAGE_LOW = 0.003
EST_COST_PER_PAGE_HIGH = 0.005


def resolve_volumes(args) -> list[str]:
    all_pages = json.loads(PAGES_JSON.read_text())
    if args.volumes:
        vols = [v.strip() for v in args.volumes.split(",")]
        for v in vols:
            if v not in all_pages:
                # allow bare "OH2" as shorthand for "IggrotMosheOH2"
                full = f"IggrotMoshe{v}"
                if full in all_pages:
                    vols[vols.index(v)] = full
                else:
                    raise SystemExit(f"Unknown volume {v!r}")
        return [v if v.startswith("IggrotMoshe") else f"IggrotMoshe{v}" for v in vols]
    if args.all_remaining:
        return sorted(v for v in all_pages if v not in ALREADY_COMPLETE)
    raise SystemExit("Pass --volumes OH2,OH1,... or --all-remaining")


def plan_for_volumes(volumes: list[str]) -> list[tuple[str, int, int]]:
    """Returns (volume, first_page, total_pages_in_volume) for pages actually left to process."""
    # resume_point() infers "already processed through" from the highest page recorded against
    # any siman entry -- but trailing back-matter pages (blank/colophon/index, no siman heading)
    # never get recorded against any entry, so a volume ending in back matter always looks like
    # it has a few "unprocessed" pages left even after a fully successful collect. Trust a batch
    # already collected end-to-end (state's last_page == the volume's real page count) over that
    # heuristic, so `submit --all-remaining` doesn't keep re-spending on pages already confirmed
    # to be back matter.
    state = load_state()
    plan = []
    for v in volumes:
        info = state.get(v)
        if info and info.get("collected") and info.get("last_page") == len(load_pages_map(v)):
            continue
        pages_map = load_pages_map(v)
        total = len(pages_map)
        first_page, _ = resume_point(v)
        remaining = total - first_page + 1
        if remaining > 0:
            plan.append((v, first_page, total))
    return plan


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=1))


def cmd_plan(args):
    volumes = resolve_volumes(args)
    plan = plan_for_volumes(volumes)
    total_pages = 0
    print(f"{'Volume':<20} {'From page':>10} {'Through':>10} {'Pages':>8}")
    for v, first, total in plan:
        n = total - first + 1
        total_pages += n
        print(f"{v:<20} {first:>10} {total:>10} {n:>8}")
    print(f"\nTotal pages to submit: {total_pages}")
    print(
        f"Estimated cost: ${total_pages * EST_COST_PER_PAGE_LOW:.2f} - "
        f"${total_pages * EST_COST_PER_PAGE_HIGH:.2f} (Batch API, 50% off standard pricing)"
    )


def batch_ids_for(info: dict) -> list[str]:
    """Normalizes old single-batch state entries ({"batch_id": ...}) and new multi-batch
    entries ({"batch_ids": [...]}) to a plain list, so status/collect don't care which shape
    a given volume was submitted with."""
    if "batch_ids" in info:
        return info["batch_ids"]
    return [info["batch_id"]]


# The Batch API caps a single request payload at 256MB. Each page request embeds one base64
# JPEG (~350-500KB typically at the w1600 thumbnail size this tool downloads), so 415 pages
# (IggrotMosheEH1) fit but 554 pages (IggrotMosheYD1) blew past the cap with a 413
# RequestTooLargeError. Chunk conservatively well under the observed 415-pages-ok/554-pages-
# too-big boundary, since page image sizes vary volume to volume.
MAX_PAGES_PER_BATCH = 350


def cmd_submit(args):
    volumes = resolve_volumes(args)
    plan = plan_for_volumes(volumes)
    if not plan:
        print("Nothing to submit -- every requested volume is already fully indexed.")
        return

    total_pages = sum(total - first + 1 for _, first, total in plan)
    print(f"About to submit batches covering {total_pages} pages across {len(plan)} volume(s):")
    for v, first, total in plan:
        print(f"  {v}: pages {first}-{total} ({total - first + 1} pages)")
    print(
        f"Estimated cost: ${total_pages * EST_COST_PER_PAGE_LOW:.2f} - "
        f"${total_pages * EST_COST_PER_PAGE_HIGH:.2f}"
    )

    if not args.yes:
        resp = input("This will spend real money on your API key. Submit? [y/N] ")
        if resp.strip().lower() != "y":
            print("Aborted, nothing submitted.")
            return

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment
    state = load_state()

    for v, first, total in plan:
        pages_map = load_pages_map(v)
        print(f"\n{v}: downloading pages {first}-{total} (skips any already cached)...")
        requests = []
        for page in range(first, total + 1):
            file_id = pages_map.get(str(page))
            if not file_id:
                print(f"  WARNING: no Drive file id for page {page}, skipping")
                continue
            path = ensure_downloaded(v, page, file_id)
            requests.append(build_request(v, page, path))
        if not requests:
            print(f"  Nothing to submit for {v}")
            continue

        # Split into multiple batch submissions if this volume's page count risks the Batch
        # API's 256MB per-request cap -- see MAX_PAGES_PER_BATCH's comment.
        chunks = [requests[i:i + MAX_PAGES_PER_BATCH] for i in range(0, len(requests), MAX_PAGES_PER_BATCH)]
        batch_ids = []
        for i, chunk in enumerate(chunks):
            label = f" (chunk {i + 1}/{len(chunks)})" if len(chunks) > 1 else ""
            print(f"  Submitting batch of {len(chunk)} requests for {v}{label}...")
            batch = client.messages.batches.create(requests=chunk)
            batch_ids.append(batch.id)
            state[v] = {
                "batch_ids": batch_ids,
                "submitted_at": batch.created_at.isoformat(),
                "first_page": first,
                "last_page": total,
            }
            save_state(state)  # save immediately, after every chunk -- survives an interruption
            print(f"  Submitted: batch_id={batch.id}")

    print(f"\nAll batch IDs saved to {STATE_FILE}. Run `status` or `collect` any time later.")


def cmd_status(args):
    state = load_state()
    if not state:
        print("No batches submitted yet.")
        return
    client = anthropic.Anthropic()
    for v, info in state.items():
        if info.get("collected"):
            print(f"{v}: already collected")
            continue
        ids = batch_ids_for(info)
        batches = [client.messages.batches.retrieve(bid) for bid in ids]
        statuses = {b.processing_status for b in batches}
        status = statuses.pop() if len(statuses) == 1 else "mixed(" + ",".join(sorted(statuses)) + ")"
        succeeded = sum(b.request_counts.succeeded for b in batches)
        errored = sum(b.request_counts.errored for b in batches)
        processing = sum(b.request_counts.processing for b in batches)
        canceled = sum(b.request_counts.canceled for b in batches)
        expired = sum(b.request_counts.expired for b in batches)
        chunk_note = f" [{len(ids)} chunks]" if len(ids) > 1 else ""
        print(
            f"{v}: {status}{chunk_note} "
            f"(succeeded={succeeded} errored={errored} "
            f"processing={processing} canceled={canceled} expired={expired})"
        )


def assemble_volume(volume: str, results_by_page: dict[int, dict]) -> tuple[dict, list[str]]:
    """Walks pages in order, enforces strict sequential siman numbering, returns
    (siman_str -> page_int dict to merge in, list of note strings)."""
    idx = existing_index(volume)
    existing_siman_keys = [int(k) for k in idx.keys() if k != "_notes"]
    expected_next = (max(existing_siman_keys) + 1) if existing_siman_keys else 1
    # Guards against a race: if some other process (e.g. a live indexing agent) advanced this
    # volume's on-disk index between when this batch was *submitted* (resume_point picked a
    # first_page based on the index as it stood then) and when it's being *collected* now, the
    # freshly-collected pages can overlap pages the index already covers. Blindly trust-the-
    # sequence-numbering those would misfile already-known simanim as new ones (this happened
    # for real to IggrotMosheOH2 on 2026-08-31 -- pages 125-132 got relabeled 114-119 even
    # though they were siman 108-113, already indexed at the time collect() ran). Any result
    # page at or before the highest page already recorded for an existing siman is dropped
    # here instead of renumbered.
    already_covered_through = max(idx[str(k)] for k in existing_siman_keys) if existing_siman_keys else 0
    notes = list(idx.get("_notes", []))
    new_entries: dict[str, int] = {}
    back_matter_pages = []
    skipped_overlap_pages = []

    for page in sorted(results_by_page):
        if page <= already_covered_through:
            r = results_by_page[page]
            if r.get("siman_headings"):
                skipped_overlap_pages.append(page)
            continue
        r = results_by_page[page]
        if r.get("is_back_matter"):
            back_matter_pages.append(page)
        headings = r.get("siman_headings") or []
        note_text = (r.get("notes") or "").strip()
        for read_value in headings:
            if read_value == expected_next:
                new_entries[str(expected_next)] = page
            else:
                notes.append(
                    f"Page {page}: model read siman heading as {read_value}, but sequential "
                    f"position expected {expected_next} -- used {expected_next} (trust-the-"
                    f"sequence policy). Verify visually if this looks wrong."
                )
                new_entries[str(expected_next)] = page
            expected_next += 1
        if note_text:
            notes.append(f"Page {page}: {note_text}")

    if back_matter_pages:
        # Only worth recording as a note if it's a real trailing block, not a stray single page.
        run_start = back_matter_pages[0]
        notes.append(
            f"Back-matter pages flagged (verify the boundary): {back_matter_pages[:5]}"
            + (" ..." if len(back_matter_pages) > 5 else "")
        )

    if skipped_overlap_pages:
        notes.append(
            f"Skipped {len(skipped_overlap_pages)} page(s) already covered by the existing "
            f"index (re-collected pages <= {already_covered_through}, likely a resubmission "
            f"race): {skipped_overlap_pages[:10]}" + (" ..." if len(skipped_overlap_pages) > 10 else "")
        )

    return new_entries, notes


def cmd_collect(args):
    state = load_state()
    if not state:
        print("No batches submitted yet.")
        return
    client = anthropic.Anthropic()

    for v, info in list(state.items()):
        if info.get("collected"):
            continue
        ids = batch_ids_for(info)
        batches = {bid: client.messages.batches.retrieve(bid) for bid in ids}
        not_ended = [bid for bid, b in batches.items() if b.processing_status != "ended"]
        if not_ended:
            statuses = {batches[bid].processing_status for bid in not_ended}
            print(f"{v}: still {'/'.join(sorted(statuses))} ({len(not_ended)}/{len(ids)} chunk(s)), skipping")
            continue

        chunk_note = f" ({len(ids)} chunks)" if len(ids) > 1 else ""
        print(f"{v}: batch(es) ended{chunk_note}, collecting results...")
        results_by_page: dict[int, dict] = {}
        errors = []
        for bid in ids:
            for entry in client.messages.batches.results(bid):
                _, page_str = entry.custom_id.split("__")
                page = int(page_str)
                if entry.result.type != "succeeded":
                    errors.append((page, entry.result.type))
                    continue
                message = entry.result.message
                tool_use = next((b for b in message.content if b.type == "tool_use"), None)
                if tool_use is None:
                    errors.append((page, "no tool_use block"))
                    continue
                results_by_page[page] = tool_use.input

        if errors:
            print(f"  {len(errors)} page(s) failed/errored: {errors[:10]}{' ...' if len(errors) > 10 else ''}")

        new_entries, notes = assemble_volume(v, results_by_page)

        idx = existing_index(v)
        idx = {k: val for k, val in idx.items() if k != "_notes"}
        idx.update(new_entries)
        if errors:
            notes.append(f"{len(errors)} page(s) failed to process: {[p for p, _ in errors]}")
        if notes:
            idx["_notes"] = notes

        INDEX_OUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = INDEX_OUT_DIR / f"{v}_index.json"
        out_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1, sort_keys=False))
        print(f"  Wrote {out_path} -- {len(new_entries)} new siman(s), {len(notes)} note(s)")

        info["collected"] = True
        save_state(state)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    for name in ("plan", "submit"):
        p = sub.add_parser(name)
        p.add_argument("--volumes", help="Comma-separated, e.g. OH2,OH1,EH1")
        p.add_argument("--all-remaining", action="store_true")
        if name == "submit":
            p.add_argument("--yes", action="store_true", help="Skip the spend-confirmation prompt")

    sub.add_parser("status")
    sub.add_parser("collect")

    args = parser.parse_args()
    if args.command == "plan":
        cmd_plan(args)
    elif args.command == "submit":
        cmd_submit(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "collect":
        cmd_collect(args)


if __name__ == "__main__":
    import os

    if "--help" not in sys.argv and len(sys.argv) > 1 and sys.argv[1] != "plan" and not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set in this shell's environment. Set it and retry:")
        print("    export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)
    main()
