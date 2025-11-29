'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Tv, MapPin, PlayCircle, ChevronLeft, ChevronRight, MousePointerClick, CheckCircle2, XCircle, AlertCircle, Lock, Unlock, X } from 'lucide-react';
import { FaBasketball } from 'react-icons/fa6';

// --- Types ---
interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    score: string;
    rank: number | null;
    color: string;
    record: string;
    isWinner: boolean;
    hasBall: boolean;
}

interface GameSituation {
    clock: string;
    period: number;
    periodDisplay: string;
    possession: string;
    lastPlay: string;
}

interface Leader {
    name: string;
    displayValue: string;
    athlete: {
        shortName: string;
        headshot?: string;
        position?: string;
    };
    teamId: string;
}

interface Game {
    id: string;
    name: string;
    shortName: string;
    date: Date;
    status: string;
    statusDetail: string;
    isLive: boolean;
    venue: string;
    broadcast: string;
    situation: GameSituation;
    home: Team;
    away: Team;
    leaders: Leader[];
    alert?: {
        type: 'THREE_POINTER' | 'DUNK' | 'STEAL' | 'BLOCK';
        text: string;
    };
    // BYU Specific
    rootingInterest?: {
        teamId: string;
        teamName: string;
        isWinning: boolean;
        status: 'winning' | 'losing' | 'won' | 'lost' | 'tied' | 'pending';
        importance: number;
    };
    // ESPN Prediction Data
    prediction?: {
        homeWinProbability: number;
        awayWinProbability: number;
    };
}

// --- Rooting Logic ---
// Big 12 Conference Teams - Exact list of teams we care about
const BIG12_TEAMS = [
    'Arizona State',
    'Baylor',
    'Brigham Young', // BYU
    'Central Florida', // UCF
    'Cincinnati',
    'Colorado',
    'Houston',
    'Iowa State',
    'Kansas',
    'Kansas State',
    'Oklahoma State',
    'Texas Christian', // TCU
    'Texas Tech',
    'Utah',
    'West Virginia',
    'Arizona'
];

const MATCHUP_LIST = [
    // BYU games (highest priority)
    { team: 'BYU', opponent: 'Kansas', priority: 1 },
    { team: 'BYU', opponent: 'Houston', priority: 2 },
    { team: 'BYU', opponent: 'Texas', priority: 3 },
    { team: 'BYU', opponent: 'Iowa State', priority: 4 },
    { team: 'BYU', opponent: 'Baylor', priority: 5 },
    // Other Big 12 games that help BYU's resume
    { team: 'Kansas', opponent: 'Houston', priority: 6 },
    { team: 'Texas', opponent: 'Iowa State', priority: 7 },
    { team: 'Baylor', opponent: 'Oklahoma', priority: 8 },
    { team: 'TCU', opponent: 'Texas Tech', priority: 9 },
    { team: 'Kansas State', opponent: 'UCF', priority: 10 },
    { team: 'Cincinnati', opponent: 'West Virginia', priority: 11 },
    { team: 'Oklahoma State', opponent: 'Arizona', priority: 12 },
    { team: 'Arizona State', opponent: 'Colorado', priority: 13 },
    { team: 'Utah', opponent: 'Arizona', priority: 14 },
];

