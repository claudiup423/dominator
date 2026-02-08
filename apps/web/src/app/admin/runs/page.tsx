'use client';

import { useQuery } from '@tanstack/react-query';
import { trainingRuns, models as modelsApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { StatusDot, SectionHeader, ModelTagBadge } from '@/components/ui/Badge';
import { formatNumber, formatDate, formatDuration, statusColor, cn } from '@/lib/utils';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import type { TrainingRun, Model } from '@/types';

export default function AdminRunsPage() {
  const { data: runs } = useQuery({
    queryKey: ['training-runs'],
    queryFn: () => trainingRuns.list() as Promise<TrainingRun[]>,
  });
  const { data: modelList } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
  });

  const modelMap = new Map(modelList?.map(m => [m.id, m]) || []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Training Runs</h1>
        <p className="text-sm text-dom-muted mt-1">Monitor active and historical training runs. Click a run to see live logs.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {(['running', 'completed', 'failed', 'queued'] as const).map(status => {
          const count = runs?.filter(r => r.status === status).length || 0;
          const emojis: Record<string, string> = { running: '🏃', completed: '✅', failed: '❌', queued: '⏳' };
          return (
            <Card key={status} className="flex items-center gap-3 py-3">
              <span className="text-xl">{emojis[status]}</span>
              <div>
                <div className="text-xl font-display font-bold text-dom-heading">{count}</div>
                <div className="text-xs text-dom-muted capitalize">{status}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Runs Table */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dom-border bg-dom-elevated/30">
                {['Status', 'Model', 'Steps', 'Reward', 'Entropy', 'π Loss', 'Duration', 'Started', ''].map(h => (
                  <th key={h} className={`py-3 px-4 text-xs font-semibold text-dom-muted uppercase tracking-wider ${h === 'Status' || h === 'Model' || h === '' ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs?.map(run => {
                const model = modelMap.get(run.model_id);
                return (
                  <tr key={run.id} className="border-b border-dom-border/30 hover:bg-dom-elevated/30 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <StatusDot status={run.status} />
                        <span className={cn('text-sm capitalize font-medium', statusColor(run.status))}>{run.status}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-dom-heading font-medium">{model?.name || '—'}</div>
                          <div className="text-xs text-dom-muted font-mono">{model?.version}</div>
                        </div>
                        {model && <ModelTagBadge tag={model.tag} />}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">{run.steps.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">{formatNumber(run.avg_reward)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">{formatNumber(run.entropy)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">{formatNumber(run.loss_pi, 3)}</td>
                    <td className="py-3.5 px-4 text-right text-dom-muted">{formatDuration(run.started_at, run.ended_at)}</td>
                    <td className="py-3.5 px-4 text-right text-dom-muted text-xs">{formatDate(run.started_at)}</td>
                    <td className="py-3.5 px-4">
                      <Link href={`/admin/runs/${run.id}`}>
                        <button className="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="View live logs">
                          <Eye className="w-4 h-4 text-dom-accent" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-dom-muted">
                    No training runs. Seed demo data to see examples.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
