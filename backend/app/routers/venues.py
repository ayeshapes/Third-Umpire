"""
ThirdUmpire API -- venues router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr

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


@router.get("/api/venues/search")
def search_venues(
    q: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
):
    """
    Venue search: name/city (fuzzy, typo-tolerant), same pattern as
    /api/players/search and /api/teams/search. q is optional -- combine
    with `city` alone, or omit both for every venue A-Z (same as
    /api/venues, minus the pitch-profile numbers that endpoint joins in).

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
                v.venue_name ILIKE %(pattern)s OR v.city ILIKE %(pattern)s
                OR similarity(v.venue_name, %(q)s) > 0.25
                OR similarity(COALESCE(v.city, ''), %(q)s) > 0.25
            )
        """

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                v.venue_id, v.venue_name, v.city, v.country,
                GREATEST(
                    similarity(v.venue_name, COALESCE(%(q)s, v.venue_name)),
                    similarity(COALESCE(v.city, ''), COALESCE(%(q)s, v.city, ''))
                ) AS match_score
            FROM raw_cricsheet.venues v
            WHERE 1=1
              {name_clause}
              AND (%(city)s IS NULL OR v.city = %(city)s)
            ORDER BY match_score DESC, v.venue_name
            LIMIT %(limit)s
            """,
            {"q": q, "pattern": f"%{q}%" if q else None, "city": city, "limit": limit},
        )
        return cur.fetchall()


# =========================================================
# Venue Intelligence -- frontend/app/(dashboard)/venues/page.tsx
# =========================================================
#
# Seven endpoints backing the single-venue "Venue Intelligence" page.
# The page only renders this section once the shared FilterBar has a
# `venue` selected (see hasVenue in page.tsx), so every route here
# requires `venue` (the numeric venue_id) and treats it as the primary
# scope -- unlike the batting/bowling analytics routers above, which
# key off the full shared FilterState, these only additionally honor
# `season` (a natural "this venue in this season" narrowing) and
# otherwise ignore the rest of FilterState's fields on purpose: a
# single venue's report isn't meaningfully "for team X" or "for
# player Y" the way a batting/bowling breakdown is, and useChartData
# still sends the whole FilterState as query params regardless --
# FastAPI just ignores whatever params a route doesn't declare, so
# that's safe to do without any special handling here.
#
# DISMISSAL_TYPE_LABEL mirrors frontend/components/charts/
# dismissal-types.tsx's TYPE_LABEL exactly, since bowling-conditions'
# `dismissal_breakdown[].type` is documented there as the *display*
# string ("Bowled", "LBW", ...), not the raw dismissal_type enum
# value.
DISMISSAL_TYPE_LABEL = {
    "bowled": "Bowled",
    "caught": "Caught",
    "lbw": "LBW",
    "run_out": "Run Out",
    "stumped": "Stumped",
    "hit_wicket": "Hit Wicket",
    "caught_and_bowled": "Caught & Bowled",
    "retired_hurt": "Retired Hurt",
    "retired_out": "Retired Out",
    "obstructing_field": "Obstructing Field",
    "hit_ball_twice": "Hit Ball Twice",
    "timed_out": "Timed Out",
}


