"""
ThirdUmpire API -- filters router.

Ticket 6.3: expose the option lists that populate the frontend's global
filter bar (see frontend/store/filters -- FilterContext).

Ticket 6.7 (Cascading Filters): /teams, /players, /venues, and the new
/matches route each accept the filters "above" them in the chain as
optional query params and scope their results accordingly:

    GET /api/filters/seasons
    GET /api/filters/teams?season=2024
    GET /api/filters/players?season=2024&team=LQ
    GET /api/filters/venues?season=2024&team=LQ&player=101
    GET /api/filters/matches?season=2024&team=LQ&player=101&venue=7
    GET /api/filters/cities
    GET /api/filters/weather-ranges

Every param is optional and additive -- calling a route with no params
returns the same unscoped list Ticket 6.3 shipped, so this is backward
compatible with existing callers.

Toss / Result / Innings / Phase are not here on purpose: those are fixed
enumerations the frontend already knows, not values that live in the
database.

*** SCHEMA ASSUMPTION -- please verify against the real DB ***
The cascading JOINs below assume:
  raw_cricsheet.matches(match_id, season_id, venue_id, team1_id, team2_id, match_date)
  raw_cricsheet.match_squads(match_id, team_id, player_id)
  raw_cricsheet.seasons(season_id, season_year)
These tables/columns weren't in the slice of the codebase this router
shipped with -- `_query_teams`/`_query_players`/`_query_venues`/
`_query_matches` below are the only places that assume them. If your
actual matches/match_squads schema uses different column names, this
is the only place to update.

Filter values arrive from the frontend as whatever the dropdown stores
as its <option value>: `season` is the *year* (string, matches
frontend's season_year-as-value convention), `team`/`opponent` is the
team *code*, `player`/`venue`/`match` are the numeric ids as strings.

Ticket 6.8 (Advanced Filter Categories):
Weather / Day-Night / Toss Decision / Toss Winner / Match Result /
Batting Order / Match Phase (Powerplay, Middle overs, Death overs) are
all now supported filters. Most of these are, like Toss/Result/Innings/
Phase before them, fixed enumerations the frontend already knows -- no
route needed for those (see frontend/store/filters/types.ts). Toss
Winner reuses this router's existing /teams list (a toss winner is
just a team). The one genuinely new *data-driven* need is bounding the
Temperature / Humidity / Wind Speed range sliders to sensible min/max
values instead of an arbitrary hardcoded range -- that's
/api/filters/weather-ranges below.

*** SCHEMA ASSUMPTION (Ticket 6.8) -- please verify against the real DB ***
_query_weather_ranges assumes match weather readings live on
raw_cricsheet.matches as nullable numeric columns:
    temperature_c    (Celsius)
    humidity_pct     (0-100)
    wind_speed_kph   (km/h)
If those live in a separate weather/conditions table instead, update
just that one query function below -- nothing else in this router
depends on where the columns actually live.
"""

from fastapi import APIRouter, Query, Response

from app.database.connection import get_conn
from app.utils.cache import ttl_cache

router = APIRouter(prefix="/api/filters", tags=["filters"])

# Filter option lists only change when new match data is scraped/loaded --
# not per-request -- so a multi-hour, per-process TTL is safe and keeps
# these routes off the database almost entirely under normal traffic.
# ttl_cache keys by call args, so each distinct combination of cascading
# params (season/team/player/venue) gets its own cache entry.
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours
# Client/CDN-facing hint. Shorter than the server-side TTL is fine --
# it just means a browser might re-ask us slightly more often than we
# actually recompute.
CLIENT_CACHE_CONTROL = "public, max-age=1800"


def _set_cache_header(response: Response) -> None:
    response.headers["Cache-Control"] = CLIENT_CACHE_CONTROL


