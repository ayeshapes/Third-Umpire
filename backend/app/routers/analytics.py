"""
ThirdUmpire API -- analytics router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.database.connection import get_conn
from app.utils.batting_filters import INNINGS_JOINS, BattingFilters
from app.utils.bowling_filters import BowlingFilters
from app.utils.bowling_filters import INNINGS_JOINS as BOWLING_JOINS
from app.utils.cricket import balls_to_overs_str
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr

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


# =========================================================
# Batting Analytics -- frontend/app/(dashboard)/batting/page.tsx
# =========================================================
#
# Seven endpoints backing the page's "Visualizations" and "Match
# Conditions" sections. Every one takes the exact same shared
# FilterState the global FilterBar writes (see
# app/utils/batting_filters.py for the season/team/player/... ->
# SQL-column mapping) so changing a filter refreshes every chart on
# the page with no chart-specific wiring, matching how
# hooks/use-chart-data.ts already drives the rest of the dashboard.
#
# The four "Match Conditions" breakdowns (by-venue/by-opposition/
# by-phase/by-batting-order) each deliberately EXCLUDE their own
# filter dimension -- see VenueAnalysis's docstring on the frontend:
# they answer "what's the spread across every X", which a single-X
# filter would otherwise collapse to one row/column.


@router.get("/api/analytics/batting/manhattan")
def batting_manhattan(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Runs-per-over (off the bat, extras excluded) and wickets-per-over,
    aggregated across every innings matching the current filters --
    the "Manhattan skyline" bars for components/charts/manhattan-chart.tsx.

    Uses raw_cricsheet.deliveries (not overs.runs_conceded, which
    includes extras) so this stays accurate when scoped to a single
    `player` via `striker_id` -- team-level runs conceded by over
    wouldn't mean anything once filtered to one batter.

    overs.over_number is 0-indexed (over_number < 6 -> powerplay is 6
    overs, 0-5) but ManhattanOver.over is documented as 1-indexed on
    the frontend, hence the +1.
    """
    where_sql, params = filters.where()
    params["player"] = filters.player
    params["phase"] = filters.phase

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                o.over_number + 1 AS over,
                COALESCE(SUM(d.runs_batter), 0) AS runs,
                COUNT(*) FILTER (
                    WHERE d.is_wicket
                      AND (%(player)s IS NULL OR d.dismissed_player_id = %(player)s)
                ) AS wickets
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR d.striker_id = %(player)s)
              AND (%(phase)s IS NULL OR o.phase = %(phase)s)
              {where_sql}
            GROUP BY o.over_number
            ORDER BY o.over_number
            """,
            params,
        )
        return cur.fetchall()


@router.get("/api/analytics/batting/boundaries")
def batting_boundaries(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Fours/sixes split plus a powerplay/middle/death breakdown, for
    components/charts/boundary-analysis.tsx.

    Top-level totals come from match_batting_scorecard (pre-aggregated,
    cheap); the phase split needs ball-level data since fours/sixes
    aren't tagged by phase on the scorecard table, so that half queries
    raw_cricsheet.deliveries joined to overs for its generated
    `phase` column.
    """
    where_sql, params = filters.where()
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                COALESCE(SUM(bs.fours), 0) AS total_fours,
                COALESCE(SUM(bs.sixes), 0) AS total_sixes,
                COALESCE(SUM(bs.runs), 0)  AS total_runs
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR bs.player_id = %(player)s)
              {where_sql}
            """,
            params,
        )
        totals = cur.fetchone()

        cur.execute(
            f"""
            SELECT
                o.phase,
                COUNT(*) FILTER (WHERE d.runs_batter = 4) AS fours,
                COUNT(*) FILTER (WHERE d.runs_batter = 6) AS sixes
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR d.striker_id = %(player)s)
              {where_sql}
            GROUP BY o.phase
            """,
            params,
        )
        by_phase_rows = {r["phase"]: r for r in cur.fetchall()}

    total_fours = totals["total_fours"] or 0
    total_sixes = totals["total_sixes"] or 0
    total_runs = totals["total_runs"] or 0

    by_phase = []
    for phase in ("powerplay", "middle", "death"):
        r = by_phase_rows.get(phase)
        by_phase.append({
            "phase": phase,
            "fours": (r["fours"] if r else 0) or 0,
            "sixes": (r["sixes"] if r else 0) or 0,
        })

    return {
        "total_fours": total_fours,
        "total_sixes": total_sixes,
        "runs_from_boundaries": total_fours * 4 + total_sixes * 6,
        "total_runs": total_runs,
        "by_phase": by_phase,
    }


@router.get("/api/analytics/batting/boundary-timing")
def batting_boundary_timing(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Fours/sixes bucketed by over number (1-20), for
    components/charts/boundary-timing.tsx -- replaces the old wagon
    wheel, which needed shot x/y that was never in the schema. This
    answers a *when* question (which overs boundaries cluster in)
    rather than wagon wheel's *where*, but it's the closest thing the
    ball-by-ball data actually supports.

    Ball-level (raw_cricsheet.deliveries joined to overs for
    over_number) since boundary counts aren't broken out by over
    anywhere pre-aggregated. `runs_batter` (not `runs_total`) is the
    boundary signal -- `runs_total` also counts extras, so a leg-bye
    that rolls to the ropes would otherwise get miscounted as the
    batter's own four/six.

    overs.over_number is 0-indexed (over_number < 6 -> powerplay is 6
    overs, 0-5); +1 here to match the 1-20 axis the frontend expects,
    same convention as batting_manhattan above.
    """
    where_sql, params = filters.where()
    params["player"] = filters.player
    params["phase"] = filters.phase

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                o.over_number + 1 AS over,
                COUNT(*) FILTER (WHERE d.runs_batter = 4) AS fours,
                COUNT(*) FILTER (WHERE d.runs_batter = 6) AS sixes
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR d.striker_id = %(player)s)
              AND (%(phase)s IS NULL OR o.phase = %(phase)s)
              AND d.runs_batter IN (4, 6)
              {where_sql}
            GROUP BY o.over_number
            ORDER BY o.over_number
            """,
            params,
        )
        return cur.fetchall()


@router.get("/api/analytics/batting/partnerships")
def batting_partnerships(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Best (highest-runs) partnership for each wicket number within the
    current filter scope, for components/charts/partnership-analysis.tsx
    -- one representative pair per wicket rather than every partnership
    ever recorded, since the chart draws exactly one bar per wicket
    number.

    `player` scopes to partnerships this player was actually part of
    (either side of the stand).
    """
    where_sql, params = filters.where()
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT DISTINCT ON (pt.wicket_number)
                pt.wicket_number AS wicket,
                COALESCE(b1.display_name, b1.full_name, 'Unknown') AS batter1,
                COALESCE(b2.display_name, b2.full_name, 'Unknown') AS batter2,
                COALESCE(pt.runs, 0) AS runs,
                COALESCE(pt.balls_faced, 0) AS balls
            FROM raw_cricsheet.partnerships pt
            JOIN raw_cricsheet.innings i ON i.innings_id = pt.innings_id
            {INNINGS_JOINS}
            LEFT JOIN raw_cricsheet.players b1 ON b1.player_id = pt.batter1_id
            LEFT JOIN raw_cricsheet.players b2 ON b2.player_id = pt.batter2_id
            WHERE pt.wicket_number BETWEEN 1 AND 10
              AND (
                  %(player)s IS NULL
                  OR pt.batter1_id = %(player)s
                  OR pt.batter2_id = %(player)s
              )
              {where_sql}
            ORDER BY pt.wicket_number, pt.runs DESC NULLS LAST
            """,
            params,
        )
        return cur.fetchall()


@router.get("/api/analytics/batting/by-venue")
def batting_by_venue(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Runs/average/strike-rate broken down by every venue in scope, for
    components/charts/venue-analysis.tsx. Excludes the `venue` filter
    itself -- see module docstring.
    """
    where_sql, params = filters.where(exclude=frozenset({"venue"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                v.venue_id,
                v.venue_name,
                v.city,
                COUNT(DISTINCT bs.innings_id) AS innings,
                COALESCE(SUM(bs.runs), 0) AS runs,
                COALESCE(SUM(bs.balls_faced), 0) AS balls_faced,
                COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL) AS dismissals
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR bs.player_id = %(player)s)
              {where_sql}
            GROUP BY v.venue_id, v.venue_name, v.city
            ORDER BY runs DESC
            """,
            params,
        )
        rows = cur.fetchall()

    results = []
    for r in rows:
        balls_faced = r["balls_faced"] or 0
        dismissals = r["dismissals"] or 0
        results.append({
            "venue_id": r["venue_id"],
            "venue_name": r["venue_name"],
            "city": r["city"],
            "innings": r["innings"],
            "runs": r["runs"],
            "average": round(r["runs"] / dismissals, 2) if dismissals else None,
            "strike_rate": round(r["runs"] / balls_faced * 100, 2) if balls_faced else 0,
        })
    return results


@router.get("/api/analytics/batting/by-opposition")
def batting_by_opposition(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Runs/average/strike-rate broken down by every opponent faced, for
    components/charts/opposition-analysis.tsx. Excludes the `opponent`
    filter itself -- see module docstring.
    """
    where_sql, params = filters.where(exclude=frozenset({"opponent"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                t_bowl.team_code AS opponent_code,
                t_bowl.team_name AS opponent_name,
                COUNT(DISTINCT bs.innings_id) AS innings,
                COALESCE(SUM(bs.runs), 0) AS runs,
                COALESCE(SUM(bs.balls_faced), 0) AS balls_faced,
                COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL) AS dismissals
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR bs.player_id = %(player)s)
              {where_sql}
            GROUP BY t_bowl.team_code, t_bowl.team_name
            ORDER BY runs DESC
            """,
            params,
        )
        rows = cur.fetchall()

    results = []
    for r in rows:
        balls_faced = r["balls_faced"] or 0
        dismissals = r["dismissals"] or 0
        results.append({
            "opponent_code": r["opponent_code"],
            "opponent_name": r["opponent_name"],
            "innings": r["innings"],
            "runs": r["runs"],
            "average": round(r["runs"] / dismissals, 2) if dismissals else None,
            "strike_rate": round(r["runs"] / balls_faced * 100, 2) if balls_faced else 0,
            "dismissals": dismissals,
        })
    return results


@router.get("/api/analytics/batting/by-phase")
def batting_by_phase(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Powerplay/middle/death split -- runs, strike rate, dismissals, dot%
    and boundary% per phase -- for components/charts/phase-analysis.tsx.
    Excludes the `phase` filter itself -- see module docstring.

    Ball-level (raw_cricsheet.deliveries joined to overs for the
    generated `phase` column), same "balls faced excludes wides"
    convention used everywhere else in this codebase
    (app/routers/players.py's dot-ball query, /api/batter-vs-bowling-type
    above).
    """
    where_sql, params = filters.where(exclude=frozenset({"phase"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                o.phase,
                COALESCE(SUM(d.runs_batter), 0) AS runs,
                COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS balls,
                COUNT(*) FILTER (
                    WHERE d.is_wicket
                      AND (%(player)s IS NULL OR d.dismissed_player_id = %(player)s)
                ) AS dismissals,
                COUNT(*) FILTER (
                    WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.runs_batter = 0
                ) AS dot_balls,
                COUNT(*) FILTER (WHERE d.runs_batter IN (4, 6)) AS boundary_balls
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            {INNINGS_JOINS}
            WHERE (%(player)s IS NULL OR d.striker_id = %(player)s)
              {where_sql}
            GROUP BY o.phase
            """,
            params,
        )
        rows = {r["phase"]: r for r in cur.fetchall()}

    results = []
    for phase in ("powerplay", "middle", "death"):
        r = rows.get(phase)
        balls = (r["balls"] if r else 0) or 0
        runs = (r["runs"] if r else 0) or 0
        dot_balls = (r["dot_balls"] if r else 0) or 0
        boundary_balls = (r["boundary_balls"] if r else 0) or 0
        results.append({
            "phase": phase,
            "runs": runs,
            "balls": balls,
            "strike_rate": round(runs / balls * 100, 2) if balls else 0,
            "dismissals": (r["dismissals"] if r else 0) or 0,
            "dot_percent": round(dot_balls / balls * 100, 2) if balls else 0,
            "boundary_percent": round(boundary_balls / balls * 100, 2) if balls else 0,
        })
    return results


@router.get("/api/analytics/batting/by-batting-order")
def batting_by_batting_order(filters: BattingFilters = Depends(BattingFilters.from_query)):
    """
    Batting-first vs chasing split -- innings, runs, average, strike
    rate, win% -- for components/charts/batting-order-comparison.tsx.
    Excludes the `battingOrder` filter itself -- see module docstring
    (a single-side filter would otherwise zero out the other bar).

    win_percent is evaluated per *match* (winner_team_id = the batting
    side's team for that innings), counted with DISTINCT match_id so
    scorecard rows (one per player) don't inflate the match count.
    """
    where_sql, params = filters.where(exclude=frozenset({"battingOrder"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                i.innings_number,
                COUNT(DISTINCT bs.innings_id) AS innings,
                COALESCE(SUM(bs.runs), 0) AS runs,
                COALESCE(SUM(bs.balls_faced), 0) AS balls_faced,
                COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL) AS dismissals,
                COUNT(DISTINCT m.match_id) AS matches,
                COUNT(DISTINCT m.match_id) FILTER (
                    WHERE m.winner_team_id = i.batting_team_id
                ) AS wins
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            {INNINGS_JOINS}
            WHERE i.innings_number IN (1, 2)
              AND (%(player)s IS NULL OR bs.player_id = %(player)s)
              {where_sql}
            GROUP BY i.innings_number
            """,
            params,
        )
        rows = {r["innings_number"]: r for r in cur.fetchall()}

    def bucket(innings_number: int):
        r = rows.get(innings_number)
        balls_faced = (r["balls_faced"] if r else 0) or 0
        runs = (r["runs"] if r else 0) or 0
        dismissals = (r["dismissals"] if r else 0) or 0
        matches = (r["matches"] if r else 0) or 0
        wins = (r["wins"] if r else 0) or 0
        return {
            "innings": (r["innings"] if r else 0) or 0,
            "runs": runs,
            "average": round(runs / dismissals, 2) if dismissals else None,
            "strike_rate": round(runs / balls_faced * 100, 2) if balls_faced else 0,
            "win_percent": round(wins / matches * 100, 2) if matches else 0,
        }

    return {
        "batting_first": bucket(1),
        "chasing": bucket(2),
    }


# =========================================================
# Bowling Analytics -- frontend/app/(dashboard)/bowling/page.tsx
# =========================================================
#
# Bowling-side mirror of the seven batting-analytics endpoints above.
# Same shared FilterState (see app/utils/bowling_filters.py for the
# season/team/player/... -> SQL-column mapping, which is identical to
# BattingFilters except `team`/`opponent` point at the *bowling* side
# of raw_cricsheet.innings instead of the batting side) so the global
# FilterBar drives every chart on the bowling page the same way it
# drives the batting page.
#
# Bowler-credit convention, used throughout this section: a dismissal
# only counts against a specific bowler when
# match_batting_scorecard.dismissed_by_bowler_id is set, which the ETL
# (scrapers/etl.py's NOT_BOWLER_CREDIT) already leaves NULL for
# run_out/retired_hurt/retired_out/obstructing_field/timed_out -- so
# filtering on that column (rather than re-deriving the exclusion list
# here) is enough to get "this bowler's wickets" right, while an
# unfiltered team-wide view still surfaces every dismissal type
# (including run-outs) that happened while the team was bowling.
#
# Over/economy figures come from raw_cricsheet.match_bowling_scorecard
# (bw) using cricket.py's overs_to_balls_expr/balls_to_overs_str for
# the same reason /api/day-night-split and app/routers/players.py use
# it: overs_bowled is cricket's X.Y notation, not decimal, so summing
# it directly across rows is mathematically wrong. Per-phase figures
# instead come straight from raw_cricsheet.overs, which is already one
# row per *completed legal* over (phase included as a generated
# column) with the bowler-charged runs/wickets pre-computed at ETL
# time -- no byes/leg-byes-vs-noball-penalty ambiguity to resolve
# ball-by-ball the way deliveries.runs_extras would require. Dot-ball
# counts are the one figure that genuinely needs deliveries (no
# ball-count column on overs), using the same "excludes wides" legal
# ball convention already used by batting_by_phase/manhattan above.


@router.get("/api/analytics/bowling/dismissal-types")
def bowling_dismissal_types(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Wickets grouped by how they fell (bowled/caught/lbw/run_out/...),
    for components/charts/dismissal-types.tsx. Scoped to `player` this
    counts only that bowler's own credited dismissals (via
    dismissed_by_bowler_id); unscoped it's every dismissal type
    recorded while the filtered team was bowling, run-outs included.
    """
    where_sql, params = filters.where()
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                bs.dismissal_type AS type,
                COUNT(*) AS count
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            {BOWLING_JOINS}
            WHERE bs.dismissal_type IS NOT NULL
              AND (
                  %(player)s IS NULL
                  OR bs.dismissed_by_bowler_id = %(player)s
              )
              {where_sql}
            GROUP BY bs.dismissal_type
            ORDER BY count DESC
            """,
            params,
        )
        return cur.fetchall()


@router.get("/api/analytics/bowling/economy")
def bowling_economy(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Overall economy rate plus a powerplay/middle/death split, for
    components/charts/economy-analysis.tsx.
    """
    where_sql, params = filters.where()
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR bw.player_id = %(player)s)
              {where_sql}
            """,
            params,
        )
        overall = cur.fetchone()

        cur.execute(
            f"""
            SELECT
                o.phase,
                COUNT(*) AS overs,
                COALESCE(SUM(o.runs_conceded), 0) AS runs_conceded
            FROM raw_cricsheet.overs o
            JOIN raw_cricsheet.innings i ON i.innings_id = o.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR o.bowler_id = %(player)s)
              {where_sql}
            GROUP BY o.phase
            """,
            params,
        )
        phase_rows = {r["phase"]: r for r in cur.fetchall()}

    balls = overall["balls"] or 0
    overall_economy = round(overall["runs_conceded"] / (balls / 6), 2) if balls else 0

    by_phase = []
    for phase in ("powerplay", "middle", "death"):
        r = phase_rows.get(phase)
        overs = (r["overs"] if r else 0) or 0
        runs = (r["runs_conceded"] if r else 0) or 0
        by_phase.append({
            "phase": phase,
            "economy": round(runs / overs, 2) if overs else 0,
            "overs": overs,
        })

    return {
        "overall_economy": overall_economy,
        "by_phase": by_phase,
    }


@router.get("/api/analytics/bowling/dot-balls")
def bowling_dot_balls(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Dot-ball rate overall plus a powerplay/middle/death split, for
    components/charts/dot-ball-analysis.tsx.

    Ball-level (raw_cricsheet.deliveries joined to overs for the
    generated `phase` column) since raw_cricsheet.overs has no
    per-ball granularity to count dots from. "Balls bowled" excludes
    wides only (same legal-ball convention as batting_by_phase/
    manhattan above); a dot ball is any of those with zero total runs
    conceded (byes/leg-byes still put a run on the board, so they're
    not dots, even though they're never charged to the bowler's
    figures).
    """
    where_sql, params = filters.where()
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                o.phase,
                COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS balls_bowled,
                COUNT(*) FILTER (
                    WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.runs_total = 0
                ) AS dot_balls
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR d.bowler_id = %(player)s)
              {where_sql}
            GROUP BY o.phase
            """,
            params,
        )
        rows = cur.fetchall()

    by_phase = []
    total_dot_balls = 0
    total_balls_bowled = 0
    rows_by_phase = {r["phase"]: r for r in rows}
    for phase in ("powerplay", "middle", "death"):
        r = rows_by_phase.get(phase)
        balls_bowled = (r["balls_bowled"] if r else 0) or 0
        dot_balls = (r["dot_balls"] if r else 0) or 0
        total_balls_bowled += balls_bowled
        total_dot_balls += dot_balls
        by_phase.append({
            "phase": phase,
            "dot_balls": dot_balls,
            "balls_bowled": balls_bowled,
        })

    return {
        "total_dot_balls": total_dot_balls,
        "total_balls_bowled": total_balls_bowled,
        "by_phase": by_phase,
    }


@router.get("/api/analytics/bowling/by-venue")
def bowling_by_venue(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Overs/wickets/economy/average broken down by every venue in scope,
    for components/charts/bowling-venue-comparison.tsx. Excludes the
    `venue` filter itself -- see module docstring.
    """
    where_sql, params = filters.where(exclude=frozenset({"venue"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                v.venue_id,
                v.venue_name,
                v.city,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls,
                COALESCE(SUM(bw.wickets), 0) AS wickets,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR bw.player_id = %(player)s)
              {where_sql}
            GROUP BY v.venue_id, v.venue_name, v.city
            ORDER BY wickets DESC
            """,
            params,
        )
        rows = cur.fetchall()

    results = []
    for r in rows:
        balls = r["balls"] or 0
        wickets = r["wickets"] or 0
        runs_conceded = r["runs_conceded"] or 0
        results.append({
            "venue_id": r["venue_id"],
            "venue_name": r["venue_name"],
            "city": r["city"],
            "overs": float(balls_to_overs_str(balls)) if balls else 0,
            "wickets": wickets,
            "economy": round(runs_conceded / (balls / 6), 2) if balls else 0,
            "average": round(runs_conceded / wickets, 2) if wickets else None,
        })
    return results


@router.get("/api/analytics/bowling/by-opposition")
def bowling_by_opposition(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Overs/wickets/economy/average broken down by every opponent faced,
    for components/charts/bowling-opposition-comparison.tsx. Excludes
    the `opponent` filter itself -- see module docstring. `opponent`
    is the *batting* side from the bowling page's perspective (see
    app/utils/bowling_filters.py), so this groups by t_bat.
    """
    where_sql, params = filters.where(exclude=frozenset({"opponent"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                t_bat.team_code AS opponent_code,
                t_bat.team_name AS opponent_name,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls,
                COALESCE(SUM(bw.wickets), 0) AS wickets,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR bw.player_id = %(player)s)
              {where_sql}
            GROUP BY t_bat.team_code, t_bat.team_name
            ORDER BY wickets DESC
            """,
            params,
        )
        rows = cur.fetchall()

    results = []
    for r in rows:
        balls = r["balls"] or 0
        wickets = r["wickets"] or 0
        runs_conceded = r["runs_conceded"] or 0
        results.append({
            "opponent_code": r["opponent_code"],
            "opponent_name": r["opponent_name"],
            "overs": float(balls_to_overs_str(balls)) if balls else 0,
            "wickets": wickets,
            "economy": round(runs_conceded / (balls / 6), 2) if balls else 0,
            "average": round(runs_conceded / wickets, 2) if wickets else None,
        })
    return results


@router.get("/api/analytics/bowling/by-phase")
def bowling_by_phase(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Powerplay/middle/death split -- overs, wickets, economy, average,
    dot% per phase -- for components/charts/bowling-phase-analysis.tsx.
    Excludes the `phase` filter itself -- see module docstring.

    Overs/wickets/economy/average come from raw_cricsheet.overs (one
    row per completed over, bowler-charged runs already resolved at
    ETL time); dot% needs ball-level data since dot balls aren't
    tagged on the overs table, so that half queries
    raw_cricsheet.deliveries the same way /api/analytics/bowling/dot-balls
    does.
    """
    where_sql, params = filters.where(exclude=frozenset({"phase"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                o.phase,
                COUNT(*) AS overs,
                COALESCE(SUM(o.wickets), 0) AS wickets,
                COALESCE(SUM(o.runs_conceded), 0) AS runs_conceded
            FROM raw_cricsheet.overs o
            JOIN raw_cricsheet.innings i ON i.innings_id = o.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR o.bowler_id = %(player)s)
              {where_sql}
            GROUP BY o.phase
            """,
            params,
        )
        over_rows = {r["phase"]: r for r in cur.fetchall()}

        cur.execute(
            f"""
            SELECT
                o.phase,
                COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS balls_bowled,
                COUNT(*) FILTER (
                    WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.runs_total = 0
                ) AS dot_balls
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            {BOWLING_JOINS}
            WHERE (%(player)s IS NULL OR d.bowler_id = %(player)s)
              {where_sql}
            GROUP BY o.phase
            """,
            params,
        )
        dot_rows = {r["phase"]: r for r in cur.fetchall()}

    results = []
    for phase in ("powerplay", "middle", "death"):
        o = over_rows.get(phase)
        d = dot_rows.get(phase)
        overs = (o["overs"] if o else 0) or 0
        wickets = (o["wickets"] if o else 0) or 0
        runs_conceded = (o["runs_conceded"] if o else 0) or 0
        balls_bowled = (d["balls_bowled"] if d else 0) or 0
        dot_balls = (d["dot_balls"] if d else 0) or 0
        results.append({
            "phase": phase,
            "overs": overs,
            "wickets": wickets,
            "economy": round(runs_conceded / overs, 2) if overs else 0,
            "average": round(runs_conceded / wickets, 2) if wickets else None,
            "dot_percent": round(dot_balls / balls_bowled * 100, 2) if balls_bowled else 0,
        })
    return results


@router.get("/api/analytics/bowling/by-bowling-order")
def bowling_by_bowling_order(filters: BowlingFilters = Depends(BowlingFilters.from_query)):
    """
    Bowling-first vs defending split -- overs, wickets, economy,
    average, win% -- for components/charts/bowling-first-vs-defending.tsx.
    Excludes the `battingOrder` filter itself -- see module docstring
    (a single-side filter would otherwise zero out the other bar).

    i.innings_number = 1 means this row's *batting* side batted first,
    which is exactly when the *bowling* side (t_bowl) bowled first --
    so "bowling_first" is innings_number 1 and "defending" (bowling
    second, protecting a total batted first) is innings_number 2.
    win_percent is evaluated per *match* (winner_team_id = the bowling
    side's team for that innings), counted with DISTINCT match_id so
    scorecard rows (one per player) don't inflate the match count.
    """
    where_sql, params = filters.where(exclude=frozenset({"battingOrder"}))
    params["player"] = filters.player

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                i.innings_number,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls,
                COALESCE(SUM(bw.wickets), 0) AS wickets,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded,
                COUNT(DISTINCT m.match_id) AS matches,
                COUNT(DISTINCT m.match_id) FILTER (
                    WHERE m.winner_team_id = i.bowling_team_id
                ) AS wins
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            {BOWLING_JOINS}
            WHERE i.innings_number IN (1, 2)
              AND (%(player)s IS NULL OR bw.player_id = %(player)s)
              {where_sql}
            GROUP BY i.innings_number
            """,
            params,
        )
        rows = {r["innings_number"]: r for r in cur.fetchall()}

    def bucket(innings_number: int):
        r = rows.get(innings_number)
        balls = (r["balls"] if r else 0) or 0
        wickets = (r["wickets"] if r else 0) or 0
        runs_conceded = (r["runs_conceded"] if r else 0) or 0
        matches = (r["matches"] if r else 0) or 0
        wins = (r["wins"] if r else 0) or 0
        return {
            "overs": float(balls_to_overs_str(balls)) if balls else 0,
            "wickets": wickets,
            "economy": round(runs_conceded / (balls / 6), 2) if balls else 0,
            "average": round(runs_conceded / wickets, 2) if wickets else None,
            "win_percent": round(wins / matches * 100, 2) if matches else 0,
        }

    return {
        "bowling_first": bucket(1),
        "defending": bucket(2),
    }
