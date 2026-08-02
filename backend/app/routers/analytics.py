"""
ThirdUmpire API -- analytics router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

router = APIRouter(tags=["analytics"])


@router.get("/api/toss-impact")
def toss_impact(team_id: Optional[int] = Query(None)):
    """
    Does winning the toss, and what you do with it, actually correlate
    with winning the match? Optionally scoped to one team's toss wins.
    """
    with get_conn() as conn, conn.cursor() as cur:

        cur.execute(
            """
            SELECT
                m.toss_decision,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE m.toss_winner_team_id = m.winner_team_id) AS toss_winner_won
            FROM raw_cricsheet.matches m
            WHERE m.toss_decision IS NOT NULL
              AND m.winner_team_id IS NOT NULL
              AND (%(team_id)s IS NULL OR m.toss_winner_team_id = %(team_id)s)
            GROUP BY m.toss_decision
            """,
            {"team_id": team_id},
        )
        by_decision = cur.fetchall()

        cur.execute(
            """
            SELECT
                COUNT(*) AS total_matches,
                COUNT(*) FILTER (WHERE m.toss_winner_team_id = m.winner_team_id) AS toss_winner_won
            FROM raw_cricsheet.matches m
            WHERE m.winner_team_id IS NOT NULL
              AND (%(team_id)s IS NULL OR m.toss_winner_team_id = %(team_id)s)
            """,
            {"team_id": team_id},
        )
        overall = cur.fetchone()

    decisions = {}
    for row in by_decision:
        win_pct = round(row["toss_winner_won"] / row["total"] * 100, 1) if row["total"] else None
        decisions[row["toss_decision"]] = {
            "matches": row["total"],
            "toss_winner_won": row["toss_winner_won"],
            "toss_winner_win_pct": win_pct,
        }

    overall_win_pct = (
        round(overall["toss_winner_won"] / overall["total_matches"] * 100, 1)
        if overall["total_matches"] else None
    )

    return {
        "overall": {
            "total_matches": overall["total_matches"],
            "toss_winner_won": overall["toss_winner_won"],
            "toss_winner_win_pct": overall_win_pct,
        },
        "by_decision": decisions,
    }
# =========================================================
# Season Awards
# =========================================================
#
# IMPORTANT: "Player of the Season" is NOT an official PSL award or a
# stat that exists anywhere in the underlying data -- it's a custom
# composite score (1 pt/run, 20 pts/wicket, 10 pts/fielding dismissal),
# computed in the v_season_player_of_season view. Present it in the UI
# as clearly custom/derived, not as an authoritative designation, the
# same way the four real leaderboard categories below are.
#
# Batter/Bowler/Fielder/Wicketkeeper of the Season ARE the genuine
# statistical leaders for that category and season -- ties are
# returned as multiple rows rather than arbitrarily broken.


@router.get("/api/day-night-split")
def day_night_split(team_id: Optional[int] = Query(None)):
    with get_conn() as conn, conn.cursor() as cur:

        cur.execute(
            """
            SELECT
                m.is_day_night,
                COUNT(*) AS innings,
                COALESCE(SUM(bs.runs), 0)        AS total_runs,
                COALESCE(SUM(bs.balls_faced), 0) AS total_balls_faced,
                COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL) AS dismissals,
                COALESCE(SUM(bs.fours), 0) AS fours,
                COALESCE(SUM(bs.sixes), 0) AS sixes
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            WHERE m.is_day_night IS NOT NULL
              AND (%(team_id)s IS NULL OR i.batting_team_id = %(team_id)s)
            GROUP BY m.is_day_night
            """,
            {"team_id": team_id},
        )
        batting_rows = {r["is_day_night"]: r for r in cur.fetchall()}

        cur.execute(
            """
            SELECT
                m.is_day_night,
                COUNT(*) AS innings,
                COALESCE(SUM(
                    FLOOR(bw.overs_bowled) * 6 + ROUND((bw.overs_bowled - FLOOR(bw.overs_bowled)) * 10)
                ), 0) AS total_balls,
                COALESCE(SUM(bw.runs_conceded), 0) AS total_runs_conceded,
                COALESCE(SUM(bw.wickets), 0)       AS total_wickets
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            WHERE m.is_day_night IS NOT NULL
              AND (%(team_id)s IS NULL OR i.bowling_team_id = %(team_id)s)
            GROUP BY m.is_day_night
            """,
            {"team_id": team_id},
        )
        bowling_rows = {r["is_day_night"]: r for r in cur.fetchall()}

        # Match-shape: 1st-innings score and chase success, same pattern
        # used for v_venue_pitch_profile but split by lights instead of venue.
        cur.execute(
            """
            SELECT
                m.is_day_night,
                COUNT(DISTINCT m.match_id) AS matches,
                ROUND(AVG(i1.total_runs), 1) AS avg_first_innings_score,
                ROUND(
                    100.0 * COUNT(DISTINCT m.match_id) FILTER (WHERE m.winner_team_id = i2.batting_team_id)
                    / NULLIF(COUNT(DISTINCT m.match_id) FILTER (WHERE i2.match_id IS NOT NULL), 0), 1
                ) AS chase_success_pct
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.innings i1 ON i1.match_id = m.match_id AND i1.innings_number = 1
            LEFT JOIN raw_cricsheet.innings i2 ON i2.match_id = m.match_id AND i2.innings_number = 2
            WHERE m.is_day_night IS NOT NULL
              AND (%(team_id)s IS NULL OR m.team1_id = %(team_id)s OR m.team2_id = %(team_id)s)
            GROUP BY m.is_day_night
            """,
            {"team_id": team_id},
        )
        match_rows = {r["is_day_night"]: r for r in cur.fetchall()}

    def build_bucket(is_night: bool):
        b = batting_rows.get(is_night)
        bw = bowling_rows.get(is_night)
        m = match_rows.get(is_night)

        balls_faced = (b["total_balls_faced"] if b else 0) or 0
        dismissals = (b["dismissals"] if b else 0) or 0
        runs = (b["total_runs"] if b else 0) or 0
        strike_rate = round(runs / balls_faced * 100, 2) if balls_faced else None
        batting_average = round(runs / dismissals, 2) if dismissals else None

        total_balls = (bw["total_balls"] if bw else 0) or 0
        total_wickets = (bw["total_wickets"] if bw else 0) or 0
        runs_conceded = (bw["total_runs_conceded"] if bw else 0) or 0
        economy = round(runs_conceded / (total_balls / 6), 2) if total_balls else None
        bowling_average = round(runs_conceded / total_wickets, 2) if total_wickets else None

        return {
            "matches": m["matches"] if m else 0,
            "avg_first_innings_score": m["avg_first_innings_score"] if m else None,
            "chase_success_pct": m["chase_success_pct"] if m else None,
            "batting": {
                "innings": b["innings"] if b else 0,
                "runs": runs,
                "average": batting_average,
                "strike_rate": strike_rate,
                "fours": b["fours"] if b else 0,
                "sixes": b["sixes"] if b else 0,
            },
            "bowling": {
                "innings": bw["innings"] if bw else 0,
                "wickets": total_wickets,
                "economy": economy,
                "average": bowling_average,
            },
        }

    return {
        "day": build_bucket(False),
        "night": build_bucket(True),
    }


# =========================================================
# Phase-wise Specialist View (powerplay / middle / death)
# =========================================================
# Used by phases.html. Cheap to build because `overs.phase` is already a
# generated column (over_number < 6 -> powerplay, < 16 -> middle, else
# death), and each row in `overs` is one full completed over, so COUNT(*)
# on that table is a direct over count -- no balls-conversion needed
# (unlike match_bowling_scorecard.overs_bowled elsewhere in this file).


@router.get("/api/batter-vs-bowling-type")
def batter_vs_bowling_type(player_id: int = Query(...)):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                COALESCE(bowler.bowler_type::text, 'unclassified') AS bowler_type,
                COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS balls_faced,
                COALESCE(SUM(d.runs_batter), 0) AS runs_scored,
                COUNT(*) FILTER (WHERE d.is_wicket AND d.dismissed_player_id = %(player_id)s) AS dismissals,
                COUNT(*) FILTER (WHERE d.runs_batter = 4) AS fours,
                COUNT(*) FILTER (WHERE d.runs_batter = 6) AS sixes
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.players bowler ON bowler.player_id = d.bowler_id
            WHERE d.striker_id = %(player_id)s
            GROUP BY bowler.bowler_type
            """,
            {"player_id": player_id},
        )
        rows = cur.fetchall()

        cur.execute(
            "SELECT player_id, display_name, full_name FROM raw_cricsheet.players WHERE player_id = %(id)s",
            {"id": player_id},
        )
        player = cur.fetchone()

    results = {}
    for row in rows:
        balls = row["balls_faced"] or 0
        dismissals = row["dismissals"] or 0
        results[row["bowler_type"]] = {
            "balls_faced": balls,
            "runs_scored": row["runs_scored"],
            "dismissals": dismissals,
            "fours": row["fours"],
            "sixes": row["sixes"],
            "strike_rate": round(row["runs_scored"] / balls * 100, 2) if balls else None,
            "average": round(row["runs_scored"] / dismissals, 2) if dismissals else None,
        }

    return {"player": player, "by_bowler_type": results}


