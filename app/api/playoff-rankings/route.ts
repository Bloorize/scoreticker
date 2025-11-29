import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Fetch rankings from ESPN API (server-side, no CORS issues)
        const timestamp = Date.now();
        const rankingsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings?_=${timestamp}`;
        
        const rankingsResponse = await fetch(rankingsUrl, {
            next: { revalidate: 60 }, // Revalidate every 60 seconds
        });
        
        if (!rankingsResponse.ok) {
            throw new Error(`ESPN rankings API failed: ${rankingsResponse.status}`);
        }
        
        const rankingsData = await rankingsResponse.json();
        
        // First, try to extract records from rankings data itself
        let teamRecordsMap: Record<string, string> = {};
        if (rankingsData.rankings) {
            rankingsData.rankings.forEach((poll: any) => {
                if (poll.ranks) {
                    poll.ranks.forEach((rank: any) => {
                        const team = rank.team;
                        const teamName = team?.displayName || team?.name;
                        // Check if record is in rank object
                        const record = rank.record?.summary ||
                                     rank.stats?.find((s: any) => s.name === 'overall' || s.type === 'overall')?.displayValue ||
                                     (rank.wins !== undefined && rank.losses !== undefined ? `${rank.wins}-${rank.losses}` : null);
                        if (teamName && record) {
                            teamRecordsMap[teamName] = record;
                        }
                    });
                }
            });
        }
        
        console.log(`📋 Extracted ${Object.keys(teamRecordsMap).length} records from rankings`);
        
        // Fetch scoreboard to get team records (most reliable source)
        // Fetch current week's scoreboard - this should have records for all teams playing
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        
        // Also fetch a range of dates to catch more teams
        const scoreboardPromises = [];
        for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
            const fetchDate = new Date(today);
            fetchDate.setDate(fetchDate.getDate() - dayOffset);
            const fetchYear = fetchDate.getFullYear();
            const fetchMonth = String(fetchDate.getMonth() + 1).padStart(2, '0');
            const fetchDay = String(fetchDate.getDate()).padStart(2, '0');
            const fetchDateStr = `${fetchYear}${fetchMonth}${fetchDay}`;
            
            scoreboardPromises.push(
                fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${fetchDateStr}&limit=300&_=${timestamp}`, {
                    next: { revalidate: 60 },
                }).then(res => res.ok ? res.json() : null).catch(() => null)
            );
        }
        
        const scoreboardResults = await Promise.all(scoreboardPromises);
        
        // Extract records from scoreboard games - use team ID as key for better matching
        const teamRecordsById: Record<string, { name: string; record: string }> = {};
        
        scoreboardResults.forEach((scoreboardData: any) => {
            if (scoreboardData?.events) {
                scoreboardData.events.forEach((event: any) => {
                    const competition = event.competitions?.[0];
                    if (competition) {
                        competition.competitors?.forEach((competitor: any) => {
                            const teamId = competitor.team?.id;
                            const teamName = competitor.team?.displayName;
                            const record = competitor.records?.[0]?.summary;
                            
                            if (teamId && teamName && record) {
                                // Store by both ID and name for flexible lookup
                                teamRecordsById[teamId] = { name: teamName, record };
                                if (!teamRecordsMap[teamName]) {
                                    teamRecordsMap[teamName] = record;
                                }
                            }
                        });
                    }
                });
            }
        });
        
        console.log(`📋 Extracted ${Object.keys(teamRecordsMap).length} records from scoreboard (${Object.keys(teamRecordsById).length} by ID)`);
        
        // Also try standings API as backup
        const standingsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/standings?_=${timestamp}`;
        const standingsResponse = await fetch(standingsUrl, {
            next: { revalidate: 60 },
        });
        
        if (standingsResponse.ok) {
            const standingsData = await standingsResponse.json();
            
            // Try multiple possible structures
            if (standingsData.children) {
                standingsData.children.forEach((conference: any) => {
                    if (conference.children) {
                        conference.children.forEach((division: any) => {
                            if (division.standings && division.standings.entries) {
                                division.standings.entries.forEach((entry: any) => {
                                    const teamName = entry.team?.displayName || entry.team?.name;
                                    // Try multiple stat locations
                                    const record = entry.stats?.find((s: any) => s.name === 'overall')?.displayValue ||
                                                  entry.stats?.find((s: any) => s.type === 'overall')?.displayValue ||
                                                  entry.record?.summary ||
                                                  entry.overallRecord;
                                    if (teamName && record && !teamRecordsMap[teamName]) {
                                        teamRecordsMap[teamName] = record;
                                    }
                                });
                            }
                            // Also check if entries are directly on division
                            if (division.entries) {
                                division.entries.forEach((entry: any) => {
                                    const teamName = entry.team?.displayName || entry.team?.name;
                                    const record = entry.stats?.find((s: any) => s.name === 'overall')?.displayValue ||
                                                  entry.record?.summary;
                                    if (teamName && record && !teamRecordsMap[teamName]) {
                                        teamRecordsMap[teamName] = record;
                                    }
                                });
                            }
                        });
                    }
                    // Also check if entries are directly on conference
                    if (conference.standings?.entries) {
                        conference.standings.entries.forEach((entry: any) => {
                            const teamName = entry.team?.displayName || entry.team?.name;
                            const record = entry.stats?.find((s: any) => s.name === 'overall')?.displayValue ||
                                          entry.record?.summary;
                            if (teamName && record && !teamRecordsMap[teamName]) {
                                teamRecordsMap[teamName] = record;
                            }
                        });
                    }
                });
            }
            
            console.log(`📋 Total records after standings: ${Object.keys(teamRecordsMap).length}`);
        } else {
            console.warn('⚠️ Standings API failed:', standingsResponse.status);
        }
        
        return NextResponse.json({
            rankings: rankingsData,
            records: teamRecordsMap,
            recordsById: teamRecordsById, // Also return by ID for better matching
        });
    } catch (error) {
        console.error('Error fetching playoff rankings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch rankings' },
            { status: 500 }
        );
    }
}

