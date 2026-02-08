'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, HUDPanel, HeroCard, GlowCard } from '@/components/ui/Card';
import { DifficultyBadge, SectionHeader, BigStat } from '@/components/ui/Badge';
import { formatDate, formatDuration } from '@/lib/utils';
import {
  Crosshair, Clock, TrendingUp, Shield, Target, Swords, Zap,
  ArrowRight, Flame, Trophy, Gamepad2, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import type { TrainingSession } from '@/types';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { data: sessionList } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessions.list() as Promise<TrainingSession[]>,
    enabled: !!user,
  });

  if (authLoading) return <LoadingSkeleton />;
  if (!user) return <LoginPrompt />;

  const lastSession = sessionList?.[0];
  const totalSessions = sessionList?.length || 0;
  const wins = sessionList?.filter(s => (s.score_json?.player || 0) > (s.score_json?.opponent || 0)).length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero Banner */}
      <HeroCard className="!p-0 overflow-hidden">
        <div className="relative p-8 md:p-10">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-5">
            <Gamepad2 className="w-full h-full" strokeWidth={0.5} />
          </div>

          <div className="flex items-center justify-between relative">
            <div className="space-y-4 max-w-lg">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Ready to Dominate</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight leading-tight">
                Train. Adapt.<br />
                <span className="bg-gradient-to-r from-dom-accent via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  Dominate.
                </span>
              </h1>
              <p className="text-dom-muted text-sm leading-relaxed max-w-md">
                Face AI opponents that learn your weaknesses. Sharpen your defense, shooting, possession, and 50/50 game with real-time feedback.
              </p>
              <Link href="/train">
                <button className="btn-primary-xl mt-2 group">
                  <Crosshair className="w-5 h-5" />
                  Start Training
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>

            {/* Stats cluster */}
            <div className="hidden md:flex flex-col gap-4">
              <GlowCard color="#00D4FF" className="!p-4 w-44">
                <BigStat value={totalSessions} label="Sessions" color="text-dom-accent" glow />
              </GlowCard>
              <GlowCard color="#22C55E" className="!p-4 w-44">
                <BigStat value={`${wins}W`} label="Victories" color="text-dom-green" />
              </GlowCard>
            </div>
          </div>
        </div>
      </HeroCard>

      {/* Quick Stats (mobile) */}
      <div className="grid grid-cols-3 gap-3 md:hidden">
        <Card className="text-center py-4">
          <div className="text-2xl font-display font-bold text-dom-accent">{totalSessions}</div>
          <div className="text-[10px] text-dom-muted uppercase mt-1">Sessions</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-display font-bold text-dom-green">{wins}</div>
          <div className="text-[10px] text-dom-muted uppercase mt-1">Wins</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-display font-bold text-dom-yellow">
            {totalSessions > 0 ? Math.round((wins / totalSessions) * 100) : 0}%
          </div>
          <div className="text-[10px] text-dom-muted uppercase mt-1">Win Rate</div>
        </Card>
      </div>

      {/* Training Modes Quick Access */}
      <div className="space-y-4">
        <SectionHeader>Training Modes</SectionHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
          {[
            { mode: 'Defense', icon: Shield, color: '#3B82F6', desc: 'Shadow & Rotate', emoji: '🛡️' },
            { mode: 'Shooting', icon: Target, color: '#EF4444', desc: 'Accuracy & Power', emoji: '🎯' },
            { mode: 'Possession', icon: TrendingUp, color: '#22C55E', desc: 'Control & Dribble', emoji: '⚽' },
            { mode: '50/50s', icon: Swords, color: '#F59E0B', desc: 'Challenge & Win', emoji: '⚔️' },
          ].map(({ mode, icon: Icon, color, desc, emoji }) => (
            <Link key={mode} href="/train">
              <div className="mode-card p-5 group animate-slide-up">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                    >
                      {emoji}
                    </div>
                    <ChevronRight className="w-4 h-4 text-dom-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-dom-heading">{mode}</div>
                    <div className="text-xs text-dom-muted mt-0.5">{desc}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Last Session */}
      {lastSession && (
        <div className="space-y-4">
          <SectionHeader>Last Session</SectionHeader>
          <Link href={`/session/${lastSession.id}/summary`}>
            <HUDPanel accent={lastSession.score_json.player > lastSession.score_json.opponent ? '#22C55E' : '#EF4444'}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">
                    {lastSession.mode === 'defense' ? '🛡️' : lastSession.mode === 'shooting' ? '🎯' :
                     lastSession.mode === 'possession' ? '⚽' : '⚔️'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-dom-heading capitalize text-lg">{lastSession.mode}</span>
                      <DifficultyBadge difficulty={lastSession.difficulty} />
                    </div>
                    <div className="text-sm text-dom-muted mt-1">
                      {formatDate(lastSession.started_at)} · {formatDuration(lastSession.started_at, lastSession.ended_at)} · vs {lastSession.opponent_style}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-3xl font-display font-black">
                      <span className="text-dom-accent">{lastSession.score_json.player ?? 0}</span>
                      <span className="text-dom-muted mx-2 text-xl">–</span>
                      <span className="text-dom-red">{lastSession.score_json.opponent ?? 0}</span>
                    </div>
                    <div className="text-xs mt-1">
                      {(lastSession.score_json.player ?? 0) > (lastSession.score_json.opponent ?? 0) ? (
                        <span className="text-dom-green font-semibold flex items-center gap-1 justify-end"><Trophy className="w-3 h-3" /> Victory</span>
                      ) : (
                        <span className="text-dom-red font-semibold">Defeat</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-dom-muted" />
                </div>
              </div>
            </HUDPanel>
          </Link>
        </div>
      )}

      {/* Focus This Week */}
      <div className="space-y-4">
        <SectionHeader>Focus This Week</SectionHeader>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Last-man discipline', icon: Shield, color: '#3B82F6', progress: 72 },
            { label: 'Kickoff reads', icon: Zap, color: '#F59E0B', progress: 58 },
            { label: 'Shot quality', icon: Target, color: '#22C55E', progress: 85 },
          ].map((item) => (
            <Card key={item.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
                <span className="text-sm font-medium text-dom-text">{item.label}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-dom-muted">Progress</span>
                  <span className="font-semibold" style={{ color: item.color }}>{item.progress}%</span>
                </div>
                <div className="h-1.5 bg-dom-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.progress}%`, background: item.color }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent History */}
      {sessionList && sessionList.length > 1 && (
        <div className="space-y-4">
          <SectionHeader>Recent History</SectionHeader>
          <Card className="!p-0 overflow-hidden">
            {sessionList.slice(1, 6).map((s: TrainingSession, i: number) => {
              const isWin = (s.score_json?.player || 0) > (s.score_json?.opponent || 0);
              return (
                <Link key={s.id} href={`/session/${s.id}/summary`}>
                  <div className={cn(
                    'flex items-center justify-between py-3 px-5 hover:bg-dom-elevated/50 transition-colors cursor-pointer',
                    i > 0 && 'border-t border-dom-border/50'
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-1 h-8 rounded-full',
                        isWin ? 'bg-dom-green' : 'bg-dom-red'
                      )} />
                      <span className="text-sm capitalize text-dom-text font-medium w-24">{s.mode}</span>
                      <DifficultyBadge difficulty={s.difficulty} />
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-mono font-bold text-dom-heading">
                        {s.score_json?.player ?? 0}–{s.score_json?.opponent ?? 0}
                      </span>
                      <span className="text-xs text-dom-muted w-28 text-right">{formatDate(s.started_at)}</span>
                      <ChevronRight className="w-4 h-4 text-dom-muted" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-64 bg-dom-surface rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-dom-surface rounded-xl" />)}
      </div>
    </div>
  );
}

function LoginPrompt() {
  return <div className="max-w-md mx-auto mt-16"><LoginForm /></div>;
}

function LoginForm() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      isRegister ? await register(email, password) : await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed');
    }
  };

  return (
    <HeroCard className="space-y-6 !p-8">
      <div className="text-center space-y-3">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-dom-accent via-cyan-400 to-blue-600 flex items-center justify-center mx-auto shadow-glow-accent">
          <Zap className="w-8 h-8 text-white" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
        </div>
        <h2 className="text-2xl font-display font-black">DOMINATOR</h2>
        <p className="text-sm text-dom-muted">Sign in to start your training</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" required minLength={6} />
        {error && <p className="text-sm text-dom-red text-center">{error}</p>}
        <button type="submit" className="btn-primary w-full py-3">
          {isRegister ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-dom-accent hover:underline w-full text-center">
        {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
      </button>

      <div className="border-t border-dom-border pt-4">
        <p className="text-xs text-dom-muted text-center">
          Demo accounts: <code className="text-dom-accent">admin@dominator.gg</code> / <code className="text-dom-accent">admin123</code>
          <br />or <code className="text-dom-accent">player@dominator.gg</code> / <code className="text-dom-accent">player123</code>
        </p>
      </div>
    </HeroCard>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
