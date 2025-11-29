-- Find teams that are likely in top 25 but missing SOR values
-- This helps identify which teams need SOR values updated

-- Show all teams with NULL SOR values (these need to be updated)
SELECT team_id, team_name, team_short_name, sor_value, season
FROM team_sor
WHERE season = 2025
AND sor_value IS NULL
ORDER BY team_name;

-- Count of teams with vs without SOR values
SELECT 
    COUNT(*) FILTER (WHERE sor_value IS NOT NULL) as teams_with_sor,
    COUNT(*) FILTER (WHERE sor_value IS NULL) as teams_without_sor,
    COUNT(*) as total_teams
FROM team_sor
WHERE season = 2025;