# ---------------------------------------------------------------------
# Query functions (cached) -- kept separate from the route handlers so
# the TTL cache wraps just the DB round-trip, not response-header work.
# ---------------------------------------------------------------------


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_seasons():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT season_id, season_year
            FROM raw_cricsheet.seasons
            ORDER BY season_year
            """
        )
        return cur.fetchall()


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_teams(season_year: str | None = None):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT t.team_id, t.team_name, t.team_code
            FROM raw_cricsheet.teams t
            WHERE (
                %(season_year)s IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM raw_cricsheet.matches m
                    JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
                    WHERE s.season_year = %(season_year)s
                      AND (m.team1_id = t.team_id OR m.team2_id = t.team_id)
                )
            )
            ORDER BY t.team_name
            """,
            {"season_year": season_year},
        )
        return cur.fetchall()


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_players(season_year: str | None = None, team_code: str | None = None):
    with get_conn() as conn, conn.cursor() as cur:
        # Scoped to players who actually have a squad appearance, so the
        # dropdown doesn't surface roster records with no league history
        # -- and, when season/team are given, further scoped to
        # appearances within that season/for that team.
        cur.execute(
            """
            SELECT DISTINCT p.player_id, p.full_name, p.display_name
            FROM raw_cricsheet.players p
            WHERE EXISTS (
                SELECT 1
                FROM raw_cricsheet.match_squads ms
                JOIN raw_cricsheet.matches m ON m.match_id = ms.match_id
                LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
                LEFT JOIN raw_cricsheet.teams t ON t.team_id = ms.team_id
                WHERE ms.player_id = p.player_id
                  AND (%(season_year)s IS NULL OR s.season_year = %(season_year)s)
                  AND (%(team_code)s IS NULL OR t.team_code = %(team_code)s)
            )
            ORDER BY COALESCE(p.display_name, p.full_name)
            """,
            {"season_year": season_year, "team_code": team_code},
        )
        return cur.fetchall()


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_venues(
    season_year: str | None = None,
    team_code: str | None = None,
    player_id: int | None = None,
):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT v.venue_id, v.venue_name, v.city
            FROM raw_cricsheet.venues v
            WHERE EXISTS (
                SELECT 1
                FROM raw_cricsheet.matches m
                LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
                LEFT JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
                LEFT JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
                WHERE m.venue_id = v.venue_id
                  AND (%(season_year)s IS NULL OR s.season_year = %(season_year)s)
                  AND (
                      %(team_code)s IS NULL
                      OR t1.team_code = %(team_code)s
                      OR t2.team_code = %(team_code)s
                  )
                  AND (
                      %(player_id)s IS NULL
                      OR EXISTS (
                          SELECT 1 FROM raw_cricsheet.match_squads ms
                          WHERE ms.match_id = m.match_id AND ms.player_id = %(player_id)s
                      )
                  )
            )
            ORDER BY v.venue_name
            """,
            {"season_year": season_year, "team_code": team_code, "player_id": player_id},
        )
        return cur.fetchall()


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_matches(
    season_year: str | None = None,
    team_code: str | None = None,
    player_id: int | None = None,
    venue_id: int | None = None,
):
    with get_conn() as conn, conn.cursor() as cur:
        # Bottom of the cascade -- every filter above narrows this list.
        # Capped at 100 rows: a fully-unscoped call (no filters picked
        # yet) could otherwise return every match ever played.
        cur.execute(
            """
            SELECT
                m.match_id,
                m.match_date,
                t1.team_name AS team1_name,
                t2.team_name AS team2_name,
                v.venue_name
            FROM raw_cricsheet.matches m
            JOIN raw_cricsheet.teams t1 ON t1.team_id = m.team1_id
            JOIN raw_cricsheet.teams t2 ON t2.team_id = m.team2_id
            JOIN raw_cricsheet.venues v ON v.venue_id = m.venue_id
            LEFT JOIN raw_cricsheet.seasons s ON s.season_id = m.season_id
            WHERE (%(season_year)s IS NULL OR s.season_year = %(season_year)s)
              AND (
                  %(team_code)s IS NULL
                  OR t1.team_code = %(team_code)s
                  OR t2.team_code = %(team_code)s
              )
              AND (%(venue_id)s IS NULL OR m.venue_id = %(venue_id)s)
              AND (
                  %(player_id)s IS NULL
                  OR EXISTS (
                      SELECT 1 FROM raw_cricsheet.match_squads ms
                      WHERE ms.match_id = m.match_id AND ms.player_id = %(player_id)s
                  )
              )
            ORDER BY m.match_date DESC
            LIMIT 100
            """,
            {
                "season_year": season_year,
                "team_code": team_code,
                "player_id": player_id,
                "venue_id": venue_id,
            },
        )
        return cur.fetchall()


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_weather_ranges():
    """Min/max observed values for the Ticket 6.8 weather range sliders.

    Unscoped by design (like /cities) -- these bound the *slider*, not
    the result set, so they only need to reflect the full span of data
    that's ever been recorded, not the current cascade selection.
    NULLs (matches with no weather reading) are excluded automatically
    by MIN/MAX.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                MIN(temperature_c) AS temperature_min,
                MAX(temperature_c) AS temperature_max,
                MIN(humidity_pct) AS humidity_min,
                MAX(humidity_pct) AS humidity_max,
                MIN(wind_speed_kph) AS wind_speed_min,
                MAX(wind_speed_kph) AS wind_speed_max
            FROM raw_cricsheet.matches
            """
        )
        row = cur.fetchone()
        return {
            "temperature": {"min": row["temperature_min"], "max": row["temperature_max"]},
            "humidity": {"min": row["humidity_min"], "max": row["humidity_max"]},
            "wind_speed": {"min": row["wind_speed_min"], "max": row["wind_speed_max"]},
        }


@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def _query_cities():
    with get_conn() as conn, conn.cursor() as cur:
        # Cities repeat across venues (several grounds share a host
        # city) -- DISTINCT is load-bearing here, not decorative.
        cur.execute(
            """
            SELECT DISTINCT city
            FROM raw_cricsheet.venues
            WHERE city IS NOT NULL
            ORDER BY city
            """
        )
        return [row["city"] for row in cur.fetchall()]


# ---------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------


@router.get("/seasons")
def get_season_filters(response: Response):
    """Unique seasons for the Season filter, ordered oldest -> newest. Top of the cascade -- takes no params."""
    _set_cache_header(response)
    return _query_seasons()


@router.get("/teams")
def get_team_filters(
    response: Response,
    season: str | None = Query(default=None, description="Season year to scope teams to, e.g. '2024'."),
):
    """Unique teams for the Team / Opponent filters, A-Z by name. Scoped to `season` when given."""
    _set_cache_header(response)
    return _query_teams(season)


@router.get("/players")
def get_player_filters(
    response: Response,
    season: str | None = Query(default=None, description="Season year to scope players to."),
    team: str | None = Query(default=None, description="Team code to scope players to."),
):
    """Unique players (with league appearances) for the Player filter, A-Z. Scoped to `season`/`team` when given."""
    _set_cache_header(response)
    return _query_players(season, team)


@router.get("/venues")
def get_venue_filters(
    response: Response,
    season: str | None = Query(default=None, description="Season year to scope venues to."),
    team: str | None = Query(default=None, description="Team code to scope venues to."),
    player: int | None = Query(default=None, description="Player id to scope venues to."),
):
    """Unique venues for the Venue filter, A-Z by name. Scoped to `season`/`team`/`player` when given."""
    _set_cache_header(response)
    return _query_venues(season, team, player)


@router.get("/matches")
def get_match_filters(
    response: Response,
    season: str | None = Query(default=None, description="Season year to scope matches to."),
    team: str | None = Query(default=None, description="Team code to scope matches to."),
    player: int | None = Query(default=None, description="Player id to scope matches to."),
    venue: int | None = Query(default=None, description="Venue id to scope matches to."),
):
    """Matches for the Match filter -- newest first, capped at 100. Bottom of the Ticket 6.7 cascade."""
    _set_cache_header(response)
    return _query_matches(season, team, player, venue)


@router.get("/cities")
def get_city_filters(response: Response):
    """Unique host cities for the City filter, A-Z. Independent of the season/team/player/venue cascade."""
    _set_cache_header(response)
    return _query_cities()


@router.get("/weather-ranges")
def get_weather_range_filters(response: Response):
    """Observed min/max for Temperature/Humidity/Wind Speed (Ticket 6.8), to bound the range-slider filters."""
    _set_cache_header(response)
    return _query_weather_ranges()
