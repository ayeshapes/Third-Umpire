"""
ThirdUmpire API -- seasons router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

router = APIRouter(tags=["seasons"])


@router.get("/api/seasons")
def get_seasons():
    """For populating the season filter dropdown."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT season_id, season_year
            FROM raw_cricsheet.seasons
            ORDER BY season_year DESC
            """
        )
        return cur.fetchall()


@router.get("/api/season-awards")
def season_awards(season_id: Optional[int] = Query(None)):
    with get_conn() as conn, conn.cursor() as cur:

        def fetch_all(view_name):
            cur.execute(
                f"""
                SELECT * FROM raw_cricsheet.{view_name}
                WHERE (%(season_id)s IS NULL OR season_id = %(season_id)s)
                ORDER BY season_year
                """,
                {"season_id": season_id},
            )
            return cur.fetchall()

        top_batter = fetch_all("v_season_top_batter")
        top_bowler = fetch_all("v_season_top_bowler")
        top_fielder = fetch_all("v_season_top_fielder")
        top_wicketkeeper = fetch_all("v_season_top_wicketkeeper")
        player_of_season = fetch_all("v_season_player_of_season")

    return {
        "batter_of_the_season": top_batter,
        "bowler_of_the_season": top_bowler,
        "fielder_of_the_season": top_fielder,
        "wicketkeeper_of_the_season": top_wicketkeeper,
        # flagged in the response itself, not just in a comment, so the
        # frontend can't accidentally present this as an official award
        "player_of_the_season_custom": {
            "note": "Custom composite score (1 pt/run + 20 pts/wicket + 10 pts/fielding dismissal). "
                     "Not an official PSL award or designation.",
            "results": player_of_season,
        },
    }
# =========================================================
# Single Match Detail
# =========================================================


@router.get("/api/seasons/compare")
def compare_seasons(season_a_id: int = Query(...), season_b_id: int = Query(...)):
    def season_summary(season_id):
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(DISTINCT m.match_id) AS matches_played,
                    ROUND(AVG(i.total_runs), 1) AS avg_first_innings_score
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.innings i
                    ON i.match_id = m.match_id AND i.innings_number = 1
                WHERE m.season_id = %(season_id)s
                """,
                {"season_id": season_id},
            )
            headline = cur.fetchone()

            cur.execute(
                """
                SELECT
                    COALESCE(SUM(bs.sixes), 0) AS total_sixes,
                    COALESCE(SUM(bs.fours), 0) AS total_fours,
                    COUNT(*) FILTER (WHERE bs.runs >= 100) AS hundreds
                FROM raw_cricsheet.match_batting_scorecard bs
                JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                WHERE m.season_id = %(season_id)s
                """,
                {"season_id": season_id},
            )
            hitting = cur.fetchone()

            cur.execute(
                """
                SELECT i.total_runs, t.team_name
                FROM raw_cricsheet.innings i
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
                WHERE m.season_id = %(season_id)s
                ORDER BY i.total_runs DESC
                LIMIT 1
                """,
                {"season_id": season_id},
            )
            highest_total = cur.fetchone()

            cur.execute(
                """
                SELECT t.team_name, COUNT(*) AS wins
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.teams t ON t.team_id = m.winner_team_id
                WHERE m.season_id = %(season_id)s
                GROUP BY t.team_name
                ORDER BY wins DESC
                LIMIT 1
                """,
                {"season_id": season_id},
            )
            most_wins = cur.fetchone()

        return {
            "matches_played": headline["matches_played"],
            "avg_first_innings_score": headline["avg_first_innings_score"],
            "total_sixes": hitting["total_sixes"],
            "total_fours": hitting["total_fours"],
            "hundreds": hitting["hundreds"],
            "highest_total": (
                f"{highest_total['total_runs']} ({highest_total['team_name']})"
                if highest_total else None
            ),
            "most_wins": (
                f"{most_wins['team_name']} ({most_wins['wins']})"
                if most_wins else None
            ),
        }

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT season_id, season_year FROM raw_cricsheet.seasons WHERE season_id IN (%(a)s, %(b)s)",
            {"a": season_a_id, "b": season_b_id},
        )
        season_names = {r["season_id"]: r["season_year"] for r in cur.fetchall()}

    return {
        "season_a": {"season_year": season_names.get(season_a_id), **season_summary(season_a_id)},
        "season_b": {"season_year": season_names.get(season_b_id), **season_summary(season_b_id)},
    }


# =========================================================
# Day vs Night Performance Split
# =========================================================
# Used by day-night.html. Splits batting and bowling numbers, plus
# overall match shape, by matches.is_day_night. Matches with
# is_day_night IS NULL (unknown) are excluded from both buckets rather
# than silently lumped into one. team_id is optional -- when given, every
# number is scoped to that team's own batting/bowling and matches played
# (this merges what were two separate, conflicting implementations of
# this endpoint in the fragment files into one that supports both).


@router.get("/api/league-evolution")
def league_evolution():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM raw_cricsheet.v_league_evolution ORDER BY season_year")
        return cur.fetchall()


# =========================================================
# Data Quality Dashboard
# =========================================================
# Used by quality.html. These are integrity/completeness checks, not
# analytics -- a non-zero failing_rows count means something is worth
# looking at, it doesn't necessarily mean the data is broken (e.g. a
# missing wicketkeeper tag just means that team/match hasn't been
# tagged yet, not that the match_squads row is wrong).
