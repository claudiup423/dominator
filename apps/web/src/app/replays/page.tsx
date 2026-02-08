'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessions } from '@/lib/api';
import { Card, HUDPanel } from '@/components/ui/Card';
import { DifficultyBadge, SectionHeader, Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/Controls';
import { formatDate, formatDuration, cn } from '@/lib/utils';
import { Film, ChevronDown, ChevronRight, Trophy, XCircle, Filter, Search, Bookmark, Clock } from 'lucide-react';
import type { TrainingSession, SessionEvent } from '@/types';

const MODE_EMOJI: Record<string, string> = {
  defense: '🛡️', shooting: '🎯', possession: '⚽', '50/50s': '⚔️',
};

const EVENT_EMOJI: Record<string, string> = {
  goal_scored: '⚽', goal_conceded: '😤', save: '🧤', shot: '🎯',
  boost_pickup: '⚡', demo: '💥', bookmark: '🔖', aerial: '🚀',
  clear: '🦶', kickoff: '🏁',
};

export default function ReplaysPage() {
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<SessionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const { data: sessionList } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessions.list() as Promise<TrainingSession[]>,
  });

  const allSessions = sessionList || [];

  const filtered = useMemo(() => {
    return allSessions.filter(s => {
      if (modeFilter !== 'all' && s.mode !== modeFilter) return false;
      if (resultFilter === 'wins' && !((s.score_json?.player || 0) > (s.score_json?.opponent || 0))) return false;
      if (resultFilter === 'losses' && !((s.score_json?.player || 0) < (s.score_json?.opponent || 0))) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.mode.includes(q) || s.difficulty.includes(q) || s.opponent_style.includes(q);
      }
      return true;
    });
  }, [allSessions, modeFilter, resultFilter, searchQuery]);

  const handleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    setLoadingEvents(true);
    try {
      const summary: any = await sessions.summary(sessionId);
      setExpandedEvents(summary.events || []);
    } catch {
      setExpandedEvents([]);
    }
    setLoadingEvents(false);
  };

  const totalWins = filtered.filter(s => (s.score_json?.player || 0) > (s.score_json?.opponent || 0)).length;
  const bookmarkedSessions = allSessions.length; // Simulated

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Replays</h1>
        <p className="text-sm text-dom-muted mt-1">Browse your session history, review events, and find bookmarked moments.</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex items-center gap-3 py-3">
          <span className="text-2xl">🎮</span>
          <div>
            <div className="text-xl font-display font-bold text-dom-heading">{allSessions.length}</div>
            <div className="text-xs text-dom-muted">Total Sessions</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 py-3">
          <span className="text-2xl">🔖</span>
          <div>
            <div className="text-xl font-display font-bold text-dom-yellow">{bookmarkedSessions}</div>
            <div className="text-xs text-dom-muted">With Events</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 py-3">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-xl font-display font-bold text-dom-green">{totalWins} W</div>
            <div className="text-xs text-dom-muted">Wins in Filter</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-4 py-3 px-4">
        <Filter className="w-4 h-4 text-dom-muted" />

        {/* Mode filter */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'All Modes' },
            { value: 'defense', label: '🛡️ Def' },
            { value: 'shooting', label: '🎯 Shot' },
            { value: 'possession', label: '⚽ Poss' },
            { value: '50/50s', label: '⚔️ 50s' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setModeFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                modeFilter === opt.value
                  ? 'bg-dom-accent/10 text-dom-accent border border-dom-accent/20'
                  : 'text-dom-muted hover:text-dom-text hover:bg-dom-elevated'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-dom-border" />

        {/* Result filter */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'All Results' },
            { value: 'wins', label: '✅ Wins' },
            { value: 'losses', label: '❌ Losses' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setResultFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                resultFilter === opt.value
                  ? 'bg-dom-accent/10 text-dom-accent border border-dom-accent/20'
                  : 'text-dom-muted hover:text-dom-text hover:bg-dom-elevated'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dom-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field !pl-9 !py-1.5 !text-xs w-44"
          />
        </div>
      </Card>

      {/* Session List */}
      <div className="space-y-2">
        <div className="text-xs text-dom-muted">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</div>

        {filtered.map((s) => {
          const isWin = (s.score_json?.player || 0) > (s.score_json?.opponent || 0);
          const isDraw = (s.score_json?.player || 0) === (s.score_json?.opponent || 0);
          const isExpanded = expandedId === s.id;

          return (
            <div key={s.id} className="animate-fade-in">
              <Card
                className={cn(
                  'cursor-pointer transition-all',
                  isExpanded && '!rounded-b-none border-b-0',
                )}
                onClick={() => handleExpand(s.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Win/Loss indicator */}
                    <div className={cn(
                      'w-1.5 h-12 rounded-full',
                      isWin ? 'bg-dom-green' : isDraw ? 'bg-dom-yellow' : 'bg-dom-red'
                    )} />

                    {/* Mode emoji */}
                    <span className="text-2xl">{MODE_EMOJI[s.mode] || '⚡'}</span>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-dom-heading capitalize">{s.mode}</span>
                        <DifficultyBadge difficulty={s.difficulty} />
                        <span className="text-xs text-dom-muted capitalize">vs {s.opponent_style}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-dom-muted">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(s.started_at)}</span>
                        <span>{formatDuration(s.started_at, s.ended_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Score */}
                    <div className="text-right">
                      <div className="text-2xl font-display font-black">
                        <span className={isWin ? 'text-dom-accent' : 'text-dom-heading'}>{s.score_json?.player ?? 0}</span>
                        <span className="text-dom-muted mx-1.5 text-sm">–</span>
                        <span className={!isWin && !isDraw ? 'text-dom-red' : 'text-dom-heading'}>{s.score_json?.opponent ?? 0}</span>
                      </div>
                      <div className="text-xs mt-0.5">
                        {isWin ? <span className="text-dom-green font-semibold">Victory</span>
                          : isDraw ? <span className="text-dom-yellow font-semibold">Draw</span>
                          : <span className="text-dom-red font-semibold">Defeat</span>}
                      </div>
                    </div>

                    {/* Expand arrow */}
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-dom-accent" /> : <ChevronRight className="w-5 h-5 text-dom-muted" />}
                  </div>
                </div>
              </Card>

              {/* Expanded Timeline */}
              {isExpanded && (
                <Card className="!rounded-t-none border-t-0 !pt-0 animate-fade-in">
                  <div className="border-t border-dom-border pt-4">
                    <div className="text-xs text-dom-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Film className="w-3 h-3" /> Event Timeline
                    </div>

                    {loadingEvents ? (
                      <div className="py-6 text-center text-sm text-dom-muted animate-pulse">Loading events...</div>
                    ) : expandedEvents.length > 0 ? (
                      <div className="relative pl-6 space-y-0.5 max-h-60 overflow-y-auto">
                        {/* Timeline line */}
                        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-dom-border" />

                        {expandedEvents.map((evt, i) => (
                          <div key={i} className="relative flex items-center gap-3 py-1.5 group">
                            {/* Dot */}
                            <div className={cn(
                              'absolute left-[-15px] w-3 h-3 rounded-full border-2 border-dom-base',
                              evt.type === 'bookmark' ? 'bg-dom-yellow' :
                              evt.type === 'goal_scored' || evt.type === 'shot' ? 'bg-dom-accent' :
                              evt.type === 'goal_conceded' ? 'bg-dom-red' : 'bg-dom-muted'
                            )} />

                            <span className="text-dom-muted font-mono text-xs w-14">
                              {Math.floor(evt.t_ms / 60000)}:{String(Math.floor((evt.t_ms % 60000) / 1000)).padStart(2, '0')}
                            </span>
                            <span className="text-sm">{EVENT_EMOJI[evt.type] || '•'}</span>
                            <span className="text-sm capitalize text-dom-text group-hover:text-dom-heading transition-colors">
                              {evt.type.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-dom-muted">No events recorded for this session.</div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <Card className="py-12 text-center">
            <span className="text-3xl block mb-3">🔍</span>
            <div className="text-dom-muted">No sessions match your filters.</div>
          </Card>
        )}
      </div>
    </div>
  );
}
