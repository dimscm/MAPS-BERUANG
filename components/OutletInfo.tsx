'use client';

import type { Outlet } from '@/lib/types';

// Data survei (pemilik, status, transaksi, tempat beli) + foto toko
export default function OutletInfo({ outlet, compact = false }: { outlet: Pick<Outlet, 'info' | 'photos'>; compact?: boolean }) {
  const info = outlet.info ?? [];
  const photos = outlet.photos ?? [];
  const shown = compact ? info.slice(0, 4) : info;
  if (shown.length === 0 && photos.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {shown.length > 0 && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 text-[11px] leading-snug">
          {shown.map((i, k) => (
            <div key={k} className="contents">
              <dt className="text-slate-400">{i.label}</dt>
              <dd className="break-words font-medium text-slate-700">{i.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {!compact && photos[0] && (
            <a href={photos[0].url} target="_blank" rel="noopener noreferrer" className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[0].url}
                alt={photos[0].label}
                loading="lazy"
                className="max-h-48 w-full rounded-lg border border-slate-200 bg-slate-100 object-cover"
                onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')}
              />
            </a>
          )}
          {photos.map((p, k) => (
            <a
              key={k}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="nof-photo-link rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
            >
              📷 {p.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
