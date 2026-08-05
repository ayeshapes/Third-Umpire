"""
ThirdUmpire API -- players router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr
from app.utils.search import pg_trgm_available

router = APIRouter(tags=["players"])


@router.get("/api/players/search")
def search_players(
    q: Optional[str] = Query(None),
    nationality: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
):
    """
    Player search: name (fuzzy, typo-tolerant) plus optional nationality/
    team/role filters. Any combination works -- q alone, filters alone,
    or both together.

    Fuzzy matching needs the pg_trgm extension (see
    database/patch_v5_fuzzy_search.sql). pg_trgm_available() checks
    for that up front -- if it isn't installed yet, this falls back to
    plain ILIKE substring matching (no typo tolerance, but it works)
    instead of throwing a 500 on every request, fuzzy or not.

    Requires q to be at least 2 characters if provided, same as before,
    but q itself is now optional -- so "just show me Pakistani bowlers"
    with no name text works too.
    """
    if q is not None and len(q.strip()) < 2:
        q = None

    fuzzy = pg_trgm_available()

    name_clause = ""
    if q:
        if fuzzy:
            name_clause = """
                AND (
                    p.full_name ILIKE %(pattern)s OR p.display_name ILIKE %(pattern)s
                    OR similarity(p.full_name, %(q)s) > 0.25
                    OR similarity(COALESCE(p.display_name, ''), %(q)s) > 0.25
                )
            """
        else:
            name_clause = """
                AND (p.full_name ILIKE %(pattern)s OR p.display_name ILIKE %(pattern)s)
            """

    match_score_expr = (
        """
        GREATEST(
            similarity(p.full_name, COALESCE(%(q)s, p.full_name)),
            similarity(COALESCE(p.display_name, ''), COALESCE(%(q)s, p.display_name, ''))
        )
        """
        if fuzzy else "0"
    )

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                p.player_id, p.full_name, p.display_name, p.nationality, p.primary_role,
                {match_score_expr} AS match_score
            FROM raw_cricsheet.players p
            WHERE 1=1
              {name_clause}
              AND (%(nationality)s IS NULL OR p.nationality = %(nationality)s)
              AND (%(role)s IS NULL OR p.primary_role = %(role)s)
              AND (
                  %(team_id)s IS NULL OR EXISTS (
                      SELECT 1 FROM raw_cricsheet.player_season ps
                      WHERE ps.player_id = p.player_id AND ps.team_id = %(team_id)s
                  )
              )
            ORDER BY match_score DESC, p.full_name
            LIMIT %(limit)s
            """,
            {
                "q": q, "pattern": f"%{q}%" if q else None,
                "nationality": nationality, "team_id": team_id, "role": role,
                "limit": limit,
            },
        )
        return cur.fetchall()


