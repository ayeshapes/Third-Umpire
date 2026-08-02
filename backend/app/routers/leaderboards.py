"""
ThirdUmpire API -- leaderboards router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

router = APIRouter(tags=["leaderboards"])


@router.get("/api/leaderboards")
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


@router.get("/api/player-of-match-leaders")
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


@router.get("/api/fielding-leaderboard")
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