@router.get("/api/venues/overview")
def venue_overview(venue: int = Query(...), season: Optional[str] = Query(None)):
    """
    Identity + headline numbers for one venue, for
    components/venue/venue-overview.tsx.

    `ends` comes from raw_cricsheet.venue_ends (null if the venue has
    fewer than 2 recorded ends). `capacity` is a best-effort fuzzy
    match against raw_scraped.venue_details (a separately-scraped
    table keyed by venue *name*, not venue_id) -- parsed out of its
    free-text capacity column, since that table stores it as TEXT.
    `established` has no backing column anywhere in the schema (not
    on venues, not in venue_details), so it's always null; kept in
    the response because the frontend type expects the key.

    pitch_character compares this venue's avg_first_innings_score
    (from v_venue_pitch_profile) against the league-wide average
    across all venues in that same view -- >5% above is
    batting_friendly, >5% below is bowling_friendly, otherwise
    balanced. A simple, self-consistent heuristic given what the view
    already computes; not a claim about pitch/soil conditions.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT v.venue_id, v.venue_name AS name, v.city, v.country
            FROM raw_cricsheet.venues v
            WHERE v.venue_id = %(venue)s
            """,
            {"venue": venue},
        )
        venue_row = cur.fetchone()
        if not venue_row:
            return {"error": "venue not found"}

        cur.execute(
            """
            SELECT array_agg(end_name ORDER BY venue_end_id) AS ends
            FROM raw_cricsheet.venue_ends
            WHERE venue_id = %(venue)s
            """,
            {"venue": venue},
        )
        ends_row = cur.fetchone()
        ends_list = ends_row["ends"] if ends_row else None
        ends = [ends_list[0], ends_list[1]] if ends_list and len(ends_list) >= 2 else None

        cur.execute(
            """
            SELECT capacity
            FROM raw_scraped.venue_details
            WHERE venue_name ILIKE %(name)s OR venue_name ILIKE %(pattern)s
            ORDER BY scraped_at DESC
            LIMIT 1
            """,
            {"name": venue_row["name"], "pattern": f"%{venue_row['name']}%"},
        )
        details_row = cur.fetchone()
        capacity = None
        if details_row and details_row["capacity"]:
            digits = "".join(ch for ch in details_row["capacity"] if ch.isdigit())
            capacity = int(digits) if digits else None

        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
                ) AS matches_hosted,
                MIN(m.match_date) FILTER (
                    WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
                ) AS first_match_date,
                MAX(m.match_date) FILTER (
                    WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
                ) AS last_match_date
            FROM raw_cricsheet.matches m
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
            """,
            {"venue": venue, "season": season},
        )
        match_row = cur.fetchone()

        cur.execute(
            """
            SELECT vp.avg_first_innings_score
            FROM raw_cricsheet.v_venue_pitch_profile vp
            WHERE vp.venue_id = %(venue)s
            """,
            {"venue": venue},
        )
        pitch_row = cur.fetchone()

        cur.execute("SELECT AVG(avg_first_innings_score) AS league_avg FROM raw_cricsheet.v_venue_pitch_profile")
        league_row = cur.fetchone()

    venue_score = pitch_row["avg_first_innings_score"] if pitch_row else None
    league_avg = league_row["league_avg"] if league_row else None
    pitch_character = "balanced"
    if venue_score is not None and league_avg:
        if venue_score > league_avg * 1.05:
            pitch_character = "batting_friendly"
        elif venue_score < league_avg * 0.95:
            pitch_character = "bowling_friendly"

    return {
        "name": venue_row["name"],
        "city": venue_row["city"],
        "country": venue_row["country"],
        "ends": ends,
        "established": None,
        "capacity": capacity,
        "matches_hosted": match_row["matches_hosted"] or 0,
        "first_match_date": str(match_row["first_match_date"]) if match_row["first_match_date"] else None,
        "last_match_date": str(match_row["last_match_date"]) if match_row["last_match_date"] else None,
        "pitch_character": pitch_character,
    }


@router.get("/api/venues/batting-conditions")
def venue_batting_conditions(venue: int = Query(...), season: Optional[str] = Query(None)):
    """
    "What's it like to bat here" -- headline scoring numbers plus a
    per-phase run-rate breakdown, for
    components/venue/batting-conditions.tsx.

    "Balls" throughout excludes wides only (same legal-ball convention
    used across the batting/bowling analytics routers above); runs use
    `runs_total` (bat + all extras) rather than `runs_batter` alone
    since this is a venue-wide scoring read, not scoped to one batter.
    """
    params = {"venue": venue, "season": season}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                ROUND(AVG(i.total_runs) FILTER (WHERE i.innings_number = 1), 1) AS avg_first,
                ROUND(AVG(i.total_runs) FILTER (WHERE i.innings_number = 2), 1) AS avg_second
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
            """,
            params,
        )
        innings_row = cur.fetchone()

        cur.execute(
            """
            SELECT
                o.phase,
                COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS legal_balls,
                COALESCE(SUM(d.runs_total), 0) AS runs_total,
                COUNT(*) FILTER (
                    WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.runs_batter IN (4, 6)
                ) AS boundary_balls,
                COUNT(*) FILTER (
                    WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.runs_total = 0
                ) AS dot_balls
            FROM raw_cricsheet.deliveries d
            JOIN raw_cricsheet.overs o ON o.over_id = d.over_id
            JOIN raw_cricsheet.innings i ON i.innings_id = d.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
            GROUP BY o.phase
            """,
            params,
        )
        phase_rows = {r["phase"]: r for r in cur.fetchall()}

    total_legal_balls = sum((r["legal_balls"] or 0) for r in phase_rows.values())
    total_runs = sum((r["runs_total"] or 0) for r in phase_rows.values())
    total_boundary_balls = sum((r["boundary_balls"] or 0) for r in phase_rows.values())
    total_dot_balls = sum((r["dot_balls"] or 0) for r in phase_rows.values())

    phase_run_rates = []
    for phase in ("powerplay", "middle", "death"):
        r = phase_rows.get(phase)
        legal_balls = (r["legal_balls"] if r else 0) or 0
        runs_total = (r["runs_total"] if r else 0) or 0
        phase_run_rates.append({
            "phase": phase,
            "run_rate": round(runs_total / (legal_balls / 6), 2) if legal_balls else 0,
        })

    return {
        "avg_first_innings_score": innings_row["avg_first"] or 0,
        "avg_second_innings_score": innings_row["avg_second"] or 0,
        "avg_runs_per_over": round(total_runs / (total_legal_balls / 6), 2) if total_legal_balls else 0,
        "boundary_pct": round(total_boundary_balls / total_legal_balls * 100, 1) if total_legal_balls else 0,
        "dot_ball_pct": round(total_dot_balls / total_legal_balls * 100, 1) if total_legal_balls else 0,
        "phase_run_rates": phase_run_rates,
    }