@router.get("/api/players/filters")
def player_filter_options():
    """Populates the nationality/team/role dropdowns on the search page."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT nationality FROM raw_cricsheet.players "
            "WHERE nationality IS NOT NULL ORDER BY nationality"
        )
        nationalities = [r["nationality"] for r in cur.fetchall()]

        cur.execute(
            "SELECT unnest(enum_range(NULL::raw_cricsheet.player_role))::text AS role"
        )
        roles = [r["role"] for r in cur.fetchall()]

    return {"nationalities": nationalities, "roles": roles}


# =========================================================
# Player Comparison
# =========================================================
# Powers the side-by-side player comparison page: two players' career
# numbers, shot/strike profile, and a per-season timeline, shaped so the
# frontend can drop them straight into a radar/spider chart, a grouped
# bar chart, and a line chart without any extra math.
#
# Batting/bowling totals reuse the exact same aggregation logic as
# get_player() below (kept in sync deliberately) plus a few numbers
# get_player() doesn't expose yet: balls faced, dot balls, and catches.
# Dot balls aren't on match_batting_scorecard (no dot_balls column), so
# that one has to come from raw deliveries -- "ball faced" is defined
# the same way phases/ does (excludes wides, matches the rest of the
# codebase), and a dot ball is any faced ball with zero runs off the bat.


def _player_core(cur, player_id: int):
    cur.execute(
        """
        SELECT player_id, full_name, display_name, nationality, primary_role,
               batting_hand, bowling_arm, bowler_type
        FROM raw_cricsheet.players
        WHERE player_id = %(player_id)s
        """,
        {"player_id": player_id},
    )
    return cur.fetchone()


def _player_batting_profile(cur, player_id: int):
    cur.execute(
        """
        SELECT
            COUNT(DISTINCT bs.innings_id)                          AS innings,
            COALESCE(SUM(bs.runs), 0)                              AS runs,
            COALESCE(SUM(bs.balls_faced), 0)                       AS balls_faced,
            COALESCE(SUM(bs.fours), 0)                             AS fours,
            COALESCE(SUM(bs.sixes), 0)                             AS sixes,
            COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL)  AS times_out,
            COUNT(*) FILTER (WHERE bs.runs >= 50 AND bs.runs < 100) AS fifties,
            COUNT(*) FILTER (WHERE bs.runs >= 100)                 AS hundreds
        FROM raw_cricsheet.match_batting_scorecard bs
        WHERE bs.player_id = %(player_id)s
        """,
        {"player_id": player_id},
    )
    row = cur.fetchone()

    cur.execute(
        """
        SELECT COUNT(*) AS dot_balls
        FROM raw_cricsheet.deliveries d
        WHERE d.striker_id = %(player_id)s
          AND d.extras_type IS DISTINCT FROM 'wides'
          AND d.runs_batter = 0
        """,
        {"player_id": player_id},
    )
    dot_balls = cur.fetchone()["dot_balls"] or 0

    # Same ordering as /api/players/{player_id}'s highest_score_row (highest
    # score first, ties broken in favour of the not-out innings), but this
    # feeds the Comparison Studio's numeric "higher is better" column
    # (PlayerCareerStats.highest_score: number | null in
    # components/players/types.ts) rather than the single-player page's
    # pre-formatted "123*" string, so only the run count is kept here.
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

    balls_faced = row["balls_faced"] or 0
    boundaries = (row["fours"] or 0) + (row["sixes"] or 0)
    times_out = row["times_out"] or 0
    innings = row["innings"] or 0

    return {
        "innings": row["innings"],
        "runs": row["runs"],
        "average": round(row["runs"] / times_out, 2) if times_out else None,
        "strike_rate": round(row["runs"] / balls_faced * 100, 2) if balls_faced else None,
        "boundary_pct": round(boundaries / balls_faced * 100, 2) if balls_faced else None,
        "six_pct": round((row["sixes"] or 0) / balls_faced * 100, 2) if balls_faced else None,
        "balls_per_boundary": round(balls_faced / boundaries, 2) if boundaries else None,
        "dot_ball_pct": round(dot_balls / balls_faced * 100, 2) if balls_faced else None,
        "fours": row["fours"],
        "sixes": row["sixes"],
        "fifties": row["fifties"],
        "hundreds": row["hundreds"],
        "not_outs": innings - times_out,
        "highest_score": highest_score_row["runs"] if highest_score_row else None,
    }


def _player_bowling_profile(cur, player_id: int):
    cur.execute(
        f"""
        SELECT
            COUNT(*)                                                AS innings,
            COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls_bowled,
            COALESCE(SUM(bw.runs_conceded), 0)                      AS runs_conceded,
            COALESCE(SUM(bw.wickets), 0)                            AS wickets,
            COALESCE(SUM(bw.maidens), 0)                            AS maidens,
            COUNT(*) FILTER (WHERE bw.wickets >= 5)                 AS five_wicket_hauls
        FROM raw_cricsheet.match_bowling_scorecard bw
        WHERE bw.player_id = %(player_id)s
        """,
        {"player_id": player_id},
    )
    row = cur.fetchone()
    balls_bowled = row["balls_bowled"] or 0
    wickets = row["wickets"] or 0

    # Same pattern as /api/players/{player_id}'s best_figures_row.
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

    return {
        "innings": row["innings"],
        "wickets": wickets,
        "economy": round(row["runs_conceded"] / (balls_bowled / 6), 2) if balls_bowled else None,
        "average": round(row["runs_conceded"] / wickets, 2) if wickets else None,
        "strike_rate": round(balls_bowled / wickets, 2) if wickets else None,
        "maidens": row["maidens"],
        "five_wicket_hauls": row["five_wicket_hauls"],
        "best_bowling_figures": (
            f"{best_figures_row['wickets']}/{best_figures_row['runs_conceded']}"
            if best_figures_row and wickets else None
        ),
    }


def _player_catches(cur, player_id: int):
    # Same definition as /api/fielding-leaderboard: a "catch" is a
    # dismissal where this player is recorded as the catcher and the
    # dismissal type is specifically 'caught' (stumpings/run-outs are a
    # different fielding skill, not counted here).
    cur.execute(
        """
        SELECT COUNT(*) AS catches
        FROM raw_cricsheet.match_batting_scorecard bs
        WHERE bs.caught_by_fielder_id = %(player_id)s
          AND bs.dismissal_type = 'caught'
        """,
        {"player_id": player_id},
    )
    return cur.fetchone()["catches"] or 0


def _player_run_outs(cur, player_id: int):
    # Same run-out attribution as /api/fielding-leaderboard: credited via
    # deliveries.fielder_id/fielder2_id on a 'run_out' dismissal (a run
    # out can involve two fielders, e.g. a relay throw).
    cur.execute(
        """
        SELECT COUNT(*) AS run_outs
        FROM raw_cricsheet.deliveries d
        CROSS JOIN LATERAL (VALUES (d.fielder_id), (d.fielder2_id)) AS f(fid)
        WHERE d.dismissal_type = 'run_out'
          AND f.fid = %(player_id)s
        """,
        {"player_id": player_id},
    )
    return cur.fetchone()["run_outs"] or 0


def _player_matches(cur, player_id: int):
    # A player "played" a match if they appear in either scorecard for
    # it -- batting-only and bowling-only appearances (e.g. a specialist
    # bowler who doesn't bat, or a non-bowling batter) both count, so
    # this is a UNION of both rather than just the batting join used
    # for the venue/opposition splits above.
    cur.execute(
        """
        SELECT COUNT(DISTINCT match_id) AS matches
        FROM (
            SELECT i.match_id
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            WHERE bs.player_id = %(player_id)s
            UNION
            SELECT i.match_id
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            WHERE bw.player_id = %(player_id)s
        ) played
        """,
        {"player_id": player_id},
    )
    return cur.fetchone()["matches"] or 0


def _player_timeline(cur, player_id: int):
    cur.execute(
        """
        SELECT s.season_year, COALESCE(SUM(bs.runs), 0) AS runs
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        WHERE bs.player_id = %(player_id)s
        GROUP BY s.season_year
        ORDER BY s.season_year
        """,
        {"player_id": player_id},
    )
    runs_by_season = {r["season_year"]: r["runs"] for r in cur.fetchall()}

    cur.execute(
        """
        SELECT s.season_year, COALESCE(SUM(bw.wickets), 0) AS wickets
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        WHERE bw.player_id = %(player_id)s
        GROUP BY s.season_year
        ORDER BY s.season_year
        """,
        {"player_id": player_id},
    )
    wickets_by_season = {r["season_year"]: r["wickets"] for r in cur.fetchall()}

    all_years = sorted(set(runs_by_season) | set(wickets_by_season))
    return [
        {
            "season_year": year,
            "runs": runs_by_season.get(year, 0),
            "wickets": wickets_by_season.get(year, 0),
        }
        for year in all_years
    ]


def _player_compare_bundle(cur, player_id: int):
    player = _player_core(cur, player_id)
    if not player:
        return None
    return {
        "player": player,
        "batting": _player_batting_profile(cur, player_id),
        "bowling": _player_bowling_profile(cur, player_id),
        "catches": _player_catches(cur, player_id),
        "run_outs": _player_run_outs(cur, player_id),
        "matches": _player_matches(cur, player_id),
        "timeline": _player_timeline(cur, player_id),
    }


@router.get("/api/players/compare")
def compare_players(player1_id: int = Query(...), player2_id: int = Query(...)):
    """Side-by-side career comparison for two players (batting, bowling,
    fielding, and a per-season timeline) -- feeds the Player Comparison
    page's stat table, radar/spider chart, and career timeline chart."""
    if player1_id == player2_id:
        return {"error": "choose two different players"}

    with get_conn() as conn, conn.cursor() as cur:
        player1 = _player_compare_bundle(cur, player1_id)
        player2 = _player_compare_bundle(cur, player2_id)

    if not player1 or not player2:
        return {"error": "one or both players not found"}

    return {"player1": player1, "player2": player2}


