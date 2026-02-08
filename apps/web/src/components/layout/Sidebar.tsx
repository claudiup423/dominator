'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  Home, Crosshair, BarChart3, Play, FlaskConical, Box, FileStack, Zap, User, Crown,
  TrendingUp, Trophy, Film, Dumbbell
} from 'lucide-react';

const playerLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/train', label: 'Train', icon: Crosshair },
  { href: '/stats', label: 'Stats', icon: TrendingUp },
  { href: '/achievements', label: 'Achievements', icon: Trophy },
  { href: '/replays', label: 'Replays', icon: Film },
  { href: '/drills', label: 'Drills', icon: Dumbbell },
];

const adminLinks = [
  { href: '/admin/overview', label: 'Overview', icon: BarChart3 },
  { href: '/admin/runs', label: 'Training Runs', icon: Play },
  { href: '/admin/evals', label: 'Evaluations', icon: FlaskConical },
  { href: '/admin/models', label: 'Models', icon: Box },
  { href: '/admin/artifacts', label: 'Artifacts', icon: FileStack },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-dom-surface/95 backdrop-blur-xl border-r border-dom-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dom-border">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-dom-accent via-cyan-400 to-blue-600 flex items-center justify-center shadow-glow-accent group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 text-white" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
          </div>
          <div>
            <div className="text-sm font-display font-extrabold text-dom-heading tracking-tight">DOMINATOR</div>
            <div className="text-[10px] text-dom-accent font-semibold uppercase tracking-[0.2em]">Training Lab</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="section-header px-3 flex items-center gap-2">
          <Crosshair className="w-3 h-3" />
          Player
        </div>
        {playerLinks.map(link => (
          <NavLink key={link.href} {...link} active={pathname === link.href} />
        ))}

        {isAdmin && (
          <>
            <div className="my-5 mx-3 border-t border-dom-border" />
            <div className="section-header px-3 flex items-center gap-2">
              <Crown className="w-3 h-3" />
              AI Ops
            </div>
            {adminLinks.map(link => (
              <NavLink key={link.href} {...link} active={pathname.startsWith(link.href)} />
            ))}
          </>
        )}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-t border-dom-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dom-accent/20 to-dom-accent/5 flex items-center justify-center border border-dom-accent/20">
              <User className="w-4 h-4 text-dom-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-dom-text truncate">{user.email}</div>
              <div className="text-[10px] text-dom-accent uppercase font-semibold">{user.role}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function NavLink({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: React.ElementType; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
        active
          ? 'bg-dom-accent/10 text-dom-accent font-semibold shadow-sm border border-dom-accent/10'
          : 'text-dom-muted hover:text-dom-text hover:bg-dom-elevated'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', active && 'drop-shadow-[0_0_6px_rgba(0,212,255,0.5)]')} />
      {label}
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-dom-accent shadow-glow-accent" />}
    </Link>
  );
}
