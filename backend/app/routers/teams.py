"""
ThirdUmpire API -- teams router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr
from app.utils.cricket import clamp_pct as _clamp_pct

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


@router.get("/api/teams/search")
def search_teams(
    q: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
):
    """
    Team search: name/code (fuzzy, typo-tolerant), same pattern as
    /api/players/search. Requires q to be at least 2 characters if
    provided (q itself is optional -- omitting it just returns every
    team, A-Z, same as /api/teams).

    Fuzzy matching needs the pg_trgm extension (see
    database/patch_v6_fuzzy_search_teams_venues.sql) -- without it,
    this still works but falls back to substring-only matching (no
    typo tolerance).
    """
    if q is not None and len(q.strip()) < 2:
        q = None

    name_clause = ""
    if q:
        name_clause = """
            AND (
                t.team_name ILIKE %(pattern)s OR t.team_code ILIKE %(pattern)s
                OR similarity(t.team_name, %(q)s) > 0.25
                OR similarity(t.team_code, %(q)s) > 0.25
            )
        """

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                t.team_id, t.team_name, t.team_code, t.home_city,
                GREATEST(
                    similarity(t.team_name, COALESCE(%(q)s, t.team_name)),
                    similarity(t.team_code, COALESCE(%(q)s, t.team_code))
                ) AS match_score
            FROM raw_cricsheet.teams t
            WHERE 1=1
              {name_clause}
            ORDER BY match_score DESC, t.team_name
            LIMIT %(limit)s
            """,
            {"q": q, "pattern": f"%{q}%" if q else None, "limit": limit},
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
# Team Comparison -- sub-charts (venue split / radar / history)
# =========================================================
# Powers three "second row" sections of the Team Comparison Studio
# (frontend/app/(dashboard)/teams/compare/page.tsx): Venue Comparison,
# Skill Profile Radar, and Historical Performance. Unlike
# /api/teams/head-to-head (scoped to matches *between* these two
# teams), these look at each team's *overall* record -- e.g. "does
# this team's form travel" needs every venue they've played, not just
# the ones they've played each other at.
#
# Query params are `team_a`/`team_b` to match hooks/use-team-comparison.ts.


def _team_lookup(cur, team_id: int):
    cur.execute(
        "SELECT team_id, team_name, team_code FROM raw_cricsheet.teams WHERE team_id = %(id)s",
        {"id": team_id},
    )
    return cur.fetchone()


@router.get("/api/teams/compare/venues")
def compare_teams_by_venue(team_a: int = Query(...), team_b: int = Query(...)):
    """Venue split: each team's overall win% and matches at every venue
    either has played, merged into one paired-bar row per venue."""
    with get_conn() as conn, conn.cursor() as cur:
        a, b = _team_lookup(cur, team_a), _team_lookup(cur, team_b)
        if not a or not b:
            return {"error": "one or both teams not found"}

        def venue_rows(team_id):
            cur.execute(
                """
                SELECT
                    v.venue_id, v.venue_name,
                    COUNT(*) AS matches,
                    COUNT(*) FILTER (WHERE m.winner_team_id = %(team_id)s) AS wins
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
                WHERE m.team1_id = %(team_id)s OR m.team2_id = %(team_id)s
                GROUP BY v.venue_id, v.venue_name
                """,
                {"team_id": team_id},
            )
            return {r["venue_id"]: r for r in cur.fetchall()}

        rows_a = venue_rows(team_a)
        rows_b = venue_rows(team_b)

    venue_names = {}
    for r in list(rows_a.values()) + list(rows_b.values()):
        venue_names[r["venue_id"]] = r["venue_name"]

    def win_pct(r):
        if not r or not r["matches"]:
            return None
        return round(r["wins"] / r["matches"] * 100, 1)

    venues = []
    for venue_id, venue_name in venue_names.items():
        ra, rb = rows_a.get(venue_id), rows_b.get(venue_id)
        venues.append({
            "venue_id": venue_id,
            "venue_name": venue_name,
            "team_a_win_pct": win_pct(ra),
            "team_b_win_pct": win_pct(rb),
            "team_a_matches": ra["matches"] if ra else 0,
            "team_b_matches": rb["matches"] if rb else 0,
        })
    venues.sort(key=lambda v: v["team_a_matches"] + v["team_b_matches"], reverse=True)

    return {"team_a_code": a["team_code"], "team_b_code": b["team_code"], "venues": venues[:15]}