@router.get("/api/venues/bowling-conditions")
def venue_bowling_conditions(venue: int = Query(...), season: Optional[str] = Query(None)):
    """
    "What's it like to bowl here" -- wickets/economy headline numbers,
    the pace/spin wicket split, and a dismissal-type breakdown, for
    components/venue/bowling-conditions.tsx.

    pace_wickets_pct/spin_wickets_pct are each a share of *every*
    wicket at the venue (bowler_type IN ('pace','spin','na')), the
    same denominator convention v_venue_pitch_profile.spin_wicket_pct
    already uses -- not a share of just the pace+spin subtotal -- so
    the two numbers don't have to add to exactly 100 if a chunk of
    wickets belong to unclassified ('na') bowlers.
    """
    params = {"venue": venue, "season": season}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                COUNT(DISTINCT m.match_id) AS matches,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded,
                COALESCE(SUM(bw.wickets), 0) AS wickets
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
            """,
            params,
        )
        totals = cur.fetchone()

        cur.execute(
            """
            SELECT p.bowler_type, COALESCE(SUM(bw.wickets), 0) AS wickets
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
            GROUP BY p.bowler_type
            """,
            params,
        )
        type_rows = {r["bowler_type"]: (r["wickets"] or 0) for r in cur.fetchall()}

        cur.execute(
            """
            SELECT bs.dismissal_type, COUNT(*) AS count
            FROM raw_cricsheet.match_batting_scorecard bs
            JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
              AND bs.dismissal_type IS NOT NULL
            GROUP BY bs.dismissal_type
            ORDER BY count DESC
            """,
            params,
        )
        dismissal_rows = cur.fetchall()

    matches = totals["matches"] or 0
    balls = totals["balls"] or 0
    wickets = totals["wickets"] or 0
    runs_conceded = totals["runs_conceded"] or 0
    all_type_wickets = sum(type_rows.values()) or 0

    total_dismissals = sum((r["count"] or 0) for r in dismissal_rows) or 0
    dismissal_breakdown = [
        {
            "type": DISMISSAL_TYPE_LABEL.get(r["dismissal_type"], r["dismissal_type"]),
            "pct": round(r["count"] / total_dismissals * 100, 1) if total_dismissals else 0,
        }
        for r in dismissal_rows
    ]

    return {
        "avg_wickets_per_match": round(wickets / matches, 2) if matches else 0,
        "avg_economy": round(runs_conceded / (balls / 6), 2) if balls else 0,
        "avg_bowling_strike_rate": round(balls / wickets, 2) if wickets else 0,
        "pace_wickets_pct": round(type_rows.get("pace", 0) / all_type_wickets * 100, 1) if all_type_wickets else 0,
        "spin_wickets_pct": round(type_rows.get("spin", 0) / all_type_wickets * 100, 1) if all_type_wickets else 0,
        "dismissal_breakdown": dismissal_breakdown,
    }


@router.get("/api/venues/average-scores")
def venue_average_scores(venue: int = Query(...), season: Optional[str] = Query(None)):
    """
    The "par score" read for this venue -- batting-first vs chasing
    averages and win rates, plus record highs/lows -- for
    components/venue/average-scores.tsx.
    """
    params = {"venue": venue, "season": season}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                ROUND(AVG(i1.total_runs), 1) AS avg_batting_first,
                ROUND(AVG(i2.total_runs), 1) AS avg_chasing,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE m.winner_team_id = i1.batting_team_id)
                    / NULLIF(COUNT(*) FILTER (WHERE m.winner_team_id IS NOT NULL), 0), 1
                ) AS win_batting_first_pct,
                ROUND(
                    100.0 * COUNT(*) FILTER (
                        WHERE i2.match_id IS NOT NULL AND m.winner_team_id = i2.batting_team_id
                    )
                    / NULLIF(COUNT(*) FILTER (WHERE i2.match_id IS NOT NULL AND m.winner_team_id IS NOT NULL), 0), 1
                ) AS win_chasing_pct
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.innings i1 ON i1.match_id = m.match_id AND i1.innings_number = 1
            LEFT JOIN raw_cricsheet.innings i2 ON i2.match_id = m.match_id AND i2.innings_number = 2
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
            """,
            params,
        )
        summary = cur.fetchone()

        cur.execute(
            """
            SELECT i.total_runs, t.team_name
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
              AND i.total_runs IS NOT NULL
            ORDER BY i.total_runs DESC
            LIMIT 1
            """,
            params,
        )
        highest = cur.fetchone()

        cur.execute(
            """
            SELECT i.total_runs, t.team_name
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
              AND i.total_runs IS NOT NULL
            ORDER BY i.total_runs ASC
            LIMIT 1
            """,
            params,
        )
        lowest = cur.fetchone()

    return {
        "avg_batting_first_score": summary["avg_batting_first"] or 0,
        "avg_chasing_score": summary["avg_chasing"] or 0,
        "win_batting_first_pct": summary["win_batting_first_pct"] or 0,
        "win_chasing_pct": summary["win_chasing_pct"] or 0,
        "highest_total": highest["total_runs"] if highest else 0,
        "highest_total_team": highest["team_name"] if highest else None,
        "lowest_total": lowest["total_runs"] if lowest else 0,
        "lowest_total_team": lowest["team_name"] if lowest else None,
    }


