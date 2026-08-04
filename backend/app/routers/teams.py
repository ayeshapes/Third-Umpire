"""
ThirdUmpire API -- teams router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from fastapi import APIRouter, Query

from app.database.connection import get_conn
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr

router = APIRouter(tags=["teams"])


@router.get("/api/teams")
def get_teams():
    """For populating the team filter dropdown."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT team_id, team_name, team_code
            FROM raw_cricsheet.teams
            ORDER BY team_name
            """
        )
        return cur.fetchall()


@router.get("/api/teams/head-to-head")
def teams_head_to_head(
    team1_id: int = Query(...),
    team2_id: int = Query(...),
):
    """
    Team Comparison: everything the Team Comparison page needs for a
    Team A vs Team B matchup -- overall + venue-by-venue record, batting
    (highest/lowest-defended/average/boundaries) and bowling (wickets/
    economy) numbers, scoped to matches between just these two teams.
    """
    a, b = team1_id, team2_id
    with get_conn() as conn, conn.cursor() as cur:

        # Overall record
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_matches,
                COUNT(*) FILTER (WHERE winner_team_id = %(a)s) AS team1_wins,
                COUNT(*) FILTER (WHERE winner_team_id = %(b)s) AS team2_wins,
                COUNT(*) FILTER (WHERE is_tie) AS ties,
                COUNT(*) FILTER (WHERE winner_team_id IS NULL AND NOT is_tie) AS no_results
            FROM raw_cricsheet.matches
            WHERE (team1_id = %(a)s AND team2_id = %(b)s)
               OR (team1_id = %(b)s AND team2_id = %(a)s)
            """,
            {"a": a, "b": b},
        )
        record = cur.fetchone()

        # Wins broken down by venue, so the page can show "who owns this
        # ground" for the matchup rather than just the overall record.
        cur.execute(
            """
            SELECT
                v.venue_id, v.venue_name,
                COUNT(*) FILTER (WHERE m.winner_team_id = %(a)s) AS team1_wins,
                COUNT(*) FILTER (WHERE m.winner_team_id = %(b)s) AS team2_wins,
                COUNT(*) AS matches
            FROM raw_cricsheet.matches m
            LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
            WHERE (m.team1_id = %(a)s AND m.team2_id = %(b)s)
               OR (m.team1_id = %(b)s AND m.team2_id = %(a)s)
            GROUP BY v.venue_id, v.venue_name
            ORDER BY matches DESC
            """,
            {"a": a, "b": b},
        )
        venue_wins = cur.fetchall()

        # Batting numbers, scoped to this matchup only: average/highest
        # score, plus the lowest total that still won while defending
        # (batted first, i.e. innings_number = 1, and won the match).
        cur.execute(
            """
            SELECT
                i.batting_team_id AS team_id,
                COUNT(*)              AS innings,
                ROUND(AVG(i.total_runs), 1) AS avg_score,
                MAX(i.total_runs)     AS highest_score,
                MIN(i.total_runs) FILTER (
                    WHERE i.innings_number = 1 AND m.winner_team_id = i.batting_team_id
                ) AS lowest_defended_score,
                COUNT(*) FILTER (WHERE i.innings_number = 2) AS chases_batted,
                COUNT(*) FILTER (
                    WHERE i.innings_number = 2 AND m.winner_team_id = i.batting_team_id
                ) AS chases_won,
                COALESCE(SUM(bs.fours), 0) AS fours,
                COALESCE(SUM(bs.sixes), 0) AS sixes,
                COALESCE(SUM(bs.balls_faced), 0) AS balls_faced
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.match_batting_scorecard bs ON bs.innings_id = i.innings_id
            WHERE ((m.team1_id = %(a)s AND m.team2_id = %(b)s)
                OR (m.team1_id = %(b)s AND m.team2_id = %(a)s))
              AND i.batting_team_id IN (%(a)s, %(b)s)
            GROUP BY i.batting_team_id
            """,
            {"a": a, "b": b},
        )
        batting_rows = {r["team_id"]: r for r in cur.fetchall()}

        # Bowling numbers, scoped to this matchup: wickets + economy per
        # team while they were the bowling side.
        cur.execute(
            f"""
            SELECT
                i.bowling_team_id AS team_id,
                COALESCE(SUM(bw.wickets), 0) AS wickets,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls_bowled
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.match_bowling_scorecard bw ON bw.innings_id = i.innings_id
            WHERE ((m.team1_id = %(a)s AND m.team2_id = %(b)s)
                OR (m.team1_id = %(b)s AND m.team2_id = %(a)s))
              AND i.bowling_team_id IN (%(a)s, %(b)s)
            GROUP BY i.bowling_team_id
            """,
            {"a": a, "b": b},
        )
        bowling_rows = {r["team_id"]: r for r in cur.fetchall()}

        # Recent meetings
        cur.execute(
            """
            SELECT
                m.match_id, s.season_year, m.match_date, m.stage,
                t1.team_name AS team1_name, t2.team_name AS team2_name,
                ww.team_name AS winner_name,
                m.win_margin_runs, m.win_margin_wickets, m.is_tie,
                v.venue_name,
                i_t1.total_runs AS team1_runs, i_t1.total_wickets AS team1_wickets,
                i_t2.total_runs AS team2_runs, i_t2.total_wickets AS team2_wickets
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.teams t1  ON t1.team_id = m.team1_id
            JOIN raw_cricsheet.teams t2  ON t2.team_id = m.team2_id
            LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
            LEFT JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
            LEFT JOIN raw_cricsheet.innings i_t1
                ON i_t1.match_id = m.match_id AND i_t1.batting_team_id = t1.team_id
            LEFT JOIN raw_cricsheet.innings i_t2
                ON i_t2.match_id = m.match_id AND i_t2.batting_team_id = t2.team_id
            WHERE (m.team1_id = %(a)s AND m.team2_id = %(b)s)
               OR (m.team1_id = %(b)s AND m.team2_id = %(a)s)
            ORDER BY m.match_date DESC, m.match_id DESC
            LIMIT 8
            """,
            {"a": a, "b": b},
        )
        recent = cur.fetchall()

    def batting_summary(team_id):
        r = batting_rows.get(team_id)
        if not r:
            return None
        balls_faced = r["balls_faced"] or 0
        chases_batted = r["chases_batted"] or 0
        boundaries = (r["fours"] or 0) + (r["sixes"] or 0)
        return {
            "innings": r["innings"],
            "average_score": float(r["avg_score"]) if r["avg_score"] is not None else None,
            "highest_score": r["highest_score"],
            "lowest_defended_score": r["lowest_defended_score"],
            "chase_success_pct": (
                round(r["chases_won"] / chases_batted * 100, 1) if chases_batted else None
            ),
            "fours": r["fours"],
            "sixes": r["sixes"],
            "boundary_pct": round(boundaries / balls_faced * 100, 2) if balls_faced else None,
        }

    def bowling_summary(team_id):
        r = bowling_rows.get(team_id)
        if not r:
            return None
        balls_bowled = r["balls_bowled"] or 0
        return {
            "wickets": r["wickets"],
            "economy": round(r["runs_conceded"] / (balls_bowled / 6), 2) if balls_bowled else None,
        }

    return {
        "record": record,
        "venue_wins": venue_wins,
        "batting": {"team1": batting_summary(a), "team2": batting_summary(b)},
        "bowling": {"team1": bowling_summary(a), "team2": bowling_summary(b)},
        "recent_meetings": recent,
    }

# =========================================================
# Leaderboards (Leaderboards)
# =========================================================
