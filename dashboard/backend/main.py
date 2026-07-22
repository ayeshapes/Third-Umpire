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


# =========================================================
# Venue / Pitch Conditions
# =========================================================
#
# The "conditions" numbers (avg first-innings score, boundary %,
# spin-wicket %, chase-success %) are never stored -- they come
# straight from raw_cricsheet.v_venue_pitch_profile, which is computed
# live from deliveries/innings/matches. These endpoints just shape
# that view (plus venues + a match count) for the dashboard.


@app.get("/api/venues")
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


@app.get("/api/venues/{venue_id}")
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

@app.get("/api/teams/head-to-head")
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

@app.get("/api/leaderboards")
def leaderboards(season_id: Optional[int] = Query(None), limit: int = Query(15, le=50)):
    """
    Top run-scorers and top wicket-takers. Pass season_id for a single
    season's leaderboard (the classic season leaderboard), or omit it
    for all-time career totals.
    """
    with get_conn() as conn, conn.cursor() as cur:

        cur.execute(
            """
            SELECT
                p.player_id, p.display_name, p.full_name,
                SUM(bs.runs) AS total_runs,
                COUNT(*) AS innings,
                ROUND(
                    SUM(bs.runs)::numeric
                    / NULLIF(COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL), 0),
                    2
                ) AS average,
                ROUND(
                    SUM(bs.runs)::numeric / NULLIF(SUM(bs.balls_faced), 0) * 100,
                    2
                ) AS strike_rate,
                COUNT(*) FILTER (WHERE bs.runs >= 100) AS hundreds,
                COUNT(*) FILTER (WHERE bs.runs >= 50 AND bs.runs < 100) AS fifties
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
            WHERE (%(season_id)s IS NULL OR m.season_id = %(season_id)s)
            GROUP BY p.player_id, p.display_name, p.full_name
            ORDER BY total_runs DESC
            LIMIT %(limit)s
            """,
            {"season_id": season_id, "limit": limit},
        )
        top_run_scorers = cur.fetchall()

        # Same balls-from-overs-notation conversion used in /api/players/{id}
        # -- overs_bowled is X.Y over notation (balls), not decimal, so a
        # naive SUM() across innings would silently be wrong.
        cur.execute(
            """
            SELECT
                p.player_id, p.display_name, p.full_name,
                SUM(bw.wickets) AS total_wickets,
                COUNT(*) AS innings,
                SUM(FLOOR(bw.overs_bowled) * 6 + ROUND((bw.overs_bowled - FLOOR(bw.overs_bowled)) * 10)) AS total_balls,
                SUM(bw.runs_conceded) AS total_runs_conceded,
                COUNT(*) FILTER (WHERE bw.wickets >= 4) AS four_wicket_hauls,
                COUNT(*) FILTER (WHERE bw.wickets >= 5) AS five_wicket_hauls
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
            WHERE (%(season_id)s IS NULL OR m.season_id = %(season_id)s)
            GROUP BY p.player_id, p.display_name, p.full_name
            ORDER BY total_wickets DESC
            LIMIT %(limit)s
            """,
            {"season_id": season_id, "limit": limit},
        )
        top_wicket_takers_raw = cur.fetchall()

    top_wicket_takers = []
    for row in top_wicket_takers_raw:
        total_balls = row["total_balls"] or 0
        total_wickets = row["total_wickets"] or 0
        economy = (
            round(row["total_runs_conceded"] / (total_balls / 6), 2)
            if total_balls else None
        )
        bowling_average = (
            round(row["total_runs_conceded"] / total_wickets, 2)
            if total_wickets else None
        )
        top_wicket_takers.append({
            "player_id": row["player_id"],
            "display_name": row["display_name"],
            "full_name": row["full_name"],
            "total_wickets": total_wickets,
            "innings": row["innings"],
            "overs": f"{total_balls // 6}.{total_balls % 6}",
            "economy": economy,
            "average": bowling_average,
            "four_wicket_hauls": row["four_wicket_hauls"],
            "five_wicket_hauls": row["five_wicket_hauls"],
        })

    # NOTE: keys are orange_cap/purple_cap (not top_run_scorers/top_wicket_takers)
    # because that's the response shape leaderboards.html actually consumes.
    return {"orange_cap": top_run_scorers, "purple_cap": top_wicket_takers}


