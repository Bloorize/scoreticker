'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Tv, MapPin, PlayCircle, ChevronLeft, ChevronRight, MousePointerClick, CheckCircle2, XCircle, AlertCircle, Lock, Unlock } from 'lucide-react';

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
                    rootingInterest
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

    // Ticker Auto-Scroll - Always show 4 slots per page
    useEffect(() => {
        if (games.length === 0) return;
        const interval = setInterval(() => {
            setTickerPage(prev => {
                const totalPages = Math.ceil(games.length / 4);
                const nextPage = prev + 1;
                return nextPage < totalPages ? nextPage : 0;
            });
        }, 10000);
        return () => clearInterval(interval);
    }, [games.length]);

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
    // Always show 4 slots - pad with empty games if needed
    const visibleTickerGames = games.slice(tickerPage * 4, (tickerPage + 1) * 4);
    const emptySlotsCount = Math.max(0, 4 - visibleTickerGames.length);

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

    const nextTickerPage = () => {
        setTickerPage(prev => {
            const totalPages = Math.ceil(games.length / 4);
            const nextPage = prev + 1;
            return nextPage < totalPages ? nextPage : 0;
        });
    };

    const prevTickerPage = () => {
        setTickerPage(prev => {
            const totalPages = Math.ceil(games.length / 4);
            const prevPage = prev - 1;
            return prevPage >= 0 ? prevPage : totalPages - 1;
        });
    };

    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 text-gray-900 font-sans overflow-hidden">

            {/* Main Feature Area */}
            <main className="flex-1 relative overflow-hidden flex flex-col">

                {/* Header Overlay */}
                <header className="absolute top-0 w-full z-20 p-6 flex flex-wrap justify-between items-start gap-4 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
                    <div className="flex items-center gap-4">
                        {/* BYU Logo */}
                        <div className="w-12 h-12 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/50 p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo1.png" alt="BYU" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black italic tracking-tighter text-[#0062B8]">PLAYOFF<span className="text-[#002E5D]">TRACKER</span></h1>
                            <p className="text-xs text-gray-600 font-medium tracking-widest uppercase">Road to the CFP</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end text-right">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Last Updated</span>
                            <span className="text-xs font-mono text-[#0062B8]">{lastUpdated.toLocaleTimeString()}</span>
                        </div>
                        <button onClick={fetchGames} className="p-2 hover:bg-white/60 backdrop-blur-md rounded-full transition-all border border-transparent hover:border-white/40">
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'text-[#0062B8]'}`} />
                        </button>
                    </div>
                </header>

                {/* Content Grid: Main Game + Sidebar */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left: Main Game Display */}
                    <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24 relative z-10 pt-40">
                        {activeGame ? (
                            <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-700">

                                {/* Rooting Context Badge */}
                                <div className="mb-8 flex items-center gap-3 z-30">
                                    <div className="bg-[#0062B8]/90 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/30 shadow-xl flex items-center gap-3">
                                        <span className="text-sm font-bold text-white uppercase tracking-widest">We Want:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-xl text-white">{activeGame.rootingInterest?.teamName}</span>
                                            {activeGame.rootingInterest?.status === 'winning' || activeGame.rootingInterest?.status === 'won' ? (
                                                <CheckCircle2 className="w-6 h-6 text-green-200" />
                                            ) : activeGame.rootingInterest?.status === 'pending' ? (
                                                <AlertCircle className="w-6 h-6 text-gray-200" />
                                            ) : (
                                                <XCircle className="w-6 h-6 text-red-200" />
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleLock}
                                        className={`p-3 rounded-xl backdrop-blur-xl border transition-all shadow-lg ${
                                            isGameLocked 
                                                ? 'bg-[#0062B8]/90 border-white/30 text-white hover:bg-[#0062B8]' 
                                                : 'bg-white/60 border-white/40 text-[#0062B8] hover:bg-white/80'
                                        }`}
                                        title={isGameLocked ? 'Unlock to auto-rotate games' : 'Lock current game'}
                                    >
                                        {isGameLocked ? (
                                            <Lock className="w-5 h-5" />
                                        ) : (
                                            <Unlock className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>

                                {/* Scoreboard */}
                                <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-16">
                                    <BigTeamDisplay team={activeGame.away} isOpponentWinner={activeGame.home.isWinner} align="right" />

                                    <div className="flex flex-col items-center gap-4">
                                        <div className="text-4xl md:text-6xl font-black text-gray-300/40 italic select-none">VS</div>
                                        {activeGame.isLive && activeGame.situation.downDistanceText && (
                                            <div className="flex flex-col items-center bg-[#002E5D]/90 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/20 shadow-xl">
                                                <span className="text-xl md:text-2xl font-bold text-white font-mono tracking-tight">
                                                    {activeGame.situation.downDistanceText}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <BigTeamDisplay team={activeGame.home} isOpponentWinner={activeGame.away.isWinner} align="left" />
                                </div>

                                {/* Game Details / Last Play / Leaders */}
                                <div className="mt-12 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center gap-2 text-gray-700 text-sm font-medium">
                                            <MapPin className="w-4 h-4 text-[#0062B8]" />
                                            {activeGame.venue}
                                        </div>
                                        {activeGame.situation?.lastPlay && (
                                            <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center shadow-lg">
                                                <div className="flex items-center justify-center gap-2 mb-1">
                                                    <PlayCircle className="w-4 h-4 text-[#0062B8]" />
                                                    <span className="text-xs font-bold text-[#0062B8] uppercase tracking-wider">Last Play</span>
                                                </div>
                                                <p className="text-gray-700 leading-relaxed font-medium">"{activeGame.situation.lastPlay}"</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Leaders Module */}
                                    {activeGame.leaders && activeGame.leaders.length > 0 && (
                                        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-lg">
                                            <h3 className="text-xs font-bold text-[#002E5D] uppercase tracking-widest mb-3 border-b border-gray-200/50 pb-2">Game Leaders</h3>
                                            <div className="space-y-3">
                                                {activeGame.leaders.slice(0, 3).map((leader, i) => (
                                                    <div key={i} className="flex items-center gap-3">
                                                        {leader.athlete.headshot ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={leader.athlete.headshot} alt="" className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm object-cover border border-white/50 shadow-sm" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 flex items-center justify-center text-[10px] text-gray-600 shadow-sm">{leader.athlete.position}</div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-gray-900 truncate">{leader.athlete.shortName}</div>
                                                            <div className="text-xs text-gray-600 truncate">{leader.name}</div>
                                                        </div>
                                                        <div className="text-sm font-mono font-bold text-[#0062B8]">{leader.displayValue}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-400">Loading Playoff Scenarios...</div>
                        )}
                    </div>

                    {/* Right: Playoff Implications Sidebar */}
                    <div className="w-80 bg-white/40 backdrop-blur-xl border-l border-white/30 hidden xl:flex flex-col pt-24 shadow-lg">
                        <div className="p-4 border-b border-white/20 bg-[#0062B8]/90 backdrop-blur-xl">
                            <h2 className="font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-white" />
                                Rooting Guide
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {/* 2-column grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {games.map((game, idx) => (
                                    <button
                                        key={game.id}
                                        onClick={() => handleGameSelect(game.id)}
                                        className={`w-full text-left p-2 rounded-xl border transition-all backdrop-blur-md
                                    ${selectedGameId === game.id ? 'bg-[#0062B8]/20 border-[#0062B8]/40 shadow-md' : 'bg-white/60 border-white/40 hover:bg-white/80 hover:border-white/60'}
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
            <footer className="h-28 bg-[#002E5D]/90 backdrop-blur-xl border-t border-white/20 flex relative z-30 shadow-2xl">
        <div className="bg-[#0062B8]/90 backdrop-blur-xl px-4 flex items-center justify-center z-40 shadow-xl border-r border-white/20">
            <span className="text-xs font-black text-white leading-none text-center">
                IMPACT<br />GAMES
            </span>
        </div>

        {/* Scroll Container */}
        <div className="flex-1 flex items-stretch overflow-hidden">
    <button onClick={prevTickerPage} className="w-8 bg-[#0062B8]/60 backdrop-blur-md hover:bg-[#0062B8]/80 flex items-center justify-center border-r border-white/10 z-10 transition-all">
        <ChevronLeft className="w-5 h-5 text-white" />
    </button>

    <div className="flex-1 flex divide-x divide-white/10 w-full relative">
        {visibleTickerGames.map((game) => (
            <button
                key={game.id}
                onClick={() => handleGameSelect(game.id)}
                className={`group flex-1 px-4 py-2 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-sm
                  ${selectedGameId === game.id ? 'bg-white/10 border-t border-white/30' : 'hover:bg-white/5'}
                `}
            >
                {/* Active Indicator Bar */}
                {selectedGameId === game.id && (
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[#0062B8] shadow-sm"></div>
                )}

                {/* Row 1: Header */}
                <div className="flex justify-between items-center text-[10px] text-gray-300 uppercase font-bold tracking-wider w-full">
                    <span className={`truncate mr-2 ${game.isLive ? 'text-red-400 animate-pulse' : ''}`}>
                        {game.statusDetail}
                    </span>
                    <span className="truncate">{game.broadcast}</span>
                </div>

                {/* Row 2: Teams */}
                <div className="space-y-1 w-full my-1">
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
                <div className="h-4 flex items-center justify-end w-full">
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

    <button onClick={nextTickerPage} className="w-8 bg-[#0062B8]/60 backdrop-blur-md hover:bg-[#0062B8]/80 flex items-center justify-center border-l border-white/10 z-10 transition-all">
        <ChevronRight className="w-5 h-5 text-white" />
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
        <div className={`flex flex-col gap-4 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
            <div className={`relative w-24 h-24 md:w-32 md:h-32 p-4 bg-white/70 backdrop-blur-xl rounded-full border ${isWinner ? 'border-[#0062B8]/50 shadow-xl' : 'border-white/50'} shadow-lg`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={team.logo} alt={team.name} className={`w-full h-full object-contain drop-shadow-lg ${isLoser ? 'grayscale opacity-70' : ''}`} />
                {team.hasBall && (
                    <div className="absolute -bottom-1 -right-1 bg-[#0062B8] rounded-full p-1.5 shadow-lg border-2 border-white backdrop-blur-sm">
                        <div className="w-3 h-3 bg-[#002E5D] rounded-full"></div>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    {align === 'left' && team.rank && <RankBadge rank={team.rank} />}
                    <h2 className="text-2xl md:text-4xl font-black text-[#002E5D] tracking-tight leading-none">{team.shortName}</h2>
                    {align === 'right' && team.rank && <RankBadge rank={team.rank} />}
                </div>
                <p className="text-lg text-gray-600 font-medium">{team.record || '0-0'}</p>
            </div>

            <div className={`text-6xl md:text-8xl font-black font-mono tracking-tighter ${isWinner ? 'text-[#0062B8]' : 'text-[#002E5D]'}`}>
                {team.score || '0'}
            </div>
        </div>
    );
};

const TickerTeamRow = ({ team, hasBall, isRootedFor }: { team: Team, hasBall: boolean, isRootedFor?: boolean }) => (
    <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
            <div className="flex flex-col min-w-0">
                <span className={`text-sm font-bold truncate ${isRootedFor ? 'text-[#0062B8]' : 'text-white'}`}>
                    {team.rank && <span className="text-[10px] text-gray-300 mr-1">{team.rank}</span>}
                    {team.shortName}
                    {isRootedFor && <span className="ml-1 text-[8px] bg-[#0062B8] px-1 rounded text-white">US</span>}
                </span>
            </div>
            {hasBall && <div className="w-1.5 h-1.5 rounded-full bg-[#0062B8] animate-pulse flex-shrink-0" />}
        </div>
        <span className={`font-mono font-black text-sm ${team.isWinner ? 'text-[#0062B8]' : 'text-white'}`}>
            {team.score || '0'}
        </span>
    </div>
);

const RankBadge = ({ rank }: { rank: number }) => (
    <span className="bg-[#002E5D]/90 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg leading-none border border-white/20 shadow-sm">{rank}</span>
);

export default ByuPage;
