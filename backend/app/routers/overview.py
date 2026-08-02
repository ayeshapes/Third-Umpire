"""
ThirdUmpire API -- overview router.

NOTE: this router is new -- it did not exist in the original
dashboard/backend/main.py. The Next.js Overview Dashboard and landing
page need a handful of league-wide totals (total matches/players/teams/
runs/wickets, best team win %) that no single existing endpoint returns
together. Rather than have the frontend stitch this together from five
separate calls, this adds one small, read-only aggregation endpoint in
the same style (and against the same raw_cricsheet schema) as the rest
of the API.
"""

from fastapi import APIRouter

from app.database.connection import get_conn

router = APIRouter(tags=["overview"])


@router.get("/api/overview")
def get_overview():
    """League-wide totals for KPI cards on the landing page and dashboard."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM raw_cricsheet.matches")
        total_matches = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM raw_cricsheet.players")
        total_players = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM raw_cricsheet.teams")
        total_teams = cur.fetchone()["total"]

        cur.execute("SELECT COALESCE(SUM(runs), 0) AS total FROM raw_cricsheet.match_batting_scorecard")
        total_runs = cur.fetchone()["total"]

        cur.execute("SELECT COALESCE(SUM(wickets), 0) AS total FROM raw_cricsheet.match_bowling_scorecard")
        total_wickets = cur.fetchone()["total"]

        cur.execute(
            """
            SELECT
                p.player_id, p.display_name, p.full_name,
                ROUND(SUM(bs.runs)::numeric / NULLIF(SUM(bs.balls_faced), 0) * 100, 2) AS strike_rate
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
            GROUP BY p.player_id, p.display_name, p.full_name
            HAVING SUM(bs.balls_faced) >= 200
            ORDER BY strike_rate DESC NULLS LAST
            LIMIT 1
            """
        )
        strike_rate_leader = cur.fetchone()

        cur.execute(
            """
            WITH team_matches AS (
                SELECT team1_id AS team_id, match_id FROM raw_cricsheet.matches
                UNION ALL
                SELECT team2_id AS team_id, match_id FROM raw_cricsheet.matches
            )
            SELECT
                t.team_id, t.team_name,
                COUNT(tm.match_id) AS played,
                COUNT(*) FILTER (WHERE m.winner_team_id = t.team_id) AS won,
                ROUND(
                    COUNT(*) FILTER (WHERE m.winner_team_id = t.team_id)::numeric
                    / NULLIF(COUNT(tm.match_id), 0) * 100, 1
                ) AS win_pct
            FROM team_matches tm
            JOIN raw_cricsheet.teams t ON t.team_id = tm.team_id
            JOIN raw_cricsheet.matches m ON m.match_id = tm.match_id
            GROUP BY t.team_id, t.team_name
            HAVING COUNT(tm.match_id) >= 10
            ORDER BY win_pct DESC NULLS LAST
            LIMIT 1
            """
        )
        most_successful_team = cur.fetchone()

    return {
        "total_matches": total_matches,
        "total_players": total_players,
        "total_teams": total_teams,
        "total_runs": total_runs,
        "total_wickets": total_wickets,
        "strike_rate_leader": strike_rate_leader,
        "most_successful_team": most_successful_team,
    }
