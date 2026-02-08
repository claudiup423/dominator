import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = e - s;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-dom-green';
    case 'running': return 'text-dom-accent';
    case 'failed': return 'text-dom-red';
    case 'stopped': return 'text-dom-yellow';
    case 'queued': return 'text-dom-muted';
    default: return 'text-dom-muted';
  }
}

export function tagColor(tag: string): string {
  switch (tag) {
    case 'stable': return 'bg-dom-green-dim text-dom-green border-dom-green/20';
    case 'candidate': return 'bg-dom-purple-dim text-dom-purple border-dom-purple/20';
    case 'baseline': return 'bg-dom-elevated text-dom-muted border-dom-border';
    default: return 'bg-dom-elevated text-dom-muted border-dom-border';
  }
}

export function difficultyColor(diff: string): string {
  const colors: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    plat: '#00CED1',
    diamond: '#B9F2FF',
    champ: '#9B30FF',
    demon: '#FF0040',
  };
  return colors[diff] || '#6B7280';
}
