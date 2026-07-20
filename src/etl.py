"""
PSL Cricsheet ETL (v2)
Parses Cricsheet YAML match files into normalized CSVs matching psl_schema.sql (v2):
seasons, teams, venues, players, matches, squads, innings, overs, deliveries,
partnerships, batting_positions, batting_scorecard, bowling_scorecard.

Usage:
    python3 etl.py /path/to/yaml_folder /path/to/output_csv_folder
"""

import yaml
import glob
import os
import sys
import csv

DISMISSAL_MAP = {
    "caught": "caught",
    "caught and bowled": "caught_and_bowled",
    "bowled": "bowled",
    "lbw": "lbw",
    "run out": "run_out",
    "stumped": "stumped",
    "hit wicket": "hit_wicket",
    "retired hurt": "retired_hurt",
    "retired out": "retired_out",
    "obstructing the field": "obstructing_field",
    "hit the ball twice": "hit_ball_twice",
    "timed out": "timed_out",
}

# Dismissal kinds NOT credited to the bowler in standard bowling figures.
NOT_BOWLER_CREDIT = {"run_out", "retired_hurt", "retired_out", "obstructing_field", "timed_out"}

VENUE_CITY_FALLBACK = {
    "Dubai International Cricket Stadium": "Dubai",
    "Sharjah Cricket Stadium": "Sharjah",
    "National Stadium": "Karachi",
    "Gaddafi Stadium": "Lahore",
    "Multan Cricket Stadium": "Multan",
    "Rawalpindi Cricket Stadium": "Rawalpindi",
    "Arbab Niaz Stadium": "Peshawar",
    "Pindi Cricket Stadium": "Rawalpindi",
    "Sheikh Zayed Stadium": "Abu Dhabi",
}


def to_iso(d):
    return d.isoformat() if hasattr(d, "isoformat") else str(d)


def infer_season_year(dates):
    d = dates[0]
    return d.year if hasattr(d, "year") else int(str(d)[:4])


def load_matches(yaml_dir):
    out = []
    for fp in sorted(glob.glob(os.path.join(yaml_dir, "*.yaml"))):
        with open(fp) as f:
            data = yaml.safe_load(f)
        data["_match_id"] = os.path.splitext(os.path.basename(fp))[0]
        out.append(data)
    return out


def bowler_charged_runs(runs_batter, extras):
    """Runs charged against the bowler's figures: off the bat + wide/no-ball
    PENALTY runs only. Byes and leg-byes are NEVER charged to the bowler,
    even when they occur off a no-ball -- e.g. extras={'legbyes': 4,
    'noballs': 1} should charge the bowler just 1 run (the no-ball
    penalty), not the combined total of 5. Confirmed against the real
    ESPNcricinfo scorecard for the exact match this was traced to
    (Karachi Kings vs Lahore Qalandars, 12 March 2020): Shaheen Shah
    Afridi's real figures were 4.0-0-37-0. Using the full combined extras
    total instead of just the penalty portion overcounts by exactly the
    legbye/bye amount on any delivery where both occur together."""
    return runs_batter + extras.get("wides", 0) + extras.get("noballs", 0)


# Cricsheet's per-delivery "extras" dict can have MORE THAN ONE key at
# once -- e.g. a wide where the keeper also fumbles and byes get run:
# {"wides": 1, "byes": 4}. The illegal-delivery type (wides/noballs) must
# take priority when present: it's what determines whether the ball
# counts as one of the bowler's 6 legal balls in the over, AND the whole
# value (not just the non-bye portion) is charged to the bowler by rule.
# Picking an arbitrary/first key (as this used to do via
# next(iter(extras.keys()))) silently misclassifies these combined
# deliveries as plain byes/legbyes balls -- which both over-counts the
# bowler's legal-ball tally (extra ball bowled without it counting toward
# the 4-over cap) AND under-charges runs conceded by the amount of the
# byes portion (often exactly 1 run, matching the "one less run every
# time" pattern).
EXTRAS_PRIORITY = ["wides", "noballs", "byes", "legbyes", "penalty"]


def classify_extras(extras):
    for key in EXTRAS_PRIORITY:
        if key in extras:
            return key
    return next(iter(extras.keys()), "")


