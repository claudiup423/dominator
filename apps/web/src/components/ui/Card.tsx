import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, glow, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-dom-surface border border-dom-border rounded-xl p-5',
        hover && 'transition-all duration-150 cursor-pointer hover:border-dom-accent/30 hover:shadow-glow-accent hover:-translate-y-0.5',
        glow && 'shadow-glow-accent border-dom-accent/20',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function HUDPanel({ children, className, accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <div className={cn('hud-card p-6', className)}>
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-80"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function HeroCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('hero-mesh rounded-2xl border border-dom-border bg-dom-surface p-8', className)}>
      {children}
    </div>
  );
}

export function GlowCard({ children, className, color = '#00D4FF' }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <div
      className={cn('relative rounded-2xl border border-dom-border bg-dom-surface p-6 overflow-hidden', className)}
    >
      <div
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: color }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
