"""
ThirdUmpire API -- records router.

Ticket 11.1 -- Records: this was previously missing entirely from the
backend (frontend/app/(dashboard)/records/page.tsx pointed at
/api/records/batting|bowling|team|season|match|search, but no
`records` router existed and it wasn't registered in app/main.py --
every board on the page was a permanent loading/error state). This
adds the real aggregation queries for all five categories plus the
flat "search every record" view, against the same raw_cricsheet
schema every other router already reads.

Response shape (RecordList[] for the five category endpoints,
SearchableRecordRow[] for /search) matches what
frontend/components/records/record-board.tsx and
records-search-table.tsx already expect -- see those files' docstrings
for the "why one component covers all five categories" reasoning.

Filter params follow the same convention as the rest of the app's
shared filter store (see app/routers/filters.py's module docstring):
`season` is the season *year* (string) and `team` is the team *code*
(string) -- both optional, both additive. This is what
lib/api/charts.ts sends automatically from useFilters() on every
useChartData() call, so no frontend wiring is needed beyond what's
already there.

Qualification thresholds for rate stats ("Best Strike Rate", "Best
Economy Rate") and the default board size are presentation choices,
not fixed facts -- see the constants below.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn
from app.utils.cricket import overs_to_balls_expr as _overs_to_balls_expr

router = APIRouter(prefix="/api/records", tags=["records"])

DEFAULT_BOARD_LIMIT = 5
SEARCH_LIMIT_PER_TYPE = 10

# Minimum sample size before a rate stat (strike rate / economy) is
# eligible to lead a "best of" list -- otherwise a single 6-ball cameo
# or one tidy over would top the list ahead of anyone with a real body
# of work. Adjust freely; these aren't official PSL qualification
# rules, just sane defaults.
MIN_BALLS_FACED_FOR_STRIKE_RATE = 200
MIN_BALLS_BOWLED_FOR_ECONOMY = 120  # 20 overs


# =========================================================
# Shared helpers
# =========================================================


def _record_list(record_key: str, title: str, entries: list[dict]) -> dict:
    """Wrap raw entry dicts into the RecordList shape the frontend expects,
    numbering ranks 1..N in the order they were already sorted by SQL."""
    ranked = []
    for idx, e in enumerate(entries, start=1):
        ranked.append({
            "rank": idx,
            "name": e.get("name"),
            "team_code": e.get("team_code"),
            "value": e.get("value"),
            "context": e.get("context"),
            "player_id": e.get("player_id"),
            "team_id": e.get("team_id"),
            "match_id": e.get("match_id"),
        })
    return {"record_key": record_key, "title": title, "entries": ranked}


def _latest_team_codes(cur, player_ids: list, side: str) -> dict:
    """
    For a "career" (not season-scoped) batting/bowling record, a
    player's team can legitimately differ across seasons/rows once
    grouped -- rather than splitting one player's career total across
    several rows (one per team they've ever played for), aggregate
    across every team and look up the most recent team they turned out
    for as a display badge, via a small second batch query keyed to
    just the player_ids that made the cut.
    """
    if not player_ids:
        return {}
    table = "match_batting_scorecard" if side == "batting" else "match_bowling_scorecard"
    team_col = "batting_team_id" if side == "batting" else "bowling_team_id"
    cur.execute(
        f"""
        SELECT DISTINCT ON (x.player_id) x.player_id, t.team_code
        FROM raw_cricsheet.{table} x
        JOIN raw_cricsheet.innings i ON i.innings_id = x.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.{team_col}
        WHERE x.player_id = ANY(%(ids)s)
        ORDER BY x.player_id, m.match_date DESC
        """,
        {"ids": player_ids},
    )
    return {r["player_id"]: r["team_code"] for r in cur.fetchall()}


# =========================================================
# Batting Records
# =========================================================


def _batting_lists(cur, season: Optional[str], team: Optional[str], limit: int) -> list[dict]:
    params = {"season": season, "team": team, "limit": limit}
    lists = []

    # ---- Most Runs (Career) --------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               SUM(bs.runs) AS total_runs, COUNT(*) AS innings
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name
        ORDER BY total_runs DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "batting")
    lists.append(_record_list("most_runs", "Most Runs", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["total_runs"]), "context": f"{r['innings']} innings",
        }
        for r in rows
    ]))

    # ---- Highest Individual Score ----------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               t.team_code, bs.runs, (bs.dismissal_type IS NULL) AS not_out,
               opp.team_name AS opponent, s.season_year
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.teams opp ON opp.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        ORDER BY bs.runs DESC, not_out DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("highest_score", "Highest Individual Score", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": r["team_code"],
            "value": f"{r['runs']}{'*' if r['not_out'] else ''}",
            "context": f"vs {r['opponent']} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Best Strike Rate (qualified) ------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               SUM(bs.runs) AS total_runs, SUM(bs.balls_faced) AS total_balls
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name
        HAVING SUM(bs.balls_faced) >= %(qualifier)s
        ORDER BY (SUM(bs.runs)::numeric / NULLIF(SUM(bs.balls_faced), 0)) DESC
        LIMIT %(limit)s
        """,
        {**params, "qualifier": MIN_BALLS_FACED_FOR_STRIKE_RATE},
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "batting")
    lists.append(_record_list("best_strike_rate", "Best Strike Rate", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": f"{round(r['total_runs'] / r['total_balls'] * 100, 2):.2f}",
            "context": f"{r['total_runs']} runs off {r['total_balls']} balls",
        }
        for r in rows
    ]))

    # ---- Most Fifties -----------------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               COUNT(*) FILTER (WHERE bs.runs >= 50 AND bs.runs < 100) AS fifties
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name
        HAVING COUNT(*) FILTER (WHERE bs.runs >= 50 AND bs.runs < 100) > 0
        ORDER BY fifties DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "batting")
    lists.append(_record_list("most_fifties", "Most Fifties", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["fifties"]), "context": "50+ scores",
        }
        for r in rows
    ]))

    # ---- Most Hundreds ------------------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               COUNT(*) FILTER (WHERE bs.runs >= 100) AS hundreds
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name
        HAVING COUNT(*) FILTER (WHERE bs.runs >= 100) > 0
        ORDER BY hundreds DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "batting")
    lists.append(_record_list("most_hundreds", "Most Hundreds", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["hundreds"]), "context": "100+ scores",
        }
        for r in rows
    ]))

    # ---- Most Sixes (Career) -------------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               SUM(bs.sixes) AS sixes, COUNT(*) AS innings
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name
        ORDER BY sixes DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "batting")
    lists.append(_record_list("most_sixes", "Most Sixes", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["sixes"]), "context": f"{r['innings']} innings",
        }
        for r in rows
    ]))

    return lists


