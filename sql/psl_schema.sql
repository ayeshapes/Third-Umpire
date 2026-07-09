-- =========================================================
-- PSL Data Platform — PostgreSQL Schema (v2)
-- =========================================================
-- Design notes:
-- * player_season / team_season exist because team, captaincy,
--   overseas status can change year to year. Auction price/category
--   deliberately excluded (dropped from project scope).
-- * Ball-by-ball data (deliveries) is the core fact table;
--   phase/position are DERIVED via generated columns, so they
--   stay consistent without manual tagging.
-- * overs sits between innings and deliveries: over-level summary
--   (runs/over, maidens) without re-aggregating every delivery.
-- * match_batting_scorecard / match_bowling_scorecard are
--   pre-aggregated per-player-per-innings summaries -- the actual
--   "scorecard" a dashboard reads, populated by ETL from deliveries.
--   Ball-by-ball data still lives in deliveries for granular work.
-- * Pitch/venue "conditions" (batting-friendly, spin-friendly, etc.)
--   are NOT stored -- they're derived analytically at query time from
--   real match data (average first-innings score, spin-vs-pace wicket
--   split, boundary %) via the v_venue_pitch_profile view at the
--   bottom of this file. No manual rating needed.
--
-- Schema layout (one database, three schemas):
--   raw_cricsheet -> populated by the Cricsheet ETL. Never written
--                    to by the scraper. Your validated core.
--   raw_scraped   -> scraper output only. Loose/text-typed staging
--                    tables, no FKs into raw_cricsheet.
--   core          -> reconciled data the dashboard queries. Only the
--                    entity-resolution bridge exists here for now.
-- =========================================================

CREATE SCHEMA IF NOT EXISTS raw_cricsheet;
CREATE SCHEMA IF NOT EXISTS raw_scraped;
CREATE SCHEMA IF NOT EXISTS core;

SET search_path TO raw_cricsheet, public;

-- =========================================================
-- 0. Enum types
-- =========================================================

CREATE TYPE batting_hand AS ENUM ('right', 'left');
CREATE TYPE bowling_arm AS ENUM ('right', 'left', 'na');
CREATE TYPE bowler_type AS ENUM ('pace', 'spin', 'na');
CREATE TYPE player_role AS ENUM ('batter', 'bowler', 'allrounder', 'wicketkeeper');
CREATE TYPE toss_decision AS ENUM ('bat', 'bowl');
CREATE TYPE match_stage AS ENUM ('group', 'eliminator', 'qualifier', 'final', 'playoff_other');
CREATE TYPE dismissal_type AS ENUM (
    'bowled', 'caught', 'caught_and_bowled', 'lbw', 'run_out', 'stumped', 'hit_wicket',
    'retired_hurt', 'retired_out', 'obstructing_field', 'hit_ball_twice', 'timed_out'
);
CREATE TYPE match_status AS ENUM ('completed', 'abandoned', 'cancelled', 'no_result');

-- =========================================================
-- 1. Reference / dimension tables
-- =========================================================

CREATE TABLE seasons (
    season_id       SERIAL PRIMARY KEY,
    season_year     SMALLINT NOT NULL UNIQUE,
    season_name     VARCHAR(50),
    start_date      DATE,
    end_date        DATE,
    num_teams       SMALLINT,
    num_matches     SMALLINT
);

CREATE TABLE teams (
    team_id         SERIAL PRIMARY KEY,
    team_name       VARCHAR(100) NOT NULL,
    team_code       VARCHAR(10) NOT NULL UNIQUE,
    home_city       VARCHAR(100)
);

CREATE TABLE team_season (
    team_season_id  SERIAL PRIMARY KEY,
    team_id         INT NOT NULL REFERENCES teams(team_id),
    season_id       INT NOT NULL REFERENCES seasons(season_id),
    display_name    VARCHAR(100),
    home_venue_id   INT,
    captain_id      INT,
    final_position  SMALLINT,
    UNIQUE (team_id, season_id)
);

CREATE TABLE venues (
    venue_id            SERIAL PRIMARY KEY,
    venue_name          VARCHAR(150) NOT NULL,
    city                VARCHAR(100),
    country             VARCHAR(100) DEFAULT 'Pakistan',
    latitude            NUMERIC(9,6),
    longitude           NUMERIC(9,6),
    boundary_length_m   NUMERIC(5,1)
);

CREATE TABLE venue_ends (
    venue_end_id     SERIAL PRIMARY KEY,
    venue_id         INT NOT NULL REFERENCES venues(venue_id),
    end_name         VARCHAR(100) NOT NULL,
    boundary_length_m NUMERIC(5,1)
);

