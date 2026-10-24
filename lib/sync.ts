import { SHEET_WEBHOOK_URL } from './config';
import { haversineKm } from './geo';
import type { Outlet, Visit } from './types';

// Nama tab di Google Sheet = RSM outlet (JAKBAR 1, JAKBAR 2, JAKSEL 1, JAKSEL 2, JAKTIM, JAKUT, JAKPUS, BEKASI KOTA)
export function areaTab(rayon: string): string {
  return (rayon || '').trim().toUpperCase() || 'LAINNYA';
}

export const syncEnabled = () => SHEET_WEBHOOK_URL.trim().length > 0;

// Kirim satu kunjungan ke Google Sheet. Apps Script membalas {"ok":true} bila baris tersimpan;
// selain itu dianggap gagal dan dicoba lagi nanti.
export async function sendVisit(v: Visit, o: Outlet | undefined): Promise<void> {
  const dist =
    o && v.sales_lat != null && v.sales_lng != null
      ? Math.round(haversineKm(v.sales_lat, v.sales_lng, o.latitude, o.longitude) * 1000)
      : '';
  const payload = {
    area: areaTab(o?.rayon ?? ''),
    visit_id: v.id,
    outlet_id: v.outlet_id,
    waktu_kunjungan: v.visit_time,
    dicatat_pada: v.created_at,
    salesman: v.sales_name,
    hasil: v.visit_status === 'followup' ? 'Perlu follow-up' : 'Sudah dikunjungi',
    tanggal_follow_up: v.follow_up_date,
    catatan: v.notes,
    kode_outlet: o?.outlet_code ?? '',
    nama_outlet: o?.name ?? '(outlet terhapus)',
    alamat: o?.address ?? '',
    kelurahan: o?.kelurahan ?? '',
    kecamatan: o?.kecamatan ?? '',
    kota: o?.city ?? '',
    rayon: o?.rayon ?? '',
    kategori: o?.category ?? '',
    lat_outlet: o?.latitude ?? '',
    lng_outlet: o?.longitude ?? '',
    lat_sales: v.sales_lat ?? '',
    lng_sales: v.sales_lng ?? '',
    jarak_sales_ke_outlet_m: dist,
  };
  const res = await fetch(SHEET_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Gagal kirim (HTTP ${res.status})`);
}

export interface RemoteVisit {
  id: string;
  outlet_id: string;
  outlet_code: string;
  outlet_name: string;
  visit_time: string;
  sales_name: string;
  hasil: string;
  follow_up_date: string;
  notes: string;
}

// Ambil semua kunjungan tim dari Google Sheet (untuk status titik di peta semua pengguna)
export async function fetchRemoteVisits(): Promise<RemoteVisit[]> {
  const sep = SHEET_WEBHOOK_URL.includes('?') ? '&' : '?';
  const res = await fetch(`${SHEET_WEBHOOK_URL}${sep}action=visits&t=${Date.now()}`);
  const data = (await res.json().catch(() => null)) as { ok?: boolean; visits?: RemoteVisit[] } | null;
  if (!res.ok || !data?.ok || !Array.isArray(data.visits)) throw new Error('Gagal mengambil kunjungan tim');
  return data.visits;
}

export function remoteToVisits(remote: RemoteVisit[], outlets: Outlet[]): Visit[] {
  const ids = new Set(outlets.map((o) => o.id));
  const byCode = new Map(outlets.filter((o) => o.outlet_code).map((o) => [o.outlet_code, o.id]));
  const byName = new Map(outlets.map((o) => [o.name.trim().toUpperCase(), o.id]));
  const out: Visit[] = [];
  for (const r of remote) {
    const t = new Date(r.visit_time);
    if (!r.id || isNaN(t.getTime())) continue;
    const outletId =
      (r.outlet_id && ids.has(r.outlet_id) && r.outlet_id) ||
      (r.outlet_code && byCode.get(r.outlet_code)) ||
      byName.get(r.outlet_name.trim().toUpperCase());
    if (!outletId) continue;
    out.push({
      id: r.id,
      outlet_id: outletId,
      sales_name: r.sales_name,
      visit_time: t.toISOString(),
      visit_status: /follow/i.test(r.hasil) ? 'followup' : 'sudah',
      notes: r.notes,
      follow_up_date: r.follow_up_date,
      created_at: t.toISOString(),
      synced: true,
    });
  }
  return out;
}
