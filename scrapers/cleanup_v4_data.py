"""
Quick cleanup of the existing v4 player_profiles.csv -- no re-scraping.

Fixes:
1. Moves "wicketkeeper" out of bowling_style into a new fielding_position
   column. This is a pure data cleanup, no re-fetch needed.

Flags (doesn't auto-fix, since the original page text is gone -- these
need a quick manual correction):
2. Any row where batting_style ISN'T exactly "right-hand bat" or
   "left-hand bat" -- that's the signature of the hyphenated-name bug
   (e.g. Misbah-ul-Haq's row showed "ul-Haq - right-hand bat" instead of
   just "right-hand bat"). Almost certainly only a few rows, since it only
   happens for names that contain a hyphen.

Usage:
    python3 cleanup_v4_data.py data/raw_scraped/player_profiles.csv data/raw_scraped/player_profiles_cleaned.csv
"""

import csv
import sys


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 cleanup_v4_data.py <input.csv> <output.csv>")
        sys.exit(1)

    in_path, out_path = sys.argv[1], sys.argv[2]

    with open(in_path, newline="") as f:
        rows = list(csv.DictReader(f))

    fieldnames = list(rows[0].keys())
    if "fielding_position" not in fieldnames:
        fieldnames.append("fielding_position")

    flagged = []
    for r in rows:
        r.setdefault("fielding_position", "")
        if r.get("bowling_style", "").strip().lower() == "wicketkeeper":
            r["fielding_position"] = "wicketkeeper"
            r["bowling_style"] = ""

        bs = r.get("batting_style", "").strip().lower()
        if bs and bs not in ("right-hand bat", "left-hand bat"):
            flagged.append(r["source_player_name"])

    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"Cleaned {len(rows)} rows -> {out_path}")
    print(f"\n{len(flagged)} rows likely corrupted by the hyphenated-name bug "
          f"(batting_style isn't a clean 'right-hand bat'/'left-hand bat'):")
    for name in flagged:
        print(f"  - {name}")
    if flagged:
        print("\nOpen the output CSV and manually fix batting_style (and check")
        print("bowling_style too) for just these rows -- quick Google/ESPNcricinfo")
        print("lookup per name. Everyone else is already clean.")


if __name__ == "__main__":
    main()
