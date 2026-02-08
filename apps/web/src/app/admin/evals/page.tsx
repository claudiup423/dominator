'use client';

import { useQuery } from '@tanstack/react-query';
import { evals } from '@/lib/api';
import { Card, GlowCard } from '@/components/ui/Card';
import { Badge, SectionHeader } from '@/components/ui/Badge';
import { formatPercent, formatNumber, formatDate, cn } from '@/lib/utils';
import { FlaskConical, CheckCircle, XCircle, ArrowUp, ArrowDown } from 'lucide-react';
import type { EvalSuite } from '@/types';

export default function AdminEvalsPage() {
  const { data: suites } = useQuery({
    queryKey: ['eval-suites'],
    queryFn: () => evals.suites() as Promise<EvalSuite[]>,
  });

  const evalData = [
    { label: 'Stable v2.4.1', tag: 'stable', emoji: '🏆',
      metrics: { win_rate: 0.72, goals_for: 2.8, goals_against: 1.1, kickoff_loss_rate: 0.18, avg_shot_quality: 0.74, last_man_overcommit_rate: 0.08, own_goal_rate: 0.01, concede_open_net_rate: 0.05 } },
    { label: 'Candidate v2.5.0-rc1', tag: 'candidate', emoji: '🧪',
      metrics: { win_rate: 0.68, goals_for: 2.5, goals_against: 1.3, kickoff_loss_rate: 0.22, avg_shot_quality: 0.69, last_man_overcommit_rate: 0.12, own_goal_rate: 0.02, concede_open_net_rate: 0.07 } },
  ];

  const metrics = [
    { key: 'win_rate', label: 'Win Rate', fmt: formatPercent, higherBetter: true },
    { key: 'goals_for', label: 'Goals For', fmt: (n: number | null) => formatNumber(n, 1), higherBetter: true },
    { key: 'goals_against', label: 'Goals Against', fmt: (n: number | null) => formatNumber(n, 1), higherBetter: false },
    { key: 'kickoff_loss_rate', label: 'Kickoff Loss', fmt: formatPercent, higherBetter: false },
    { key: 'avg_shot_quality', label: 'Shot Quality', fmt: formatPercent, higherBetter: true },
    { key: 'last_man_overcommit_rate', label: 'Last-man Overcommit', fmt: formatPercent, higherBetter: false },
    { key: 'own_goal_rate', label: 'Own Goal Rate', fmt: formatPercent, higherBetter: false },
    { key: 'concede_open_net_rate', label: 'Open Net Concede', fmt: formatPercent, higherBetter: false },
  ];

  const gates = [
    { name: 'Win Rate ≥ 55%', key: 'win_rate', threshold: 0.55, inverted: false },
    { name: 'Own Goal Rate ≤ 3%', key: 'own_goal_rate', threshold: 0.03, inverted: true },
    { name: 'Last-man Overcommit ≤ 15%', key: 'last_man_overcommit_rate', threshold: 0.15, inverted: true },
    { name: 'Open Net Concede ≤ 10%', key: 'concede_open_net_rate', threshold: 0.10, inverted: true },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Evaluations</h1>
        <p className="text-sm text-dom-muted mt-1">Run eval suites, compare models, and enforce quality gates.</p>
      </div>

      {/* Suites */}
      <div className="space-y-3">
        <SectionHeader>Eval Suites</SectionHeader>
        <div className="grid grid-cols-2 gap-4">
          {suites?.map(suite => (
            <GlowCard key={suite.id} color="#00D4FF" className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-dom-accent/10 flex items-center justify-center text-xl border border-dom-accent/20">
                🧪
              </div>
              <div>
                <div className="font-display font-bold text-dom-heading">{suite.name}</div>
                <div className="text-xs text-dom-muted mt-1">{formatDate(suite.created_at)}</div>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>

      {/* Compare */}
      <div className="space-y-3">
        <SectionHeader>Stable vs Candidate Comparison</SectionHeader>
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dom-border bg-dom-elevated/30">
                <th className="text-left py-3.5 px-5 text-xs font-semibold text-dom-muted uppercase tracking-wider">Metric</th>
                {evalData.map(d => (
                  <th key={d.label} className="text-right py-3.5 px-5 text-xs font-semibold text-dom-muted uppercase tracking-wider">
                    {d.emoji} {d.label}
                  </th>
                ))}
                <th className="text-right py-3.5 px-5 text-xs font-semibold text-dom-muted uppercase tracking-wider">Delta</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ key, label, fmt, higherBetter }) => {
                const base = (evalData[0].metrics as any)[key] as number;
                const cand = (evalData[1].metrics as any)[key] as number;
                const delta = cand - base;
                const isGood = higherBetter ? delta > 0 : delta < 0;
                const isBad = higherBetter ? delta < -0.01 : delta > 0.01;
                return (
                  <tr key={key} className="border-b border-dom-border/30 hover:bg-dom-elevated/20">
                    <td className="py-3.5 px-5 text-dom-text font-medium">{label}</td>
                    <td className="py-3.5 px-5 text-right font-mono text-dom-heading">{fmt(base)}</td>
                    <td className="py-3.5 px-5 text-right font-mono text-dom-heading">{fmt(cand)}</td>
                    <td className="py-3.5 px-5 text-right">
                      <span className={cn(
                        'inline-flex items-center gap-1 font-mono font-semibold',
                        isGood ? 'text-dom-green' : isBad ? 'text-dom-red' : 'text-dom-muted'
                      )}>
                        {isGood ? <ArrowUp className="w-3 h-3" /> : isBad ? <ArrowDown className="w-3 h-3" /> : null}
                        {delta > 0 ? '+' : ''}{fmt(delta)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Gates */}
      <div className="space-y-3">
        <SectionHeader>Quality Gates (Candidate)</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          {gates.map(gate => {
            const val = (evalData[1].metrics as any)[gate.key] as number | undefined;
            const passed = val != null && (gate.inverted ? val <= gate.threshold : val >= gate.threshold);
            return (
              <Card key={gate.name} className={cn(
                'flex items-center justify-between',
                passed ? 'border-dom-green/20' : 'border-dom-red/20'
              )}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{passed ? '✅' : '❌'}</span>
                  <span className="text-sm text-dom-text font-medium">{gate.name}</span>
                </div>
                <Badge variant={passed ? 'success' : 'danger'}>{passed ? 'Pass' : 'Fail'}</Badge>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