@router.get("/api/venues/toss-impact")
def venue_toss_impact(venue: int = Query(...), season: Optional[str] = Query(None)):
    """
    Does winning the toss (and what you do with it) matter at this
    specific venue, for components/venue/toss-impact.tsx -- the
    venue-scoped sibling of /api/toss-impact above.
    """
    params = {"venue": venue, "season": season}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) AS sample_size,
                COUNT(*) FILTER (WHERE m.toss_winner_team_id = m.winner_team_id) AS toss_winner_won,
                COUNT(*) FILTER (WHERE m.toss_decision = 'bat') AS bat_chosen,
                COUNT(*) FILTER (WHERE m.toss_decision = 'bowl') AS bowl_chosen,
                COUNT(*) FILTER (
                    WHERE m.toss_decision = 'bat' AND m.toss_winner_team_id = m.winner_team_id
                ) AS bat_chosen_won,
                COUNT(*) FILTER (
                    WHERE m.toss_decision = 'bowl' AND m.toss_winner_team_id = m.winner_team_id
                ) AS bowl_chosen_won
            FROM raw_cricsheet.matches m
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
              AND m.toss_decision IS NOT NULL
              AND m.winner_team_id IS NOT NULL
            """,
            params,
        )
        row = cur.fetchone()

    sample_size = row["sample_size"] or 0
    bat_chosen = row["bat_chosen"] or 0
    bowl_chosen = row["bowl_chosen"] or 0

    return {
        "toss_winner_match_win_pct": round(row["toss_winner_won"] / sample_size * 100, 1) if sample_size else 0,
        "bat_first_win_pct": round(row["bat_chosen_won"] / bat_chosen * 100, 1) if bat_chosen else 0,
        "bowl_first_win_pct": round(row["bowl_chosen_won"] / bowl_chosen * 100, 1) if bowl_chosen else 0,
        "bat_first_chosen_pct": round(bat_chosen / sample_size * 100, 1) if sample_size else 0,
        "bowl_first_chosen_pct": round(bowl_chosen / sample_size * 100, 1) if sample_size else 0,
        "sample_size": sample_size,
    }


@router.get("/api/venues/spin-vs-pace")
def venue_spin_vs_pace(venue: int = Query(...), season: Optional[str] = Query(None)):
    """
    Spin vs pace head-to-head at this venue -- economy/average/strike
    rate side by side -- for components/venue/spin-vs-pace.tsx. Only
    'spin'/'pace' bowler_type rows are considered (players.bowler_type
    also has an 'na' value for unclassified bowlers, which this
    two-way comparison has no bar for).
    """
    params = {"venue": venue, "season": season}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                p.bowler_type,
                COALESCE(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) AS balls,
                COALESCE(SUM(bw.runs_conceded), 0) AS runs_conceded,
                COALESCE(SUM(bw.wickets), 0) AS wickets
            FROM raw_cricsheet.match_bowling_scorecard bw
            JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
            WHERE m.venue_id = %(venue)s
              AND (%(season)s IS NULL OR s.season_year = %(season)s)
              AND p.bowler_type IN ('spin', 'pace')
            GROUP BY p.bowler_type
            """,
            params,
        )
        rows = {r["bowler_type"]: r for r in cur.fetchall()}

    def figures(bowler_type: str):
        r = rows.get(bowler_type)
        balls = (r["balls"] if r else 0) or 0
        wickets = (r["wickets"] if r else 0) or 0
        runs_conceded = (r["runs_conceded"] if r else 0) or 0
        return {
            "wickets": wickets,
            "economy": round(runs_conceded / (balls / 6), 2) if balls else 0,
            "average": round(runs_conceded / wickets, 2) if wickets else 0,
            "strike_rate": round(balls / wickets, 2) if wickets else 0,
        }

    spin = figures("spin")
    pace = figures("pace")

    metrics = [
        {"metric": "economy", "spin_value": spin["economy"], "pace_value": pace["economy"]},
        {"metric": "average", "spin_value": spin["average"], "pace_value": pace["average"]},
        {"metric": "strike_rate", "spin_value": spin["strike_rate"], "pace_value": pace["strike_rate"]},
    ]

    return {
        "spin_wickets": spin["wickets"],
        "pace_wickets": pace["wickets"],
        "metrics": metrics,
    }