# =========================================================
# Player Comparison -- sub-charts (venue split / opposition split /
# radar / career timeline)
# =========================================================
# Powers the four "second row" sections of the Player Comparison Studio
# (frontend/app/(dashboard)/players/compare/page.tsx): Venue Comparison,
# Opposition Comparison, Radar Chart, and Career Timeline. Each of
# these is the same underlying question as /api/players/compare --
# "how did this player do" -- just grouped by an extra dimension
# (venue, opponent team) or reshaped for a different chart (radar,
# timeline) instead of returning one career-total bundle.
#
# Query params are `player_a`/`player_b` (not `player1_id`/`player2_id`)
# to match hooks/use-player-comparison.ts's generic comparison hook,
# which every one of these components is built on.


def _player_name(player) -> str:
    return player["display_name"] or player["full_name"]


@router.get("/api/players/compare/venues")
def compare_players_by_venue(player_a: int = Query(...), player_b: int = Query(...)):
    """Venue split: each player's batting average/matches at every venue
    either has played, merged into one paired-bar row per venue."""
    with get_conn() as conn, conn.cursor() as cur:
        a = _player_core(cur, player_a)
        b = _player_core(cur, player_b)
        if not a or not b:
            return {"error": "one or both players not found"}

        def venue_rows(player_id):
            cur.execute(
                """
                SELECT
                    v.venue_id, v.venue_name,
                    COUNT(DISTINCT i.match_id) AS matches,
                    COALESCE(SUM(bs.runs), 0) AS runs,
                    COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL) AS times_out
                FROM raw_cricsheet.match_batting_scorecard bs
                JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
                WHERE bs.player_id = %(player_id)s
                GROUP BY v.venue_id, v.venue_name
                """,
                {"player_id": player_id},
            )
            return {r["venue_id"]: r for r in cur.fetchall()}

        rows_a = venue_rows(player_a)
        rows_b = venue_rows(player_b)

    venue_names = {}
    for r in list(rows_a.values()) + list(rows_b.values()):
        venue_names[r["venue_id"]] = r["venue_name"]

    def avg(r):
        if not r or not r["times_out"]:
            return None
        return round(r["runs"] / r["times_out"], 2)

    venues = []
    for venue_id, venue_name in venue_names.items():
        ra, rb = rows_a.get(venue_id), rows_b.get(venue_id)
        venues.append({
            "venue_id": venue_id,
            "venue_name": venue_name,
            "player_a_average": avg(ra),
            "player_b_average": avg(rb),
            "player_a_matches": ra["matches"] if ra else 0,
            "player_b_matches": rb["matches"] if rb else 0,
        })
    venues.sort(key=lambda v: v["player_a_matches"] + v["player_b_matches"], reverse=True)

    return {
        "player_a_name": _player_name(a),
        "player_b_name": _player_name(b),
        "venues": venues[:15],
    }