# =========================================================
# Toss Decision Impact
# =========================================================

@app.get("/api/toss-impact")
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

@app.get("/api/season-awards")
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

@app.get("/api/matches/{match_id}/detail")
def match_detail(match_id: int):
    with get_conn() as conn, conn.cursor() as cur:

        cur.execute(
            """
            SELECT
                m.match_id, s.season_year, m.match_date, m.match_number, m.stage,
                m.is_day_night, m.status, m.is_dls_affected,
                t1.team_id AS team1_id, t1.team_name AS team1_name,
                t2.team_id AS team2_id, t2.team_name AS team2_name,
                v.venue_name, v.city,
                m.toss_decision, tw.team_name AS toss_winner_name,
                m.winner_team_id, ww.team_name AS winner_name,
                m.win_margin_runs, m.win_margin_wickets, m.is_tie, m.decided_by_super_over,
                pom.display_name AS player_of_match_name
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.teams t1  ON t1.team_id = m.team1_id
            JOIN raw_cricsheet.teams t2  ON t2.team_id = m.team2_id
            LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
            LEFT JOIN raw_cricsheet.teams tw ON tw.team_id = m.toss_winner_team_id
            LEFT JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
            LEFT JOIN raw_cricsheet.players pom ON pom.player_id = m.player_of_match_id
            WHERE m.match_id = %(match_id)s
            """,
            {"match_id": match_id},
        )
        match = cur.fetchone()
        if not match:
            return {"error": "match not found"}

        cur.execute(
            """
            SELECT innings_id, innings_number, batting_team_id, bowling_team_id,
                   total_runs, total_wickets, total_overs
            FROM raw_cricsheet.innings
            WHERE match_id = %(match_id)s
            ORDER BY innings_number
            """,
            {"match_id": match_id},
        )
        innings_rows = cur.fetchall()

        innings_out = []
        for inn in innings_rows:
            innings_id = inn["innings_id"]

            # Over-by-over progression for the worm/manhattan chart.
            cur.execute(
                """
                SELECT over_number, runs_conceded, wickets,
                       SUM(runs_conceded) OVER (ORDER BY over_number) AS cumulative_runs,
                       SUM(wickets) OVER (ORDER BY over_number)       AS cumulative_wickets
                FROM raw_cricsheet.overs
                WHERE innings_id = %(innings_id)s
                ORDER BY over_number
                """,
                {"innings_id": innings_id},
            )
            worm = cur.fetchall()

            # Batting scorecard, in batting order.
            cur.execute(
                """
                SELECT bs.batting_position, p.player_id, p.display_name, p.full_name,
                       bs.runs, bs.balls_faced, bs.fours, bs.sixes, bs.strike_rate,
                       bs.dismissal_type,
                       bowler.display_name AS dismissed_by_bowler_name,
                       fielder.display_name AS caught_by_fielder_name
                FROM raw_cricsheet.match_batting_scorecard bs
                JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
                LEFT JOIN raw_cricsheet.players bowler ON bowler.player_id = bs.dismissed_by_bowler_id
                LEFT JOIN raw_cricsheet.players fielder ON fielder.player_id = bs.caught_by_fielder_id
                WHERE bs.innings_id = %(innings_id)s
                ORDER BY bs.batting_position NULLS LAST
                """,
                {"innings_id": innings_id},
            )
            batting = cur.fetchall()

            # Bowling scorecard, ordered by when each bowler first came on.
            cur.execute(
                """
                SELECT p.player_id, p.display_name, p.full_name,
                       bw.overs_bowled, bw.maidens, bw.runs_conceded, bw.wickets, bw.economy,
                       MIN(o.over_number) AS first_over
                FROM raw_cricsheet.match_bowling_scorecard bw
                JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
                JOIN raw_cricsheet.overs o
                    ON o.innings_id = bw.innings_id AND o.bowler_id = bw.player_id
                WHERE bw.innings_id = %(innings_id)s
                GROUP BY p.player_id, p.display_name, p.full_name,
                         bw.overs_bowled, bw.maidens, bw.runs_conceded, bw.wickets, bw.economy
                ORDER BY first_over
                """,
                {"innings_id": innings_id},
            )
            bowling = cur.fetchall()

            # Fall of wickets: running score at the moment of each dismissal.
            # NOTE: assumes ball_number is monotonically increasing within an
            # over, which holds for how etl.py assigns it -- fine for ordering
            # purposes here even though it isn't a strict legal-ball counter.
            cur.execute(
                """
                WITH ball_sequence AS (
                    SELECT d.*, o.over_number,
                           SUM(d.runs_total) OVER (
                               ORDER BY o.over_number, d.ball_number
                           ) AS running_score
                    FROM raw_cricsheet.deliveries d
                    JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
                    WHERE d.innings_id = %(innings_id)s
                )
                SELECT bs.running_score, bs.over_number, bs.ball_number,
                       bs.dismissal_type, p.display_name AS dismissed_player_name
                FROM ball_sequence bs
                LEFT JOIN raw_cricsheet.players p ON p.player_id = bs.dismissed_player_id
                WHERE bs.is_wicket
                ORDER BY bs.over_number, bs.ball_number
                """,
                {"innings_id": innings_id},
            )
            fall_of_wickets = cur.fetchall()

            # Partnerships
            cur.execute(
                """
                SELECT p.wicket_number,
                       b1.display_name AS batter1_name, p.batter1_runs,
                       b2.display_name AS batter2_name, p.batter2_runs,
                       p.runs, p.balls_faced, p.is_unbeaten
                FROM raw_cricsheet.partnerships p
                LEFT JOIN raw_cricsheet.players b1 ON b1.player_id = p.batter1_id
                LEFT JOIN raw_cricsheet.players b2 ON b2.player_id = p.batter2_id
                WHERE p.innings_id = %(innings_id)s
                ORDER BY p.wicket_number
                """,
                {"innings_id": innings_id},
            )
            partnerships = cur.fetchall()

            innings_out.append({
                "innings_number": inn["innings_number"],
                "batting_team_id": inn["batting_team_id"],
                "bowling_team_id": inn["bowling_team_id"],
                "total_runs": inn["total_runs"],
                "total_wickets": inn["total_wickets"],
                "total_overs": inn["total_overs"],
                "worm": worm,
                "batting": batting,
                "bowling": bowling,
                "fall_of_wickets": fall_of_wickets,
                "partnerships": partnerships,
            })

    return {"match": match, "innings": innings_out}