ALTER TABLE team_season
    ADD CONSTRAINT fk_team_season_venue FOREIGN KEY (home_venue_id) REFERENCES venues(venue_id);

CREATE TABLE players (
    player_id           SERIAL PRIMARY KEY,
    full_name           VARCHAR(150) NOT NULL,
    display_name        VARCHAR(100),
    date_of_birth       DATE,
    nationality         VARCHAR(100),
    primary_role        player_role,
    batting_hand        batting_hand,
    bowling_arm         bowling_arm,
    bowler_type         bowler_type DEFAULT 'na',
    bowling_subtype     VARCHAR(50),
    debut_season_id     INT REFERENCES seasons(season_id),
    debut_match_id      INT,
    external_ref_cricsheet VARCHAR(150),
    external_ref_espn      VARCHAR(150)
);

ALTER TABLE team_season
    ADD CONSTRAINT fk_team_season_captain FOREIGN KEY (captain_id) REFERENCES players(player_id);

CREATE TABLE player_season (
    player_season_id       SERIAL PRIMARY KEY,
    player_id               INT NOT NULL REFERENCES players(player_id),
    season_id                INT NOT NULL REFERENCES seasons(season_id),
    team_id                   INT REFERENCES teams(team_id),
    is_overseas                BOOLEAN,
    is_replacement_signing       BOOLEAN DEFAULT FALSE,
    is_impact_player_pool          BOOLEAN DEFAULT FALSE,
    is_captain                       BOOLEAN DEFAULT FALSE,
    UNIQUE (player_id, season_id, team_id)
);

CREATE TABLE umpires (
    umpire_id     SERIAL PRIMARY KEY,
    full_name     VARCHAR(150) NOT NULL UNIQUE,
    nationality   VARCHAR(100)
);

-- =========================================================
-- 2. Match-level facts
-- =========================================================

CREATE TABLE matches (
    match_id                  SERIAL PRIMARY KEY,
    season_id                  INT NOT NULL REFERENCES seasons(season_id),
    match_number                 SMALLINT,
    match_date                    DATE NOT NULL,
    is_day_night                   BOOLEAN,
    stage                            match_stage NOT NULL DEFAULT 'group',
    venue_id                          INT REFERENCES venues(venue_id),
    team1_id                            INT NOT NULL REFERENCES teams(team_id),
    team2_id                              INT NOT NULL REFERENCES teams(team_id),
    toss_winner_team_id                     INT REFERENCES teams(team_id),
    toss_decision                             toss_decision,
    winner_team_id                              INT REFERENCES teams(team_id),
    win_margin_runs                               SMALLINT,
    win_margin_wickets                              SMALLINT,
    is_tie                                            BOOLEAN DEFAULT FALSE,
    decided_by_super_over                               BOOLEAN DEFAULT FALSE,
    is_dls_affected                                       BOOLEAN DEFAULT FALSE,
    status                                                 match_status DEFAULT 'completed',
    cancelled_reason                                         VARCHAR(200),
    player_of_match_id                                         INT REFERENCES players(player_id),
    captain1_id                                                  INT REFERENCES players(player_id),
    captain2_id                                                    INT REFERENCES players(player_id),
    external_ref_cricsheet                                           VARCHAR(150),
    CHECK (team1_id <> team2_id),
    UNIQUE (season_id, match_number)
);

ALTER TABLE players
    ADD CONSTRAINT fk_players_debut_match FOREIGN KEY (debut_match_id) REFERENCES matches(match_id);

CREATE TABLE match_umpires (
    match_id     INT NOT NULL REFERENCES matches(match_id),
    umpire_id    INT NOT NULL REFERENCES umpires(umpire_id),
    role         VARCHAR(30),
    PRIMARY KEY (match_id, umpire_id, role)
);

CREATE TABLE match_weather (
    match_id        INT PRIMARY KEY REFERENCES matches(match_id),
    temperature_c   NUMERIC(4,1),
    humidity_pct    NUMERIC(4,1),
    condition       VARCHAR(50),
    dew_present     BOOLEAN,
    wind_kph        NUMERIC(4,1)
);

CREATE TABLE match_squads (
    match_id          INT NOT NULL REFERENCES matches(match_id),
    team_id            INT NOT NULL REFERENCES teams(team_id),
    player_id           INT NOT NULL REFERENCES players(player_id),
    is_starting_xi        BOOLEAN NOT NULL DEFAULT TRUE,
    is_impact_sub           BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (match_id, team_id, player_id)
);