@router.get("/api/players/compare/opposition")
def compare_players_by_opposition(player_a: int = Query(...), player_b: int = Query(...)):
    """Opposition split: same shape as the venue split above, grouped
    by opponent team instead of ground."""
    with get_conn() as conn, conn.cursor() as cur:
        a = _player_core(cur, player_a)
        b = _player_core(cur, player_b)
        if not a or not b:
            return {"error": "one or both players not found"}

        def opposition_rows(player_id):
            cur.execute(
                """
                SELECT
                    t.team_id, t.team_name, t.team_code,
                    COUNT(DISTINCT i.match_id) AS matches,
                    COALESCE(SUM(bs.runs), 0) AS runs,
                    COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL) AS times_out
                FROM raw_cricsheet.match_batting_scorecard bs
                JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
                JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
                JOIN raw_cricsheet.teams t
                    ON t.team_id = CASE WHEN i.batting_team_id = m.team1_id THEN m.team2_id ELSE m.team1_id END
                WHERE bs.player_id = %(player_id)s
                GROUP BY t.team_id, t.team_name, t.team_code
                """,
                {"player_id": player_id},
            )
            return {r["team_id"]: r for r in cur.fetchall()}

        rows_a = opposition_rows(player_a)
        rows_b = opposition_rows(player_b)

    teams = {}
    for r in list(rows_a.values()) + list(rows_b.values()):
        teams[r["team_id"]] = (r["team_name"], r["team_code"])

    def avg(r):
        if not r or not r["times_out"]:
            return None
        return round(r["runs"] / r["times_out"], 2)

    oppositions = []
    for team_id, (team_name, team_code) in teams.items():
        ra, rb = rows_a.get(team_id), rows_b.get(team_id)
        oppositions.append({
            "team_id": team_id,
            "team_name": team_name,
            "team_code": team_code,
            "player_a_average": avg(ra),
            "player_b_average": avg(rb),
            "player_a_matches": ra["matches"] if ra else 0,
            "player_b_matches": rb["matches"] if rb else 0,
        })
    oppositions.sort(key=lambda o: o["player_a_matches"] + o["player_b_matches"], reverse=True)

    return {
        "player_a_name": _player_name(a),
        "player_b_name": _player_name(b),
        "oppositions": oppositions[:15],
    }