def process_match(m, teams, venues, players):
    info = m["info"]
    match_id = m["_match_id"]
    dates = info["dates"]
    year = infer_season_year(dates)

    team1, team2 = info["teams"]

    def get_team_id(name):
        if name not in teams:
            teams[name] = len(teams) + 1
        return teams[name]

    get_team_id(team1)
    get_team_id(team2)

    venue_raw = info.get("venue", "UNKNOWN")
    city = info.get("city")
    if "," in venue_raw:
        venue_name, embedded_city = [p.strip() for p in venue_raw.split(",", 1)]
        city = city or embedded_city
    else:
        venue_name = venue_raw.strip()
    city = city or VENUE_CITY_FALLBACK.get(venue_name, "")

    def get_venue_id(name, c):
        key = (name, c)
        if key not in venues:
            venues[key] = len(venues) + 1
        return venues[key]

    get_venue_id(venue_name, city)

    registry = info.get("registry", {}).get("people", {})
    for pname, phash in registry.items():
        players.setdefault(phash, {"full_name": pname, "external_ref_cricsheet": phash})

    def h(name):
        """Resolve a player name to Cricsheet's stable registry hash. Using the
        hash (not the name) as the join key everywhere downstream avoids
        silently merging two different real players who happen to share a
        name (this genuinely happens in the data, e.g. two different
        'Mohammad Asif's)."""
        return registry.get(name, name)

    toss_winner = info["toss"]["winner"]
    toss_decision = "bowl" if info["toss"]["decision"] == "field" else "bat"

    outcome = info.get("outcome", {})
    result = outcome.get("result")
    is_tie = result == "tie"
    decided_by_super_over = bool(outcome.get("eliminator"))
    winner = outcome.get("winner") or outcome.get("eliminator") or ""
    win_by = outcome.get("by", {})
    is_dls = outcome.get("method") == "D/L"
    status = "no_result" if result == "no result" else "completed"

    match_row = {
        "match_id": match_id,
        "season_year": year,
        "match_date": to_iso(dates[0]),
        "venue_name": venue_name,
        "venue_city": city,
        "team1": team1,
        "team2": team2,
        "toss_winner": toss_winner,
        "toss_decision": toss_decision,
        "winner": winner,
        "win_margin_runs": win_by.get("runs", ""),
        "win_margin_wickets": win_by.get("wickets", ""),
        "is_tie": is_tie,
        "decided_by_super_over": decided_by_super_over,
        "is_dls_affected": is_dls,
        "status": status,
        "player_of_match": h((info.get("player_of_match") or [""])[0]),
    }

    squad_rows = []
    for team_name, plist in info.get("players", {}).items():
        for pname in plist:
            squad_rows.append({
                "match_id": match_id, "team": team_name,
                "player_hash": h(pname), "player_name": pname,
            })

    innings_rows, over_rows, delivery_rows = [], [], []
    partnership_rows, batting_position_rows = [], []
    batting_scorecard_rows, bowling_scorecard_rows = [], []

    for inn_idx, inn in enumerate(m.get("innings", []), start=1):
        for inn_name, inn_data in inn.items():
            batting_team = inn_data.get("team")
            total_runs = total_wickets = 0

            overs_map = {}
            bat_agg = {}
            bowl_agg = {}
            batting_order = []
            seen_players = set()

            current_partners = []
            partnership_runs = 0
            partnership_batter_runs = {}
            partnership_balls = 0
            wicket_no = 0

            deliveries_list = inn_data.get("deliveries", [])

            for ball in deliveries_list:
                for over_ball_key, ball_data in ball.items():
                    over_number = int(float(str(over_ball_key)))
                    striker = h(ball_data.get("batsman", ""))
                    non_striker = h(ball_data.get("non_striker", ""))
                    bowler = h(ball_data.get("bowler", ""))

                    for p in (striker, non_striker):
                        if p and p not in seen_players:
                            seen_players.add(p)
                            batting_order.append(p)
                    if len(current_partners) < 2:
                        for p in (striker, non_striker):
                            if p not in current_partners:
                                current_partners.append(p)
                        partnership_batter_runs.setdefault(striker, 0)
                        partnership_batter_runs.setdefault(non_striker, 0)

                    runs = ball_data.get("runs", {})
                    runs_batter = runs.get("batsman", 0)
                    runs_extras = runs.get("extras", 0)
                    runs_total = runs.get("total", 0)
                    total_runs += runs_total

                    extras = ball_data.get("extras", {})
                    extras_type = classify_extras(extras)
                    is_legal_ball = extras_type not in ("wides", "noballs")

                    wicket = ball_data.get("wicket")
                    is_wicket = wicket is not None
                    dismissal_type = dismissed_player = fielder = ""
                    if wicket:
                        w = wicket if isinstance(wicket, dict) else wicket[0]
                        kind = w.get("kind", "")
                        dismissal_type = DISMISSAL_MAP.get(kind, kind.replace(" ", "_"))
                        dismissed_player = h(w.get("player_out", ""))
                        fielders = w.get("fielders", [])
                        fielder = h(fielders[0]) if fielders else ""
                        if dismissal_type == "caught_and_bowled" and not fielder:
                            fielder = bowler
                        total_wickets += 1

                    delivery_rows.append({
                        "match_id": match_id, "innings_number": inn_idx,
                        "over_number": over_number, "striker": striker,
                        "non_striker": non_striker, "bowler": bowler,
                        "runs_batter": runs_batter, "runs_extras": runs_extras,
                        "extras_type": extras_type, "runs_total": runs_total,
                        "is_wicket": is_wicket, "dismissal_type": dismissal_type,
                        "dismissed_player": dismissed_player, "fielder": fielder,
                    })

                    ov = overs_map.setdefault(over_number, {
                        "bowler": bowler, "runs_conceded": 0, "wickets": 0, "legal_balls": 0,
                    })
                    charged = bowler_charged_runs(runs_batter, extras)
                    ov["runs_conceded"] += charged
                    if is_wicket and dismissal_type not in NOT_BOWLER_CREDIT:
                        ov["wickets"] += 1
                    if is_legal_ball:
                        ov["legal_balls"] += 1

                    b = bat_agg.setdefault(striker, {
                        "runs": 0, "balls": 0, "fours": 0, "sixes": 0,
                        "dismissal_type": "", "dismissed_by": "", "caught_by": "",
                    })
                    b["runs"] += runs_batter
                    if extras_type != "wides":
                        b["balls"] += 1
                    if runs_batter == 4:
                        b["fours"] += 1
                    if runs_batter == 6:
                        b["sixes"] += 1
                    if is_wicket and dismissed_player == striker:
                        b["dismissal_type"] = dismissal_type
                        b["dismissed_by"] = bowler if dismissal_type not in NOT_BOWLER_CREDIT else ""
                        b["caught_by"] = fielder if dismissal_type in ("caught", "caught_and_bowled") else ""

                    bw = bowl_agg.setdefault(bowler, {
                        "legal_balls": 0, "runs_charged": 0, "wickets": 0,
                    })
                    bw["legal_balls"] += 1 if is_legal_ball else 0
                    bw["runs_charged"] += charged
                    if is_wicket and dismissal_type not in NOT_BOWLER_CREDIT:
                        bw["wickets"] += 1

                    if striker in partnership_batter_runs:
                        partnership_batter_runs[striker] += runs_batter
                    partnership_runs += runs_total
                    if is_legal_ball:
                        partnership_balls += 1

                    if is_wicket:
                        wicket_no += 1
                        b1, b2 = (current_partners + ["", ""])[:2]
                        partnership_rows.append({
                            "match_id": match_id, "innings_number": inn_idx,
                            "wicket_number": wicket_no, "batter1": b1, "batter2": b2,
                            "runs": partnership_runs,
                            "batter1_runs": partnership_batter_runs.get(b1, 0),
                            "batter2_runs": partnership_batter_runs.get(b2, 0),
                            "balls_faced": partnership_balls,
                            "is_unbeaten": False,
                            "ended_by_dismissal_type": dismissal_type,
                        })
                        current_partners = [p for p in current_partners if p != dismissed_player]
                        partnership_runs = 0
                        partnership_balls = 0
                        partnership_batter_runs = {p: 0 for p in current_partners}

            if partnership_runs > 0 or (len(current_partners) == 2 and partnership_balls > 0):
                wicket_no += 1
                b1, b2 = (current_partners + ["", ""])[:2]
                partnership_rows.append({
                    "match_id": match_id, "innings_number": inn_idx,
                    "wicket_number": wicket_no, "batter1": b1, "batter2": b2,
                    "runs": partnership_runs,
                    "batter1_runs": partnership_batter_runs.get(b1, 0),
                    "batter2_runs": partnership_batter_runs.get(b2, 0),
                    "balls_faced": partnership_balls,
                    "is_unbeaten": True,
                    "ended_by_dismissal_type": "",
                })

            for over_number, ov in overs_map.items():
                is_maiden = ov["runs_conceded"] == 0 and ov["legal_balls"] >= 6
                over_rows.append({
                    "match_id": match_id, "innings_number": inn_idx,
                    "over_number": over_number, "bowler": ov["bowler"],
                    "runs_conceded": ov["runs_conceded"], "wickets": ov["wickets"],
                    "is_maiden": is_maiden,
                })

            for pos, pname in enumerate(batting_order, start=1):
                batting_position_rows.append({
                    "match_id": match_id, "innings_number": inn_idx,
                    "player_hash": pname, "batting_position": pos,
                })

            for pname, b in bat_agg.items():
                sr = round(b["runs"] / b["balls"] * 100, 2) if b["balls"] else 0
                batting_scorecard_rows.append({
                    "match_id": match_id, "innings_number": inn_idx, "player_hash": pname,
                    "runs": b["runs"], "balls_faced": b["balls"], "fours": b["fours"],
                    "sixes": b["sixes"], "strike_rate": sr,
                    "dismissal_type": b["dismissal_type"],
                    "dismissed_by": b["dismissed_by"], "caught_by": b["caught_by"],
                })

            for bname, bw in bowl_agg.items():
                whole_overs = bw["legal_balls"] // 6
                partial_balls = bw["legal_balls"] % 6
                overs_bowled = float(f"{whole_overs}.{partial_balls}")
                econ = round(bw["runs_charged"] / (bw["legal_balls"] / 6), 2) if bw["legal_balls"] else 0
                maidens = sum(1 for o in over_rows
                              if o["match_id"] == match_id and o["innings_number"] == inn_idx
                              and o["bowler"] == bname and o["is_maiden"])
                bowling_scorecard_rows.append({
                    "match_id": match_id, "innings_number": inn_idx, "player_hash": bname,
                    "overs_bowled": overs_bowled, "maidens": maidens,
                    "runs_conceded": bw["runs_charged"], "wickets": bw["wickets"], "economy": econ,
                })

            innings_rows.append({
                "match_id": match_id, "innings_number": inn_idx,
                "batting_team": batting_team, "total_runs": total_runs, "total_wickets": total_wickets,
            })

    return {
        "match": match_row, "squads": squad_rows, "innings": innings_rows,
        "overs": over_rows, "deliveries": delivery_rows,
        "partnerships": partnership_rows, "batting_positions": batting_position_rows,
        "batting_scorecard": batting_scorecard_rows, "bowling_scorecard": bowling_scorecard_rows,
    }


