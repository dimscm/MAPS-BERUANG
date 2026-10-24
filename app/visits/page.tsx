'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { syncEnabled } from '@/lib/sync';

export default function VisitsPage() {
  const visits = useStore((s) => s.visits);
  const outlets = useStore((s) => s.outlets);
  const [q, setQ] = useState('');

  const byId = useMemo(() => new Map(outlets.map((o) => [o.id, o])), [outlets]);
  const sorted = useMemo(
    () =>
      visits
        .filter((v) => {
          if (!q) return true;
          const o = byId.get(v.outlet_id);
          const s = `${v.sales_name} ${v.notes} ${o?.name ?? ''}`.toLowerCase();
          return s.includes(q.toLowerCase());
        })
        .sort((a, b) => b.visit_time.localeCompare(a.visit_time)),
    [visits, q, byId]
  );

  return (
    <div className="space-y-3 p-3">
      <h1 className="text-base font-bold text-slate-900">Riwayat Kunjungan</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari outlet, sales, atau catatan…"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-80"
      />
      <div className="space-y-2">
        {sorted.map((v) => {
          const o = byId.get(v.outlet_id);
          return (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{o?.name ?? '(outlet terhapus)'}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${v.visit_status === 'followup' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {v.visit_status === 'followup' ? 'Perlu follow-up' : 'Sudah dikunjungi'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(v.visit_time).toLocaleString('id-ID')} · {v.sales_name}
                {o && ` · ${o.rayon}`}
              </p>
              {v.notes && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{v.notes}</p>}
              {syncEnabled() && (
                <p className={`mt-1 text-[11px] font-medium ${v.synced ? 'text-green-700' : 'text-slate-400'}`}>
                  {v.synced ? '✓ Terkirim ke Google Sheet' : '⏳ Belum terkirim ke Google Sheet (dicoba ulang otomatis)'}
                </p>
              )}
              {v.follow_up_date && (
                <p className="mt-1 text-[11px] font-medium text-amber-700">📌 Follow-up: {v.follow_up_date}</p>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Belum ada kunjungan tercatat. Catat kunjungan dari halaman Peta.
          </div>
        )}
      </div>
    </div>
  );
}