const ByuBasketballPage = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [error, setError] = useState<string | null>(null);
    const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
    const [tickerPage, setTickerPage] = useState(0);
    const [isGameLocked, setIsGameLocked] = useState(false);
    const [currentGameIndex, setCurrentGameIndex] = useState(0);
    const [slotsPerPage, setSlotsPerPage] = useState(4);
    const [mobileView, setMobileView] = useState<'game' | 'guide'>('game');
    const [leadersView, setLeadersView] = useState<'all' | 'away' | 'home'>('all');

    const fetchGames = async () => {
        try {
            setLoading(true);
            
            // Format date for ESPN API (YYYYMMDD)
            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}${month}${day}`;
            };
            
            // Fetch games - try multiple approaches to get all games including completed ones
            const today = new Date();
            const todayDateStr = formatDate(today);
            
            console.log(`📅 Today's date: ${today.toLocaleDateString()} (${todayDateStr})`);
            
            // Try multiple queries and merge results to get all games
            const allResponses: any[] = [];
            const existingIds = new Set<string>();
            
            const addUniqueGames = (events: any[]) => {
                if (events) {
                    events.forEach((event: any) => {
                        if (!existingIds.has(event.id)) {
                            allResponses.push(event);
                            existingIds.add(event.id);
                        }
                    });
                }
            };
            
            // Query 1: With today's date (includes live and completed)
            const url1 = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${todayDateStr}&limit=500`;
            console.log('Query 1: Fetching with today\'s date:', url1);
            try {
                const res1 = await fetch(url1);
                if (res1.ok) {
                    const data1 = await res1.json();
                    console.log(`Query 1 returned ${data1.events?.length || 0} games`);
                    addUniqueGames(data1.events);
                }
            } catch (e) {
                console.log('Query 1 failed:', e);
            }
            
            // Query 2: Without date filter (ESPN defaults to today)
            const url2 = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?limit=500`;
            console.log('Query 2: Fetching without date filter:', url2);
            try {
                const res2 = await fetch(url2);
                if (res2.ok) {
                    const data2 = await res2.json();
                    console.log(`Query 2 returned ${data2.events?.length || 0} games`);
                    addUniqueGames(data2.events);
                }
            } catch (e) {
                console.log('Query 2 failed:', e);
            }
            
            // Query 3: Try querying yesterday through today (in case games are archived)
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayDateStr = formatDate(yesterday);
            const url3 = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${yesterdayDateStr}-${todayDateStr}&limit=500`;
            console.log('Query 3: Fetching date range (yesterday-today):', url3);
            try {
                const res3 = await fetch(url3);
                if (res3.ok) {
                    const data3 = await res3.json();
                    console.log(`Query 3 returned ${data3.events?.length || 0} games`);
                    addUniqueGames(data3.events);
                }
            } catch (e) {
                console.log('Query 3 failed:', e);
            }
            
            // Query 4: Try with groups parameter for Big 12 (conference ID 8)
            // Some ESPN endpoints support filtering by conference/group
            const url4 = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${todayDateStr}&groups=8&limit=500`;
            console.log('Query 4: Fetching Big 12 games (group 8):', url4);
            try {
                const res4 = await fetch(url4);
                if (res4.ok) {
                    const data4 = await res4.json();
                    console.log(`Query 4 returned ${data4.events?.length || 0} games`);
                    addUniqueGames(data4.events);
                }
            } catch (e) {
                console.log('Query 4 failed:', e);
            }
            
            console.log(`📊 Total unique games collected: ${allResponses.length}`);
            
            // Check if Colorado or TCU appear in any games (even if not Big 12)
            const coloradoGames = allResponses.filter((event: any) => {
                const competition = event.competitions?.[0];
                const competitors = competition?.competitors || [];
                return competitors.some((c: any) => 
                    c.team?.displayName?.toLowerCase().includes('colorado') ||
                    c.team?.shortDisplayName?.toLowerCase().includes('colorado') ||
                    c.team?.abbreviation?.toLowerCase() === 'colo'
                );
            });
            
            const tcuGames = allResponses.filter((event: any) => {
                const competition = event.competitions?.[0];
                const competitors = competition?.competitors || [];
                return competitors.some((c: any) => 
                    c.team?.displayName?.toLowerCase().includes('texas christian') ||
                    c.team?.displayName?.toLowerCase().includes('tcu') ||
                    c.team?.shortDisplayName?.toLowerCase().includes('tcu') ||
                    c.team?.abbreviation?.toLowerCase() === 'tcu'
                );
            });
            
            if (coloradoGames.length > 0) {
                console.log(`✅ Found ${coloradoGames.length} Colorado game(s) in API response`);
            } else {
                console.log(`⚠️  Colorado games NOT found in ESPN API response`);
            }
            
            if (tcuGames.length > 0) {
                console.log(`✅ Found ${tcuGames.length} TCU game(s) in API response`);
            } else {
                console.log(`⚠️  TCU games NOT found in ESPN API response`);
            }
            
            // Use merged events directly
            const data = { events: allResponses };
            console.log('Games fetched:', data.events?.length || 0);
            
            // Create a map of game IDs to raw team data for conference checking
            const rawTeamDataMap = new Map<string, { home: any, away: any }>();
            (data.events || []).forEach((event: any) => {
                const competition = event.competitions[0];
                const competitors = competition.competitors;
                const home = competitors.find((c: any) => c.homeAway === 'home');
                const away = competitors.find((c: any) => c.homeAway === 'away');
                rawTeamDataMap.set(event.id, { home, away });
            });
            
            // Log all games with dates and teams from API to help debug
            console.log('\n📋 All games in API response:');
            (data.events || []).forEach((event: any, idx: number) => {
                const competition = event.competitions[0];
                const competitors = competition.competitors;
                const home = competitors.find((c: any) => c.homeAway === 'home');
                const away = competitors.find((c: any) => c.homeAway === 'away');
                const gameDate = new Date(event.date);
                console.log(`  Game ${idx + 1}: ${away.team.displayName} @ ${home.team.displayName} - Date: ${gameDate.toLocaleDateString()} ${gameDate.toLocaleTimeString()}`);
                console.log(`    Away: ${away.team.displayName} (${away.team.shortDisplayName || away.team.abbreviation}) - Conference ID: ${away.team.conferenceId || 'N/A'}`);
                console.log(`    Home: ${home.team.displayName} (${home.team.shortDisplayName || home.team.abbreviation}) - Conference ID: ${home.team.conferenceId || 'N/A'}`);
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allGames = (data.events || []).map((event: any) => {
                const competition = event.competitions[0];
                const competitors = competition.competitors;
                const home = competitors.find((c: any) => c.homeAway === 'home');
                const away = competitors.find((c: any) => c.homeAway === 'away');
                const situation = competition.situation || {};

                // Extract leaders data
                const leadersData = competition.leaders || [];
                
                const leaders = leadersData.flatMap((cat: any) => {
                    if (!cat.leaders || cat.leaders.length === 0) return [];
                    return cat.leaders.map((l: any) => ({
                        name: cat.displayName,
                        displayValue: l.displayValue,
                        athlete: {
                            shortName: l.athlete.shortName,
                            headshot: l.athlete.headshot,
                            position: l.athlete.position?.abbreviation
                        },
                        teamId: l.team.id
                    }));
                });

                let alert = undefined;
                if (situation.lastPlay?.text) {
                    const text = situation.lastPlay.text.toLowerCase();
                    if (text.includes('3-pointer') || text.includes('three')) alert = { type: 'THREE_POINTER', text: '3-POINTER' };
                    else if (text.includes('dunk')) alert = { type: 'DUNK', text: 'DUNK' };
                    else if (text.includes('steal')) alert = { type: 'STEAL', text: 'STEAL' };
                    else if (text.includes('block')) alert = { type: 'BLOCK', text: 'BLOCK' };
                }

                // Parse Teams
                const homeTeam = {
                    id: home.id,
                    name: home.team.displayName,
                    shortName: home.team.shortDisplayName || home.team.abbreviation,
                    logo: home.team.logo,
                    score: home.score,
                    rank: home.curatedRank?.current < 26 ? home.curatedRank.current : null,
                    color: home.team.color ? `#${home.team.color}` : '#333',
                    record: home.records?.[0]?.summary,
                    isWinner: home.winner,
                    hasBall: situation.possession === home.id
                };
                const awayTeam = {
                    id: away.id,
                    name: away.team.displayName,
                    shortName: away.team.shortDisplayName || away.team.abbreviation,
                    logo: away.team.logo,
                    score: away.score,
                    rank: away.curatedRank?.current < 26 ? away.curatedRank.current : null,
                    color: away.team.color ? `#${away.team.color}` : '#333',
                    record: away.records?.[0]?.summary,
                    isWinner: away.winner,
                    hasBall: situation.possession === away.id
                };

                // Log every game with conference info if available
                const homeConference = home.team.conferenceId || home.team.groups?.affiliations?.[0]?.name || 'unknown';
                const awayConference = away.team.conferenceId || away.team.groups?.affiliations?.[0]?.name || 'unknown';
                console.log(`🏀 Game: ${awayTeam.name} (${awayTeam.shortName}) @ ${homeTeam.name} (${homeTeam.shortName})`);
                console.log(`   Conferences: ${awayConference} @ ${homeConference}`);
                
                // Log leaders data
                if (leadersData.length > 0) {
                    console.log(`📊 Leaders data: ${leadersData.length} categories`);
                    if (leaders.length > 0) {
                        console.log(`   Found ${leaders.length} leader entries:`, leaders.map(l => `${l.athlete.shortName} - ${l.name}: ${l.displayValue}`).join(', '));
                    } else {
                        console.log(`   No leader entries found in categories`);
                    }
                } else {
                    console.log(`📊 No leaders data in API response`);
                }

                // Determine Rooting Interest - check if this is a Big 12 game
                let rootingInterest = undefined;

                const teamMatches = (actualTeam: Team, targetName: string) => {
                    const actualLower = actualTeam.name.toLowerCase();
                    const actualShortLower = actualTeam.shortName.toLowerCase();
                    const targetLower = targetName.toLowerCase();

                    const exactMappings: Record<string, (name: string, short: string) => boolean> = {
                        'arizona state': (n, s) => n.includes('arizona state') || s === 'arizona st' || s === 'asu',
                        'baylor': (n, s) => n.includes('baylor'),
                        'brigham young': (n, s) => n.includes('brigham young') || s === 'byu',
                        'central florida': (n, s) => (n.includes('central florida') || s === 'ucf') && !n.includes('south florida'),
                        'cincinnati': (n, s) => n.includes('cincinnati'),
                        'colorado': (n, s) => n.includes('colorado') && !n.includes('state'),
                        'houston': (n, s) => n.includes('houston'),
                        'iowa state': (n, s) => n.includes('iowa state') || s === 'iowa st',
                        'kansas': (n, s) => n.includes('kansas') && !n.includes('state'),
                        'kansas state': (n, s) => n.includes('kansas state') || s === 'kansas st' || s === 'k-state',
                        'oklahoma state': (n, s) => n.includes('oklahoma state') || s === 'oklahoma st' || s === 'ok state',
                        'texas christian': (n, s) => n.includes('texas christian') || n.includes('tcu') || s === 'tcu',
                        'texas tech': (n, s) => n.includes('texas tech') || s === 'texas tech' || s === 'tex tech',
                        'utah': (n, s) => n === 'utah' || (n.includes('utah') && !n.includes('state')),
                        'west virginia': (n, s) => n.includes('west virginia') || s === 'west virginia' || s === 'wvu',
                        'arizona': (n, s) => n === 'arizona' || (n.includes('arizona') && !n.includes('state')),
                    };

                    if (exactMappings[targetLower]) {
                        return exactMappings[targetLower](actualLower, actualShortLower);
                    }

                    return actualLower.includes(targetLower) || actualShortLower === targetLower;
                };

                // Check if this is a Big 12 matchup we care about
                for (const matchup of MATCHUP_LIST) {
                    const homeMatches = teamMatches(homeTeam, matchup.team) || teamMatches(homeTeam, matchup.opponent);
                    const awayMatches = teamMatches(awayTeam, matchup.team) || teamMatches(awayTeam, matchup.opponent);

                    if (homeMatches && awayMatches) {
                        // Determine which team we want to win
                        const weWantTeam = teamMatches(homeTeam, matchup.team) ? homeTeam : 
                                         teamMatches(awayTeam, matchup.team) ? awayTeam : null;
                        
                        if (weWantTeam) {
                            const opponent = weWantTeam.id === homeTeam.id ? awayTeam : homeTeam;
                            let status: 'winning' | 'losing' | 'won' | 'lost' | 'tied' | 'pending' = 'pending';
                            
                            if (competition.status.type.completed) {
                                status = weWantTeam.isWinner ? 'won' : 'lost';
                            } else if (competition.status.type.inProgress) {
                                const weWantScore = parseInt(weWantTeam.score) || 0;
                                const oppScore = parseInt(opponent.score) || 0;
                                status = weWantScore > oppScore ? 'winning' : (weWantScore < oppScore ? 'losing' : 'tied');
                            }

                            rootingInterest = {
                                teamId: weWantTeam.id,
                                teamName: weWantTeam.shortName,
                                isWinning: status === 'winning' || status === 'won',
                                status,
                                importance: matchup.priority
                            };
                            break;
                        }
                    }
                }

                // Parse game situation for basketball
                const gameSituation = {
                    clock: situation.displayClock || '0:00',
                    period: situation.period || 1,
                    periodDisplay: situation.periodDisplay || '1st',
                    possession: situation.possession || '',
                    lastPlay: situation.lastPlay?.text || ''
                };

                return {
                    id: event.id,
                    name: event.name,
                    shortName: `${awayTeam.shortName} @ ${homeTeam.shortName}`,
                    date: new Date(event.date),
                    status: competition.status.type.name,
                    statusDetail: competition.status.type.shortDetail,
                    isLive: competition.status.type.inProgress,
                    venue: competition.venue?.fullName || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.media?.shortName || 'TBD',
                    situation: gameSituation,
                    home: homeTeam,
                    away: awayTeam,
                    leaders,
                    alert,
                    rootingInterest,
                    prediction: (() => {
                        // First, try to get ESPN's actual predictor data
                        if (competition.predictor) {
                            const predictor = competition.predictor;
                            if (predictor.homeTeamOdds?.winPercentage !== undefined && predictor.awayTeamOdds?.winPercentage !== undefined) {
                                return {
                                    homeWinProbability: predictor.homeTeamOdds.winPercentage,
                                    awayWinProbability: predictor.awayTeamOdds.winPercentage
                                };
                            }
                            if (predictor.homeTeam?.winPercentage !== undefined && predictor.awayTeam?.winPercentage !== undefined) {
                                return {
                                    homeWinProbability: predictor.homeTeam.winPercentage,
                                    awayWinProbability: predictor.awayTeam.winPercentage
                                };
                            }
                        }
                        
                        // Fallback prediction calculation based on records and rankings
                        const homeRecord = homeTeam.record?.match(/(\d+)-(\d+)/);
                        const awayRecord = awayTeam.record?.match(/(\d+)-(\d+)/);
                        
                        // Default to 50/50 if no records
                        let homeProb = 50;
                        
                        if (homeRecord && awayRecord) {
                            const homeWins = parseInt(homeRecord[1]);
                            const homeLosses = parseInt(homeRecord[2]);
                            const awayWins = parseInt(awayRecord[1]);
                            const awayLosses = parseInt(awayRecord[2]);
                            
                            const homeTotal = homeWins + homeLosses;
                            const awayTotal = awayWins + awayLosses;
                            
                            if (homeTotal > 0 && awayTotal > 0) {
                                const homeWinPct = homeWins / homeTotal;
                                const awayWinPct = awayWins / awayTotal;
                                
                                // Base probability from win percentage
                                const totalWinPct = homeWinPct + awayWinPct;
                                if (totalWinPct > 0) {
                                    homeProb = (homeWinPct / totalWinPct) * 100;
                                }
                            }
                        }
                        
                        // Adjust for rankings
                        if (homeTeam.rank && awayTeam.rank) {
                            const rankDiff = awayTeam.rank - homeTeam.rank;
                            homeProb += rankDiff * 2; // Each rank difference = 2% adjustment
                        } else if (homeTeam.rank && !awayTeam.rank) {
                            homeProb += 5; // Ranked team gets bonus
                        } else if (!homeTeam.rank && awayTeam.rank) {
                            homeProb -= 5; // Unranked vs ranked penalty
                        }
                        
                        // Home court advantage (about 3-4% in college basketball)
                        homeProb += 3;
                        
                        // Clamp between 5% and 95%
                        homeProb = Math.max(5, Math.min(95, homeProb));
                        
                        return {
                            homeWinProbability: Math.round(homeProb),
                            awayWinProbability: Math.round(100 - homeProb)
                        };
                    })()
                };
            });

            // Helper function to check if a team is in Big 12
            // This function needs access to the raw team data from ESPN to check conference
            const isBig12Team = (team: Team, rawTeamData?: any): boolean => {
                const teamNameLower = team.name.toLowerCase();
                const teamShortLower = team.shortName.toLowerCase();
                
                console.log(`\n🔍 Checking if "${team.name}" (${team.shortName}) is Big 12...`);
                
                // First, try to use conference information from ESPN if available
                if (rawTeamData) {
                    // ESPN returns conference IDs as numbers
                    // Conference ID 8 = Big 12
                    const conferenceId = rawTeamData.team?.conferenceId || 
                                       rawTeamData.conferenceId ||
                                       rawTeamData.team?.groups?.affiliations?.[0]?.id;
                    
                    // Also try to get conference name as fallback
                    const conferenceName = rawTeamData.team?.groups?.affiliations?.[0]?.name ||
                                         rawTeamData.team?.conference ||
                                         rawTeamData.conference;
                    
                    console.log(`   Conference ID: ${conferenceId}, Name: ${conferenceName || 'N/A'}`);
                    
                    // Big 12 conference ID is 8
                    if (conferenceId === 8 || conferenceId === '8') {
                        console.log(`  ✅ Matched "${team.name}" via Big 12 conference ID: ${conferenceId}`);
                        return true;
                    }
                    
                    // Fallback: check conference name if ID not available
                    if (conferenceName) {
                        const conferenceLower = String(conferenceName).toLowerCase();
                        if (conferenceLower.includes('big 12') || conferenceLower.includes('big12') || conferenceLower === '12' || conferenceLower.includes('big twelve')) {
                            console.log(`  ✅ Matched "${team.name}" via conference name: ${conferenceName}`);
                            return true;
                        }
                    }
                } else {
                    console.log(`   No raw team data provided`);
                }
                
                // Direct abbreviation checks first (most reliable)
                const big12Abbreviations: Record<string, string> = {
                    'byu': 'BYU',
                    'tcu': 'TCU',
                    'ucf': 'UCF',
                    'wvu': 'West Virginia',
                    'asu': 'Arizona State',
                    'cu': 'Colorado', // Colorado abbreviation (but check it's not Colorado State)
                    'colo': 'Colorado',
                };
                
                // Check abbreviations first (but exclude Colorado State)
                if (big12Abbreviations[teamShortLower]) {
                    // Special check for CU - make sure it's not Colorado State
                    if (teamShortLower === 'cu' && (teamNameLower.includes('colorado state') || teamShortLower.includes('csu'))) {
                        console.log(`  ❌ CU matched but it's Colorado State, not Colorado`);
                    } else {
                        console.log(`  ✅ Matched ${big12Abbreviations[teamShortLower]} via abbreviation "${teamShortLower}"`);
                        return true;
                    }
                }
                
                // Fallback to name-based matching
                // Comprehensive team mappings for Big 12 teams
                const big12TeamPatterns: Array<{ patterns: string[], name: string, exactMatch?: boolean }> = [
                    { patterns: ['arizona state', 'arizona st', 'asu', 'arizona st.'], name: 'Arizona State' },
                    { patterns: ['baylor', 'bears'], name: 'Baylor' },
                    { patterns: ['brigham young', 'byu', 'cougars'], name: 'BYU' },
                    { patterns: ['central florida', 'ucf', 'knights'], name: 'UCF' },
                    { patterns: ['cincinnati', 'bearcats'], name: 'Cincinnati' },
                    { patterns: ['colorado', 'buffaloes', 'colo'], name: 'Colorado' }, // Removed exactMatch - use special case check instead
                    { patterns: ['houston', 'cougars'], name: 'Houston' },
                    { patterns: ['iowa state', 'iowa st', 'cyclones', 'iowa st.'], name: 'Iowa State' },
                    { patterns: ['kansas', 'jayhawks', 'kan'], name: 'Kansas' }, // Removed exactMatch - use special case check instead
                    { patterns: ['kansas state', 'kansas st', 'k-state', 'wildcats', 'kansas st.'], name: 'Kansas State' },
                    { patterns: ['oklahoma state', 'oklahoma st', 'ok state', 'cowboys', 'oklahoma st.'], name: 'Oklahoma State' },
                    { patterns: ['texas christian', 'tcu', 'horned frogs'], name: 'TCU' },
                    { patterns: ['texas tech', 'texas tech', 'red raiders', 'tex tech'], name: 'Texas Tech' },
                    { patterns: ['utah', 'utes'], name: 'Utah' }, // Removed exactMatch - use special case check instead
                    { patterns: ['west virginia', 'wvu', 'mountaineers'], name: 'West Virginia' },
                    { patterns: ['arizona', 'wildcats', 'ariz'], name: 'Arizona' }, // Removed exactMatch - use special case check instead
                ];
                
                // Check each Big 12 team pattern
                for (const teamPattern of big12TeamPatterns) {
                    for (const pattern of teamPattern.patterns) {
                        // Check full name - use includes for all patterns
                        const nameMatches = teamNameLower.includes(pattern);
                            
                        if (nameMatches) {
                            // Special cases to avoid false positives
                            if (pattern === 'arizona' && (teamNameLower.includes('arizona state') || teamShortLower.includes('asu'))) {
                                continue; // Skip if it's Arizona State
                            }
                            if (pattern === 'kansas' && (teamNameLower.includes('kansas state') || teamShortLower.includes('k-state'))) {
                                continue; // Skip if it's Kansas State
                            }
                            if (pattern === 'colorado' && (teamNameLower.includes('colorado state') || teamShortLower.includes('csu') || teamShortLower.includes('colo st'))) {
                                continue; // Skip if it's Colorado State
                            }
                            if (pattern === 'utah' && (teamNameLower.includes('utah state') || teamShortLower.includes('usu') || teamShortLower.includes('utah st'))) {
                                continue; // Skip if it's Utah State
                            }
                            if (pattern === 'houston' && teamNameLower.includes('houston baptist')) {
                                continue; // Skip Houston Baptist
                            }
                            console.log(`  ✅ Matched ${teamPattern.name} via full name pattern "${pattern}" (team: "${team.name}")`);
                            return true;
                        }
                        
                        // Check short name/abbreviation - be more flexible
                        const shortMatches = teamShortLower === pattern || 
                                          teamShortLower.includes(pattern) ||
                                          (pattern.length >= 3 && teamShortLower.startsWith(pattern)) ||
                                          (pattern.length >= 3 && teamShortLower.endsWith(pattern));
                                          
                        if (shortMatches) {
                            // Same special cases for short names
                            if (pattern === 'arizona' && (teamShortLower.includes('asu') || teamShortLower.includes('arizona st'))) {
                                continue;
                            }
                            if (pattern === 'kansas' && (teamShortLower.includes('k-state') || teamShortLower.includes('kansas st'))) {
                                continue;
                            }
                            if (pattern === 'colorado' && (teamShortLower.includes('csu') || teamShortLower.includes('colo st'))) {
                                continue;
                            }
                            if (pattern === 'utah' && (teamShortLower.includes('usu') || teamShortLower.includes('utah st'))) {
                                continue;
                            }
                            console.log(`  ✅ Matched ${teamPattern.name} via short name pattern "${pattern}" (short: "${team.shortName}")`);
                            return true;
                        }
                    }
                }
                
                console.log(`  ❌ NOT Big 12: "${team.name}" (${team.shortName})`);
                return false;
            };

            // Filter to only show:
            // 1. Games from today only
            // 2. Games where at least one team is Big 12
            console.log(`\n🔍 Filtering ${allGames.length} games for today's Big 12 games...`);
            
            // Helper to check if a date is today (ignoring time and timezone)
            const isToday = (date: Date) => {
                const today = new Date();
                const gameDate = new Date(date);
                
                // Normalize to local date (ignore time)
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const gameDateStr = `${gameDate.getFullYear()}-${String(gameDate.getMonth() + 1).padStart(2, '0')}-${String(gameDate.getDate()).padStart(2, '0')}`;
                
                const isMatch = todayStr === gameDateStr;
                if (!isMatch) {
                    console.log(`   Date mismatch: game date ${gameDateStr} vs today ${todayStr}`);
                }
                return isMatch;
            };
            
            // First, identify all Big 12 teams in the response
            const big12TeamsFound = new Set<string>();
            allGames.forEach((game: Game) => {
                const rawData = rawTeamDataMap.get(game.id);
                if (isBig12Team(game.home, rawData?.home)) {
                    big12TeamsFound.add(`${game.home.name} (${game.home.shortName})`);
                }
                if (isBig12Team(game.away, rawData?.away)) {
                    big12TeamsFound.add(`${game.away.name} (${game.away.shortName})`);
                }
            });
            
            if (big12TeamsFound.size > 0) {
                console.log(`\n🏀 Big 12 teams found in API response:`);
                Array.from(big12TeamsFound).forEach(team => console.log(`   - ${team}`));
            } else {
                console.log(`\n⚠️  No Big 12 teams found in API response`);
            }
            
            const filteredGames = allGames.filter((game: Game) => {
                // First check if game is from today
                const gameIsToday = isToday(game.date);
                if (!gameIsToday) {
                    console.log(`❌ Excluding game (not today): ${game.away.shortName} @ ${game.home.shortName} (${game.date.toLocaleDateString()})`);
                    return false;
                }
                
                // Get raw team data for conference checking
                const rawData = rawTeamDataMap.get(game.id);
                
                // Then check if at least one team is Big 12
                const homeIsBig12 = isBig12Team(game.home, rawData?.home);
                const awayIsBig12 = isBig12Team(game.away, rawData?.away);
                const isMatch = homeIsBig12 || awayIsBig12;
                if (isMatch) {
                    console.log(`✅ Including game: ${game.away.shortName} @ ${game.home.shortName}`);
                } else {
                    console.log(`❌ Excluding game (not Big 12): ${game.away.shortName} @ ${game.home.shortName}`);
                }
                return isMatch;
            });
            console.log(`📊 Filtered to ${filteredGames.length} today's Big 12 games\n`);

            // Sort games: active first, then finished, then by importance
            filteredGames.sort((a: Game, b: Game) => {
                // Prioritize active games
                if (a.isLive && !b.isLive) return -1;
                if (!a.isLive && b.isLive) return 1;

                // Then prioritize finished games
                const aFinished = a.status === 'STATUS_FINAL';
                const bFinished = b.status === 'STATUS_FINAL';
                if (aFinished && !bFinished) return -1;
                if (!aFinished && bFinished) return 1;

                // Then sort by importance
                return (a.rootingInterest?.importance || 99) - (b.rootingInterest?.importance || 99);
            });

            setGames(filteredGames);
            setLastUpdated(new Date());
            setLoading(false);
            setError(null);

            if (filteredGames.length > 0) {
                if (!selectedGameId) {
                    const liveGame = filteredGames.find((g: Game) => g.isLive);
                    const defaultGameId = liveGame ? liveGame.id : filteredGames[0].id;
                    setSelectedGameId(defaultGameId);
                    setCurrentGameIndex(filteredGames.findIndex((g: Game) => g.id === defaultGameId));
                } else {
                    const index = filteredGames.findIndex((g: Game) => g.id === selectedGameId);
                    if (index !== -1) {
                        setCurrentGameIndex(index);
                    } else {
                        setSelectedGameId(filteredGames[0].id);
                        setCurrentGameIndex(0);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            setError("Unable to load scoreboard.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGames();
        const interval = setInterval(fetchGames, 30000);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Ticker Auto-Scroll
    useEffect(() => {
        if (games.length === 0) return;
        const interval = setInterval(() => {
            setTickerPage(prev => {
                const totalPages = Math.ceil(games.length / slotsPerPage);
                const nextPage = prev + 1;
                return nextPage < totalPages ? nextPage : 0;
            });
        }, 10000);
        return () => clearInterval(interval);
    }, [games.length, slotsPerPage]);

    // Calculate BYU Tournament Odds
    const calculateTournamentOdds = (): number => {
        const byuGame = games.find(g => 
            g.away.shortName === 'BYU' || g.home.shortName === 'BYU' ||
            g.away.name.toLowerCase().includes('brigham young') || 
            g.home.name.toLowerCase().includes('brigham young')
        );
        
        if (!byuGame) return 0;
        
        const byuTeam = byuGame.away.shortName === 'BYU' || byuGame.away.name.toLowerCase().includes('brigham young') 
            ? byuGame.away 
            : byuGame.home;
        
        const recordMatch = byuTeam.record?.match(/(\d+)-(\d+)/);
        if (!recordMatch) return 0;
        
        const wins = parseInt(recordMatch[1]);
        const losses = parseInt(recordMatch[2]);
        
        // Base odds for NCAA tournament based on record
        let baseOdds = 0;
        if (wins >= 22 && losses <= 3) baseOdds = 95; // 22-3 or better
        else if (wins >= 20 && losses <= 4) baseOdds = 85; // 20-4
        else if (wins >= 18 && losses <= 5) baseOdds = 70; // 18-5
        else if (wins >= 16 && losses <= 6) baseOdds = 55; // 16-6
        else if (wins >= 14 && losses <= 7) baseOdds = 40; // 14-7
        else if (wins >= 12 && losses <= 8) baseOdds = 25; // 12-8
        else if (wins >= 10 && losses <= 9) baseOdds = 15; // 10-9
        else if (wins >= 8 && losses <= 10) baseOdds = 8; // 8-10
        else baseOdds = 2; // Below 8-10
        
        // Ranking bonus
        let rankingBonus = 0;
        if (byuTeam.rank) {
            if (byuTeam.rank <= 4) rankingBonus = 10;
            else if (byuTeam.rank <= 8) rankingBonus = 8;
            else if (byuTeam.rank <= 12) rankingBonus = 5;
            else if (byuTeam.rank <= 20) rankingBonus = 3;
            else if (byuTeam.rank <= 25) rankingBonus = 1;
        }
        
        // Rooting guide outcomes impact
        let rootingImpact = 0;
        const rootingGames = games.filter(g => g.rootingInterest);
        const wonGames = rootingGames.filter(g => g.rootingInterest?.status === 'won').length;
        const lostGames = rootingGames.filter(g => g.rootingInterest?.status === 'lost').length;
        rootingImpact = (wonGames * 2) - (lostGames * 3);
        
        // Big 12 conference bonus
        const conferenceBonus = 5;
        
        let finalOdds = baseOdds + rankingBonus + rootingImpact + conferenceBonus;
        finalOdds = Math.max(0, Math.min(98, finalOdds));
        
        return Math.round(finalOdds * 10) / 10;
    };
    
    const tournamentOdds = calculateTournamentOdds();
    
    useEffect(() => {
        const updateSlots = () => {
            setSlotsPerPage(window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2);
        };
        updateSlots();
        window.addEventListener('resize', updateSlots);
        return () => window.removeEventListener('resize', updateSlots);
    }, []);

    const handleGameSelect = (gameId: string) => {
        setSelectedGameId(gameId);
        const index = games.findIndex(g => g.id === gameId);
        if (index !== -1) {
            setCurrentGameIndex(index);
        }
    };

    const toggleLock = () => {
        setIsGameLocked(prev => !prev);
    };

    const navigateToPreviousGame = () => {
        if (games.length === 0) return;
        const prevIndex = currentGameIndex > 0 ? currentGameIndex - 1 : games.length - 1;
        setCurrentGameIndex(prevIndex);
        setSelectedGameId(games[prevIndex].id);
    };

    const navigateToNextGame = () => {
        if (games.length === 0) return;
        const nextIndex = (currentGameIndex + 1) % games.length;
        setCurrentGameIndex(nextIndex);
        setSelectedGameId(games[nextIndex].id);
    };

    const nextTickerPage = () => {
        setTickerPage(prev => {
            const totalPages = Math.ceil(games.length / slotsPerPage);
            const nextPage = prev + 1;
            return nextPage < totalPages ? nextPage : 0;
        });
    };

    const prevTickerPage = () => {
        setTickerPage(prev => {
            const totalPages = Math.ceil(games.length / slotsPerPage);
            const prevPage = prev - 1;
            return prevPage >= 0 ? prevPage : totalPages - 1;
        });
    };

    const activeGame = games.find(g => g.id === selectedGameId) || games[0];
    const visibleTickerGames = games.slice(tickerPage * slotsPerPage, (tickerPage + 1) * slotsPerPage);
    const emptySlotsCount = Math.max(0, slotsPerPage - visibleTickerGames.length);

    // Big Team Display Component
    const BigTeamDisplay = ({ team, isOpponentWinner, align }: { team: Team; isOpponentWinner: boolean; align: 'left' | 'right' }) => {
        const isWinner = team.isWinner;
        const isLoser = !isWinner && isOpponentWinner;
        
        return (
            <div className={`flex flex-col items-${align === 'right' ? 'end' : 'start'} gap-2 sm:gap-3 md:gap-4`}>
                <div className={`flex items-center gap-2 sm:gap-3 md:gap-4 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={team.logo} 
                        alt={team.shortName} 
                        className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 object-contain ${isLoser ? 'opacity-50' : ''}`}
                    />
                    <div className={`flex flex-col items-${align === 'right' ? 'end' : 'start'}`}>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {team.rank && (
                                <span className="text-xs sm:text-sm md:text-base font-black text-gray-400">#{team.rank}</span>
                            )}
                            <span className={`text-base sm:text-lg md:text-xl lg:text-2xl font-black ${isLoser ? 'text-gray-400' : 'text-gray-900'}`}>
                                {team.shortName}
                            </span>
                        </div>
                        {team.record && (
                            <span className="text-[10px] sm:text-xs text-gray-500">{team.record}</span>
                        )}
                    </div>
                </div>
                <div className={`text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black ${isLoser ? 'text-gray-300' : 'text-[#0062B8]'}`}>
                    {team.score || '0'}
                </div>
                {team.hasBall && (
                    <div className="flex items-center gap-1 text-[#0062B8]">
                        <FaBasketball className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: team.color || '#0062B8' }} />
                    </div>
                )}
            </div>
        );
    };

    // Matchup Predictor Component
    const MatchupPredictor = ({ game }: { game: Game }) => {
        const homeProb = game.prediction?.homeWinProbability || 50;
        const awayProb = game.prediction?.awayWinProbability || 50;
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const homeOffset = circumference - (homeProb / 100) * circumference;
        const awayOffset = circumference - (awayProb / 100) * circumference;

        return (
            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-white/40 shadow-lg w-full min-h-[240px] sm:min-h-[260px] flex flex-col items-center justify-center overflow-visible">
                <h3 className="text-[9px] sm:text-[10px] font-bold text-[#002E5D] uppercase tracking-widest mb-2 sm:mb-3">Matchup Predictor</h3>
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 flex-shrink-0">
                    <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                        />
                        {/* Home team circle (outer) */}
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={game.home.color || '#0062B8'}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={homeOffset}
                            strokeLinecap="round"
                        />
                        {/* Away team circle (inner) */}
                        <circle
                            cx="50"
                            cy="50"
                            r={radius - 10}
                            fill="none"
                            stroke={game.away.color || '#002E5D'}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={awayOffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-xs sm:text-sm md:text-base font-black text-gray-700">{homeProb.toFixed(0)}%</span>
                        <span className="text-[8px] sm:text-[9px] text-gray-500">Home</span>
                    </div>
                </div>
                <div className="mt-3 sm:mt-4 flex gap-3 sm:gap-4 text-[8px] sm:text-[9px] flex-wrap justify-center">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: game.home.color || '#0062B8' }}></div>
                        <span className="text-gray-600">{game.home.shortName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: game.away.color || '#002E5D' }}></div>
                        <span className="text-gray-600">{game.away.shortName}</span>
                    </div>
                </div>
            </div>
        );
    };

    if (loading && games.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#0062B8] mx-auto mb-4" />
                    <p className="text-gray-600">Loading games...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-white text-gray-900 font-sans overflow-hidden">
            <main className="flex-1 relative overflow-y-auto sm:overflow-hidden flex flex-col min-h-0">
                {/* Header */}
                <header className="absolute top-0 w-full z-20 p-2 sm:p-2.5 md:p-3 flex flex-wrap justify-between items-center gap-2 sm:gap-3 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/50 p-1 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo1.png" alt="BYU" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-shrink-0">
                            <h1 className="text-sm sm:text-lg md:text-xl font-black italic tracking-tighter text-[#0062B8] leading-tight">TOURNAMENT<span className="text-[#002E5D]">TRACKER</span></h1>
                            <p className="text-[9px] sm:text-[10px] text-gray-600 font-medium tracking-widest uppercase leading-tight">Road to the NCAA</p>
                        </div>
                        
                        {/* Mobile View Toggle */}
                        <div className="sm:hidden flex-shrink-0 ml-1">
                            <div className="bg-white/90 backdrop-blur-xl rounded-full px-2 py-1 shadow-lg border border-white/40 flex items-center gap-1">
                                <button
                                    onClick={() => setMobileView('game')}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                                        mobileView === 'game' 
                                            ? 'bg-[#0062B8] text-white shadow-md' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Game
                                </button>
                                <button
                                    onClick={() => setMobileView('guide')}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                                        mobileView === 'guide' 
                                            ? 'bg-[#0062B8] text-white shadow-md' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Guide
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* WE WANT Bar */}
                    {activeGame && activeGame.rootingInterest && (
                        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 mx-2 sm:mx-4">
                            <div className="bg-[#0062B8]/90 backdrop-blur-xl px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-lg border border-white/30 shadow-lg flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                <span className="text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-widest flex-shrink-0">We Want:</span>
                                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                                    <span className="font-black text-xs sm:text-sm md:text-base text-white truncate">{activeGame.rootingInterest?.teamName}</span>
                                    {activeGame.rootingInterest?.status === 'winning' || activeGame.rootingInterest?.status === 'won' ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-200 flex-shrink-0" />
                                    ) : activeGame.rootingInterest?.status === 'pending' ? (
                                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-200 flex-shrink-0" />
                                    ) : (
                                        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-200 flex-shrink-0" />
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={toggleLock}
                                className={`p-1 sm:p-1.5 rounded-lg backdrop-blur-xl border transition-all shadow-lg touch-manipulation flex-shrink-0 ${
                                    isGameLocked 
                                        ? 'bg-[#0062B8]/90 border-white/30 text-white hover:bg-[#0062B8]' 
                                        : 'bg-white/60 border-white/40 text-[#0062B8] hover:bg-white/80'
                                }`}
                                title={isGameLocked ? 'Unlock game selection' : 'Lock game selection'}
                            >
                                {isGameLocked ? (
                                    <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                ) : (
                                    <Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                )}
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        <div className="hidden sm:flex flex-col items-end text-right">
                            <span className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest font-bold">Last Updated</span>
                            <span className="text-[10px] sm:text-xs font-mono text-[#0062B8]">{lastUpdated.toLocaleTimeString()}</span>
                        </div>
                        <button onClick={fetchGames} className="p-2 sm:p-2.5 hover:bg-white/60 backdrop-blur-md rounded-full transition-all border border-transparent hover:border-white/40 touch-manipulation">
                            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : 'text-[#0062B8]'}`} />
                        </button>
                    </div>
                </header>

                {/* Content Grid */}
                <div className="flex-1 flex flex-col sm:flex-row overflow-visible sm:overflow-hidden min-h-0">
                    {/* Main Game Display */}
                    <div className={`flex-1 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 pb-40 sm:pb-36 md:pb-40 relative z-10 pt-32 sm:pt-20 md:pt-20 min-h-0 flex-shrink-0 overflow-visible ${mobileView === 'guide' ? 'hidden sm:flex' : 'flex'}`}>
                        {activeGame ? (
                            <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-700">
                                {/* Rooting Context Badge - Mobile */}
                                <div className="sm:hidden mb-2 sm:mb-3 md:mb-4 flex items-center gap-2 sm:gap-3 z-30 w-full max-w-5xl px-2">
                                    <div className="bg-[#0062B8]/90 backdrop-blur-xl px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-xl sm:rounded-2xl border border-white/30 shadow-xl flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest flex-shrink-0">We Want:</span>
                                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                            <span className="font-black text-base sm:text-lg md:text-xl text-white truncate">{activeGame.rootingInterest?.teamName}</span>
                                            {activeGame.rootingInterest?.status === 'winning' || activeGame.rootingInterest?.status === 'won' ? (
                                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-200 flex-shrink-0" />
                                            ) : activeGame.rootingInterest?.status === 'pending' ? (
                                                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-200 flex-shrink-0" />
                                            ) : (
                                                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-200 flex-shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleLock}
                                        className={`p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-xl border transition-all shadow-lg touch-manipulation flex-shrink-0 ${
                                            isGameLocked 
                                                ? 'bg-[#0062B8]/90 border-white/30 text-white hover:bg-[#0062B8]' 
                                                : 'bg-white/60 border-white/40 text-[#0062B8] hover:bg-white/80'
                                        }`}
                                        title={isGameLocked ? 'Unlock game selection' : 'Lock game selection'}
                                    >
                                        {isGameLocked ? (
                                            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                                        ) : (
                                            <Unlock className="w-4 h-4 sm:w-5 sm:h-5" />
                                        )}
                                    </button>
                                </div>

                                {/* Scoreboard with Navigation */}
                                <div className="w-full max-w-4xl relative">
                                    <button
                                        onClick={navigateToPreviousGame}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-8 md:-translate-x-12 z-20 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/70 backdrop-blur-xl rounded-full border border-white/40 shadow-lg hover:bg-white/90 active:bg-white transition-all touch-manipulation flex items-center justify-center group"
                                        title="Previous game"
                                    >
                                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#0062B8] group-hover:text-[#002E5D] transition-colors" />
                                    </button>

                                    <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 md:gap-8 lg:gap-16 px-2">
                                        <BigTeamDisplay team={activeGame.away} isOpponentWinner={activeGame.home.isWinner} align="right" />

                                        <div className="flex flex-col items-center gap-2 sm:gap-4">
                                            <div className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-black text-gray-300/40 italic select-none">VS</div>
                                            {activeGame.isLive && activeGame.situation.clock && (
                                                <div className="flex flex-col items-center bg-[#002E5D]/90 backdrop-blur-xl rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 border border-white/20 shadow-xl">
                                                    <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white font-mono tracking-tight">
                                                        {activeGame.situation.clock}
                                                    </span>
                                                    <span className="text-xs sm:text-sm text-white/80">{activeGame.situation.periodDisplay}</span>
                                                </div>
                                            )}
                                        </div>

                                        <BigTeamDisplay team={activeGame.home} isOpponentWinner={activeGame.away.isWinner} align="left" />
                                    </div>

                                    <button
                                        onClick={navigateToNextGame}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-8 md:translate-x-12 z-20 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/70 backdrop-blur-xl rounded-full border border-white/40 shadow-lg hover:bg-white/90 active:bg-white transition-all touch-manipulation flex items-center justify-center group"
                                        title="Next game"
                                    >
                                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#0062B8] group-hover:text-[#002E5D] transition-colors" />
                                    </button>
                                </div>

                                {/* Venue Info */}
                                <div className="mt-6 sm:mt-8 md:mt-12 max-w-4xl w-full px-2 mb-4 sm:mb-6">
                                    <div className="flex items-center justify-center gap-2 text-gray-700 text-xs sm:text-sm font-medium">
                                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-[#0062B8]" />
                                        <span className="text-center">{activeGame.venue}</span>
                                    </div>
                                </div>

                                {/* Matchup Predictor & Game Leaders */}
                                <div className="mt-0 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 px-2 pb-20 sm:pb-28 md:pb-36 overflow-visible">
                                    <MatchupPredictor game={activeGame} />

                                    {/* Leaders Module */}
                                    <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-white/40 shadow-lg w-full min-h-[240px] sm:min-h-[260px] flex flex-col">
                                        <div className="mb-2 flex-shrink-0">
                                            <h3 className="text-[9px] sm:text-[10px] font-bold text-[#002E5D] uppercase tracking-widest mb-1.5 border-b border-gray-200/50 pb-1 sm:pb-1.5">Game Leaders</h3>
                                            
                                            {activeGame.leaders && activeGame.leaders.length > 0 && (
                                                <div className="flex gap-1 mt-1.5 bg-white/40 backdrop-blur-sm rounded-lg p-0.5 border border-white/30">
                                                    <button
                                                        onClick={() => setLeadersView('all')}
                                                        className={`flex-1 px-2 py-1 rounded text-[8px] sm:text-[9px] font-bold transition-all ${
                                                            leadersView === 'all'
                                                                ? 'bg-[#0062B8] text-white shadow-sm'
                                                                : 'text-gray-600 hover:bg-white/60'
                                                        }`}
                                                    >
                                                        All
                                                    </button>
                                                    <button
                                                        onClick={() => setLeadersView('away')}
                                                        className={`flex-1 px-2 py-1 rounded text-[8px] sm:text-[9px] font-bold transition-all ${
                                                            leadersView === 'away'
                                                                ? 'bg-[#0062B8] text-white shadow-sm'
                                                                : 'text-gray-600 hover:bg-white/60'
                                                        }`}
                                                    >
                                                        {activeGame.away.shortName}
                                                    </button>
                                                    <button
                                                        onClick={() => setLeadersView('home')}
                                                        className={`flex-1 px-2 py-1 rounded text-[8px] sm:text-[9px] font-bold transition-all ${
                                                            leadersView === 'home'
                                                                ? 'bg-[#0062B8] text-white shadow-sm'
                                                                : 'text-gray-600 hover:bg-white/60'
                                                        }`}
                                                    >
                                                        {activeGame.home.shortName}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-2">
                                            {activeGame.leaders && activeGame.leaders.length > 0 ? (
                                                (() => {
                                                    // Filter leaders based on selected view
                                                    let filteredLeaders = activeGame.leaders;
                                                    if (leadersView === 'away') {
                                                        filteredLeaders = activeGame.leaders.filter(l => l.teamId === activeGame.away.id);
                                                    } else if (leadersView === 'home') {
                                                        filteredLeaders = activeGame.leaders.filter(l => l.teamId === activeGame.home.id);
                                                    }
                                                    
                                                    // Group by category and take top from each (basketball categories)
                                                    const categories = ['Points', 'Rebounds', 'Assists', 'Steals', 'Blocks'];
                                                    const displayedLeaders: typeof activeGame.leaders = [];
                                                    
                                                    categories.forEach(cat => {
                                                        const leader = filteredLeaders.find(l => 
                                                            l.name.toLowerCase().includes(cat.toLowerCase())
                                                        );
                                                        if (leader) displayedLeaders.push(leader);
                                                    });
                                                    
                                                    // If no category match, just show first 5
                                                    if (displayedLeaders.length === 0) {
                                                        displayedLeaders.push(...filteredLeaders.slice(0, 5));
                                                    }
                                                    
                                                    return displayedLeaders.map((leader, i) => (
                                                        <div key={i} className="bg-white/40 backdrop-blur-sm rounded-lg p-2 border border-white/30 flex items-center gap-2">
                                                            {leader.athlete.headshot ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={leader.athlete.headshot} alt={leader.athlete.shortName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/80 backdrop-blur-sm object-cover border border-white/50 shadow-sm flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 flex items-center justify-center text-[8px] sm:text-[9px] text-gray-600 shadow-sm flex-shrink-0">
                                                                    {leader.athlete.position || '?'}
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">{leader.athlete.shortName}</div>
                                                                <div className="text-[9px] sm:text-[10px] text-gray-600 truncate">{leader.name}</div>
                                                            </div>
                                                            <div className="text-[11px] sm:text-xs font-mono font-bold text-[#0062B8] flex-shrink-0">{leader.displayValue}</div>
                                                        </div>
                                                    ));
                                                })()
                                            ) : (
                                                <div className="text-center text-gray-400 text-[10px] sm:text-xs py-8">No leader data available</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">No games available</div>
                        )}
                    </div>

                    {/* Right Sidebar: Rooting Guide */}
                    <div className={`w-full sm:w-80 lg:w-72 xl:w-80 bg-white/40 backdrop-blur-xl border-l border-white/30 flex flex-col min-h-[400px] pt-0 sm:pt-[72px] md:pt-[80px] ${mobileView === 'game' ? 'hidden sm:flex' : 'flex'}`}>
                        <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-white/30 p-3 sm:p-4 z-10">
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <h2 className="text-xs sm:text-sm font-black text-[#0062B8] uppercase tracking-widest">Big 12 Rooting Guide</h2>
                                <div className="bg-white/20 backdrop-blur-xl rounded-lg p-1.5 sm:p-2 border border-white/30 shadow-lg">
                                    <div className="text-[7px] sm:text-[8px] font-bold text-white/90 uppercase tracking-widest mb-0.5 text-center">
                                        Tournament Odds
                                    </div>
                                    <div className="flex items-baseline justify-center gap-0.5">
                                        <span className="text-lg sm:text-xl md:text-2xl font-black text-white">
                                            {tournamentOdds.toFixed(1)}
                                        </span>
                                        <span className="text-[10px] sm:text-xs font-bold text-white/80">%</span>
                                    </div>
                                    <div className="text-[6px] sm:text-[7px] text-white/70 text-center mt-0.5 italic">
                                        Based on record, ranking & outcomes
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 -webkit-overflow-scrolling-touch">
                            {games.map((game) => (
                                <button
                                    key={game.id}
                                    onClick={() => handleGameSelect(game.id)}
                                    className={`w-full text-left p-2 rounded-xl border transition-all backdrop-blur-md
                                        ${selectedGameId === game.id ? 'bg-[#0062B8]/20 border-[#0062B8] shadow-md' : 'bg-white/60 border-[#0062B8]/30 hover:bg-white/80 hover:border-[#0062B8]/50'}
                                    `}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] sm:text-[10px] font-bold text-[#002E5D]">
                                            #{game.rootingInterest?.importance || '?'}
                                        </span>
                                        {game.rootingInterest && (
                                            <span className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                game.rootingInterest.status === 'won' ? 'bg-green-500/20 text-green-700' :
                                                game.rootingInterest.status === 'lost' ? 'bg-red-500/20 text-red-700' :
                                                game.rootingInterest.status === 'winning' ? 'bg-blue-500/20 text-blue-700' :
                                                game.rootingInterest.status === 'losing' ? 'bg-orange-500/20 text-orange-700' :
                                                'bg-gray-500/20 text-gray-700'
                                            }`}>
                                                {game.rootingInterest.status.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] sm:text-xs font-bold ${game.away.isWinner ? 'text-[#0062B8]' : 'text-gray-600'}`}>
                                            {game.away.shortName}
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] text-gray-400">{game.away.score}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] sm:text-xs font-bold ${game.home.isWinner ? 'text-[#0062B8]' : 'text-gray-600'}`}>
                                            {game.home.shortName}
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] text-gray-400">{game.home.score}</span>
                                    </div>
                                    {game.rootingInterest && (
                                        <div className="mt-1.5 pt-1.5 border-t border-gray-200/50">
                                            <span className="text-[8px] sm:text-[9px] text-gray-600">
                                                Preferred: <span className="font-bold text-[#0062B8]">{game.rootingInterest.teamName}</span>
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Ticker */}
            <footer className="bg-white/80 backdrop-blur-xl border-t border-white/30 p-2 sm:p-3 shadow-lg z-10">
                <div className="flex items-center gap-2 sm:gap-4 max-w-7xl mx-auto">
                    <button onClick={prevTickerPage} className="p-1 sm:p-2 hover:bg-white/60 rounded-lg transition-all touch-manipulation flex-shrink-0">
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[#0062B8]" />
                    </button>
                    <div className="flex-1 flex gap-2 sm:gap-4 overflow-hidden">
                        {visibleTickerGames.map((game) => (
                            <button
                                key={game.id}
                                onClick={() => handleGameSelect(game.id)}
                                className={`flex-1 min-w-0 flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all backdrop-blur-sm touch-manipulation ${
                                    selectedGameId === game.id 
                                        ? 'bg-[#0062B8]/20 border-[#0062B8] shadow-md' 
                                        : 'bg-white/60 border-white/40 hover:bg-white/80'
                                }`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={game.away.logo} alt={game.away.shortName} className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[9px] sm:text-[10px] font-bold text-gray-700 truncate">{game.away.shortName}</div>
                                    <div className="text-[8px] sm:text-[9px] text-[#0062B8] font-black">{game.away.score}</div>
                                </div>
                                <div className="text-[8px] sm:text-[9px] text-gray-400">@</div>
                                <div className="flex-1 min-w-0 text-right">
                                    <div className="text-[9px] sm:text-[10px] font-bold text-gray-700 truncate">{game.home.shortName}</div>
                                    <div className="text-[8px] sm:text-[9px] text-[#0062B8] font-black">{game.home.score}</div>
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={game.home.logo} alt={game.home.shortName} className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
                                {game.rootingInterest && (
                                    <span className="ml-0.5 sm:ml-1 text-[7px] sm:text-[8px] bg-[#0062B8] px-0.5 sm:px-1 rounded text-white">Preferred</span>
                                )}
                            </button>
                        ))}
                        {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="flex-1 min-w-0 p-2 sm:p-3 rounded-lg border border-white/20 bg-white/20 backdrop-blur-sm" />
                        ))}
                    </div>
                    <button onClick={nextTickerPage} className="p-1 sm:p-2 hover:bg-white/60 rounded-lg transition-all touch-manipulation flex-shrink-0">
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#0062B8]" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default ByuBasketballPage;

