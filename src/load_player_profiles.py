"""
Loads the scraped player profile data (batting/bowling style, DOB) into
raw_scraped.player_profiles. Fully decoupled from raw_cricsheet -- this
never touches your trusted Cricsheet data directly.

Usage:
    python3 load_player_profiles.py "postgresql://...supabase connection..." player_profiles_fixed.csv
"""

import csv
import sys
import psycopg2
from psycopg2.extras import execute_values


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 load_player_profiles.py <connection_string> <player_profiles.csv>")
        sys.exit(1)

    conn = psycopg2.connect(sys.argv[1])
    cur = conn.cursor()
    cur.execute("SET search_path TO raw_scraped, public;")

    with open(sys.argv[2], newline="") as f:
        rows = list(csv.DictReader(f))

    values = [
        (
            r["source_player_name"], r["source_site"], r["source_player_id"],
            r["date_of_birth"] or None, r["nationality"] or None,
            r.get("role") or None, r["batting_style"] or None,
            r["bowling_style"] or None, r["source_url"] or None,
        )
        for r in rows
    ]

    execute_values(
        cur,
        """INSERT INTO player_profiles
           (source_player_name, source_site, source_player_id, date_of_birth,
            nationality, role, batting_style, bowling_style, source_url)
           VALUES %s""",
        values,
    )
    conn.commit()
    print(f"Loaded {len(values)} rows into raw_scraped.player_profiles.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
