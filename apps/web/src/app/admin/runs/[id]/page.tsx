'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { trainingRuns, models as modelsApi } from '@/lib/api';
import { Card, HUDPanel, GlowCard } from '@/components/ui/Card';
import { StatusDot, ModelTagBadge, SectionHeader, Badge, BigStat } from '@/components/ui/Badge';
import { formatNumber, formatDate, formatDuration, statusColor, cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { ArrowLeft, Play, Square, Wifi, WifiOff, Terminal, TrendingUp, Zap, Activity } from 'lucide-react';
import Link from 'next/link';
import type { TrainingRun, Model } from '@/types';

interface MetricsPoint {
  step: number;
  avg_reward: number;
  entropy: number;
  loss_pi: number;
  loss_v: number;
  timestamp: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'metric';
  message: string;
}

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;

  const [connected, setConnected] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<MetricsPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<MetricsPoint | null>(null);
  const [showChart, setShowChart] = useState<'reward' | 'entropy' | 'loss'>('reward');
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data: run, refetch: refetchRun } = useQuery({
    queryKey: ['training-run', runId],
    queryFn: () => trainingRuns.get(runId) as Promise<TrainingRun>,
  });

  const { data: modelList } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
  });

  const model = modelList?.find(m => m.id === run?.model_id);

  // SSE connection
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const es = new EventSource(`${apiBase}/api/stream/training-runs/${runId}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      addLog('info', 'Connected to training run stream');
    };

    es.addEventListener('metrics', (e) => {
      try {
        const data = JSON.parse(e.data);
        const point: MetricsPoint = {
          step: data.step,
          avg_reward: data.avg_reward,
          entropy: data.entropy,
          loss_pi: data.loss_pi,
          loss_v: data.loss_v,
          timestamp: new Date().toISOString(),
        };
        setMetricsHistory(prev => [...prev.slice(-100), point]);
        setLatestMetrics(point);
        addLog('metric', `Step ${data.step.toLocaleString()} | Reward: ${data.avg_reward.toFixed(3)} | Entropy: ${data.entropy.toFixed(3)} | π-loss: ${data.loss_pi.toFixed(4)} | v-loss: ${data.loss_v.toFixed(4)}`);
      } catch {}
    });

    es.addEventListener('checkpoint', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('info', `💾 Checkpoint saved at step ${data.step.toLocaleString()} → ${data.path}`);
      } catch {}
    });

    es.addEventListener('done', () => {
      addLog('info', '✅ Training run completed');
      setConnected(false);
      es.close();
      refetchRun();
    });

    es.addEventListener('error_event', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('error', `❌ ${data.message || 'Unknown error'}`);
      } catch {}
    });

    es.onerror = () => {
      setConnected(false);
      addLog('warn', 'Connection lost. Attempting to reconnect...');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev.slice(-500), {
      timestamp: new Date().toISOString(),
      level,
      message,
    }]);
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const chartData = metricsHistory.map(m => ({
    step: `${Math.round(m.step / 1000)}k`,
    reward: +m.avg_reward.toFixed(3),
    entropy: +m.entropy.toFixed(3),
    loss_pi: +m.loss_pi.toFixed(4),
    loss_v: +m.loss_v.toFixed(4),
  }));

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/runs">
            <button className="btn-ghost !p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-black tracking-tight">Training Run</h1>
              {run && <StatusDot status={run.status} />}
              {run && (
                <span className={cn('text-sm font-semibold capitalize', statusColor(run.status))}>
                  {run.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-dom-muted">
              {model && (
                <>
                  <span className="font-medium text-dom-text">{model.name}</span>
                  <ModelTagBadge tag={model.tag} />
                  <span className="font-mono text-xs">{model.version}</span>
                </>
              )}
              {run?.started_at && <span>· Started {formatDate(run.started_at)}</span>}
              {run && <span>· {formatDuration(run.started_at, run.ended_at)}</span>}
            </div>
          </div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-3">
          {connected ? (
            <Badge variant="success"><Wifi className="w-3 h-3 mr-1" /> Streaming</Badge>
          ) : (
            <Badge variant="default"><WifiOff className="w-3 h-3 mr-1" /> Disconnected</Badge>
          )}
        </div>
      </div>

      {/* Live Metrics Cards */}
      <div className="grid grid-cols-4 gap-3">
        <GlowCard color="#00D4FF">
          <div className="text-center">
            <div className="text-3xl font-display font-black text-dom-accent stat-glow">
              {latestMetrics ? latestMetrics.step.toLocaleString() : run?.steps.toLocaleString() || '—'}
            </div>
            <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">Steps</div>
          </div>
        </GlowCard>
        <GlowCard color="#22C55E">
          <div className="text-center">
            <div className="text-3xl font-display font-black text-dom-green">
              {formatNumber(latestMetrics?.avg_reward ?? run?.avg_reward)}
            </div>
            <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">Avg Reward</div>
          </div>
        </GlowCard>
        <GlowCard color="#F59E0B">
          <div className="text-center">
            <div className="text-3xl font-display font-black text-dom-yellow">
              {formatNumber(latestMetrics?.entropy ?? run?.entropy)}
            </div>
            <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">Entropy</div>
          </div>
        </GlowCard>
        <GlowCard color="#A855F7">
          <div className="text-center">
            <div className="text-3xl font-display font-black text-dom-purple">
              {formatNumber(latestMetrics?.loss_pi ?? run?.loss_pi, 4)}
            </div>
            <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">π Loss</div>
          </div>
        </GlowCard>
      </div>

      {/* Charts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader className="!mb-0">Live Metrics</SectionHeader>
          <div className="flex gap-1">
            {[
              { key: 'reward', label: 'Reward', color: '#22C55E' },
              { key: 'entropy', label: 'Entropy', color: '#F59E0B' },
              { key: 'loss', label: 'Loss', color: '#A855F7' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setShowChart(opt.key as any)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  showChart === opt.key
                    ? 'text-dom-heading border border-dom-border bg-dom-elevated'
                    : 'text-dom-muted hover:text-dom-text'
                )}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: opt.color }} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="!p-4">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={showChart === 'reward' ? '#22C55E' : showChart === 'entropy' ? '#F59E0B' : '#A855F7'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={showChart === 'reward' ? '#22C55E' : showChart === 'entropy' ? '#F59E0B' : '#A855F7'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                <XAxis dataKey="step" stroke="#6B7280" fontSize={10} />
                <YAxis stroke="#6B7280" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#111522', border: '1px solid #252B3B', borderRadius: '10px', fontSize: '12px' }} />
                {showChart === 'reward' && (
                  <Area type="monotone" dataKey="reward" stroke="#22C55E" strokeWidth={2} fill="url(#liveGrad)" name="Avg Reward" />
                )}
                {showChart === 'entropy' && (
                  <Area type="monotone" dataKey="entropy" stroke="#F59E0B" strokeWidth={2} fill="url(#liveGrad)" name="Entropy" />
                )}
                {showChart === 'loss' && (
                  <>
                    <Area type="monotone" dataKey="loss_pi" stroke="#A855F7" strokeWidth={2} fill="url(#liveGrad)" name="π Loss" />
                    <Line type="monotone" dataKey="loss_v" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Value Loss" />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-dom-muted text-sm">
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {connected ? 'Waiting for metrics...' : 'Connect to see live charts'}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Log Console */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader className="!mb-0 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5" />
            Training Logs
          </SectionHeader>
          <div className="flex items-center gap-3">
            <span className="text-xs text-dom-muted">{logs.length} entries</span>
            {connected && (
              <span className="flex items-center gap-1.5 text-xs text-dom-green font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dom-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-dom-green" />
                </span>
                Live
              </span>
            )}
            <button onClick={() => setLogs([])} className="btn-ghost !py-1 !px-2 text-xs">Clear</button>
          </div>
        </div>

        <div className="bg-[#0A0C10] border border-dom-border rounded-xl overflow-hidden font-mono text-xs">
          <div className="max-h-[400px] overflow-y-auto p-4 space-y-0.5">
            {logs.length === 0 && (
              <div className="text-dom-muted py-8 text-center font-sans text-sm">
                {connected ? 'Waiting for log output...' : 'No logs yet. Logs stream live when a run is active.'}
              </div>
            )}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 py-0.5 hover:bg-white/[0.02] rounded px-1 -mx-1">
                <span className="text-dom-muted flex-shrink-0 w-16">{formatTime(log.timestamp)}</span>
                <span className={cn(
                  'flex-shrink-0 w-5 text-center',
                  log.level === 'info' && 'text-dom-accent',
                  log.level === 'warn' && 'text-dom-yellow',
                  log.level === 'error' && 'text-dom-red',
                  log.level === 'metric' && 'text-dom-muted',
                )}>
                  {log.level === 'info' ? 'ℹ' : log.level === 'warn' ? '⚠' : log.level === 'error' ? '✖' : '▸'}
                </span>
                <span className={cn(
                  'flex-1 break-all',
                  log.level === 'error' && 'text-dom-red',
                  log.level === 'warn' && 'text-dom-yellow',
                  log.level === 'metric' && 'text-gray-400',
                  log.level === 'info' && 'text-gray-300',
                )}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Run Config */}
      {run?.config_json && Object.keys(run.config_json).length > 0 && (
        <div className="space-y-3">
          <SectionHeader>Run Configuration</SectionHeader>
          <Card className="!p-4">
            <pre className="text-xs text-dom-muted font-mono whitespace-pre-wrap">
              {JSON.stringify(run.config_json, null, 2)}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