def _team_style_profile(cur, team_id: int):
    """Overall batting/bowling shape for one team, across every match
    it has played -- the raw numbers the radar/history endpoints below
    normalize or bucket by season."""
    cur.execute(
        f"""
        SELECT
            COALESCE(SUM(i.total_runs), 0) AS runs,
            COALESCE(SUM({_overs_to_balls_expr('i.total_overs')}), 0) AS balls,
            COALESCE(SUM(bs.fours), 0) AS fours,
            COALESCE(SUM(bs.sixes), 0) AS sixes,
            COALESCE(SUM(bs.balls_faced), 0) AS balls_faced,
            COUNT(*) FILTER (WHERE i.innings_number = 2) AS chases_batted,
            COUNT(*) FILTER (
                WHERE i.innings_number = 2 AND m.winner_team_id = i.batting_team_id
            ) AS chases_won
        FROM raw_cricsheet.innings i
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        LEFT JOIN raw_cricsheet.match_batting_scorecard bs ON bs.innings_id = i.innings_id
        WHERE i.batting_team_id = %(team_id)s
        """,
        {"team_id": team_id},
    )
    batting = cur.fetchone()

    cur.execute(
        f"""
        SELECT
            COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded,
            COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls_bowled
        FROM raw_cricsheet.innings i
        LEFT JOIN raw_cricsheet.match_bowling_scorecard bw ON bw.innings_id = i.innings_id
        WHERE i.bowling_team_id = %(team_id)s
        """,
        {"team_id": team_id},
    )
    bowling = cur.fetchone()

    cur.execute(
        f"""
        SELECT
            COALESCE(SUM(o.runs_conceded), 0) AS death_runs,
            COUNT(*) AS death_overs
        FROM raw_cricsheet.overs o
        JOIN raw_cricsheet.innings i ON i.innings_id = o.innings_id
        WHERE i.bowling_team_id = %(team_id)s AND o.phase = 'death'
        """,
        {"team_id": team_id},
    )
    death = cur.fetchone()

    balls_faced = batting["balls_faced"] or 0
    boundaries = (batting["fours"] or 0) + (batting["sixes"] or 0)
    balls = batting["balls"] or 0
    balls_bowled = bowling["balls_bowled"] or 0
    chases_batted = batting["chases_batted"] or 0
    death_overs = death["death_overs"] or 0

    return {
        "boundary_pct": round(boundaries / balls_faced * 100, 2) if balls_faced else None,
        "run_rate": round(batting["runs"] / (balls / 6), 2) if balls else None,
        "economy": round(bowling["runs_conceded"] / (balls_bowled / 6), 2) if balls_bowled else None,
        "chase_success_pct": round(batting["chases_won"] / chases_batted * 100, 1) if chases_batted else None,
        "death_economy": round(death["death_runs"] / death_overs, 2) if death_overs else None,
    }


@router.get("/api/teams/compare/radar")
def compare_teams_radar(team_a: int = Query(...), team_b: int = Query(...)):
    """Skill-profile radar: batting power, run rate, bowling economy,
    chase success, and death-overs economy, each normalized to a
    fixed 0-100 ceiling (same approach as /api/players/compare/radar --
    no team population here to percentile against)."""
    with get_conn() as conn, conn.cursor() as cur:
        a, b = _team_lookup(cur, team_a), _team_lookup(cur, team_b)
        if not a or not b:
            return {"error": "one or both teams not found"}
        profile_a = _team_style_profile(cur, team_a)
        profile_b = _team_style_profile(cur, team_b)

    def economy_score(econ):
        return _clamp_pct(11 - econ, 11) if econ is not None else 0.0

    axes = [
        {
            "axis": "Batting Power",
            "team_a_score": _clamp_pct(profile_a["boundary_pct"], 35),
            "team_b_score": _clamp_pct(profile_b["boundary_pct"], 35),
        },
        {
            "axis": "Run Rate",
            "team_a_score": _clamp_pct(profile_a["run_rate"], 9),
            "team_b_score": _clamp_pct(profile_b["run_rate"], 9),
        },
        {
            "axis": "Bowling Economy",
            "team_a_score": economy_score(profile_a["economy"]),
            "team_b_score": economy_score(profile_b["economy"]),
        },
        {
            "axis": "Chase Success",
            "team_a_score": _clamp_pct(profile_a["chase_success_pct"], 100),
            "team_b_score": _clamp_pct(profile_b["chase_success_pct"], 100),
        },
        {
            "axis": "Death Overs Economy",
            "team_a_score": economy_score(profile_a["death_economy"]),
            "team_b_score": economy_score(profile_b["death_economy"]),
        },
    ]

    return {"team_a_code": a["team_code"], "team_b_code": b["team_code"], "axes": axes}


