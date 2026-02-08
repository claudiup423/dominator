'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sessions } from '@/lib/api';
import { Card, HUDPanel, HeroCard } from '@/components/ui/Card';
import { SectionHeader, DifficultyBadge } from '@/components/ui/Badge';
import { DifficultySlider } from '@/components/ui/Controls';
import { Shield, Target, TrendingUp, Swords, Play, ChevronRight, Gauge, Users } from 'lucide-react';
import { cn, difficultyColor } from '@/lib/utils';
import type { TrainingSession } from '@/types';

const MODES = [
  { value: 'defense', label: 'Defense', icon: Shield, emoji: '🛡️', color: '#3B82F6',
    desc: 'Shadow defense, rotations, recovery', tips: 'Track the ball carrier · Rotate back post · Recover fast' },
  { value: 'shooting', label: 'Shooting', icon: Target, emoji: '🎯', color: '#EF4444',
    desc: 'Shot placement, power shots, redirects', tips: 'Aim corners · Time your flips · Read the bounce' },
  { value: 'possession', label: 'Possession', icon: TrendingUp, emoji: '⚽', color: '#22C55E',
    desc: 'Ball control, dribbling, boost management', tips: 'Keep the ball close · Manage boost · Shield the ball' },
  { value: '50/50s', label: '50/50s', icon: Swords, emoji: '⚔️', color: '#F59E0B',
    desc: 'Challenge timing, positioning, recoveries', tips: 'Nose to ball · Read their flip · Recover after' },
];

const STYLES = [
  { value: 'passive', label: 'Passive', emoji: '🐢', desc: 'Patient, waits for mistakes, predictable clears',
    detail: 'Great for practicing control and setup plays' },
  { value: 'aggro', label: 'Aggro', emoji: '🔥', desc: 'High pressure, fast challenges, relentless',
    detail: 'Tests your speed and decision-making' },
  { value: 'counter', label: 'Counter', emoji: '🧠', desc: 'Baits, fakes, punishes over-commits',
    detail: 'Tests patience and game sense' },
];

export default function TrainPage() {
  const router = useRouter();
  const [mode, setMode] = useState('defense');
  const [difficulty, setDifficulty] = useState('gold');
  const [opponentStyle, setOpponentStyle] = useState('passive');
  const [starting, setStarting] = useState(false);

  const selectedMode = MODES.find(m => m.value === mode)!;

  const handleStart = async () => {
    setStarting(true);
    try {
      const session = await sessions.start({ mode, difficulty, opponent_style: opponentStyle }) as TrainingSession;
      router.push(`/session/${session.id}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Configure Session</h1>
        <p className="text-sm text-dom-muted mt-1">Choose your mode, difficulty, and opponent. Then hit the field.</p>
      </div>

      {/* Step 1: Mode */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-dom-accent/20 flex items-center justify-center text-xs font-bold text-dom-accent">1</div>
          <SectionHeader className="!mb-0">Training Mode</SectionHeader>
        </div>
        <div className="grid grid-cols-2 gap-4 stagger">
          {MODES.map((m) => (
            <div
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn('mode-card p-5 animate-slide-up', mode === m.value && 'selected')}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: `${m.color}12`, border: `1px solid ${m.color}30` }}
                >
                  {m.emoji}
                </div>
                {mode === m.value && (
                  <div className="w-5 h-5 rounded-full bg-dom-accent flex items-center justify-center">
                    <svg className="w-3 h-3 text-dom-base" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="font-display font-bold text-dom-heading text-lg">{m.label}</div>
              <div className="text-xs text-dom-muted mt-1 leading-relaxed">{m.desc}</div>
              {mode === m.value && (
                <div className="mt-3 pt-3 border-t border-dom-border/50">
                  <div className="text-[10px] text-dom-accent uppercase tracking-wider font-semibold">Tips</div>
                  <div className="text-xs text-dom-muted mt-1">{m.tips}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Difficulty */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-dom-accent/20 flex items-center justify-center text-xs font-bold text-dom-accent">2</div>
          <SectionHeader className="!mb-0">Difficulty</SectionHeader>
        </div>
        <Card className="!p-6">
          <DifficultySlider value={difficulty} onChange={setDifficulty} />
        </Card>
      </div>

      {/* Step 3: Opponent Style */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-dom-accent/20 flex items-center justify-center text-xs font-bold text-dom-accent">3</div>
          <SectionHeader className="!mb-0">Opponent Style</SectionHeader>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {STYLES.map((s) => (
            <div
              key={s.value}
              onClick={() => setOpponentStyle(s.value)}
              className={cn('style-card', opponentStyle === s.value && 'selected')}
            >
              <div className="text-3xl mb-3">{s.emoji}</div>
              <div className="font-display font-bold text-dom-heading">{s.label}</div>
              <div className="text-xs text-dom-muted mt-1">{s.desc}</div>
              {opponentStyle === s.value && (
                <div className="mt-3 pt-2 border-t border-dom-border/50 text-[10px] text-dom-accent">{s.detail}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Launch */}
      <HUDPanel accent={difficultyColor(difficulty)} className="!p-7">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold">Session Config</div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl">{selectedMode.emoji}</span>
              <span className="text-lg font-display font-bold text-dom-heading capitalize">{mode}</span>
              <span className="text-dom-muted">·</span>
              <DifficultyBadge difficulty={difficulty} />
              <span className="text-dom-muted">·</span>
              <span className="text-sm text-dom-text capitalize flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-dom-muted" />
                {opponentStyle}
              </span>
            </div>
          </div>
          <button onClick={handleStart} disabled={starting} className="btn-primary-xl group">
            <Play className="w-5 h-5" />
            {starting ? 'Loading...' : 'Launch'}
            {!starting && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
          </button>
        </div>
      </HUDPanel>
    </div>
  );
}
