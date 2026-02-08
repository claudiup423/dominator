import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Dominator Training',
  description: 'Premium Rocket League AI Training Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