@router.get("/api/teams/compare/history")
def compare_teams_history(team_a: int = Query(...), team_b: int = Query(...)):
    """Season-by-season win% and net run rate for each team, for the
    Historical Performance trend chart."""
    with get_conn() as conn, conn.cursor() as cur:
        a, b = _team_lookup(cur, team_a), _team_lookup(cur, team_b)
        if not a or not b:
            return {"error": "one or both teams not found"}

        def season_rows(team_id):
            cur.execute(
                f"""
                SELECT
                    s.season_year,
                    COUNT(*) AS matches,
                    COUNT(*) FILTER (WHERE m.winner_team_id = %(team_id)s) AS wins,
                    COALESCE(SUM(i_for.total_runs) FILTER (WHERE i_for.batting_team_id = %(team_id)s), 0)
                        AS runs_for,
                    COALESCE(SUM({_overs_to_balls_expr('i_for.total_overs')})
                        FILTER (WHERE i_for.batting_team_id = %(team_id)s), 0) AS balls_for,
                    COALESCE(SUM(i_against.total_runs) FILTER (WHERE i_against.bowling_team_id = %(team_id)s), 0)
                        AS runs_against,
                    COALESCE(SUM({_overs_to_balls_expr('i_against.total_overs')})
                        FILTER (WHERE i_against.bowling_team_id = %(team_id)s), 0) AS balls_against
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
                LEFT JOIN raw_cricsheet.innings i_for
                    ON i_for.match_id = m.match_id AND i_for.batting_team_id = %(team_id)s
                LEFT JOIN raw_cricsheet.innings i_against
                    ON i_against.match_id = m.match_id AND i_against.bowling_team_id = %(team_id)s
                WHERE m.team1_id = %(team_id)s OR m.team2_id = %(team_id)s
                GROUP BY s.season_year
                ORDER BY s.season_year
                """,
                {"team_id": team_id},
            )
            return cur.fetchall()

        rows_a = season_rows(team_a)
        rows_b = season_rows(team_b)

    by_year_a = {r["season_year"]: r for r in rows_a}
    by_year_b = {r["season_year"]: r for r in rows_b}
    years = sorted(set(by_year_a) | set(by_year_b))

    def win_pct(r):
        return round(r["wins"] / r["matches"] * 100, 1) if r and r["matches"] else 0.0

    def nrr(r):
        if not r:
            return 0.0
        rr_for = (r["runs_for"] / (r["balls_for"] / 6)) if r["balls_for"] else 0.0
        rr_against = (r["runs_against"] / (r["balls_against"] / 6)) if r["balls_against"] else 0.0
        return round(rr_for - rr_against, 2)

    points = [
        {
            "season_year": year,
            "team_a_win_pct": win_pct(by_year_a.get(year)),
            "team_b_win_pct": win_pct(by_year_b.get(year)),
            "team_a_nrr": nrr(by_year_a.get(year)),
            "team_b_nrr": nrr(by_year_b.get(year)),
        }
        for year in years
    ]

    return {"team_a_code": a["team_code"], "team_b_code": b["team_code"], "points": points}


# =========================================================
# Team Comparison -- Batting / Bowling / Form
# =========================================================
# The other three sections of the Team Comparison Studio: the full
# Batting/Bowling stat tables (components/teams/types.ts's
# TeamBattingStats/TeamBowlingStats) and the Recent Form Guide strip.
# Same `team_a`/`team_b` query params as the venue/radar/history
# endpoints above.


