"""
ThirdUmpire API -- players router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr

router = APIRouter(tags=["players"])


@router.get("/api/players/search")
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


@router.get("/api/players/{player_id}")
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


@router.get("/api/players/{player_id}/phases")
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


@router.get("/api/players/{player_id}/consistency")
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
