'use client';

import { useQuery } from '@tanstack/react-query';
import { models as modelsApi, trainingRuns } from '@/lib/api';
import { Card, HUDPanel, GlowCard, HeroCard } from '@/components/ui/Card';
import { ModelTagBadge, StatusDot, HealthIndicator, SectionHeader, BigStat } from '@/components/ui/Badge';
import { formatPercent, formatNumber, formatDate } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, AlertTriangle, Shield, Box, Play, Cpu, TrendingUp } from 'lucide-react';
import type { Model, TrainingRun } from '@/types';

export default function AdminOverview() {
  const { data: modelList } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
  });
  const { data: runs } = useQuery({
    queryKey: ['training-runs'],
    queryFn: () => trainingRuns.list() as Promise<TrainingRun[]>,
  });

  const stableModel = modelList?.find(m => m.tag === 'stable');
  const candidates = modelList?.filter(m => m.tag === 'candidate') || [];
  const runningRuns = runs?.filter(r => r.status === 'running') || [];
  const failedRuns = runs?.filter(r => r.status === 'failed') || [];

  const evalTrend = Array.from({ length: 12 }, (_, i) => ({
    name: `v2.${i}`,
    winRate: +(0.42 + i * 0.032 + (Math.random() - 0.5) * 0.04).toFixed(3),
    baseline: 0.50,
  }));

  const rewardTrend = Array.from({ length: 20 }, (_, i) => ({
    step: `${i * 25}k`,
    reward: +(-0.3 + i * 0.15 + (Math.random() - 0.5) * 0.2).toFixed(2),
  }));

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">AI Ops Overview</h1>
        <p className="text-sm text-dom-muted mt-1">Model health, training progress, and regression alerts.</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        <GlowCard color="#22C55E" className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-dom-muted uppercase tracking-wider font-semibold">Stable Model</span>
            <HealthIndicator status="healthy" />
          </div>
          {stableModel ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-4 h-4 text-dom-green" />
                <span className="text-lg font-display font-bold text-dom-heading">{stableModel.name}</span>
              </div>
              <div className="text-sm text-dom-muted font-mono">{stableModel.version}</div>
              <div className="flex items-center gap-2 mt-3">
                <ModelTagBadge tag="stable" />
                {stableModel.params_count && (
                  <span className="text-xs text-dom-muted">{(stableModel.params_count / 1e6).toFixed(1)}M params</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-dom-muted">No stable model deployed</div>
          )}
        </GlowCard>

        <GlowCard color="#00D4FF" className="animate-slide-up">
          <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-4">Active Runs</div>
          <div className="flex items-end gap-3">
            <div className="text-5xl font-display font-black text-dom-accent stat-glow">{runningRuns.length}</div>
            <div className="pb-2">
              <div className="text-sm text-dom-text font-medium">{runs?.length || 0} total</div>
              <div className="text-xs text-dom-muted">{failedRuns.length} failed</div>
            </div>
          </div>
        </GlowCard>

        <GlowCard color="#A855F7" className="animate-slide-up">
          <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-4">Candidates</div>
          <div className="flex items-end gap-3">
            <div className="text-5xl font-display font-black text-dom-purple">{candidates.length}</div>
            <div className="pb-2">
              <div className="text-sm text-dom-text font-medium">Awaiting eval</div>
              <div className="text-xs text-dom-muted">Ready to promote</div>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <SectionHeader>Win Rate Trend</SectionHeader>
          <Card className="!p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={evalTrend} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="winGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={10} />
                <YAxis stroke="#6B7280" fontSize={10} domain={[0.3, 0.9]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip contentStyle={{ backgroundColor: '#111522', border: '1px solid #252B3B', borderRadius: '10px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="winRate" stroke="#00D4FF" strokeWidth={2} fill="url(#winGrad)" name="Win Rate" />
                <Line type="monotone" dataKey="baseline" stroke="#6B7280" strokeWidth={1} strokeDasharray="5 5" name="Baseline" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="space-y-3">
          <SectionHeader>Reward Curve (Latest Run)</SectionHeader>
          <Card className="!p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={rewardTrend} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="rewardGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                <XAxis dataKey="step" stroke="#6B7280" fontSize={10} />
                <YAxis stroke="#6B7280" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#111522', border: '1px solid #252B3B', borderRadius: '10px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="reward" stroke="#22C55E" strokeWidth={2} fill="url(#rewardGrad)" name="Avg Reward" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Regression Alerts */}
      <div className="space-y-3">
        <SectionHeader>Regression Alerts</SectionHeader>
        {failedRuns.length > 0 ? (
          <div className="space-y-2">
            {failedRuns.map(run => (
              <Card key={run.id} className="flex items-center gap-4 border-dom-red/20">
                <div className="text-2xl">🚨</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-dom-heading">Training Run Failed</div>
                  <div className="text-xs text-dom-muted mt-0.5">
                    {run.steps.toLocaleString()} steps · Reward: {formatNumber(run.avg_reward)} · {formatDate(run.ended_at)}
                  </div>
                </div>
                <span className="text-xs font-bold text-dom-red uppercase">Failed</span>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <span className="text-sm text-dom-muted">All systems nominal. No regressions detected.</span>
          </Card>
        )}
      </div>
    </div>
  );
}