@router.get("/api/venues/historical-trends")
def venue_historical_trends(venue: int = Query(...)):
    """
    Average score by season at this venue, for
    components/venue/historical-trends.tsx -- the one section on the
    page that's *about* change over time, so unlike every other venue
    endpoint above it deliberately does NOT take `season` (narrowing
    to one season would defeat the point of a trend line across all
    of them).

    avg_score averages every innings total (both batting-first and
    chasing totals) recorded at the venue that season -- a single
    "how much cricket happened here" number per season, same idea as
    the venue-wide figures elsewhere on this page, just split by year.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                s.season_year AS season,
                ROUND(AVG(i.total_runs), 1) AS avg_score,
                COUNT(DISTINCT m.match_id) AS matches
            FROM raw_cricsheet.innings i
            JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
            JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE m.venue_id = %(venue)s
              AND i.total_runs IS NOT NULL
            GROUP BY s.season_year
            ORDER BY s.season_year
            """,
            {"venue": venue},
        )
        rows = cur.fetchall()

    points = [
        {
            "season": str(r["season"]),
            "avg_score": r["avg_score"] or 0,
            "matches": r["matches"] or 0,
        }
        for r in rows
    ]
    return {"points": points}


# =========================================================
# Venue Comparison -- Team Performance
# =========================================================
# frontend/app/(dashboard)/venues/compare/page.tsx: pick 2-4 venues,
# see every team's record at each one side by side. `venues` is a
# comma-separated list of venue_ids (see lib/api/venues.ts's
# venueCompareQueryString) -- not a single `venue` param like the
# Venue Intelligence routes above, since this page compares several
# venues at once.