def _team_batting_stats(cur, team_id: int):
    cur.execute(
        f"""
        SELECT
            COUNT(DISTINCT m.match_id) AS matches,
            COUNT(*) AS innings,
            COALESCE(SUM(i.total_runs), 0) AS runs,
            ROUND(AVG(i.total_runs), 1) AS avg_score,
            MAX(i.total_runs) AS highest_total,
            MIN(i.total_runs) AS lowest_total,
            COUNT(*) FILTER (WHERE i.total_runs >= 200) AS scores_200_plus,
            COALESCE(SUM({_overs_to_balls_expr('i.total_overs')}), 0) AS balls
        FROM raw_cricsheet.innings i
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        WHERE i.batting_team_id = %(team_id)s
        """,
        {"team_id": team_id},
    )
    innings_row = cur.fetchone()

    cur.execute(
        """
        SELECT COALESCE(SUM(bs.fours), 0) AS fours, COALESCE(SUM(bs.sixes), 0) AS sixes
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        WHERE i.batting_team_id = %(team_id)s
        """,
        {"team_id": team_id},
    )
    boundary_row = cur.fetchone()

    def phase_run_rate(phase: str):
        cur.execute(
            """
            SELECT COALESCE(SUM(o.runs_conceded), 0) AS runs, COUNT(*) AS overs_count
            FROM raw_cricsheet.overs o
            JOIN raw_cricsheet.innings i ON i.innings_id = o.innings_id
            WHERE i.batting_team_id = %(team_id)s AND o.phase = %(phase)s
            """,
            {"team_id": team_id, "phase": phase},
        )
        r = cur.fetchone()
        overs_count = r["overs_count"] or 0
        return round(r["runs"] / overs_count, 2) if overs_count else None

    balls = innings_row["balls"] or 0

    return {
        "matches": innings_row["matches"] or 0,
        "innings": innings_row["innings"] or 0,
        "runs": innings_row["runs"] or 0,
        "avg_score": float(innings_row["avg_score"]) if innings_row["avg_score"] is not None else None,
        "run_rate": round(innings_row["runs"] / (balls / 6), 2) if balls else None,
        "highest_total": innings_row["highest_total"],
        "lowest_total": innings_row["lowest_total"],
        "fours": boundary_row["fours"] or 0,
        "sixes": boundary_row["sixes"] or 0,
        "powerplay_run_rate": phase_run_rate("powerplay"),
        "death_overs_run_rate": phase_run_rate("death"),
        "scores_200_plus": innings_row["scores_200_plus"] or 0,
    }


def _team_bowling_stats(cur, team_id: int):
    cur.execute(
        f"""
        SELECT
            COUNT(DISTINCT m.match_id) AS matches,
            COUNT(*) AS innings,
            COALESCE(SUM(bw.wickets), 0) AS wickets,
            COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded,
            COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls_bowled,
            COUNT(*) FILTER (WHERE bw.wickets >= 5) AS five_wicket_hauls
        FROM raw_cricsheet.innings i
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        LEFT JOIN raw_cricsheet.match_bowling_scorecard bw ON bw.innings_id = i.innings_id
        WHERE i.bowling_team_id = %(team_id)s
        """,
        {"team_id": team_id},
    )
    row = cur.fetchone()

    cur.execute(
        """
        SELECT bw.wickets, bw.runs_conceded
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        WHERE i.bowling_team_id = %(team_id)s
        ORDER BY bw.wickets DESC, bw.runs_conceded ASC
        LIMIT 1
        """,
        {"team_id": team_id},
    )
    best = cur.fetchone()

    cur.execute(
        """
        SELECT
            COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS legal_balls,
            COUNT(*) FILTER (
                WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.runs_total = 0
            ) AS dot_balls
        FROM raw_cricsheet.deliveries d
        JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
        WHERE i.bowling_team_id = %(team_id)s
        """,
        {"team_id": team_id},
    )
    dot_row = cur.fetchone()

    def phase_economy(phase: str):
        cur.execute(
            """
            SELECT COALESCE(SUM(o.runs_conceded), 0) AS runs, COUNT(*) AS overs_count
            FROM raw_cricsheet.overs o
            JOIN raw_cricsheet.innings i ON i.innings_id = o.innings_id
            WHERE i.bowling_team_id = %(team_id)s AND o.phase = %(phase)s
            """,
            {"team_id": team_id, "phase": phase},
        )
        r = cur.fetchone()
        overs_count = r["overs_count"] or 0
        return round(r["runs"] / overs_count, 2) if overs_count else None

    wickets = row["wickets"] or 0
    balls_bowled = row["balls_bowled"] or 0
    legal_balls = dot_row["legal_balls"] or 0

    return {
        "matches": row["matches"] or 0,
        "innings": row["innings"] or 0,
        "wickets": wickets,
        "bowling_average": round(row["runs_conceded"] / wickets, 2) if wickets else None,
        "economy_rate": round(row["runs_conceded"] / (balls_bowled / 6), 2) if balls_bowled else None,
        "bowling_strike_rate": round(balls_bowled / wickets, 2) if wickets else None,
        "best_bowling_figures": f"{best['wickets']}/{best['runs_conceded']}" if best and best["wickets"] else None,
        "dot_ball_pct": round(dot_row["dot_balls"] / legal_balls * 100, 1) if legal_balls else None,
        "powerplay_economy": phase_economy("powerplay"),
        "death_overs_economy": phase_economy("death"),
        "five_wicket_hauls": row["five_wicket_hauls"] or 0,
    }


