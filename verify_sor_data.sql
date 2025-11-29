-- Verification query: Check if SOR data was inserted successfully
-- Run this in your Supabase SQL Editor to verify the data

-- Count total rows
SELECT COUNT(*) as total_rows FROM team_sor WHERE season = 2025;

-- Count rows with SOR values
SELECT COUNT(*) as rows_with_sor FROM team_sor WHERE season = 2025 AND sor_value IS NOT NULL;

-- Show all teams with their SOR values
SELECT team_id, team_short_name, sor_value, season 
FROM team_sor 
WHERE season = 2025 
ORDER BY sor_value DESC NULLS LAST;

-- Show teams that have SOR values (non-null)
SELECT team_id, team_short_name, sor_value 
FROM team_sor 
WHERE season = 2025 AND sor_value IS NOT NULL
ORDER BY sor_value DESC;

