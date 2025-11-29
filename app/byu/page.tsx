'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Tv, MapPin, PlayCircle, ChevronLeft, ChevronRight, MousePointerClick, CheckCircle2, XCircle, AlertCircle, Lock, Unlock, X } from 'lucide-react';

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
    const [slotsPerPage, setSlotsPerPage] = useState(4);
    const [mobileView, setMobileView] = useState<'game' | 'guide'>('game');
    const [leadersView, setLeadersView] = useState<'all' | 'away' | 'home'>('all');
    const [showPlaysModal, setShowPlaysModal] = useState(false);

    const DATA_URL = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20251128-20251130&limit=200&groups=80";

    const fetchGames = async () => {
        try {
            setLoading(true);
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();

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

                // Log every game to see what ESPN is returning
                console.log(`📊 Game: ${awayTeam.name} (${awayTeam.shortName}) @ ${homeTeam.name} (${homeTeam.shortName})`);

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
                        console.log(`✅ MATCHED: ${homeTeam.name} vs ${awayTeam.name} -> Rooting for ${m.team}`);
                    }

                    return isMatch;
                });

                // Log all games for debugging
                console.log(`Game: ${homeTeam.name} (${homeTeam.shortName}) vs ${awayTeam.name} (${awayTeam.shortName}) - ${matchup ? 'MATCHED' : 'NO MATCH'}`);

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

            // Sort by Importance
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filteredGames.sort((a: any, b: any) => (a.rootingInterest?.importance || 99) - (b.rootingInterest?.importance || 99));

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

    // Ticker Auto-Scroll - Responsive slots per page
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

    // Marquee Game Auto-Rotation
    useEffect(() => {
        if (isGameLocked || games.length === 0) return;

        const interval = setInterval(() => {
            setCurrentGameIndex(prev => {
                const nextIndex = (prev + 1) % games.length;
                setSelectedGameId(games[nextIndex].id);
                return nextIndex;
            });
        }, 10000);

        return () => clearInterval(interval);
    }, [isGameLocked, games]);

    const activeGame = games.find(g => g.id === selectedGameId) || games[0];
    // Responsive slots: 2 on mobile, 3 on tablet, 4 on desktop
    const visibleTickerGames = games.slice(tickerPage * slotsPerPage, (tickerPage + 1) * slotsPerPage);
    const emptySlotsCount = Math.max(0, slotsPerPage - visibleTickerGames.length);
    
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
    
    // Update slots per page on resize
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

    return (
        <div className="flex flex-col h-screen bg-white text-gray-900 font-sans overflow-hidden">

            {/* Main Feature Area */}
            <main className="flex-1 relative overflow-y-auto sm:overflow-hidden flex flex-col min-h-0">

                {/* Header Overlay */}
                <header className="absolute top-0 w-full z-20 p-2 sm:p-2.5 md:p-3 flex flex-wrap justify-between items-center gap-2 sm:gap-3 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-1 min-w-0">
                        {/* BYU Logo */}
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/50 p-1 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo1.png" alt="BYU" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm sm:text-lg md:text-xl font-black italic tracking-tighter text-[#0062B8] leading-tight">PLAYOFF<span className="text-[#002E5D]">TRACKER</span></h1>
                            <p className="text-[9px] sm:text-[10px] text-gray-600 font-medium tracking-widest uppercase leading-tight">Road to the CFP</p>
                        </div>
                        
                        {/* Mobile View Toggle Button - In Header */}
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

                {/* Content Grid: Main Game + Sidebar */}
                <div className="flex-1 flex flex-col sm:flex-row overflow-visible sm:overflow-hidden min-h-0">

                    {/* Left: Main Game Display */}
                    <div className={`flex-1 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 pb-40 sm:pb-36 md:pb-40 relative z-10 pt-32 sm:pt-24 md:pt-24 min-h-0 flex-shrink-0 overflow-visible ${mobileView === 'guide' ? 'hidden sm:flex' : 'flex'}`}>
                        {activeGame ? (
                            <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-700">

                                {/* Rooting Context Badge */}
                                <div className="mb-2 sm:mb-3 md:mb-4 flex items-center gap-2 sm:gap-3 z-30 w-full max-w-5xl px-2">
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
                                        title={isGameLocked ? 'Unlock to auto-rotate games' : 'Lock current game'}
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
                                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-8 md:-translate-x-12 z-20 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/70 backdrop-blur-xl rounded-full border border-white/40 shadow-lg hover:bg-white/90 active:bg-white transition-all touch-manipulation flex items-center justify-center group"
                                        title="Previous game"
                                    >
                                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#0062B8] group-hover:text-[#002E5D] transition-colors" />
                                    </button>

                                    {/* Scoreboard */}
                                    <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6 md:gap-8 lg:gap-16 px-2">
                                    <BigTeamDisplay team={activeGame.away} isOpponentWinner={activeGame.home.isWinner} align="right" />

                                    <div className="flex flex-col items-center gap-2 sm:gap-4">
                                        <div className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-black text-gray-300/40 italic select-none">VS</div>
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
                                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-8 md:translate-x-12 z-20 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/70 backdrop-blur-xl rounded-full border border-white/40 shadow-lg hover:bg-white/90 active:bg-white transition-all touch-manipulation flex items-center justify-center group"
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
                                    </div>
                                    {activeGame.situation?.lastPlay && (
                                        <button
                                            onClick={() => setShowPlaysModal(true)}
                                            className="mt-3 bg-white/60 backdrop-blur-xl border border-white/40 rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-[#0062B8] hover:bg-white/80 transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 mx-auto"
                                        >
                                            <PlayCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                            See Plays
                                        </button>
                                    )}
                                </div>

                                {/* Matchup Predictor & Game Leaders - Side by Side */}
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
                                        <div className="mb-2 flex-shrink-0">
                                            <h3 className="text-[9px] sm:text-[10px] font-bold text-[#002E5D] uppercase tracking-widest mb-1.5 border-b border-gray-200/50 pb-1 sm:pb-1.5">Game Leaders</h3>
                                            
                                            {/* Team Filter Toggle */}
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
                                                        <div key={i} className="flex items-center gap-1.5 sm:gap-2">
                                                            {leader.athlete.headshot ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={leader.athlete.headshot} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/80 backdrop-blur-sm object-cover border border-white/50 shadow-sm flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 flex items-center justify-center text-[8px] sm:text-[9px] text-gray-600 shadow-sm flex-shrink-0">{leader.athlete.position}</div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">{leader.athlete.shortName}</div>
                                                                <div className="text-[9px] sm:text-[10px] text-gray-600 truncate">{leader.name}</div>
                                                            </div>
                                                            <div className="text-[11px] sm:text-xs font-mono font-bold text-[#0062B8] flex-shrink-0">{leader.displayValue}</div>
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
                            </div>
                        ) : (
                            <div className="text-gray-400">Loading Playoff Scenarios...</div>
                        )}
                    </div>

                    {/* Right: Playoff Implications Sidebar */}
                    <div className={`w-full sm:w-80 lg:w-72 xl:w-80 bg-white/40 backdrop-blur-xl border-l border-white/30 sm:border-t-0 border-t border-white/20 flex flex-col pt-0 sm:pt-24 shadow-lg min-h-[400px] sm:min-h-0 flex-shrink-0 ${mobileView === 'game' ? 'hidden sm:flex' : 'flex'}`}>
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
                                                {game.rootingInterest?.status.toUpperCase()}
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
        <div className="flex-1 flex items-stretch overflow-hidden">
    <button onClick={prevTickerPage} className="w-8 sm:w-8 bg-[#0062B8]/60 backdrop-blur-md hover:bg-[#0062B8]/80 active:bg-[#0062B8] flex items-center justify-center border-r border-white/10 z-10 transition-all touch-manipulation">
        <ChevronLeft className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
    </button>

    <div className="flex-1 flex divide-x divide-white/10 w-full relative">
        {visibleTickerGames.map((game) => (
            <button
                key={game.id}
                onClick={() => handleGameSelect(game.id)}
                className={`group flex-1 px-3 sm:px-3 md:px-4 py-2 sm:py-2 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-sm touch-manipulation min-w-0
                  ${selectedGameId === game.id ? 'bg-white/10 border-t border-white/30' : 'hover:bg-white/5 active:bg-white/10'}
                `}
            >
                {/* Active Indicator Bar */}
                {selectedGameId === game.id && (
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[#0062B8] shadow-sm"></div>
                )}

                {/* Row 1: Header */}
                <div className="flex justify-between items-center text-[9px] sm:text-[9px] md:text-[10px] text-gray-300 uppercase font-bold tracking-wider w-full mb-0.5">
                    <span className={`truncate mr-1 sm:mr-2 ${game.isLive ? 'text-red-400 animate-pulse' : ''}`}>
                        {game.statusDetail}
                    </span>
                    <span className="truncate hidden sm:inline">{game.broadcast}</span>
                </div>

                {/* Row 2: Teams */}
                <div className="space-y-1.5 sm:space-y-1 w-full flex-1 flex flex-col justify-center">
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
                <div className="h-3 sm:h-4 flex items-center justify-end w-full mt-0.5">
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

        {/* Always show 4 slots - fill empty slots */}
        {Array.from({ length: emptySlotsCount }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 bg-transparent backdrop-blur-sm border-r border-white/10 last:border-r-0"></div>
        ))}
    </div>

    <button onClick={nextTickerPage} className="w-8 sm:w-8 bg-[#0062B8]/60 backdrop-blur-md hover:bg-[#0062B8]/80 active:bg-[#0062B8] flex items-center justify-center border-l border-white/10 z-10 transition-all touch-manipulation">
        <ChevronRight className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
    </button>
</div>
            </footer>

            {/* Plays Modal */}
            {showPlaysModal && activeGame.situation?.lastPlay && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowPlaysModal(false)}
                >
                    <div 
                        className="bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-lg w-full border border-white/40 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#0062B8]" />
                                <h3 className="text-base sm:text-lg font-black text-[#0062B8] uppercase tracking-wider">Last Play</h3>
                            </div>
                            <button
                                onClick={() => setShowPlaysModal(false)}
                                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-lg transition-all"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                            </button>
                        </div>
                        <div className="bg-white/60 backdrop-blur-md rounded-xl p-4 sm:p-5 border border-white/40">
                            <p className="text-sm sm:text-base md:text-lg text-gray-800 leading-relaxed font-medium text-center">
                                "{activeGame.situation.lastPlay}"
                            </p>
                        </div>
                        {activeGame.venue && (
                            <div className="mt-4 flex items-center justify-center gap-2 text-gray-600 text-xs sm:text-sm">
                                <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{activeGame.venue}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
                    <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 bg-[#0062B8] rounded-full p-1 sm:p-1.5 shadow-lg border-2 border-white backdrop-blur-sm">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#002E5D] rounded-full"></div>
                    </div>
                )}
            </div>

            <div className="space-y-0.5 sm:space-y-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {align === 'left' && team.rank && <RankBadge rank={team.rank} />}
                    <h2 className="text-base sm:text-lg md:text-xl lg:text-3xl font-black text-[#002E5D] tracking-tight leading-none">{team.shortName}</h2>
                    {align === 'right' && team.rank && <RankBadge rank={team.rank} />}
                </div>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 font-medium">{team.record || '0-0'}</p>
            </div>

            <div className={`text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black font-mono tracking-tighter ${isWinner ? 'text-[#0062B8]' : 'text-[#002E5D]'}`}>
                {team.score || '0'}
            </div>
        </div>
    );
};

const TickerTeamRow = ({ team, hasBall, isRootedFor }: { team: Team, hasBall: boolean, isRootedFor?: boolean }) => (
    <div className="flex justify-between items-center gap-1">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.logo} alt="" className="w-4 h-4 sm:w-4 sm:h-4 object-contain flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-xs sm:text-sm font-bold truncate leading-tight ${isRootedFor ? 'text-[#0062B8]' : 'text-white'}`}>
                    {team.rank && <span className="text-[9px] sm:text-[10px] text-gray-300 mr-0.5 sm:mr-1">{team.rank}</span>}
                    {team.shortName}
                    {isRootedFor && <span className="ml-0.5 sm:ml-1 text-[7px] sm:text-[8px] bg-[#0062B8] px-0.5 sm:px-1 rounded text-white">Preferred</span>}
                </span>
            </div>
            {hasBall && <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 rounded-full bg-[#0062B8] animate-pulse flex-shrink-0 ml-0.5" />}
        </div>
        <span className={`font-mono font-black text-sm sm:text-sm flex-shrink-0 ${team.isWinner ? 'text-[#0062B8]' : 'text-white'}`}>
            {team.score || '0'}
        </span>
    </div>
);

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
            <h3 className="text-[9px] sm:text-[10px] font-bold text-[#002E5D] uppercase tracking-widest mb-2 sm:mb-3 text-center flex-shrink-0">MATCHUP PREDICTOR</h3>
            
            {/* Circular Chart */}
            <div className="relative w-full aspect-square max-w-[140px] sm:max-w-[150px] md:max-w-[170px] mx-auto mb-2 sm:mb-3 flex-shrink-0 overflow-visible">
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
                    <div className="flex items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.away.logo} alt={game.away.shortName} className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.home.logo} alt={game.home.shortName} className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
                    </div>
                </div>
            </div>

            {/* Percentages */}
            <div className="flex justify-between items-center gap-1.5 mb-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 flex-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: awayColor }}></div>
                    <div className="flex flex-col min-w-0">
                        <div className="text-base sm:text-lg font-black text-gray-900">{awayProb.toFixed(1)}%</div>
                        <div className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase truncate">{game.away.shortName}</div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-1 justify-end">
                    <div className="flex flex-col items-end min-w-0">
                        <div className="text-base sm:text-lg font-black text-gray-900">{homeProb.toFixed(1)}%</div>
                        <div className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase truncate">{game.home.shortName}</div>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: homeColor }}></div>
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
