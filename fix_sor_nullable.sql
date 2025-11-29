-- Fix: Make sor_value nullable so teams without SOR values can be added
-- Run this in Supabase SQL Editor

ALTER TABLE team_sor ALTER COLUMN sor_value DROP NOT NULL;

