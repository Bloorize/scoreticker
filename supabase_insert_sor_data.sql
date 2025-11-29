-- Step 1: Create the table (run this first if you haven't already)
-- Copy the contents from supabase_migration.sql and run it in SQL Editor

-- Step 2: Insert SOR data for teams
-- Update the SOR values from the ESPN FPI Resume page

-- BYU and common matchup teams
-- Insert teams one at a time to avoid duplicate team_id conflicts
INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('252', 'BYU Cougars', 'BYU', 29, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2116', 'UCF Knights', 'UCF', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('103', 'Ohio State Buckeyes', 'Ohio State', 3, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('130', 'Michigan Wolverines', 'Michigan', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('61', 'Georgia Bulldogs', 'Georgia', 4, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2483', 'Oregon Ducks', 'Oregon', 5, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('264', 'Washington Huskies', 'Washington', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2', 'Texas A&M Aggies', 'Texas A&M', 2, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('333', 'Alabama Crimson Tide', 'Alabama', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('99', 'LSU Tigers', 'LSU', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('201', 'Oklahoma Sooners', 'Oklahoma', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('12', 'Arizona Wildcats', 'Arizona', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('9', 'Arizona State Sun Devils', 'Arizona State', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('24', 'Stanford Cardinal', 'Stanford', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('87', 'Notre Dame Fighting Irish', 'Notre Dame', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('221', 'Pittsburgh Panthers', 'Pittsburgh', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2390', 'Miami Hurricanes', 'Miami', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2633', 'Tennessee Volunteers', 'Tennessee', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('238', 'Vanderbilt Commodores', 'Vanderbilt', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('251', 'Texas Longhorns', 'Texas', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('59', 'Georgia Tech Yellow Jackets', 'Georgia Tech', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('66', 'Iowa State Cyclones', 'Iowa State', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('197', 'Oklahoma State Cowboys', 'Oklahoma State', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('151', 'East Carolina Pirates', 'East Carolina', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2226', 'Florida Atlantic Owls', 'FAU', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('254', 'Utah Utes', 'Utah', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2305', 'Kansas Jayhawks', 'Kansas', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('2641', 'Texas Tech Red Raiders', 'Texas Tech', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('277', 'West Virginia Mountaineers', 'West Virginia', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('356', 'Mississippi State Bulldogs', 'Mississippi State', NULL, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

-- Note: Auburn Tigers team_id needs to be verified - removed duplicate team_id '2'
-- Add Auburn separately once you have the correct team_id from ESPN API

-- Note: Replace NULL values with actual SOR values from ESPN FPI Resume page
-- The team_id values above are ESPN team IDs - you may need to verify these match your API data

