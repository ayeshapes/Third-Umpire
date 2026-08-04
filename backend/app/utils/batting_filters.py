"""
Shared filter handling for the /api/analytics/batting/* endpoints
(routers/analytics.py).

The frontend's global FilterBar (store/filters/types.ts) writes one flat
FilterState object and every chart on the page -- including all seven
batting-analytics charts -- sends whatever's currently set as query
params via lib/api/charts.ts's `fetchChartData`. This module is the one
place that turns those params into a reusable SQL WHERE clause, so each
endpoint in routers/analytics.py just calls `BattingFilters.from_query()`
and `.where(exclude=...)` instead of re-deriving the same 15+ conditions
seven times.

Query-param <-> column mapping mirrors routers/filters.py's documented
convention exactly:
    season   -> season *year* (string)      -> seasons.season_year
    team     -> team *code*                  -> teams.team_code (batting side)
    opponent -> team *code*                  -> teams.team_code (bowling side)
    player   -> numeric player id (string)   -> per-query (bs.player_id / d.striker_id / ...)
    venue    -> numeric venue id (string)    -> venues.venue_id
    match    -> numeric match id (string)    -> matches.match_id
    city     -> venue city (string)
    tossWinner -> team *code*                -> matches.toss_winner_team_id (joined)

Every query built from this module joins the same fixed set of
match/innings-level tables under the same aliases, so `where()` can be
reused verbatim regardless of whether the caller's main FROM is
match_batting_scorecard, deliveries, or partnerships:

    raw_cricsheet.innings          i
    raw_cricsheet.matches          m       ON m.match_id = i.match_id
    raw_cricsheet.teams            t_bat   ON t_bat.team_id = i.batting_team_id
    raw_cricsheet.teams            t_bowl  ON t_bowl.team_id = i.bowling_team_id
    raw_cricsheet.venues           v       ON v.venue_id = m.venue_id
    raw_cricsheet.seasons          s       ON s.season_id = m.season_id       (LEFT)
    raw_cricsheet.match_weather    mw      ON mw.match_id = m.match_id       (LEFT)
    raw_cricsheet.teams            t_toss  ON t_toss.team_id = m.toss_winner_team_id (LEFT)

`player` and `phase` are intentionally NOT handled by `where()` -- both
live at a finer grain than i/m (player varies by which column identifies
"this player" in the caller's FROM table; phase only exists once
raw_cricsheet.overs is joined) so callers add those two conditions
themselves, right next to the query that needs them.

Ticket-7.3 "breakdown" endpoints (by-venue/by-opposition/by-phase/
by-batting-order) each answer "show me the spread across every X for my
current filters" -- so, same pattern already used by VenueAnalysis's own
docstring, each of those endpoints excludes *its own* filter dimension
via `exclude={...}` (e.g. by-venue excludes "venue") since a single-venue
filter would otherwise collapse the breakdown down to one row.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Query

# Match-level day/night flag is a plain boolean in the schema, while the
# frontend's dayNight filter has three values (day/day_night/night) --
# only "day" maps unambiguously to False; both floodlit variants map to
# True. Flagged here (rather than silently) since it's a real, if minor,
# fidelity gap between the filter and the underlying column.
_DAY_NIGHT_TRUE_VALUES = {"night", "day_night"}


@dataclass
class BattingFilters:
    season: Optional[str] = None
    team: Optional[str] = None
    player: Optional[int] = None
    venue: Optional[int] = None
    match: Optional[int] = None
    city: Optional[str] = None
    opponent: Optional[str] = None
    toss: Optional[str] = None
    result: Optional[str] = None
    innings: Optional[int] = None
    phase: Optional[str] = None
    tossWinner: Optional[str] = None
    battingOrder: Optional[str] = None
    dayNight: Optional[str] = None
    weather: Optional[str] = None
    temperatureMin: Optional[float] = None
    temperatureMax: Optional[float] = None
    humidityMin: Optional[float] = None
    humidityMax: Optional[float] = None
    windSpeedMin: Optional[float] = None
    windSpeedMax: Optional[float] = None

    # -----------------------------------------------------------------
    # FastAPI dependency -- `filters: BattingFilters = Depends(BattingFilters.from_query)`
    # keeps every route signature to one line instead of ~20 Query(...)s.
    # -----------------------------------------------------------------
    @staticmethod
    def from_query(
        season: Optional[str] = Query(None),
        team: Optional[str] = Query(None),
        player: Optional[int] = Query(None),
        venue: Optional[int] = Query(None),
        match: Optional[int] = Query(None),
        city: Optional[str] = Query(None),
        opponent: Optional[str] = Query(None),
        toss: Optional[str] = Query(None),
        result: Optional[str] = Query(None),
        innings: Optional[int] = Query(None),
        phase: Optional[str] = Query(None),
        tossWinner: Optional[str] = Query(None),
        battingOrder: Optional[str] = Query(None),
        dayNight: Optional[str] = Query(None),
        weather: Optional[str] = Query(None),
        temperatureMin: Optional[float] = Query(None),
        temperatureMax: Optional[float] = Query(None),
        humidityMin: Optional[float] = Query(None),
        humidityMax: Optional[float] = Query(None),
        windSpeedMin: Optional[float] = Query(None),
        windSpeedMax: Optional[float] = Query(None),
    ) -> "BattingFilters":
        return BattingFilters(
            season=season, team=team, player=player, venue=venue, match=match,
            city=city, opponent=opponent, toss=toss, result=result, innings=innings,
            phase=phase, tossWinner=tossWinner, battingOrder=battingOrder,
            dayNight=dayNight, weather=weather,
            temperatureMin=temperatureMin, temperatureMax=temperatureMax,
            humidityMin=humidityMin, humidityMax=humidityMax,
            windSpeedMin=windSpeedMin, windSpeedMax=windSpeedMax,
        )

    def where(self, exclude: frozenset = frozenset()) -> tuple[str, dict]:
        """
        Build a SQL condition string (joined with AND, safe to drop after
        a `WHERE 1=1`) plus its psycopg2 params dict, against the fixed
        i/m/t_bat/t_bowl/v/s/mw/t_toss aliases documented at module level.

        `exclude` names FilterState keys to skip -- used by the Ticket 7.3
        breakdown endpoints to omit their own dimension.
        """
        clauses: list[str] = []
        params: dict = {}

        def add(key: str, sql: str, value) -> None:
            if key in exclude or value is None:
                return
            clauses.append(sql)
            params[key] = value

        add("season", "s.season_year = %(season)s", self.season)
        add("team", "t_bat.team_code = %(team)s", self.team)
        add("opponent", "t_bowl.team_code = %(opponent)s", self.opponent)
        add("venue", "m.venue_id = %(venue)s", self.venue)
        add("match", "m.match_id = %(match)s", self.match)
        add("city", "v.city = %(city)s", self.city)
        add("toss", "m.toss_decision = %(toss)s", self.toss)
        add("tossWinner", "t_toss.team_code = %(tossWinner)s", self.tossWinner)
        add("innings", "i.innings_number = %(innings)s", self.innings)
        add("weather", "mw.condition = %(weather)s", self.weather)
        add("temperatureMin", "mw.temperature_c >= %(temperatureMin)s", self.temperatureMin)
        add("temperatureMax", "mw.temperature_c <= %(temperatureMax)s", self.temperatureMax)
        add("humidityMin", "mw.humidity_pct >= %(humidityMin)s", self.humidityMin)
        add("humidityMax", "mw.humidity_pct <= %(humidityMax)s", self.humidityMax)
        add("windSpeedMin", "mw.wind_kph >= %(windSpeedMin)s", self.windSpeedMin)
        add("windSpeedMax", "mw.wind_kph <= %(windSpeedMax)s", self.windSpeedMax)

        if "battingOrder" not in exclude and self.battingOrder is not None:
            if self.battingOrder == "batting_first":
                clauses.append("i.innings_number = 1")
            elif self.battingOrder == "chasing":
                clauses.append("i.innings_number = 2")

        if "dayNight" not in exclude and self.dayNight is not None:
            clauses.append("m.is_day_night = %(dayNight)s")
            params["dayNight"] = self.dayNight in _DAY_NIGHT_TRUE_VALUES

        if "result" not in exclude and self.result is not None:
            if self.result == "won":
                clauses.append("m.winner_team_id = i.batting_team_id")
            elif self.result == "lost":
                clauses.append("m.winner_team_id = i.bowling_team_id")
            elif self.result == "tied":
                clauses.append("m.is_tie IS TRUE")
            elif self.result == "no_result":
                clauses.append("m.status = 'no_result'")

        return (" AND " + " AND ".join(clauses) if clauses else ""), params


# Every batting-analytics query joins this same fixed backbone so
# `BattingFilters.where()` above resolves regardless of the caller's
# main FROM table (match_batting_scorecard / deliveries / partnerships).
INNINGS_JOINS = """
        JOIN raw_cricsheet.matches m ON m.match_id = i.match_id
        JOIN raw_cricsheet.teams t_bat ON t_bat.team_id = i.batting_team_id
        JOIN raw_cricsheet.teams t_bowl ON t_bowl.team_id = i.bowling_team_id
        JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
        LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
        LEFT JOIN raw_cricsheet.match_weather mw ON mw.match_id = m.match_id
        LEFT JOIN raw_cricsheet.teams t_toss ON t_toss.team_id = m.toss_winner_team_id
"""
