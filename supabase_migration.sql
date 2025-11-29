-- Migration: Create team_sor table for storing Strength of Record values
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS team_sor (
  id BIGSERIAL PRIMARY KEY,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_short_name TEXT,
  sor_value INTEGER, -- Made nullable so teams without SOR values can still be added
  season INTEGER DEFAULT 2025,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season)
);

CREATE INDEX IF NOT EXISTS idx_team_sor_team_id ON team_sor(team_id);
CREATE INDEX IF NOT EXISTS idx_team_sor_short_name ON team_sor(team_short_name);
CREATE INDEX IF NOT EXISTS idx_team_sor_season ON team_sor(season);

-- Enable RLS
ALTER TABLE team_sor ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since this is public data)
-- Only create policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_sor' 
    AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON team_sor
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Insert sample data (BYU example)
INSERT INTO team_sor (team_id, team_name, team_short_name, sor_value, season)
VALUES ('252', 'BYU Cougars', 'BYU', 29, 2025)
ON CONFLICT (team_id, season) DO UPDATE SET sor_value = EXCLUDED.sor_value, updated_at = NOW();

