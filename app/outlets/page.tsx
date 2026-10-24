'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import OutletInfo from '@/components/OutletInfo';
import { kecamatanOptions, kelurahanOptions, matchArea } from '@/lib/area';
import { outletStatus, statusBadge, statusLabel } from '@/lib/visits';
import { downloadText, outletsToCsv } from '@/lib/csv';
import Modal from '@/components/Modal';
import OutletForm from '@/components/OutletForm';
import ImportDialog from '@/components/ImportDialog';
import type { Outlet } from '@/lib/types';

export default function OutletsPage() {
  const outlets = useStore((s) => s.outlets);
  const visits = useStore((s) => s.visits);
  const upsertOutlet = useStore((s) => s.upsertOutlet);
  const deleteOutlet = useStore((s) => s.deleteOutlet);

  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);
  const [rayonF, setRayonF] = useState('all');
  const [salesF, setSalesF] = useState('all');
  const [kecF, setKecF] = useState('all');
  const [kelF, setKelF] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(
    () =>
      outlets.filter((o) => {
        if (rayonF !== 'all' && o.rayon !== rayonF) return false;
        if (salesF !== 'all' && o.salesman !== salesF) return false;
        if (!matchArea(o, kecF, kelF)) return false;
        if (q) {
          const s = `${o.name} ${o.address} ${o.outlet_code} ${o.city} ${o.kelurahan} ${o.kecamatan} ${o.category} ${(o.info ?? []).map((i) => i.value).join(' ')}`.toLowerCase();
          if (!s.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [outlets, q, rayonF, salesF, kecF, kelF]
  );

  const rayons = Array.from(new Set(outlets.map((o) => o.rayon).filter(Boolean))).sort();
  const salesmen = Array.from(new Set(outlets.map((o) => o.salesman).filter(Boolean))).sort();
  useEffect(() => setLimit(100), [q, rayonF, salesF, kecF, kelF]);
  const kecOpts = useMemo(() => kecamatanOptions(outlets), [outlets]);
  const kelOpts = useMemo(() => kelurahanOptions(outlets, kecF), [outlets, kecF]);
  const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700';

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / alamat / kode…"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-64"
        />
        <select value={rayonF} onChange={(e) => setRayonF(e.target.value)} className={sel}>
          <option value="all">Semua RSM</option>
          {rayons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={salesF} onChange={(e) => setSalesF(e.target.value)} className={sel}>
          <option value="all">Semua salesman</option>
          {salesmen.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={kecF} onChange={(e) => { setKecF(e.target.value); setKelF('all'); }} className={sel}>
          <option value="all">Semua kecamatan</option>
          {kecOpts.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <select value={kelF} onChange={(e) => setKelF(e.target.value)} className={sel}>
          <option value="all">Semua kelurahan</option>
          {kelOpts.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
        >
          + Tambah
        </button>
        <button onClick={() => setShowImport(true)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          ⬆ Import
        </button>
        <button
          onClick={() => downloadText(`outlets-${new Date().toISOString().slice(0, 10)}.csv`, outletsToCsv(filtered))}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          ⬇ Export CSV
        </button>
      </div>

      <p className="text-xs text-slate-500">Menampilkan {filtered.length} dari {outlets.length} outlet</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, limit).map((o) => {
          const st = outletStatus(o.id, visits);
          return (
            <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight text-slate-900">{o.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge[st]}`}>
                  {statusLabel[st]}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{o.address || (o.info ?? []).slice(0, 2).map((i) => `${i.label}: ${i.value}`).join(' · ') || o.city}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.rayon}</span>
                {o.salesman && <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.salesman}</span>}
                {o.category && <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.category}</span>}
                {o.kecamatan && <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.kelurahan ? `${o.kelurahan}, ` : ''}{o.kecamatan}</span>}
                {!o.is_active && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">Nonaktif</span>}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {o.latitude.toFixed(5)}, {o.longitude.toFixed(5)}
                {o.outlet_code && ` · ${o.outlet_code}`}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => { setEditing(o); setShowForm(true); }}
                  className="flex-1 rounded-lg border border-slate-300 py-1 text-[11px] font-medium text-slate-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Hapus outlet "${o.name}" beserta riwayat kunjungannya?`)) {
                      deleteOutlet(o.id);
                    }
                  }}
                  className="flex-1 rounded-lg border border-red-200 py-1 text-[11px] font-medium text-red-600"
                >
                  Hapus
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Tidak ada outlet yang cocok. Tambahkan manual atau import file Excel/CSV.
          </div>
        )}
      </div>
      {filtered.length > limit && (
        <button
          onClick={() => setLimit((l) => l + 100)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700"
        >
          Tampilkan 100 lagi ({filtered.length - limit} tersisa)
        </button>
      )}

      <OutletForm open={showForm} initial={editing} onClose={() => setShowForm(false)} onSave={upsertOutlet} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
