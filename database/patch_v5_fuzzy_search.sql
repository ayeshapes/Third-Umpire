-- =========================================================
-- Patch: enable fuzzy player search
-- =========================================================
-- Run this once. pg_trgm is a standard, safe Postgres extension
-- (ships with Postgres itself, no third-party code) -- Supabase allows
-- enabling it via the SQL editor with the default project role.

SET search_path TO raw_cricsheet, public;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes so fuzzy similarity() lookups stay fast as the
-- players table grows, instead of a full sequential scan per search.
CREATE INDEX IF NOT EXISTS idx_players_full_name_trgm
    ON players USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_players_display_name_trgm
    ON players USING gin (display_name gin_trgm_ops);

RESET search_path;