# =========================================================
# Player vs Player Bowling Matchup
# =========================================================

@app.get("/api/matchup")
def player_matchup(batter_id: int = Query(...), bowler_id: int = Query(...)):
    with get_conn() as conn, conn.cursor() as cur:

        # Balls faced excludes wides only (matches the same "faced" logic
        # used everywhere else in this project -- no-balls DO count as
        # faced, wides don't).
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE extras_type IS DISTINCT FROM 'wides') AS balls_faced,
                COALESCE(SUM(runs_batter), 0) AS runs_scored,
                COUNT(*) FILTER (
                    WHERE is_wicket AND dismissed_player_id = %(batter_id)s
                ) AS dismissals,
                COUNT(*) FILTER (
                    WHERE extras_type IS DISTINCT FROM 'wides' AND runs_total = 0
                ) AS dot_balls,
                COUNT(*) FILTER (WHERE runs_batter = 4) AS fours,
                COUNT(*) FILTER (WHERE runs_batter = 6) AS sixes
            FROM raw_cricsheet.deliveries
            WHERE striker_id = %(batter_id)s AND bowler_id = %(bowler_id)s
            """,
            {"batter_id": batter_id, "bowler_id": bowler_id},
        )
        agg = cur.fetchone()

        cur.execute(
            """
            SELECT m.match_date, s.season_year, o.over_number, d.ball_number, d.dismissal_type
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE d.striker_id = %(batter_id)s AND d.bowler_id = %(bowler_id)s
              AND d.is_wicket AND d.dismissed_player_id = %(batter_id)s
            ORDER BY m.match_date
            """,
            {"batter_id": batter_id, "bowler_id": bowler_id},
        )
        dismissals_list = cur.fetchall()

        cur.execute(
            "SELECT player_id, display_name, full_name FROM raw_cricsheet.players WHERE player_id = %(id)s",
            {"id": batter_id},
        )
        batter = cur.fetchone()
        cur.execute(
            "SELECT player_id, display_name, full_name FROM raw_cricsheet.players WHERE player_id = %(id)s",
            {"id": bowler_id},
        )
        bowler = cur.fetchone()

    balls_faced = agg["balls_faced"] or 0
    runs_scored = agg["runs_scored"] or 0
    dismissals = agg["dismissals"] or 0

    strike_rate = round(runs_scored / balls_faced * 100, 2) if balls_faced else None
    average = round(runs_scored / dismissals, 2) if dismissals else None

    if balls_faced == 0:
        return {
            "batter": batter,
            "bowler": bowler,
            "has_faced": False,
        }

    return {
        "batter": batter,
        "bowler": bowler,
        "has_faced": True,
        "balls_faced": balls_faced,
        "runs_scored": runs_scored,
        "dismissals": dismissals,
        "dot_balls": agg["dot_balls"],
        "fours": agg["fours"],
        "sixes": agg["sixes"],
        "strike_rate": strike_rate,
        "average": average,
        "dismissals_detail": dismissals_list,
    }
# =========================================================
# Player of the Match leaderboard
# =========================================================

@app.get("/api/player-of-match-leaders")
def player_of_match_leaders(season_id: Optional[int] = Query(None), limit: int = Query(15, le=50)):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.player_id, p.display_name, p.full_name, COUNT(*) AS awards
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.players p ON p.player_id = m.player_of_match_id
            WHERE m.player_of_match_id IS NOT NULL
              AND (%(season_id)s IS NULL OR m.season_id = %(season_id)s)
            GROUP BY p.player_id, p.display_name, p.full_name
            ORDER BY awards DESC
            LIMIT %(limit)s
            """,
            {"season_id": season_id, "limit": limit},
        )
        return cur.fetchall()


