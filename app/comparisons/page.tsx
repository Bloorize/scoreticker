'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// --- Types ---
interface TeamComparison {
    name: string;
    shortName: string;
    rank: number;
    record: string;
    wins: number;
    losses: number;
    conference: string;
    confStatus: string;
    sorRank?: number | null;
    fpiRank?: number | null;
    top25Wins?: number;
    logo?: string;
    color?: string;
}

interface ComparisonMetric {
    metric: string;
    byuValue: string | number;
    teamValue: string | number;
    unit: string;
}

interface ComparisonTeam {
    team: TeamComparison;
    metrics: ComparisonMetric[];
}

const BYU_TEAM_ID = '252';
const BYU_SHORT_NAME = 'BYU';

// Static team data (from user's HTML)
const STATIC_TEAM_DATA: Record<string, Partial<TeamComparison>> = {
    'BYU': {
        name: 'BYU Cougars',
        shortName: 'BYU',
        rank: 11,
        conference: 'Big 12',
        confStatus: 'Big 12 CCG Participant',
        sorRank: 5,
        fpiRank: 15,
        top25Wins: 2,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
        color: '#002E5D',
    },
    'Texas A&M': {
        name: 'Texas A&M Aggies',
        shortName: 'Texas A&M',
        rank: 4,
        conference: 'SEC',
        confStatus: 'SEC (Eliminated from CCG)',
        sorRank: 6,
        fpiRank: 6,
        top25Wins: 1,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        color: '#500000',
    },
    'Oregon': {
        name: 'Oregon Ducks',
        shortName: 'Oregon',
        rank: 6,
        conference: 'Big Ten',
        confStatus: 'Big Ten (No CCG Berth)',
        sorRank: 8,
        fpiRank: 4,
        top25Wins: 2,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        color: '#154733',
    },
    'Ole Miss': {
        name: 'Ole Miss Rebels',
        shortName: 'Ole Miss',
        rank: 7,
        conference: 'SEC',
        confStatus: 'SEC (Needs Bama Loss for CCG)',
        sorRank: 7,
        fpiRank: 13,
        top25Wins: 1,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        color: '#00205B',
    },
    'Oklahoma': {
        name: 'Oklahoma Sooners',
        shortName: 'Oklahoma',
        rank: 8,
        conference: 'SEC',
        confStatus: 'SEC (No CCG Berth)',
        sorRank: 11,
        fpiRank: 14,
        top25Wins: 2,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        color: '#841617',
    },
    'Notre Dame': {
        name: 'Notre Dame Fighting Irish',
        shortName: 'Notre Dame',
        rank: 9,
        conference: 'FBS Indep.',
        confStatus: 'Independent (Finished Season)',
        sorRank: 10,
        fpiRank: 12,
        top25Wins: 1,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        color: '#0C2340',
    },
    'Alabama': {
        name: 'Alabama Crimson Tide',
        shortName: 'Alabama',
        rank: 10,
        conference: 'SEC',
        confStatus: 'SEC (CCG If Win Iron Bowl)',
        sorRank: 9,
        fpiRank: 5,
        top25Wins: 2,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        color: '#9E1B32',
    },
    'Miami': {
        name: 'Miami Hurricanes',
        shortName: 'Miami',
        rank: 12,
        conference: 'ACC',
        confStatus: 'ACC (No CCG Berth)',
        sorRank: 12,
        fpiRank: 10,
        top25Wins: 2,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        color: '#F47321',
    },
    'Texas': {
        name: 'Texas Longhorns',
        shortName: 'Texas',
        rank: 11,
        conference: 'SEC',
        confStatus: 'SEC (No CCG Berth)',
        sorRank: 13,
        fpiRank: 9,
        top25Wins: 3,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        color: '#BF5700',
    },
    'Tulane': {
        name: 'Tulane Green Wave',
        shortName: 'Tulane',
        rank: 24,
        conference: 'American',
        confStatus: 'AAC (Highest Ranked G5)',
        sorRank: 25,
        fpiRank: 55,
        top25Wins: 0,
        logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
        color: '#006747',
    },
};

