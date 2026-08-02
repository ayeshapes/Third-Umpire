"""
Reconciliation check: flags players scraped as "wicketkeeper" (no bowling
style) who ACTUALLY bowled at least one over in our own PSL data.

Why this can happen: ESPNcricinfo's "wicketkeeper" label reflects a
player's whole tracked career, not PSL specifically. A specialist keeper
who bowled a few part-time overs only in PSL could still show up as
"wicketkeeper" on ESPNcricinfo, silently hiding real PSL bowling activity.

Important limitation: this can only FLAG the discrepancy, not fix it.
Cricsheet's ball-by-ball data tells us THAT someone bowled, but not their
bowling style (pace/spin/arm) -- that's not recorded in deliveries at all.
So flagged players still need a manual look-up or a corrected scrape;
this script just tells you who needs one, instead of you finding out by
accident later.

Usage:
    python3 check_keeper_bowlers.py "postgresql://...supabase connection..." data/raw_scraped/player_profiles.csv
"""

import sys
import csv
import psycopg2


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 check_keeper_bowlers.py <connection_string> <player_profiles.csv>")
        sys.exit(1)

    conn = psycopg2.connect(sys.argv[1])
    cur = conn.cursor()
    cur.execute("SET search_path TO raw_cricsheet, public;")

    # total legal balls bowled per player, across all loaded matches
    cur.execute("""
        SELECT p.external_ref_cricsheet, p.full_name,
               COALESCE(SUM(bs.overs_bowled), 0) AS total_overs,
               COALESCE(SUM(bs.wickets), 0) AS total_wickets
        FROM players p
        LEFT JOIN match_bowling_scorecard bs ON bs.player_id = p.player_id
        GROUP BY p.player_id, p.external_ref_cricsheet, p.full_name
        HAVING COALESCE(SUM(bs.overs_bowled), 0) > 0
    """)
    bowled_in_psl = {row[0]: (row[1], row[2], row[3]) for row in cur.fetchall()}
    print(f"{len(bowled_in_psl)} players have bowled at least some overs in our PSL data.")

    flagged = []
    with open(sys.argv[2], newline="") as f:
        for r in csv.DictReader(f):
            ref = r.get("source_player_id", "")  # note: matched by name below instead,
            name = r["source_player_name"]
            if r.get("fielding_position", "").lower() == "wicketkeeper":
                # find this name in our bowled-in-PSL set
                match = next((v for k, v in bowled_in_psl.items() if v[0] == name), None)
                if match:
                    flagged.append((name, match[1], match[2]))

    print(f"\n{len(flagged)} players labeled 'wicketkeeper' by ESPNcricinfo "
          f"but who DID bowl in our own PSL data:")
    for name, overs, wkts in flagged:
        print(f"  - {name}: {overs} overs, {wkts} wickets in PSL")

    if flagged:
        print("\nThese need a manual bowling-style lookup (Cricsheet's ball-by-ball")
        print("data confirms THEY bowled, but doesn't record HOW -- pace/spin/arm")
        print("isn't in Cricsheet at all, so this can't be derived automatically.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