# =========================================================
# Fielding & Wicketkeeper leaderboard
# =========================================================
#
# IMPORTANT ASSUMPTION: this assumes the dismissal_type enum uses the
# literal values 'caught', 'stumped', and 'run_out'. If your actual enum
# spells these differently (e.g. 'run out' with a space, or 'stumping'),
# tell me the real values from `\dT+ dismissal_type` in psql and I'll
# adjust these WHERE clauses -- silently getting this wrong would just
# make every count come back zero rather than error, so it's worth
# double-checking the numbers below look sane before trusting them.
#
# Also assumes caught_by_fielder_id is populated for BOTH catches and
# stumpings (the schema only has one such column on
# match_batting_scorecard, not a separate stumped_by field) -- worth
# spot-checking a known stumping against the database to confirm.

@app.get("/api/fielding-leaderboard")
def fielding_leaderboard(season_id: Optional[int] = Query(None), limit: int = Query(15, le=50)):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            WITH catches AS (
                SELECT bs.caught_by_fielder_id AS player_id, i.match_id,
                       i.bowling_team_id AS team_id, 'catch' AS kind
                FROM raw_cricsheet.match_batting_scorecard bs
                JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                WHERE bs.dismissal_type = 'caught'
                  AND bs.caught_by_fielder_id IS NOT NULL
                  AND (%(season_id)s IS NULL OR m.season_id = %(season_id)s)
            ),
            stumpings AS (
                SELECT bs.caught_by_fielder_id AS player_id, i.match_id,
                       i.bowling_team_id AS team_id, 'stumping' AS kind
                FROM raw_cricsheet.match_batting_scorecard bs
                JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                WHERE bs.dismissal_type = 'stumped'
                  AND bs.caught_by_fielder_id IS NOT NULL
                  AND (%(season_id)s IS NULL OR m.season_id = %(season_id)s)
            ),
            run_outs AS (
                SELECT f.fid AS player_id, i.match_id,
                       i.bowling_team_id AS team_id, 'run_out' AS kind
                FROM raw_cricsheet.deliveries d
                JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                CROSS JOIN LATERAL (VALUES (d.fielder_id), (d.fielder2_id)) AS f(fid)
                WHERE d.dismissal_type = 'run_out'
                  AND f.fid IS NOT NULL
                  AND (%(season_id)s IS NULL OR m.season_id = %(season_id)s)
            ),
            all_dismissals AS (
                SELECT * FROM catches
                UNION ALL SELECT * FROM stumpings
                UNION ALL SELECT * FROM run_outs
            )
            SELECT
                ad.player_id, p.display_name, p.full_name,
                COUNT(*) FILTER (WHERE ad.kind = 'catch')    AS catches,
                COUNT(*) FILTER (WHERE ad.kind = 'stumping') AS stumpings,
                COUNT(*) FILTER (WHERE ad.kind = 'run_out')  AS run_outs,
                COUNT(*) AS total_dismissals,
                COUNT(*) FILTER (
                    WHERE ad.kind IN ('catch', 'stumping')
                      AND EXISTS (
                        SELECT 1 FROM raw_cricsheet.match_squads ms
                        WHERE ms.match_id = ad.match_id
                          AND ms.team_id = ad.team_id
                          AND ms.player_id = ad.player_id
                          AND ms.is_wicketkeeper
                      )
                ) AS keeper_dismissals
            FROM all_dismissals ad
            JOIN raw_cricsheet.players p ON p.player_id = ad.player_id
            GROUP BY ad.player_id, p.display_name, p.full_name
            """,
            {"season_id": season_id},
        )
        all_rows = cur.fetchall()

    # Two views over the same underlying data:
    # - fielding: everyone, ranked by total dismissals (catches+stumpings+run-outs)
    # - wicketkeeping: only counts dismissals made while that player was the
    #   designated keeper for that match (per your is_wicketkeeper flag),
    #   ranked by that keeper-specific count
    fielding = sorted(all_rows, key=lambda r: r["total_dismissals"], reverse=True)[:limit]
    keeper_rows = [r for r in all_rows if r["keeper_dismissals"] > 0]
    wicketkeeping = sorted(keeper_rows, key=lambda r: r["keeper_dismissals"], reverse=True)[:limit]

    return {"fielding": fielding, "wicketkeeping": wicketkeeping}

# =========================================================
# Season Comparison
# =========================================================
# Used by season-compare.html.

@app.get("/api/seasons/compare")
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

@app.get("/api/day-night-split")
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

@app.get("/api/players/{player_id}/phases")
def player_phases(player_id: int):
    with get_conn() as conn, conn.cursor() as cur:

        cur.execute(
            "SELECT player_id, display_name, full_name FROM raw_cricsheet.players WHERE player_id = %(id)s",
            {"id": player_id},
        )
        player = cur.fetchone()
        if not player:
            return {"error": "player not found"}

        cur.execute(
            """
            SELECT
                o.phase,
                COALESCE(SUM(d.runs_batter), 0) AS runs,
                COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS balls_faced,
                COUNT(*) FILTER (
                    WHERE d.is_wicket AND d.dismissed_player_id = %(player_id)s
                ) AS dismissals
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            WHERE d.striker_id = %(player_id)s
            GROUP BY o.phase
            """,
            {"player_id": player_id},
        )
        batting_rows = {row["phase"]: row for row in cur.fetchall()}

        cur.execute(
            """
            SELECT
                phase,
                COUNT(*) AS overs_bowled,
                COALESCE(SUM(runs_conceded), 0) AS runs_conceded,
                COALESCE(SUM(wickets), 0) AS wickets
            FROM raw_cricsheet.overs
            WHERE bowler_id = %(player_id)s
            GROUP BY phase
            """,
            {"player_id": player_id},
        )
        bowling_rows = {row["phase"]: row for row in cur.fetchall()}

    def batting_phase(phase):
        r = batting_rows.get(phase)
        if not r:
            return {"runs": 0, "balls_faced": 0, "strike_rate": None, "dismissals": 0}
        sr = round(r["runs"] / r["balls_faced"] * 100, 2) if r["balls_faced"] else None
        return {
            "runs": r["runs"],
            "balls_faced": r["balls_faced"],
            "strike_rate": sr,
            "dismissals": r["dismissals"],
        }

    def bowling_phase(phase):
        r = bowling_rows.get(phase)
        if not r:
            return {"overs_bowled": 0, "runs_conceded": 0, "wickets": 0, "economy": None}
        econ = round(r["runs_conceded"] / r["overs_bowled"], 2) if r["overs_bowled"] else None
        return {
            "overs_bowled": r["overs_bowled"],
            "runs_conceded": r["runs_conceded"],
            "wickets": r["wickets"],
            "economy": econ,
        }

    return {
        "player": player,
        "batting": {
            "powerplay": batting_phase("powerplay"),
            "middle": batting_phase("middle"),
            "death": batting_phase("death"),
        },
        "bowling": {
            "powerplay": bowling_phase("powerplay"),
            "middle": bowling_phase("middle"),
            "death": bowling_phase("death"),
        },
    }


# =========================================================
# Player Consistency & Form Timeline
# =========================================================
# Not wired into any uploaded frontend page yet -- included for parity
# with the fragment files in case you want to add a form-timeline chart
# to player.html later. Bucket boundaries (0-9, 10-24, ... 100+) and the
# rolling window size (5 innings) are presentation choices, not fixed
# facts -- adjust freely.

@app.get("/api/players/{player_id}/consistency")
def player_consistency(player_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT bs.runs, m.match_date
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            WHERE bs.player_id = %(player_id)s
            ORDER BY m.match_date
            """,
            {"player_id": player_id},
        )
        innings = cur.fetchall()

    if not innings:
        return {"has_batted": False}

    buckets = {"0-9": 0, "10-24": 0, "25-49": 0, "50-74": 0, "75-99": 0, "100+": 0}
    for row in innings:
        r = row["runs"]
        if r < 10: buckets["0-9"] += 1
        elif r < 25: buckets["10-24"] += 1
        elif r < 50: buckets["25-49"] += 1
        elif r < 75: buckets["50-74"] += 1
        elif r < 100: buckets["75-99"] += 1
        else: buckets["100+"] += 1

    window = 5
    rolling = []
    for i in range(len(innings)):
        start = max(0, i - window + 1)
        chunk = innings[start:i + 1]
        avg = round(sum(r["runs"] for r in chunk) / len(chunk), 1)
        rolling.append({
            "match_date": innings[i]["match_date"].isoformat(),
            "rolling_avg": avg,
            "runs": innings[i]["runs"],
        })

    return {
        "has_batted": True,
        "total_innings": len(innings),
        "score_distribution": buckets,
        "form_timeline": rolling,
    }


# =========================================================
# Batter vs Bowling-Type (pace vs spin)
# =========================================================
# Used by batter-vs-type.html.
#
# IMPORTANT LIMITATION: bowler_type is a DERIVED classification from
# scraped bowling_style text, not an official stat -- some bowlers
# couldn't be classified at all (shown separately as "unclassified"
# rather than silently dropped, so the numbers aren't misleadingly
# incomplete without you knowing).

@app.get("/api/batter-vs-bowling-type")
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

@app.get("/api/league-evolution")
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

@app.get("/api/data-quality")
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