CREATE INDEX idx_match_squads_player ON match_squads(player_id);
CREATE INDEX idx_match_squads_team_match ON match_squads(team_id, match_id);

-- =========================================================
-- 3. Innings / over / ball-by-ball facts
-- =========================================================

CREATE TABLE innings (
    innings_id        SERIAL PRIMARY KEY,
    match_id           INT NOT NULL REFERENCES matches(match_id),
    innings_number      SMALLINT NOT NULL,
    batting_team_id      INT NOT NULL REFERENCES teams(team_id),
    bowling_team_id       INT NOT NULL REFERENCES teams(team_id),
    total_runs             SMALLINT,
    total_wickets           SMALLINT,
    total_overs             NUMERIC(4,1),
    UNIQUE (match_id, innings_number)
);

CREATE TABLE overs (
    over_id          SERIAL PRIMARY KEY,
    innings_id        INT NOT NULL REFERENCES innings(innings_id),
    over_number        SMALLINT NOT NULL,
    bowler_id            INT REFERENCES players(player_id),
    runs_conceded          SMALLINT DEFAULT 0,
    wickets                  SMALLINT DEFAULT 0,
    is_maiden                 BOOLEAN DEFAULT FALSE,
    phase VARCHAR(12) GENERATED ALWAYS AS (
        CASE
            WHEN over_number < 6 THEN 'powerplay'
            WHEN over_number < 16 THEN 'middle'
            ELSE 'death'
        END
    ) STORED,
    UNIQUE (innings_id, over_number)
);

CREATE TABLE deliveries (
    delivery_id       BIGSERIAL PRIMARY KEY,
    over_id             INT NOT NULL REFERENCES overs(over_id),
    innings_id            INT NOT NULL REFERENCES innings(innings_id),
    ball_number             SMALLINT NOT NULL,
    striker_id                INT REFERENCES players(player_id),
    non_striker_id              INT REFERENCES players(player_id),
    bowler_id                     INT REFERENCES players(player_id),
    runs_batter                     SMALLINT DEFAULT 0,
    runs_extras                       SMALLINT DEFAULT 0,
    extras_type                         VARCHAR(20),
    runs_total                            SMALLINT DEFAULT 0,
    is_wicket                                BOOLEAN DEFAULT FALSE,
    dismissal_type                             dismissal_type,
    dismissed_player_id                          INT REFERENCES players(player_id),
    fielder_id                                     INT REFERENCES players(player_id)
);
-- Note: phase is not duplicated here -- join to overs.phase when needed,
-- since a delivery's phase is entirely determined by its parent over.

CREATE INDEX idx_deliveries_over ON deliveries(over_id);
CREATE INDEX idx_deliveries_innings ON deliveries(innings_id);
CREATE INDEX idx_deliveries_bowler ON deliveries(bowler_id);
CREATE INDEX idx_deliveries_striker ON deliveries(striker_id);

CREATE TABLE partnerships (
    partnership_id     SERIAL PRIMARY KEY,
    innings_id          INT NOT NULL REFERENCES innings(innings_id),
    wicket_number        SMALLINT NOT NULL,
    batter1_id            INT REFERENCES players(player_id),
    batter2_id             INT REFERENCES players(player_id),
    runs                     SMALLINT,
    batter1_runs               SMALLINT,
    batter2_runs                 SMALLINT,
    balls_faced                    SMALLINT,
    start_over                       NUMERIC(4,1),
    end_over                           NUMERIC(4,1),
    is_unbeaten                          BOOLEAN DEFAULT FALSE,
    ended_by_dismissal_type                dismissal_type
);

CREATE TABLE batting_positions (
    innings_id      INT NOT NULL REFERENCES innings(innings_id),
    player_id        INT NOT NULL REFERENCES players(player_id),
    batting_position   SMALLINT NOT NULL,
    order_group          VARCHAR(12) GENERATED ALWAYS AS (
        CASE
            WHEN batting_position <= 3 THEN 'top'
            WHEN batting_position <= 7 THEN 'middle'
            ELSE 'lower'
        END
    ) STORED,
    PRIMARY KEY (innings_id, player_id)
);

-- =========================================================
-- 4. Pre-aggregated scorecards
-- =========================================================