@router.get("/api/teams/compare/batting")
def compare_teams_batting(team_a: int = Query(...), team_b: int = Query(...)):
    """Full batting stat table -- components/teams/batting-comparison.tsx."""
    with get_conn() as conn, conn.cursor() as cur:
        a, b = _team_lookup(cur, team_a), _team_lookup(cur, team_b)
        if not a or not b:
            return {"error": "one or both teams not found"}
        stats_a = _team_batting_stats(cur, team_a)
        stats_b = _team_batting_stats(cur, team_b)

    return {
        "team_a": {**a, "stats": stats_a},
        "team_b": {**b, "stats": stats_b},
    }


@router.get("/api/teams/compare/bowling")
def compare_teams_bowling(team_a: int = Query(...), team_b: int = Query(...)):
    """Full bowling stat table -- components/teams/bowling-comparison.tsx."""
    with get_conn() as conn, conn.cursor() as cur:
        a, b = _team_lookup(cur, team_a), _team_lookup(cur, team_b)
        if not a or not b:
            return {"error": "one or both teams not found"}
        stats_a = _team_bowling_stats(cur, team_a)
        stats_b = _team_bowling_stats(cur, team_b)

    return {
        "team_a": {**a, "stats": stats_a},
        "team_b": {**b, "stats": stats_b},
    }


@router.get("/api/teams/compare/form")
def compare_teams_form(team_a: int = Query(...), team_b: int = Query(...)):
    """Last 10 results (any opponent) per team, oldest -> newest, for the
    Recent Form Guide strip. A tie or no-result both render as "N" --
    <FormGuide>'s FormResult type only has W/L/N to work with."""
    with get_conn() as conn, conn.cursor() as cur:
        a, b = _team_lookup(cur, team_a), _team_lookup(cur, team_b)
        if not a or not b:
            return {"error": "one or both teams not found"}

        def recent_results(team_id):
            cur.execute(
                """
                SELECT
                    m.match_id, m.match_date, m.winner_team_id, m.is_tie, m.status,
                    CASE WHEN m.team1_id = %(team_id)s THEN t2.team_code ELSE t1.team_code END AS opponent_code
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
                JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
                WHERE (m.team1_id = %(team_id)s OR m.team2_id = %(team_id)s)
                  AND m.status = 'completed'
                ORDER BY m.match_date DESC, m.match_id DESC
                LIMIT 10
                """,
                {"team_id": team_id},
            )
            rows = cur.fetchall()
            rows.reverse()  # oldest -> newest, left to right
            results = []
            for r in rows:
                if r["is_tie"] or r["winner_team_id"] is None:
                    result = "N"
                elif r["winner_team_id"] == team_id:
                    result = "W"
                else:
                    result = "L"
                results.append({
                    "match_id": r["match_id"],
                    "result": result,
                    "opponent_code": r["opponent_code"],
                    "match_date": r["match_date"].isoformat(),
                })
            return results

        results_a = recent_results(team_a)
        results_b = recent_results(team_b)

    return {
        "team_a": {"team_code": a["team_code"], "results": results_a},
        "team_b": {"team_code": b["team_code"], "results": results_b},
    }


# =========================================================
# Leaderboards (Leaderboards)
# =========================================================
