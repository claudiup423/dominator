'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/lib/api';
import { Card, HUDPanel, HeroCard, GlowCard } from '@/components/ui/Card';
import { DifficultyBadge, SectionHeader, BigStat } from '@/components/ui/Badge';
import { formatDate, formatDuration } from '@/lib/utils';
import { CheckCircle, AlertTriangle, Lightbulb, ArrowRight, Download, Trophy, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { SessionSummary, SessionInsight } from '@/types';

const MODE_EMOJI: Record<string, string> = {
  defense: '🛡️', shooting: '🎯', possession: '⚽', '50/50s': '⚔️',
};

export default function SummaryPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const { data: summary, isLoading } = useQuery({
    queryKey: ['session-summary', sessionId],
    queryFn: () => sessions.summary(sessionId) as Promise<SessionSummary>,
  });

  if (isLoading || !summary) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-6">
        <div className="h-10 w-64 bg-dom-surface rounded" />
        <div className="h-48 bg-dom-surface rounded-2xl" />
        <div className="h-32 bg-dom-surface rounded-xl" />
      </div>
    );
  }

  const { session, insights, recommended_drill, events } = summary;
  const playerScore = session.score_json?.player ?? 0;
  const opponentScore = session.score_json?.opponent ?? 0;
  const isWin = playerScore > opponentScore;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{MODE_EMOJI[session.mode] || '⚡'}</span>
            <h1 className="text-2xl font-display font-black">Session Complete</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-dom-muted">
            <span className="capitalize">{session.mode}</span>
            <span>·</span>
            <DifficultyBadge difficulty={session.difficulty} />
            <span>·</span>
            <span>{formatDate(session.started_at)}</span>
            <span>·</span>
            <span>{formatDuration(session.started_at, session.ended_at)}</span>
          </div>
        </div>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `session_${sessionId}.json`; a.click();
          }}
          className="btn-secondary"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Score Card */}
      <HeroCard>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isWin ? (
              <><Trophy className="w-6 h-6 text-dom-green" /><span className="text-lg font-bold text-dom-green">Victory!</span></>
            ) : playerScore === opponentScore ? (
              <span className="text-lg font-bold text-dom-yellow">Draw</span>
            ) : (
              <><XCircle className="w-6 h-6 text-dom-red" /><span className="text-lg font-bold text-dom-red">Defeat</span></>
            )}
          </div>
          <div className="text-7xl font-display font-black tracking-tighter">
            <span className={isWin ? 'text-dom-accent stat-glow' : 'text-dom-heading'}>{playerScore}</span>
            <span className="text-dom-muted mx-6 text-4xl">–</span>
            <span className={!isWin && playerScore !== opponentScore ? 'text-dom-red' : 'text-dom-heading'}>{opponentScore}</span>
          </div>
          <div className="text-sm text-dom-muted">
            vs <span className="capitalize font-medium text-dom-text">{session.opponent_style}</span> opponent
          </div>
        </div>
      </HeroCard>

      {/* Insights */}
      <div className="space-y-4">
        <SectionHeader>Key Insights</SectionHeader>
        <div className="space-y-3 stagger">
          {insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      </div>

      {/* Timeline */}
      {events.length > 0 && (
        <div className="space-y-4">
          <SectionHeader>Session Timeline</SectionHeader>
          <Card className="max-h-64 overflow-y-auto !p-4">
            <div className="space-y-1">
              {events.slice(0, 30).map((evt, i) => {
                const eventEmojis: Record<string, string> = {
                  goal_scored: '⚽', goal_conceded: '😤', save: '🧤', shot: '🎯',
                  boost_pickup: '⚡', demo: '💥', bookmark: '🔖', aerial: '🚀',
                };
                return (
                  <div key={i} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg hover:bg-dom-elevated/50">
                    <span className="text-dom-muted font-mono w-14">
                      {Math.floor(evt.t_ms / 60000)}:{String(Math.floor((evt.t_ms % 60000) / 1000)).padStart(2, '0')}
                    </span>
                    <span>{eventEmojis[evt.type] || '•'}</span>
                    <span className="capitalize text-dom-text">{evt.type.replace('_', ' ')}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Recommended Drill */}
      <div className="space-y-4">
        <SectionHeader>Recommended Next</SectionHeader>
        <Link href="/train">
          <GlowCard color="#00D4FF" className="flex items-center justify-between cursor-pointer hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center gap-4">
              <div className="text-3xl">🏋️</div>
              <div>
                <div className="font-display font-bold text-dom-heading text-lg">{recommended_drill.name}</div>
                <div className="text-sm text-dom-muted mt-0.5">
                  Focus: <span className="text-dom-accent">{recommended_drill.focus}</span> · {recommended_drill.duration_min} min
                </div>
              </div>
            </div>
            <button className="btn-primary">
              Start <ArrowRight className="w-4 h-4" />
            </button>
          </GlowCard>
        </Link>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: SessionInsight }) {
  const config = {
    positive: { icon: CheckCircle, color: 'text-dom-green', bg: 'bg-dom-green/10', border: 'border-dom-green/20', emoji: '✅' },
    warning: { icon: AlertTriangle, color: 'text-dom-yellow', bg: 'bg-dom-yellow/10', border: 'border-dom-yellow/20', emoji: '⚠️' },
    tip: { icon: Lightbulb, color: 'text-dom-accent', bg: 'bg-dom-accent/10', border: 'border-dom-accent/20', emoji: '💡' },
  };
  const c = config[insight.type] || config.tip;

  return (
    <Card className={`flex items-start gap-4 border ${c.border} animate-slide-up`}>
      <div className="text-xl mt-0.5">{c.emoji}</div>
      <div className="flex-1">
        <div className="font-display font-bold text-dom-heading">{insight.title}</div>
        <div className="text-sm text-dom-muted mt-1 leading-relaxed">{insight.detail}</div>
      </div>
    </Card>
  );
}
