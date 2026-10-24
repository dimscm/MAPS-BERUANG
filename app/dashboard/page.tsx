'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { haversineKm } from '@/lib/geo';
import { outletStatus, statusBadge, statusLabel } from '@/lib/visits';

export default function DashboardPage() {
  const outlets = useStore((s) => s.outlets);
  const visits = useStore((s) => s.visits);
  const userLoc = useStore((s) => s.userLocation);

  const stats = useMemo(() => {
    const active = outlets.filter((o) => o.is_active);
    const withDist = userLoc
      ? active.map((o) => ({ o, d: haversineKm(userLoc.lat, userLoc.lng, o.latitude, o.longitude) }))
      : [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: outlets.length,
      aktif: active.length,
      nearby: withDist.filter((x) => x.d <= 5).length,
      belum: active.filter((o) => outletStatus(o.id, visits) === 'belum').length,
      followup: active.filter((o) => outletStatus(o.id, visits) === 'followup').length,
      today: visits.filter((v) => v.visit_time.slice(0, 10) === today).length,
    };
  }, [outlets, visits, userLoc]);

  const followupList = useMemo(
    () =>
      outlets
        .filter((o) => o.is_active && outletStatus(o.id, visits) === 'followup')
        .map((o) => ({ o, v: visits.filter((x) => x.outlet_id === o.id).sort((a, b) => b.visit_time.localeCompare(a.visit_time))[0] }))
        .sort((a, b) => (a.v?.follow_up_date ?? '').localeCompare(b.v?.follow_up_date ?? '')),
    [outlets, visits]
  );

  const todayList = useMemo(
    () =>
      visits
        .filter((v) => v.visit_time.slice(0, 10) === new Date().toISOString().slice(0, 10))
        .sort((a, b) => b.visit_time.localeCompare(a.visit_time)),
    [visits]
  );
  const byId = useMemo(() => new Map(outlets.map((o) => [o.id, o])), [outlets]);

  const cards = [
    { label: 'Total Outlet', value: stats.total, color: 'bg-slate-800' },
    { label: 'Outlet Aktif', value: stats.aktif, color: 'bg-blue-600' },
    { label: 'Outlet di Sekitar (≤5 km)', value: userLoc ? stats.nearby : '—', color: 'bg-indigo-600' },
    { label: 'Belum Dikunjungi', value: stats.belum, color: 'bg-red-600' },
    { label: 'Dikunjungi Hari Ini', value: stats.today, color: 'bg-green-600' },
    { label: 'Perlu Follow-up', value: stats.followup, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-4 p-3">
      <h1 className="text-base font-bold text-slate-900">Dashboard Sales</h1>
      {!userLoc && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          Aktifkan GPS di halaman Peta agar statistik radius bisa dihitung.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl p-3 text-white ${c.color}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-[11px] leading-tight opacity-90">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Perlu Follow-up ({followupList.length})
          </h2>
          <div className="space-y-2">
            {followupList.map(({ o, v }) => (
              <div key={o.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{o.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge[outletStatus(o.id, visits)]}`}>
                    {statusLabel.followup}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  📌 Follow-up: <b>{v?.follow_up_date || '-'}</b> · Kunjungan terakhir:{' '}
                  {v ? new Date(v.visit_time).toLocaleString('id-ID') : '-'} — {v?.sales_name}
                </p>
              </div>
            ))}
            {followupList.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                Tidak ada outlet yang perlu follow-up. 🎉
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Kunjungan Hari Ini ({todayList.length})
          </h2>
          <div className="space-y-2">
            {todayList.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {byId.get(v.outlet_id)?.name ?? '(outlet terhapus)'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(v.visit_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {v.sales_name}
                  {v.notes && ` · ${v.notes}`}
                </p>
              </div>
            ))}
            {todayList.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                Belum ada kunjungan hari ini.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
