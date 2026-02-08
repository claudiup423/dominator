'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/lib/api';
import { HUDPanel } from '@/components/ui/Card';
import { DifficultyBadge, Badge, BigStat } from '@/components/ui/Badge';
import { Bookmark, Wifi, WifiOff, Square, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrainingSession } from '@/types';

const MODE_EMOJI: Record<string, string> = {
  defense: '🛡️', shooting: '🎯', possession: '⚽', '50/50s': '⚔️',
};

export default function LiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const [elapsed, setElapsed] = useState(0);
  const [events, setEvents] = useState<{ t: number; type: string; id: number }[]>([]);
  const [connected] = useState(true);
  const startRef = useRef(Date.now());
  const evtId = useRef(0);

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessions.get(sessionId) as Promise<TrainingSession>,
  });

  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const types = ['save', 'shot', 'boost_pickup', 'demo', 'aerial', 'clear'];
      const type = types[Math.floor(Math.random() * types.length)];
      evtId.current++;
      setEvents(prev => [...prev.slice(-30), { t: elapsed, type, id: evtId.current }]);
    }, 2500 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [elapsed]);

  const handleBookmark = useCallback(async () => {
    evtId.current++;
    setEvents(prev => [...prev, { t: elapsed, type: 'bookmark', id: evtId.current }]);
    await sessions.addEvent(sessionId, { t_ms: elapsed * 1000, type: 'bookmark', payload_json: {} });
  }, [sessionId, elapsed]);

  const handleEnd = useCallback(async () => {
    const playerScore = events.filter(e => e.type === 'shot').length;
    const opponentScore = Math.floor(elapsed / 90);
    await sessions.end(sessionId, { score_json: { player: playerScore, opponent: opponentScore } });
    router.push(`/session/${sessionId}/summary`);
  }, [sessionId, events, router, elapsed]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const shots = events.filter(e => e.type === 'shot').length;
  const saves = events.filter(e => e.type === 'save').length;
  const opponentGoals = Math.floor(elapsed / 90);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{MODE_EMOJI[session?.mode || 'defense']}</span>
          <h1 className="text-xl font-display font-bold capitalize">{session?.mode || 'Training'}</h1>
          {session && <DifficultyBadge difficulty={session.difficulty} />}
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="success"><Wifi className="w-3 h-3 mr-1" /> Live</Badge>
          ) : (
            <Badge variant="danger"><WifiOff className="w-3 h-3 mr-1" /> Offline</Badge>
          )}
        </div>
      </div>

      {/* Main HUD */}
      <HUDPanel accent="#00D4FF" className="!p-0">
        <div className="p-8">
          {/* Score */}
          <div className="text-center mb-8">
            <div className="text-6xl font-display font-black tracking-tighter">
              <span className="text-dom-accent stat-glow">{shots}</span>
              <span className="text-dom-muted mx-4 text-4xl">—</span>
              <span className="text-dom-red">{opponentGoals}</span>
            </div>
            <div className="text-xs text-dom-muted uppercase tracking-wider mt-2">You vs Opponent</div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-display font-black text-dom-heading font-mono">{fmt(elapsed)}</div>
              <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">Elapsed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-display font-black text-dom-green">{saves}</div>
              <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">Saves</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-display font-black text-dom-yellow">{events.filter(e => e.type === 'boost_pickup').length}</div>
              <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">Boosts</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-dom-border">
          <div
            className="h-full bg-gradient-to-r from-dom-accent to-cyan-400 transition-all duration-1000"
            style={{ width: `${Math.min(100, (elapsed / 300) * 100)}%` }}
          />
        </div>
      </HUDPanel>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={handleBookmark} className="btn-secondary">
          <Bookmark className="w-4 h-4" />
          Bookmark
        </button>
        <button onClick={handleEnd} className="btn-danger px-8 py-3 text-base">
          <Square className="w-4 h-4" />
          End Session
        </button>
      </div>

      {/* Event Feed */}
      <div className="space-y-2">
        <div className="text-xs text-dom-muted uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-3 h-3" />
          Live Feed
        </div>
        <div className="space-y-1 max-h-52 overflow-y-auto rounded-xl bg-dom-surface border border-dom-border p-3">
          {events.slice(-12).reverse().map((evt) => (
            <div key={evt.id} className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg bg-dom-elevated/40 animate-fade-in">
              <span className="text-dom-muted font-mono w-12">{fmt(evt.t)}</span>
              <EventIcon type={evt.type} />
              <span className="text-dom-text capitalize font-medium">{evt.type.replace('_', ' ')}</span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-sm text-dom-muted py-6 text-center">Waiting for events...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const config: Record<string, { emoji: string }> = {
    shot: { emoji: '🎯' }, save: { emoji: '🧤' }, goal_scored: { emoji: '⚽' },
    goal_conceded: { emoji: '😤' }, bookmark: { emoji: '🔖' }, demo: { emoji: '💥' },
    boost_pickup: { emoji: '⚡' }, aerial: { emoji: '🚀' }, clear: { emoji: '🦶' },
  };
  const c = config[type] || { emoji: '•' };
  return <span className="text-sm">{c.emoji}</span>;
}
