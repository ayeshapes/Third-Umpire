"""
PSL Data Loader
Loads the staging CSVs produced by etl.py into the raw_cricsheet schema.

Usage:
    python3 loader.py "postgresql://user:password@host:port/dbname" /path/to/psl_staging_csv

Notes:
- Idempotent-ish: safe to re-run. Lookups (teams/venues/players/seasons) check
  for existing rows before inserting. Fact tables (matches/innings/deliveries/etc)
  are NOT de-duplicated on re-run — if you need to reload, truncate those tables
  first (see reset_facts() at the bottom, commented out by default).
- Player/venue/team identity is resolved by NAME. Cricsheet's own registry hash
  keeps names consistent across matches, so this is safe for this dataset, but
  it's a known simplification worth knowing about.
"""

import csv
import os
import sys
import re
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values


def load_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def to_bool(v):
    return str(v).strip().lower() in ("true", "1", "yes")


def to_int(v):
    v = (v or "").strip()
    return int(v) if v else None


def to_float(v):
    v = (v or "").strip()
    return float(v) if v else None


def make_team_code(name, used_codes):
    words = re.findall(r"[A-Za-z]+", name)
    base = "".join(w[0] for w in words).upper()[:4] or "TM"
    code = base
    i = 1
    while code in used_codes:
        i += 1
        code = f"{base}{i}"
    used_codes.add(code)
    return code


