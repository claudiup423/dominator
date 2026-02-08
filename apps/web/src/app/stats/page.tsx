'use client';

import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/lib/api';
import { Card, HUDPanel, HeroCard, GlowCard } from '@/components/ui/Card';
import { DifficultyBadge, SectionHeader, BigStat } from '@/components/ui/Badge';
import { formatPercent, cn, difficultyColor } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { TrendingUp, Flame, Shield, Target, Swords, Zap, Award } from 'lucide-react';
import type { TrainingSession } from '@/types';

const RANKS = ['bronze', 'silver', 'gold', 'plat', 'diamond', 'champ', 'demon'] as const;
const RANK_XP = [0, 500, 1500, 3500, 7000, 12000, 20000];
const RANK_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', plat: '💎', diamond: '💠', champ: '🏆', demon: '👹',
};

function getPlayerRank(xp: number) {
  for (let i = RANK_XP.length - 1; i >= 0; i--) {
    if (xp >= RANK_XP[i]) {
      const current = RANKS[i];
      const next = RANKS[i + 1] || null;
      const nextXp = RANK_XP[i + 1] || RANK_XP[i];
      const progress = next ? (xp - RANK_XP[i]) / (nextXp - RANK_XP[i]) : 1;
      return { rank: current, nextRank: next, xp, xpForNext: nextXp, progress };
    }
  }
  return { rank: 'bronze', nextRank: 'silver', xp, xpForNext: 500, progress: xp / 500 };
}

