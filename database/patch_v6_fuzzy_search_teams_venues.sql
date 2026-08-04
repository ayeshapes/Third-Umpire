-- =========================================================
-- Patch: extend fuzzy search to teams and venues
-- =========================================================
-- Follow-on to patch_v5_fuzzy_search.sql, which enabled pg_trgm and
-- added trigram indexes for player name search. Same extension, same
-- reasoning -- this just adds the equivalent indexes for
-- teams.team_name and venues.venue_name (+ venues.city, since venue
-- search doubles as a city lookup in the command palette) so
-- GET /api/teams/search and GET /api/venues/search stay fast as those
-- tables grow, instead of a sequential scan + similarity() per search.
--
-- Safe to run multiple times (IF NOT EXISTS everywhere) and safe to
-- run even if patch_v5 already created the extension -- CREATE
-- EXTENSION IF NOT EXISTS is idempotent.

SET search_path TO raw_cricsheet, public;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_teams_team_name_trgm
    ON teams USING gin (team_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_venues_venue_name_trgm
    ON venues USING gin (venue_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_venues_city_trgm
    ON venues USING gin (city gin_trgm_ops);

RESET search_path;