# =========================================================
# Bowling Records
# =========================================================


def _bowling_lists(cur, season: Optional[str], team: Optional[str], limit: int) -> list[dict]:
    params = {"season": season, "team": team, "limit": limit}
    lists = []

    # ---- Most Wickets (Career) ---------------------------------------
    cur.execute(
        f"""
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               SUM(bw.wickets) AS total_wickets, COUNT(*) AS innings
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bw.player_id, name
        ORDER BY total_wickets DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "bowling")
    lists.append(_record_list("most_wickets", "Most Wickets", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["total_wickets"]), "context": f"{r['innings']} innings",
        }
        for r in rows
    ]))

    # ---- Best Bowling Figures (single innings) -----------------------
    cur.execute(
        """
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               t.team_code, bw.wickets, bw.runs_conceded,
               opp.team_name AS opponent, s.season_year
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.teams opp ON opp.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
          AND bw.wickets > 0
        ORDER BY bw.wickets DESC, bw.runs_conceded ASC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("best_figures", "Best Bowling Figures", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": r["team_code"],
            "value": f"{r['wickets']}/{r['runs_conceded']}",
            "context": f"vs {r['opponent']} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Best Economy Rate (qualified) --------------------------------
    cur.execute(
        f"""
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               SUM(bw.runs_conceded) AS runs_conceded,
               SUM({_overs_to_balls_expr('bw.overs_bowled')}) AS balls_bowled
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bw.player_id, name
        HAVING SUM({_overs_to_balls_expr('bw.overs_bowled')}) >= %(qualifier)s
        ORDER BY (SUM(bw.runs_conceded)::numeric / NULLIF(SUM({_overs_to_balls_expr('bw.overs_bowled')}), 0) * 6) ASC
        LIMIT %(limit)s
        """,
        {**params, "qualifier": MIN_BALLS_BOWLED_FOR_ECONOMY},
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "bowling")
    lists.append(_record_list("best_economy", "Best Economy Rate", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": f"{round(r['runs_conceded'] / (r['balls_bowled'] / 6), 2):.2f}",
            "context": f"{r['balls_bowled'] // 6}.{r['balls_bowled'] % 6} overs",
        }
        for r in rows
    ]))

    # ---- Most Four-Wicket Hauls ----------------------------------------
    cur.execute(
        """
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               COUNT(*) FILTER (WHERE bw.wickets >= 4 AND bw.wickets < 5) AS hauls
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bw.player_id, name
        HAVING COUNT(*) FILTER (WHERE bw.wickets >= 4 AND bw.wickets < 5) > 0
        ORDER BY hauls DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "bowling")
    lists.append(_record_list("most_four_wicket_hauls", "Most 4-Wicket Hauls", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["hauls"]), "context": "4-wicket innings",
        }
        for r in rows
    ]))

    # ---- Most Five-Wicket Hauls -----------------------------------------
    cur.execute(
        """
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               COUNT(*) FILTER (WHERE bw.wickets >= 5) AS hauls
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bw.player_id, name
        HAVING COUNT(*) FILTER (WHERE bw.wickets >= 5) > 0
        ORDER BY hauls DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "bowling")
    lists.append(_record_list("most_five_wicket_hauls", "Most 5-Wicket Hauls", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["hauls"]), "context": "5-wicket innings",
        }
        for r in rows
    ]))

    # ---- Most Maidens ------------------------------------------------------
    cur.execute(
        """
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               SUM(bw.maidens) AS maidens
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bw.player_id, name
        HAVING SUM(bw.maidens) > 0
        ORDER BY maidens DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    codes = _latest_team_codes(cur, [r["player_id"] for r in rows], "bowling")
    lists.append(_record_list("most_maidens", "Most Maidens", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": codes.get(r["player_id"]),
            "value": str(r["maidens"]), "context": "maiden overs",
        }
        for r in rows
    ]))

    return lists


# =========================================================
# Team Records
# =========================================================


def _team_lists(cur, season: Optional[str], team: Optional[str], limit: int) -> list[dict]:
    params = {"season": season, "team": team, "limit": limit}
    lists = []

    # ---- Highest Team Total -------------------------------------------
    cur.execute(
        """
        SELECT t.team_id, t.team_name, t.team_code, i.total_runs, i.total_wickets,
               opp.team_name AS opponent, v.venue_name, s.season_year
        FROM raw_cricsheet.innings i
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.teams opp ON opp.team_id = i.bowling_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        ORDER BY i.total_runs DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("highest_total", "Highest Team Total", [
        {
            "team_id": r["team_id"], "name": r["team_name"], "team_code": r["team_code"],
            "value": f"{r['total_runs']}/{r['total_wickets'] if r['total_wickets'] is not None else '-'}",
            "context": f"vs {r['opponent']} \u00b7 {r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Lowest Team Total (all out) -----------------------------------
    cur.execute(
        """
        SELECT t.team_id, t.team_name, t.team_code, i.total_runs, i.total_wickets,
               opp.team_name AS opponent, v.venue_name, s.season_year
        FROM raw_cricsheet.innings i
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.teams opp ON opp.team_id = i.bowling_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE i.total_wickets = 10
          AND (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        ORDER BY i.total_runs ASC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("lowest_total", "Lowest Team Total (All Out)", [
        {
            "team_id": r["team_id"], "name": r["team_name"], "team_code": r["team_code"],
            "value": f"{r['total_runs']}/{r['total_wickets']}",
            "context": f"vs {r['opponent']} \u00b7 {r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Highest Successful Chase ---------------------------------------
    cur.execute(
        """
        SELECT t.team_id, t.team_name, t.team_code, i.total_runs, i.total_wickets,
               opp.team_name AS opponent, v.venue_name, s.season_year
        FROM raw_cricsheet.innings i
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.teams opp ON opp.team_id = i.bowling_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE i.innings_number = 2
          AND m.winner_team_id = i.batting_team_id
          AND (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        ORDER BY i.total_runs DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("highest_chase", "Highest Successful Chase", [
        {
            "team_id": r["team_id"], "name": r["team_name"], "team_code": r["team_code"],
            "value": f"{r['total_runs']}/{r['total_wickets']} chased",
            "context": f"beat {r['opponent']} \u00b7 {r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Biggest Win by Runs ---------------------------------------------
    cur.execute(
        """
        SELECT ww.team_id, ww.team_name AS winner_name, ww.team_code,
               CASE WHEN m.winner_team_id = m.team1_id THEN t2.team_name ELSE t1.team_name END AS loser_name,
               m.win_margin_runs, v.venue_name, s.season_year
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE m.win_margin_runs IS NOT NULL
          AND (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR ww.team_code = %(team)s)
        ORDER BY m.win_margin_runs DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("biggest_win_runs", "Biggest Win Margin (Runs)", [
        {
            "team_id": r["team_id"], "name": r["winner_name"], "team_code": r["team_code"],
            "value": f"won by {r['win_margin_runs']} runs",
            "context": f"vs {r['loser_name']} \u00b7 {r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Biggest Win by Wickets --------------------------------------------
    cur.execute(
        """
        SELECT ww.team_id, ww.team_name AS winner_name, ww.team_code,
               CASE WHEN m.winner_team_id = m.team1_id THEN t2.team_name ELSE t1.team_name END AS loser_name,
               m.win_margin_wickets, v.venue_name, s.season_year
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE m.win_margin_wickets IS NOT NULL
          AND (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR ww.team_code = %(team)s)
        ORDER BY m.win_margin_wickets DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("biggest_win_wickets", "Biggest Win Margin (Wickets)", [
        {
            "team_id": r["team_id"], "name": r["winner_name"], "team_code": r["team_code"],
            "value": f"won by {r['win_margin_wickets']} wickets",
            "context": f"vs {r['loser_name']} \u00b7 {r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Most Wins ---------------------------------------------------------
    cur.execute(
        """
        SELECT t.team_id, t.team_name, t.team_code, COUNT(*) AS wins
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = m.winner_team_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY t.team_id, t.team_name, t.team_code
        ORDER BY wins DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_wins", "Most Wins", [
        {
            "team_id": r["team_id"], "name": r["team_name"], "team_code": r["team_code"],
            "value": str(r["wins"]), "context": "matches won",
        }
        for r in rows
    ]))

    return lists


# =========================================================
# Season Records
# =========================================================


def _season_lists(cur, season: Optional[str], team: Optional[str], limit: int) -> list[dict]:
    params = {"season": season, "team": team, "limit": limit}
    lists = []

    # ---- Most Runs in a Season -------------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               t.team_code, s.season_year, SUM(bs.runs) AS total_runs, COUNT(*) AS innings
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name, t.team_code, s.season_year
        ORDER BY total_runs DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_runs_season", "Most Runs in a Season", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": r["team_code"],
            "value": str(r["total_runs"]), "context": f"{r['season_year']} \u00b7 {r['innings']} inn",
        }
        for r in rows
    ]))

    # ---- Most Wickets in a Season -----------------------------------------
    cur.execute(
        """
        SELECT bw.player_id, COALESCE(p.display_name, p.full_name) AS name,
               t.team_code, s.season_year, SUM(bw.wickets) AS total_wickets, COUNT(*) AS innings
        FROM raw_cricsheet.match_bowling_scorecard bw
        JOIN raw_cricsheet.innings i ON i.innings_id = bw.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.bowling_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bw.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bw.player_id, name, t.team_code, s.season_year
        ORDER BY total_wickets DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_wickets_season", "Most Wickets in a Season", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": r["team_code"],
            "value": str(r["total_wickets"]), "context": f"{r['season_year']} \u00b7 {r['innings']} inn",
        }
        for r in rows
    ]))

    # ---- Most Sixes in a Season -------------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               t.team_code, s.season_year, SUM(bs.sixes) AS sixes
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name, t.team_code, s.season_year
        ORDER BY sixes DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_sixes_season", "Most Sixes in a Season", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": r["team_code"],
            "value": str(r["sixes"]), "context": f"{r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Most Hundreds in a Season ------------------------------------------
    cur.execute(
        """
        SELECT bs.player_id, COALESCE(p.display_name, p.full_name) AS name,
               t.team_code, s.season_year,
               COUNT(*) FILTER (WHERE bs.runs >= 100) AS hundreds
        FROM raw_cricsheet.match_batting_scorecard bs
        JOIN raw_cricsheet.innings i ON i.innings_id = bs.innings_id
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = i.batting_team_id
        JOIN raw_cricsheet.players p ON p.player_id = bs.player_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY bs.player_id, name, t.team_code, s.season_year
        HAVING COUNT(*) FILTER (WHERE bs.runs >= 100) > 0
        ORDER BY hundreds DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_hundreds_season", "Most Hundreds in a Season", [
        {
            "player_id": r["player_id"], "name": r["name"], "team_code": r["team_code"],
            "value": str(r["hundreds"]), "context": f"{r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Most Wins in a Season (team) ---------------------------------------
    cur.execute(
        """
        SELECT t.team_id, t.team_name, t.team_code, s.season_year, COUNT(*) AS wins
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t ON t.team_id = m.winner_team_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t.team_code = %(team)s)
        GROUP BY t.team_id, t.team_name, t.team_code, s.season_year
        ORDER BY wins DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_wins_season", "Most Wins in a Season", [
        {
            "team_id": r["team_id"], "name": r["team_name"], "team_code": r["team_code"],
            "value": str(r["wins"]), "context": f"{r['season_year']} season",
        }
        for r in rows
    ]))

    return lists


# =========================================================
# Match Records
# =========================================================


def _match_lists(cur, season: Optional[str], team: Optional[str], limit: int) -> list[dict]:
    params = {"season": season, "team": team, "limit": limit}
    lists = []

    # ---- Highest Match Aggregate (both innings) ---------------------------
    cur.execute(
        """
        SELECT m.match_id, s.season_year, t1.team_name AS team1_name, t2.team_name AS team2_name,
               v.venue_name, SUM(i.total_runs) AS aggregate
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        JOIN raw_cricsheet.innings i ON i.match_id = m.match_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t1.team_code = %(team)s OR t2.team_code = %(team)s)
        GROUP BY m.match_id, s.season_year, t1.team_name, t2.team_name, v.venue_name
        ORDER BY aggregate DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("highest_aggregate", "Highest Match Aggregate", [
        {
            "match_id": r["match_id"], "name": f"{r['team1_name']} vs {r['team2_name']}",
            "team_code": None, "value": f"{r['aggregate']} runs",
            "context": f"{r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Most Sixes in a Match ----------------------------------------------
    cur.execute(
        """
        SELECT m.match_id, s.season_year, t1.team_name AS team1_name, t2.team_name AS team2_name,
               v.venue_name, SUM(bs.sixes) AS sixes
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        JOIN raw_cricsheet.innings i ON i.match_id = m.match_id
        JOIN raw_cricsheet.match_batting_scorecard bs ON bs.innings_id = i.innings_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t1.team_code = %(team)s OR t2.team_code = %(team)s)
        GROUP BY m.match_id, s.season_year, t1.team_name, t2.team_name, v.venue_name
        HAVING SUM(bs.sixes) > 0
        ORDER BY sixes DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_sixes_match", "Most Sixes in a Match", [
        {
            "match_id": r["match_id"], "name": f"{r['team1_name']} vs {r['team2_name']}",
            "team_code": None, "value": f"{r['sixes']} sixes",
            "context": f"{r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Most Wickets to Fall in a Match --------------------------------------
    cur.execute(
        """
        SELECT m.match_id, s.season_year, t1.team_name AS team1_name, t2.team_name AS team2_name,
               v.venue_name, SUM(i.total_wickets) AS wickets
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        JOIN raw_cricsheet.innings i ON i.match_id = m.match_id
        WHERE (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t1.team_code = %(team)s OR t2.team_code = %(team)s)
        GROUP BY m.match_id, s.season_year, t1.team_name, t2.team_name, v.venue_name
        HAVING SUM(i.total_wickets) IS NOT NULL
        ORDER BY wickets DESC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("most_wickets_match", "Most Wickets in a Match", [
        {
            "match_id": r["match_id"], "name": f"{r['team1_name']} vs {r['team2_name']}",
            "team_code": None, "value": f"{r['wickets']} wickets",
            "context": f"{r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Closest Match (by Runs) ---------------------------------------------
    cur.execute(
        """
        SELECT m.match_id, s.season_year, v.venue_name, m.win_margin_runs,
               ww.team_name AS winner_name,
               CASE WHEN m.winner_team_id = m.team1_id THEN t2.team_name ELSE t1.team_name END AS loser_name
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE m.win_margin_runs IS NOT NULL AND NOT m.is_tie
          AND (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t1.team_code = %(team)s OR t2.team_code = %(team)s)
        ORDER BY m.win_margin_runs ASC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("closest_by_runs", "Closest Match (by Runs)", [
        {
            "match_id": r["match_id"], "name": f"{r['winner_name']} beat {r['loser_name']}",
            "team_code": None, "value": f"by {r['win_margin_runs']} runs",
            "context": f"{r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    # ---- Closest Match (by Wickets) --------------------------------------------
    cur.execute(
        """
        SELECT m.match_id, s.season_year, v.venue_name, m.win_margin_wickets,
               ww.team_name AS winner_name,
               CASE WHEN m.winner_team_id = m.team1_id THEN t2.team_name ELSE t1.team_name END AS loser_name
        FROM raw_cricsheet.matches m
        JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
        JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
        JOIN raw_cricsheet.teams ww ON ww.team_id = m.winner_team_id
        LEFT JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        WHERE m.win_margin_wickets IS NOT NULL AND NOT m.is_tie
          AND (%(season)s IS NULL OR s.season_year = %(season)s)
          AND (%(team)s IS NULL OR t1.team_code = %(team)s OR t2.team_code = %(team)s)
        ORDER BY m.win_margin_wickets ASC
        LIMIT %(limit)s
        """,
        params,
    )
    rows = cur.fetchall()
    lists.append(_record_list("closest_by_wickets", "Closest Match (by Wickets)", [
        {
            "match_id": r["match_id"], "name": f"{r['winner_name']} beat {r['loser_name']}",
            "team_code": None, "value": f"by {r['win_margin_wickets']} wickets",
            "context": f"{r['venue_name'] or 'Unknown venue'} \u00b7 {r['season_year']}",
        }
        for r in rows
    ]))

    return lists


# =========================================================
# Routes -- one per curated category
# =========================================================


@router.get("/batting")
def batting_records(
    season: Optional[str] = Query(None, description="Season year, e.g. '2024'."),
    team: Optional[str] = Query(None, description="Team code."),
    limit: int = Query(DEFAULT_BOARD_LIMIT, ge=1, le=20),
):
    with get_conn() as conn, conn.cursor() as cur:
        return _batting_lists(cur, season, team, limit)


@router.get("/bowling")
def bowling_records(
    season: Optional[str] = Query(None, description="Season year, e.g. '2024'."),
    team: Optional[str] = Query(None, description="Team code."),
    limit: int = Query(DEFAULT_BOARD_LIMIT, ge=1, le=20),
):
    with get_conn() as conn, conn.cursor() as cur:
        return _bowling_lists(cur, season, team, limit)


@router.get("/team")
def team_records(
    season: Optional[str] = Query(None, description="Season year, e.g. '2024'."),
    team: Optional[str] = Query(None, description="Team code."),
    limit: int = Query(DEFAULT_BOARD_LIMIT, ge=1, le=20),
):
    with get_conn() as conn, conn.cursor() as cur:
        return _team_lists(cur, season, team, limit)


@router.get("/season")
def season_records(
    season: Optional[str] = Query(None, description="Season year, e.g. '2024'."),
    team: Optional[str] = Query(None, description="Team code."),
    limit: int = Query(DEFAULT_BOARD_LIMIT, ge=1, le=20),
):
    with get_conn() as conn, conn.cursor() as cur:
        return _season_lists(cur, season, team, limit)


@router.get("/match")
def match_records(
    season: Optional[str] = Query(None, description="Season year, e.g. '2024'."),
    team: Optional[str] = Query(None, description="Team code."),
    limit: int = Query(DEFAULT_BOARD_LIMIT, ge=1, le=20),
):
    with get_conn() as conn, conn.cursor() as cur:
        return _match_lists(cur, season, team, limit)


# =========================================================
# Search -- the flat, every-record view behind <RecordsSearchTable>
# =========================================================
#
# Runs every category's builder with a slightly larger per-record-type
# limit (SEARCH_LIMIT_PER_TYPE, vs the curated boards' top-5), then
# flattens every RecordList's entries into one row-per-record table --
# RecordsSearchTable does its own client-side search/filter/sort over
# whatever this returns, same "cheap because it's already capped
# server-side" reasoning the frontend docstring calls out.


@router.get("/search")
def search_records(
    season: Optional[str] = Query(None, description="Season year, e.g. '2024'."),
    team: Optional[str] = Query(None, description="Team code."),
):
    with get_conn() as conn, conn.cursor() as cur:
        categorized = {
            "batting": _batting_lists(cur, season, team, SEARCH_LIMIT_PER_TYPE),
            "bowling": _bowling_lists(cur, season, team, SEARCH_LIMIT_PER_TYPE),
            "team": _team_lists(cur, season, team, SEARCH_LIMIT_PER_TYPE),
            "season": _season_lists(cur, season, team, SEARCH_LIMIT_PER_TYPE),
            "match": _match_lists(cur, season, team, SEARCH_LIMIT_PER_TYPE),
        }

    rows = []
    for category, record_lists in categorized.items():
        for record_list in record_lists:
            for entry in record_list["entries"]:
                rows.append({
                    "id": f"{category}:{record_list['record_key']}:{entry['rank']}",
                    "category": category,
                    "record_type": record_list["title"],
                    "holder": entry["name"],
                    "team_code": entry["team_code"],
                    "value": entry["value"],
                    "context": entry["context"],
                    "player_id": entry["player_id"],
                    "team_id": entry["team_id"],
                    "match_id": entry["match_id"],
                })
    return rows
