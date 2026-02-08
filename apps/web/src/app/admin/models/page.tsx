'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { models as modelsApi } from '@/lib/api';
import { Card, GlowCard } from '@/components/ui/Card';
import { ModelTagBadge, SectionHeader } from '@/components/ui/Badge';
import { formatDate, cn } from '@/lib/utils';
import { Box, ArrowUpCircle, GitBranch, Hash, Cpu, Shield, Sparkles } from 'lucide-react';
import type { Model } from '@/types';

export default function AdminModelsPage() {
  const queryClient = useQueryClient();
  const { data: modelList } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
  });

  const promoteMutation = useMutation({
    mutationFn: (id: string) => modelsApi.promote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }),
  });

  const stable = modelList?.filter(m => m.tag === 'stable') || [];
  const candidates = modelList?.filter(m => m.tag === 'candidate') || [];
  const baselines = modelList?.filter(m => m.tag === 'baseline') || [];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Models</h1>
        <p className="text-sm text-dom-muted mt-1">Manage model versions, tags, and promotion pipeline.</p>
      </div>

      {/* Stable */}
      {stable.length > 0 && (
        <div className="space-y-3">
          <SectionHeader>🏆 Stable (Production)</SectionHeader>
          {stable.map(m => (
            <GlowCard key={m.id} color="#22C55E">
              <ModelCardInner model={m} />
            </GlowCard>
          ))}
        </div>
      )}

      {/* Candidates */}
      <div className="space-y-3">
        <SectionHeader>🧪 Candidates</SectionHeader>
        {candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map(m => (
              <GlowCard key={m.id} color="#A855F7">
                <div className="flex items-center justify-between">
                  <ModelCardInner model={m} />
                  <button
                    onClick={() => promoteMutation.mutate(m.id)}
                    disabled={promoteMutation.isPending}
                    className="btn-primary flex-shrink-0"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    {promoteMutation.isPending ? 'Promoting...' : 'Promote'}
                  </button>
                </div>
              </GlowCard>
            ))}
          </div>
        ) : (
          <Card className="text-center py-10 text-dom-muted">No candidate models</Card>
        )}
      </div>

      {/* Baselines */}
      {baselines.length > 0 && (
        <div className="space-y-3">
          <SectionHeader>📦 Baselines (Archived)</SectionHeader>
          {baselines.map(m => (
            <Card key={m.id}>
              <ModelCardInner model={m} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelCardInner({ model }: { model: Model }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-dom-elevated flex items-center justify-center border border-dom-border">
        <Cpu className="w-6 h-6 text-dom-accent" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-dom-heading text-lg">{model.name}</span>
          <ModelTagBadge tag={model.tag} />
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-dom-muted">
          <span className="font-mono">{model.version}</span>
          {model.params_count && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />{(model.params_count / 1e6).toFixed(1)}M
            </span>
          )}
          {model.git_sha && (
            <span className="flex items-center gap-1 font-mono">
              <GitBranch className="w-3 h-3" />{model.git_sha.slice(0, 7)}
            </span>
          )}
          <span>{formatDate(model.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