class Loader:
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.cursor()
        self.cur.execute("SET search_path TO raw_cricsheet, public;")
        self.team_id = {}      # name -> db id
        self.venue_id = {}     # (name, city) -> db id
        self.player_id = {}    # external_ref_cricsheet (hash) -> db id
        self.season_id = {}    # year -> db id
        self.used_team_codes = set()

    # ---------- lookups / dimension loads ----------

    def load_existing(self):
        self.cur.execute("SELECT team_id, team_name FROM teams")
        for tid, name in self.cur.fetchall():
            self.team_id[name] = tid

        self.cur.execute("SELECT venue_id, venue_name, city FROM venues")
        for vid, name, city in self.cur.fetchall():
            self.venue_id[(name, city or "")] = vid

        self.cur.execute("SELECT player_id, external_ref_cricsheet FROM players")
        for pid, ref in self.cur.fetchall():
            self.player_id[ref] = pid

        self.cur.execute("SELECT season_id, season_year FROM seasons")
        for sid, year in self.cur.fetchall():
            self.season_id[year] = sid

    def upsert_teams(self, team_rows):
        for row in team_rows:
            name = row["team_name"]
            if name not in self.team_id:
                code = make_team_code(name, self.used_team_codes)
                self.cur.execute(
                    "INSERT INTO teams (team_name, team_code) VALUES (%s, %s) RETURNING team_id",
                    (name, code),
                )
                self.team_id[name] = self.cur.fetchone()[0]
        self.conn.commit()

    def upsert_venues(self, venue_rows):
        for row in venue_rows:
            key = (row["venue_name"], row["city"])
            if key not in self.venue_id:
                self.cur.execute(
                    "INSERT INTO venues (venue_name, city) VALUES (%s, %s) RETURNING venue_id",
                    (row["venue_name"], row["city"]),
                )
                self.venue_id[key] = self.cur.fetchone()[0]
        self.conn.commit()

    def upsert_players(self, player_rows):
        for row in player_rows:
            ref = row["external_ref_cricsheet"]
            if ref not in self.player_id:
                self.cur.execute(
                    "INSERT INTO players (full_name, external_ref_cricsheet) VALUES (%s, %s) RETURNING player_id",
                    (row["full_name"], ref),
                )
                self.player_id[ref] = self.cur.fetchone()[0]
        self.conn.commit()

    def upsert_seasons(self, match_rows):
        years = sorted({int(r["season_year"]) for r in match_rows})
        for year in years:
            if year not in self.season_id:
                self.cur.execute(
                    "INSERT INTO seasons (season_year) VALUES (%s) RETURNING season_id",
                    (year,),
                )
                self.season_id[year] = self.cur.fetchone()[0]
        self.conn.commit()

    def upsert_team_season(self, match_rows):
        pairs = set()
        for r in match_rows:
            year = int(r["season_year"])
            pairs.add((r["team1"], year))
            pairs.add((r["team2"], year))
        for team_name, year in pairs:
            self.cur.execute(
                """INSERT INTO team_season (team_id, season_id)
                   VALUES (%s, %s) ON CONFLICT (team_id, season_id) DO NOTHING""",
                (self.team_id[team_name], self.season_id[year]),
            )
        self.conn.commit()

    # ---------- fact loads ----------

    def load_matches(self, match_rows):
        """Returns dict: source match_id (cricsheet filename) -> db match_id
        Also returns match_teams: db match_id -> (team1_id, team2_id), needed
        to derive bowling_team_id on the innings table."""
        match_db_id = {}
        match_teams = {}
        # assign a match_number per season, ordered by date, for a friendlier sequence
        by_season = defaultdict(list)
        for r in match_rows:
            by_season[int(r["season_year"])].append(r)
        match_number = {}
        for year, rows in by_season.items():
            rows_sorted = sorted(rows, key=lambda r: r["match_date"])
            for i, r in enumerate(rows_sorted, start=1):
                match_number[r["match_id"]] = i

        for r in match_rows:
            season_id = self.season_id[int(r["season_year"])]
            venue_id = self.venue_id.get((r["venue_name"], r["venue_city"]))
            team1_id = self.team_id[r["team1"]]
            team2_id = self.team_id[r["team2"]]
            toss_winner_id = self.team_id.get(r["toss_winner"])
            winner_id = self.team_id.get(r["winner"]) if r["winner"] else None
            pom_id = self.player_id.get(r["player_of_match"]) if r["player_of_match"] else None

            self.cur.execute(
                """INSERT INTO matches
                   (season_id, match_number, match_date, stage, venue_id,
                    team1_id, team2_id, toss_winner_team_id, toss_decision,
                    winner_team_id, win_margin_runs, win_margin_wickets,
                    is_tie, decided_by_super_over, is_dls_affected, status,
                    player_of_match_id, external_ref_cricsheet)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   RETURNING match_id""",
                (
                    season_id, match_number[r["match_id"]], r["match_date"], "group", venue_id,
                    team1_id, team2_id, toss_winner_id, r["toss_decision"],
                    winner_id, to_int(r["win_margin_runs"]), to_int(r["win_margin_wickets"]),
                    to_bool(r["is_tie"]), to_bool(r["decided_by_super_over"]),
                    to_bool(r["is_dls_affected"]), r["status"],
                    pom_id, r["match_id"],
                ),
            )
            match_db_id[r["match_id"]] = self.cur.fetchone()[0]
            match_teams[match_db_id[r["match_id"]]] = (team1_id, team2_id)
        self.conn.commit()
        return match_db_id, match_teams

    def load_squads(self, squad_rows, match_db_id):
        rows = []
        for r in squad_rows:
            mid = match_db_id.get(r["match_id"])
            tid = self.team_id.get(r["team"])
            pid = self.player_id.get(r["player_hash"])
            if mid and tid and pid:
                rows.append((mid, tid, pid, True, False))
        execute_values(
            self.cur,
            """INSERT INTO match_squads (match_id, team_id, player_id, is_starting_xi, is_impact_sub)
               VALUES %s ON CONFLICT DO NOTHING""",
            rows,
        )
        self.conn.commit()

    def load_innings(self, innings_rows, match_db_id, match_teams):
        """Returns dict: (source match_id, innings_number) -> db innings_id"""
        innings_db_id = {}
        for r in innings_rows:
            mid = match_db_id.get(r["match_id"])
            if not mid:
                continue
            batting_team_id = self.team_id.get(r["batting_team"])
            t1, t2 = match_teams[mid]
            bowling_team_id = t2 if batting_team_id == t1 else t1
            self.cur.execute(
                """INSERT INTO innings (match_id, innings_number, batting_team_id, bowling_team_id, total_runs, total_wickets)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING innings_id""",
                (mid, r["innings_number"], batting_team_id, bowling_team_id,
                 to_int(r["total_runs"]), to_int(r["total_wickets"])),
            )
            innings_db_id[(r["match_id"], r["innings_number"])] = self.cur.fetchone()[0]
        self.conn.commit()
        return innings_db_id

    def load_overs(self, over_rows, innings_db_id):
        """Returns dict: (source match_id, innings_number, over_number) -> db over_id"""
        over_db_id = {}
        for r in over_rows:
            iid = innings_db_id.get((r["match_id"], r["innings_number"]))
            if not iid:
                continue
            bowler_id = self.player_id.get(r["bowler"])
            self.cur.execute(
                """INSERT INTO overs (innings_id, over_number, bowler_id, runs_conceded, wickets, is_maiden)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING over_id""",
                (iid, r["over_number"], bowler_id, to_int(r["runs_conceded"]),
                 to_int(r["wickets"]), to_bool(r["is_maiden"])),
            )
            over_db_id[(r["match_id"], r["innings_number"], r["over_number"])] = self.cur.fetchone()[0]
        self.conn.commit()
        return over_db_id

    def load_deliveries(self, delivery_rows, innings_db_id, over_db_id):
        rows = []
        for r in delivery_rows:
            iid = innings_db_id.get((r["match_id"], r["innings_number"]))
            oid = over_db_id.get((r["match_id"], r["innings_number"], r["over_number"]))
            if not iid or not oid:
                continue
            rows.append((
                oid, iid, 1,  # ball_number not tracked precisely by ETL; placeholder
                self.player_id.get(r["striker"]),
                self.player_id.get(r["non_striker"]),
                self.player_id.get(r["bowler"]),
                to_int(r["runs_batter"]) or 0, to_int(r["runs_extras"]) or 0,
                r["extras_type"] or None, to_int(r["runs_total"]) or 0,
                to_bool(r["is_wicket"]), r["dismissal_type"] or None,
                self.player_id.get(r["dismissed_player"]) if r["dismissed_player"] else None,
                self.player_id.get(r["fielder"]) if r["fielder"] else None,
            ))
        execute_values(
            self.cur,
            """INSERT INTO deliveries
               (over_id, innings_id, ball_number, striker_id, non_striker_id, bowler_id,
                runs_batter, runs_extras, extras_type, runs_total, is_wicket,
                dismissal_type, dismissed_player_id, fielder_id)
               VALUES %s""",
            rows,
        )
        self.conn.commit()

    def load_partnerships(self, partnership_rows, innings_db_id):
        rows = []
        for r in partnership_rows:
            iid = innings_db_id.get((r["match_id"], r["innings_number"]))
            if not iid:
                continue
            rows.append((
                iid, to_int(r["wicket_number"]),
                self.player_id.get(r["batter1"]) if r["batter1"] else None,
                self.player_id.get(r["batter2"]) if r["batter2"] else None,
                to_int(r["runs"]), to_int(r["batter1_runs"]), to_int(r["batter2_runs"]),
                to_int(r["balls_faced"]), to_bool(r["is_unbeaten"]),
                r["ended_by_dismissal_type"] or None,
            ))
        execute_values(
            self.cur,
            """INSERT INTO partnerships
               (innings_id, wicket_number, batter1_id, batter2_id, runs,
                batter1_runs, batter2_runs, balls_faced, is_unbeaten, ended_by_dismissal_type)
               VALUES %s""",
            rows,
        )
        self.conn.commit()

    def load_batting_positions(self, rows_in, innings_db_id):
        rows = []
        for r in rows_in:
            iid = innings_db_id.get((r["match_id"], r["innings_number"]))
            pid = self.player_id.get(r["player_hash"])
            if iid and pid:
                rows.append((iid, pid, to_int(r["batting_position"])))
        execute_values(
            self.cur,
            "INSERT INTO batting_positions (innings_id, player_id, batting_position) VALUES %s ON CONFLICT DO NOTHING",
            rows,
        )
        self.conn.commit()

    def load_batting_scorecard(self, rows_in, innings_db_id):
        rows = []
        for r in rows_in:
            iid = innings_db_id.get((r["match_id"], r["innings_number"]))
            pid = self.player_id.get(r["player_hash"])
            if not (iid and pid):
                continue
            rows.append((
                iid, pid, to_int(r["balls_faced"]), to_int(r["runs"]),
                to_int(r["balls_faced"]), to_int(r["fours"]), to_int(r["sixes"]),
                to_float(r["strike_rate"]), r["dismissal_type"] or None,
                self.player_id.get(r["dismissed_by"]) if r["dismissed_by"] else None,
                self.player_id.get(r["caught_by"]) if r["caught_by"] else None,
            ))
        # note: batting_position intentionally left NULL here; join to batting_positions for that
        execute_values(
            self.cur,
            """INSERT INTO match_batting_scorecard
               (innings_id, player_id, batting_position, runs, balls_faced, fours, sixes,
                strike_rate, dismissal_type, dismissed_by_bowler_id, caught_by_fielder_id)
               VALUES %s ON CONFLICT DO NOTHING""",
            [(iid, pid, None, runs, balls, fours, sixes, sr, dt, db, cb)
             for (iid, pid, _bp, runs, balls, fours, sixes, sr, dt, db, cb) in rows],
        )
        self.conn.commit()

    def load_bowling_scorecard(self, rows_in, innings_db_id):
        rows = []
        for r in rows_in:
            iid = innings_db_id.get((r["match_id"], r["innings_number"]))
            pid = self.player_id.get(r["player_hash"])
            if not (iid and pid):
                continue
            rows.append((
                iid, pid, to_float(r["overs_bowled"]), to_int(r["maidens"]),
                to_int(r["runs_conceded"]), to_int(r["wickets"]), to_float(r["economy"]),
            ))
        execute_values(
            self.cur,
            """INSERT INTO match_bowling_scorecard
               (innings_id, player_id, overs_bowled, maidens, runs_conceded, wickets, economy)
               VALUES %s ON CONFLICT DO NOTHING""",
            rows,
        )
        self.conn.commit()


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 loader.py <connection_string> <staging_csv_dir>")
        sys.exit(1)

    conn_str, csv_dir = sys.argv[1], sys.argv[2]
    conn = psycopg2.connect(conn_str)
    loader = Loader(conn)
    loader.load_existing()

    teams = load_csv(os.path.join(csv_dir, "teams_staging.csv"))
    venues = load_csv(os.path.join(csv_dir, "venues_staging.csv"))
    players = load_csv(os.path.join(csv_dir, "players_staging.csv"))
    matches = load_csv(os.path.join(csv_dir, "matches_staging.csv"))
    squads = load_csv(os.path.join(csv_dir, "squads_staging.csv"))
    innings = load_csv(os.path.join(csv_dir, "innings_staging.csv"))
    overs = load_csv(os.path.join(csv_dir, "overs_staging.csv"))
    deliveries = load_csv(os.path.join(csv_dir, "deliveries_staging.csv"))
    partnerships = load_csv(os.path.join(csv_dir, "partnerships_staging.csv"))
    batting_positions = load_csv(os.path.join(csv_dir, "batting_positions_staging.csv"))
    batting_scorecard = load_csv(os.path.join(csv_dir, "batting_scorecard_staging.csv"))
    bowling_scorecard = load_csv(os.path.join(csv_dir, "bowling_scorecard_staging.csv"))

    print("Loading dimension tables...")
    loader.upsert_teams(teams)
    loader.upsert_venues(venues)
    loader.upsert_players(players)
    loader.upsert_seasons(matches)
    loader.upsert_team_season(matches)

    print("Loading matches...")
    match_db_id, match_teams = loader.load_matches(matches)

    print("Loading squads...")
    loader.load_squads(squads, match_db_id)

    print("Loading innings...")
    innings_db_id = loader.load_innings(innings, match_db_id, match_teams)

    print("Loading overs...")
    over_db_id = loader.load_overs(overs, innings_db_id)

    print("Loading deliveries (this is the big one)...")
    loader.load_deliveries(deliveries, innings_db_id, over_db_id)

    print("Loading partnerships...")
    loader.load_partnerships(partnerships, innings_db_id)

    print("Loading batting positions...")
    loader.load_batting_positions(batting_positions, innings_db_id)

    print("Loading batting scorecards...")
    loader.load_batting_scorecard(batting_scorecard, innings_db_id)

    print("Loading bowling scorecards...")
    loader.load_bowling_scorecard(bowling_scorecard, innings_db_id)

    print("Done.")
    loader.cur.close()
    conn.close()


if __name__ == "__main__":
    main()