# =========================================================
# League Evolution Over Time
# =========================================================
# Used by league-evolution.html.


@router.get("/api/data-quality")
def data_quality():
    with get_conn() as conn, conn.cursor() as cur:

        row_counts = {}
        tables = [
            "seasons", "teams", "venues", "players", "matches", "innings", "overs",
            "deliveries", "match_batting_scorecard", "match_bowling_scorecard",
            "match_squads", "match_weather", "partnerships",
        ]
        for t in tables:
            cur.execute(f"SELECT COUNT(*) AS c FROM raw_cricsheet.{t}")
            row_counts[t] = cur.fetchone()["c"]

        checks = []

        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM raw_cricsheet.match_bowling_scorecard
            WHERE overs_bowled > 4.0
            """
        )
        checks.append({
            "check": "Bowler over-limit (max 4 overs/innings)",
            "failing_rows": cur.fetchone()["n"],
            "note": "Flags match_bowling_scorecard rows where overs_bowled exceeds 4.0 -- not legal in a 20-over innings.",
        })

        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM raw_cricsheet.innings i
            WHERE i.total_runs IS DISTINCT FROM (
                SELECT COALESCE(SUM(d.runs_total), 0)
                FROM raw_cricsheet.deliveries d
                WHERE d.innings_id = i.innings_id
            )
            """
        )
        checks.append({
            "check": "innings.total_runs vs SUM(deliveries.runs_total)",
            "failing_rows": cur.fetchone()["n"],
            "note": "Innings-level totals should tie back exactly to the ball-by-ball sum.",
        })

        cur.execute(
            """
            SELECT COUNT(*) AS n
            FROM raw_cricsheet.innings i
            WHERE i.total_wickets IS DISTINCT FROM (
                SELECT COUNT(*)
                FROM raw_cricsheet.match_batting_scorecard bs
                WHERE bs.innings_id = i.innings_id AND bs.dismissal_type IS NOT NULL
            )
            """
        )
        checks.append({
            "check": "innings.total_wickets vs dismissals on match_batting_scorecard",
            "failing_rows": cur.fetchone()["n"],
            "note": "Cross-checks the innings summary against the per-player dismissal records.",
        })

        cur.execute(
            """
            SELECT COUNT(*) AS n FROM (
                SELECT match_id, team_id, COUNT(*) AS squad_size
                FROM raw_cricsheet.match_squads
                GROUP BY match_id, team_id
                HAVING COUNT(*) NOT IN (11, 12)
            ) x
            """
        )
        checks.append({
            "check": "Squad size per team/match (expect 11, or 12 with an Impact Player sub)",
            "failing_rows": cur.fetchone()["n"],
            "note": "Anything outside 11-12 usually means a missing or duplicated match_squads row.",
        })

        cur.execute(
            """
            SELECT COUNT(*) AS n FROM (
                SELECT ms.match_id, ms.team_id
                FROM raw_cricsheet.match_squads ms
                GROUP BY ms.match_id, ms.team_id
                HAVING COUNT(*) FILTER (WHERE ms.is_wicketkeeper) = 0
            ) x
            """
        )
        checks.append({
            "check": "Team/match combos with no player flagged is_wicketkeeper",
            "failing_rows": cur.fetchone()["n"],
            "note": "Not necessarily wrong -- just worth spot-checking that it's a genuine gap and not an untagged keeper.",
        })

        cur.execute("SELECT COUNT(*) AS n FROM raw_cricsheet.matches")
        total_matches = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM raw_cricsheet.match_weather")
        matches_with_weather = cur.fetchone()["n"]

    weather_coverage_pct = (
        round(100.0 * matches_with_weather / total_matches, 1) if total_matches else None
    )

    return {
        "row_counts": row_counts,
        "integrity_checks": checks,
        "weather_coverage": {
            "matches_with_weather": matches_with_weather,
            "total_matches": total_matches,
            "coverage_pct": weather_coverage_pct,
            "note": "Weather figures (including dew_present) are scraped estimates, not measured -- label them as such wherever they're surfaced in the UI.",
        },
    }