@router.get("/api/venues/compare/team-performance")
def compare_venues_team_performance(venues: str = Query(...)):
    """Per-venue team leaderboards (matches/wins/losses/win%/avg score),
    one column per requested venue -- components/venue/team-performance-comparison.tsx."""
    try:
        venue_ids = [int(v) for v in venues.split(",") if v.strip()]
    except ValueError:
        return {"error": "invalid venue id in `venues`"}

    if not venue_ids:
        return {"venues": []}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT venue_id, venue_name
            FROM raw_cricsheet.venues
            WHERE venue_id = ANY(%(venue_ids)s)
            """,
            {"venue_ids": venue_ids},
        )
        venue_names = {r["venue_id"]: r["venue_name"] for r in cur.fetchall()}

        cur.execute(
            """
            SELECT
                m.venue_id,
                t.team_id, t.team_name, t.team_code,
                COUNT(*) AS matches,
                COUNT(*) FILTER (WHERE m.winner_team_id = t.team_id) AS wins,
                COUNT(*) FILTER (
                    WHERE m.winner_team_id IS NOT NULL
                      AND m.winner_team_id != t.team_id
                      AND NOT m.is_tie
                ) AS losses,
                ROUND(AVG(i.total_runs), 1) AS avg_score
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.teams t ON t.team_id IN (m.team1_id, m.team2_id)
            LEFT JOIN raw_cricsheet.innings i
                ON i.match_id = m.match_id AND i.batting_team_id = t.team_id
            WHERE m.venue_id = ANY(%(venue_ids)s)
            GROUP BY m.venue_id, t.team_id, t.team_name, t.team_code
            """,
            {"venue_ids": venue_ids},
        )
        team_rows = cur.fetchall()

    by_venue: dict = {}
    for r in team_rows:
        by_venue.setdefault(r["venue_id"], []).append(r)

    venues_out = []
    for venue_id in venue_ids:
        if venue_id not in venue_names:
            continue
        teams = []
        for r in by_venue.get(venue_id, []):
            matches = r["matches"] or 0
            teams.append({
                "team_name": r["team_name"],
                "team_code": r["team_code"],
                "matches": matches,
                "wins": r["wins"] or 0,
                "losses": r["losses"] or 0,
                "win_pct": round((r["wins"] or 0) / matches * 100, 1) if matches else 0.0,
                "avg_score": float(r["avg_score"]) if r["avg_score"] is not None else 0.0,
            })
        venues_out.append({
            "venue_id": venue_id,
            "venue_name": venue_names[venue_id],
            "teams": teams,
        })

    return {"venues": venues_out}


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
