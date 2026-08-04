"""
ThirdUmpire API -- matches router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

router = APIRouter(tags=["matches"])


@router.get("/api/matches")
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


@router.get("/api/matches/{match_id}/detail")
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
                       p.runs, p.balls_faced, p.is_unbeaten,
                       p.start_over, p.end_over
                FROM raw_cricsheet.partnerships p
                LEFT JOIN raw_cricsheet.players b1 ON b1.player_id = p.batter1_id
                LEFT JOIN raw_cricsheet.players b2 ON b2.player_id = p.batter2_id
                WHERE p.innings_id = %(innings_id)s
                ORDER BY p.wicket_number
                """,
                {"innings_id": innings_id},
            )
            partnerships = cur.fetchall()

            # Boundaries -- feeds the match Timeline (fours/sixes alongside
            # the wickets already pulled above via fall_of_wickets). Same
            # ball_number-within-over ordering caveat as fall_of_wickets.
            cur.execute(
                """
                SELECT o.over_number, d.ball_number, d.runs_batter,
                       p.display_name AS striker_name
                FROM raw_cricsheet.deliveries d
                JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
                LEFT JOIN raw_cricsheet.players p ON p.player_id = d.striker_id
                WHERE d.innings_id = %(innings_id)s
                  AND d.runs_batter IN (4, 6)
                ORDER BY o.over_number, d.ball_number
                """,
                {"innings_id": innings_id},
            )
            boundaries = cur.fetchall()

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
                "boundaries": boundaries,
            })

    return {"match": match, "innings": innings_out}


# =========================================================
# Player vs Player Bowling Matchup
# =========================================================


@router.get("/api/matchup")
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
