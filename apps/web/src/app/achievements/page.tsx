'use client';

import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/lib/api';
import { Card, HUDPanel, HeroCard, GlowCard } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/Badge';
import { cn, difficultyColor } from '@/lib/utils';
import { Trophy, Lock } from 'lucide-react';
import type { TrainingSession } from '@/types';

interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  category: 'combat' | 'mastery' | 'grind' | 'special';
  target: number;
  getValue: (sessions: TrainingSession[]) => number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const ACHIEVEMENTS: Achievement[] = [
  // Combat
  { id: 'first_win', name: 'First Blood', desc: 'Win your first session', emoji: '⚔️', category: 'combat', target: 1, rarity: 'common',
    getValue: (s) => s.filter(x => (x.score_json?.player || 0) > (x.score_json?.opponent || 0)).length },
  { id: 'ten_wins', name: 'Rising Star', desc: 'Win 10 sessions', emoji: '⭐', category: 'combat', target: 10, rarity: 'common',
    getValue: (s) => s.filter(x => (x.score_json?.player || 0) > (x.score_json?.opponent || 0)).length },
  { id: 'fifty_wins', name: 'Dominator', desc: 'Win 50 sessions', emoji: '👑', category: 'combat', target: 50, rarity: 'rare',
    getValue: (s) => s.filter(x => (x.score_json?.player || 0) > (x.score_json?.opponent || 0)).length },
  { id: 'shutout', name: 'Clean Sheet', desc: 'Win without conceding a goal', emoji: '🧤', category: 'combat', target: 1, rarity: 'rare',
    getValue: (s) => s.filter(x => (x.score_json?.player || 0) > 0 && (x.score_json?.opponent || 0) === 0).length },
  { id: 'comeback', name: 'Comeback King', desc: 'Score 5+ goals in a single session', emoji: '🔥', category: 'combat', target: 1, rarity: 'epic',
    getValue: (s) => s.filter(x => (x.score_json?.player || 0) >= 5).length },

  // Mastery
  { id: 'defense_master', name: 'Wall of Steel', desc: 'Complete 20 defense sessions', emoji: '🛡️', category: 'mastery', target: 20, rarity: 'rare',
    getValue: (s) => s.filter(x => x.mode === 'defense').length },
  { id: 'shooting_master', name: 'Sharpshooter', desc: 'Complete 20 shooting sessions', emoji: '🎯', category: 'mastery', target: 20, rarity: 'rare',
    getValue: (s) => s.filter(x => x.mode === 'shooting').length },
  { id: 'possession_master', name: 'Ball Wizard', desc: 'Complete 20 possession sessions', emoji: '⚽', category: 'mastery', target: 20, rarity: 'rare',
    getValue: (s) => s.filter(x => x.mode === 'possession').length },
  { id: 'fifty_master', name: 'Challenger', desc: 'Complete 20 50/50 sessions', emoji: '⚔️', category: 'mastery', target: 20, rarity: 'rare',
    getValue: (s) => s.filter(x => x.mode === '50/50s').length },
  { id: 'all_modes', name: 'Well Rounded', desc: 'Play at least 5 sessions in every mode', emoji: '🌟', category: 'mastery', target: 4, rarity: 'epic',
    getValue: (s) => ['defense', 'shooting', 'possession', '50/50s'].filter(m => s.filter(x => x.mode === m).length >= 5).length },

  // Grind
  { id: 'sessions_10', name: 'Getting Started', desc: 'Complete 10 sessions', emoji: '🎮', category: 'grind', target: 10, rarity: 'common',
    getValue: (s) => s.length },
  { id: 'sessions_50', name: 'Dedicated', desc: 'Complete 50 sessions', emoji: '💪', category: 'grind', target: 50, rarity: 'rare',
    getValue: (s) => s.length },
  { id: 'sessions_100', name: 'No Life', desc: 'Complete 100 sessions', emoji: '🤖', category: 'grind', target: 100, rarity: 'epic',
    getValue: (s) => s.length },
  { id: 'goals_100', name: 'Century', desc: 'Score 100 total goals', emoji: '💯', category: 'grind', target: 100, rarity: 'epic',
    getValue: (s) => s.reduce((sum, x) => sum + (x.score_json?.player || 0), 0) },

  // Special
  { id: 'demon_win', name: 'Demon Slayer', desc: 'Win on Demon difficulty', emoji: '👹', category: 'special', target: 1, rarity: 'legendary',
    getValue: (s) => s.filter(x => x.difficulty === 'demon' && (x.score_json?.player || 0) > (x.score_json?.opponent || 0)).length },
  { id: 'aggro_win', name: 'Pressure Proof', desc: 'Beat an Aggro opponent', emoji: '🧊', category: 'special', target: 1, rarity: 'rare',
    getValue: (s) => s.filter(x => x.opponent_style === 'aggro' && (x.score_json?.player || 0) > (x.score_json?.opponent || 0)).length },
  { id: 'counter_win', name: 'Outplayed', desc: 'Beat a Counter opponent', emoji: '🧠', category: 'special', target: 1, rarity: 'epic',
    getValue: (s) => s.filter(x => x.opponent_style === 'counter' && (x.score_json?.player || 0) > (x.score_json?.opponent || 0)).length },
];