def _clamp_pct(value, cap) -> float:
    """Scale a raw stat to 0-100 against a sensible ceiling, clamped both ends."""
    if value is None or cap <= 0:
        return 0.0
    return max(0.0, min(100.0, round(value / cap * 100, 1)))


@router.get("/api/players/compare/radar")
def compare_players_radar(player_a: int = Query(...), player_b: int = Query(...)):
    """Skill-shape radar: reuses the same batting/bowling/fielding
    profile queries as /api/players/compare, then normalizes each stat
    to a 0-100 axis score against a fixed, sport-realistic ceiling
    (there's no player population here to percentile against)."""
    with get_conn() as conn, conn.cursor() as cur:
        a = _player_core(cur, player_a)
        b = _player_core(cur, player_b)
        if not a or not b:
            return {"error": "one or both players not found"}

        bat_a, bat_b = _player_batting_profile(cur, player_a), _player_batting_profile(cur, player_b)
        bowl_a, bowl_b = _player_bowling_profile(cur, player_a), _player_bowling_profile(cur, player_b)
        catches_a, catches_b = _player_catches(cur, player_a), _player_catches(cur, player_b)

    def fielding_score(catches, bat):
        innings = bat["innings"] or 0
        return _clamp_pct(catches / innings, 0.3) if innings else 0.0

    def economy_score(bowl):
        econ = bowl["economy"]
        if econ is None:
            return 0.0
        return _clamp_pct(11 - econ, 11)

    axes = [
        {
            "axis": "Batting Average",
            "player_a_score": _clamp_pct(bat_a["average"], 50),
            "player_b_score": _clamp_pct(bat_b["average"], 50),
        },
        {
            "axis": "Strike Rate",
            "player_a_score": _clamp_pct(bat_a["strike_rate"], 180),
            "player_b_score": _clamp_pct(bat_b["strike_rate"], 180),
        },
        {
            "axis": "Boundary %",
            "player_a_score": _clamp_pct(bat_a["boundary_pct"], 35),
            "player_b_score": _clamp_pct(bat_b["boundary_pct"], 35),
        },
        {
            "axis": "Bowling Economy",
            "player_a_score": economy_score(bowl_a),
            "player_b_score": economy_score(bowl_b),
        },
        {
            "axis": "Fielding",
            "player_a_score": fielding_score(catches_a, bat_a),
            "player_b_score": fielding_score(catches_b, bat_b),
        },
    ]

    return {
        "player_a_name": _player_name(a),
        "player_b_name": _player_name(b),
        "axes": axes,
    }