def write_csv(rows, path, fieldnames):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 etl.py <yaml_dir> <output_dir>")
        sys.exit(1)
    yaml_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    teams, venues, players = {}, {}, {}
    all_tables = {k: [] for k in [
        "match", "squads", "innings", "overs", "deliveries",
        "partnerships", "batting_positions", "batting_scorecard", "bowling_scorecard",
    ]}
    unresolved_cities = set()

    for m in load_matches(yaml_dir):
        result = process_match(m, teams, venues, players)
        for k in all_tables:
            v = result[k]
            all_tables[k].extend(v if isinstance(v, list) else [v])
        if not result["match"]["venue_city"]:
            unresolved_cities.add(result["match"]["venue_name"])

    write_csv([{"team_name": n, "team_id": i} for n, i in teams.items()],
               os.path.join(out_dir, "teams_staging.csv"), ["team_name", "team_id"])
    write_csv([{"venue_name": n, "city": c, "venue_id": i} for (n, c), i in venues.items()],
               os.path.join(out_dir, "venues_staging.csv"), ["venue_name", "city", "venue_id"])
    write_csv([{"external_ref_cricsheet": h, "full_name": p["full_name"]} for h, p in players.items()],
               os.path.join(out_dir, "players_staging.csv"), ["external_ref_cricsheet", "full_name"])

    for key, fname in [
        ("match", "matches_staging.csv"), ("squads", "squads_staging.csv"),
        ("innings", "innings_staging.csv"), ("overs", "overs_staging.csv"),
        ("deliveries", "deliveries_staging.csv"), ("partnerships", "partnerships_staging.csv"),
        ("batting_positions", "batting_positions_staging.csv"),
        ("batting_scorecard", "batting_scorecard_staging.csv"),
        ("bowling_scorecard", "bowling_scorecard_staging.csv"),
    ]:
        rows = all_tables[key]
        if rows:
            write_csv(rows, os.path.join(out_dir, fname), list(rows[0].keys()))

    print(f"Matches parsed:         {len(all_tables['match'])}")
    print(f"Teams:                  {len(teams)}")
    print(f"Venues:                 {len(venues)}")
    print(f"Players:                {len(players)}")
    print(f"Innings rows:           {len(all_tables['innings'])}")
    print(f"Over rows:              {len(all_tables['overs'])}")
    print(f"Delivery rows:          {len(all_tables['deliveries'])}")
    print(f"Partnership rows:       {len(all_tables['partnerships'])}")
    print(f"Batting position rows:  {len(all_tables['batting_positions'])}")
    print(f"Batting scorecard rows: {len(all_tables['batting_scorecard'])}")
    print(f"Bowling scorecard rows: {len(all_tables['bowling_scorecard'])}")
    if unresolved_cities:
        print("\nWARNING: venues with no known city:")
        for v in sorted(unresolved_cities):
            print(f"  - {v}")


if __name__ == "__main__":
    main()