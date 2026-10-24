import type { Outlet } from './types';

// Nilai filter kecamatan = "Kecamatan||Kota" supaya kecamatan bernama sama di kota berbeda
// (mis. Cipayung Jakarta Timur vs Cipayung Depok) tidak tercampur.
export const SEP = '||';
export const kecKey = (o: Pick<Outlet, 'kecamatan' | 'city'>) => (o.kecamatan ? `${o.kecamatan}${SEP}${o.city}` : '');

export function kecamatanOptions(outlets: Outlet[]) {
  const keys = Array.from(new Set(outlets.map(kecKey).filter(Boolean)));
  const nameCount = new Map<string, number>();
  for (const k of keys) {
    const n = k.split(SEP)[0];
    nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
  }
  return keys
    .map((k) => {
      const [kec, city] = k.split(SEP);
      const label = (nameCount.get(kec) ?? 0) > 1 && city ? `${kec} (${city})` : kec;
      return { value: k, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));
}

export function kelurahanOptions(outlets: Outlet[], kecF: string) {
  const pool = kecF === 'all' ? outlets : outlets.filter((o) => kecKey(o) === kecF);
  return Array.from(new Set(pool.map((o) => o.kelurahan).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id'));
}

export function matchArea(o: Outlet, kecF: string, kelF: string) {
  if (kecF !== 'all' && kecKey(o) !== kecF) return false;
  if (kelF !== 'all' && o.kelurahan !== kelF) return false;
  return true;
}
