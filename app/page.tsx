'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Tv, MapPin, PlayCircle, ChevronLeft, ChevronRight, MousePointerClick, CheckCircle2, XCircle, AlertCircle, Lock, Unlock, X, Share2, MessageCircle, Twitter, Facebook } from 'lucide-react';
import { FaFootball } from 'react-icons/fa6';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
    sor: number | null; // Strength of Record
    isWinner: boolean;
    hasBall: boolean;
}

interface GameSituation {
    down: number;
    distance: number;
    downDistanceText: string;
    possession: string;
    isRedZone: boolean;
    lastPlay: string;
    yardLine: number;
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
        type: 'TOUCHDOWN' | 'INTERCEPTION' | 'FUMBLE' | 'SAFETY';
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
// Specific matchups we care about (team we want to win vs their opponent)
// 2025 Rivalry Week Games (Nov 28-30)
const MATCHUP_LIST = [
    { team: 'BYU', opponent: 'UCF', priority: 1 },
    { team: 'Mississippi State', opponent: 'Ole Miss', priority: 2 },
    { team: 'Washington', opponent: 'Oregon', priority: 3 },
    { team: 'Auburn', opponent: 'Alabama', priority: 4 },
    { team: 'LSU', opponent: 'Oklahoma', priority: 5 },
    { team: 'Arizona', opponent: 'Arizona State', priority: 6 },
    { team: 'Stanford', opponent: 'Notre Dame', priority: 7 },
    { team: 'Ohio State', opponent: 'Michigan', priority: 8 },
    { team: 'Pittsburgh', opponent: 'Miami', priority: 9 },
    { team: 'Tennessee', opponent: 'Vanderbilt', priority: 10 },
    { team: 'Texas A&M', opponent: 'Texas', priority: 11 },
    { team: 'Georgia Tech', opponent: 'Georgia', priority: 12 },
    { team: 'Iowa State', opponent: 'Oklahoma State', priority: 13 },
    { team: 'East Carolina', opponent: 'FAU', priority: 14 },
    { team: 'Utah', opponent: 'Kansas', priority: 15 }, // You Decide
    { team: 'Texas Tech', opponent: 'West Virginia', priority: 16 }, // You Decide
];

// SOR data will be fetched from Supabase

const ByuPage = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [error, setError] = useState<string | null>(null);
    const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
    const [tickerPage, setTickerPage] = useState(0);
    const [isGameLocked, setIsGameLocked] = useState(false);
    const [currentGameIndex, setCurrentGameIndex] = useState(0);
    const [slotsPerPage, setSlotsPerPage] = useState(5); // Always 5 slots: 1 ad + 4 games
    const [mobileView, setMobileView] = useState<'game' | 'guide'>('game');
    const [leadersView, setLeadersView] = useState<'all' | 'away' | 'home'>('all');
    const [gameDetailView, setGameDetailView] = useState<'stats' | 'live'>('stats');
    const [sorData, setSorData] = useState<Record<string, number | null>>({}); // Cache SOR data: key is team_id or short_name, value is sor_value (can be null)
    const [showShareMenu, setShowShareMenu] = useState(false);

    const DATA_URL = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20251128-20251130&limit=200&groups=80";

