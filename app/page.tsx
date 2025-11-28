'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Tv, MapPin, PlayCircle, ChevronLeft, ChevronRight, MousePointerClick } from 'lucide-react';

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

      // Select first live game or first game if none selected
      if (!selectedGameId && cleanedGames.length > 0) {
        const liveGame = cleanedGames.find((g: Game) => g.isLive);
        setSelectedGameId(liveGame ? liveGame.id : cleanedGames[0].id);
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

  // Ticker Auto-Scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerPage(prev => {
        const nextPage = prev + 1;
        return (nextPage * 4 < games.length) ? nextPage : 0;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [games.length]);

  const activeGame = games.find(g => g.id === selectedGameId) || games[0];
  const visibleTickerGames = games.slice(tickerPage * 4, (tickerPage + 1) * 4);

  const nextTickerPage = () => {
    setTickerPage(prev => {
      const nextPage = prev + 1;
      return (nextPage * 4 < games.length) ? nextPage : 0;
    });
  };

  const prevTickerPage = () => {
    setTickerPage(prev => {
      const prevPage = prev - 1;
      return prevPage >= 0 ? prevPage : Math.floor((games.length - 1) / 4);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-100 font-sans overflow-hidden">

      {/* Main Feature Area (TV Style) */}
      <main className="flex-1 relative bg-gradient-to-br from-slate-900 via-slate-900 to-black overflow-hidden flex flex-col">

        {/* Header Overlay */}
        <header className="absolute top-0 w-full z-20 p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-700 rounded-lg shadow-lg shadow-blue-900/50">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter text-white">CFB<span className="text-blue-500">HQ</span></h1>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Rivalry Week</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Last Updated</span>
              <span className="text-xs font-mono text-emerald-400">{lastUpdated.toLocaleTimeString()}</span>
            </div>
            <button
              onClick={fetchGames}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'text-slate-300'}`} />
            </button>
          </div>
        </header>

        {/* Big Game Display */}
        {activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 pb-24 animate-in fade-in duration-700">

            {/* Game Context Badge */}
            <div className="mb-6 flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
              {activeGame.isLive && <span className="animate-pulse w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>}
              <span className="text-sm font-bold tracking-wide text-slate-200">{activeGame.statusDetail}</span>
              <span className="text-slate-500 mx-1">•</span>
              <span className="text-sm text-slate-400 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5" /> {activeGame.broadcast || 'N/A'}
              </span>
            </div>

            {/* Scoreboard */}
            <div className="w-full max-w-4xl grid grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-16">

              {/* Away Team */}
              <BigTeamDisplay team={activeGame.away} isOpponentWinner={activeGame.home.isWinner} align="right" />

              {/* VS / Clock */}
              <div className="flex flex-col items-center gap-4">
                <div className="text-4xl md:text-6xl font-black text-slate-700 italic opacity-50 select-none">VS</div>
                {activeGame.isLive && activeGame.situation.downDistanceText && (
                  <div className="flex flex-col items-center bg-black/40 backdrop-blur rounded-xl px-4 py-2 border border-white/10 shadow-2xl">
                    <span className="text-xl md:text-2xl font-bold text-yellow-400 font-mono tracking-tight">
                      {activeGame.situation.downDistanceText}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
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
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                  <MapPin className="w-4 h-4" />
                  {activeGame.venue}
                </div>

                {activeGame.situation?.lastPlay && (
                  <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <PlayCircle className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Last Play</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed font-medium text-center">
                      "{activeGame.situation.lastPlay}"
                    </p>
                  </div>
                )}
              </div>

              {/* Leaders Module */}
              {activeGame.leaders && activeGame.leaders.length > 0 && (
                <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Game Leaders</h3>
                  <div className="space-y-3">
                    {activeGame.leaders.slice(0, 3).map((leader, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {leader.athlete.headshot ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={leader.athlete.headshot} alt="" className="w-8 h-8 rounded-full bg-slate-700 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">{leader.athlete.position}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-200 truncate">{leader.athlete.shortName}</div>
                          <div className="text-xs text-slate-500 truncate">{leader.name}</div>
                        </div>
                        <div className="text-sm font-mono font-bold text-blue-400">{leader.displayValue}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <p>Loading Game Data...</p>
          </div>
        )}
      </main>

      {/* THE TICKER - Fixed Bottom */}
      <footer className="h-28 bg-slate-900 border-t border-slate-800 flex relative z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <div className="bg-blue-700 px-4 flex items-center justify-center z-40 shadow-xl">
          <span className="text-xs font-black text-white leading-none text-center">
            SCORES
          </span>
        </div>

        {/* Scroll Container */}
        <div className="flex-1 flex items-stretch overflow-hidden">

          {/* Prev Button */}
          <button
            onClick={prevTickerPage}
            className="w-8 bg-slate-800 hover:bg-slate-700 flex items-center justify-center border-r border-slate-700 z-10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>

          <div className="flex-1 flex divide-x divide-slate-800 w-full relative">
            {visibleTickerGames.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGameId(game.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedGameId(game.id);
                }}
                className={`group flex-1 px-4 py-2 flex flex-col justify-between transition-colors relative overflow-hidden
                  ${selectedGameId === game.id ? 'bg-slate-800' : 'hover:bg-slate-800/80'}
                `}
              >
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-blue-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center z-20 pointer-events-none">
                  <MousePointerClick className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Watch Game</span>
                </div>

                {/* Active Indicator Bar */}
                {selectedGameId === game.id && (
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                )}

                {/* Row 1: Header */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider w-full">
                  <span className={`truncate mr-2 ${game.isLive ? 'text-red-500 animate-pulse' : ''}`}>
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

            {/* Fill empty slots if less than 4 games on last page */}
            {Array.from({ length: Math.max(0, 4 - visibleTickerGames.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 bg-slate-900/50"></div>
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={nextTickerPage}
            className="w-8 bg-slate-800 hover:bg-slate-700 flex items-center justify-center border-l border-slate-700 z-10 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-400" />
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
      <div className={`relative w-24 h-24 md:w-32 md:h-32 p-4 bg-slate-800/50 rounded-full border-2 ${isWinner ? 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]' : 'border-white/5'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={team.logo}
          alt={team.name}
          className={`w-full h-full object-contain drop-shadow-2xl ${isLoser ? 'grayscale opacity-70' : ''}`}
        />
        {team.hasBall && (
          <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full p-1.5 shadow-lg border-2 border-slate-900">
            <div className="w-3 h-3 bg-yellow-900 rounded-full"></div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {align === 'left' && team.rank && <RankBadge rank={team.rank} />}
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-none">
            {team.shortName}
          </h2>
          {align === 'right' && team.rank && <RankBadge rank={team.rank} />}
        </div>
        <p className="text-lg text-slate-400 font-medium">{team.record || '0-0'}</p>
      </div>

      <div className={`text-6xl md:text-8xl font-black font-mono tracking-tighter ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
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
        <span className={`text-sm font-bold truncate ${team.isWinner ? 'text-yellow-400' : 'text-slate-200'}`}>
          {team.rank && <span className="text-[10px] text-slate-500 mr-1">{team.rank}</span>}
          {team.shortName}
        </span>
        {leader && (
          <span className="text-[9px] text-slate-500 truncate leading-none -mt-0.5">
            {leader.athlete.shortName}: {leader.displayValue}
          </span>
        )}
      </div>
      {hasBall && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />}
    </div>
    <span className={`font-mono font-black text-sm ${team.isWinner ? 'text-yellow-400' : 'text-white'}`}>
      {team.score || '0'}
    </span>
  </div>
);

const RankBadge = ({ rank }: { rank: number }) => (
  <span className="bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">
    {rank}
  </span>
);

export default App;
