import './globals.css';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import SeedLoader from '@/components/SeedLoader';
import SyncManager from '@/components/SyncManager';

export const metadata: Metadata = {
  title: 'Maps Beruang',
  description: 'Pencarian outlet terdekat untuk tim sales — peta interaktif, radius, visit management.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const NAV = [
  { href: '/', label: 'Peta', icon: '🗺️' },
  { href: '/outlets', label: 'Outlet', icon: '🏪' },
  { href: '/visits', label: 'Kunjungan', icon: '📋' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        <SeedLoader />
        <SyncManager />
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="text-lg">📍</span>
              <span className="text-sm sm:text-base">Maps Beruang</span>
            </Link>
            <nav className="hidden gap-1 md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl pb-20 md:pb-8">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-600"
            >
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
