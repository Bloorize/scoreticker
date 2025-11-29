-- Create college_football_fpi table if it doesn't exist
CREATE TABLE IF NOT EXISTS college_football_fpi (
  id BIGSERIAL PRIMARY KEY,
  rank INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  conference TEXT,
  wins INTEGER,
  losses INTEGER,
  fpi_score NUMERIC,
  strength_of_schedule_rank INTEGER,
  strength_of_record_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_name)
);

CREATE INDEX IF NOT EXISTS idx_college_football_fpi_team_name ON college_football_fpi(team_name);
CREATE INDEX IF NOT EXISTS idx_college_football_fpi_rank ON college_football_fpi(rank);

-- Enable RLS
ALTER TABLE college_football_fpi ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'college_football_fpi' 
    AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON college_football_fpi
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Insert/Update the top 20 teams data
INSERT INTO college_football_fpi (rank, team_name, conference, wins, losses, fpi_score, strength_of_schedule_rank, strength_of_record_rank) VALUES
(1, 'Alabama', 'SEC', 11, 1, 29.8, 1, 1),
(2, 'Texas', 'SEC', 11, 1, 28.3, 4, 2),
(3, 'Ohio State', 'Big Ten', 10, 2, 27.7, 7, 5),
(4, 'Georgia', 'SEC', 10, 2, 25.1, 3, 3),
(5, 'Ole Miss', 'SEC', 10, 2, 23.4, 6, 6),
(6, 'Notre Dame', 'IA Ind', 11, 1, 22.8, 38, 4),
(7, 'Penn State', 'Big Ten', 11, 1, 22.1, 29, 7),
(8, 'Tennessee', 'SEC', 10, 2, 21.0, 15, 8),
(9, 'Oregon', 'Big Ten', 12, 0, 20.8, 19, 9),
(10, 'Miami', 'ACC', 10, 2, 19.5, 52, 11),
(11, 'Indiana', 'Big Ten', 11, 1, 19.2, 59, 10),
(12, 'Clemson', 'ACC', 9, 3, 17.5, 34, 18),
(13, 'Texas A&M', 'SEC', 8, 4, 16.8, 11, 15),
(14, 'SMU', 'ACC', 11, 1, 16.5, 68, 12),
(15, 'USC', 'Big Ten', 6, 6, 15.3, 2, 33),
(16, 'South Carolina', 'SEC', 8, 4, 15.1, 5, 14),
(17, 'LSU', 'SEC', 8, 4, 14.5, 13, 16),
(18, 'Louisville', 'ACC', 7, 5, 13.9, 18, 23),
(19, 'Iowa State', 'Big 12', 10, 2, 12.5, 51, 13),
(20, 'Boise State', 'MW', 11, 1, 12.4, 63, 17)
ON CONFLICT (team_name) DO UPDATE SET
  rank = EXCLUDED.rank,
  conference = EXCLUDED.conference,
  wins = EXCLUDED.wins,
  losses = EXCLUDED.losses,
  fpi_score = EXCLUDED.fpi_score,
  strength_of_schedule_rank = EXCLUDED.strength_of_schedule_rank,
  strength_of_record_rank = EXCLUDED.strength_of_record_rank,
  updated_at = NOW();