CREATE TABLE match_batting_scorecard (
    scorecard_id       SERIAL PRIMARY KEY,
    innings_id           INT NOT NULL REFERENCES innings(innings_id),
    player_id             INT NOT NULL REFERENCES players(player_id),
    batting_position         SMALLINT,
    runs                       SMALLINT,
    balls_faced                  SMALLINT,
    fours                           SMALLINT DEFAULT 0,
    sixes                             SMALLINT DEFAULT 0,
    strike_rate                         NUMERIC(6,2),
    dismissal_type                        dismissal_type,
    dismissed_by_bowler_id                  INT REFERENCES players(player_id),
    caught_by_fielder_id                      INT REFERENCES players(player_id),
    UNIQUE (innings_id, player_id)
);

CREATE TABLE match_bowling_scorecard (
    scorecard_id       SERIAL PRIMARY KEY,
    innings_id           INT NOT NULL REFERENCES innings(innings_id),
    player_id             INT NOT NULL REFERENCES players(player_id),
    overs_bowled            NUMERIC(4,1),
    maidens                   SMALLINT DEFAULT 0,
    runs_conceded                SMALLINT,
    wickets                        SMALLINT,
    economy                          NUMERIC(5,2),
    wides                              SMALLINT DEFAULT 0,
    no_balls                             SMALLINT DEFAULT 0,
    UNIQUE (innings_id, player_id)
);

-- =========================================================
-- 5. Indexes
-- =========================================================

CREATE INDEX idx_matches_season ON matches(season_id);
CREATE INDEX idx_matches_venue ON matches(venue_id);
CREATE INDEX idx_matches_teams ON matches(team1_id, team2_id);
CREATE INDEX idx_matches_stage ON matches(stage);
CREATE INDEX idx_player_season_player ON player_season(player_id);
CREATE INDEX idx_player_season_season ON player_season(season_id);
CREATE INDEX idx_innings_match ON innings(match_id);
CREATE INDEX idx_overs_innings ON overs(innings_id);
CREATE INDEX idx_batting_scorecard_player ON match_batting_scorecard(player_id);
CREATE INDEX idx_bowling_scorecard_player ON match_bowling_scorecard(player_id);

-- =========================================================
-- 6. Views
-- =========================================================

CREATE VIEW v_match_summary AS
SELECT
    m.match_id,
    s.season_year,
    m.match_date,
    m.stage,
    t1.team_name AS team1,
    t2.team_name AS team2,
    v.venue_name,
    m.toss_decision,
    tw.team_name AS toss_winner,
    ww.team_name AS winner,
    m.win_margin_runs,
    m.win_margin_wickets
FROM matches m
JOIN seasons s ON s.season_id = m.season_id
JOIN teams t1 ON t1.team_id = m.team1_id
JOIN teams t2 ON t2.team_id = m.team2_id
LEFT JOIN venues v ON v.venue_id = m.venue_id
LEFT JOIN teams tw ON tw.team_id = m.toss_winner_team_id
LEFT JOIN teams ww ON ww.team_id = m.winner_team_id;

CREATE VIEW v_venue_records AS
SELECT
    v.venue_id,
    v.venue_name,
    MAX(i2.total_runs) FILTER (WHERE m.winner_team_id = i2.batting_team_id) AS highest_successful_chase,
    MIN(i2.total_runs) FILTER (WHERE m.winner_team_id = i2.batting_team_id) AS lowest_successful_chase,
    MAX(i1.total_runs) FILTER (WHERE m.winner_team_id = i1.batting_team_id) AS highest_successful_defense,
    MIN(i1.total_runs) FILTER (WHERE m.winner_team_id = i1.batting_team_id) AS lowest_successful_defense,
    SUM(i1.total_runs + COALESCE(i2.total_runs,0)) AS total_runs_at_venue
FROM matches m
JOIN venues v ON v.venue_id = m.venue_id
JOIN innings i1 ON i1.match_id = m.match_id AND i1.innings_number = 1
LEFT JOIN innings i2 ON i2.match_id = m.match_id AND i2.innings_number = 2
GROUP BY v.venue_id, v.venue_name;

CREATE VIEW v_team_records AS
SELECT
    t.team_id,
    t.team_name,
    MAX(i2.total_runs) FILTER (WHERE m.winner_team_id = t.team_id AND i2.batting_team_id = t.team_id) AS highest_successful_chase,
    MIN(i2.total_runs) FILTER (WHERE m.winner_team_id = t.team_id AND i2.batting_team_id = t.team_id) AS lowest_successful_chase,
    MAX(i1.total_runs) FILTER (WHERE m.winner_team_id = t.team_id AND i1.batting_team_id = t.team_id) AS highest_successful_defense,
    MIN(i1.total_runs) FILTER (WHERE m.winner_team_id = t.team_id AND i1.batting_team_id = t.team_id) AS lowest_successful_defense
