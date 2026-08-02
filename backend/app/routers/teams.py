"""
ThirdUmpire API -- teams router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

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
    team_a_id: int = Query(...),
    team_b_id: int = Query(...),
):
    with get_conn() as conn, conn.cursor() as cur:

        # Overall record
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_matches,
                COUNT(*) FILTER (WHERE winner_team_id = %(a)s) AS team_a_wins,
                COUNT(*) FILTER (WHERE winner_team_id = %(b)s) AS team_b_wins,
                COUNT(*) FILTER (WHERE is_tie) AS ties,
                COUNT(*) FILTER (WHERE winner_team_id IS NULL AND NOT is_tie) AS no_results
            FROM raw_cricsheet.matches
            WHERE (team1_id = %(a)s AND team2_id = %(b)s)
               OR (team1_id = %(b)s AND team2_id = %(a)s)
            """,
            {"a": team_a_id, "b": team_b_id},
        )
        record = cur.fetchone()

        # Batting numbers, scoped to this matchup only
        cur.execute(
            """
            SELECT
                i.batting_team_id AS team_id,
                COUNT(*)              AS innings,
                ROUND(AVG(i.total_runs), 1) AS avg_score,
                MAX(i.total_runs)     AS highest_score,
                MIN(i.total_runs)     AS lowest_score
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            WHERE ((m.team1_id = %(a)s AND m.team2_id = %(b)s)
                OR (m.team1_id = %(b)s AND m.team2_id = %(a)s))
              AND i.batting_team_id IN (%(a)s, %(b)s)
            GROUP BY i.batting_team_id
            """,
            {"a": team_a_id, "b": team_b_id},
        )
        batting_rows = {r["team_id"]: r for r in cur.fetchall()}

        # Biggest win margins, per team, by runs and by wickets
        def biggest_margin(team_id, column):
            cur.execute(
                f"""
                SELECT match_date, {column} AS margin, s.season_year, ww.team_name AS beaten_team
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
                JOIN raw_cricsheet.teams ww
                    ON ww.team_id = (CASE WHEN m.team1_id = m.winner_team_id THEN m.team2_id ELSE m.team1_id END)
                WHERE m.winner_team_id = %(team_id)s
                  AND {column} IS NOT NULL
                  AND ((m.team1_id = %(a)s AND m.team2_id = %(b)s)
                    OR (m.team1_id = %(b)s AND m.team2_id = %(a)s))
                ORDER BY {column} DESC
                LIMIT 1
                """,
                {"team_id": team_id, "a": team_a_id, "b": team_b_id},
            )
            return cur.fetchone()

        margins = {
            "a_by_runs": biggest_margin(team_a_id, "win_margin_runs"),
            "a_by_wkts": biggest_margin(team_a_id, "win_margin_wickets"),
            "b_by_runs": biggest_margin(team_b_id, "win_margin_runs"),
            "b_by_wkts": biggest_margin(team_b_id, "win_margin_wickets"),
        }

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
            {"a": team_a_id, "b": team_b_id},
        )
        recent = cur.fetchall()

    return {
        "record": record,
        "batting": {"a": batting_rows.get(team_a_id), "b": batting_rows.get(team_b_id)},
        "margins": margins,
        "recent_meetings": recent,
    }

# =========================================================
# Leaderboards (Leaderboards)
# =========================================================
