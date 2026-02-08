import { cn, tagColor, statusColor, difficultyColor } from '@/lib/utils';
import { ReactNode } from 'react';

export function Badge({ children, variant = 'default', className }: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
}) {
  const variants = {
    default: 'bg-dom-elevated text-dom-muted border-dom-border',
    success: 'bg-dom-green-dim text-dom-green border-dom-green/20',
    warning: 'bg-dom-yellow-dim text-dom-yellow border-dom-yellow/20',
    danger: 'bg-dom-red-dim text-dom-red border-dom-red/20',
    accent: 'bg-dom-accent/10 text-dom-accent border-dom-accent/20',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', variants[variant], className)}>
      {children}
    </span>
  );
}

export function StatChip({ label, value, trend }: {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="stat-chip">
      <span className="text-dom-muted">{label}</span>
      <span className="text-dom-heading font-semibold">{value}</span>
      {trend && (
        <span className={cn(
          'text-[10px]',
          trend === 'up' && 'text-dom-green',
          trend === 'down' && 'text-dom-red',
        )}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
        </span>
      )}
    </div>
  );
}

export function ModelTagBadge({ tag }: { tag: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border', tagColor(tag))}>
      {tag}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-dom-green',
    running: 'bg-dom-accent',
    failed: 'bg-dom-red',
    stopped: 'bg-dom-yellow',
    queued: 'bg-dom-muted',
    pending: 'bg-dom-muted',
  };
  return (
    <span className="relative inline-flex">
      <span className={cn('inline-block w-2 h-2 rounded-full', colors[status] || 'bg-dom-muted')} />
      {status === 'running' && (
        <span className={cn('absolute inset-0 rounded-full animate-ping', colors[status])} style={{ animationDuration: '2s' }} />
      )}
    </span>
  );
}

export function SectionHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('section-header', className)}>{children}</h3>;
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const rankClass = `rank-${difficulty}`;
  const icons: Record<string, string> = {
    bronze: '🥉', silver: '🥈', gold: '🥇',
    plat: '💎', diamond: '💠', champ: '🏆', demon: '👹',
  };
  return (
    <span className={cn('rank-badge', rankClass)}>
      <span>{icons[difficulty] || '⚡'}</span>
      {difficulty}
    </span>
  );
}

export function HealthIndicator({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const config = {
    healthy: { color: 'bg-dom-green', glow: 'shadow-glow-green', label: 'Healthy', text: 'text-dom-green' },
    warning: { color: 'bg-dom-yellow', glow: '', label: 'Warning', text: 'text-dom-yellow' },
    critical: { color: 'bg-dom-red', glow: 'shadow-glow-red', label: 'Critical', text: 'text-dom-red' },
  };
  const c = config[status];
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dom-elevated border border-dom-border', c.glow)}>
      <span className="relative inline-flex">
        <span className={cn('w-2 h-2 rounded-full', c.color)} />
        {status === 'healthy' && <span className={cn('absolute inset-0 rounded-full animate-ping', c.color)} style={{ animationDuration: '3s' }} />}
      </span>
      <span className={cn('text-xs font-semibold', c.text)}>{c.label}</span>
    </div>
  );
}

export function BigStat({ value, label, color = 'text-dom-heading', glow }: {
  value: string | number; label: string; color?: string; glow?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={cn('text-4xl font-display font-black tracking-tight', color, glow && 'stat-glow')}>
        {value}
      </div>
      <div className="text-xs text-dom-muted uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