    const fetchGames = async (sorDataOverride?: Record<string, number | null>) => {
        try {
            setLoading(true);
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();

            // Use provided SOR data or fall back to state
            const currentSorData = sorDataOverride || sorData;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allGames = (data.events || []).map((event: any) => {
                const competition = event.competitions[0];
                const competitors = competition.competitors;
                const home = competitors.find((c: any) => c.homeAway === 'home');
                const away = competitors.find((c: any) => c.homeAway === 'away');
                const situation = competition.situation || {};

                const leaders = (competition.leaders || []).flatMap((cat: any) => {
                    return (cat.leaders || []).map((l: any) => ({
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
                    if (text.includes('touchdown')) alert = { type: 'TOUCHDOWN', text: 'TOUCHDOWN' };
                    else if (text.includes('intercepted')) alert = { type: 'INTERCEPTION', text: 'INTERCEPTION' };
                    else if (text.includes('fumble')) alert = { type: 'FUMBLE', text: 'FUMBLE' };
                    else if (text.includes('safety')) alert = { type: 'SAFETY', text: 'SAFETY' };
                }

                // Helper function to get SOR value from Supabase cache
                const getSOR = (teamId: string, shortName: string): number | null => {
                    // Check team_id first, then short_name
                    if (teamId in currentSorData) {
                        return currentSorData[teamId];
                    }
                    if (shortName in currentSorData) {
                        return currentSorData[shortName];
                    }
                    return null;
                };

                // Parse Teams
                const homeShortName = home.team.shortDisplayName || home.team.abbreviation;
                const awayShortName = away.team.shortDisplayName || away.team.abbreviation;
                
                // Get team IDs from ESPN API (home.team.id and away.team.id are the actual team IDs)
                const homeTeamId = home.team.id || home.id;
                const awayTeamId = away.team.id || away.id;
                
                const homeTeam = {
                    id: home.id,
                    name: home.team.displayName,
                    shortName: homeShortName,
                    logo: home.team.logo,
                    score: home.score,
                    rank: home.curatedRank?.current < 26 ? home.curatedRank.current : null,
                    color: home.team.color ? `#${home.team.color}` : '#333',
                    record: home.records?.[0]?.summary,
                    sor: getSOR(homeTeamId, homeShortName),
                    isWinner: home.winner,
                    hasBall: situation.possession === home.id
                };
                const awayTeam = {
                    id: away.id,
                    name: away.team.displayName,
                    shortName: awayShortName,
                    logo: away.team.logo,
                    score: away.score,
                    rank: away.curatedRank?.current < 26 ? away.curatedRank.current : null,
                    color: away.team.color ? `#${away.team.color}` : '#333',
                    record: away.records?.[0]?.summary,
                    sor: getSOR(awayTeamId, awayShortName),
                    isWinner: away.winner,
                    hasBall: situation.possession === away.id
                };

                // Log every game to see what ESPN is returning

                // Determine Rooting Interest - check if this is one of our specific matchups
                let rootingInterest = undefined;

                // Helper to check if a team name matches using exact keywords
                const teamMatches = (actualTeam: Team, targetName: string) => {
                    const actualLower = actualTeam.name.toLowerCase();
                    const actualShortLower = actualTeam.shortName.toLowerCase();
                    const targetLower = targetName.toLowerCase();

                    // Define exact mappings to avoid confusion (e.g., Arizona vs Arizona State)
                    const exactMappings: Record<string, (name: string, short: string) => boolean> = {
                        'brigham young': (n, s) => n.includes('brigham young') || s === 'byu',
                        'central florida': (n, s) => (n.includes('central florida') || s === 'ucf') && !n.includes('south florida'),
                        'mississippi state': (n, s) => n.includes('mississippi state') || s === 'mississippi st',
                        'ole miss': (n, s) => n.includes('ole miss') || n.includes('mississippi') && !n.includes('state'),
                        'washington': (n, s) => n === 'washington' || (n.includes('washington') && !n.includes('state')),
                        'oregon': (n, s) => n === 'oregon' || (n.includes('oregon') && !n.includes('state')),
                        'auburn': (n, s) => n.includes('auburn'),
                        'alabama': (n, s) => n.includes('alabama') && !n.includes('birmingham'),
                        'louisiana state': (n, s) => n.includes('louisiana state') || s === 'lsu',
                        'oklahoma': (n, s) => n === 'oklahoma' || (n.includes('oklahoma') && !n.includes('state')),
                        'arizona': (n, s) => (n.includes('arizona') && !n.includes('state')) || s === 'arizona',
                        'arizona state': (n, s) => n.includes('arizona state') || s === 'arizona st',
                        'stanford': (n, s) => n.includes('stanford'),
                        'notre dame': (n, s) => n.includes('notre dame'),
                        'ohio state': (n, s) => n.includes('ohio state') || s === 'ohio st',
                        'michigan': (n, s) => n === 'michigan' || (n.includes('michigan') && !n.includes('state')),
                        'pittsburgh': (n, s) => n.includes('pittsburgh') || s === 'pitt',
                        'miami': (n, s) => n.includes('miami') && !n.includes('ohio'),
                        'tennessee': (n, s) => n.includes('tennessee'),
                        'vanderbilt': (n, s) => n.includes('vanderbilt'),
                        'texas a&m': (n, s) => n.includes('texas a&m') || s.includes('a&m'),
                        'texas': (n, s) => (n === 'texas' || n.includes('texas')) && !n.includes('a&m') && !n.includes('tech') && !n.includes('state') && !n.includes('el paso'),
                        'georgia tech': (n, s) => n.includes('georgia tech') || n.includes('ga tech') || s === 'georgia tech',
                        'georgia': (n, s) => (n === 'georgia' || n.includes('georgia')) && !n.includes('tech') && !n.includes('state') && !n.includes('southern'),
                        'iowa state': (n, s) => n.includes('iowa state') || s === 'iowa st',
                        'oklahoma state': (n, s) => n.includes('oklahoma state') || s === 'oklahoma st',
                        'east carolina': (n, s) => n.includes('east carolina') || s === 'ecu',
                        'florida atlantic': (n, s) => n.includes('florida atlantic') || s === 'fau',
                        'utah': (n, s) => n === 'utah' || (n.includes('utah') && !n.includes('state')),
                        'kansas': (n, s) => n === 'kansas' || (n.includes('kansas') && !n.includes('state')),
                        'texas tech': (n, s) => n.includes('texas tech') || s === 'texas tech',
                        'west virginia': (n, s) => n.includes('west virginia'),
                    };

                    const matcher = exactMappings[targetLower];
                    if (matcher) {
                        return matcher(actualLower, actualShortLower);
                    }

                    // Fallback to simple contains
                    return actualLower.includes(targetLower) || actualShortLower.includes(targetLower);
                };

                // Check if this game matches any of our desired matchups
                const matchup = MATCHUP_LIST.find(m => {
                    // Check if home/away match our team/opponent in either direction
                    const homeIsOurTeam = teamMatches(homeTeam, m.team);
                    const awayIsOpponent = teamMatches(awayTeam, m.opponent);
                    const awayIsOurTeam = teamMatches(awayTeam, m.team);
                    const homeIsOpponent = teamMatches(homeTeam, m.opponent);

                    const isMatch = (homeIsOurTeam && awayIsOpponent) || (awayIsOurTeam && homeIsOpponent);

                    // Debug logging
                    if (isMatch) {
                    }

                    return isMatch;
                });

                // Log all games for debugging

                if (matchup) {
                    // Determine which team is "our team"
                    const ourTeam = teamMatches(homeTeam, matchup.team) ? homeTeam : awayTeam;
                    const theirTeam = teamMatches(homeTeam, matchup.team) ? awayTeam : homeTeam;

                    const ourScore = parseInt(ourTeam.score || '0');
                    const theirScore = parseInt(theirTeam.score || '0');

                    let status: 'winning' | 'losing' | 'won' | 'lost' | 'tied' | 'pending' = 'pending';
                    const isFinal = event.status.type.completed;

                    if (ourScore > theirScore) status = isFinal ? 'won' : 'winning';
                    else if (ourScore < theirScore) status = isFinal ? 'lost' : 'losing';
                    else status = 'tied';

                    if (event.status.type.state === 'pre') status = 'pending';

                    rootingInterest = {
                        teamId: ourTeam.id,
                        teamName: ourTeam.shortName,
                        isWinning: ourScore >= theirScore,
                        status,
                        importance: matchup.priority
                    };
                }

                // Extract prediction data if available
                // NOTE: ESPN's scoreboard API does NOT include prediction data
                // We'll calculate probabilities based on team records/rankings as a fallback
                let prediction = undefined;
                
                // First, try to get ESPN's actual predictor data (if it exists)
                if (competition.predictor) {
                    const predictor = competition.predictor;
                    if (predictor.awayTeam && predictor.homeTeam) {
                        prediction = {
                            awayWinProbability: predictor.awayTeam.winPercentage || 0,
                            homeWinProbability: predictor.homeTeam.winPercentage || 0,
                        };
                    } else if (predictor.awayTeamOdds && predictor.homeTeamOdds) {
                        const awayOdds = predictor.awayTeamOdds;
                        const homeOdds = predictor.homeTeamOdds;
                        const total = awayOdds + homeOdds;
                        if (total > 0) {
                            prediction = {
                                awayWinProbability: (awayOdds / total) * 100,
                                homeWinProbability: (homeOdds / total) * 100,
                            };
                        }
                    }
                } else {
                    // Fallback: Calculate probabilities based on team records and rankings
                    // Parse win-loss records (format: "W-L" or "W-L-T")
                    const parseRecord = (record: string | undefined): number => {
                        if (!record) return 0.5; // Default to 50% if no record
                        const parts = record.split('-');
                        if (parts.length < 2) return 0.5;
                        const wins = parseInt(parts[0]) || 0;
                        const losses = parseInt(parts[1]) || 0;
                        const total = wins + losses;
                        return total > 0 ? wins / total : 0.5;
                    };

                    const awayWinRate = parseRecord(awayTeam.record);
                    const homeWinRate = parseRecord(homeTeam.record);
                    
                    // Factor in rankings (lower rank number = better team)
                    let awayRankBonus = 0;
                    let homeRankBonus = 0;
                    if (awayTeam.rank && homeTeam.rank) {
                        // Rank difference affects probability
                        const rankDiff = homeTeam.rank - awayTeam.rank;
                        awayRankBonus = rankDiff * 0.02; // 2% per rank difference
                        homeRankBonus = -rankDiff * 0.02;
                    } else if (awayTeam.rank && !homeTeam.rank) {
                        awayRankBonus = 0.1; // Ranked team gets 10% bonus
                    } else if (homeTeam.rank && !awayTeam.rank) {
                        homeRankBonus = 0.1;
                    }

                    // Combine win rate and rank bonus
                    const awayStrength = awayWinRate + awayRankBonus;
                    const homeStrength = homeWinRate + homeRankBonus;
                    const totalStrength = awayStrength + homeStrength;

                    if (totalStrength > 0) {
                        prediction = {
                            awayWinProbability: (awayStrength / totalStrength) * 100,
                            homeWinProbability: (homeStrength / totalStrength) * 100,
                        };
                    }
                }

                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: new Date(event.date),
                    status: event.status.type.state,
                    statusDetail: event.status.type.shortDetail,
                    isLive: event.status.type.state === 'in',
                    venue: competition.venue?.fullName || 'TBD',
                    broadcast: competition.broadcasts?.[0]?.names?.[0] || null,
                    situation: {
                        down: situation.down,
                        distance: situation.distance,
                        downDistanceText: situation.shortDownDistanceText,
                        possession: situation.possession,
                        isRedZone: situation.isRedZone,
                        lastPlay: situation.lastPlay?.text,
                        yardLine: situation.yardLine,
                    },
                    home: homeTeam,
                    away: awayTeam,
                    leaders,
                    alert,
                    rootingInterest,
                    prediction
                };
            });

            // Filter for Rooting Interests ONLY
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filteredGames = allGames.filter((g: any) => g.rootingInterest !== undefined);

            // Sort: Active/Finished games first, then by importance
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filteredGames.sort((a: any, b: any) => {
                // Helper function to get sort priority (lower number = higher priority)
                const getStatusPriority = (game: any) => {
                    // Active games (isLive) get highest priority
                    if (game.isLive) return 0;
                    // Finished games (won/lost) get second priority
                    if (game.rootingInterest?.status === 'won' || game.rootingInterest?.status === 'lost') return 1;
                    // Pending games get lowest priority
                    return 2;
                };
                
                const aStatusPriority = getStatusPriority(a);
                const bStatusPriority = getStatusPriority(b);
                
                // First sort by status (active/finished first)
                if (aStatusPriority !== bStatusPriority) {
                    return aStatusPriority - bStatusPriority;
                }
                
                // If same status, sort by importance
                return (a.rootingInterest?.importance || 99) - (b.rootingInterest?.importance || 99);
            });

            setGames(filteredGames);
            setLastUpdated(new Date());
            setLoading(false);
            setError(null);

            if (filteredGames.length > 0) {
                if (!selectedGameId) {
                    // Default to the highest priority active game, or just the highest priority
                    const liveGame = filteredGames.find((g: Game) => g.isLive);
                    const defaultGameId = liveGame ? liveGame.id : filteredGames[0].id;
                    setSelectedGameId(defaultGameId);
                    setCurrentGameIndex(filteredGames.findIndex((g: Game) => g.id === defaultGameId));
                } else {
                    // Update index if selected game still exists
                    const index = filteredGames.findIndex((g: Game) => g.id === selectedGameId);
                    if (index !== -1) {
                        setCurrentGameIndex(index);
                    } else {
                        // Selected game no longer exists, reset to first
                        setSelectedGameId(filteredGames[0].id);
                        setCurrentGameIndex(0);
                    }
                }
            }
        } catch (err) {
            setError("Unable to load scoreboard.");
            setLoading(false);
        }
    };

    // Fetch SOR data from Supabase (from college_football_fpi table)
    const fetchSORData = async (): Promise<Record<string, number | null>> => {
        try {
            // Check if Supabase is configured
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
            
            if (!supabaseUrl || !supabaseKey) {
                return {};
            }
            
            // Mapping from team_strength_of_record table team names to ESPN team identifiers
            // Maps full team names (e.g., "Indiana Hoosiers") to team_id and short_name used by ESPN API
            const teamNameMapping: Record<string, { teamId?: string; shortNames: string[] }> = {
                'Indiana Hoosiers': { teamId: '84', shortNames: ['Indiana', 'Hoosiers'] },
                'Texas A&M Aggies': { teamId: '2', shortNames: ['Texas A&M', 'Aggies'] },
                'Ohio State Buckeyes': { teamId: '103', shortNames: ['Ohio State', 'Ohio St'] },
                'Georgia Bulldogs': { teamId: '61', shortNames: ['Georgia', 'Bulldogs'] },
                'Oregon Ducks': { teamId: '2483', shortNames: ['Oregon', 'Ducks'] },
                'Ole Miss Rebels': { teamId: '145', shortNames: ['Ole Miss', 'Mississippi'] },
                'BYU Cougars': { teamId: '252', shortNames: ['BYU', 'Cougars'] },
                'Oklahoma Sooners': { teamId: '201', shortNames: ['Oklahoma', 'Sooners'] },
                'Alabama Crimson Tide': { teamId: '333', shortNames: ['Alabama', 'Crimson Tide'] },
                'Texas Tech Red Raiders': { teamId: '2641', shortNames: ['Texas Tech', 'Red Raiders'] },
                'Texas Longhorns': { teamId: '251', shortNames: ['Texas', 'Longhorns'] },
                'Vanderbilt Commodores': { teamId: '238', shortNames: ['Vanderbilt', 'Commodores'] },
                'Notre Dame Fighting Irish': { teamId: '87', shortNames: ['Notre Dame', 'Fighting Irish'] },
                'Michigan Wolverines': { teamId: '130', shortNames: ['Michigan', 'Wolverines'] },
                'Utah Utes': { teamId: '254', shortNames: ['Utah', 'Utes'] },
                'Miami Hurricanes': { teamId: '2390', shortNames: ['Miami', 'Hurricanes'] },
                'USC Trojans': { teamId: '30', shortNames: ['USC', 'Trojans'] },
                'Tennessee Volunteers': { teamId: '2633', shortNames: ['Tennessee', 'Volunteers'] },
                'Iowa Hawkeyes': { teamId: '2294', shortNames: ['Iowa', 'Hawkeyes'] },
                'LSU Tigers': { teamId: '99', shortNames: ['LSU', 'Tigers'] },
                'Arizona Wildcats': { teamId: '12', shortNames: ['Arizona', 'Wildcats'] },
                'Washington Huskies': { teamId: '264', shortNames: ['Washington', 'Huskies'] },
                'Missouri Tigers': { teamId: '142', shortNames: ['Missouri', 'Tigers'] },
                'Virginia Cavaliers': { teamId: '258', shortNames: ['Virginia', 'Cavaliers'] },
                'Illinois Fighting Illini': { teamId: '356', shortNames: ['Illinois', 'Fighting Illini'] },
                'Georgia Tech Yellow Jackets': { teamId: '59', shortNames: ['Georgia Tech', 'Yellow Jackets'] },
                'Arizona State Sun Devils': { teamId: '9', shortNames: ['Arizona State', 'Arizona St'] },
                'Pittsburgh Panthers': { teamId: '221', shortNames: ['Pittsburgh', 'Pitt'] },
                'South Florida Bulls': { teamId: '58', shortNames: ['South Florida', 'Bulls'] },
                'SMU Mustangs': { teamId: '2567', shortNames: ['SMU', 'Mustangs'] },
                'TCU Horned Frogs': { teamId: '2628', shortNames: ['TCU', 'Horned Frogs'] },
                'Houston Cougars': { teamId: '248', shortNames: ['Houston', 'Cougars'] },
                'Iowa State Cyclones': { teamId: '66', shortNames: ['Iowa State', 'Iowa St'] },
                'Wake Forest Demon Deacons': { teamId: '154', shortNames: ['Wake Forest', 'Demon Deacons'] },
                'Louisville Cardinals': { teamId: '97', shortNames: ['Louisville', 'Cardinals'] },
                'Cincinnati Bearcats': { teamId: '2132', shortNames: ['Cincinnati', 'Bearcats'] },
                'UNLV Rebels': { teamId: '2439', shortNames: ['UNLV', 'Rebels'] },
                'Kentucky Wildcats': { teamId: '96', shortNames: ['Kentucky', 'Wildcats'] },
                'NC State Wolfpack': { teamId: '152', shortNames: ['NC State', 'Wolfpack'] },
                'Northwestern Wildcats': { teamId: '77', shortNames: ['Northwestern', 'Wildcats'] },
                'Nebraska Cornhuskers': { teamId: '158', shortNames: ['Nebraska', 'Cornhuskers'] },
                'Auburn Tigers': { teamId: undefined, shortNames: ['Auburn', 'Tigers'] }, // Note: team_id needs verification
                'Wisconsin Badgers': { teamId: '275', shortNames: ['Wisconsin', 'Badgers'] },
                'Minnesota Golden Gophers': { teamId: '135', shortNames: ['Minnesota', 'Golden Gophers'] },
                'Boise State Broncos': { teamId: '68', shortNames: ['Boise State', 'Boise St'] },
                'Mississippi State Bulldogs': { teamId: '344', shortNames: ['Mississippi State', 'Mississippi St'] },
                'South Carolina Gamecocks': { teamId: '2579', shortNames: ['South Carolina', 'Gamecocks'] },
                'Penn State Nittany Lions': { teamId: '213', shortNames: ['Penn State', 'Nittany Lions'] },
                'Florida Gators': { teamId: '57', shortNames: ['Florida', 'Gators'] },
                'Rutgers Scarlet Knights': { teamId: '164', shortNames: ['Rutgers', 'Scarlet Knights'] },
                'West Virginia Mountaineers': { teamId: '277', shortNames: ['West Virginia', 'Mountaineers'] },
                'East Carolina Pirates': { teamId: '151', shortNames: ['East Carolina', 'Pirates'] },
                'Clemson Tigers': { teamId: '228', shortNames: ['Clemson', 'Tigers'] },
                'Duke Blue Devils': { teamId: '150', shortNames: ['Duke', 'Blue Devils'] },
                'Florida State Seminoles': { teamId: '52', shortNames: ['Florida State', 'Florida St'] },
                'UCF Knights': { teamId: '2116', shortNames: ['UCF', 'Knights'] },
                'Kansas Jayhawks': { teamId: '2305', shortNames: ['Kansas', 'Jayhawks'] },
                'Stanford Cardinal': { teamId: '24', shortNames: ['Stanford', 'Cardinal'] },
                'UCLA Bruins': { teamId: '26', shortNames: ['UCLA', 'Bruins'] },
                'Oklahoma State Cowboys': { teamId: '197', shortNames: ['Oklahoma State', 'Oklahoma St'] },
                'Syracuse Orange': { teamId: '183', shortNames: ['Syracuse', 'Orange'] },
                'Maryland Terrapins': { teamId: '120', shortNames: ['Maryland', 'Terrapins'] },
                'Michigan State Spartans': { teamId: '127', shortNames: ['Michigan State', 'Michigan St'] },
                'Arkansas Razorbacks': { teamId: '8', shortNames: ['Arkansas', 'Razorbacks'] },
                'Colorado Buffaloes': { teamId: '38', shortNames: ['Colorado', 'Buffaloes'] },
                'Virginia Tech Hokies': { teamId: '259', shortNames: ['Virginia Tech', 'Hokies'] },
                'North Carolina Tar Heels': { teamId: '153', shortNames: ['North Carolina', 'Tar Heels'] },
                'Purdue Boilermakers': { teamId: '2509', shortNames: ['Purdue', 'Boilermakers'] },
                'Boston College Eagles': { teamId: undefined, shortNames: ['Boston College', 'Eagles'] }, // Note: team_id conflicts with Ohio State
                'Oregon State Beavers': { teamId: '204', shortNames: ['Oregon State', 'Oregon St'] },
                'Washington State Cougars': { teamId: '265', shortNames: ['Washington State', 'Washington St'] },
                // Additional teams from the full list
                'Navy Midshipmen': { teamId: undefined, shortNames: ['Navy', 'Midshipmen'] },
                'James Madison Dukes': { teamId: '256', shortNames: ['James Madison', 'Dukes'] },
                'Tulane Green Wave': { teamId: '2655', shortNames: ['Tulane', 'Green Wave'] },
                'North Texas Mean Green': { teamId: '249', shortNames: ['North Texas', 'Mean Green'] },
                'New Mexico Lobos': { teamId: '167', shortNames: ['New Mexico', 'Lobos'] },
                'Old Dominion Monarchs': { teamId: '295', shortNames: ['Old Dominion', 'Monarchs'] },
                'Kennesaw State Owls': { teamId: '338', shortNames: ['Kennesaw State', 'Kennesaw St'] },
                'San Diego State Aztecs': { teamId: '21', shortNames: ['San Diego State', 'San Diego St'] },
                'Baylor Bears': { teamId: '239', shortNames: ['Baylor', 'Bears'] },
                'Western Kentucky Hilltoppers': { teamId: '98', shortNames: ['Western Kentucky', 'Western KY'] },
                'Kansas State Wildcats': { teamId: '2306', shortNames: ['Kansas State', 'Kansas St'] },
                'Memphis Tigers': { teamId: undefined, shortNames: ['Memphis', 'Tigers'] },
                'UConn Huskies': { teamId: undefined, shortNames: ['UConn', 'Huskies'] },
                'UTSA Roadrunners': { teamId: '2636', shortNames: ['UTSA', 'Roadrunners'] },
                'Hawai\'i Rainbow Warriors': { teamId: '62', shortNames: ['Hawai\'i', 'Rainbow Warriors'] },
                'Fresno State Bulldogs': { teamId: '278', shortNames: ['Fresno State', 'Fresno St'] },
                'Troy Trojans': { teamId: '2653', shortNames: ['Troy', 'Trojans'] },
                'California Golden Bears': { teamId: '25', shortNames: ['California', 'Golden Bears'] },
                'Central Michigan Chippewas': { teamId: '2117', shortNames: ['Central Michigan', 'C Michigan'] },
                'Toledo Rockets': { teamId: '2649', shortNames: ['Toledo', 'Rockets'] },
                'Coastal Carolina Chanticleers': { teamId: '324', shortNames: ['Coastal Carolina', 'Coastal'] },
                'Utah State Aggies': { teamId: '328', shortNames: ['Utah State', 'Aggies'] },
                'Southern Miss Golden Eagles': { teamId: '2572', shortNames: ['Southern Miss', 'Golden Eagles'] },
                'Army Black Knights': { teamId: '349', shortNames: ['Army', 'Black Knights'] },
                'Miami (OH) RedHawks': { teamId: '193', shortNames: ['Miami OH', 'RedHawks'] },
                'Jacksonville State Gamecocks': { teamId: '55', shortNames: ['Jacksonville State', 'Jax State'] },
                'Florida International Panthers': { teamId: '2229', shortNames: ['Florida International', 'FIU'] },
                'Louisiana Tech Bulldogs': { teamId: '2348', shortNames: ['Louisiana Tech', 'Bulldogs'] },
                'Georgia Southern Eagles': { teamId: '290', shortNames: ['Georgia Southern', 'GA Southern'] },
                'Louisiana Ragin\' Cajuns': { teamId: '309', shortNames: ['Louisiana', 'Ragin\' Cajuns'] },
                'Rice Owls': { teamId: '242', shortNames: ['Rice', 'Owls'] },
                'Temple Owls': { teamId: '218', shortNames: ['Temple', 'Owls'] },
                'Texas State Bobcats': { teamId: '326', shortNames: ['Texas State', 'Texas St'] },
                'Marshall Thundering Herd': { teamId: '276', shortNames: ['Marshall', 'Thundering Herd'] },
                'Arkansas State Red Wolves': { teamId: '2032', shortNames: ['Arkansas State', 'Arkansas St'] },
                'App State Mountaineers': { teamId: '2026', shortNames: ['App State', 'Mountaineers'] },
                'Kent State Golden Flashes': { teamId: '2309', shortNames: ['Kent State', 'Golden Flashes'] },
                'Florida Atlantic Owls': { teamId: '2226', shortNames: ['Florida Atlantic', 'FAU'] },
                'Delaware Blue Hens': { teamId: '48', shortNames: ['Delaware', 'Blue Hens'] },
                'Tulsa Golden Hurricane': { teamId: '202', shortNames: ['Tulsa', 'Golden Hurricane'] },
                'Ball State Cardinals': { teamId: '2050', shortNames: ['Ball State', 'Cardinals'] },
                'Wyoming Cowboys': { teamId: '2751', shortNames: ['Wyoming', 'Cowboys'] },
                'UAB Blazers': { teamId: '5', shortNames: ['UAB', 'Blazers'] },
                'South Alabama Jaguars': { teamId: '6', shortNames: ['South Alabama', 'Jaguars'] },
                'New Mexico State Aggies': { teamId: '166', shortNames: ['New Mexico State', 'New Mexico St'] },
                'Liberty Flames': { teamId: '2335', shortNames: ['Liberty', 'Flames'] },
                'Nevada Wolf Pack': { teamId: '2440', shortNames: ['Nevada', 'Wolf Pack'] },
                'Air Force Falcons': { teamId: '2005', shortNames: ['Air Force', 'Falcons'] },
                'San José State Spartans': { teamId: '23', shortNames: ['San José State', 'San José St'] },
                'UL Monroe Warhawks': { teamId: '2433', shortNames: ['UL Monroe', 'Warhawks'] },
                'Buffalo Bulls': { teamId: '2084', shortNames: ['Buffalo', 'Bulls'] },
                'Sam Houston Bearkats': { teamId: '2534', shortNames: ['Sam Houston', 'Bearkats'] },
                'Charlotte 49ers': { teamId: '2429', shortNames: ['Charlotte', '49ers'] },
                'Georgia State Panthers': { teamId: '2247', shortNames: ['Georgia State', 'Georgia St'] },
                'UTEP Miners': { teamId: '2638', shortNames: ['UTEP', 'Miners'] },
                'Middle Tennessee Blue Raiders': { teamId: '2393', shortNames: ['Middle Tennessee', 'MTSU'] },
            };
            
            // Try fetching from team_strength_of_record table first
            let data: Array<{ team_name: string; sor_rank?: number; strength_of_record_rank?: number }> | null = null;
            let error: any = null;
            
            const { data: sorRecordData, error: sorRecordError } = await supabase
                .from('team_strength_of_record')
                .select('team_name, sor_rank');

            // If team_strength_of_record doesn't exist, try college_football_fpi
            if (sorRecordError && (sorRecordError.code === '42P01' || sorRecordError.message?.includes('does not exist'))) {
                const { data: fpiData, error: fpiError } = await supabase
                    .from('college_football_fpi')
                    .select('team_name, strength_of_record_rank');
                
                if (fpiError && (fpiError.code === '42P01' || fpiError.message?.includes('does not exist'))) {
                    const { data: sorData, error: sorError } = await supabase
                        .from('team_sor')
                        .select('team_id, team_short_name, sor_value')
                        .eq('season', 2025);
                    
                    if (sorError) {
                        return {};
                    }
                    
                    if (sorData && sorData.length > 0) {
                        const sorMap: Record<string, number | null> = {};
                        sorData.forEach((row) => {
                            if (row.team_id && row.sor_value !== null) {
                                sorMap[row.team_id] = row.sor_value;
                            }
                            if (row.team_short_name && row.sor_value !== null) {
                                sorMap[row.team_short_name] = row.sor_value;
                            }
                        });
                        setSorData(sorMap);
                        return sorMap;
                    }
                    return {};
                }
                
                if (fpiError) {
                    return {};
                }
                
                data = fpiData;
                error = fpiError;
            } else {
                data = sorRecordData;
                error = sorRecordError;
            }

            if (error) {
                return {};
            }

            if (data && data.length > 0) {
                // Build a lookup map: team_id -> sor_value and short_name -> sor_value
                const sorMap: Record<string, number | null> = {};
                data.forEach((row) => {
                    // Handle both sor_rank (from team_strength_of_record) and strength_of_record_rank (from college_football_fpi)
                    const sorValue = (row as any).sor_rank !== undefined ? (row as any).sor_rank : (row as any).strength_of_record_rank;
                    if (sorValue === null || sorValue === undefined) return;
                    
                    const mapping = teamNameMapping[row.team_name];
                    if (mapping) {
                        // Add by team_id if available
                        if (mapping.teamId) {
                            sorMap[mapping.teamId] = sorValue;
                        }
                        // Add by all short names
                        mapping.shortNames.forEach(shortName => {
                            sorMap[shortName] = sorValue;
                        });
                    } else {
                        // Fallback: try to extract short name from full name
                        // e.g., "Indiana Hoosiers" -> try "Indiana"
                        const nameParts = row.team_name.split(' ');
                        if (nameParts.length > 0) {
                            sorMap[nameParts[0]] = sorValue;
                        }
                        sorMap[row.team_name] = sorValue;
                    }
                });
                setSorData(sorMap);
                return sorMap;
            } else {
                return {};
            }
        } catch (err) {
            return {};
        }
    };

    // Load SOR data first, then fetch games
    useEffect(() => {
        const loadData = async () => {
            // First, load SOR data and get the map directly
            const sorMap = await fetchSORData();
            // Then fetch games with the SOR data passed directly
            await fetchGames(sorMap);
        };
        loadData();
        const interval = setInterval(() => {
            fetchGames(); // Just refresh games periodically (will use state sorData)
        }, 30000);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Initialize AdSense ads when component mounts and ad element is ready
    useEffect(() => {
        const initializeAd = () => {
            try {
                // @ts-ignore - adsbygoogle is loaded by AdSense script
                if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
                    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
                }
            } catch (err) {
            }
        };

        // Try immediately
        initializeAd();

        // Also try after a short delay to ensure script is loaded
        const timeout = setTimeout(initializeAd, 500);
        return () => clearTimeout(timeout);
    }, []);

    // Ticker Auto-Scroll - Always show 4 games per page (slot 1 is ad)
    useEffect(() => {
        if (games.length === 0) return;
        const interval = setInterval(() => {
            setTickerPage(prev => {
                const gamesPerPage = 4; // Always 4 games (slots 2-5)
                const totalPages = Math.ceil(games.length / gamesPerPage);
                const nextPage = prev + 1;
                return nextPage < totalPages ? nextPage : 0;
            });
        }, 10000);
        return () => clearInterval(interval);
    }, [games.length]);

    // Auto-rotation removed - marquee only changes when user manually selects a game

    const activeGame = games.find(g => g.id === selectedGameId) || games[0];
    // Always show 4 games (slots 2-5), slot 1 is always the ad
    // Adjust slotsPerPage to account for ad taking 1 slot
    const gamesPerPage = slotsPerPage - 1; // Subtract 1 for the ad slot
    const visibleTickerGames = games.slice(tickerPage * gamesPerPage, (tickerPage + 1) * gamesPerPage);
    const emptySlotsCount = Math.max(0, 4 - visibleTickerGames.length); // Always show 4 game slots (2-5)
    
    // Calculate BYU Playoff Odds
    const calculatePlayoffOdds = (): number => {
        // Find BYU's game data
        const byuGame = games.find(g => 
            g.away.shortName === 'BYU' || g.home.shortName === 'BYU' ||
            g.away.name.toLowerCase().includes('brigham young') || 
            g.home.name.toLowerCase().includes('brigham young')
        );
        
        if (!byuGame) return 0;
        
        const byuTeam = byuGame.away.shortName === 'BYU' || byuGame.away.name.toLowerCase().includes('brigham young') 
            ? byuGame.away 
            : byuGame.home;
        
        // Parse record (format: "11-1" or "10-2")
        const recordMatch = byuTeam.record?.match(/(\d+)-(\d+)/);
        if (!recordMatch) return 0;
        
        const wins = parseInt(recordMatch[1]);
        const losses = parseInt(recordMatch[2]);
        const totalGames = wins + losses;
        
        // Base odds from win percentage
        const winPercentage = wins / Math.max(totalGames, 1);
        let baseOdds = 0;
        
        // Realistic base odds based on record
        if (wins >= 12 && losses <= 1) baseOdds = 85; // 12-1 or better
        else if (wins >= 11 && losses <= 1) baseOdds = 70; // 11-1
        else if (wins >= 11 && losses <= 2) baseOdds = 55; // 11-2
        else if (wins >= 10 && losses <= 2) baseOdds = 40; // 10-2
        else if (wins >= 10 && losses <= 3) baseOdds = 25; // 10-3
        else if (wins >= 9 && losses <= 3) baseOdds = 15; // 9-3
        else if (wins >= 9 && losses <= 4) baseOdds = 8; // 9-4
        else if (wins >= 8 && losses <= 4) baseOdds = 3; // 8-4
        else baseOdds = 1; // Below 8-4
        
        // Ranking multiplier
        let rankingBonus = 0;
        if (byuTeam.rank) {
            if (byuTeam.rank <= 4) rankingBonus = 15; // Top 4
            else if (byuTeam.rank <= 8) rankingBonus = 10; // Top 8
            else if (byuTeam.rank <= 12) rankingBonus = 5; // Top 12
            else if (byuTeam.rank <= 20) rankingBonus = 2; // Top 20
        }
        
        // Rooting guide outcomes impact
        let rootingImpact = 0;
        const rootingGames = games.filter(g => g.rootingInterest);
        const wonGames = rootingGames.filter(g => g.rootingInterest?.status === 'won').length;
        const lostGames = rootingGames.filter(g => g.rootingInterest?.status === 'lost').length;
        const pendingGames = rootingGames.filter(g => g.rootingInterest?.status === 'pending').length;
        
        // Each win helps, each loss hurts
        rootingImpact = (wonGames * 3) - (lostGames * 4);
        
        // Pending games add uncertainty (reduce confidence, not odds)
        // If many games are pending, odds are more uncertain
        
        // Strength of schedule adjustment (simplified)
        // Assume BYU plays in Big 12, which is a Power 5 conference
        const conferenceBonus = 5;
        
        // Calculate final odds
        let finalOdds = baseOdds + rankingBonus + rootingImpact + conferenceBonus;
        
        // Cap between 0 and 95 (never 100% certain)
        finalOdds = Math.max(0, Math.min(95, finalOdds));
        
        // Round to 1 decimal place
        return Math.round(finalOdds * 10) / 10;
    };
    
    const playoffOdds = calculatePlayoffOdds();
    
    // Update slots per page on resize (always reserve 1 slot for ad, so show 4 games)
    useEffect(() => {
        const updateSlots = () => {
            // Always show 5 total slots: 1 ad + 4 games
            setSlotsPerPage(5);
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
            const gamesPerPage = 4; // Always 4 games (slots 2-5)
            const totalPages = Math.ceil(games.length / gamesPerPage);
            const nextPage = prev + 1;
            return nextPage < totalPages ? nextPage : 0;
        });
    };

    const prevTickerPage = () => {
        setTickerPage(prev => {
            const gamesPerPage = 4; // Always 4 games (slots 2-5)
            const totalPages = Math.ceil(games.length / gamesPerPage);
            const prevPage = prev - 1;
            return prevPage >= 0 ? prevPage : totalPages - 1;
        });
    };

    // Share functionality
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = 'Check out PlayoffTracker - Road to the CFP! Track college football games and playoff rankings.';

    const shareViaSMS = () => {
        const message = `${shareText} ${shareUrl}`;
        window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
        setShowShareMenu(false);
    };

    const shareViaTwitter = () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
        setShowShareMenu(false);
    };

    const shareViaFacebook = () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank', 'width=550,height=420');
        setShowShareMenu(false);
    };

    const shareViaNative = async () => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: 'PlayoffTracker - Road to the CFP',
                    text: shareText,
                    url: shareUrl,
                });
                setShowShareMenu(false);
            } catch (err) {
                // User cancelled or error occurred
            }
        } else {
            // Fallback: copy to clipboard
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(shareUrl);
                setShowShareMenu(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-screen bg-white text-gray-900 font-sans overflow-hidden">

            {/* Main Feature Area */}
            <main className={`flex-1 relative flex flex-col min-h-0 ${gameDetailView === 'live' ? 'overflow-y-auto' : 'overflow-y-auto sm:overflow-hidden'}`}>

                {/* Header Overlay */}
                <header className="absolute top-0 w-full z-20 p-2 sm:p-2.5 md:p-3 flex flex-wrap justify-between items-center gap-2 sm:gap-3 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                        {/* BYU Logo */}
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/50 p-1 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo1.png" alt="BYU" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-shrink-0">
                            <h1 className="text-sm sm:text-lg md:text-xl font-black italic tracking-tighter text-[#0062B8] leading-tight">PLAYOFF<span className="text-[#002E5D]">TRACKER</span></h1>
                            <p className="text-[9px] sm:text-[10px] text-gray-600 font-medium tracking-widest uppercase leading-tight">Road to the CFP</p>
                        </div>
                    </div>
                    
                    {/* Mobile View Toggle Button - Expanded to fill space */}
                    <div className="sm:hidden flex-1 min-w-0 flex justify-end">
                        <div className="bg-white/90 backdrop-blur-xl rounded-full px-3 py-1.5 shadow-lg border border-white/40 flex items-center gap-1.5 w-full max-w-[200px]">
                            <button
                                onClick={() => setMobileView('game')}
                                className={`flex-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    mobileView === 'game' 
                                        ? 'bg-[#0062B8] text-white shadow-md' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                Game
                            </button>
                            <button
                                onClick={() => setMobileView('guide')}
                                className={`flex-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    mobileView === 'guide' 
                                        ? 'bg-[#0062B8] text-white shadow-md' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                Guide
                            </button>
                        </div>
                    </div>

                    {/* WE WANT Bar - Hidden on mobile, between logo and last updated */}
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
                        {/* View Playoffs button - hidden on mobile, shown below header */}
                        <Link 
                            href="/playoffs"
                            className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0062B8] hover:bg-[#0052A8] text-white text-xs sm:text-sm font-bold rounded-lg transition-all border border-white/20 shadow-md hover:shadow-lg touch-manipulation"
                        >
                            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>View Playoffs</span>
                        </Link>
                        
                        {/* Share Button */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowShareMenu(!showShareMenu)}
                                className="p-2 sm:p-2.5 hover:bg-white/60 backdrop-blur-md rounded-full transition-all border border-transparent hover:border-white/40 touch-manipulation"
                                aria-label="Share"
                            >
                                <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#0062B8]" />
                            </button>
                            
                            {/* Share Menu Dropdown */}
                            {showShareMenu && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-30" 
                                        onClick={() => setShowShareMenu(false)}
                                    ></div>
                                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-40 min-w-[180px]">
                                        {typeof navigator !== 'undefined' && 'share' in navigator && (
                                            <button
                                                onClick={shareViaNative}
                                                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                                            >
                                                <Share2 className="w-4 h-4" />
                                                <span>Share...</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={shareViaSMS}
                                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                                        >
                                            <MessageCircle className="w-4 h-4 text-blue-500" />
                                            <span>Text</span>
                                        </button>
                                        <button
                                            onClick={shareViaTwitter}
                                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                                        >
                                            <Twitter className="w-4 h-4 text-black" />
                                            <span>X (Twitter)</span>
                                        </button>
                                        <button
                                            onClick={shareViaFacebook}
                                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                                        >
                                            <Facebook className="w-4 h-4 text-blue-600" />
                                            <span>Facebook</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <button onClick={() => fetchGames()} className="p-2 sm:p-2.5 hover:bg-white/60 backdrop-blur-md rounded-full transition-all border border-transparent hover:border-white/40 touch-manipulation">
                            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : 'text-[#0062B8]'}`} />
                        </button>
                    </div>
                </header>

                {/* View Playoffs button - Mobile only, positioned below header */}
                <div className="sm:hidden px-3 pt-16 pb-1 relative z-10">
                    <Link 
                        href="/playoffs"
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0062B8] hover:bg-[#0052A8] text-white text-sm font-bold rounded-lg transition-all border border-white/20 shadow-md hover:shadow-lg touch-manipulation w-full"
                    >
                        <Trophy className="w-4 h-4" />
                        <span>View Playoffs</span>
                    </Link>
                </div>

                {/* Content Grid: Main Game + Sidebar */}
                <div className={`flex-1 flex flex-col sm:flex-row min-h-0 ${gameDetailView === 'live' ? 'overflow-visible' : 'overflow-visible sm:overflow-hidden'}`}>

                    {/* Left: Main Game Display */}
                    <div className={`flex-1 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 pb-40 sm:pb-36 md:pb-40 relative z-10 pt-2 sm:pt-20 md:pt-20 min-h-0 flex-shrink-0 ${gameDetailView === 'live' ? 'overflow-y-auto' : 'overflow-visible'} ${mobileView === 'guide' ? 'hidden sm:flex' : 'flex'}`}>
                        {activeGame ? (
                            <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-700">

                                {/* Rooting Context Badge - Mobile Only */}
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

                                {/* Scoreboard with Navigation Arrows */}
                                <div className="w-full max-w-4xl relative">
                                    {/* Left Arrow */}
                                    <button
                                        onClick={navigateToPreviousGame}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-2 sm:-translate-x-8 md:-translate-x-12 z-20 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/70 backdrop-blur-xl rounded-full border border-white/40 shadow-lg hover:bg-white/90 active:bg-white transition-all touch-manipulation flex items-center justify-center group"
                                        title="Previous game"
                                    >
                                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#0062B8] group-hover:text-[#002E5D] transition-colors" />
                                    </button>

                                    {/* Scoreboard */}
                                    <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 md:gap-8 lg:gap-16 px-2">
                                    <BigTeamDisplay team={activeGame.away} isOpponentWinner={activeGame.home.isWinner} align="right" />

                                    <div className="flex flex-col items-center gap-2 sm:gap-4 relative">
                                        <div className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-black text-gray-300/40 italic select-none">VS</div>
                                        
                                        {/* WON/LOST Card for Finished Games */}
                                        {!activeGame.isLive && activeGame.rootingInterest && (activeGame.rootingInterest.status === 'won' || activeGame.rootingInterest.status === 'lost') && (
                                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-xl rounded-lg sm:rounded-xl px-4 sm:px-6 py-2 sm:py-2.5 border-2 shadow-xl z-10 ${
                                                activeGame.rootingInterest.status === 'won' 
                                                    ? 'border-green-500' 
                                                    : 'border-red-500'
                                            }`}>
                                                <span className={`text-lg sm:text-xl md:text-2xl font-black uppercase tracking-wider ${
                                                    activeGame.rootingInterest.status === 'won' 
                                                        ? 'text-green-600' 
                                                        : 'text-red-600'
                                                }`}>
                                                    {activeGame.rootingInterest.status === 'won' ? 'WON' : 'LOST'}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {activeGame.isLive && activeGame.situation.downDistanceText && (
                                            <div className="flex flex-col items-center bg-[#002E5D]/90 backdrop-blur-xl rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 border border-white/20 shadow-xl">
                                                <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white font-mono tracking-tight">
                                                    {activeGame.situation.downDistanceText}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <BigTeamDisplay team={activeGame.home} isOpponentWinner={activeGame.away.isWinner} align="left" />
                                    </div>

                                    {/* Right Arrow */}
                                    <button
                                        onClick={navigateToNextGame}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:translate-x-8 md:translate-x-12 z-20 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/70 backdrop-blur-xl rounded-full border border-white/40 shadow-lg hover:bg-white/90 active:bg-white transition-all touch-manipulation flex items-center justify-center group"
                                        title="Next game"
                                    >
                                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#0062B8] group-hover:text-[#002E5D] transition-colors" />
                                    </button>
                                </div>

                                {/* Stadium/Venue Info - Moved Up */}
                                <div className="mt-6 sm:mt-8 md:mt-12 max-w-4xl w-full px-2 mb-4 sm:mb-6">
                                    <div className="flex items-center justify-center gap-2 text-gray-700 text-xs sm:text-sm font-medium">
                                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-[#0062B8]" />
                                        <span className="text-center">{activeGame.venue}</span>
                                        {activeGame.date && (
                                            <>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-center">
                                                    {activeGame.date.toLocaleTimeString('en-US', { 
                                                        hour: 'numeric', 
                                                        minute: '2-digit',
                                                        hour12: true,
                                                        timeZoneName: 'short'
                                                    })}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Tabs for Stats/Live Game */}
                                <div className="max-w-4xl w-full px-2 mb-3">
                                    <div className="flex gap-2 bg-white/40 backdrop-blur-sm rounded-lg p-1 border border-white/30 shadow-md">
                                        <button
                                            onClick={() => setGameDetailView('stats')}
                                            className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all ${
                                                gameDetailView === 'stats'
                                                    ? 'bg-[#0062B8] text-white shadow-sm'
                                                    : 'text-gray-600 hover:bg-white/60'
                                            }`}
                                        >
                                            Stats
                                        </button>
                                        {activeGame.isLive && activeGame.situation?.lastPlay && (
                                            <button
                                                onClick={() => setGameDetailView('live')}
                                                className={`flex-1 px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all ${
                                                    gameDetailView === 'live'
                                                        ? 'bg-[#0062B8] text-white shadow-sm'
                                                        : 'text-gray-600 hover:bg-white/60'
                                                }`}
                                            >
                                                Live Game
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Content based on selected tab */}
                                {gameDetailView === 'stats' ? (
                                    /* Matchup Predictor & Game Leaders - Side by Side */
                                    <div className="mt-0 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 px-2 pb-20 sm:pb-28 md:pb-36 overflow-visible">
                                        {/* Matchup Predictor */}
                                        {activeGame.prediction ? (
                                            <MatchupPredictor game={activeGame} />
                                        ) : (
                                            <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-white/40 shadow-lg w-full min-h-[240px] sm:min-h-[260px] flex items-center justify-center">
                                                <p className="text-[10px] sm:text-xs text-gray-500 text-center">No prediction data available</p>
                                            </div>
                                        )}

                                        {/* Leaders Module */}
                                        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-white/40 shadow-lg w-full min-h-[240px] sm:min-h-[260px] flex flex-col">
                                            <div className="mb-1.5 flex-shrink-0">
                                                <h3 className="text-[10px] sm:text-xs font-bold text-[#002E5D] uppercase tracking-widest mb-1 border-b border-gray-200/50 pb-1 sm:pb-1.5">Game Leaders</h3>
                                                
                                                {/* Team Filter Toggle */}
                                                {activeGame.leaders && activeGame.leaders.length > 0 && (
                                                    <div className="flex gap-1 mt-1 bg-white/40 backdrop-blur-sm rounded-lg p-0.5 border border-white/30">
                                                        <button
                                                            onClick={() => setLeadersView('all')}
                                                            className={`flex-1 px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-all ${
                                                                leadersView === 'all'
                                                                    ? 'bg-[#0062B8] text-white shadow-sm'
                                                                    : 'text-gray-600 hover:bg-white/60'
                                                            }`}
                                                        >
                                                            All
                                                        </button>
                                                        <button
                                                            onClick={() => setLeadersView('away')}
                                                            className={`flex-1 px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-all ${
                                                                leadersView === 'away'
                                                                    ? 'bg-[#0062B8] text-white shadow-sm'
                                                                    : 'text-gray-600 hover:bg-white/60'
                                                            }`}
                                                        >
                                                            {activeGame.away.shortName}
                                                        </button>
                                                        <button
                                                            onClick={() => setLeadersView('home')}
                                                            className={`flex-1 px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-all ${
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
                                            
                                            {activeGame.leaders && activeGame.leaders.length > 0 ? (
                                                <div className="space-y-1.5 sm:space-y-2 flex-1 overflow-y-auto">
                                                    {(() => {
                                                        // Filter leaders based on selected view
                                                        let filteredLeaders = activeGame.leaders;
                                                        if (leadersView === 'away') {
                                                            filteredLeaders = activeGame.leaders.filter(l => l.teamId === activeGame.away.id);
                                                        } else if (leadersView === 'home') {
                                                            filteredLeaders = activeGame.leaders.filter(l => l.teamId === activeGame.home.id);
                                                        }
                                                        
                                                        // Group by category and take top from each
                                                        const categories = ['Passing', 'Rushing', 'Receiving'];
                                                        const displayedLeaders: typeof activeGame.leaders = [];
                                                        
                                                        categories.forEach(cat => {
                                                            const leader = filteredLeaders.find(l => l.name.toLowerCase().includes(cat.toLowerCase()));
                                                            if (leader) displayedLeaders.push(leader);
                                                        });
                                                        
                                                        // If no category match, just show first 3
                                                        if (displayedLeaders.length === 0) {
                                                            displayedLeaders.push(...filteredLeaders.slice(0, 3));
                                                        }
                                                        
                                                        return displayedLeaders.map((leader, i) => (
                                                            <div key={i} className="flex items-center gap-2 sm:gap-2.5">
                                                                {leader.athlete.headshot ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={leader.athlete.headshot} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 backdrop-blur-sm object-cover border border-white/50 shadow-sm flex-shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 flex items-center justify-center text-[9px] sm:text-[10px] text-gray-600 shadow-sm flex-shrink-0">{leader.athlete.position}</div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">{leader.athlete.shortName}</div>
                                                                    <div className="text-[10px] sm:text-xs text-gray-600 truncate">{leader.name}</div>
                                                                </div>
                                                                <div className="text-xs sm:text-sm font-mono font-bold text-[#0062B8] flex-shrink-0">{leader.displayValue}</div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center">
                                                    <p className="text-[10px] sm:text-xs text-gray-500 text-center">No leader data available</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Live Game View - Last Play and Field Position */
                                    <div className="max-w-4xl w-full px-2 pb-20 sm:pb-28 md:pb-36">
                                        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/40 shadow-lg">
                                            <div className="flex items-center gap-2 mb-4">
                                                <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#0062B8]" />
                                                <h3 className="text-base sm:text-lg font-black text-[#0062B8] uppercase tracking-wider">Last Play</h3>
                                            </div>
                                            
                                            <div className="bg-white/60 backdrop-blur-md rounded-xl p-4 sm:p-5 border border-white/40 mb-6">
                                                <p className="text-sm sm:text-base md:text-lg text-gray-800 leading-relaxed font-medium text-center">
                                                    {activeGame.situation?.lastPlay ? `"${activeGame.situation.lastPlay}"` : 'No play data available'}
                                                </p>
                                            </div>

                                            {/* Football Field */}
                                            {activeGame.situation?.yardLine !== undefined && activeGame.situation?.possession ? (
                                                <FootballField 
                                                    yardLine={activeGame.situation.yardLine}
                                                    possession={activeGame.situation.possession}
                                                    homeTeam={activeGame.home}
                                                    awayTeam={activeGame.away}
                                                    isRedZone={activeGame.situation.isRedZone || false}
                                                    activeGame={activeGame}
                                                />
                                            ) : (
                                                /* DEV: Show field with default values for development */
                                                <FootballField 
                                                    yardLine={50}
                                                    possession={activeGame.home.id}
                                                    homeTeam={activeGame.home}
                                                    awayTeam={activeGame.away}
                                                    isRedZone={false}
                                                    activeGame={activeGame}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-gray-400">Loading Playoff Scenarios...</div>
                        )}
                    </div>

                    {/* Right: Playoff Implications Sidebar */}
                    <div className={`w-full sm:w-80 lg:w-72 xl:w-80 bg-white/40 backdrop-blur-xl border-l border-white/30 sm:border-t-0 border-t border-white/20 flex flex-col pt-0 sm:pt-[72px] md:pt-[80px] shadow-lg min-h-[400px] sm:min-h-0 flex-shrink-0 ${mobileView === 'game' ? 'hidden sm:flex' : 'flex'}`}>
                        <div className="p-3 sm:p-4 border-b border-white/20 bg-[#0062B8]/90 backdrop-blur-xl flex-shrink-0 sticky top-0 z-10">
                            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2 mb-2">
                                <Trophy className="w-4 h-4 text-white" />
                                Rooting Guide
                            </h2>
                            
                            {/* Playoff Odds Widget */}
                            <div className="bg-white/20 backdrop-blur-xl rounded-lg p-1.5 sm:p-2 border border-white/30 shadow-lg">
                                <div className="text-[7px] sm:text-[8px] font-bold text-white/90 uppercase tracking-widest mb-0.5 text-center">
                                    Playoff Odds
                                </div>
                                <div className="flex items-baseline justify-center gap-0.5">
                                    <span className="text-lg sm:text-xl md:text-2xl font-black text-white">
                                        {playoffOdds.toFixed(1)}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-bold text-white/80">%</span>
                                </div>
                                <div className="text-[6px] sm:text-[7px] text-white/70 text-center mt-0.5 italic">
                                    Based on record, ranking & outcomes
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 min-h-0 -webkit-overflow-scrolling-touch">
                            {/* Responsive grid: 1 column on mobile, 2 on larger screens */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {games.map((game, idx) => (
                                    <button
                                        key={game.id}
                                        onClick={() => handleGameSelect(game.id)}
                                        className={`w-full text-left p-2 rounded-xl border transition-all backdrop-blur-md
                                    ${selectedGameId === game.id ? 'bg-[#0062B8]/20 border-[#0062B8] shadow-md' : 'bg-white/60 border-[#0062B8]/30 hover:bg-white/80 hover:border-[#0062B8]/50'}
                                `}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">#{idx + 1}</span>
                                            <span className={`text-[9px] font-bold px-1 rounded 
                                        ${game.rootingInterest?.status === 'winning' || game.rootingInterest?.status === 'won' ? 'bg-green-100 text-green-700' :
                                                    game.rootingInterest?.status === 'pending' ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-700'}
                                    `}>
                                                {game.rootingInterest?.status === 'pending' && game.date
                                                    ? game.date.toLocaleTimeString('en-US', { 
                                                        hour: 'numeric', 
                                                        minute: '2-digit',
                                                        hour12: true
                                                      })
                                                    : game.rootingInterest?.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex flex-col min-w-0">
                                                <span className={`font-bold text-xs leading-tight truncate ${game.rootingInterest?.teamId === game.away.id ? 'text-[#0062B8]' : 'text-gray-900'}`}>
                                                    {game.away.shortName}
                                                </span>
                                                <span className={`font-bold text-xs leading-tight truncate ${game.rootingInterest?.teamId === game.home.id ? 'text-[#0062B8]' : 'text-gray-900'}`}>
                                                    {game.home.shortName}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end font-mono font-bold text-xs text-gray-900">
                                                <span>{game.away.score}</span>
                                                <span>{game.home.score}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* THE TICKER - Fixed Bottom */}
            <footer className="h-28 sm:h-24 md:h-28 bg-[#002E5D]/90 backdrop-blur-xl border-t border-white/20 flex relative z-30 shadow-2xl">
        <div className="bg-[#0062B8]/90 backdrop-blur-xl px-3 sm:px-3 md:px-4 flex items-center justify-center z-40 shadow-xl border-r border-white/20 min-w-[60px] sm:min-w-[70px]">
            <span className="text-[10px] sm:text-xs font-black text-white leading-tight text-center">
                IMPACT<br />GAMES
            </span>
        </div>

        {/* Scroll Container */}
        <div className="flex-1 flex items-stretch overflow-hidden min-w-0">
    <button onClick={prevTickerPage} className="w-8 sm:w-8 bg-[#0062B8]/60 backdrop-blur-md hover:bg-[#0062B8]/80 active:bg-[#0062B8] flex items-center justify-center border-r border-white/10 z-10 transition-all touch-manipulation flex-shrink-0">
        <ChevronLeft className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
    </button>

    <div className="flex-1 flex divide-x divide-white/10 min-w-0 relative overflow-hidden">
        {/* Slot 1: Always show AdSense Ad */}
        <div className="flex-1 flex items-center justify-center px-2 sm:px-3 md:px-3 py-1.5 sm:py-2 border-r border-white/10 min-h-0 flex-shrink-0">
            <div className="flex items-center justify-center bg-white/5 backdrop-blur-sm rounded">
                <ins
                    className="adsbygoogle"
                    style={{ display: 'inline-block', width: '300px', height: '100px' }}
                    data-ad-client="ca-pub-2568418773305987"
                    data-ad-slot="8355415003"
                />
            </div>
        </div>
        
        {/* Slots 2-5: Games (always show 4 slots) */}
        {visibleTickerGames.map((game) => (
            <button
                key={game.id}
                onClick={() => handleGameSelect(game.id)}
                className={`group flex-1 px-2 sm:px-3 md:px-3 py-1.5 sm:py-2 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-sm touch-manipulation min-w-0
                  ${selectedGameId === game.id ? 'bg-white/10 border-t border-white/30' : 'hover:bg-white/5 active:bg-white/10'}
                `}
            >
                {/* Active Indicator Bar */}
                {selectedGameId === game.id && (
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[#0062B8] shadow-sm"></div>
                )}

                {/* Row 1: Header */}
                <div className="flex justify-between items-center text-[9px] sm:text-[9px] md:text-[10px] text-gray-200 uppercase font-bold tracking-wider w-full mb-0.5">
                    <span className={`truncate mr-1 sm:mr-2 ${game.isLive ? 'text-red-400 animate-pulse' : ''}`}>
                        {game.statusDetail}
                    </span>
                    <span className="truncate hidden sm:inline">{game.broadcast}</span>
                </div>

                {/* Row 2: Teams */}
                <div className="space-y-1 sm:space-y-1 w-full flex-1 flex flex-col justify-center">
                    <TickerTeamRow
                        team={game.away}
                        hasBall={game.isLive && game.situation.possession === game.away.id}
                        isRootedFor={game.rootingInterest?.teamId === game.away.id}
                    />
                    <TickerTeamRow
                        team={game.home}
                        hasBall={game.isLive && game.situation.possession === game.home.id}
                        isRootedFor={game.rootingInterest?.teamId === game.home.id}
                    />
                </div>

                {/* Row 3: Footer */}
                <div className="h-3 sm:h-3 flex items-center justify-end w-full mt-0.5">
                    {game.alert ? (
                        <div className={`text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse
                       ${game.alert.type === 'TOUCHDOWN' ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white'}
                     `}>
                            {game.alert.text}
                        </div>
                    ) : (
                        game.isLive && game.situation.downDistanceText && (
                            <div className="text-[10px] text-white font-mono opacity-100 font-bold">
                                {game.situation.downDistanceText}
                            </div>
                        )
                    )}
                </div>
            </button>
        ))}
        
        {/* Fill remaining game slots (2-5) with empty divs to always show 4 game slots */}
        {Array.from({ length: emptySlotsCount }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 bg-transparent backdrop-blur-sm border-r border-white/10 last:border-r-0"></div>
        ))}
    </div>

    <button onClick={nextTickerPage} className="w-8 sm:w-8 bg-[#0062B8]/60 backdrop-blur-md hover:bg-[#0062B8]/80 active:bg-[#0062B8] flex items-center justify-center border-l border-white/10 z-10 transition-all touch-manipulation flex-shrink-0">
        <ChevronRight className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
    </button>
</div>
            </footer>

        </div>
    );
};

// --- Subcomponents ---

const BigTeamDisplay = ({ team, isOpponentWinner, align }: { team: Team, isOpponentWinner: boolean, align: 'left' | 'right' }) => {
    const isWinner = team.isWinner;
    const isLoser = isOpponentWinner;

    return (
        <div className={`flex flex-col gap-1.5 sm:gap-2 md:gap-3 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
            <div className={`relative w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 lg:w-28 lg:h-28 p-2 sm:p-2.5 md:p-3 bg-white/70 backdrop-blur-xl rounded-full border ${isWinner ? 'border-[#0062B8]/50 shadow-xl' : 'border-white/50'} shadow-lg`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.logo} alt={team.name} className={`w-full h-full object-contain drop-shadow-lg ${isLoser ? 'grayscale opacity-70' : ''}`} />
                {team.hasBall && (
                    <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 rounded-full p-0.5 sm:p-1 shadow-lg border-2 border-white backdrop-blur-sm" style={{ backgroundColor: team.color || '#0062B8' }}>
                        <FaFootball className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                )}
            </div>

            <div className="space-y-0.5 sm:space-y-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {align === 'left' && team.rank && <RankBadge rank={team.rank} />}
                    <h2 className="text-base sm:text-lg md:text-xl lg:text-3xl font-black text-[#002E5D] tracking-tight leading-none">{team.shortName}</h2>
                    {align === 'right' && team.rank && <RankBadge rank={team.rank} />}
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base text-gray-600 font-medium">
                    <span>{team.record || '0-0'}</span>
                    {team.sor !== null && team.sor !== undefined && (
                        <span className="text-[10px] sm:text-xs md:text-sm text-gray-500">SOR: {team.sor}</span>
                    )}
                </div>
            </div>

            <div className={`text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black font-mono tracking-tighter ${isWinner ? 'text-[#0062B8]' : 'text-[#002E5D]'}`}>
                {team.score || '0'}
            </div>
        </div>
    );
};

const TickerTeamRow = ({ team, hasBall, isRootedFor }: { team: Team, hasBall: boolean, isRootedFor?: boolean }) => (
    <div className="flex justify-between items-center gap-1.5">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {/* Team Logo with White Background */}
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white rounded-full p-0.5 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.logo} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-xs sm:text-sm font-bold truncate leading-tight ${isRootedFor ? 'text-yellow-300' : 'text-white'}`}>
                    {team.rank && <span className="text-[9px] sm:text-[10px] text-gray-300 mr-0.5 sm:mr-1">{team.rank}</span>}
                    {team.shortName}
                    {isRootedFor && <span className="ml-0.5 sm:ml-1 text-[7px] sm:text-[8px] bg-yellow-400 text-black px-0.5 sm:px-1 rounded font-black">Preferred</span>}
                </span>
                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-gray-200 font-medium">
                    <span>{team.record || '0-0'}</span>
                    {team.sor !== null && team.sor !== undefined && (
                        <span className="text-[8px] sm:text-[9px] text-gray-300">SOR: {team.sor}</span>
                    )}
                </div>
            </div>
            {hasBall && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0 ml-0.5 shadow-sm" />}
        </div>
        <span className={`font-mono font-black text-sm sm:text-base flex-shrink-0 ${team.isWinner ? 'text-yellow-300' : 'text-white'}`}>
            {team.score || '0'}
        </span>
    </div>
);

// Football Field Component
const FootballField = ({ yardLine, possession, homeTeam, awayTeam, isRedZone, activeGame }: { 
    yardLine: number, 
    possession: string, 
    homeTeam: Team, 
    awayTeam: Team,
    isRedZone: boolean,
    activeGame: Game
}) => {
    // Determine which team has the ball
    const teamWithBall = possession === homeTeam.id ? homeTeam : awayTeam;
    const isHomeTeam = possession === homeTeam.id;
    
    // Calculate position percentage (yardLine is 0-100, where 0 is away endzone, 100 is home endzone)
    // For display, we'll show it as a percentage from left (away) to right (home)
    const positionPercent = yardLine;
    
    // Generate yard markers (every 10 yards)
    const yardMarkers = [];
    for (let i = 0; i <= 100; i += 10) {
        yardMarkers.push(i);
    }
    
    return (
        <div className="bg-white/80 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/40">
            <div className="text-xs sm:text-sm font-bold text-gray-700 mb-2 text-center uppercase tracking-wider">
                Field Position
            </div>
            <div className="relative w-full h-32 sm:h-40 bg-gradient-to-r from-green-600 via-green-500 to-green-600 rounded-lg overflow-hidden border-2 border-green-700 shadow-inner">
                {/* Endzones */}
                <div className="absolute left-0 top-0 w-[10%] h-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center">
                    <div className="text-[8px] sm:text-[10px] font-black text-white uppercase transform -rotate-90 whitespace-nowrap">
                        {awayTeam.shortName}
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-[10%] h-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
                    <div className="text-[8px] sm:text-[10px] font-black text-white uppercase transform -rotate-90 whitespace-nowrap">
                        {homeTeam.shortName}
                    </div>
                </div>
                
                {/* Yard Markers */}
                {yardMarkers.map((yard) => {
                    const isEndzone = yard === 0 || yard === 100;
                    if (isEndzone) return null;
                    
                    const leftPercent = yard;
                    const isMiddle = yard === 50;
                    
                    return (
                        <div
                            key={yard}
                            className="absolute top-0 bottom-0 w-px bg-white/80"
                            style={{ left: `${leftPercent}%` }}
                        >
                            <div className={`absolute ${isMiddle ? 'top-0' : 'top-1/2 -translate-y-1/2'} left-1/2 -translate-x-1/2 bg-white px-0.5 sm:px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black text-gray-800 whitespace-nowrap`}>
                                {yard}
                            </div>
                        </div>
                    );
                })}
                
                {/* Red Zone Indicators */}
                {isRedZone && (
                    <div 
                        className="absolute top-0 bottom-0 bg-red-500/20 border-l-2 border-r-2 border-red-600/40"
                        style={{ 
                            left: isHomeTeam ? '80%' : '10%',
                            width: '10%'
                        }}
                    />
                )}
                
                {/* Team Icon with Ball */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300"
                    style={{ left: `${positionPercent}%` }}
                >
                    <div 
                        className="relative w-8 h-8 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm rounded-full border-2 shadow-lg flex items-center justify-center"
                        style={{ borderColor: teamWithBall.color || '#0062B8' }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={teamWithBall.logo} 
                            alt={teamWithBall.shortName}
                            className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                        />
                        {/* Football indicator */}
                        <div 
                            className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full flex items-center justify-center shadow-md border border-white"
                            style={{ backgroundColor: teamWithBall.color || '#0062B8' }}
                        >
                            <FaFootball className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
                        </div>
                    </div>
                    {/* Yard line label */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-black/70 text-white px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold whitespace-nowrap">
                        {yardLine} yd
                    </div>
                </div>
                
                {/* Hash marks */}
                <div className="absolute top-1/3 left-[10%] right-[10%] h-0.5 bg-white/60"></div>
                <div className="absolute bottom-1/3 left-[10%] right-[10%] h-0.5 bg-white/60"></div>
            </div>
            
            {/* Team info */}
            <div className="mt-2 flex items-center justify-between text-[9px] sm:text-[10px] text-gray-600">
                <div className="flex items-center gap-1.5">
                    <div 
                        className="w-3 h-3 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: teamWithBall.color || '#0062B8' }}
                    />
                    <span className="font-bold">{teamWithBall.shortName} has the ball</span>
                </div>
                {activeGame.situation?.downDistanceText && (
                    <span className="font-mono font-bold">{activeGame.situation.downDistanceText}</span>
                )}
            </div>
        </div>
    );
};

const RankBadge = ({ rank }: { rank: number }) => (
    <span className="bg-[#002E5D]/90 backdrop-blur-md text-white text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-lg leading-none border border-white/20 shadow-sm">{rank}</span>
);

// Matchup Predictor Component
const MatchupPredictor = ({ game }: { game: Game }) => {
    if (!game.prediction) return null;

    const awayProb = game.prediction.awayWinProbability;
    const homeProb = game.prediction.homeWinProbability;
    const awayAngle = (awayProb / 100) * 360;
    const homeAngle = (homeProb / 100) * 360;
    
    // Use team colors, with fallback to default colors
    const awayColor = game.away.color || '#0062B8';
    const homeColor = game.home.color || '#002E5D';

    return (
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-white/40 shadow-lg w-full min-h-[240px] sm:min-h-[260px] flex flex-col overflow-visible">
            <h3 className="text-[10px] sm:text-xs font-bold text-[#002E5D] uppercase tracking-widest mb-1.5 sm:mb-2 text-center flex-shrink-0">MATCHUP PREDICTOR</h3>
            
            {/* Circular Chart */}
            <div className="relative w-full aspect-square max-w-[140px] sm:max-w-[150px] md:max-w-[170px] mx-auto mb-1.5 sm:mb-2 flex-shrink-0 overflow-visible">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {/* Away Team (Left Half) */}
                    <circle
                        cx="100"
                        cy="100"
                        r="90"
                        fill="none"
                        stroke={awayColor}
                        strokeWidth="20"
                        strokeDasharray={`${awayAngle * Math.PI / 180 * 90} ${360 * Math.PI / 180 * 90}`}
                        className="transition-all duration-500"
                    />
                    {/* Home Team (Right Half) */}
                    <circle
                        cx="100"
                        cy="100"
                        r="90"
                        fill="none"
                        stroke={homeColor}
                        strokeWidth="20"
                        strokeDasharray={`${homeAngle * Math.PI / 180 * 90} ${360 * Math.PI / 180 * 90}`}
                        strokeDashoffset={`-${awayAngle * Math.PI / 180 * 90}`}
                        className="transition-all duration-500"
                    />
                </svg>
                
                {/* Team Logos in Center */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.away.logo} alt={game.away.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.home.logo} alt={game.home.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                    </div>
                </div>
            </div>

            {/* Percentages */}
            <div className="flex justify-between items-center gap-1.5 mb-1 flex-shrink-0">
                <div className="flex items-center gap-1.5 flex-1">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: awayColor }}></div>
                    <div className="flex flex-col min-w-0">
                        <div className="text-lg sm:text-xl font-black text-gray-900">{awayProb.toFixed(1)}%</div>
                        <div className="text-[10px] sm:text-xs font-bold text-gray-600 uppercase truncate">{game.away.shortName}</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <div className="flex flex-col items-end min-w-0">
                        <div className="text-lg sm:text-xl font-black text-gray-900">{homeProb.toFixed(1)}%</div>
                        <div className="text-[10px] sm:text-xs font-bold text-gray-600 uppercase truncate">{game.home.shortName}</div>
                    </div>
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: homeColor }}></div>
                </div>
            </div>

            {/* Source */}
            <div className="text-[8px] sm:text-[9px] text-gray-500 text-center italic flex-shrink-0 mt-auto">
                {game.prediction?.awayWinProbability && game.prediction?.homeWinProbability 
                    ? 'Calculated from team records & rankings'
                    : 'According to ESPN Analytics'}
            </div>
        </div>
    );
};

export default ByuPage;
