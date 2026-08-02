-- Patch for an already-running thirdumpire database.
-- Adds: wicketkeeper flag, second fielder slot, venue coordinates.

SET search_path TO raw_cricsheet, public;

ALTER TABLE match_squads ADD COLUMN is_wicketkeeper BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX idx_one_keeper_per_team_match
    ON match_squads (match_id, team_id) WHERE is_wicketkeeper;

ALTER TABLE deliveries ADD COLUMN fielder2_id INT REFERENCES players(player_id);

UPDATE venues SET latitude = 31.5138, longitude = 74.3306 WHERE venue_name = 'Gaddafi Stadium';
UPDATE venues SET latitude = 24.8949, longitude = 67.0654 WHERE venue_name = 'National Stadium';
UPDATE venues SET latitude = 30.1866, longitude = 71.4306 WHERE venue_name = 'Multan Cricket Stadium';
UPDATE venues SET latitude = 33.6255, longitude = 73.0273 WHERE venue_name = 'Rawalpindi Cricket Stadium';
UPDATE venues SET latitude = 25.0459, longitude = 55.2211 WHERE venue_name = 'Dubai International Cricket Stadium';
UPDATE venues SET latitude = 25.3316, longitude = 55.4086 WHERE venue_name = 'Sharjah Cricket Stadium';
UPDATE venues SET latitude = 24.4433, longitude = 54.5334 WHERE venue_name = 'Sheikh Zayed Stadium';

RESET search_path;
