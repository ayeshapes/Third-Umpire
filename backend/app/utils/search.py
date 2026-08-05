"""
Shared helper for the fuzzy-search endpoints (players/teams/venues).

Every /api/*/search route wants typo-tolerant matching via pg_trgm's
similarity() function (see database/patch_v5_fuzzy_search.sql and
patch_v6_fuzzy_search_teams_venues.sql). The docstrings on those routes
already promise a substring-only fallback when the extension isn't
installed -- this module is what actually makes that true.

Previously each route called similarity() unconditionally (including
when q was empty, to build match_score), so on a database where the
patch hasn't been run, EVERY search request -- not just fuzzy ones --
raised psycopg2.errors.UndefinedFunction, FastAPI turned that into a
500, and the frontend's try/catch quietly showed "No results found"
for absolutely anything typed in. That's almost certainly why player
search looked completely broken: not a bad query, a missing DB
extension with no graceful fallback.

pg_trgm_available() checks once per process (cheap: one catalog
lookup, cached) and every route below branches on it so search still
works -- just without typo-tolerance -- until the SQL patch is run.
"""

from app.database.connection import get_conn

_pg_trgm_available: bool | None = None


def pg_trgm_available() -> bool:
    """Whether the pg_trgm extension is installed on this database.
    Cached for the life of the process -- checked once, not once per
    request. Restart the API after running the SQL patch to pick up
    the change."""
    global _pg_trgm_available
    if _pg_trgm_available is None:
        try:
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")
                _pg_trgm_available = cur.fetchone() is not None
        except Exception:
            # If even this check fails, assume unavailable rather than
            # crash -- the caller falls back to plain ILIKE either way.
            _pg_trgm_available = False
    return _pg_trgm_available
