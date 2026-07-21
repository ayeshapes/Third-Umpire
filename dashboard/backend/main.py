"""
ThirdUmpire dashboard backend -- Matches Overview API.

Serves match results (teams, scores, winner, venue) from your existing
raw_cricsheet schema. Built against the real column names in
sql/psl_schema.sql -- nothing here is guessed.

Run:
    pip install -r requirements.txt
    copy .env.example to .env and fill in your real DATABASE_URL
    uvicorn main:app --reload

Then visit http://127.0.0.1:8000/docs to see/try the API directly.
"""

import os
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in "
        "your Supabase session pooler connection string."
    )

app = FastAPI(title="ThirdUmpire API")

# Dev-friendly CORS -- tighten this if you ever deploy this publicly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/seasons")
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


@app.get("/api/teams")
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


@app.get("/api/matches")
def get_matches(
    season_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    stage: Optional[str] = Query(None),
    limit: int = Query(50, le=357),
    offset: int = Query(0, ge=0),
):
    """
    Matches overview: teams, scores (from innings, matched to the right
    team regardless of batting order), winner, venue, stage.
    """
    query = """
        SELECT
            m.match_id,
            s.season_year,
            m.match_date,
            m.match_number,
            m.stage,
            m.is_day_night,
            m.status,

            t1.team_id   AS team1_id,
            t1.team_name AS team1_name,
            t1.team_code AS team1_code,
            t2.team_id   AS team2_id,
            t2.team_name AS team2_name,
            t2.team_code AS team2_code,

            v.venue_name,
            v.city,

            m.toss_decision,
            tw.team_name AS toss_winner_name,

            m.winner_team_id,
            ww.team_name AS winner_name,
            m.win_margin_runs,
            m.win_margin_wickets,
            m.is_tie,
            m.decided_by_super_over,

            i_t1.total_runs    AS team1_runs,
            i_t1.total_wickets AS team1_wickets,
            i_t1.total_overs   AS team1_overs,
            i_t2.total_runs    AS team2_runs,
            i_t2.total_wickets AS team2_wickets,
            i_t2.total_overs   AS team2_overs

        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1  ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2  ON t2.team_id = m.team2_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        LEFT JOIN raw_cricsheet.teams tw ON tw.team_id = m.toss_winner_team_id
        LEFT JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
        LEFT JOIN raw_cricsheet.innings i_t1
            ON i_t1.match_id = m.match_id AND i_t1.batting_team_id = t1.team_id
        LEFT JOIN raw_cricsheet.innings i_t2
            ON i_t2.match_id = m.match_id AND i_t2.batting_team_id = t2.team_id

        WHERE (%(season_id)s IS NULL OR s.season_id = %(season_id)s)
          AND (%(team_id)s IS NULL OR t1.team_id = %(team_id)s OR t2.team_id = %(team_id)s)
          AND (%(stage)s IS NULL OR m.stage = %(stage)s)

        ORDER BY m.match_date DESC, m.match_id DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """
    params = {
        "season_id": season_id,
        "team_id": team_id,
        "stage": stage,
        "limit": limit,
        "offset": offset,
    }
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE (%(season_id)s IS NULL OR s.season_id = %(season_id)s)
              AND (%(team_id)s IS NULL OR m.team1_id = %(team_id)s OR m.team2_id = %(team_id)s)
              AND (%(stage)s IS NULL OR m.stage = %(stage)s)
            """,
            params,
        )
        total = cur.fetchone()["total"]

    return {"total": total, "count": len(rows), "matches": rows}


@app.get("/api/players/search")
def search_players(q: str = Query(..., min_length=2)):
    """Autocomplete search for the player stats explorer."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT player_id, full_name, display_name, nationality, primary_role
            FROM raw_cricsheet.players
            WHERE full_name ILIKE %(pattern)s OR display_name ILIKE %(pattern)s
            ORDER BY full_name
            LIMIT 15
            """,
            {"pattern": f"%{q}%"},
        )
        return cur.fetchall()


def _overs_to_balls_expr(column: str) -> str:
    """
    overs_bowled is stored in cricket's X.Y over notation (e.g. 3.4 means
    3 overs + 4 balls = 22 balls), NOT decimal overs. Summing it directly
    across innings would be mathematically wrong (3.4 + 3.4 != 7.2 overs
    in real balls -- it's 44 balls = 7.2 overs, which happens to work out
    here, but e.g. 3.5 + 3.5 = 44 balls = 7.2 overs, not 7.10). Converting
    to balls first, summing, then converting back is the only correct way.
    """
    return f"(FLOOR({column}) * 6 + ROUND(({column} - FLOOR({column})) * 10))"


@app.get("/api/players/{player_id}")
def get_player(player_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT player_id, full_name, display_name, nationality,
                   date_of_birth, primary_role, batting_hand, bowling_arm,
                   bowler_type, bowling_subtype
            FROM raw_cricsheet.players
            WHERE player_id = %(player_id)s
            """,
            {"player_id": player_id},
        )
        player = cur.fetchone()
        if not player:
            return {"error": "player not found"}

        cur.execute(
            """
            SELECT
                COUNT(DISTINCT bs.innings_id) AS innings_batted,
                COALESCE(SUM(bs.runs), 0)          AS total_runs,
                COALESCE(SUM(bs.balls_faced), 0)   AS total_balls_faced,
                COALESCE(SUM(bs.fours), 0)         AS total_fours,
                COALESCE(SUM(bs.sixes), 0)         AS total_sixes,
                COUNT(*) FILTER (WHERE bs.runs >= 50 AND bs.runs < 100) AS fifties,
                COUNT(*) FILTER (WHERE bs.runs >= 100)                 AS hundreds,
                COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL)  AS times_out
            FROM raw_cricsheet.match_batting_scorecard bs
            WHERE bs.player_id = %(player_id)s
            """,
            {"player_id": player_id},
        )
        batting = cur.fetchone()

        cur.execute(
            """
            SELECT bs.runs, (bs.dismissal_type IS NULL) AS not_out
            FROM raw_cricsheet.match_batting_scorecard bs
            WHERE bs.player_id = %(player_id)s
            ORDER BY bs.runs DESC, (bs.dismissal_type IS NULL) DESC
            LIMIT 1
            """,
            {"player_id": player_id},
        )
        highest_score_row = cur.fetchone()

        cur.execute(
            f"""
            SELECT
                COUNT(*) AS innings_bowled,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS total_balls,
                COALESCE(SUM(bw.runs_conceded), 0) AS total_runs_conceded,
                COALESCE(SUM(bw.wickets), 0)       AS total_wickets,
                COALESCE(SUM(bw.maidens), 0)       AS total_maidens,
                COUNT(*) FILTER (WHERE bw.wickets >= 4) AS four_wicket_hauls,
                COUNT(*) FILTER (WHERE bw.wickets >= 5) AS five_wicket_hauls
            FROM raw_cricsheet.match_bowling_scorecard bw
            WHERE bw.player_id = %(player_id)s
            """,
            {"player_id": player_id},
        )
        bowling = cur.fetchone()

        cur.execute(
            """
            SELECT wickets, runs_conceded
            FROM raw_cricsheet.match_bowling_scorecard
            WHERE player_id = %(player_id)s
            ORDER BY wickets DESC, runs_conceded ASC
            LIMIT 1
            """,
            {"player_id": player_id},
        )
        best_figures_row = cur.fetchone()

    # --- derive rate stats in Python, guarding every divide-by-zero ---
    total_balls_faced = batting["total_balls_faced"] or 0
    times_out = batting["times_out"] or 0
    strike_rate = (
        round(batting["total_runs"] / total_balls_faced * 100, 2)
        if total_balls_faced else None
    )
    batting_average = (
        round(batting["total_runs"] / times_out, 2) if times_out else None
    )

    total_balls_bowled = bowling["total_balls"] or 0
    total_wickets = bowling["total_wickets"] or 0
    career_overs_bowled = f"{total_balls_bowled // 6}.{total_balls_bowled % 6}"
    economy = (
        round(bowling["total_runs_conceded"] / (total_balls_bowled / 6), 2)
        if total_balls_bowled else None
    )
    bowling_average = (
        round(bowling["total_runs_conceded"] / total_wickets, 2)
        if total_wickets else None
    )

    return {
        "player": player,
        "batting": {
            "innings": batting["innings_batted"],
            "runs": batting["total_runs"],
            "highest_score": (
                f"{highest_score_row['runs']}{'*' if highest_score_row['not_out'] else ''}"
                if highest_score_row else None
            ),
            "average": batting_average,
            "strike_rate": strike_rate,
            "fifties": batting["fifties"],
            "hundreds": batting["hundreds"],
            "fours": batting["total_fours"],
            "sixes": batting["total_sixes"],
        },
        "bowling": {
            "innings": bowling["innings_bowled"],
            "overs": career_overs_bowled if total_balls_bowled else None,
            "wickets": total_wickets,
            "best_figures": (
                f"{best_figures_row['wickets']}/{best_figures_row['runs_conceded']}"
                if best_figures_row and total_wickets else None
            ),
            "average": bowling_average,
            "economy": economy,
            "maidens": bowling["total_maidens"],
            "four_wicket_hauls": bowling["four_wicket_hauls"],
            "five_wicket_hauls": bowling["five_wicket_hauls"],
        },
    }