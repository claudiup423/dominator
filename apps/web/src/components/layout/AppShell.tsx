'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect unauthenticated users to home (login screen)
  useEffect(() => {
    if (!loading && !user && pathname !== '/') {
      router.replace('/');
    }
  }, [loading, user, pathname, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dom-muted animate-pulse text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated — only render children on home page (login form)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {pathname === '/' ? children : null}
      </div>
    );
  }

  // Authenticated — show full app chrome
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 px-8 py-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
