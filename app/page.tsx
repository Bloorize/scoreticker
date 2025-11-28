'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Tv, MapPin, PlayCircle, ChevronLeft, ChevronRight, MousePointerClick, Lock, Unlock } from 'lucide-react';

// Types for our data structure
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
}

const App = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [tickerPage, setTickerPage] = useState(0);
  const [isGameLocked, setIsGameLocked] = useState(false);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);

  // ESPN's public hidden API endpoint
  // Dates formatted as YYYYMMDD. 
  // We are fetching a range from Friday Nov 28 2025 to Saturday Nov 29 2025
  const DATA_URL = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20251128-20251129&limit=200&groups=80";

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch(DATA_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch game data');
      }
      const data = await response.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleanedGames = (data.events || []).map((event: any) => {
        const competition = event.competitions[0];
        const competitors = competition.competitors;
        const home = competitors.find((c: any) => c.homeAway === 'home');
        const away = competitors.find((c: any) => c.homeAway === 'away');
        const situation = competition.situation || {};

        const leaders = (competition.leaders || []).flatMap((cat: any) => {
          return (cat.leaders || []).map((l: any) => ({
            name: cat.displayName, // e.g. "Passing Leader"
            displayValue: l.displayValue, // e.g. "250 YDS"
            athlete: {
              shortName: l.athlete.shortName,
              headshot: l.athlete.headshot,
              position: l.athlete.position?.abbreviation
            },
            teamId: l.team.id
          }));
        });

        // Determine Alert
        let alert = undefined;
        if (situation.lastPlay?.text) {
          const text = situation.lastPlay.text.toLowerCase();
          if (text.includes('touchdown')) alert = { type: 'TOUCHDOWN', text: 'TOUCHDOWN' };
          else if (text.includes('intercepted')) alert = { type: 'INTERCEPTION', text: 'INTERCEPTION' };
          else if (text.includes('fumble')) alert = { type: 'FUMBLE', text: 'FUMBLE' };
          else if (text.includes('safety')) alert = { type: 'SAFETY', text: 'SAFETY' };
        }

        return {
          id: event.id,
          name: event.name,
          shortName: event.shortName,
          date: new Date(event.date),
          status: event.status.type.state, // 'pre', 'in', 'post'
          statusDetail: event.status.type.shortDetail,
          isLive: event.status.type.state === 'in',
          venue: competition.venue?.fullName || 'TBD',
          broadcast: competition.broadcasts?.[0]?.names?.[0] || null,
          situation: {
            down: situation.down,
            distance: situation.distance,
            downDistanceText: situation.shortDownDistanceText,
            possession: situation.possession, // team ID
            isRedZone: situation.isRedZone,
            lastPlay: situation.lastPlay?.text,
            yardLine: situation.yardLine,
          },
          home: {
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
          },
          away: {
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
          },
          leaders,
          alert
        };
      });

      // Sort: Live first, then by date
      cleanedGames.sort((a: Game, b: Game) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return a.date.getTime() - b.date.getTime();
      });

      setGames(cleanedGames);
      setLastUpdated(new Date());
      setLoading(false);
      setError(null);

      if (cleanedGames.length > 0) {
        if (!selectedGameId) {
          // Select first live game or first game if none selected
          const liveGame = cleanedGames.find((g: Game) => g.isLive);
          const defaultGameId = liveGame ? liveGame.id : cleanedGames[0].id;
          setSelectedGameId(defaultGameId);
          setCurrentGameIndex(cleanedGames.findIndex((g: Game) => g.id === defaultGameId));
        } else {
          // Update index if selected game still exists
          const index = cleanedGames.findIndex((g: Game) => g.id === selectedGameId);
          if (index !== -1) {
            setCurrentGameIndex(index);
          } else {
            // Selected game no longer exists, reset to first
            setSelectedGameId(cleanedGames[0].id);
            setCurrentGameIndex(0);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load scoreboard. The API might be down or blocked.");
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
        <header className="absolute top-0 w-full z-20 p-6 flex justify-between items-start bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/90 backdrop-blur-md rounded-xl shadow-lg border border-white/30">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter text-blue-600">CFB<span className="text-blue-800">HQ</span></h1>
              <p className="text-xs text-gray-600 font-medium tracking-widest uppercase">Rivalry Week</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Last Updated</span>
              <span className="text-xs font-mono text-blue-600">{lastUpdated.toLocaleTimeString()}</span>
            </div>
            <button
              onClick={fetchGames}
              className="p-2 hover:bg-white/60 backdrop-blur-md rounded-full transition-all border border-transparent hover:border-white/40"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'text-blue-600'}`} />
            </button>
          </div>
        </header>

        {/* Big Game Display */}
        {activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24 pt-32 animate-in fade-in duration-700">

            {/* Game Context Badge with Lock */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl px-6 py-2 rounded-2xl border border-white/40 shadow-lg">
                {activeGame.isLive && <span className="animate-pulse w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>}
                <span className="text-sm font-bold tracking-wide text-gray-800">{activeGame.statusDetail}</span>
                <span className="text-gray-400 mx-1">•</span>
                <span className="text-sm text-gray-600 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-blue-600" /> {activeGame.broadcast || 'N/A'}
                </span>
              </div>
              <button
                onClick={toggleLock}
                className={`p-3 rounded-xl backdrop-blur-xl border transition-all shadow-lg ${
                  isGameLocked 
                    ? 'bg-blue-600/90 border-white/30 text-white hover:bg-blue-600' 
                    : 'bg-white/60 border-white/40 text-blue-600 hover:bg-white/80'
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
            <div className="w-full max-w-4xl grid grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-16">

              {/* Away Team */}
              <BigTeamDisplay team={activeGame.away} isOpponentWinner={activeGame.home.isWinner} align="right" />

              {/* VS / Clock */}
              <div className="flex flex-col items-center gap-4">
                <div className="text-4xl md:text-6xl font-black text-gray-300/40 italic select-none">VS</div>
                {activeGame.isLive && activeGame.situation.downDistanceText && (
                  <div className="flex flex-col items-center bg-blue-600/90 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/20 shadow-xl">
                    <span className="text-xl md:text-2xl font-bold text-white font-mono tracking-tight">
                      {activeGame.situation.downDistanceText}
                    </span>
                    <span className="text-[10px] text-white/80 uppercase tracking-widest mt-1">
                      Target Line
                    </span>
                  </div>
                )}
              </div>

              {/* Home Team */}
              <BigTeamDisplay team={activeGame.home} isOpponentWinner={activeGame.away.isWinner} align="left" />

            </div>

            {/* Game Details / Last Play / Leaders */}
            <div className="mt-12 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-gray-700 text-sm font-medium">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  {activeGame.venue}
                </div>

                {activeGame.situation?.lastPlay && (
                  <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-4 text-center shadow-lg">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <PlayCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Last Play</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed font-medium">
                      "{activeGame.situation.lastPlay}"
                    </p>
                  </div>
                )}
              </div>

              {/* Leaders Module */}
              {activeGame.leaders && activeGame.leaders.length > 0 && (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-lg">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3 border-b border-gray-200/50 pb-2">Game Leaders</h3>
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
                        <div className="text-sm font-mono font-bold text-blue-600">{leader.displayValue}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Loading Game Data...</p>
          </div>
        )}
      </main>

      {/* THE TICKER - Fixed Bottom */}
      <footer className="h-28 bg-blue-600/90 backdrop-blur-xl border-t border-white/20 flex relative z-30 shadow-2xl">
        <div className="bg-blue-700/90 backdrop-blur-xl px-4 flex items-center justify-center z-40 shadow-xl border-r border-white/20">
          <span className="text-xs font-black text-white leading-none text-center">
            SCORES
          </span>
        </div>

        {/* Scroll Container */}
        <div className="flex-1 flex items-stretch overflow-hidden">

          {/* Prev Button */}
          <button
            onClick={prevTickerPage}
            className="w-8 bg-blue-600/60 backdrop-blur-md hover:bg-blue-600/80 flex items-center justify-center border-r border-white/10 z-10 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 flex divide-x divide-white/10 w-full relative">
            {visibleTickerGames.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameSelect(game.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleGameSelect(game.id);
                }}
                className={`group flex-1 px-4 py-2 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-sm
                  ${selectedGameId === game.id ? 'bg-white/10 border-t border-white/30' : 'hover:bg-white/5'}
                `}
              >
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-blue-700/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center z-20 pointer-events-none backdrop-blur-sm">
                  <MousePointerClick className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Watch Game</span>
                </div>

                {/* Active Indicator Bar */}
                {selectedGameId === game.id && (
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-white shadow-sm"></div>
                )}

                {/* Row 1: Header */}
                <div className="flex justify-between items-center text-[10px] text-gray-300 uppercase font-bold tracking-wider w-full">
                  <span className={`truncate mr-2 ${game.isLive ? 'text-red-300 animate-pulse' : ''}`}>
                    {game.statusDetail}
                  </span>
                  <span className="truncate">{game.broadcast}</span>
                </div>

                {/* Row 2: Teams */}
                <div className="space-y-1 w-full my-1">
                  <TickerTeamRow
                    team={game.away}
                    hasBall={game.isLive && game.situation.possession === game.away.id}
                    leader={game.leaders?.find(l => l.teamId === game.away.id)}
                  />
                  <TickerTeamRow
                    team={game.home}
                    hasBall={game.isLive && game.situation.possession === game.home.id}
                    leader={game.leaders?.find(l => l.teamId === game.home.id)}
                  />
                </div>

                {/* Row 3: Footer (Situation / Alert) */}
                <div className="h-4 flex items-center justify-end w-full">
                  {game.alert ? (
                    <div className={`text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse
                       ${game.alert.type === 'TOUCHDOWN' ? 'bg-yellow-500 text-black' :
                        game.alert.type === 'INTERCEPTION' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}
                     `}>
                      {game.alert.text}
                    </div>
                  ) : (
                    game.isLive && game.situation.downDistanceText && (
                      <div className="text-[10px] text-yellow-500 font-mono opacity-100 font-bold">
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

          {/* Next Button */}
          <button
            onClick={nextTickerPage}
            className="w-8 bg-blue-600/60 backdrop-blur-md hover:bg-blue-600/80 flex items-center justify-center border-l border-white/10 z-10 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </footer>
    </div>
  );
};

// Component for the Large Main View Team
const BigTeamDisplay = ({ team, isOpponentWinner, align }: { team: Team, isOpponentWinner: boolean, align: 'left' | 'right' }) => {
  const isWinner = team.isWinner;
  const isLoser = isOpponentWinner;

  return (
    <div className={`flex flex-col gap-4 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <div className={`relative w-24 h-24 md:w-32 md:h-32 p-4 bg-white/70 backdrop-blur-xl rounded-full border ${isWinner ? 'border-yellow-500/60 shadow-xl' : 'border-white/50'} shadow-lg`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={team.logo}
          alt={team.name}
          className={`w-full h-full object-contain drop-shadow-lg ${isLoser ? 'grayscale opacity-70' : ''}`}
        />
        {team.hasBall && (
          <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full p-1.5 shadow-lg border-2 border-white backdrop-blur-sm">
            <div className="w-3 h-3 bg-yellow-700 rounded-full"></div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {align === 'left' && team.rank && <RankBadge rank={team.rank} />}
          <h2 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">
            {team.shortName}
          </h2>
          {align === 'right' && team.rank && <RankBadge rank={team.rank} />}
        </div>
        <p className="text-lg text-gray-600 font-medium">{team.record || '0-0'}</p>
      </div>

      <div className={`text-6xl md:text-8xl font-black font-mono tracking-tighter ${isWinner ? 'text-yellow-500' : 'text-gray-900'}`}>
        {team.score || '0'}
      </div>
    </div>
  );
};

// Component for the Ticker Rows
const TickerTeamRow = ({ team, hasBall, leader }: { team: Team, hasBall: boolean, leader?: Leader }) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-2 min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className={`text-sm font-bold truncate ${team.isWinner ? 'text-yellow-300' : 'text-white'}`}>
          {team.rank && <span className="text-[10px] text-gray-300 mr-1">{team.rank}</span>}
          {team.shortName}
        </span>
        {leader && (
          <span className="text-[9px] text-gray-300 truncate leading-none -mt-0.5">
            {leader.athlete.shortName}: {leader.displayValue}
          </span>
        )}
      </div>
      {hasBall && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />}
    </div>
    <span className={`font-mono font-black text-sm ${team.isWinner ? 'text-yellow-300' : 'text-white'}`}>
      {team.score || '0'}
    </span>
  </div>
);

const RankBadge = ({ rank }: { rank: number }) => (
  <span className="bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded-lg leading-none border border-white/20 shadow-sm">
    {rank}
  </span>
);

export default App;
