import type { Outlet } from './types';

const HEADERS = [
  'outlet_code', 'name', 'address', 'kelurahan', 'kecamatan', 'city',
  'salesman', 'rayon', 'category', 'latitude', 'longitude', 'is_active',
] as const;

export function outletsToCsv(outlets: Outlet[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [HEADERS.join(',')];
  for (const o of outlets) {
    lines.push(
      [
        o.outlet_code, o.name, o.address, o.kelurahan, o.kecamatan, o.city,
        o.salesman, o.rayon, o.category, o.latitude, o.longitude, o.is_active,
      ]
        .map(esc)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob(['﻿' + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