@router.get("/api/players/compare/timeline")
def compare_players_career_timeline(player_a: int = Query(...), player_b: int = Query(...)):
    """Career timeline: matches played per season for each player,
    for the Gantt-style overlap chart."""
    with get_conn() as conn, conn.cursor() as cur:
        a = _player_core(cur, player_a)
        b = _player_core(cur, player_b)
        if not a or not b:
            return {"error": "one or both players not found"}

        def seasons_played(player_id):
            cur.execute(
                """
                SELECT s.season_year, COUNT(DISTINCT m.match_id) AS matches
                FROM raw_cricsheet.matches m
                JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
                WHERE m.match_id IN (
                    SELECT i.match_id FROM raw_cricsheet.match_batting_scorecard bs
                    JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
                    WHERE bs.player_id = %(player_id)s
                    UNION
                    SELECT i.match_id FROM raw_cricsheet.match_bowling_scorecard bw
                    JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
                    WHERE bw.player_id = %(player_id)s
                )
                GROUP BY s.season_year
                ORDER BY s.season_year
                """,
                {"player_id": player_id},
            )
            return cur.fetchall()

        seasons_a = seasons_played(player_a)
        seasons_b = seasons_played(player_b)

    def to_player_timeline(player, seasons):
        years = [s["season_year"] for s in seasons]
        return {
            "name": _player_name(player),
            "debut_year": min(years) if years else None,
            "last_active_year": max(years) if years else None,
            "seasons": [{"season_year": s["season_year"], "matches": s["matches"]} for s in seasons],
        }

    return {
        "player_a": to_player_timeline(a, seasons_a),
        "player_b": to_player_timeline(b, seasons_b),
    }


@router.get("/api/players/compare/career-stats")
def compare_players_career_stats(player_a: int = Query(...), player_b: int = Query(...)):
    """Same bundle as /api/players/compare, reshaped into the
    `{ player_a: { ...stats }, player_b: { ...stats } }` -- pre-merged
    shape <ComparisonInsights> needs (it reads the response directly,
    no client-side remapping like <CareerStatsComparison> does via
    lib/api/player-compare.ts's `toCareerStats`)."""
    with get_conn() as conn, conn.cursor() as cur:
        bundle_a = _player_compare_bundle(cur, player_a)
        bundle_b = _player_compare_bundle(cur, player_b)

    if not bundle_a or not bundle_b:
        return {"error": "one or both players not found"}

    def to_lite_stats(bundle):
        p = bundle["player"]
        return {
            "player_id": p["player_id"],
            "full_name": p["full_name"],
            "display_name": p["display_name"],
            "team_code": None,
            "debut_year": None,
            "stats": {
                "matches": bundle["matches"],
                "innings_batted": bundle["batting"]["innings"],
                "runs": bundle["batting"]["runs"],
                "batting_average": bundle["batting"]["average"],
                "strike_rate": bundle["batting"]["strike_rate"],
                "highest_score": bundle["batting"]["highest_score"],
                "centuries": bundle["batting"]["hundreds"],
                "fifties": bundle["batting"]["fifties"],
                "fours": bundle["batting"]["fours"],
                "sixes": bundle["batting"]["sixes"],
                "not_outs": bundle["batting"]["not_outs"],
                "innings_bowled": bundle["bowling"]["innings"],
                "wickets": bundle["bowling"]["wickets"],
                "bowling_average": bundle["bowling"]["average"],
                "economy_rate": bundle["bowling"]["economy"],
                "bowling_strike_rate": bundle["bowling"]["strike_rate"],
                "five_wicket_hauls": bundle["bowling"]["five_wicket_hauls"],
                "best_bowling_figures": bundle["bowling"]["best_bowling_figures"],
                "catches": bundle["catches"],
                "run_outs": bundle["run_outs"],
            },
        }

    return {"player_a": to_lite_stats(bundle_a), "player_b": to_lite_stats(bundle_b)}


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
