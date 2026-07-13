"""
Merges players_staging.csv (our 520 PSL players, keyed by Cricsheet hash)
against Cricsheet's official people.csv registry, which maps that same hash
to a direct ESPNcricinfo numeric ID (key_cricinfo column).

This replaces the entire "search for the player" step in the scraper --
every player already has a confirmed direct ID (520/520 matched, verified).

Usage:
    python3 merge_player_ids.py players_staging.csv people.csv player_ids.csv
"""

import csv
import sys


def main():
    if len(sys.argv) != 4:
        print("Usage: python3 merge_player_ids.py <players_staging.csv> <people.csv> <output.csv>")
        sys.exit(1)

    players_path, people_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    registry = {}
    with open(people_path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            registry[r["identifier"]] = r.get("key_cricinfo", "")

    rows = []
    missing = []
    with open(players_path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            h = r["external_ref_cricsheet"]
            espn_id = registry.get(h, "")
            if not espn_id:
                missing.append(r["full_name"])
            rows.append({
                "external_ref_cricsheet": h,
                "full_name": r["full_name"],
                "espn_id": espn_id,
            })

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["external_ref_cricsheet", "full_name", "espn_id"])
        w.writeheader()
        for row in rows:
            w.writerow(row)

    print(f"{len(rows)} players processed.")
    print(f"{len(rows) - len(missing)} matched with a direct ESPNcricinfo ID.")
    if missing:
        print(f"{len(missing)} missing (no ID found):")
        for name in missing:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