const RARITY_CONFIG = {
  common: { color: '#9CA3AF', label: 'Common', border: 'border-gray-500/20', bg: 'bg-gray-500/5' },
  rare: { color: '#3B82F6', label: 'Rare', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
  epic: { color: '#A855F7', label: 'Epic', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
  legendary: { color: '#F59E0B', label: 'Legendary', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  combat: { label: 'Combat', emoji: '⚔️' },
  mastery: { label: 'Mastery', emoji: '🎓' },
  grind: { label: 'Grind', emoji: '💪' },
  special: { label: 'Special', emoji: '✨' },
};

export default function AchievementsPage() {
  const { data: sessionList } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessions.list() as Promise<TrainingSession[]>,
  });

  const allSessions = sessionList || [];
  const achievementStates = ACHIEVEMENTS.map(a => {
    const current = a.getValue(allSessions);
    const unlocked = current >= a.target;
    const progress = Math.min(1, current / a.target);
    return { ...a, current, unlocked, progress };
  });

  const unlockedCount = achievementStates.filter(a => a.unlocked).length;
  const totalCount = achievementStates.length;

  const categories = ['combat', 'mastery', 'grind', 'special'] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Achievements</h1>
        <p className="text-sm text-dom-muted mt-1">Unlock badges, track milestones, and prove your dominance.</p>
      </div>

      {/* Summary */}
      <HUDPanel accent="#F59E0B" className="!p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div>
              <div className="text-3xl font-display font-black text-dom-heading">
                {unlockedCount} <span className="text-lg text-dom-muted font-normal">/ {totalCount}</span>
              </div>
              <div className="text-sm text-dom-muted">Achievements Unlocked</div>
            </div>
          </div>
          <div className="w-64">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-dom-muted">Progress</span>
              <span className="text-dom-yellow font-semibold">{Math.round((unlockedCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-3 bg-dom-elevated rounded-full overflow-hidden border border-dom-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </HUDPanel>

      {/* Rarity breakdown */}
      <div className="grid grid-cols-4 gap-3">
        {(['common', 'rare', 'epic', 'legendary'] as const).map(rarity => {
          const total = achievementStates.filter(a => a.rarity === rarity).length;
          const unlocked = achievementStates.filter(a => a.rarity === rarity && a.unlocked).length;
          const rc = RARITY_CONFIG[rarity];
          return (
            <Card key={rarity} className="text-center py-3">
              <div className="text-xl font-display font-black" style={{ color: rc.color }}>{unlocked}/{total}</div>
              <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: rc.color }}>{rc.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Achievement Grid by Category */}
      {categories.map(cat => {
        const catAchievements = achievementStates.filter(a => a.category === cat);
        const catInfo = CATEGORY_LABELS[cat];
        return (
          <div key={cat} className="space-y-3">
            <SectionHeader>{catInfo.emoji} {catInfo.label}</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              {catAchievements.map(a => {
                const rc = RARITY_CONFIG[a.rarity];
                return (
                  <Card
                    key={a.id}
                    className={cn(
                      'flex items-start gap-4 transition-all duration-200',
                      a.unlocked ? rc.border : 'opacity-60 border-dom-border',
                      a.unlocked && rc.bg,
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border',
                      a.unlocked ? rc.border : 'border-dom-border bg-dom-elevated',
                    )} style={a.unlocked ? { background: `${rc.color}15` } : {}}>
                      {a.unlocked ? a.emoji : <Lock className="w-5 h-5 text-dom-muted" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-display font-bold', a.unlocked ? 'text-dom-heading' : 'text-dom-muted')}>
                          {a.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: rc.color, background: `${rc.color}15` }}>
                          {rc.label}
                        </span>
                      </div>
                      <div className="text-xs text-dom-muted mt-0.5">{a.desc}</div>

                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-dom-muted">{a.current} / {a.target}</span>
                          {a.unlocked && <span style={{ color: rc.color }}>✓ Unlocked</span>}
                        </div>
                        <div className="h-1.5 bg-dom-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${a.progress * 100}%`,
                              background: a.unlocked ? rc.color : '#4B5563',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
