'use client';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon, LogOut, User } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <header className="h-14 border-b border-dom-border bg-dom-surface/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
      <div />

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button onClick={toggle} className="btn-ghost p-2" title="Toggle theme">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User menu */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-dom-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-dom-accent/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-dom-accent" />
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-medium text-dom-text">{user.email}</div>
                <div className="text-[10px] text-dom-muted uppercase">{user.role}</div>
              </div>
            </div>
            <button onClick={logout} className="btn-ghost p-2" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