FROM teams t
JOIN matches m ON t.team_id IN (m.team1_id, m.team2_id)
JOIN innings i1 ON i1.match_id = m.match_id AND i1.innings_number = 1
LEFT JOIN innings i2 ON i2.match_id = m.match_id AND i2.innings_number = 2
GROUP BY t.team_id, t.team_name;

CREATE VIEW v_season_records AS
SELECT
    s.season_id,
    s.season_year,
    COUNT(DISTINCT m.match_id) FILTER (WHERE m.status = 'completed') AS matches_completed,
    COUNT(DISTINCT m.match_id) FILTER (WHERE m.status IN ('cancelled','abandoned')) AS matches_cancelled,
    SUM(i.total_runs) AS total_runs,
    SUM(i.total_wickets) AS total_wickets,
    (SELECT COUNT(*) FROM players p WHERE p.debut_season_id = s.season_id) AS debutant_count
FROM seasons s
LEFT JOIN matches m ON m.season_id = s.season_id
LEFT JOIN innings i ON i.match_id = m.match_id
GROUP BY s.season_id, s.season_year;

CREATE VIEW v_venue_pitch_profile AS
SELECT
    v.venue_id,
    v.venue_name,
    ROUND(AVG(i1.total_runs), 1) AS avg_first_innings_score,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE d.runs_batter IN (4,6)) / NULLIF(COUNT(*),0), 1
    ) AS boundary_pct_of_balls,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE d.is_wicket AND bowler_p.bowler_type = 'spin')
        / NULLIF(COUNT(*) FILTER (WHERE d.is_wicket), 0), 1
    ) AS spin_wicket_pct,
    ROUND(
        100.0 * COUNT(DISTINCT m.match_id) FILTER (WHERE m.winner_team_id = i2.batting_team_id)
        / NULLIF(COUNT(DISTINCT m.match_id) FILTER (WHERE i2.match_id IS NOT NULL), 0), 1
    ) AS chase_success_pct
FROM venues v
JOIN matches m ON m.venue_id = v.venue_id
JOIN innings i1 ON i1.match_id = m.match_id AND i1.innings_number = 1
LEFT JOIN innings i2 ON i2.match_id = m.match_id AND i2.innings_number = 2
LEFT JOIN overs o ON o.innings_id IN (i1.innings_id, i2.innings_id)
LEFT JOIN deliveries d ON d.over_id = o.over_id
LEFT JOIN players bowler_p ON bowler_p.player_id = d.bowler_id
GROUP BY v.venue_id, v.venue_name;

-- =========================================================
-- 7. raw_scraped
-- =========================================================

SET search_path TO raw_scraped, public;

CREATE TABLE player_profiles (
    scrape_id           SERIAL PRIMARY KEY,
    source_player_name  TEXT NOT NULL,
    source_site         TEXT,
    source_player_id     TEXT,
    date_of_birth         TEXT,
    nationality             TEXT,
    role                     TEXT,
    batting_style              TEXT,
    bowling_style                TEXT,
    source_url                    TEXT,
    scraped_at                     TIMESTAMP DEFAULT now()
);

CREATE TABLE venue_details (
    scrape_id       SERIAL PRIMARY KEY,
    venue_name       TEXT NOT NULL,
    city              TEXT,
    capacity            TEXT,
    boundary_length_text TEXT,
    source_url             TEXT,
    scraped_at               TIMESTAMP DEFAULT now()
);

CREATE TABLE match_weather_scraped (
    scrape_id            SERIAL PRIMARY KEY,
    match_external_ref    TEXT,
    match_date              TEXT,
    venue_name                TEXT,
    temperature                 TEXT,
    humidity                      TEXT,
    condition                       TEXT,
    source                            TEXT,
    source_url                         TEXT,
    scraped_at                           TIMESTAMP DEFAULT now()
);

-- =========================================================
-- 8. core
-- =========================================================

SET search_path TO core, public;

CREATE TABLE player_id_map (
    map_id                    SERIAL PRIMARY KEY,
    raw_cricsheet_player_id    INT,
    raw_scraped_player_name     TEXT,
    match_method                  TEXT,
    match_confidence                NUMERIC(4,3),
    reviewed                          BOOLEAN DEFAULT FALSE,
    UNIQUE (raw_cricsheet_player_id, raw_scraped_player_name)
);

RESET search_path;
