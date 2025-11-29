'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, ToggleLeft, ToggleRight, Info, X } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// --- Types ---
interface PlayoffTeam {
    rank: number;
    name: string;
    shortName: string;
    logo: string;
    color: string;
    record: string;
    sor?: number | null;
    conference?: string;
    wins?: number;
    losses?: number;
}

interface BracketTeam extends PlayoffTeam {
    seed: number;
    id: string;
    fairRankScore?: number; // Score from fair ranking formula
}

interface TeamWithScore extends BracketTeam {
    fairRankScore: number;
}

// Current playoff rankings (will be replaced with API data later)
// Expanded list to include more teams for fair ranking comparison
const CURRENT_PLAYOFF_TEAMS: PlayoffTeam[] = [
    { rank: 1, name: 'Ohio State Buckeyes', shortName: 'Ohio State', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png', color: '#0062B8', record: '11-1', sor: 16, conference: 'Big Ten' },
    { rank: 2, name: 'Indiana Hoosiers', shortName: 'Indiana', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png', color: '#990000', record: '11-1', sor: 2, conference: 'Big Ten' },
    { rank: 3, name: 'Texas A&M Aggies', shortName: 'Texas A&M', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png', color: '#500000', record: '10-2', sor: 10, conference: 'SEC' },
    { rank: 4, name: 'Georgia Bulldogs', shortName: 'Georgia', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png', color: '#A020F0', record: '10-2', sor: 6, conference: 'SEC' },
    { rank: 5, name: 'Texas Tech Red Raiders', shortName: 'Texas Tech', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png', color: '#CC0000', record: '10-2', sor: 17, conference: 'Big 12' },
    { rank: 6, name: 'Oregon Ducks', shortName: 'Oregon', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png', color: '#154733', record: '11-1', sor: 12, conference: 'Big Ten' },
    { rank: 7, name: 'Ole Miss Rebels', shortName: 'Ole Miss', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png', color: '#00205B', record: '10-2', sor: 23, conference: 'SEC' },
    { rank: 8, name: 'Oklahoma Sooners', shortName: 'Oklahoma', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png', color: '#841617', record: '10-2', sor: 15, conference: 'SEC' },
    { rank: 9, name: 'Notre Dame Fighting Irish', shortName: 'Notre Dame', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png', color: '#0C2340', record: '10-2', sor: 41, conference: 'FBS Indep.' },
    { rank: 10, name: 'Alabama Crimson Tide', shortName: 'Alabama', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png', color: '#9E1B32', record: '10-2', sor: 5, conference: 'SEC' },
    { rank: 11, name: 'Miami Hurricanes', shortName: 'Miami', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png', color: '#F47321', record: '10-2', sor: 15, conference: 'ACC' },
    { rank: 12, name: 'Tulane Green Wave', shortName: 'Tulane', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png', color: '#006747', record: '11-1', sor: 56, conference: 'American' },
    // Additional teams for fair ranking comparison
    { rank: 13, name: 'BYU Cougars', shortName: 'BYU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png', color: '#002E5D', record: '9-3', sor: 35, conference: 'Big 12' },
    { rank: 14, name: 'Texas Longhorns', shortName: 'Texas', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png', color: '#BF5700', record: '10-2', sor: 10, conference: 'SEC' },
    { rank: 15, name: 'Penn State Nittany Lions', shortName: 'Penn State', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png', color: '#041E42', record: '11-1', sor: 52, conference: 'Big Ten' },
    { rank: 16, name: 'USC Trojans', shortName: 'USC', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png', color: '#990000', record: '9-3', sor: 12, conference: 'Big Ten' },
    { rank: 17, name: 'Clemson Tigers', shortName: 'Clemson', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png', color: '#F66733', record: '9-3', sor: 46, conference: 'ACC' },
];

const PlayoffsPage = () => {
    const [useRealRankings, setUseRealRankings] = useState(true);
    const [teams, setTeams] = useState<BracketTeam[]>([]);
    const [allTeams, setAllTeams] = useState<BracketTeam[]>([]); // All teams for fair ranking
    const [loading, setLoading] = useState(true);
    const [showFormulaModal, setShowFormulaModal] = useState(false);
    const [first2Out, setFirst2Out] = useState<BracketTeam[]>([]); // Next 2 teams that would be in

    // Team logo/color mapping (will be enhanced with API data later)
    const teamMetadata: Record<string, { logo: string; color: string; shortName: string }> = {
        'Indiana Hoosiers': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png', color: '#990000', shortName: 'Indiana' },
        'Texas A&M Aggies': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png', color: '#500000', shortName: 'Texas A&M' },
        'Ohio State Buckeyes': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png', color: '#0062B8', shortName: 'Ohio State' },
        'Georgia Bulldogs': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png', color: '#A020F0', shortName: 'Georgia' },
        'Oregon Ducks': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png', color: '#154733', shortName: 'Oregon' },
        'Ole Miss Rebels': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png', color: '#00205B', shortName: 'Ole Miss' },
        'BYU Cougars': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png', color: '#002E5D', shortName: 'BYU' },
        'Oklahoma Sooners': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png', color: '#841617', shortName: 'Oklahoma' },
        'Alabama Crimson Tide': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png', color: '#9E1B32', shortName: 'Alabama' },
        'Texas Tech Red Raiders': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png', color: '#CC0000', shortName: 'Texas Tech' },
        'Texas Longhorns': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png', color: '#BF5700', shortName: 'Texas' },
        'Vanderbilt Commodores': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png', color: '#866D4B', shortName: 'Vanderbilt' },
        'Notre Dame Fighting Irish': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png', color: '#0C2340', shortName: 'Notre Dame' },
        'Michigan Wolverines': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png', color: '#FFCB05', shortName: 'Michigan' },
        'Utah Utes': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png', color: '#CC0000', shortName: 'Utah' },
        'Miami Hurricanes': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png', color: '#F47321', shortName: 'Miami' },
        'USC Trojans': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png', color: '#990000', shortName: 'USC' },
        'Tennessee Volunteers': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png', color: '#FF8200', shortName: 'Tennessee' },
        'Tulane Green Wave': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png', color: '#006747', shortName: 'Tulane' },
        'Penn State Nittany Lions': { logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png', color: '#041E42', shortName: 'Penn State' },
    };

    // Parse record string (e.g., "11-1" or "10-2") into wins and losses
    const parseRecord = (record: string): { wins: number; losses: number } => {
        const match = record.match(/(\d+)-(\d+)/);
        if (match) {
            return { wins: parseInt(match[1]), losses: parseInt(match[2]) };
        }
        return { wins: 0, losses: 0 };
    };

    // Fetch live team data from ESPN API and match with SOR data from Supabase
    const fetchTeamsFromDatabase = async () => {
        try {
            setLoading(true);
            
            // Step 1: Fetch SOR data from Supabase
            const { data: sorData, error: sorError } = await supabase
                .from('team_strength_of_record')
                .select('team_name, conference, sor_rank, rank_id');

            if (sorError) {
                // Silently handle SOR data fetch error
            }

            // Step 2: Fetch live rankings and records from our API route (avoids CORS)
            const apiResponse = await fetch('/api/playoff-rankings', {
                cache: 'no-store',
            });
            
            if (!apiResponse.ok) {
                throw new Error(`Failed to fetch rankings: ${apiResponse.status}`);
            }
            
            const { rankings: rankingsData, records: teamRecordsMapFromAPI, recordsById: recordsByIdFromAPI } = await apiResponse.json();
            
            // Step 2b: Also fetch scoreboard directly (same as main page) to get most up-to-date records
            // Use the EXACT SAME URL as main page for consistency
            // Main page uses: dates=20251128-20251130&limit=200&groups=80
            const mainPageScoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20251128-20251130&limit=200&groups=80';
            
            // Fetch using the exact same URL as main page
            const mainPageScoreboardResponse = await fetch(mainPageScoreboardUrl, {
                cache: 'no-store',
            });
            
            let mainPageScoreboardData = null;
            if (mainPageScoreboardResponse.ok) {
                mainPageScoreboardData = await mainPageScoreboardResponse.json();
            }
            
            // Also fetch recent days to catch any updates
            const today = new Date();
            const recentDates: string[] = [];
            for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
                const fetchDate = new Date(today);
                fetchDate.setDate(fetchDate.getDate() - dayOffset);
                const year = fetchDate.getFullYear();
                const month = String(fetchDate.getMonth() + 1).padStart(2, '0');
                const day = String(fetchDate.getDate()).padStart(2, '0');
                recentDates.push(`${year}${month}${day}`);
            }
            
            const recentScoreboardPromises = recentDates.map(date => 
                fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}&limit=300&groups=80`, {
                    cache: 'no-store',
                }).then(res => res.ok ? res.json() : null).catch(() => null)
            );
            
            const recentScoreboardResults = await Promise.all(recentScoreboardPromises);
            
            // Combine main page data with recent data (main page data first, then recent)
            const allScoreboardData = mainPageScoreboardData ? [mainPageScoreboardData, ...recentScoreboardResults] : recentScoreboardResults;
            
            // Extract records from scoreboard (same method as main page: competitor.records?.[0]?.summary)
            // Process in reverse order (most recent first) and ALWAYS overwrite with latest record
            const scoreboardRecordsById: Record<string, string> = {};
            const scoreboardRecordsByDate: Record<string, { date: string; record: string }> = {};
            
            // Process results in reverse order (most recent first)
            allScoreboardData.reverse().forEach((scoreboardData: any, dayIndex: number) => {
                const dateStr = dayIndex === 0 && mainPageScoreboardData ? 'main-page-range' : recentDates[Math.max(0, dayIndex - (mainPageScoreboardData ? 1 : 0))] || 'unknown';
                if (scoreboardData?.events) {
                    scoreboardData.events.forEach((event: any) => {
                        const competition = event.competitions?.[0];
                        if (competition) {
                            competition.competitors?.forEach((competitor: any) => {
                                const teamId = competitor.team?.id;
                                const record = competitor.records?.[0]?.summary; // Same as main page
                                
                                // Also try to get record from stats if summary is not available
                                const recordFromStats = competitor.stats?.find((s: any) => 
                                    s.name === 'overall' || s.type === 'overall'
                                )?.displayValue;
                                
                                const finalRecord = record || recordFromStats;
                                
                                if (teamId && finalRecord) {
                                    // Convert to string for consistent key matching
                                    const teamIdStr = String(teamId);
                                    
                                    // Track records by date for debugging
                                    if (!scoreboardRecordsByDate[teamIdStr] || dayIndex === 0) {
                                        scoreboardRecordsByDate[teamIdStr] = { date: dateStr, record: finalRecord };
                                    }
                                    
                                    // Prioritize main page data source (first in array when mainPageScoreboardData exists)
                                    // The main page data is the most reliable source
                                    const isMainPageData = mainPageScoreboardData && dayIndex === (allScoreboardData.length - 1);
                                    
                                    if (isMainPageData) {
                                        // Main page data - always use this (same source as main page shows 11-1)
                                        scoreboardRecordsById[teamIdStr] = finalRecord;
                                    } else if (!scoreboardRecordsById[teamIdStr]) {
                                        // Only use other dates if we don't have a record yet
                                        scoreboardRecordsById[teamIdStr] = finalRecord;
                                    }
                                }
                            });
                        }
                    });
                }
            });
            
            
            // Step 3: Initialize team records map - prioritize scoreboard records (same as main page)
            const teamRecordsMap: Record<string, string> = teamRecordsMapFromAPI || {};
            const teamRecordsById: Record<string, { name: string; record: string }> = {};
            
            // First populate from scoreboard (most reliable, same as main page)
            // Ensure team IDs are strings for consistent matching
            Object.entries(scoreboardRecordsById).forEach(([teamId, record]) => {
                const teamIdStr = String(teamId); // Ensure string key
                const existing = recordsByIdFromAPI?.[teamIdStr] || recordsByIdFromAPI?.[teamId];
                teamRecordsById[teamIdStr] = { 
                    name: existing?.name || `Team ${teamIdStr}`, 
                    record 
                };
            });
            
            // Then add any missing from API route
            if (recordsByIdFromAPI) {
                Object.entries(recordsByIdFromAPI).forEach(([teamId, data]) => {
                    if (!teamRecordsById[teamId] && data && typeof data === 'object' && 'record' in data) {
                        teamRecordsById[teamId] = data as { name: string; record: string };
                    }
                });
            }
            

            // Step 4: Process rankings data
            const teamsFromAPI: BracketTeam[] = [];
            
            // ESPN returns rankings in different polls, get the CFP or AP poll
            const polls = rankingsData.rankings || [];
            const cfpPoll = polls.find((p: any) => 
                p.name?.toLowerCase().includes('cfp') || 
                p.name?.toLowerCase().includes('playoff') ||
                p.name?.toLowerCase().includes('college football playoff')
            ) || polls.find((p: any) => p.name?.toLowerCase().includes('ap')) || polls[0];
            
            if (cfpPoll && cfpPoll.ranks) {
                cfpPoll.ranks.forEach((rank: any, index: number) => {
                    const team = rank.team;
                    if (!team) {
                        return;
                    }
                    
                    const teamName = team.displayName || team.name || `Team ${index + 1}`;
                    const shortName = team.shortDisplayName || team.abbreviation || teamName.split(' ')[0];
                    const teamId = team.id;
                    
                    // Get record - For Texas A&M, prioritize rankings API (more up-to-date)
                    // For other teams, prioritize scoreboard (same as main page)
                    let record = '0-0';
                    
                    // Convert teamId to string for consistent matching
                    const teamIdStr = String(teamId);
                    
                    // Special handling for Texas A&M - rankings API is more up-to-date
                    if (teamIdStr === '245' || teamName?.toLowerCase().includes('texas a&m') || teamName?.toLowerCase().includes('aggies')) {
                        // For Texas A&M, check rankings first (more likely to be updated)
                        if (rank.record?.summary) {
                            record = rank.record.summary;
                        } else if (rank.stats) {
                            const overallStat = rank.stats.find((s: any) => 
                                s.name === 'overall' || s.name === 'record' || s.type === 'overall'
                            );
                            if (overallStat?.displayValue) {
                                record = overallStat.displayValue;
                            }
                        } else if (teamIdStr && teamRecordsById[teamIdStr]) {
                            record = teamRecordsById[teamIdStr].record;
                        } else if (teamName && teamRecordsMap[teamName]) {
                            record = teamRecordsMap[teamName];
                        }
                    } else {
                        // For other teams, prioritize scoreboard (same as main page)
                        // Method 1: Check by team ID first (MOST RELIABLE - from scoreboard, same as main page)
                        if (teamIdStr && teamRecordsById[teamIdStr]) {
                            record = teamRecordsById[teamIdStr].record;
                        } else if (teamId && teamRecordsById[String(teamId)]) {
                            record = teamRecordsById[String(teamId)].record;
                        } else if (teamId && typeof teamId === 'number' && teamRecordsById[teamId.toString()]) {
                            record = teamRecordsById[teamId.toString()].record;
                        }
                        // Method 2: Check teamRecordsMap by name (from scoreboard/standings)
                        else if (teamName && teamRecordsMap[teamName]) {
                            record = teamRecordsMap[teamName];
                        }
                        // Method 3: Check rank.record directly (from rankings API - fallback)
                        else if (rank.record?.summary) {
                            record = rank.record.summary;
                        }
                        // Method 4: Check rank.stats array (from rankings API - fallback)
                        else if (Array.isArray(rank.stats)) {
                            const overallStat = rank.stats.find((s: any) => 
                                s.name === 'overall' || 
                                s.name === 'record' ||
                                s.type === 'overall'
                            );
                            if (overallStat?.displayValue) {
                                record = overallStat.displayValue;
                            }
                        }
                        // Method 5: Check team.record (from rankings API - fallback)
                        else if (team.record?.summary) {
                            record = team.record.summary;
                        }
                        // Method 6: Try to construct from wins/losses if available (from rankings API - fallback)
                        else if (rank.wins !== undefined && rank.losses !== undefined) {
                            record = `${rank.wins}-${rank.losses}`;
                        }
                        else if (team.wins !== undefined && team.losses !== undefined) {
                            record = `${team.wins}-${team.losses}`;
                        }
                    }
                    
                    
                    // Find matching SOR data - try multiple matching strategies
                    let sorMatch = sorData?.find((s: any) => {
                        if (!s.team_name || !teamName) return false;
                        
                        const dbName = s.team_name.toLowerCase();
                        const apiName = teamName.toLowerCase();
                        const dbShort = dbName.split(' ')[0];
                        const apiShort = shortName.toLowerCase();
                        
                        return dbName === apiName ||
                               dbName.includes(apiShort) ||
                               apiName.includes(dbShort) ||
                               (dbName.includes('byu') && apiName.includes('brigham')) ||
                               (dbName.includes('texas a&m') && apiName.includes('texas a&m')) ||
                               (dbName.includes('ole miss') && apiName.includes('mississippi') && !apiName.includes('state')) ||
                               (dbName.includes('texas tech') && (apiName.includes('texas tech') || apiName.includes('red raiders'))) ||
                               (dbName.includes('red raiders') && (apiName.includes('texas tech') || apiName.includes('red raiders')));
                    });
                    
                    // Special case: Texas Tech by team ID (2641)
                    if (!sorMatch && (team.id === '2641' || team.id === 2641)) {
                        sorMatch = sorData?.find((s: any) => {
                            const dbName = (s.team_name || '').toLowerCase();
                            return dbName.includes('texas tech') || dbName.includes('red raiders') || dbName === 'texas tech';
                        });
                    }
                    
                    // Use team ID as unique identifier (format: "team-{id}")
                    const teamIdString = `team-${team.id}`;
                    
                    // Check teamMetadata for logo/color override (more reliable than API)
                    // Try multiple name variations to catch different API formats
                    let metadata = teamMetadata[teamName] || 
                                  teamMetadata[team.shortDisplayName] || 
                                  teamMetadata[team.name] ||
                                  null;
                    
                    // Aggressive matching for Texas A&M (check name variations)
                    if (!metadata) {
                        const nameLower = teamName.toLowerCase();
                        const shortLower = (team.shortDisplayName || '').toLowerCase();
                        if (nameLower.includes('texas a&m') || nameLower.includes('aggies') || 
                            shortLower.includes('texas a&m') || shortLower.includes('aggies') ||
                            nameLower.includes('tamu') || shortLower.includes('tamu')) {
                            metadata = teamMetadata['Texas A&M Aggies'];
                        }
                    }
                    
                    // Direct team ID check for known teams (Texas A&M = ID 245)
                    if (!metadata && (team.id === '245' || team.id === 245)) {
                        metadata = teamMetadata['Texas A&M Aggies'];
                    }
                    
                    // Check if this team already exists (by ID or name)
                    const existingTeam = teamsFromAPI.find(t => 
                        t.id === teamIdString || 
                        t.name === teamName ||
                        (t.id && t.id.includes(team.id))
                    );
                    
                    if (!existingTeam) {
                        // Force correct logo for Texas A&M - never trust API logo if name matches
                        let finalLogo = metadata?.logo || team.logo || `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`;
                        const nameLower = teamName.toLowerCase();
                        if ((nameLower.includes('texas a&m') || nameLower.includes('aggies')) && metadata?.logo) {
                            finalLogo = metadata.logo; // Force Texas A&M logo
                        }
                        
                        
                        teamsFromAPI.push({
                            rank: rank.current || (index + 1),
                            name: teamName,
                            shortName: metadata?.shortName || shortName,
                            // Use metadata logo if available, otherwise API logo, otherwise construct from ID
                            logo: finalLogo,
                            color: metadata?.color || (team.color ? `#${team.color}` : '#666666'),
                            record: record, // This should be from scoreboard (11-1 for Texas A&M)
                            sor: sorMatch?.sor_rank || null,
                            conference: getCorrectConference(teamName, team.id, sorMatch?.conference || team.conference?.name || rank.conference || 'Unknown'),
                            seed: rank.current || (index + 1),
                            id: teamIdString,
                        });
                    } else {
                        // Update existing team with better data if available
                        // ALWAYS update record from scoreboard (most recent source)
                        if (record && record !== '0-0' && (teamRecordsById[teamIdStr] || teamRecordsMap[teamName])) {
                            // Only update if we have scoreboard data (most reliable)
                            existingTeam.record = record;
                            
                        }
                        if (!existingTeam.sor && sorMatch?.sor_rank) {
                            existingTeam.sor = sorMatch.sor_rank;
                        }
                        if (!existingTeam.conference || existingTeam.conference === 'Unknown') {
                            existingTeam.conference = getCorrectConference(teamName, team.id, sorMatch?.conference || team.conference?.name || rank.conference || 'Unknown');
                        }
                        // Update logo/color from metadata if available (fixes incorrect API logos)
                        if (metadata) {
                            if (metadata.logo) existingTeam.logo = metadata.logo;
                            if (metadata.color) existingTeam.color = metadata.color;
                            if (metadata.shortName) existingTeam.shortName = metadata.shortName;
                        }
                        // Force correct logo for Texas A&M even if metadata wasn't found initially
                        const nameLower = existingTeam.name.toLowerCase();
                        if ((nameLower.includes('texas a&m') || nameLower.includes('aggies')) && teamMetadata['Texas A&M Aggies']) {
                            existingTeam.logo = teamMetadata['Texas A&M Aggies'].logo;
                            existingTeam.color = teamMetadata['Texas A&M Aggies'].color;
                        }
                    }
                });
            } else {
            }

            // Step 5: Deduplicate teams by team ID (extract ESPN ID from team.id)
            // Create a map to track unique teams by their ESPN team ID
            const uniqueTeamsMap = new Map<string, BracketTeam>();
            
            teamsFromAPI.forEach(team => {
                // Extract ESPN team ID from team.id (format: "team-194" -> "194")
                const espnTeamId = team.id?.replace('team-', '') || team.id || team.name;
                
                if (!uniqueTeamsMap.has(espnTeamId)) {
                    uniqueTeamsMap.set(espnTeamId, team);
                } else {
                    // If duplicate found, merge data (keep best of both)
                    const existing = uniqueTeamsMap.get(espnTeamId)!;
                    const merged: BracketTeam = {
                        ...existing,
                        // Keep SOR if either has it
                        sor: existing.sor || team.sor || null,
                        // Keep better record
                        record: existing.record === '0-0' ? team.record : existing.record,
                        // Keep rank if available
                        rank: existing.rank || team.rank,
                        // Keep conference
                        conference: existing.conference !== 'Unknown' ? existing.conference : team.conference,
                    };
                    uniqueTeamsMap.set(espnTeamId, merged);
                }
            });
            
            // Convert map back to array
            const deduplicatedTeams = Array.from(uniqueTeamsMap.values());
            
            return deduplicatedTeams.length > 0 ? deduplicatedTeams : CURRENT_PLAYOFF_TEAMS;
        } catch (err) {
            return CURRENT_PLAYOFF_TEAMS;
        } finally {
            setLoading(false);
        }
    };

    // Determine if conference is Power 4 (Pac-12 is no longer Power conference)
    const isPower4 = (conference?: string): boolean => {
        if (!conference) return false; // Default to false if unknown
        const p4Conferences = ['SEC', 'Big Ten', 'Big 12', 'ACC'];
        return p4Conferences.some(p4 => conference.includes(p4));
    };

    // Fix incorrect conference assignments from API
    const getCorrectConference = (teamName: string, teamId: string | number, currentConference: string): string => {
        const nameLower = teamName.toLowerCase();
        const id = String(teamId);
        
        // Known team ID to conference mappings
        const teamConferenceMap: Record<string, string> = {
            '61': 'SEC', // Georgia
            '194': 'Big Ten', // Ohio State
            '84': 'Big Ten', // Indiana
            '245': 'SEC', // Texas A&M
            '2641': 'Big 12', // Texas Tech
            '252': 'Big 12', // BYU
            '254': 'Big 12', // Utah
            '201': 'SEC', // Oklahoma (now SEC)
            '251': 'SEC', // Texas (now SEC)
            '333': 'SEC', // Alabama
            '145': 'SEC', // Ole Miss
            '238': 'SEC', // Vanderbilt
            '130': 'Big Ten', // Michigan
            '87': 'FBS Indep.', // Notre Dame
            '2390': 'ACC', // Miami
            '258': 'ACC', // Virginia
            '2567': 'ACC', // SMU
            '221': 'ACC', // Pittsburgh
            '59': 'ACC', // Georgia Tech
            '2483': 'Big Ten', // Oregon
            '9': 'Big Ten', // Arizona State
            '12': 'Big Ten', // Arizona
            '30': 'Big Ten', // USC
        };
        
        // Check team ID first (most reliable)
        if (teamConferenceMap[id]) {
            return teamConferenceMap[id];
        }
        
        // Fallback to name-based detection
        if (nameLower.includes('georgia') && !nameLower.includes('tech')) return 'SEC';
        if (nameLower.includes('texas tech') || nameLower.includes('red raiders')) return 'Big 12';
        if (nameLower.includes('texas a&m') || nameLower.includes('aggies')) return 'SEC';
        if (nameLower.includes('ohio state') || nameLower.includes('buckeyes')) return 'Big Ten';
        if (nameLower.includes('indiana') || nameLower.includes('hoosiers')) return 'Big Ten';
        if (nameLower.includes('alabama') || nameLower.includes('crimson tide')) return 'SEC';
        if (nameLower.includes('ole miss') || nameLower.includes('rebels')) return 'SEC';
        if (nameLower.includes('vanderbilt') || nameLower.includes('commodores')) return 'SEC';
        if (nameLower.includes('miami') || nameLower.includes('hurricanes')) return 'ACC';
        if (nameLower.includes('virginia') || nameLower.includes('cavaliers')) return 'ACC';
        if (nameLower.includes('smu') || nameLower.includes('mustangs')) return 'ACC';
        if (nameLower.includes('georgia tech') || nameLower.includes('yellow jackets')) return 'ACC';
        if (nameLower.includes('oregon') || nameLower.includes('ducks')) return 'Big Ten';
        if (nameLower.includes('byu') || nameLower.includes('cougars')) return 'Big 12';
        if (nameLower.includes('utah') || nameLower.includes('utes')) return 'Big 12';
        
        return currentConference;
    };

    // Check head-to-head results (hardcoded for known matchups)
    const getHeadToHeadWinner = (teamA: BracketTeam, teamB: BracketTeam): BracketTeam | null => {
        const aName = teamA.name.toLowerCase();
        const bName = teamB.name.toLowerCase();
        const aShort = teamA.shortName.toLowerCase();
        const bShort = teamB.shortName.toLowerCase();
        
        // Known head-to-head results (winner first)
        const headToHeadResults: Array<[string[], string[]]> = [
            // Texas Tech beat BYU
            [['texas tech', 'red raiders', 'ttu'], ['byu', 'brigham young', 'cougars']],
            // Add more head-to-head results as needed
        ];
        
        for (const [winner, loser] of headToHeadResults) {
            const aIsWinner = winner.some(w => aName.includes(w) || aShort.includes(w));
            const bIsLoser = loser.some(l => bName.includes(l) || bShort.includes(l));
            const bIsWinner = winner.some(w => bName.includes(w) || bShort.includes(w));
            const aIsLoser = loser.some(l => aName.includes(l) || aShort.includes(l));
            
            if (aIsWinner && bIsLoser) return teamA;
            if (bIsWinner && aIsLoser) return teamB;
        }
        
        return null; // No head-to-head data
    };

    // Get Power 4 conference leaders (auto-bids)
    const getPower4ConferenceLeaders = (allTeams: BracketTeam[]): BracketTeam[] => {
        const conferenceLeaders: BracketTeam[] = [];
        const p4Conferences = ['SEC', 'Big Ten', 'Big 12', 'ACC'];
        
        p4Conferences.forEach(conf => {
            // Find teams in this conference - handle variations in conference names
            const conferenceTeams = allTeams.filter(t => {
                if (!t.conference) return false;
                const confLower = t.conference.toLowerCase();
                const searchLower = conf.toLowerCase();
                // Handle variations: "Big 12", "Big12", "Big Twelve", etc.
                return confLower.includes(searchLower) || 
                       confLower.includes(searchLower.replace(' ', '')) ||
                       (conf === 'Big 12' && (confLower.includes('big12') || confLower.includes('big 12'))) ||
                       (conf === 'Big Ten' && (confLower.includes('bigten') || confLower.includes('big ten')));
            });
            
                if (conferenceTeams.length === 0) {
                    return;
                }
            
            // Sort by: 1) Losses (asc), 2) Ranking for undefeated (lower rank = better), 3) Wins (desc), 4) Head-to-head, 5) SOR (asc)
            const sorted = [...conferenceTeams].sort((a, b) => {
                const aWins = parseRecord(a.record).wins;
                const bWins = parseRecord(b.record).wins;
                const aLosses = parseRecord(a.record).losses;
                const bLosses = parseRecord(b.record).losses;
                
                // First by losses (fewer losses = better) - undefeated teams should rank higher
                if (aLosses !== bLosses) return aLosses - bLosses;
                
                // If both are undefeated (0 losses), prioritize by ranking (lower rank number = better)
                // This ensures #1 Ohio State (11-0) beats #2 Indiana (12-0)
                if (aLosses === 0 && bLosses === 0) {
                    const aRank = a.rank ?? 999;
                    const bRank = b.rank ?? 999;
                    if (aRank !== bRank) return aRank - bRank; // Lower rank number = better
                }
                
                // Then by wins (more wins = better) - but only if both have losses
                if (aLosses > 0 && bLosses > 0) {
                    if (bWins !== aWins) return bWins - aWins;
                }
                
                // If tied on wins/losses, check head-to-head
                const h2hWinner = getHeadToHeadWinner(a, b);
                if (h2hWinner === a) return -1; // a wins
                if (h2hWinner === b) return 1; // b wins
                
                // If no head-to-head, sort by ranking (lower rank number = better)
                const aRank = a.rank ?? 999;
                const bRank = b.rank ?? 999;
                if (aRank !== bRank) return aRank - bRank;
                
                // Finally by SOR value (lower is better)
                const aSor = a.sor ?? 9999; // Higher number for null = worse
                const bSor = b.sor ?? 9999;
                
                // If both have SOR data, lower is better
                if (a.sor !== null && b.sor !== null) {
                    if (aSor !== bSor) return aSor - bSor;
                }
                // If one has SOR and one doesn't, prefer the one with SOR
                else if (a.sor === null && b.sor !== null) return 1; // b wins (has SOR)
                else if (b.sor === null && a.sor !== null) return -1; // a wins (has SOR)
                // If both are null, they're equal
                
                return 0;
            });
            
            if (sorted.length > 0) {
                const leader = sorted[0];
                conferenceLeaders.push(leader);
            }
        });
        
        return conferenceLeaders;
    };

    // Simple, clean fair ranking formula:
    // 1. Overall record (most important) - 70% weight
    // 2. Strength of Record (2nd most important) - 30% weight
    // 3. Head-to-head (handled in sorting, not scoring)
    const calculateFairRankScore = (team: BracketTeam, allTeamsList: BracketTeam[]): number => {
        const { wins, losses } = parseRecord(team.record);
        const totalGames = wins + losses;
        
        if (totalGames === 0) return 0;

        // 1. Record Score (70% weight) - MOST IMPORTANT
        // Calculate win percentage and scale it
        const winPercentage = (wins / totalGames) * 100;
        const recordScore = winPercentage * 0.70;
        
        // Bonus for high win totals (ensures 11-1 beats 10-2, etc.)
        let winBonus = 0;
        if (wins >= 11) winBonus = 15; // 11+ wins
        else if (wins >= 10) winBonus = 10; // 10 wins
        else if (wins >= 9) winBonus = 5; // 9 wins
        
        // Penalty for losses (heavier for more losses)
        let lossPenalty = 0;
        if (losses >= 3) lossPenalty = 20; // 3+ losses = heavy penalty
        else if (losses === 2) lossPenalty = 5; // 2 losses = moderate penalty
        else if (losses === 1) lossPenalty = 1; // 1 loss = light penalty

        // 2. Strength of Record Score (30% weight) - SECOND MOST IMPORTANT
        let sorScore = 0;
        if (team.sor !== null && team.sor !== undefined && team.sor <= 100) {
            // Lower SOR = better, so invert it (SOR 1 = best, SOR 100 = worst)
            sorScore = ((100 - team.sor) / 100) * 100 * 0.30;
        }
        // Teams without SOR data get 0 for this component

        // 3. Conference multiplier (only for non-Power 4 teams)
        let conferenceMultiplier = 1.0;
        if (!isPower4(team.conference)) {
            conferenceMultiplier = 0.85; // Simple penalty for non-Power 4
        }

        // Final score: Record (with bonuses/penalties) + SOR, then apply conference multiplier
        const finalScore = (recordScore + winBonus - lossPenalty + sorScore) * conferenceMultiplier;

        return Math.max(0, finalScore);
    };

    useEffect(() => {
        const loadTeams = async () => {
            // Fetch teams from database
            const fetchedTeams = await fetchTeamsFromDatabase();
            
            // Process teams - preserve original ID to prevent duplicates
            const processedTeams: BracketTeam[] = fetchedTeams.map((team: any) => {
                const { wins, losses } = parseRecord(team.record);
                return {
                    ...team,
                    seed: team.rank,
                    // Keep original ID if it exists, otherwise create from rank
                    id: (team as BracketTeam).id || `team-${team.rank}`,
                    wins,
                    losses,
                    conference: team.conference || 'Unknown',
                };
            });
            
            // Final deduplication pass by ID
            const finalUniqueTeams = new Map<string, BracketTeam>();
            processedTeams.forEach(team => {
                const key = team.id || team.name;
                if (!finalUniqueTeams.has(key)) {
                    finalUniqueTeams.set(key, team);
                } else {
                    // Merge if duplicate - keep best data
                    const existing = finalUniqueTeams.get(key)!;
                    const merged: BracketTeam = {
                        ...existing,
                        sor: existing.sor || team.sor || null,
                        record: existing.record === '0-0' ? team.record : existing.record,
                        rank: existing.rank || team.rank,
                        conference: existing.conference !== 'Unknown' ? existing.conference : team.conference,
                    };
                    finalUniqueTeams.set(key, merged);
                }
            });
            
            const finalTeams = Array.from(finalUniqueTeams.values());
            
            setAllTeams(finalTeams);
            
            // Set initial teams (real rankings - use rank_id from database)
            const realRankedTeams = [...finalTeams].sort((a, b) => (a.rank || 999) - (b.rank || 999));
            setTeams(realRankedTeams.slice(0, 12)); // Top 12 for real rankings
            
            // Calculate first 2 out for real rankings (teams ranked 13 and 14)
            // This will be updated when toggle changes via useEffect
            const first2OutReal = realRankedTeams.slice(12, 14); // Teams ranked 13 and 14
            setFirst2Out(first2OutReal);
        };
        
        loadTeams();
    }, []);

    // When toggle changes, update teams based on ranking type
    useEffect(() => {
        if (useRealRankings) {
            // Use real CFP rankings
            const sortedAllTeams = [...allTeams].sort((a, b) => (a.rank || 999) - (b.rank || 999));
            const realRankedTeams = sortedAllTeams.slice(0, 12).map((team, index) => {
                const { wins, losses } = parseRecord(team.record);
                return {
                    ...team,
                    seed: index + 1,
                    id: `team-${team.rank}`,
                    wins,
                    losses,
                    conference: team.conference || 'Unknown',
                };
            });
            setTeams(realRankedTeams);
            
            // Calculate first 2 out for real rankings (teams ranked 13 and 14)
            const first2OutReal = sortedAllTeams.slice(12, 14); // Teams ranked 13 and 14
            setFirst2Out(first2OutReal);
        } else {
            // Use fair rankings with Power 4 auto-bids
            // Step 1: Get Power 4 conference leaders (auto-bids, seeds 1-4)
            const conferenceLeaders = getPower4ConferenceLeaders(allTeams);
            const leaderIds = new Set(conferenceLeaders.map(l => l.id));
            
            // Step 2: Calculate scores for all teams
            const teamsWithScores: TeamWithScore[] = allTeams.map(team => ({
                ...team,
                fairRankScore: calculateFairRankScore(team, allTeams),
            }));

            // Step 3: Separate auto-bids from at-large candidates
            const autoBids = conferenceLeaders.map(leader => {
                const scored = teamsWithScores.find(t => t.id === leader.id);
                return scored || { ...leader, fairRankScore: calculateFairRankScore(leader, allTeams) };
            });
            
            const atLargeCandidates = teamsWithScores.filter(t => !leaderIds.has(t.id));

            // Step 4: Sort auto-bids by score (best get seeds 1-4)
            autoBids.sort((a, b) => b.fairRankScore - a.fairRankScore);
            
            // Step 5: Sort at-large candidates by score, with head-to-head as tiebreaker
            atLargeCandidates.sort((a, b) => {
                // First by score
                if (b.fairRankScore !== a.fairRankScore) return b.fairRankScore - a.fairRankScore;
                
                // If tied on score, check head-to-head
                const h2hWinner = getHeadToHeadWinner(a, b);
                if (h2hWinner === a) return -1; // a wins
                if (h2hWinner === b) return 1; // b wins
                
                // If still tied, use ranking
                const aRank = a.rank ?? 999;
                const bRank = b.rank ?? 999;
                return aRank - bRank;
            });
            const topAtLarge = atLargeCandidates.slice(0, 8);
            
            // Calculate first 2 out for fair rankings (next 2 at-large candidates after top 8)
            const first2OutFair = atLargeCandidates.slice(8, 10); // Teams ranked 9th and 10th in at-large
            setFirst2Out(first2OutFair);

            // Step 6: Combine auto-bids (seeds 1-4) with at-large (seeds 5-12)
            const fairRankedTeams: BracketTeam[] = [
                ...autoBids.map((team, index) => ({
                    ...team,
                    seed: index + 1,
                    id: `fair-team-${index + 1}`,
                })),
                ...topAtLarge.map((team, index) => ({
                    ...team,
                    seed: index + 5,
                    id: `fair-team-${index + 5}`,
                })),
            ];


            setTeams(fairRankedTeams);
        }
    }, [useRealRankings, allTeams]);

    // Bracket structure: 12-team format
    // First Round: Seeds 5-12 play each other (5v12, 6v11, 7v10, 8v9)
    // Quarterfinals: Seeds 1-4 await winners
    // Semifinals: Winners advance
    // Championship: Final game

    const getTeamBySeed = (seed: number): BracketTeam | null => {
        return teams.find(t => t.seed === seed) || null;
    };

    const TeamCard = ({ team, showSeed = true, size = 'normal', needsConferenceWin = false }: { team: BracketTeam | null; showSeed?: boolean; size?: 'normal' | 'large'; needsConferenceWin?: boolean }) => {
        if (!team) {
            return (
                <div className={`bg-white/40 backdrop-blur-md rounded-xl border border-white/30 shadow-md p-3 ${size === 'large' ? 'min-h-[100px]' : 'min-h-[80px]'} flex items-center justify-center`}>
                    <span className="text-gray-400 text-xs">TBD</span>
                </div>
            );
        }

        const cardSize = size === 'large' ? 'p-4' : 'p-3';
        const logoSize = size === 'large' ? 'w-12 h-12' : 'w-10 h-10';
        const textSize = size === 'large' ? 'text-sm' : 'text-xs';

        return (
            <div className={`bg-white/70 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg ${cardSize} transition-all hover:shadow-xl hover:scale-[1.02] relative`}>
                {needsConferenceWin && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                        <span className="text-[10px] font-black text-black">*</span>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    <div className={`${logoSize} bg-white rounded-full p-1.5 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/50`} style={{ backgroundColor: team.color + '20' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={team.logo} alt={team.shortName} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {showSeed && (
                                <span className="text-[10px] font-black text-[#0062B8] bg-white/80 px-1.5 py-0.5 rounded">#{team.seed}</span>
                            )}
                            <span className={`${textSize} font-bold text-[#002E5D] truncate`}>{team.shortName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-600">
                            <span>{team.record}</span>
                            {team.sor !== null && team.sor !== undefined && (
                                <span className="text-gray-500">SOR: {team.sor}</span>
                            )}
                            {!useRealRankings && team.fairRankScore !== undefined && (
                                <span className="text-[#0062B8] font-bold">Score: {team.fairRankScore.toFixed(1)}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const BracketLine = ({ direction = 'horizontal' }: { direction?: 'horizontal' | 'vertical' }) => {
        if (direction === 'horizontal') {
            return <div className="h-0.5 bg-white/30 flex-1"></div>;
        }
        return <div className="w-0.5 bg-white/30 flex-1"></div>;
    };

    return (
        <div className="min-h-screen bg-[#0047BA] p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-white hover:text-yellow-300 transition-colors">
                            <span className="text-sm font-bold">← Back</span>
                        </Link>
                        <div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-1">COLLEGE FOOTBALL PLAYOFF</h1>
                            <p className="text-sm sm:text-base text-white/80">12-Team CFP Bracket</p>
                        </div>
                    </div>
                    
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setLoading(true);
                                const loadTeams = async () => {
                                    const fetchedTeams = await fetchTeamsFromDatabase();
                                    const processedTeams: BracketTeam[] = fetchedTeams.map(team => {
                                        const { wins, losses } = parseRecord(team.record);
                                        return {
                                            ...team,
                                            seed: team.rank,
                                            id: `team-${team.rank}`,
                                            wins,
                                            losses,
                                            conference: team.conference || 'Unknown',
                                        };
                                    });
                                    setAllTeams(processedTeams);
                                    if (useRealRankings) {
                                        const realRankedTeams = [...processedTeams].sort((a, b) => (a.rank || 999) - (b.rank || 999));
                                        setTeams(realRankedTeams.slice(0, 12));
                                    }
                                };
                                loadTeams();
                            }}
                            className="p-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 shadow-lg hover:bg-white/30 transition-all"
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 shadow-lg px-4 py-3">
                            <span className="text-xs sm:text-sm font-bold text-white">Real Rankings</span>
                            <button
                                onClick={() => setUseRealRankings(!useRealRankings)}
                                className="relative w-14 h-7 bg-white/30 rounded-full transition-all hover:bg-white/40"
                            >
                                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${useRealRankings ? 'translate-x-0' : 'translate-x-7'}`}></div>
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-white">Fair Rankings</span>
                                <button
                                    onClick={() => setShowFormulaModal(true)}
                                    className="p-1 hover:bg-white/20 rounded-full transition-all group"
                                    aria-label="Learn about Fair Rankings formula"
                                >
                                    <Info className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Badge - Clickable when Fair Rankings is selected */}
                {useRealRankings ? (
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 px-4 py-2">
                        <Trophy className="w-4 h-4 text-yellow-300" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Current ESPN CFP Rankings
                        </span>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowFormulaModal(true)}
                        className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 px-4 py-2 hover:bg-white/30 transition-all cursor-pointer group"
                        aria-label="Learn about Fair Rankings formula"
                    >
                        <Trophy className="w-4 h-4 text-yellow-300" />
                        <div className="flex flex-col items-start">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Fair Rankings (Based on SOR & Performance)
                            </span>
                            <span className="text-[10px] text-white/70 group-hover:text-white/90 transition-colors">
                                Click for details
                            </span>
                        </div>
                        <Info className="w-3 h-3 text-white/70 group-hover:text-white transition-colors ml-1" />
                    </button>
                )}
            </div>

            {/* Bracket Container */}
            <div className="max-w-7xl mx-auto">
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-4 sm:p-6 lg:p-8 overflow-x-auto relative">
                    {/* Bracket Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8 min-w-[1200px] relative">
                        
                        {/* First Round - Left Column */}
                        <div className="space-y-8 relative">
                            <div className="text-center mb-6">
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">FIRST ROUND</h2>
                            </div>
                            
                            {/* Game 1: Seed 12 vs Seed 5 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(12)} needsConferenceWin={getTeamBySeed(12)?.shortName === 'Tulane'} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={getTeamBySeed(5)} />
                                {/* Connecting line to QF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>

                            {/* Game 2: Seed 9 vs Seed 8 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(9)} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={getTeamBySeed(8)} />
                                {/* Connecting line to QF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>

                            {/* Game 3: Seed 11 vs Seed 6 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(11)} needsConferenceWin={getTeamBySeed(11)?.shortName === 'Miami'} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={getTeamBySeed(6)} />
                                {/* Connecting line to QF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>

                            {/* Game 4: Seed 10 vs Seed 7 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(10)} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={getTeamBySeed(7)} />
                                {/* Connecting line to QF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>
                        </div>

                        {/* Quarterfinals - Second Column */}
                        <div className="space-y-8 relative">
                            <div className="text-center mb-6">
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">QUARTERFINALS</h2>
                            </div>
                            
                            {/* QF 1: Seed 4 vs Winner of Game 1 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(4)} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={null} />
                                {/* Connecting line to SF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                                {/* Vertical connector */}
                                <div className="absolute -right-4 top-full w-0.5 h-8 bg-white/30"></div>
                            </div>

                            {/* QF 2: Seed 1 vs Winner of Game 2 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(1)} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={null} />
                                {/* Connecting line to SF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>

                            {/* QF 3: Seed 3 vs Winner of Game 3 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(3)} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={null} />
                                {/* Connecting line to SF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                                {/* Vertical connector */}
                                <div className="absolute -right-4 top-full w-0.5 h-8 bg-white/30"></div>
                            </div>

                            {/* QF 4: Seed 2 vs Winner of Game 4 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={getTeamBySeed(2)} />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={null} />
                                {/* Connecting line to SF */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>
                        </div>

                        {/* Semifinals - Third Column */}
                        <div className="space-y-8 relative">
                            <div className="text-center mb-6">
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">SEMIFINALS</h2>
                            </div>
                            
                            {/* SF 1: Winner of QF 1 vs Winner of QF 2 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={null} size="large" />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={null} size="large" />
                                {/* Connecting line to Championship */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>

                            {/* SF 2: Winner of QF 3 vs Winner of QF 4 */}
                            <div className="space-y-2 relative">
                                <TeamCard team={null} size="large" />
                                <div className="text-center text-white/60 text-[10px] font-bold py-1">vs</div>
                                <TeamCard team={null} size="large" />
                                {/* Connecting line to Championship */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-white/30"></div>
                            </div>
                        </div>

                        {/* Championship - Right Column */}
                        <div className="space-y-6">
                            <div className="text-center mb-4">
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-2">NATIONAL CHAMPIONSHIP</h2>
                            </div>
                            
                            {/* Championship Game */}
                            <div className="space-y-4">
                                <TeamCard team={null} size="large" />
                                <div className="flex items-center justify-center">
                                    <Trophy className="w-8 h-8 text-yellow-300" />
                                </div>
                                <TeamCard team={null} size="large" />
                            </div>
                        </div>

                    </div>
                    
                    {/* First 2 Out - Bottom Right Corner */}
                    {first2Out.length > 0 && (
                        <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 shadow-lg p-4 min-w-[200px] z-10">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">First 2 Out</h3>
                            <div className="space-y-2">
                                {first2Out.map((team, index) => (
                                    <div key={team.id || index} className="flex items-center gap-2 bg-white/10 rounded-lg p-2 border border-white/20">
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img 
                                                src={teamMetadata[team.name]?.logo || team.logo} 
                                                alt={team.shortName} 
                                                className="w-6 h-6 object-contain"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{team.shortName}</div>
                                            <div className="text-[10px] text-white/70">{team.record}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Note */}
            <div className="max-w-7xl mx-auto mt-6 text-center">
                <p className="text-xs text-white/60">
                    * Teams marked with asterisk must win their conference championship game
                </p>
            </div>

            {/* Formula Explanation Modal */}
            {showFormulaModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowFormulaModal(false)}
                >
                    <div 
                        className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/20 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white">Fair Rankings Formula</h2>
                            <button
                                onClick={() => setShowFormulaModal(false)}
                                className="p-2 hover:bg-white/20 rounded-full transition-all"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            <div className="prose prose-invert max-w-none">
                                <p className="text-white/90 text-base leading-relaxed mb-4">
                                    The Fair Rankings system uses a <strong className="text-white">Power 4 auto-bid system</strong> combined with 
                                    a simple, clean formula. The winner/leader of each Power 4 conference (SEC, Big Ten, Big 12, ACC) 
                                    receives an automatic bid (seeds 1-4), then the remaining 8 spots are filled based on:
                                </p>
                                <ol className="text-white/90 text-base leading-relaxed mb-4 ml-6 list-decimal space-y-2">
                                    <li><strong className="text-white">Overall Record</strong> (most important - 70% weight)</li>
                                    <li><strong className="text-white">Strength of Record</strong> (2nd most important - 30% weight)</li>
                                    <li><strong className="text-white">Head-to-Head</strong> (3rd most important - used as tiebreaker)</li>
                                </ol>

                                <div className="space-y-4">
                                    {/* Auto-Bid System */}
                                    <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-5 border border-white/20">
                                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                            <span className="bg-purple-500/30 text-purple-300 px-3 py-1 rounded-lg text-sm font-black">Auto-Bids</span>
                                            Power 4 Conference Leaders
                                        </h3>
                                        <p className="text-white/80 text-sm leading-relaxed mb-2">
                                            The winner/current leader of each Power 4 conference receives an automatic bid:
                                        </p>
                                        <ul className="text-white/80 text-sm space-y-1 ml-4 list-disc">
                                            <li><strong className="text-white">SEC</strong> - Leader by wins, then SOR, then record</li>
                                            <li><strong className="text-white">Big Ten</strong> - Leader by wins, then SOR, then record</li>
                                            <li><strong className="text-white">Big 12</strong> - Leader by wins, then SOR, then record</li>
                                            <li><strong className="text-white">ACC</strong> - Leader by wins, then SOR, then record</li>
                                        </ul>
                                        <p className="text-white/70 text-xs mt-3">
                                            These 4 teams receive seeds 1-4 (ranked by their fair score). The remaining 8 spots 
                                            are filled by at-large teams based on the formula below.
                                        </p>
                                    </div>

                                    {/* Component 1: Overall Record */}
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                            <span className="bg-green-500/30 text-green-300 px-3 py-1 rounded-lg text-sm font-black">70%</span>
                                            Overall Record (MOST IMPORTANT)
                                        </h3>
                                        <p className="text-white/80 text-sm leading-relaxed">
                                            Record is the primary factor. Win percentage contributes 70% of the total score, with bonuses 
                                            for high win totals and penalties for losses:
                                        </p>
                                        <ul className="text-white/80 text-sm mt-2 space-y-1 ml-4 list-disc">
                                            <li><strong className="text-white">11+ wins:</strong> +15 bonus points</li>
                                            <li><strong className="text-white">10 wins:</strong> +10 bonus points</li>
                                            <li><strong className="text-white">9 wins:</strong> +5 bonus points</li>
                                            <li><strong className="text-red-300">3+ losses:</strong> -20 point penalty</li>
                                            <li><strong className="text-red-300">2 losses:</strong> -5 point penalty</li>
                                            <li><strong className="text-red-300">1 loss:</strong> -1 point penalty</li>
                                        </ul>
                                    </div>

                                    {/* Component 2: Strength of Record */}
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                            <span className="bg-blue-500/30 text-blue-300 px-3 py-1 rounded-lg text-sm font-black">30%</span>
                                            Strength of Record (2ND MOST IMPORTANT)
                                        </h3>
                                        <p className="text-white/80 text-sm leading-relaxed">
                                            SOR measures the difficulty of a team's schedule and their performance against it. 
                                            Lower SOR rankings (closer to 1) indicate stronger schedules and better performance. 
                                            Teams with SOR ≤ 100 receive points based on how close they are to the top, contributing 
                                            30% of the total score.
                                        </p>
                                        <div className="mt-3 text-xs text-white/60 font-mono bg-black/20 px-3 py-2 rounded">
                                            Score = ((100 - SOR) / 100) × 100 × 0.30
                                        </div>
                                    </div>

                                    {/* Component 3: Head-to-Head */}
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                            <span className="bg-yellow-500/30 text-yellow-300 px-3 py-1 rounded-lg text-sm font-black">Tiebreaker</span>
                                            Head-to-Head (3RD MOST IMPORTANT)
                                        </h3>
                                        <p className="text-white/80 text-sm leading-relaxed">
                                            When teams are tied on score, head-to-head results are used as the tiebreaker. 
                                            For example, if Texas Tech and BYU both have the same score, Texas Tech wins because 
                                            they beat BYU head-to-head.
                                        </p>
                                    </div>

                                    {/* Component 5: Conference Multiplier */}
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                            <span className="bg-purple-500/30 text-purple-300 px-3 py-1 rounded-lg text-sm font-black">Multiplier</span>
                                            Conference Strength Adjustment
                                        </h3>
                                        <p className="text-white/80 text-sm leading-relaxed">
                                            Group of 5 (G5) teams face a conference multiplier penalty to account for generally weaker 
                                            conference schedules:
                                        </p>
                                        <ul className="text-white/80 text-sm mt-2 space-y-1 ml-4 list-disc">
                                            <li><strong className="text-white">Power 4 teams:</strong> No penalty (1.0x multiplier)</li>
                                            <li><strong className="text-white">Non-Power 4 with SOR &gt; 40:</strong> 0.80x multiplier</li>
                                            <li><strong className="text-white">Non-Power 4 with SOR &gt; 25:</strong> 0.85x multiplier</li>
                                            <li><strong className="text-white">Non-Power 4 with SOR ≤ 25:</strong> 0.90x multiplier</li>
                                        </ul>
                                        <p className="text-white/70 text-xs mt-2">
                                            <strong>Note:</strong> Pac-12 is no longer considered a Power conference.
                                        </p>
                                    </div>
                                </div>

                                {/* Final Score Calculation */}
                                <div className="mt-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-5 border border-white/20">
                                    <h3 className="text-lg font-bold text-white mb-3">Final Score Calculation</h3>
                                    <div className="text-white/90 text-sm font-mono bg-black/30 px-4 py-3 rounded-lg">
                                        Final Score = (Win% × 70% + Win Bonus - Loss Penalty + SOR Score × 30%) × Conference Multiplier
                                    </div>
                                    <p className="text-white/70 text-xs mt-3">
                                        Power 4 conference leaders receive auto-bids (seeds 1-4, ranked by score). The remaining 8 
                                        at-large spots go to the highest-scoring teams. If teams are tied on score, head-to-head 
                                        results determine the ranking. Seeds 1-4 receive first-round byes.
                                    </p>
                                </div>

                                {/* Philosophy */}
                                <div className="mt-6 pt-6 border-t border-white/20">
                                    <h3 className="text-lg font-bold text-white mb-2">Philosophy</h3>
                                    <p className="text-white/80 text-sm leading-relaxed">
                                        This system combines automatic bids for Power 4 conference champions with a simple, 
                                        merit-based formula for at-large selection. The formula prioritizes overall record above 
                                        all else, then considers strength of schedule (SOR) as a secondary factor. Head-to-head 
                                        results break ties when teams have the same score. This ensures that teams with better 
                                        records rank higher, while still rewarding teams that have played tougher schedules. 
                                        The conference adjustment ensures that Power 4 teams aren't unfairly penalized, while 
                                        still allowing exceptional teams from other conferences to compete.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayoffsPage;

