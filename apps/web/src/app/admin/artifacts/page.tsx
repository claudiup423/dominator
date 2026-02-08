'use client';

import { useQuery } from '@tanstack/react-query';
import { artifacts as artifactsApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge, SectionHeader } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { FileStack, Download, Database, FileText, BarChart2, Settings } from 'lucide-react';
import type { Artifact } from '@/types';

const kindIcons: Record<string, React.ElementType> = {
  checkpoint: Database,
  log: FileText,
  tensorboard: BarChart2,
  config: Settings,
};

export default function AdminArtifactsPage() {
  const { data: artifactList } = useQuery({
    queryKey: ['artifacts'],
    queryFn: () => artifactsApi.list() as Promise<Artifact[]>,
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Artifacts</h1>
        <p className="text-sm text-dom-muted mt-1">Checkpoints, logs, and training artifacts.</p>
      </div>

      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dom-border">
              <th className="text-left py-3 px-4 text-xs font-medium text-dom-muted uppercase tracking-wider">Kind</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-dom-muted uppercase tracking-wider">Path</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-dom-muted uppercase tracking-wider">Size</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-dom-muted uppercase tracking-wider">Created</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-dom-muted uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {artifactList?.map(art => {
              const Icon = kindIcons[art.kind] || FileStack;
              return (
                <tr key={art.id} className="border-b border-dom-border/50 hover:bg-dom-elevated/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-dom-accent" />
                      <span className="capitalize text-dom-text">{art.kind}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-dom-muted">{art.path}</td>
                  <td className="py-3 px-4 text-right text-dom-muted">
                    {(art.metadata_json as any)?.size_mb ? `${(art.metadata_json as any).size_mb} MB` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-dom-muted text-xs">{formatDate(art.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={artifactsApi.downloadUrl(art.id)}
                      className="btn-ghost p-1.5"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {(!artifactList || artifactList.length === 0) && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-dom-muted">
                  No artifacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
