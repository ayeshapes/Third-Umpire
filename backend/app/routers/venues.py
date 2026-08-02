"""
ThirdUmpire API -- venues router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

router = APIRouter(tags=["venues"])


@router.get("/api/venues")
def get_venues():
    """List every venue with its pitch-profile numbers, for the venue grid."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.venue_id,
                v.venue_name,
                v.city,
                v.country,
                v.boundary_length_m,
                v.latitude,
                v.longitude,
                COALESCE(mc.match_count, 0)      AS match_count,
                vp.avg_first_innings_score,
                vp.boundary_pct_of_balls,
                vp.spin_wicket_pct,
                vp.chase_success_pct
            FROM raw_cricsheet.venues v
            LEFT JOIN raw_cricsheet.v_venue_pitch_profile vp
                ON vp.venue_id = v.venue_id
            LEFT JOIN (
                SELECT venue_id, COUNT(*) AS match_count
                FROM raw_cricsheet.matches
                GROUP BY venue_id
            ) mc ON mc.venue_id = v.venue_id
            ORDER BY v.venue_name
            """
        )
        return cur.fetchall()


@router.get("/api/venues/{venue_id}")
def get_venue(venue_id: int):
    """
    Single venue detail: pitch profile, all-time records (from
    v_venue_records), and the last handful of matches played there.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.venue_id,
                v.venue_name,
                v.city,
                v.country,
                v.boundary_length_m,
                v.latitude,
                v.longitude,
                COALESCE(mc.match_count, 0)      AS match_count,
                vp.avg_first_innings_score,
                vp.boundary_pct_of_balls,
                vp.spin_wicket_pct,
                vp.chase_success_pct
            FROM raw_cricsheet.venues v
            LEFT JOIN raw_cricsheet.v_venue_pitch_profile vp
                ON vp.venue_id = v.venue_id
            LEFT JOIN (
                SELECT venue_id, COUNT(*) AS match_count
                FROM raw_cricsheet.matches
                WHERE venue_id = %(venue_id)s
                GROUP BY venue_id
            ) mc ON mc.venue_id = v.venue_id
            WHERE v.venue_id = %(venue_id)s
            """,
            {"venue_id": venue_id},
        )
        venue = cur.fetchone()
        if not venue:
            return {"error": "venue not found"}

        cur.execute(
            """
            SELECT
                highest_successful_chase,
                lowest_successful_chase,
                highest_successful_defense,
                lowest_successful_defense,
                total_runs_at_venue
            FROM raw_cricsheet.v_venue_records
            WHERE venue_id = %(venue_id)s
            """,
            {"venue_id": venue_id},
        )
        records = cur.fetchone()

        cur.execute(
            """
            SELECT
                m.match_id,
                s.season_year,
                m.match_date,
                m.stage,
                t1.team_name AS team1_name,
                t2.team_name AS team2_name,
                ww.team_name AS winner_name,
                m.win_margin_runs,
                m.win_margin_wickets,
                m.is_tie,
                i_t1.total_runs    AS team1_runs,
                i_t1.total_wickets AS team1_wickets,
                i_t2.total_runs    AS team2_runs,
                i_t2.total_wickets AS team2_wickets
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.teams t1  ON t1.team_id = m.team1_id
            JOIN raw_cricsheet.teams t2  ON t2.team_id = m.team2_id
            LEFT JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
            LEFT JOIN raw_cricsheet.innings i_t1
                ON i_t1.match_id = m.match_id AND i_t1.batting_team_id = t1.team_id
            LEFT JOIN raw_cricsheet.innings i_t2
                ON i_t2.match_id = m.match_id AND i_t2.batting_team_id = t2.team_id
            WHERE m.venue_id = %(venue_id)s
            ORDER BY m.match_date DESC, m.match_id DESC
            LIMIT 8
            """,
            {"venue_id": venue_id},
        )
        recent_matches = cur.fetchall()

    return {
        "venue": venue,
        "records": records,
        "recent_matches": recent_matches,
    }

# =========================================================
# Team Head-to-Head
# =========================================================