// Team IDs for fetching records
const TEAM_IDS: Record<string, string> = {
    'BYU': '252',
    'Texas A&M': '245',
    'Oregon': '2483',
    'Ole Miss': '145',
    'Oklahoma': '201',
    'Notre Dame': '87',
    'Alabama': '333',
    'Miami': '2390',
    'Texas': '251',
    'Tulane': '2655',
};

// Teams to compare against BYU
const COMPARISON_TEAM_NAMES = [
    'Texas A&M', 'Oregon', 'Ole Miss', 'Oklahoma', 'Notre Dame', 
    'Alabama', 'Miami', 'Texas', 'Tulane'
];

const PlayoffsPage = () => {
    const [byuData, setByuData] = useState<TeamComparison | null>(null);
    const [comparisonTeams, setComparisonTeams] = useState<ComparisonTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Fetch team records from ESPN APIs (same as playoffs page)
    const fetchTeamData = async () => {
        try {
            setLoading(true);

            // Fetch records from API route (same as playoffs page)
            const apiResponse = await fetch('/api/playoff-rankings', {
                cache: 'no-store',
            });

            if (!apiResponse.ok) {
                throw new Error(`Failed to fetch rankings: ${apiResponse.status}`);
            }

            const { recordsById: recordsByIdFromAPI } = await apiResponse.json();

            // Also fetch scoreboard directly (same as main page and playoffs page)
            const mainPageScoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20251128-20251130&limit=200&groups=80';
            const mainPageScoreboardResponse = await fetch(mainPageScoreboardUrl, {
                cache: 'no-store',
            });

            let mainPageScoreboardData = null;
            if (mainPageScoreboardResponse.ok) {
                mainPageScoreboardData = await mainPageScoreboardResponse.json();
            }

            // Fetch recent days
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
            const allScoreboardData = mainPageScoreboardData ? [mainPageScoreboardData, ...recentScoreboardResults] : recentScoreboardResults;

            // Extract records from scoreboard (same method as playoffs page)
            const scoreboardRecordsById: Record<string, string> = {};
            allScoreboardData.reverse().forEach((scoreboardData: any, dayIndex: number) => {
                if (scoreboardData?.events) {
                    scoreboardData.events.forEach((event: any) => {
                        const competition = event.competitions?.[0];
                        if (competition) {
                            competition.competitors?.forEach((competitor: any) => {
                                const teamId = competitor.team?.id;
                                const record = competitor.records?.[0]?.summary;
                                const recordFromStats = competitor.stats?.find((s: any) => 
                                    s.name === 'overall' || s.type === 'overall'
                                )?.displayValue;
                                const finalRecord = record || recordFromStats;

                                if (teamId && finalRecord) {
                                    const teamIdStr = String(teamId);
                                    const isMainPageData = mainPageScoreboardData && dayIndex === (allScoreboardData.length - 1);
                                    if (isMainPageData) {
                                        scoreboardRecordsById[teamIdStr] = finalRecord;
                                    } else if (!scoreboardRecordsById[teamIdStr]) {
                                        scoreboardRecordsById[teamIdStr] = finalRecord;
                                    }
                                }
                            });
                        }
                    });
                }
            });

            // Build team records map - prioritize scoreboard
            const teamRecordsById: Record<string, string> = { ...scoreboardRecordsById };

            // Add any missing from API route
            if (recordsByIdFromAPI) {
                Object.entries(recordsByIdFromAPI).forEach(([teamId, data]) => {
                    const teamIdStr = String(teamId);
                    if (!teamRecordsById[teamIdStr] && data && typeof data === 'object' && 'record' in data) {
                        teamRecordsById[teamIdStr] = (data as { record: string }).record;
                    }
                });
            }

            // Build BYU data from static + live record
            const byuTeamId = TEAM_IDS['BYU'];
            const byuRecord = teamRecordsById[byuTeamId] || '0-0';
            const byuRecordMatch = byuRecord.match(/(\d+)-(\d+)/);
            const byuWins = byuRecordMatch ? parseInt(byuRecordMatch[1]) : 0;
            const byuLosses = byuRecordMatch ? parseInt(byuRecordMatch[2]) : 0;

            const byu: TeamComparison = {
                ...STATIC_TEAM_DATA['BYU'],
                record: byuRecord,
                wins: byuWins,
                losses: byuLosses,
            } as TeamComparison;

            setByuData(byu);

            // Build comparison teams from static data + live records
            const comparisons: ComparisonTeam[] = [];
            COMPARISON_TEAM_NAMES.forEach(teamName => {
                const staticData = STATIC_TEAM_DATA[teamName];
                if (!staticData) return;

                const teamId = TEAM_IDS[teamName];
                const teamRecord = teamRecordsById[teamId] || '0-0';
                const recordMatch = teamRecord.match(/(\d+)-(\d+)/);
                const wins = recordMatch ? parseInt(recordMatch[1]) : 0;
                const losses = recordMatch ? parseInt(recordMatch[2]) : 0;

                const team: TeamComparison = {
                    ...staticData,
                    record: teamRecord,
                    wins,
                    losses,
                } as TeamComparison;

                // Generate comparison metrics
                const metrics = generateComparisonMetrics(byu, team);
                comparisons.push({ team, metrics });
            });

            // Sort by rank
            comparisons.sort((a, b) => a.team.rank - b.team.rank);

            setComparisonTeams(comparisons);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (err) {
            console.error('Error fetching team data:', err);
            setLoading(false);
        }
    };

    // Generate comparison metrics between BYU and another team
    const generateComparisonMetrics = (byu: TeamComparison, team: TeamComparison): ComparisonMetric[] => {
        const metrics: ComparisonMetric[] = [];

        // Losses comparison
        if (team.losses > byu.losses) {
            metrics.push({
                metric: 'Losses',
                byuValue: byu.losses,
                teamValue: team.losses,
                unit: 'Fewer is better'
            });
        } else if (team.losses < byu.losses) {
            metrics.push({
                metric: 'Losses',
                byuValue: byu.losses,
                teamValue: team.losses,
                unit: 'Fewer is better'
            });
        } else {
            metrics.push({
                metric: 'Losses',
                byuValue: byu.losses,
                teamValue: team.losses,
                unit: ''
            });
        }

        // Total wins comparison
        if (byu.wins !== team.wins) {
            metrics.push({
                metric: 'Total Wins',
                byuValue: byu.wins,
                teamValue: team.wins,
                unit: 'More is better'
            });
        }

        // SOR comparison
        if (byu.sorRank && team.sorRank) {
            metrics.push({
                metric: 'Strength of Record (SOR)',
                byuValue: `#${byu.sorRank}`,
                teamValue: `#${team.sorRank}`,
                unit: 'Lower is better'
            });
        }

        // CCG appearance
        if (byu.confStatus.includes('CCG') && !team.confStatus.includes('CCG')) {
            metrics.push({
                metric: 'BYU CCG Appearance',
                byuValue: 'Yes (Big 12)',
                teamValue: 'No',
                unit: ''
            });
        }

        // FPI comparison (if available)
        if (byu.fpiRank && team.fpiRank) {
            metrics.push({
                metric: 'FPI Rank',
                byuValue: `#${byu.fpiRank}`,
                teamValue: `#${team.fpiRank}`,
                unit: 'Higher is worse'
            });
        }

        // CFP Rank comparison
        if (byu.rank !== team.rank) {
            metrics.push({
                metric: 'CFP Rank',
                byuValue: `#${byu.rank}`,
                teamValue: `#${team.rank}`,
                unit: 'Lower is better'
            });
        }

        // Quality of loss (if both have 1 loss)
        if (byu.losses === 1 && team.losses === 1) {
            // This would require game data - simplified for now
            metrics.push({
                metric: 'Quality of Loss',
                byuValue: 'to #5 Texas Tech',
                teamValue: `to #${team.rank + 5} Opponent`,
                unit: 'Higher ranked loss is better'
            });
        }

        // Bad loss check (if team has 3 losses)
        if (team.losses >= 3) {
            metrics.push({
                metric: 'Bad Loss?',
                byuValue: 'No (Loss to #5 Tech)',
                teamValue: 'Yes',
                unit: 'No bad losses is better'
            });
        }

        return metrics.slice(0, 3); // Limit to 3 metrics per comparison
    };

    // Determine if BYU is better for a metric
    const isByuBetter = (metric: ComparisonMetric): boolean => {
        const { metric: metricName, byuValue, teamValue } = metric;

        // String-based comparisons
        if (metricName.includes('CCG Appearance')) {
            return String(byuValue).startsWith('Yes') && String(teamValue).startsWith('No');
        }

        if (metricName.includes('Bad Loss')) {
            return String(byuValue).startsWith('No');
        }

        // Numeric comparisons
        const cleanByu = parseFloat(String(byuValue).replace(/[^0-9.-]/g, ''));
        const cleanTeam = parseFloat(String(teamValue).replace(/[^0-9.-]/g, ''));

        if (isNaN(cleanByu) || isNaN(cleanTeam)) {
            return false;
        }

        // Lower is better for: Losses, SOR, FPI Rank, CFP Rank
        if (metricName.includes('Losses') || metricName.includes('SOR') || 
            metricName.includes('FPI Rank') || metricName.includes('CFP Rank')) {
            return cleanByu < cleanTeam;
        }

        // Higher is better for: Wins, Margin, Score
        return cleanByu > cleanTeam;
    };

    useEffect(() => {
        fetchTeamData();
        
        // Refresh every 30 seconds
        const interval = setInterval(() => {
            fetchTeamData();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    if (loading && !byuData) {
        return (
            <div className="min-h-screen bg-[#002E5D] flex items-center justify-center">
                <div className="text-white text-xl">Loading comparison data...</div>
            </div>
        );
    }

    if (!byuData) {
        return (
            <div className="min-h-screen bg-[#002E5D] flex items-center justify-center">
                <div className="text-white text-xl">Unable to load BYU data</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#002E5D] text-white p-4 sm:p-8 md:p-12">
            {/* Header */}
            <header className="text-center mb-10 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-white/90 hover:text-white transition-colors font-semibold"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">Back</span>
                    </Link>
                    <button
                        onClick={fetchTeamData}
                        className="p-2.5 bg-[#0047BA]/30 hover:bg-[#0047BA]/50 rounded-lg backdrop-blur-xl transition-all border border-[#0047BA]/50"
                        title="Refresh data"
                    >
                        <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-3 leading-tight text-white tracking-tight">
                    THE 11-1 ARGUMENT
                </h1>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-light text-white/95 mb-5">
                    9 Reasons Why BYU Belongs
                </h2>
                <p className="text-sm md:text-base text-white/80 italic mb-2">
                    Data Snapshot: Final Regular Season Rankings (Pre-Conference Championship Games)
                </p>
                <p className="text-xs text-white/70 font-medium">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
            </header>

            {/* BYU Summary Card */}
            <section className="mb-12 p-8 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl max-w-5xl mx-auto">
                <h3 className="text-2xl font-black text-white mb-6 text-center tracking-tight">
                    BYU COUGARS (#{byuData.rank}, {byuData.record}) - The Undeniable Resume
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 text-center">
                    <div className="p-5 bg-[#0047BA]/20 backdrop-blur-md rounded-2xl border border-[#0047BA]/30 shadow-lg hover:bg-[#0047BA]/30 transition-all">
                        <p className="text-4xl font-black text-white mb-2">{byuData.record}</p>
                        <p className="text-xs uppercase font-bold text-white/90 tracking-wider">Final Record</p>
                    </div>
                    <div className="p-5 bg-[#0047BA]/20 backdrop-blur-md rounded-2xl border border-[#0047BA]/30 shadow-lg hover:bg-[#0047BA]/30 transition-all">
                        <p className="text-4xl font-black text-white mb-2">
                            {byuData.sorRank ? `#${byuData.sorRank}` : 'N/A'}
                        </p>
                        <p className="text-xs uppercase font-bold text-white/90 tracking-wider">Strength of Record</p>
                    </div>
                    <div className="p-5 bg-[#0047BA]/20 backdrop-blur-md rounded-2xl border border-[#0047BA]/30 shadow-lg hover:bg-[#0047BA]/30 transition-all">
                        <p className="text-4xl font-black text-white mb-2">CCG</p>
                        <p className="text-xs uppercase font-bold text-white/90 tracking-wider">Big 12 Berth</p>
                    </div>
                    <div className="p-5 bg-[#0047BA]/20 backdrop-blur-md rounded-2xl border border-[#0047BA]/30 shadow-lg hover:bg-[#0047BA]/30 transition-all">
                        <p className="text-4xl font-black text-white mb-2">2</p>
                        <p className="text-xs uppercase font-bold text-white/90 tracking-wider">Top 25 Wins</p>
                    </div>
                </div>
            </section>

            {/* Comparison Cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {comparisonTeams.map((comparison, idx) => {
                    const { team, metrics } = comparison;
                    return (
                        <div
                            key={`${team.name}-${idx}`}
                            className="bg-white/5 backdrop-blur-2xl rounded-3xl border-t-4 border-[#0047BA] shadow-2xl overflow-hidden hover:bg-white/8 transition-all"
                        >
                            {/* Header */}
                            <div className="flex flex-col text-center font-bold text-lg p-5 bg-[#0047BA]/10 backdrop-blur-md border-b border-white/10">
                                <div className="flex justify-between w-full items-center">
                                    <div className="w-1/3 flex flex-col items-center">
                                        {/* BYU Logo */}
                                        {byuData.logo && (
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 mb-2 bg-white rounded-full p-2 shadow-lg border-2 border-[#0047BA]">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img 
                                                    src={byuData.logo} 
                                                    alt="BYU" 
                                                    className="w-full h-full object-contain rounded-full"
                                                />
                                            </div>
                                        )}
                                        <div className="text-[#0047BA] font-black">
                                            BYU
                                            <p className="text-sm font-bold text-white mt-1">#{byuData.rank}</p>
                                            <p className="text-xs text-white/70 mt-0.5 font-normal">Big 12</p>
                                        </div>
                                    </div>
                                    <div className="w-1/3 text-white/80 flex items-center justify-center font-semibold text-sm">VS</div>
                                    <div className="w-1/3 flex flex-col items-center">
                                        {/* Opponent Logo */}
                                        {team.logo && (
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 mb-2 bg-white rounded-full p-2 shadow-lg border-2 border-white/30">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img 
                                                    src={team.logo} 
                                                    alt={team.shortName} 
                                                    className="w-full h-full object-contain rounded-full"
                                                />
                                            </div>
                                        )}
                                        <div className="text-white font-black">
                                            {team.shortName}
                                            <p className="text-sm font-bold mt-1">#{team.rank}</p>
                                            <p className="text-xs text-white/70 mt-0.5 font-normal">{team.conference}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Record Row */}
                            <div className="flex text-center text-sm p-4 bg-white/3 border-b border-white/10">
                                <div className="w-1/3 text-[#10b981] font-black text-base">{byuData.record}</div>
                                <div className="w-1/3 text-white/70 font-medium italic">Record</div>
                                <div className="w-1/3 text-[#ef4444] font-black text-base">{team.record}</div>
                            </div>

                            {/* Metrics */}
                            <div className="p-5 space-y-3">
                                {metrics.map((metric, metricIdx) => {
                                    const byuBetter = isByuBetter(metric);
                                    return (
                                        <div
                                            key={metricIdx}
                                            className="flex justify-between items-center py-3 border-b border-white/5 last:border-b-0"
                                        >
                                            {/* BYU Value */}
                                            <span
                                                className={`w-1/3 text-center font-black text-lg transition-all duration-300 px-2 py-1.5 rounded-lg ${
                                                    byuBetter
                                                        ? 'text-[#10b981] bg-[#10b981]/20 border border-[#10b981]/30'
                                                        : 'text-white/50'
                                                }`}
                                            >
                                                {metric.byuValue}
                                            </span>

                                            {/* Metric Label */}
                                            <span className="font-bold text-white/90 w-1/3 text-center text-xs sm:text-sm px-2">
                                                {metric.metric}
                                            </span>

                                            {/* Opponent Value */}
                                            <span
                                                className={`w-1/3 text-center font-black text-lg transition-all duration-300 px-2 py-1.5 rounded-lg ${
                                                    !byuBetter
                                                        ? 'text-[#ef4444] bg-[#ef4444]/20 border border-[#ef4444]/30'
                                                        : 'text-white/50'
                                                }`}
                                            >
                                                {metric.teamValue}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* Footer */}
            <footer className="text-center mt-16 mb-8 text-white/70 text-sm font-medium">
                <p>Created to argue the mathematical case for BYU's inclusion in the 2025-2026 College Football Playoff.</p>
            </footer>
        </div>
    );
};

export default PlayoffsPage;

