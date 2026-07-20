"""
Loads manually-filled captain data (from captains_template.csv, once you've
filled in the captain_full_name column) into team_season.captain_id.

Matches players by full name -- if a captain's name doesn't exactly match
an existing player in the database (e.g. spelling difference), that row
gets skipped and printed so you can fix the name and re-run.

Usage:
    python3 load_captains.py "postgresql://...supabase connection..." captains_filled.csv
"""

import csv
import sys
import psycopg2


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 load_captains.py <connection_string> <captains_filled.csv>")
        sys.exit(1)

    conn = psycopg2.connect(sys.argv[1])
    cur = conn.cursor()
    cur.execute("SET search_path TO raw_cricsheet, public;")

    with open(sys.argv[2], newline="") as f:
        rows = [r for r in csv.DictReader(f) if r["captain_full_name"].strip()]

    print(f"{len(rows)} filled-in rows found.")
    updated = 0
    not_found = []

    for r in rows:
        cur.execute(
            """UPDATE team_season ts
               SET captain_id = p.player_id
               FROM teams t, seasons s, players p
               WHERE ts.team_id = t.team_id AND ts.season_id = s.season_id
                 AND t.team_name = %s AND s.season_year = %s
                 AND p.full_name = %s""",
            (r["team_name"], int(r["season_year"]), r["captain_full_name"].strip()),
        )
        if cur.rowcount == 0:
            not_found.append(r)
        else:
            updated += 1

    conn.commit()
    print(f"Updated {updated} team_season rows.")
    if not_found:
        print(f"\n{len(not_found)} rows didn't match (check spelling against players.full_name):")
        for r in not_found:
            print(f"  - {r['team_name']} {r['season_year']}: '{r['captain_full_name']}'")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