export default function StatsPage() {
  const { data: sessionList } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessions.list() as Promise<TrainingSession[]>,
  });

  const allSessions = sessionList || [];
  const wins = allSessions.filter(s => (s.score_json?.player || 0) > (s.score_json?.opponent || 0));
  const losses = allSessions.filter(s => (s.score_json?.player || 0) < (s.score_json?.opponent || 0));
  const draws = allSessions.filter(s => (s.score_json?.player || 0) === (s.score_json?.opponent || 0));
  const totalGoalsFor = allSessions.reduce((sum, s) => sum + (s.score_json?.player || 0), 0);
  const totalGoalsAgainst = allSessions.reduce((sum, s) => sum + (s.score_json?.opponent || 0), 0);

  // Calculate XP: 100 per win, 30 per loss, 50 per draw, +20 per goal
  const xp = wins.length * 100 + losses.length * 30 + draws.length * 50 + totalGoalsFor * 20;
  const rankInfo = getPlayerRank(xp);

  // Win streak
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  for (const s of [...allSessions].reverse()) {
    if ((s.score_json?.player || 0) > (s.score_json?.opponent || 0)) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  currentStreak = tempStreak;

  // Per-mode stats
  const modes = ['defense', 'shooting', 'possession', '50/50s'];
  const modeStats = modes.map(mode => {
    const modeSessions = allSessions.filter(s => s.mode === mode);
    const modeWins = modeSessions.filter(s => (s.score_json?.player || 0) > (s.score_json?.opponent || 0));
    return {
      mode,
      played: modeSessions.length,
      winRate: modeSessions.length > 0 ? modeWins.length / modeSessions.length : 0,
      goalsFor: modeSessions.reduce((sum, s) => sum + (s.score_json?.player || 0), 0),
    };
  });

  const radarData = modeStats.map(m => ({
    subject: m.mode.charAt(0).toUpperCase() + m.mode.slice(1),
    value: Math.round(m.winRate * 100),
    fullMark: 100,
  }));

  // XP progression over sessions (simulated timeline)
  const xpProgression = allSessions.slice().reverse().reduce((acc: { session: number; xp: number }[], s, i) => {
    const isWin = (s.score_json?.player || 0) > (s.score_json?.opponent || 0);
    const gained = isWin ? 100 + (s.score_json?.player || 0) * 20 : 30 + (s.score_json?.player || 0) * 20;
    const prevXp = acc.length > 0 ? acc[acc.length - 1].xp : 0;
    acc.push({ session: i + 1, xp: prevXp + gained });
    return acc;
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Your Stats</h1>
        <p className="text-sm text-dom-muted mt-1">Track your progress, rank, and performance across all modes.</p>
      </div>

      {/* Rank & XP Hero */}
      <HeroCard className="!p-0 overflow-hidden">
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Rank emblem */}
            <div className="relative">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl border-2"
                style={{
                  borderColor: difficultyColor(rankInfo.rank),
                  background: `${difficultyColor(rankInfo.rank)}15`,
                  boxShadow: `0 0 30px ${difficultyColor(rankInfo.rank)}30`,
                }}
              >
                {RANK_ICONS[rankInfo.rank]}
              </div>
            </div>
            <div>
              <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-1">Current Rank</div>
              <div
                className="text-3xl font-display font-black uppercase tracking-wider"
                style={{ color: difficultyColor(rankInfo.rank) }}
              >
                {rankInfo.rank}
              </div>
              <div className="text-sm text-dom-muted mt-1">{rankInfo.xp.toLocaleString()} XP</div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="w-80">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-dom-muted">
                {RANK_ICONS[rankInfo.rank]} {rankInfo.rank.toUpperCase()}
              </span>
              {rankInfo.nextRank && (
                <span style={{ color: difficultyColor(rankInfo.nextRank) }}>
                  {RANK_ICONS[rankInfo.nextRank]} {rankInfo.nextRank.toUpperCase()}
                </span>
              )}
            </div>
            <div className="h-4 bg-dom-elevated rounded-full overflow-hidden border border-dom-border">
              <div
                className="h-full rounded-full transition-all duration-500 relative"
                style={{
                  width: `${Math.min(100, rankInfo.progress * 100)}%`,
                  background: `linear-gradient(90deg, ${difficultyColor(rankInfo.rank)}, ${difficultyColor(rankInfo.nextRank || rankInfo.rank)})`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            <div className="text-xs text-dom-muted mt-1.5 text-right">
              {rankInfo.nextRank ? `${(rankInfo.xpForNext - rankInfo.xp).toLocaleString()} XP to ${rankInfo.nextRank}` : 'Max rank reached! 👹'}
            </div>
          </div>
        </div>
      </HeroCard>

      {/* Key Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Played', value: allSessions.length, emoji: '🎮', color: '#00D4FF' },
          { label: 'Wins', value: wins.length, emoji: '🏆', color: '#22C55E' },
          { label: 'Win Rate', value: allSessions.length > 0 ? `${Math.round((wins.length / allSessions.length) * 100)}%` : '—', emoji: '📈', color: '#F59E0B' },
          { label: 'Win Streak', value: `🔥 ${currentStreak}`, emoji: '', color: '#EF4444' },
          { label: 'Best Streak', value: `⚡ ${bestStreak}`, emoji: '', color: '#A855F7' },
        ].map(stat => (
          <Card key={stat.label} className="text-center py-4">
            {stat.emoji && <div className="text-2xl mb-1">{stat.emoji}</div>}
            <div className="text-2xl font-display font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] text-dom-muted uppercase tracking-wider mt-1">{stat.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Per-Mode Radar */}
        <div className="space-y-3">
          <SectionHeader>Mode Performance</SectionHeader>
          <Card className="!p-4">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1E2433" />
                <PolarAngleAxis dataKey="subject" stroke="#6B7280" fontSize={12} />
                <PolarRadiusAxis stroke="#1E2433" fontSize={10} domain={[0, 100]} />
                <Radar name="Win Rate" dataKey="value" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* XP Progression */}
        <div className="space-y-3">
          <SectionHeader>XP Progression</SectionHeader>
          <Card className="!p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={xpProgression} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                <XAxis dataKey="session" stroke="#6B7280" fontSize={10} label={{ value: 'Session #', position: 'insideBottom', offset: -2, style: { fill: '#6B7280', fontSize: 10 } }} />
                <YAxis stroke="#6B7280" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#111522', border: '1px solid #252B3B', borderRadius: '10px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="xp" stroke="#00D4FF" strokeWidth={2} fill="url(#xpGrad)" name="Total XP" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Per-Mode Breakdown Table */}
      <div className="space-y-3">
        <SectionHeader>Mode Breakdown</SectionHeader>
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dom-border bg-dom-elevated/30">
                {['Mode', 'Played', 'Win Rate', 'Goals For', 'GF/Game'].map(h => (
                  <th key={h} className={`py-3 px-5 text-xs font-semibold text-dom-muted uppercase tracking-wider ${h === 'Mode' ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modeStats.map(m => {
                const modeEmojis: Record<string, string> = { defense: '🛡️', shooting: '🎯', possession: '⚽', '50/50s': '⚔️' };
                return (
                  <tr key={m.mode} className="border-b border-dom-border/30 hover:bg-dom-elevated/20">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{modeEmojis[m.mode] || '⚡'}</span>
                        <span className="font-medium text-dom-heading capitalize">{m.mode}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-dom-text">{m.played}</td>
                    <td className="py-3.5 px-5 text-right">
                      <span className={cn(
                        'font-mono font-semibold',
                        m.winRate >= 0.6 ? 'text-dom-green' : m.winRate >= 0.4 ? 'text-dom-yellow' : 'text-dom-red'
                      )}>
                        {m.played > 0 ? `${Math.round(m.winRate * 100)}%` : '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-dom-text">{m.goalsFor}</td>
                    <td className="py-3.5 px-5 text-right font-mono text-dom-text">
                      {m.played > 0 ? (m.goalsFor / m.played).toFixed(1) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Goal Stats */}
      <div className="grid grid-cols-3 gap-4">
        <GlowCard color="#00D4FF">
          <BigStat value={totalGoalsFor} label="Goals Scored" color="text-dom-accent" glow />
        </GlowCard>
        <GlowCard color="#EF4444">
          <BigStat value={totalGoalsAgainst} label="Goals Conceded" color="text-dom-red" />
        </GlowCard>
        <GlowCard color="#22C55E">
          <BigStat
            value={totalGoalsAgainst > 0 ? `+${(totalGoalsFor - totalGoalsAgainst)}` : `+${totalGoalsFor}`}
            label="Goal Difference"
            color={totalGoalsFor >= totalGoalsAgainst ? 'text-dom-green' : 'text-dom-red'}
          />
        </GlowCard>
      </div>
    </div>
  );
}
